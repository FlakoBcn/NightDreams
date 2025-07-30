import { loadFirebase } from '/scripts/app.js';

let db;

export async function init() {
  const { db: firebaseDb } = await loadFirebase();
  db = firebaseDb;

  // Datos de usuario
  const correo = localStorage.getItem('correo');
  const uid = localStorage.getItem('uid');
  const soyBoss = correo === 'official.nightdreams@gmail.com';

  // DOM
  const tituloTabla = document.getElementById('tituloTabla');
  const btnCSV = document.getElementById('csvBtn');
  const destino = document.getElementById('tablaReservas');
    const destinoLegacy = document.getElementById('tablaReservasLegacy');

  // Título y botón CSV según usuario
  if (soyBoss) {
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
    const promotoresSnap = await db.collection('reservas_por_promotor').get();
    let docs = [];
    let columnasSet = new Set();
    let solicitudesPendientesPorPromotor = {};

    // Lee todas las solicitudes pendientes agrupadas por promotor
    const solicitudesSnap = await db.collection('solicitudes_reservas')
      .where('estado', '==', 'pendiente')
      .get();

    solicitudesSnap.forEach(doc => {
      const data = doc.data();
      const promotorUid = data.promotorUid;
      solicitudesPendientesPorPromotor[promotorUid] = true;
    });

    for (const promotorDoc of promotoresSnap.docs) {
      const reservasSnap = await promotorDoc.ref.collection('reservas').get();
      reservasSnap.forEach(doc => {
        const data = doc.data();
        docs.push(data);
        Object.keys(data).forEach(col => columnasSet.add(col));
      });
    }

    if (docs.length === 0) {
      destino.innerHTML = '<p class="text-gray-500 text-center py-6">No hay reservas en la base de datos.</p>';
      return;
    }

    // Prepara columnas
    const columnasPrioridad = [
      "Club", "FechaTexto", "NombreCliente", "Pax", "Precio", "Pagado",
      "Email", "Telefono", "Promotor", "PromotorUid", "Fecha", "ReservationID", "Estado"
    ];
    const columnas = columnasPrioridad.filter(c => columnasSet.has(c))
      .concat([...columnasSet].filter(c => !columnasPrioridad.includes(c)));

    // Renderiza la tabla
    let html = `<div class="overflow-x-auto">
      <table class="min-w-full text-sm text-gray-900">
        <thead class="bg-slate-100"><tr>
          ${columnas.map(col => `<th class="px-3 py-2">${col}</th>`).join('')}
        </tr></thead>
        <tbody>`;

    docs.forEach(data => {
      html += '<tr class="border-t">';
      columnas.forEach(col => {
        let val = data[col] ?? '';
        // Si la columna es "PromotorUid", mostramos notificación si tiene solicitudes pendientes
        if (col === "PromotorUid" && val && solicitudesPendientesPorPromotor[val]) {
          val += ' <span title="Solicitud pendiente" style="color:#f59e42;font-weight:bold;font-size:1.2em;">&#9888;</span>';
        }
        html += `<td class="px-3 py-1 whitespace-nowrap">${val}</td>`;
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
      <table class="min-w-full text-sm text-gray-900">
        <thead class="bg-slate-100"><tr>
          ${columnas.map(col => `<th class="px-3 py-2">${col}</th>`).join('')}
        </tr></thead>
        <tbody>`;

    snap.forEach(doc => {
      const data = doc.data();
      html += '<tr class="border-t">';
      columnas.forEach(col => {
        let val = data[col] ?? '';
        if (col === "Acciones") {
          val = `
            <button class="text-xs bg-yellow-400 text-black px-2 py-1 rounded mr-1" onclick="openModalModificacion('${doc.id}', '${data.NombreCliente}', '${data.Pax}', '${data.Precio}')">Modificar</button>
            <button class="text-xs bg-red-500 text-white px-2 py-1 rounded" onclick="openModalEliminacion('${doc.id}')">Eliminar</button>
          `;
        }
        html += `<td class="px-3 py-1 whitespace-nowrap">${val}</td>`;
      });
      html += '</tr>';
    });

    html += '</tbody></table></div>';
    destino.innerHTML = html;
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
      <table class="min-w-full text-xs md:text-sm">
        <thead class="bg-yellow-100 text-orange-900"><tr>
          ${columnas.map(col => `<th class="px-3 py-2">${col}</th>`).join('')}
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
      html += '<tr class="border-t">';
      columnas.forEach(col => {
        let val = data[col] ?? '';
        html += `<td class="px-3 py-1 whitespace-nowrap">${val}</td>`;
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

// MODAL MODIFICACIÓN
window.openModalModificacion = function(reservaId, nombre, pax, precio) {
  document.getElementById('modalModificacion').classList.remove('hidden');
  document.getElementById('modReservaId').value = reservaId;
  document.getElementById('modNombreCliente').value = nombre;
  document.getElementById('modPax').value = pax;
  document.getElementById('modPrecio').value = precio;
  document.getElementById('modMotivo').value = '';
};

window.closeModalModificacion = function() {
  document.getElementById('modalModificacion').classList.add('hidden');
};

// MODAL ELIMINACIÓN
window.openModalEliminacion = function(reservaId) {
  document.getElementById('modalEliminacion').classList.remove('hidden');
  document.getElementById('elimReservaId').value = reservaId;
  document.getElementById('elimMotivo').value = '';
};

window.closeModalEliminacion = function() {
  document.getElementById('modalEliminacion').classList.add('hidden');
};

// ENVÍO SOLICITUD MODIFICACIÓN
document.addEventListener('DOMContentLoaded', function () {
  const form = document.getElementById('formModificacion');
  if (form) {
    form.onsubmit = async function(ev) {
      ev.preventDefault();
      const reservaId = document.getElementById('modReservaId').value;
      const nombre = document.getElementById('modNombreCliente').value;
      const pax = document.getElementById('modPax').value;
      const precio = document.getElementById('modPrecio').value;
      const motivo = document.getElementById('modMotivo').value;

      await enviarSolicitudReserva({
        tipo: "modificacion",
        reservaId,
        datos_modificados: { NombreCliente: nombre, Pax: pax, Precio: precio },
        motivo,
        estado: "pendiente",
        promotorUid: localStorage.getItem('uid'),
        timestamp: Date.now()
      });

      alert('Solicitud de modificación enviada. El Boss debe aprobarla.');
      closeModalModificacion();
    };
  }
});

// ENVÍO SOLICITUD ELIMINACIÓN
window.enviarSolicitudEliminacion = async function() {
  const reservaId = document.getElementById('elimReservaId').value;
  const motivo = document.getElementById('elimMotivo').value;

  await enviarSolicitudReserva({
    tipo: "eliminacion",
    reservaId,
    datos_modificados: {},
    motivo,
    estado: "pendiente",
    promotorUid: localStorage.getItem('uid'),
    timestamp: Date.now()
  });

  alert('Solicitud de eliminación enviada. El Boss debe aprobarla.');
  closeModalEliminacion();
};

// Función común para guardar en Firestore
async function enviarSolicitudReserva(solicitud) {
  const { db } = await loadFirebase();
  await db.collection('solicitudes_reservas').add(solicitud);
}
