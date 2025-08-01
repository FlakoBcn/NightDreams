import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { onRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
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

    // Solo actuar si el estado cambió a "aprobado"
    if (
      before.estado !== 'aprobado' &&
      after.estado === 'aprobado' &&
      after.idReserva &&
      after.promotor
    ) {
      const reservaId = after.idReserva;
      const promotorUid = after.promotor;

      // 1. Actualiza el estado de la reserva principal (si existe)
      await db.collection('reservas').doc(reservaId).update({ estado: 'eliminada' }).catch(()=>{});

      // 2. Actualiza el estado en duplicados (si existen)
      await db.collection('reservas_por_promotor').doc(promotorUid).collection('reservas').doc(reservaId).update({ estado: 'eliminada' }).catch(()=>{});
      await db.collection('reservas_por_promotor').doc(promotorUid).collection('reservasLegacy').doc(reservaId).update({ estado: 'eliminada' }).catch(()=>{});

      // 3. Busca el tokenPush del promotor
      const promotorDoc = await db.collection('usuarios').doc(promotorUid).get();
      const tokenPush = promotorDoc.exists ? promotorDoc.data().tokenPush : null;

      // 4. Notifica al promotor si tiene tokenPush
      if (tokenPush) {
        await fcm.send({
  token: tokenPush,
  data: {
    title: '🗑️ Reserva eliminada',
    body: `Tu solicitud de eliminación para la reserva ${reservaId} fue aprobada.`,
    type: 'eliminacion_aprobada',
    reservaId
  },
  android: { priority: 'high' },
  apns: { headers: { 'apns-priority': '10' } },
  webpush: { headers: { Urgency: 'high' } },
});
        console.log(`✅ Notificado promotor UID: ${promotorUid} sobre eliminación de reserva ${reservaId}`);
      }
    }
  }
);

// 🧪 API Endpoint de Prueba
export const testApi = onRequest((req, res) => {
  res.json({
    message: 'NightDreams Functions v2.0 - Sistema Unificado',
    timestamp: new Date().toISOString(),
    status: 'online',
  });
});
