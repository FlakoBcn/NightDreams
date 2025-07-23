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

async function sendMulticastFCM(tokens, payload) {
  const results = await Promise.allSettled(
    tokens.map(token => fcm.send({ ...payload, token }))
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

  const successful = await sendMulticastFCM(tokens, {
    notification: { title, body },
    data,
  });

  console.log(`🔔 Notificaciones enviadas: ${successful}/${tokens.length}`);
}

// ──────────────────────────── CLOUD FUNCTIONS ────────────────────────────

// 📝 Solicitud de Modificación
export const notificarAdminSolicitud = onDocumentCreated(
  { document: 'solicitudes_modificacion/{id}', region: 'us-central1' },
  async event => {
    if (!(await isFirstTime(event.id))) return;
    const data = event.data.data();

    await notificarAdmins(
      `📝 Solicitud ${data.idReserva || 'Nueva'}`,
      `Promotor ${data.promotor || ''} solicita modificaciones.`,
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
        notification: {
          title: '🎉 ¡Cuenta aprobada!',
          body: 'Ya puedes acceder a NightDreams.',
        },
        data: { type: 'aprobacion' },
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

// 🧪 API Endpoint de Prueba
export const testApi = onRequest((req, res) => {
  res.json({
    message: 'NightDreams Functions v2.0 - Sistema Unificado',
    timestamp: new Date().toISOString(),
    status: 'online',
  });
});
