// mesas.js – Firestore version NightDreams
import { loadFirebase } from '/scripts/app.js';

let db;
let mesas = []; // Todas las mesas en la app (actualizadas en tiempo real)

console.log('[Mesas] Script iniciado NightDreams Firestore');

/* 1️⃣ – Iniciar Firebase y listeners */
document.addEventListener('DOMContentLoaded', async () => {
  const { db: firebaseDb } = await loadFirebase();
  db = firebaseDb;

  listenMesasFirestore(); // Render en tiempo real

  // Eventos del formulario y botones (con verificación robusta)
  const btnAddMesa = document.getElementById('addMesaBtn');
  const btnClearMesas = document.getElementById('clearMesasBtn');

  if (btnAddMesa && btnClearMesas) {
    btnAddMesa.onclick = addMesaFromForm;
    btnClearMesas.onclick = clearAllMesas;
  } else {
    console.error('🔴 Error: Botones Añadir o Limpiar no encontrados.');
  }

  // Validación en tiempo real para el botón “Añadir”
  const inputs = document.querySelectorAll('#clienteMesa, #paxMesa, #precioMesa, #promotorMesa, #numMesa');
  if (inputs.length === 5) {
    inputs.forEach(input => input.addEventListener('input', validarFormularioMesas));
  } else {
    console.error('🔴 Error: Campos del formulario no encontrados.');
  }

  validarFormularioMesas();

  // Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/firebase-messaging-sw.js').catch(()=>{});
  }

  // Iconos Lucide
  if (window.lucide) window.lucide.createIcons();
});

/* 2️⃣ – Escuchar y renderizar en tiempo real */
function listenMesasFirestore() {
  db.collection('mesas').orderBy('timestamp', 'asc')
    .onSnapshot(snapshot => {
      mesas = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      renderMesas();
    });
}

/* 3️⃣ – Añadir una nueva mesa */
// Lógica para el botón "Añadir"
async function addMesaFromForm() {
  const cliente = document.getElementById('clienteMesa').value.trim();
  const pax = document.getElementById('paxMesa').value.trim();
  const precio = document.getElementById('precioMesa').value.trim();
  const promotor = document.getElementById('promotorMesa').value.trim();
  const mesa = document.getElementById('numMesa').value.trim();

  // Validar campos
  if (!cliente || !pax || !precio || !promotor || !mesa) {
    alert('Por favor, completa todos los campos.');
    return;
  }

  const yaExiste = mesas.some(r =>
    r.cliente === cliente &&
    r.mesa === mesa &&
    r.promotor === promotor &&
    r.estado === 'pendiente'
  );

  if (yaExiste) {
    alert('Ya existe una reserva PENDIENTE para este cliente/mesa/promotor');
    return;
  }


  try {
    await db.collection('mesas').add({
      cliente, pax, precio, promotor, mesa,
      estado: 'pendiente',
      timestamp: Date.now()
    });

    ['clienteMesa','paxMesa','precioMesa','promotorMesa','numMesa']
      .forEach(id => document.getElementById(id).value = '');

    validarFormularioMesas();

  } catch (e) {
    alert('Error al guardar la reserva en la nube');
    console.error(e);
  }
}


/* 4️⃣ – Renderizar las mesas (pendiente, confirmadas, rechazadas) */
function renderMesas() {
  const pendientes = mesas.filter(m => m.estado === 'pendiente');
  const confirmadas = mesas.filter(m => m.estado === 'confirmada');
  const rechazadas = mesas.filter(m => m.estado === 'rechazada');

  renderListaMesas(pendientes,   'listaEnCola',       'pendiente');
  renderListaMesas(confirmadas,  'listaConfirmadas',  'confirmada');
  renderListaMesas(rechazadas,   'listaRechazadas',   'rechazada');

  if (window.lucide && window.lucide.createIcons) {
    setTimeout(() => window.lucide.createIcons({ attrs: { class: 'lucide', width: 22, height: 22 } }), 0);
  }
}

function renderListaMesas(mesas, idLista, estado) {
  const ul = document.getElementById(idLista);
  if (!ul) return;
  ul.innerHTML = '';
  mesas.forEach((r, idx) => ul.appendChild(makeReservaItem(r, idx + 1, estado)));
}

/* 5️⃣ – Crear el item de mesa con acciones */
function makeReservaItem(reserva, num, estado) {
  const li = document.createElement('li');
  li.className = 'mesa-card mb-3 p-0';

  const mensaje = `✅ *Reserva ${estado.toUpperCase()} NightDreams*\n` +
    `*Cliente:* ${reserva.cliente}\n*Mesa:* ${reserva.mesa}\n*PAX:* ${reserva.pax}\n*Precio:* ${reserva.precio}€\n*Promotor:* ${reserva.promotor}`;

  const btnCopiaGrupo = (estado !== 'pendiente') ? `
    <button class="mesa-btn-copy btn btn-secondary px-3 py-2 rounded-xl shadow"
      data-wa-msg="${mensaje}">
      <i data-lucide="clipboard"></i>
    </button>` : '';

  const acciones = estado === 'pendiente' ? `
    <button class="mesa-btn-in btn btn-success px-4 py-2 rounded-xl shadow"><i data-lucide="check-circle"></i> IN</button>
    <button class="mesa-btn-out btn btn-danger px-4 py-2 rounded-xl shadow"><i data-lucide="x-circle"></i> OUT</button>`
  : btnCopiaGrupo;

  li.innerHTML = `
    <div class="mesa-card-inner flex justify-between gap-2 p-3 rounded-2xl shadow bg-gradient-to-br from-white to-indigo-50">
      <div>
        <span class="mesa-num bg-indigo-600 text-white rounded-full px-3 py-1 shadow">#${num}</span>
        <span class="mesa-cliente">${escapeHtml(reserva.cliente)}</span>
        <span class="mesa-pax">👥${escapeHtml(reserva.pax)}</span>
        <span class="mesa-precio">💲${escapeHtml(reserva.precio)}</span>
        <span class="mesa-promotor">👤${escapeHtml(reserva.promotor)}</span>
        <span class="mesa-numero">🍽️${escapeHtml(reserva.mesa)}</span>
      </div>
      <div>${acciones}</div>
    </div>`;

  if (estado === 'pendiente') {
    li.querySelector('.mesa-btn-in').onclick  = () => cambiarEstadoMesa(reserva.id, 'confirmada');
    li.querySelector('.mesa-btn-out').onclick = () => cambiarEstadoMesa(reserva.id, 'rechazada');
  } else {
    li.querySelector('.mesa-btn-copy').onclick = () => copiarMensajeGrupo(mensaje);
  }
  return li;
}

/* 6️⃣ – Cambiar estado de la mesa */
async function cambiarEstadoMesa(mesaId, nuevoEstado) {
  await db.collection('mesas').doc(mesaId).update({ estado: nuevoEstado });
}

/* 7️⃣ – Copiar mensaje para grupo WhatsApp */
function copiarMensajeGrupo(msg) {
  navigator.clipboard.writeText(msg).then(() => alert('¡Mensaje copiado!')).catch(console.error);
}

/* 8️⃣ – Limpiar todas las mesas (admin) */
async function clearAllMesas() {
  if (!confirm('¿Borrar todas las reservas?')) return;
  const snapshot = await db.collection('mesas').get();
  const batch = db.batch();
  snapshot.forEach(doc => batch.delete(doc.ref));
  await batch.commit();
  alert('Todas las reservas borradas.');
}

/* 9️⃣ – Validación del formulario */
function validarFormularioMesas() {
  const campos = ['clienteMesa','paxMesa','precioMesa','promotorMesa','numMesa'];
  document.getElementById('addMesaBtn').disabled = !campos.every(id => document.getElementById(id).value.trim());
}

/* 🔧 – Utilidades */
function escapeHtml(str) {
  return String(str).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
}

  // Refresh iconos Lucide
  if (window.lucide) {
    window.lucide.createIcons();
  }
