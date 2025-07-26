
// --- Modern PWA Mesas Script ---
const STORAGE_KEYS = {
  enCola: 'mesasEnCola',
  confirmadas: 'mesasConfirmadas',
  rechazadas: 'mesasRechazadas',
};

let enCola = loadList(STORAGE_KEYS.enCola);
let confirmadas = loadList(STORAGE_KEYS.confirmadas);
let rechazadas = loadList(STORAGE_KEYS.rechazadas);

function loadList(key) {
  try {
    return JSON.parse(localStorage.getItem(key)) || [];
  } catch {
    return [];
  }
}

function saveAll() {
  localStorage.setItem(STORAGE_KEYS.enCola, JSON.stringify(enCola));
  localStorage.setItem(STORAGE_KEYS.confirmadas, JSON.stringify(confirmadas));
  localStorage.setItem(STORAGE_KEYS.rechazadas, JSON.stringify(rechazadas));
}

function renderMesas() {
  const enColaList = document.getElementById('listaEnCola');
  const confList = document.getElementById('listaConfirmadas');
  const rechList = document.getElementById('listaRechazadas');
  enColaList.innerHTML = '';
  confList.innerHTML = '';
  rechList.innerHTML = '';
  enCola.forEach((r, idx) => enColaList.appendChild(makeReservaItem(r, idx + 1, 'enCola')));
  confirmadas.forEach((r, idx) => confList.appendChild(makeReservaItem(r, idx + 1, 'confirmadas')));
  rechazadas.forEach((r, idx) => rechList.appendChild(makeReservaItem(r, idx + 1, 'rechazadas')));
// Solo una vez al terminar el render
  if (window.lucide && window.lucide.createIcons) {
    setTimeout(() => window.lucide.createIcons({ icons: undefined, attrs: { class: 'lucide', width: 22, height: 22 } }), 0);
  }
}

function makeReservaItem(reserva, num, estado) {
  const li = document.createElement('li');
  li.className = 'mesa-card mb-3 p-0';
  li.innerHTML = `
    <div class="mesa-card-inner flex flex-col sm:flex-row items-center justify-between gap-2 p-3 rounded-2xl shadow-lg border border-indigo-200 bg-gradient-to-br from-white to-indigo-50">
      <div class="flex flex-col items-start gap-1 w-full">
        <div class="flex items-center gap-2 mb-1">
          <span class="mesa-num text-lg font-bold bg-indigo-600 text-white rounded-full px-3 py-1 shadow" style="min-width:2.2em;">#${num}</span>
          <span class="mesa-cliente text-indigo-800 font-semibold text-base" title="Cliente">${escapeHtml(reserva.cliente)}</span>
        </div>
        <div class="flex flex-wrap gap-2 text-sm">
          <span class="mesa-pax badge bg-purple-100 text-purple-700 px-2 py-1 rounded">👥 ${escapeHtml(reserva.pax)}</span>
          <span class="mesa-precio badge bg-teal-100 text-teal-700 px-2 py-1 rounded">💲${escapeHtml(reserva.precio)}</span>
          <span class="mesa-promotor badge bg-gray-200 text-gray-700 px-2 py-1 rounded flex items-center"><i data-lucide="user" class="me-1" style="width:1em;height:1em;vertical-align:-0.15em;"></i>${escapeHtml(reserva.promotor)}</span>
          <span class="mesa-numero badge bg-gray-100 text-gray-600 px-2 py-1 rounded flex items-center"><i data-lucide="table" class="me-1" style="width:1em;height:1em;vertical-align:-0.15em;"></i>${escapeHtml(reserva.mesa)}</span>
        </div>
      </div>
      <div class="flex gap-2 mt-2 sm:mt-0">
        ${estado === 'enCola' ? `
          <button class="mesa-btn-in btn btn-success text-white font-bold px-4 py-2 rounded-xl shadow" aria-label="Confirmar" title="Confirmar" style="min-width:90px;" type="button"><i data-lucide="check-circle"></i> IN</button>
          <button class="mesa-btn-out btn btn-danger text-white font-bold px-4 py-2 rounded-xl shadow" aria-label="Rechazar" title="Rechazar" style="min-width:90px;" type="button"><i data-lucide="x-circle"></i> OUT</button>
        ` : ''}
      </div>
    </div>
  `;
  if (estado === 'enCola') {
    li.querySelector('.mesa-btn-in').onclick = () => moverReserva(reserva, 'confirmadas');
    li.querySelector('.mesa-btn-out').onclick = () => moverReserva(reserva, 'rechazadas');
  }
  
  return li;
}

function moverReserva(reserva, destino) {
  // Find by unique fields (cliente+mesa+promotor)
  const idx = enCola.findIndex(r => r.cliente === reserva.cliente && r.mesa === reserva.mesa && r.promotor === reserva.promotor);
  if (idx !== -1) enCola.splice(idx, 1);
  if (destino === 'confirmadas') confirmadas.push(reserva);
  if (destino === 'rechazadas') rechazadas.push(reserva);
  saveAll();
  renderMesas();
  notify(`Reserva ${destino === 'confirmadas' ? 'confirmada' : 'rechazada'} para ${reserva.cliente}`);
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
}

function notify(msg) {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('Mesas', { body: msg });
  }
}

function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission !== 'granted') {
    Notification.requestPermission();
  }
}

function clearAllMesas() {
  if (confirm('¿Borrar todas las reservas?')) {
    enCola = [];
    confirmadas = [];
    rechazadas = [];
    saveAll();
    renderMesas();
    notify('Todas las reservas han sido borradas');
  }
}

function addMesaFromForm() {
  const cliente = document.getElementById('clienteMesa').value.trim();
  const pax = document.getElementById('paxMesa').value.trim();
  const precio = document.getElementById('precioMesa').value.trim();
  const promotor = document.getElementById('promotorMesa').value.trim();
  const mesa = document.getElementById('numMesa').value.trim();
  if (!cliente || !pax || !precio || !promotor || !mesa) {
    alert('Completa todos los campos');
    return;
  }
  enCola.push({ cliente, pax, precio, promotor, mesa });
  saveAll();
  renderMesas();
  notify(`Reserva añadida para ${cliente}`);
  ['clienteMesa','paxMesa','precioMesa','promotorMesa','numMesa'].forEach(id => document.getElementById(id).value = '');
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('addMesaBtn').onclick = addMesaFromForm;
  document.getElementById('clearMesasBtn').onclick = clearAllMesas;
  renderMesas();
  requestNotificationPermission();
  // Service Worker registration (if not already registered)
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/ServiceWorker.js').catch(()=>{});
  }
});
