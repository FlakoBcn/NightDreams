let enCola = JSON.parse(localStorage.getItem('mesasEnCola') || '[]');
let confirmadas = JSON.parse(localStorage.getItem('mesasConfirmadas') || '[]');
let rechazadas = JSON.parse(localStorage.getItem('mesasRechazadas') || '[]');

function guardarMesas() {
  localStorage.setItem('mesasEnCola', JSON.stringify(enCola));
  localStorage.setItem('mesasConfirmadas', JSON.stringify(confirmadas));
  localStorage.setItem('mesasRechazadas', JSON.stringify(rechazadas));
}

function renderMesas() {
  const enColaList = document.getElementById('listaEnCola');
  const confList = document.getElementById('listaConfirmadas');
  const rechList = document.getElementById('listaRechazadas');

  enColaList.innerHTML = '';
  confList.innerHTML = '';
  rechList.innerHTML = '';

  enCola.forEach((r, idx) => {
    enColaList.appendChild(makeReservaItem(r, idx + 1, 'enCola'));
  });
  confirmadas.forEach((r, idx) => {
    confList.appendChild(makeReservaItem(r, idx + 1, 'confirmadas'));
  });
  rechazadas.forEach((r, idx) => {
    rechList.appendChild(makeReservaItem(r, idx + 1, 'rechazadas'));
  });
}

function makeReservaItem(reserva, num, estado) {
  const li = document.createElement('li');
  li.className = 'flex flex-wrap items-center gap-3 border border-indigo-200 p-3 rounded-xl bg-white shadow-sm mb-2';

  li.innerHTML = `
    <span class="badge bg-indigo-600 text-white align-middle me-2" style="min-width:2.2em;">#${num}</span>
    <span contenteditable="true" class="fw-bold text-indigo-800 px-1" title="Cliente">${reserva.cliente}</span>
    <span contenteditable="true" class="badge bg-purple-100 text-purple-700 px-2" title="Pax">${reserva.pax}</span>
    <span contenteditable="true" class="badge bg-teal-100 text-teal-700 px-2" title="Precio">💲${reserva.precio}</span>
    <span contenteditable="true" class="badge bg-gray-200 text-gray-700 px-2" title="Promotor"><i data-lucide="user" class="me-1" style="width:1em;height:1em;vertical-align:-0.15em;"></i>${reserva.promotor}</span>
    <span contenteditable="true" class="badge bg-gray-100 text-gray-600 px-2" title="Mesa"><i data-lucide="table" class="me-1" style="width:1em;height:1em;vertical-align:-0.15em;"></i>${reserva.mesa}</span>
  `;

  if (estado === 'enCola') {
    const check = document.createElement('button');
    check.innerHTML = '<i data-lucide="check-circle"></i> IN';
    check.className = 'btn btn-sm btn-success d-flex align-items-center gap-1 px-2 py-1';
    check.onclick = () => moverReserva(reserva, 'confirmadas');

    const cruz = document.createElement('button');
    cruz.innerHTML = '<i data-lucide="x-circle"></i> OUT';
    cruz.className = 'btn btn-sm btn-danger d-flex align-items-center gap-1 px-2 py-1';
    cruz.onclick = () => moverReserva(reserva, 'rechazadas');

    li.appendChild(check);
    li.appendChild(cruz);
  }

  // Renderizar iconos Lucide si están disponibles
  if (window.lucide && window.lucide.createIcons) {
    setTimeout(() => window.lucide.createIcons({ icons: undefined, attrs: { class: 'lucide', width: 18, height: 18 } }), 0);
  }

  return li;
}

function moverReserva(reserva, destino) {
  const idx = enCola.indexOf(reserva);
  if (idx !== -1) enCola.splice(idx, 1);
  if (destino === 'confirmadas') confirmadas.push(reserva);
  if (destino === 'rechazadas') rechazadas.push(reserva);
  guardarMesas();
  renderMesas();
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('addMesaBtn').onclick = () => {
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
    guardarMesas();
    renderMesas();

    ['clienteMesa','paxMesa','precioMesa','promotorMesa','numMesa'].forEach(id => document.getElementById(id).value = '');
  };

  document.getElementById('clearMesasBtn').onclick = () => {
    if (confirm('¿Borrar todas las reservas?')) {
      enCola = [];
      confirmadas = [];
      rechazadas = [];
      guardarMesas();
      renderMesas();
    }
  };

  renderMesas();
});
