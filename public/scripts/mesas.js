import { loadFirebase } from '/scripts/app.js';

let db;
let mesas = [];

export async function init() {
  const { db: firebaseDb } = await loadFirebase();
  db = firebaseDb;

  // Datos de usuario
  const correo = localStorage.getItem('correo');
  const uid = localStorage.getItem('uid');
  const isBoss = correo === 'official.nightdreams@gmail.com';

  // Obtener nombre del promotor desde localStorage (con valor por defecto claro)
  const nombrePromotor = localStorage.getItem('nombre');
  const promotorInput = document.getElementById('promotor');

  if (promotorInput) {
    if (nombrePromotor) {
      promotorInput.value = nombrePromotor;
      promotorInput.disabled = true;
    } else {
      promotorInput.value = '';
      promotorInput.placeholder = 'Nombre no encontrado';
      promotorInput.disabled = true;
      console.warn('⚠️ Nombre del promotor no encontrado en localStorage.');
    }
  }

  setupListeners();
  listenMesasFirestore();
}

// Listeners DOM (solo botón Añadir)
function setupListeners() {
  const btnAddMesa = document.getElementById('addMesaBtn');
  if (btnAddMesa) {
    btnAddMesa.onclick = addMesaFromForm;
  } else {
    console.error('🔴 Error: Botón "Añadir" no encontrado.');
  }

  // Validación de formulario
  const inputs = document.querySelectorAll('#clienteMesa, #paxMesa, #precioMesa, #numMesa');
  inputs.forEach(input => input.addEventListener('input', validarFormularioMesas));
  validarFormularioMesas();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/firebase-messaging-sw.js').catch(()=>{});
  }

  if (window.lucide) window.lucide.createIcons();
}

// Escuchar cambios Firestore
function listenMesasFirestore() {
  db.collection('mesas').orderBy('creadoEn', 'asc').onSnapshot(snapshot => {
    mesas = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    renderMesas();
  });
}

// Añadir mesa desde formulario
async function addMesaFromForm() {
  const cliente = document.getElementById('clienteMesa').value.trim();
  const pax = document.getElementById('paxMesa').value.trim();
  const precio = document.getElementById('precioMesa').value.trim();
  const mesa = document.getElementById('numMesa').value.trim();

  const promotor = localStorage.getItem('nombre') || 'Desconocido';
  const promotorUid = localStorage.getItem('uid') || 'uid-desconocido';

  if (!cliente || !pax || !precio || !mesa) {
    alert('🔴 Completa todos los campos obligatorios.');
    return;
  }

  const existeReserva = mesas.some(r =>
    r.cliente === cliente &&
    r.mesa === mesa &&
    r.promotorUid === promotorUid &&
    r.estado === 'pendiente'
  );

  if (existeReserva) {
    alert('⚠️ Ya existe una reserva pendiente igual.');
    return;
  }

  try {
    await db.collection('mesas').add({
      cliente,
      pax,
      precio,
      promotor,
      promotorUid,
      mesa,
      estado: 'pendiente',
      creadoEn: firebase.firestore.FieldValue.serverTimestamp()
    });

    // Limpiar campos tras guardar
    ['clienteMesa', 'paxMesa', 'precioMesa', 'numMesa'].forEach(id => document.getElementById(id).value = '');
    validarFormularioMesas();

  } catch (error) {
    alert('❌ Error al guardar la reserva.');
    console.error(error);
  }
}

// Render mesas
function renderMesas() {
  renderListaMesas(mesas.filter(m => m.estado === 'pendiente'), 'listaEnCola', 'pendiente');
  renderListaMesas(mesas.filter(m => m.estado === 'confirmada'), 'listaConfirmadas', 'confirmada');
  renderListaMesas(mesas.filter(m => m.estado === 'rechazada'), 'listaRechazadas', 'rechazada');

  if (window.lucide) window.lucide.createIcons();
}

function renderListaMesas(mesas, idLista, estado) {
  const ul = document.getElementById(idLista);
  if (!ul) return;
  ul.innerHTML = mesas.map((r, idx) => makeReservaItem(r, idx + 1, estado)).join('');
}

// Generar HTML de reserva
function makeReservaItem(reserva, num, estado) {
  const mensaje = `${reserva.cliente}-${reserva.pax} pax-${reserva.precio}€-${reserva.promotor}-mesa ${reserva.mesa}`;

  const acciones = estado === 'pendiente'
    ? `<button class="mesa-btn-in btn btn-success px-4 py-2 rounded-xl shadow"><i data-lucide="check-circle"></i> IN</button>
       <button class="mesa-btn-out btn btn-danger px-4 py-2 rounded-xl shadow"><i data-lucide="x-circle"></i> OUT</button>`
    : `<button class="mesa-btn-copy btn btn-success px-3 py-2 rounded-xl shadow" data-wa-msg="${mensaje}">
        <span style="display:inline-flex;align-items:center;justify-content:center;background:#25D366;border-radius:4px;padding:2px;width:1.7em;height:1.7em;">
          <i data-lucide='message-circle' style="color:#fff;width:1.2em;height:1.2em;"></i>
        </span>
      </button>`;

  return `
  <li class="mesa-card mb-3 p-0" data-id="${reserva.id}">
    <div class="mesa-card-inner flex justify-between gap-2 p-3 rounded-2xl shadow bg-gradient-to-br from-white to-indigo-50">
      <div>
        <span class="mesa-num bg-indigo-600 text-white rounded-full px-3 py-1 shadow">#${num}</span>
        <span class="mesa-cliente">${escapeHtml(reserva.cliente)}</span>
        <span class="mesa-pax">👥 ${escapeHtml(reserva.pax)}</span>
        <span class="mesa-precio">💲 ${escapeHtml(reserva.precio)}</span>
        <span class="mesa-promotor">👤 ${escapeHtml(reserva.promotor)}</span>
        <span class="mesa-numero">🍽️ ${escapeHtml(reserva.mesa)}</span>
      </div>
      <div>${acciones}</div>
    </div>
  </li>`;
}

// Cambiar estado de la mesa
document.addEventListener('click', async (e) => {
  const item = e.target.closest('button');
  if (!item) return;

  const li = item.closest('li.mesa-card');
  if (!li) return;

  const reservaId = li.getAttribute('data-id');
  const mesaActual = mesas.find(m => m.id === reservaId);
  if (!mesaActual) return;

  if (item.classList.contains('mesa-btn-in')) {
    await db.collection('mesas').doc(mesaActual.id).update({ estado: 'confirmada' });
  } else if (item.classList.contains('mesa-btn-out')) {
    await db.collection('mesas').doc(mesaActual.id).update({ estado: 'rechazada' });
  } else if (item.classList.contains('mesa-btn-copy')) {
    copiarMensajeGrupo(item.dataset.waMsg);
  }
});

// Copiar mensaje WhatsApp
function copiarMensajeGrupo(msg) {
  navigator.clipboard.writeText(msg)
    .then(() => {
      alert('📋 Mensaje copiado. Se abrirá WhatsApp Web.');
      window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
    })
    .catch(console.error);
}

// Validación formulario
function validarFormularioMesas() {
  const campos = ['clienteMesa', 'paxMesa', 'precioMesa', 'numMesa'];
  document.getElementById('addMesaBtn').disabled = !campos.every(id => document.getElementById(id).value.trim());
}

// Escape seguro HTML
function escapeHtml(str) {
  return String(str).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
}

// Inicializar al cargar el script
firebase.auth().onAuthStateChanged(async user => {
  if (user) {
    // Almacenar UID y correo en localStorage
    localStorage.setItem('uid', user.uid);
    localStorage.setItem('correo', user.email);

    // Inicializar lógica de mesas
    await init();
  } else {
    console.warn('🔴 Usuario no autenticado.');
  }
});
