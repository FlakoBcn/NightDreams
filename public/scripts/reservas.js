import { loadFirebase } from '/scripts/app.js';

let db;

export async function init() {
  const { db: firebaseDb } = await loadFirebase();
  db = firebaseDb;

  const correo = localStorage.getItem('correo');
  const uid = localStorage.getItem('uid');
  const isBoss = correo === 'official.nightdreams@gmail.com';

  const btnCSV = document.getElementById('csvBtn');
  const destino = document.getElementById('tablaReservas');
  const destinoLegacy = document.getElementById('tablaReservasLegacy');
  const legacyWrapper = document.getElementById('tablaReservasLegacyWrapper');
  const toggleLegacyBtn = document.getElementById('toggleLegacyBtn');
  const legacyArrow = document.getElementById('legacyArrow');

  // Acciones CSV sólo para Boss
  if (isBoss) {
    btnCSV.style.display = '';
    await mostrarReservasBoss(destino, btnCSV);
  } else {
    btnCSV.style.display = 'none';
    await mostrarReservasPromotor(uid, destino);
    // Legacy oculto por defecto, solo carga si se pulsa el acordeón
  }

  // Acordeón: Legacy solo se carga al abrir
  if (toggleLegacyBtn) {
    let legacyLoaded = false;
    toggleLegacyBtn.addEventListener('click', async () => {
      const isHidden = legacyWrapper.classList.contains('hidden');
      if (isHidden && !legacyLoaded && !isBoss) {
        destinoLegacy.innerHTML = '<p class="text-gray-500 text-center py-6">Cargando reservas legacy…</p>';
        await mostrarReservasLegacyPromotor(uid, destinoLegacy);
        legacyLoaded = true;
      }
      legacyWrapper.classList.toggle('hidden');
      legacyArrow.classList.toggle('rotate-180');
    });
  }

  if (window.lucide) window.lucide.createIcons();
}

// ========== Boss: todas las reservas ==========
async function mostrarReservasPromotor(uid, destino) {
  destino.innerHTML = 'Cargando reservas…';
  try {
    const snap = await db.collection('reservas_por_promotor')
      .doc(uid)
      .collection('reservas')
      .orderBy('creadoEn', 'desc')
      .limit(15)
      .get();

    if (snap.empty) {
      destino.innerHTML = '<p class="text-gray-500 text-center py-6">No tienes reservas aún.</p>';
      return;
    }

    const columnas = [
      "Club", "FechaTexto", "NombreCliente", "Pax", "toPay", "paidByPromotor", "Acciones"
    ];

    let html = `
      <div class="overflow-x-auto">
        <table class="w-full text-[1.08rem] rounded-xl shadow-sm bg-white border border-slate-200">
          <thead class="bg-slate-50">
            <tr>
              ${columnas.map(col => {
                let titulo = col === "FechaTexto" ? "Fecha" :
                             col === "toPay" ? "To Pay (€)" :
                             col === "paidByPromotor" ? "Paid (€)" :
                             col === "NombreCliente" ? "Cliente" :
                             col === "Acciones" ? "" : col;
                return `<th class="px-4 py-3 font-bold text-left tracking-wide">${titulo}</th>`;
              }).join('')}
            </tr>
          </thead>
          <tbody>
    `;

    const now = Date.now();

    snap.forEach(doc => {
      const data = doc.data();
      const creadoEn = data.creadoEn?.toDate?.() ?? null;
      const creadoMs = creadoEn ? creadoEn.getTime() : 0;
      const enTiempo = now - creadoMs < 60000; // 1 minuto en ms

      html += `<tr class="border-t hover:bg-emerald-50 transition">`;
      columnas.forEach(col => {
        let val = data[col] ?? '';

        if (col === "toPay" || col === "paidByPromotor") {
          val = `${parseFloat(val || 0).toFixed(2)} €`;
        }

        if (col === "Acciones") {
          if (enTiempo) {
            val = `<button class="bg-yellow-400 hover:bg-yellow-500 text-white px-3 py-1 rounded text-xs shadow" onclick="anularReserva('${doc.id}')">Anular</button>`;
          } else {
            val = `<button class="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-xs shadow" onclick="openModalEliminacion('${doc.id}')">Eliminar</button>`;
          }
        }

        html += `<td class="px-4 py-3 whitespace-nowrap text-base">${val}</td>`;
      });
      html += '</tr>';
    });

    html += '</tbody></table></div>';
    destino.innerHTML = html;

    if (window.lucide) window.lucide.createIcons();
  } catch (error) {
    console.error('❌ Error al cargar reservas del promotor:', error);
    destino.innerHTML = '<p class="text-red-600 text-center py-6">Error al cargar reservas.</p>';
  }
}


// ========== Promotor: últimas 15 reservas ==========
async function mostrarReservasPromotor(uid, destino) {
  destino.innerHTML = 'Cargando reservas…';
  try {
    const snap = await db.collection('reservas_por_promotor')
      .doc(uid)
      .collection('reservas')
      .orderBy('ReservationID', 'desc')
      .limit(15)
      .get();

    if (snap.empty) {
      destino.innerHTML = '<p class="text-gray-500 text-center py-6">No tienes reservas aún.</p>';
      return;
    }

    const columnas = [
      "Club", "FechaTexto", "NombreCliente", "Pax", "Precio", "Pagado", "Estado", "Acciones"
    ];

    let html = `
      <div class="overflow-x-auto">
        <table class="w-full text-[1.08rem] rounded-xl shadow-sm bg-white border border-slate-200">
          <thead class="bg-slate-50">
            <tr>
              ${columnas.map(col => `<th class="px-4 py-4 font-bold text-left tracking-wide">${col}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
    `;

    snap.forEach(doc => {
      const data = doc.data();
      const estaPendienteEliminacion = data.Estado === "pendiente_eliminacion";
      html += `<tr class="border-t ${estaPendienteEliminacion ? 'bg-red-50 text-gray-500' : 'hover:bg-emerald-50 transition'}">`;
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
        html += `<td class="px-4 py-4 whitespace-nowrap text-base">${val}</td>`;
      });
      html += '</tr>';
    });

    html += '</tbody></table></div>';

    if (snap.size >= 15) {
      html = '<div class="text-xs text-gray-500 mb-2">Mostrando tus 15 reservas más recientes</div>' + html;
    }

    destino.innerHTML = html;
    if (window.lucide) window.lucide.createIcons();
  } catch (error) {
    console.error('❌ Error al cargar reservas:', error);
    destino.innerHTML = '<p class="text-red-600 text-center py-6">Error al cargar reservas.</p>';
  }
}


window.anularReserva = async function(reservaId) {
  const uid = localStorage.getItem('uid');
  if (!confirm('¿Seguro que deseas anular esta reserva? Esta acción no se puede deshacer.')) return;

  try {
    const { db } = await loadFirebase();
    await db.collection('reservas_por_promotor').doc(uid)
      .collection('reservas').doc(reservaId)
      .update({ Estado: "anulada" });

    alert('Reserva anulada correctamente.');
    const destino = document.getElementById('tablaReservas');
    await mostrarReservasPromotor(uid, destino);
  } catch (err) {
    console.error('[Anulación] Error:', err);
    alert('Error al anular la reserva.');
  }
}


// ========== Promotor: tabla legacy, solo al desplegar ==========
async function mostrarReservasPromotor(uid, destino) {
  destino.innerHTML = 'Cargando reservas…';
  try {
    const snap = await db.collection('reservas_por_promotor')
      .doc(uid)
      .collection('reservas')
      .orderBy('creadoEn', 'desc')
      .limit(15)
      .get();

    if (snap.empty) {
      destino.innerHTML = '<p class="text-gray-500 text-center py-6">No tienes reservas aún.</p>';
      return;
    }

    const columnas = [
      "Club", "FechaTexto", "NombreCliente", "Pax", "toPay", "paidByPromotor", "Acciones"
    ];

    let html = `
      <div class="overflow-x-auto">
        <table class="w-full text-[1.08rem] rounded-xl shadow-sm bg-white border border-slate-200">
          <thead class="bg-slate-50">
            <tr>
              ${columnas.map(col => {
                const titulo = col === "FechaTexto" ? "Fecha" :
                               col === "toPay" ? "To Pay (€)" :
                               col === "paidByPromotor" ? "Paid (€)" :
                               col === "NombreCliente" ? "Cliente" : col;
                return `<th class="px-4 py-3 font-bold text-left tracking-wide">${titulo}</th>`;
              }).join('')}
            </tr>
          </thead>
          <tbody>
    `;

    const now = Date.now();

    snap.forEach(doc => {
      const data = doc.data();
      const estado = (data.estado || data.Estado || '').toLowerCase();
      const creadoEn = data.creadoEn?.toDate?.() ?? null;
      const creadoMs = creadoEn ? creadoEn.getTime() : 0;
      const enTiempo = now - creadoMs < 60000; // 1 min

      // Color de fondo por estado
      let rowClass = '';
      if (estado === 'pendiente_eliminacion') {
        rowClass = 'bg-orange-100 text-gray-700';
      } else if (estado === 'eliminada') {
        rowClass = 'bg-red-100 text-gray-600 line-through italic';
      }

      html += `<tr class="border-t ${rowClass}">`;
      columnas.forEach(col => {
        let val = data[col] ?? '';

        if (col === 'toPay' || col === 'paidByPromotor') {
          val = `${parseFloat(val || 0).toFixed(2)} €`;
        }

        if (col === 'Acciones') {
          if (estado === 'eliminada') {
            val = `<span class="text-xs text-red-400 italic">Eliminada</span>`;
          } else if (estado === 'pendiente_eliminacion') {
            val = `<span class="text-xs text-orange-600 italic">En revisión</span>`;
          } else if (enTiempo) {
            val = `<button class="bg-yellow-400 hover:bg-yellow-500 text-white px-3 py-1 rounded text-xs shadow" onclick="anularReserva('${doc.id}')">Anular</button>`;
          } else {
            val = `<button class="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-xs shadow" onclick="openModalEliminacion('${doc.id}')">Eliminar</button>`;
          }
        }

        html += `<td class="px-4 py-3 whitespace-nowrap text-base">${val}</td>`;
      });
      html += '</tr>';
    });

    html += '</tbody></table></div>';
    destino.innerHTML = html;

    if (window.lucide) window.lucide.createIcons();
  } catch (error) {
    console.error('❌ Error al cargar reservas del promotor:', error);
    destino.innerHTML = '<p class="text-red-600 text-center py-6">Error al cargar reservas.</p>';
  }
}


// ========== CSV (solo Boss) ==========
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


// ========== MODAL ELIMINACIÓN ==========
window.openModalEliminacion = function(reservaId) {
  document.getElementById('modalEliminacion').classList.remove('hidden');
  document.getElementById('elimReservaId').value = reservaId;
  document.getElementById('elimMotivo').value = '';
};

window.closeModalEliminacion = function() {
  document.getElementById('modalEliminacion').classList.add('hidden');
};

window.enviarSolicitudEliminacion = async function() {
  const reservaId = document.getElementById('elimReservaId').value;
  const motivo = document.getElementById('elimMotivo').value;
  const uid = localStorage.getItem('uid');

  const solicitud = {
  tipo: "eliminacion",
  idReserva: reservaId,
  motivo,
  estado: "pendiente",
  promotor: localStorage.getItem('nombre'),       // nombre visible
  promotorUid: localStorage.getItem('uid'),       // uid verdadero
  fecha: obtenerFechaDeLaReserva(reservaId),      // opcional: si quieres mostrarla en el push
  timestamp: firebase.firestore.FieldValue.serverTimestamp()
};
  const { db } = await loadFirebase();
  await db.collection('solicitudes_eliminacion').add(solicitud);

  await db.collection('reservas_por_promotor').doc(uid)
    .collection('reservas').doc(reservaId)
    .update({ Estado: "pendiente_eliminacion" });

  alert('Solicitud de eliminación enviada. El Boss debe aprobarla.');
  closeModalEliminacion();

  // Refresca la tabla
  const destino = document.getElementById('tablaReservas');
  await mostrarReservasPromotor(uid, destino);
};