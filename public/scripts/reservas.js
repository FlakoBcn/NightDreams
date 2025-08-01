import { loadFirebase } from '/scripts/app.js';

let db;

export async function init() {
  const { db: firebaseDb } = await loadFirebase();
  db = firebaseDb;

  // Datos de usuario
  const correo = localStorage.getItem('correo');
  const uid = localStorage.getItem('uid');
  const isBoss = correo === 'official.nightdreams@gmail.com';

  // DOM
  const tituloTabla = document.getElementById('tituloTabla');
  const btnCSV = document.getElementById('csvBtn');
  const destino = document.getElementById('tablaReservas');
  const destinoLegacy = document.getElementById('tablaReservasLegacy');

  // Título y botón CSV según usuario
  if (isBoss) {
    tituloTabla.textContent = 'Reservas globales (Boss)';
    btnCSV.style.display = '';
    await mostrarReservasBoss(destino, btnCSV);
  } else {
    tituloTabla.textContent = 'Mis reservas';
    btnCSV.style.display = 'none';
    await mostrarReservasPromotor(uid, destino);
    await mostrarReservasLegacyPromotor(uid, destinoLegacy);
  }
  // Refresh iconos Lucide
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

// Boss: ver TODAS las reservas y notificación de solicitudes
async function mostrarReservasBoss(destino, btnCSV) {
  destino.innerHTML = 'Cargando reservas…';
  try {
    // Obtener todos los documentos de la colección 'reservas'
    const reservasSnap = await db.collection('reservas').get();
    let docs = [];
    let columnasSet = new Set();

    reservasSnap.forEach(doc => {
      const data = doc.data();
      docs.push(data);
      Object.keys(data).forEach(col => columnasSet.add(col));
    });

    if (docs.length === 0) {
      destino.innerHTML = '<p class="text-gray-500 text-center py-6">No hay reservas en la base de datos.</p>';
      return;
    }

    // Prepara columnas
    const columnasPrioridad = [
      "Club", "FechaTexto", "NombreCliente", "Pax", "Precio", "Pagado",
      "Email", "Telefono", "Promotor", "PromotorId", "Fecha", "ReservationID", "Estado"
    ];
    const columnas = columnasPrioridad.filter(c => columnasSet.has(c))
      .concat([...columnasSet].filter(c => !columnasPrioridad.includes(c)));

    // Renderiza la tabla
    let html = `<div class="overflow-x-auto">
      <table class="w-full text-sm text-gray-900 rounded-xl shadow-lg bg-white">
        <thead class="bg-slate-100"><tr>
          ${columnas.map(col => `<th class="px-4 py-3 font-bold text-left">${col}</th>`).join('')}
        </tr></thead>
        <tbody>`;

    docs.forEach(data => {
      html += '<tr class="border-t hover:bg-slate-100">';
      columnas.forEach(col => {
        let val = data[col] ?? '';
        html += `<td class="px-4 py-4 whitespace-nowrap">${val}</td>`;
      });
      html += '</tr>';
    });

    html += '</tbody></table></div>';
    destino.innerHTML = html;

    // CSV solo para Boss
    prepararBotonCSV(btnCSV, docs, columnas);

  } catch (error) {
    console.error('❌ Error al cargar reservas:', error);
    destino.innerHTML = '<p class="text-red-600 text-center py-6">Error al cargar reservas.</p>';
  }
}

// Promotor: ver solo sus reservas y acciones
async function mostrarReservasPromotor(uid, destino) {
  destino.innerHTML = 'Cargando reservas…';
  try {
    const snap = await db.collection('reservas_por_promotor')
      .doc(uid)
      .collection('reservas')
      .orderBy('ReservationID')
      .get();

    if (snap.empty) {
      destino.innerHTML = '<p class="text-gray-500 text-center py-6">No tienes reservas aún.</p>';
      return;
    }

    const columnas = [
      "Club", "FechaTexto", "NombreCliente", "Pax", "Precio", "Pagado", "Estado", "Acciones"
    ];

    let html = `<div class="overflow-x-auto">
      <table class="w-full text-[1rem] rounded-xl shadow-lg bg-white">
        <thead class="bg-slate-100">
          <tr>
            ${columnas.map(col => `<th class="px-4 py-3 font-bold text-left">${col}</th>`).join('')}
          </tr>
        </thead>
        <tbody>`;

    snap.forEach(doc => {
      const data = doc.data();
      const estaPendienteEliminacion = data.Estado === "pendiente_eliminacion";

      html += `<tr class="border-t ${estaPendienteEliminacion ? 'bg-red-50 text-gray-500' : 'hover:bg-slate-100'}">`;
      columnas.forEach(col => {
        let val = data[col] ?? '';
        if (col === "Acciones") {
          val = estaPendienteEliminacion
            ? `<span class="italic text-red-400">En revisión</span>`
            : `<button class="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded shadow transition"
                onclick="openModalEliminacion('${doc.id}')">
                Eliminar
              </button>`;
        }
        html += `<td class="px-4 py-4 whitespace-nowrap">${val}</td>`;
      });
      html += '</tr>';
    });

    html += '</tbody></table></div>';
    destino.innerHTML = html;
    if (window.lucide) window.lucide.createIcons();

  } catch (error) {
    console.error('❌ Error al cargar reservas:', error);
    destino.innerHTML = '<p class="text-red-600 text-center py-6">Error al cargar reservas.</p>';
  }
}

// Promotor: tabla SOLO de legacy
async function mostrarReservasLegacyPromotor(uid, destino) {
  destino.innerHTML = 'Cargando reservas antiguas…';
  try {
    const snap = await db.collection('reservas_por_promotor')
      .doc(uid)
      .collection('reservasLegacy')
      .get();

    if (snap.empty) {
      destino.innerHTML = '<p class="text-gray-400 text-center py-6">No tienes reservas antiguas.</p>';
      return;
    }

    // Usa SOLO columnas legacy
    const columnas = [
      "Promotor", "FechaTexto", "Club", "NombreCliente", "Pax",
      "Precio", "Pagado", "Email", "Telefono", "Fecha", "ReservationID", "Estado"
    ];

    let html = `<div class="overflow-x-auto">
      <table class="w-full text-xs md:text-sm rounded-xl shadow-lg">
        <thead class="bg-yellow-100 text-orange-900"><tr>
          ${columnas.map(col => `<th class="px-4 py-3 font-bold text-left">${col}</th>`).join('')}
        </tr></thead>
        <tbody>`;

    // Ordenar por fecha
    const docs = [];
    snap.forEach(doc => docs.push(doc.data()));
    docs.sort((a, b) => {
      const fa = a["Fecha"] ? new Date(a["Fecha"]).getTime() : 0;
      const fb = b["Fecha"] ? new Date(b["Fecha"]).getTime() : 0;
      return fb - fa;
    });

    docs.forEach(data => {
      html += '<tr class="border-t hover:bg-yellow-50">';
      columnas.forEach(col => {
        let val = data[col] ?? '';
        html += `<td class="px-4 py-3 whitespace-nowrap">${val}</td>`;
      });
      html += '</tr>';
    });

    html += '</tbody></table></div>';
    destino.innerHTML = html;
  } catch (error) {
    destino.innerHTML = '<p class="text-red-600 text-center py-6">Error al cargar reservas antiguas.</p>';
    console.error(error);
  }
}


// Exportar CSV (solo Boss)
function prepararBotonCSV(btn, data, columnas) {
  if (!btn) return;
  btn.onclick = () => {
    const rows = data.map(d =>
      columnas.map(c => {
        let v = d[c];
        if (v == null) v = '';
        return `"${String(v).replace(/"/g, '""')}"`;
      }).join(',')
    );

    const csvContent = [columnas.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `reservas-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };
}

// =============================== MODALES Y SOLICITUDES ===============================

// MODAL ELIMINACIÓN
window.openModalEliminacion = function(reservaId) {
  document.getElementById('modalEliminacion').classList.remove('hidden');
  document.getElementById('elimReservaId').value = reservaId;
  document.getElementById('elimMotivo').value = '';
};

window.closeModalEliminacion = function() {
  document.getElementById('modalEliminacion').classList.add('hidden');
};

// ENVÍO SOLICITUD ELIMINACIÓN
window.enviarSolicitudEliminacion = async function() {
  const reservaId = document.getElementById('elimReservaId').value;
  const motivo = document.getElementById('elimMotivo').value;
  const uid = localStorage.getItem('uid');

  // Envía la solicitud
  const solicitud = {
    tipo: "eliminacion",
    idReserva: reservaId,
    motivo,
    estado: "pendiente",
    promotor: uid,
    timestamp: firebase.firestore.FieldValue.serverTimestamp()
  };
  const { db } = await loadFirebase();
  await db.collection('solicitudes_eliminacion').add(solicitud);

  // Marca la reserva en Firestore (usando Estado con E mayúscula)
  await db.collection('reservas_por_promotor').doc(uid)
    .collection('reservas').doc(reservaId)
    .update({ Estado: "pendiente_eliminacion" });

  alert('Solicitud de eliminación enviada. El Boss debe aprobarla.');
  closeModalEliminacion();

  // Refresca la tabla
  const destino = document.getElementById('tablaReservas');
  await mostrarReservasPromotor(uid, destino);
};
