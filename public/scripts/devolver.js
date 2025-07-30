import { loadFirebase } from '/scripts/app.js';

let db;

export async function init() {
  const { db: firebaseDb } = await loadFirebase();
  db = firebaseDb;

  const uid = localStorage.getItem('uid');
  console.log('↩️ [Devolver] Inicializando página devolver');

  const total = await calcularTotalDevolver(uid);
  document.getElementById('valorDevolver').textContent = total.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });

  // Opcional: inicializar iconos o elementos extra
  if (window.lucide) window.lucide.createIcons();
}

async function calcularTotalDevolver(uidPromotor) {
  let total = 0;
  try {
    const snap = await db.collection('reservas_por_promotor')
      .doc(uidPromotor)
      .collection('reservas')
      .get();
    snap.forEach(doc => {
      const data = doc.data();
      const pagado = Number(data.pagado || data.Pagado || 0);
      const pax = Number(data.pax || data.Pax || 0);
      total += (pagado - 5 * pax);
    });
  } catch (e) {
    console.error('Error calculando devoluciones:', e);
  }
  return total;
}

export function cleanup() {
  console.log('↩️ [Devolver] Limpiando página devolver');
}