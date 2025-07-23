
/* pages/reservas.js – Lógica específica de la página Reservas */

export function init() {
  console.log('� [Reservas] Inicializando página reservas');
  
  // Inicializar elementos específicos de reservas
  initReservasElements();
  
  // Cargar datos de reservas
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
  await cargarReservasPromotor();
}

async function cargarReservasPromotor() {
  const tablaDiv = document.getElementById('tablaReservasPromotor');
  if (!tablaDiv) return;

  tablaDiv.innerHTML = '<p class="text-gray-500">Cargando reservas…</p>';

  const nombrePromotor = localStorage.getItem("nombre");
  
  if (!nombrePromotor) {
    tablaDiv.innerHTML = '<p class="text-red-600">No se encontró el nombre del promotor</p>';
    return;
  }

  try {
    const snap = await firebase.firestore().collection('reservas_por_promotor').doc(nombrePromotor).collection('reservas').orderBy('creadoEn', 'desc').get();

    if (snap.empty) {
      tablaDiv.innerHTML = '<p class="text-gray-400">No tienes reservas aún.</p>';
      return;
    }

    let html = '<div class="overflow-x-auto"><table class="table-auto min-w-full text-xs md:text-sm"><thead><tr>';
    html += ['Fecha', 'Cliente', 'Club', 'PAX', 'Precio', 'Pagado (€)', 'Email', 'Teléfono', 'Estado'].map(h => `<th class="px-3 py-2 bg-gray-200">${h}</th>`).join('');
    html += '</tr></thead><tbody>';

    snap.forEach(doc => {
      const r = doc.data();
      const estadoColor = r.Estado === 'Confirmada' ? 'text-green-600' : 
                         r.Estado === 'Rechazada' ? 'text-red-600' : 
                         'text-orange-600';
      
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
    
    console.log(`✅ Cargadas ${snap.size} reservas del promotor ${nombrePromotor}`);

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
