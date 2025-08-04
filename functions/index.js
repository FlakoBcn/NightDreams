import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { onRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';





initializeApp();
const db = getFirestore();
const fcm = getMessaging();

// ──────────────────────────── CONSTANTES ────────────────────────────
const ROLES = {
  ADMIN: 'admin',
  PROMOTOR: 'promotor',
};

const ESTADOS = {
  APROBADO: 'Aprobado',
  PENDIENTE: 'Pendiente',
};

const EVENT_LOG = 'eventLog';

// ──────────────────────────── HELPERS ────────────────────────────
async function isFirstTime(eventId) {
  const ref = db.doc(`${EVENT_LOG}/${eventId}`);
  const snap = await ref.get();
  if (snap.exists) return false;
  await ref.set({ ts: Date.now() });
  return true;
}

async function getAdminTokens() {
  const snap = await db
    .collection('usuarios')
    .where('rol', '==', ROLES.ADMIN)
    .where('tokenPush', '!=', '')
    .where('estado', '==', ESTADOS.APROBADO)
    .get();

  return [...new Set(snap.docs.map(d => d.data().tokenPush))];
}

async function sendMulticastFCM(tokens, data) {
  const results = await Promise.allSettled(
    tokens.map(token =>
      fcm.send({
        token,
        data, // ← usa sólo DATA
        android: { priority: 'high' },
        apns: { headers: { 'apns-priority': '10' } },
        webpush: { headers: { Urgency: 'high' } },
      })
    )
  );
  
  const batch = db.batch();

  results.forEach((r, i) => {
    if (
      r.status === 'rejected' &&
      ['messaging/registration-token-not-registered', 'messaging/invalid-registration-token'].includes(
        r.reason.code
      )
    ) {
      const query = db.collection('usuarios').where('tokenPush', '==', tokens[i]);
      query.get().then(snap => snap.forEach(doc => batch.update(doc.ref, { tokenPush: '', ultimoTokenUpdate: null })));
    }
  });

  await batch.commit();
  return results.filter(r => r.status === 'fulfilled').length;
}

async function notificarAdmins(title, body, data = {}) {
  const tokens = await getAdminTokens();
  if (!tokens.length) {
    console.log('⚠️ Sin tokens de admin disponibles.');
    return;
  }

  // Combina titulo y cuerpo en datos personalizados
  const payloadData = { title, body, ...data, type: data.type || 'admin_alert' };

  const successful = await sendMulticastFCM(tokens, payloadData);

  console.log(`🔔 Notificaciones enviadas: ${successful}/${tokens.length}`);
}

// ──────────────────────────── CLOUD FUNCTIONS ────────────────────────────

// 📝 Solicitud de Eliminación
export const notificarAdminSolicitud = onDocumentCreated(
  { document: 'solicitudes_eliminacion/{id}', region: 'us-central1' },
  async event => {
    if (!(await isFirstTime(event.id))) return;
    const data = event.data.data();

    await notificarAdmins(
      `📝 Solicitud ${data.idReserva || 'Nueva'}`,
      `Promotor ${data.promotor || ''} solicita eliminación.`,
      {
        type: 'solicitud',
        reservaId: data.idReserva || '',
        promotor: data.promotor || '',
      }
    );
  }
);

// 👤 Nuevo Promotor
export const notificarAdminNuevoPromotor = onDocumentCreated(
  { document: 'usuarios/{uid}', region: 'us-central1' },
  async event => {
    if (!(await isFirstTime(event.id))) return;
    const data = event.data.data();
    if (data.rol !== ROLES.PROMOTOR) return;

    await notificarAdmins(
      '👤 Nuevo promotor registrado',
      `${data.nombre || ''} (${data.correo || ''}) se ha registrado.`,
      { type: 'alta_promotor', uid: event.params.uid }
    );
  }
);

// 🎫 Nueva Reserva
export const notificarAdminNuevaReserva = onDocumentCreated(
  { document: 'reservas/{id}', region: 'us-central1' },
  async event => {
    if (!(await isFirstTime(event.id))) return;
    const data = event.data.data();

    await notificarAdmins(
      '🎫 Nueva reserva',
      `${data.NombreCliente || ''} - ${data.Club || ''} (${data.Pax || 0} pax) por ${data.Promotor || ''}`,
      {
        type: 'nueva_reserva',
        reservaId: event.params.id,
        club: data.Club || '',
        promotor: data.Promotor || '',
      }
    );
  }
);

// 🎉 Promotor Aprobado
export const notificarPromotorAprobado = onDocumentUpdated(
  { document: 'usuarios/{uid}', region: 'us-central1' },
  async event => {
    const before = event.data.before.data();
    const after = event.data.after.data();

    if (
      before.estado !== ESTADOS.APROBADO &&
      after.estado === ESTADOS.APROBADO &&
      after.tokenPush &&
      (await isFirstTime(event.id))
    ) {
      await fcm.send({
  token: after.tokenPush,
  data: {
    title: '🎉 ¡Cuenta aprobada!',
    body: 'Ya puedes acceder a NightDreams.',
    type: 'aprobacion'
  },
  android: { priority: 'high' },
  apns: { headers: { 'apns-priority': '10' } },
  webpush: { headers: { Urgency: 'high' } },
});
      console.log(`✅ Promotor aprobado: ${after.nombre || ''}`);
    }
  }
);

// 🧹 Limpieza Diaria de Tokens Inválidos (2 AM)
export const limpiezaTokens = onSchedule(
  { schedule: '0 2 * * *', timeZone: 'America/Mexico_City', region: 'us-central1' },
  async () => {
    console.log('🧹 Iniciando limpieza programada de tokens...');

    const snap = await db.collection('usuarios').where('tokenPush', '!=', '').get();
    const batch = db.batch();

    await Promise.all(
      snap.docs.map(async doc => {
        const token = doc.data().tokenPush;
        try {
          await fcm.send({
            token,
            data: { type: 'validation' },
            android: { priority: 'normal' },
            apns: { headers: { 'apns-priority': '5' } },
          });
        } catch (e) {
          if (
            ['messaging/registration-token-not-registered', 'messaging/invalid-registration-token'].includes(e.code)
          ) {
            batch.update(doc.ref, { tokenPush: '', ultimoTokenUpdate: null });
          }
        }
      })
    );

    await batch.commit();
    console.log('✅ Limpieza de tokens completada.');
  }
);

export const sendManualPush = onRequest({ region: "us-central1", cors: true }, async (req, res) => {
  const { titulo, cuerpo, tokens } = req.body;

  if (!titulo || !cuerpo || !Array.isArray(tokens)) {
    return res.status(400).json({ error: 'Faltan datos o formato inválido' });
  }

  try {
    const messaging = getMessaging();
    const result = await messaging.sendEachForMulticast({
  tokens,
  data: { title: titulo, body: cuerpo, type: 'manual' },
  android: { priority: 'high' },
  apns: { headers: { 'apns-priority': '10' } },
  webpush: { headers: { Urgency: 'high' } },
});

    const enviados = result.responses.filter(r => r.success).length;
    res.json({ success: true, enviados });
  } catch (err) {
    console.error('❌ Error al enviar push:', err);
    res.status(500).json({ error: 'Error interno al enviar push' });
  }
});



// 🗑️ Solicitud de Eliminación Aprobada: actualiza reservas y notifica al promotor
export const onSolicitudEliminacionAprobada = onDocumentUpdated(
  { document: 'solicitudes_eliminacion/{Id}', region: 'us-central1' },
  async event => {
    const before = event.data.before.data();
    const after = event.data.after.data();

    // Verificar cambio real en el estado
    const estadoAntes = (before.estado || before.Estado || '').toLowerCase();
    const estadoDespues = (after.estado || after.Estado || '').toLowerCase();
    if (estadoAntes === estadoDespues) return;

    // Validar datos mínimos
    if (!['eliminada', 'rechazada'].includes(estadoDespues)) return;
    if (!after.idReserva || !after.promotorUid) return;

    const reservaId = after.idReserva;
    const uid = after.promotorUid;
    const promotorNombre = after.promotor || '';

    // 1. Actualizar el estado de la reserva para ese promotor
    await db.collection('reservas_por_promotor')
      .doc(uid)
      .collection('reservas')
      .doc(reservaId)
      .update({ estado: estadoDespues })
      .catch(() => {});

    // 2. Obtener token del promotor para push
    let tokenPush = null;
    const userSnap = await db.collection('usuarios').doc(uid).get();
    if (userSnap.exists) {
      tokenPush = userSnap.data().tokenPush;
    }

    // 3. Crear mensaje de notificación
    let mensaje = '';
    if (estadoDespues === 'eliminada') {
      mensaje = `Tu solicitud para eliminar la reserva del ${after.fecha || after.Fecha || ''} fue aprobada.`;
    } else if (estadoDespues === 'rechazada') {
      mensaje = `Tu solicitud para eliminar la reserva del ${after.fecha || after.Fecha || ''} fue rechazada.`;
    }

    // 4. Enviar notificación push
    if (tokenPush) {
      await fcm.send({
        token: tokenPush,
        data: {
          title: 'Solicitud de eliminación',
          body: mensaje,
          type: 'eliminacion_atendida',
          reservaId,
          fecha: after.fecha || after.Fecha || ''
        },
        android: { priority: 'high' },
        apns: { headers: { 'apns-priority': '10' } },
        webpush: { headers: { Urgency: 'high' } },
      });
    }
  }
);




// ──────────────────────────── MESAS ────────────────────────────


export const cambiarEstadoMesa = onRequest({ region: 'us-central1', cors: true }, async (req, res) => {
  // ---- CORS ----
  const allowedOrigin = process.env.ALLOWED_ORIGIN || "https://nightdreams-f90b0.web.app";
  res.set('Access-Control-Allow-Origin', allowedOrigin);
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  // ---- FIN CORS ----

  // ACCESO SECRETO DESDE functions.config()
  const GPT_SECRET = "!Claudio9";
  if (!GPT_SECRET) {
    return res.status(500).send("🔑 GPT_SECRET no está configurado en Firebase functions:config.");
  }
  const { mesa, cliente, estado, token } = req.body || {};

  // Comprobación de token secreto
  if (!token || token !== GPT_SECRET) {
    return res.status(403).send("🔒 Acceso denegado.");
  }

  if (!mesa) return res.status(400).send("❌ Falta el identificador de la mesa");
  if (!cliente) return res.status(400).send("❌ Falta el nombre del cliente");
  if (!["confirmada", "rechazada"].includes(estado)) return res.status(400).send("❌ Estado inválido");

  try {
    const ref = db.collection("mesas").doc(mesa);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).send("❌ Mesa no encontrada");
    const prev = doc.data();
    await ref.update({
      estado,
      cliente,
      mesa,
      updatedAt: FieldValue.serverTimestamp(),
    });
    res.status(200).send({
      success: true,
      mesa,
      cliente,
      estado,
      estadoAnterior: prev.estado,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error("Error al cambiar estado de mesa:", error);
    res.status(500).send("Error interno");
  }
});





// 🧪 API Endpoint de Prueba
export const testApi = onRequest((req, res) => {
  res.json({
    message: 'NightDreams Functions v2.0 - Sistema Unificado',
    timestamp: new Date().toISOString(),
    status: 'online',
  });
});
