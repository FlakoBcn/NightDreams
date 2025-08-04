/* pages/formulario.js – wizard de Nueva Reserva */
import { loadFirebase } from '/scripts/app.js';

/* helpers internos */
const $ = sel => document.querySelector(sel);
const $$ = sel => document.querySelectorAll(sel);

/* Firebase con fallback seguro */
let db;

/* Timers para cleanup */
let timers = [];

/* Guardaremos refs a listeners para poder removerlos */
const listeners = [];




/* ────────────────────────────────────────────────────────── */
export async function init() {
  console.log('[Formulario] init');
  console.log('[Formulario] Cargando formulario de reserva...');

  // Asegurar que Firebase está disponible
  const { db: firebaseDb } = await loadFirebase();
  db = firebaseDb;

  if (!db) {
    console.error('[Formulario] No se pudo obtener db de Firebase');
    return;
  }
    // Refresh iconos Lucide
  if (window.lucide) {
    window.lucide.createIcons();
  }


  /* DOM refs */
  const form     = $('#reservaForm');
  const resumen  = $('#resumenReserva');
  const spinner  = $('#loadingSpinner');
  const success  = $('#successMessage');

  spinner.classList.add('hidden');

  if (!form) { console.warn('[Formulario] HTML no encontrado'); return; }


  // Resetear el formulario y mostrar todos los campos y botones
  form.reset();
  // Quitar 'hidden' de todos los elementos hijos del formulario principal
  form.querySelectorAll('.hidden').forEach(el => el.classList.remove('hidden'));

  // Ocultar solo el resumen y overlays
  resumen.classList.add('hidden');
  success.classList.add('hidden');

 

  /* refs de campos */
  const el = {
    fecha : $('#fechaReserva'),
    club  : $('#clubSelect'),
    nombre: $('#nombreCliente'),
    pax   : $('#paxTotal'),
    btnFull: $('#btnFullTicket'),
    btnPre : $('#btnPreSale'),
    impPag : $('#importePagar'),
    impPro : $('#importePagadoPromotor'),
    email : $('#emailCliente'),
    movil : $('#movilCliente'),
    btnReview: $('#btnReview'),
    btnBack  : $('#btnBack'),
    btnSend  : $('#btnSend')
  };


  // ...ya se ejecuta arriba, no repetir

   // Fecha mínima = hoy
  const today = new Date();
  el.fecha.min = today.toISOString().split('T')[0];

  // Estado inicial: full ticket
  onTicket(el, 'full');

  // Listeners
  addListener(el.fecha , 'change' , () => onFecha(el));
  addListener(el.club  , 'change' , () => onClub(el));
  addListener(el.pax   , 'input'  , () => onPax(el));
  addListener(el.btnFull,'click'  , () => onTicket(el, 'full'));
  addListener(el.btnPre ,'click'  , () => onTicket(el, 'pre'));
  addListener(el.btnReview,'click', () => mostrarResumen(el));
  addListener(el.btnBack ,'click' , () => {
    resumen.classList.add('hidden');
    form.classList.remove('hidden');
  });
  addListener(el.btnSend ,'click' , () => enviarReserva(el, spinner, success, resumen));

  window.pageCleanup = cleanup;
  addLogListeners(form);
}

/* ───────────────────────── FUNCIONES ───────────────────────── */

function onFecha(el) {
  if (!el.fecha.value) return;
  cargarClubs(el.fecha.value, el.club);
}

function onClub(el) {
  if (!el.club.value) return;
  configurarButtonsPorClub(el);
}

function onPax(el) {
  console.log(`[PAX] ${el.pax.value}`);
}

function onTicket(el, tipo) {
  // Solo usar clases Tailwind, nunca btn-selected
  el.btnFull.classList.remove('btn-selected');
  el.btnPre.classList.remove('btn-selected');
  if (tipo === 'full') {
    el.btnFull.classList.add('bg-blue-600', 'text-white');
    el.btnPre.classList.remove('bg-blue-600', 'text-white');
    el.btnFull.classList.add('btn-selected');
    el.impPag.value = 0;
    el.impPag.disabled = true;
  } else {
    el.btnPre.classList.add('bg-blue-600', 'text-white');
    el.btnFull.classList.remove('bg-blue-600', 'text-white');
    el.btnPre.classList.add('btn-selected');
    el.impPag.disabled = false;
    el.impPag.focus();
  }
}

function validarCampos(el) {
  const errores = [];
  if (!el.club.value) errores.push('Selecciona un club.');
  if (!el.nombre.value.trim()) errores.push('Ingresa el nombre del cliente.');
  if (!el.email.value.includes('@')) errores.push('Email inválido.');
  return errores;
}

function cargarClubs(fecha, select) {
  select.innerHTML = '<option disabled selected>Cargando clubes…</option>';
  select.disabled = true;

  const dia = new Date(fecha).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
  db.collection('WeekDays').doc(dia).get().then(doc => {
    const data = doc.data()?.clubs || {};
    const keys = Object.keys(data);

    if (!keys.length) {
      select.innerHTML = '<option disabled>No clubs disponibles</option>';
    }

    select.innerHTML = '<option disabled selected>— Selecciona un club —</option>';
    keys.forEach(name => {
      const opt = new Option(name, name);
      opt.dataset.full = 'true';
      opt.dataset.pre = 'true';
      select.append(opt);
    });

    select.disabled = false;
  }).catch(err => {
    console.error('[Clubs] error:', err);
    select.innerHTML = '<option disabled>Error al cargar</option>';
    select.disabled = false;
  });
}

function configurarButtonsPorClub(el) {
  const opt = el.club.selectedOptions[0];
  if (!opt) return;
  el.btnFull.disabled = opt.dataset.full !== 'true';
  el.btnPre.disabled = opt.dataset.pre !== 'true';
}

async function mostrarResumen(el) {
  const errores = validarCampos(el);
  if (errores.length) {
    alert('Corrige los siguientes errores:\n' + errores.join('\n'));
    return;
  }

  const fechaObj = new Date(el.fecha.value);
  const dia = fechaObj.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
  const clubName = el.club.value;
  const clubData = await db.collection('WeekDays').doc(dia).get();
  const precioMin = clubData?.data()?.clubs?.[clubName]?.precio ?? null;

  if (!precioMin || isNaN(precioMin)) {
    alert('No se pudo validar el precio mínimo. Contacta al administrador.');
    return;
  }

  const pax = parseInt(el.pax.value) || 1;
  const suma = parseFloat(el.impPag.value) + parseFloat(el.impPro.value);
  const precioPP = suma / pax;

  if (precioPP < precioMin) {
    alert(`Precio por persona (${precioPP.toFixed(2)}€) menor al mínimo (${precioMin}€).`);
    return;
  }

  const fechaTxt = fechaObj.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'long' });
  const map = {
    resFecha   : fechaTxt,
    resPromotor: localStorage.getItem('nombre'),
    resClub    : el.club.value,
    resNombre  : el.nombre.value,
    resPax     : el.pax.value,
    resImporte : `${el.impPag.value} €`,
    resPagado  : `${el.impPro.value} €`,
    resEmail   : el.email.value,
    resMovil   : el.movil.value
  };

  Object.entries(map).forEach(([id, val]) => {
    const e = document.getElementById(id);
    if (e) e.textContent = val;
  });

  $('#reservaForm').classList.add('hidden');
  $('#resumenReserva').classList.remove('hidden');
}

async function enviarReserva(el, spinner, success, resumen) {
  spinner.classList.remove('hidden');
  let procesandoMsg;
  try {
    const fechaObj = new Date(el.fecha.value);
    const id = crypto.randomUUID();
    const tel = el.movil.value.replace(/\D/g, '');

    const data = {
      ReservationID: id,
      Fecha        : el.fecha.value,
      FechaTexto   : fechaObj.toLocaleDateString('es-ES'),
      Club         : el.club.value,
      NombreCliente: el.nombre.value,
      Pax          : parseInt(el.pax.value),
      Promotor     : localStorage.getItem('nombre'),
      PromotorUid  : localStorage.getItem('uid'),
      toPay       : parseFloat(el.impPag.value),
      Pagado       : parseFloat(el.impPro.value),
      Email        : el.email.value,
      Telefono     : tel,
      Estado       : 'Pendiente',
      creadoEn     : firebase.firestore.FieldValue.serverTimestamp()
    };

    // 1. Guardar en Firestore (spinner visible)
    await Promise.all([
      db.collection('reservas').doc(id).set(data),
      db.collection('reservas_por_dia').doc(data.Fecha).collection('reservas').doc(id).set(data),
      db.collection('reservas_por_promotor').doc(data.PromotorUid).collection('reservas').doc(id).set(data)
    ]);

    // 2. Ocultar spinner, mostrar éxito y mensaje de "procesando en segundo plano"
    spinner.classList.add('hidden');
    resumen.classList.add('hidden');
    success.classList.remove('hidden');
    success.scrollIntoView({ behavior: 'smooth' });

    // Crear mensaje visual de "procesando en segundo plano"
    procesandoMsg = document.createElement('div');
    procesandoMsg.id = 'procesandoGAS';
    procesandoMsg.style = 'margin-top:12px; color:#888; font-size:1rem; text-align:center;';
    procesandoMsg.textContent = 'Procesando en segundo plano...';
    success.parentNode.insertBefore(procesandoMsg, success.nextSibling);

    // 3. Lanzar fetch a GAS en segundo plano (no await)
    fetch('https://script.google.com/macros/s/AKfycbwJSZWWiidAOgs3HxCOiSQPaNyqdygjPUGF5-REGzx3pV-ylYw9Pi4BAGAFDGHEtqZ4GA/exec', {
      method: 'POST',
      body: JSON.stringify({ accion: 'guardarReserva', reserva: {
        promoterName: data.Promotor,
        fecha: fechaObj.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
        fechaISO: data.Fecha,
        fechaTimestamp: fechaObj.getTime(),
        club: data.Club,
        nombreCliente: data.NombreCliente,
        paxTotal: data.Pax,
        importePagar: data.toPay,
        importePagadoPromotor: data.Pagado,
        emailCliente: data.Email,
        movilCliente: data.Telefono,
        ReservationID: data.ReservationID    // ← IMPORTANTE!
      }})
    }).catch(e => {
      // Opcional: mostrar error en background
      if (procesandoMsg) procesandoMsg.textContent = 'Error al procesar en segundo plano (GAS)';
    });

    console.log('[Formulario] Reserva guardada correctamente.');
    timers.push(setTimeout(() => {
      success.classList.add('hidden');
      if (procesandoMsg) procesandoMsg.remove();
    }, 2000));
    timers.push(setTimeout(() => init(), 2200));
  } catch (err) {
    console.error('[Reserva] error:', err);
    alert('Error al guardar la reserva');
    if (procesandoMsg) procesandoMsg.remove();
  } finally {
    spinner.classList.add('hidden');
  }
}

/* ───────────────────────── UTILIDADES ───────────────────────── */
function addListener(el, ev, fn) {
  if (!el) return;
  el.addEventListener(ev, fn);
  listeners.push({ el, ev, fn });
}

function addLogListeners(form) {
  form.querySelectorAll('input,select,button,textarea').forEach(el => {
    const log = e => console.log(`[Log] ${el.id || el.name}:`, e.target.value);
    el.addEventListener('input', log);
    el.addEventListener('change', log);
    if (el.type === 'button') el.addEventListener('click', log);
  });
}

function cleanup() {
  listeners.forEach(({ el, ev, fn }) => el.removeEventListener(ev, fn));
  timers.forEach(clearTimeout);
  listeners.length = 0;
  timers.length = 0;
  console.log('[Formulario] cleanup');
}
