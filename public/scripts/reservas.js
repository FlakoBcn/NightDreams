
/* pages/reservas.js – Lógica específica de la página Reservas */


export function init() {
  console.log('📋 [Reservas] Inicializando página reservas');
  initReservasElements();
  loadReservasData();
}

function initReservasElements() {
  // Verificar elementos específicos de reservas
  const tablaDiv = document.getElementById('tablaReservasPromotor');
  if (tablaDiv) {
    console.log('📋 [Reservas] Tabla de reservas encontrada');
    tablaDiv.innerHTML = '<p class="text-gray-500">Iniciando carga de reservas...</p>';
  }
  
  // Refresh iconos Lucide
  if (window.lucide) {
    window.lucide.createIcons();
  }
}


async function loadReservasData() {
  console.log('📋 [Reservas] Cargando datos de reservas...');
  const isAdmin = localStorage.getItem('esAdmin') === 'true';
  if (isAdmin) {
    renderAdminTabs();
    loadAdminReservas('reservas');
  } else {
    await cargarReservasPromotor();
  }
}

function renderAdminTabs() {
  const tablaDiv = document.getElementById('tablaReservasPromotor');
  if (!tablaDiv) return;
  tablaDiv.innerHTML = `
    <div class="mb-3">
      <button id="tab-reservas" class="btn btn-primary btn-sm me-2">Reservas (principal)</button>
      <button id="tab-por-promotor" class="btn btn-outline-secondary btn-sm me-2">Por Promotor</button>
      <button id="tab-por-dia" class="btn btn-outline-secondary btn-sm">Por Día</button>
    </div>
    <div id="adminReservasTable"></div>
  `;
  document.getElementById('tab-reservas').onclick = () => loadAdminReservas('reservas');
  document.getElementById('tab-por-promotor').onclick = () => loadAdminReservas('porPromotor');
  document.getElementById('tab-por-dia').onclick = () => loadAdminReservas('porDia');
}

async function loadAdminReservas(tipo) {
  const tableDiv = document.getElementById('adminReservasTable');
  if (!tableDiv) return;
  tableDiv.innerHTML = '<p class="text-gray-500">Cargando reservas…</p>';
  let rows = [];
  try {
    if (tipo === 'reservas') {
      // Todas las reservas de la colección principal
      const snap = await firebase.firestore().collection('reservas').orderBy('creadoEn', 'desc').limit(200).get();
      rows = snap.docs.map(doc => doc.data());
    } else if (tipo === 'porPromotor') {
      // Todas las reservas agrupadas por promotor
      const promotoresSnap = await firebase.firestore().collection('reservas_por_promotor').get();
      for (const promotorDoc of promotoresSnap.docs) {
        const reservasSnap = await firebase.firestore().collection('reservas_por_promotor').doc(promotorDoc.id).collection('reservas').get();
        rows.push(...reservasSnap.docs.map(doc => doc.data()));
      }
    } else if (tipo === 'porDia') {
      // Todas las reservas agrupadas por día
      const diasSnap = await firebase.firestore().collection('reservas_por_dia').get();
      for (const diaDoc of diasSnap.docs) {
        const reservasSnap = await firebase.firestore().collection('reservas_por_dia').doc(diaDoc.id).collection('reservas').get();
        rows.push(...reservasSnap.docs.map(doc => doc.data()));
      }
    }
    if (!rows.length) {
      tableDiv.innerHTML = '<p class="text-gray-400">No hay reservas.</p>';
      return;
    }
    let html = '<div class="overflow-x-auto"><table class="table-auto min-w-full text-xs md:text-sm"><thead><tr>';
    html += ['Fecha', 'Cliente', 'Club', 'PAX', 'Precio', 'Pagado (€)', 'Email', 'Teléfono', 'Promotor', 'Estado'].map(h => `<th class="px-3 py-2 bg-gray-200">${h}</th>`).join('');
    html += '</tr></thead><tbody>';
    rows.forEach(r => {
      const estadoColor = r.Estado === 'Confirmada' ? 'text-green-600' : r.Estado === 'Rechazada' ? 'text-red-600' : 'text-orange-600';
      html += `<tr>
        <td class="border px-2 py-1">${r.FechaTexto || r.Fecha || ''}</td>
        <td class="border px-2 py-1">${r.NombreCliente || ''}</td>
        <td class="border px-2 py-1">${r.Club || ''}</td>
        <td class="border px-2 py-1">${r.Pax || ''}</td>
        <td class="border px-2 py-1">${r.Precio || ''}€</td>
        <td class="border px-2 py-1">${r.Pagado || ''}€</td>
        <td class="border px-2 py-1">${r.Email || ''}</td>
        <td class="border px-2 py-1">${r.Telefono || ''}</td>
        <td class="border px-2 py-1">${r.Promotor || ''}</td>
        <td class="border px-2 py-1 ${estadoColor}">${r.Estado || ''}</td>
      </tr>`;
    });
    html += '</tbody></table></div>';
    tableDiv.innerHTML = html;
  } catch (e) {
    console.error('❌ Error cargando reservas admin:', e);
    tableDiv.innerHTML = `<p class="text-red-600">Error cargando reservas: ${e.message}</p>`;
  }
}


async function cargarReservasPromotor() {
  const tablaDiv = document.getElementById('tablaReservasPromotor');
  if (!tablaDiv) return;
  tablaDiv.innerHTML = '<p class="text-gray-500">Cargando reservas…</p>';
  const uid = localStorage.getItem("uid");
  if (!uid) {
    tablaDiv.innerHTML = '<p class="text-red-600">No se encontró el usuario</p>';
    return;
  }
  try {
    // Buscar reservas solo por UID en reservas_por_promotor
    console.log(`[Reservas] Buscando reservas en reservas_por_promotor/${uid}/reservas`);
    const snap = await firebase.firestore()
      .collection('reservas_por_promotor')
      .doc(uid)
      .collection('reservas')
      .orderBy('creadoEn', 'desc')
      .get();
    console.log(`[Reservas] Resultados en reservas_por_promotor: ${snap.size}`);
    if (snap.empty) {
      tablaDiv.innerHTML = '<p class="text-gray-400">No tienes reservas aún.</p>';
      return;
    }
    let html = '<div class="overflow-x-auto"><table class="table-auto min-w-full text-xs md:text-sm"><thead><tr>';
    html += ['Fecha', 'Cliente', 'Club', 'PAX', 'Precio', 'Pagado (€)', 'Email', 'Teléfono', 'Estado'].map(h => `<th class="px-3 py-2 bg-gray-200">${h}</th>`).join('');
    html += '</tr></thead><tbody>';
    snap.forEach(doc => {
      const r = doc.data();
      const estadoColor = r.Estado === 'Confirmada' ? 'text-green-600' : r.Estado === 'Rechazada' ? 'text-red-600' : 'text-orange-600';
      html += `<tr>
        <td class="border px-2 py-1">${r.FechaTexto || r.Fecha}</td>
        <td class="border px-2 py-1">${r.NombreCliente}</td>
        <td class="border px-2 py-1">${r.Club}</td>
        <td class="border px-2 py-1">${r.Pax}</td>
        <td class="border px-2 py-1">${r.Precio}€</td>
        <td class="border px-2 py-1">${r.Pagado}€</td>
        <td class="border px-2 py-1">${r.Email}</td>
        <td class="border px-2 py-1">${r.Telefono}</td>
        <td class="border px-2 py-1 ${estadoColor}">${r.Estado}</td>
      </tr>`;
    });
    html += '</tbody></table></div>';
    tablaDiv.innerHTML = html;
    console.log(`✅ Cargadas ${snap.size} reservas del promotor (UID: ${uid})`);
  } catch (e) {
    console.error('❌ Error cargando reservas:', e);
    tablaDiv.innerHTML = `<p class="text-red-600">Error cargando reservas: ${e.message}</p>`;
  }
}

export function cleanup() {
  console.log('📋 [Reservas] Limpiando página reservas');
  
  // Limpiar event listeners específicos si es necesario
  // Cancelar requests pendientes si es necesario
}
