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

  if (!form) { console.warn('[Formulario] HTML no encontrado'); return; }

  /* reset UI */
  form.reset();
  resumen.classList.add('hidden');
  success.classList.add('hidden');

  /* bloqueos iniciales */
  disableBlocks([
    'q-club','q-nombre','q-pax','q-ticketType',
    'q-importePagar','q-importePagado','q-email','q-movil','q-review'
  ]);

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

  /* fecha mínima hoy */
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  el.fecha.min = `${yyyy}-${mm}-${dd}`;

  /* listeners **********************************************/
  addListener(el.fecha , 'change' , () => onFecha(el));
  addListener(el.club  , 'change' , () => onClub(el));
  addListener(el.nombre, 'input'  , () => onNombre(el));
  addListener(el.pax   , 'input'  , () => onPax(el));
  addListener(el.btnFull,'click'  , () => onTicket(el, 'full'));
  addListener(el.btnPre ,'click'  , () => onTicket(el, 'pre'));
  addListener(el.impPag , 'input' , () => onImportePagar(el));
  addListener(el.impPro , 'input' , () => onImportePromotor(el));
  addListener(el.email  , 'input' , () => onEmail(el));
  addListener(el.movil  , 'input' , () => onMovil(el));
  addListener(el.btnReview,'click', () => mostrarResumen(el));
  addListener(el.btnBack ,'click' , () => { resumen.classList.add('hidden'); form.classList.remove('hidden'); });
  addListener(el.btnSend ,'click' , () => enviarReserva(el, spinner, success, resumen));

  /* cleanup cuando se abandone la página *******************/
  window.pageCleanup = cleanup;

  // Añadir logs a todos los campos editables y clickables
  function addLogListeners() {
    const form = document.getElementById('reservaForm');
    if (!form) return;
    const logField = (e) => {
      const el = e.target;
      let value = el.value;
      if (el.type === 'checkbox' || el.type === 'radio') value = el.checked;
      console.log(`[Log] Campo '${el.name || el.id}' cambiado:`, value);
    };
    form.querySelectorAll('input,select,button,textarea').forEach(el => {
      if (el.type === 'button' || el.type === 'submit' || el.type === 'reset') {
        el.addEventListener('click', logField);
      } else {
        el.addEventListener('input', logField);
        el.addEventListener('change', logField);
      }
    });
  }

  // Llama a addLogListeners al iniciar
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addLogListeners);
  } else {
    addLogListeners();
  }
}

/* ───────────────────────── lógica paso a paso ───────────────────────── */
function onFecha(el){
  if(!el.fecha.value) return;
  console.log(`[Formulario] Fecha seleccionada: ${el.fecha.value}`);
  enableBlocks(['q-club']);
  cargarClubs(el.fecha.value, el.club);
  disableBlocks(['q-nombre','q-pax','q-ticketType','q-importePagar','q-importePagado','q-email','q-movil','q-review']);
}

function onClub(el){
  if(!el.club.value) return;
  console.log(`[Formulario] Club seleccionado: ${el.club.value}`);
  // Log de todos los valores actuales del formulario
  const values = {
    fecha: el.fecha.value,
    club: el.club.value,
    nombre: el.nombre.value,
    pax: el.pax.value,
    ticketType: el.btnFull.classList.contains('bg-blue-600') ? 'full' : (el.btnPre.classList.contains('bg-blue-600') ? 'pre' : ''),
    importePagar: el.impPag.value,
    importePagado: el.impPro.value,
    email: el.email.value,
    movil: el.movil.value
  };
  console.log('[Formulario] Estado actual del formulario:', values);
  enableBlocks(['q-nombre']);
  disableBlocks(['q-pax','q-ticketType','q-importePagar','q-importePagado','q-email','q-movil','q-review']);
  configurarButtonsPorClub(el);
}

function onNombre(el){
  const ok = el.nombre.value.trim() !== '';
  console.log(`[Formulario] Nombre introducido: ${el.nombre.value}`);
  ok ? enableBlocks(['q-pax']) : disableBlocks(['q-pax']);
  disableBlocks(['q-ticketType','q-importePagar','q-importePagado','q-email','q-movil','q-review']);
}

function onPax(el){
  const ok = parseInt(el.pax.value)||0;
  console.log(`[Formulario] Pax introducido: ${el.pax.value}`);
  if (ok) {
    // Bypass: activa todos los bloques siguientes y omite ticketType
    enableBlocks(['q-importePagar','q-importePagado','q-email','q-movil','q-review']);
    // Opcional: puedes poner valores por defecto si lo deseas
    // el.btnFull.disabled = false;
    // el.btnPre.disabled = false;
  } else {
    disableBlocks(['q-importePagar','q-importePagado','q-email','q-movil','q-review']);
  }
  disableBlocks(['q-ticketType']); // Siempre desactivado
}

function onTicket(el, tipo){
  /* visual */
  console.log(`[Formulario] Tipo de ticket seleccionado: ${tipo}`);
  el.btnFull.classList.toggle('bg-blue-600', tipo==='full');
  el.btnFull.classList.toggle('text-white',  tipo==='full');
  el.btnPre.classList.toggle('bg-blue-600',  tipo==='pre');
  el.btnPre.classList.toggle('text-white',   tipo==='pre');

  if (tipo === 'full') {
    el.impPag.value = 0;
    disableBlocks(['q-importePagar']);
    enableBlocks(['q-importePagado']);
    disableBlocks(['q-email','q-movil','q-review']);
  } else {
    enableBlocks(['q-importePagar']);
    disableBlocks(['q-importePagado','q-email','q-movil','q-review']);
  }
}

function onImportePagar(el){
  const ok = parseFloat(el.impPag.value) >= 0;
  console.log(`[Formulario] Importe a pagar introducido: ${el.impPag.value}`);
  ok ? enableBlocks(['q-importePagado']) : disableBlocks(['q-importePagado']);
  disableBlocks(['q-email','q-movil','q-review']);
}

function onImportePromotor(el){
  const ok = parseFloat(el.impPro.value) >= 0;
  console.log(`[Formulario] Importe pagado al promotor: ${el.impPro.value}`);
  ok ? enableBlocks(['q-email']) : disableBlocks(['q-email']);
  disableBlocks(['q-movil','q-review']);
}

function onEmail(el){
  const ok = el.email.checkValidity();
  console.log(`[Formulario] Email introducido: ${el.email.value}`);
  ok ? enableBlocks(['q-movil']) : disableBlocks(['q-movil']);
  disableBlocks(['q-review']);
}

function onMovil(el){
  const ok = el.movil.value.trim().length > 0;
  console.log(`[Formulario] Móvil introducido: ${el.movil.value}`);
  ok ? enableBlocks(['q-review']) : disableBlocks(['q-review']);
}

/* ───────────────────────── carga de clubs ───────────────────────── */
async function cargarClubs(fecha, select){
  // Use English weekday names to avoid localization issues
  select.innerHTML = '<option>Loading…</option>';
  select.disabled  = true;
  const diaSemanaRaw = new Date(fecha).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
  const diaSemana = diaSemanaRaw; // Already in English, lowercase
  console.log(`[Clubs] Searching clubs in WeekDays for ${fecha} (${diaSemanaRaw})`);

  try {
    if (!db) {
      throw new Error('Base de datos no inicializada');
    }
    // Buscar documento del día en WeekDays
    const doc = await db.collection('WeekDays').doc(diaSemana).get();
    if (!doc.exists) {
      console.warn(`[Clubs] No clubs found for day: ${diaSemana}`);
      select.innerHTML = '<option disabled>No clubs for this day</option>';
      select.disabled = true;
      return;
    }
    const data = doc.data();
    const clubs = data.clubs || {};
    const clubKeys = Object.keys(clubs);
    if (clubKeys.length === 0) {
      console.warn(`[Clubs] Document for ${diaSemana} has no clubs.`);
      select.innerHTML = '<option disabled>No clubs for this day</option>';
      select.disabled = true;
      return;
    }
    select.innerHTML = '<option value="" disabled selected>— Select club —</option>';
    clubKeys.forEach(clubName => {
      const opt = new Option(clubName, clubName);
      // No hay info de full/pre en WeekDays, ambos quedan activos
      opt.dataset.full = 'true';
      opt.dataset.pre  = 'true';
      select.append(opt);
    });
    select.disabled = false;
    console.log(`[Clubs] Clubs cargados: ${clubKeys.join(', ')}`);
  } catch(err){
    console.error('[Clubs] error:', err);
    select.innerHTML = '<option disabled>Error al cargar</option>';
  }
}

/* Función temporal para crear clubs de prueba */
async function crearClubsDePrueba() {
  const clubsEjemplo = [
    {
      nombre: "Pacha Madrid",
      disponibilidad: {
        lunes: false,
        martes: false,
        miércoles: false,
        jueves: true,
        viernes: true,
        sábado: true,
        domingo: false
      },
      fullTicket: true,
      preSale: true,
      capacidad: 1500,
      descripcion: "La discoteca más famosa del mundo",
      activo: true,
      fechaCreacion: window.firebase.firestore.FieldValue.serverTimestamp()
    },
    {
      nombre: "Kapital",
      disponibilidad: {
        lunes: false,
        martes: false,
        miércoles: false,
        jueves: true,
        viernes: true,
        sábado: true,
        domingo: true
      },
      fullTicket: true,
      preSale: false,
      capacidad: 2000,
      descripcion: "7 plantas de diversión",
      activo: true,
      fechaCreacion: window.firebase.firestore.FieldValue.serverTimestamp()
    },
    {
      nombre: "Opium Madrid",
      disponibilidad: {
        lunes: false,
        martes: false,
        miércoles: false,
        jueves: false,
        viernes: true,
        sábado: true,
        domingo: false
      },
      fullTicket: false,
      preSale: true,
      capacidad: 1200,
      descripcion: "Elegancia y exclusividad",
      activo: true,
      fechaCreacion: window.firebase.firestore.FieldValue.serverTimestamp()
    }
  ];

  try {
    const promises = clubsEjemplo.map((club, index) => 
      db.collection('clubs').doc(`club_${index + 1}`).set(club)
    );
    
    await Promise.all(promises);
    console.log(`[Clubs] ✅ Creados ${clubsEjemplo.length} clubs de prueba`);
  } catch (error) {
    console.error('[Clubs] Error creando clubs de prueba:', error);
  }
}


function configurarButtonsPorClub(el){
  // Siempre activos por defecto
  el.btnFull.disabled = false;
  el.btnPre.disabled = false;
  el.btnFull.classList.remove('bg-blue-600','text-white');
  el.btnPre.classList.remove('bg-blue-600','text-white');
  console.log('[Formulario] Botón FULL: enabled =', !el.btnFull.disabled);
  console.log('[Formulario] Botón PRE:  enabled =', !el.btnPre.disabled);
  console.log('[Formulario] Botones por club: ambos activos por default');
}

/* ───────────────────────── resumen + envío ───────────────────────── */
async function mostrarResumen(el){
      // --- VALIDACIÓN DE PRECIO MÍNIMO ---
    // Obtener día de la semana en inglés (ej: monday)
    const fechaObj = new Date(el.fecha.value);
    const diaSemana = fechaObj.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const clubName = el.club.value;
    // Buscar precio mínimo en WeekDays/{dia}/clubs/{club}
    const weekDayDoc = await db.collection('WeekDays').doc(diaSemana).get();
    let precioMinimo = null;
    if (weekDayDoc.exists && weekDayDoc.data().clubs && weekDayDoc.data().clubs[clubName] && weekDayDoc.data().clubs[clubName].precio) {
      precioMinimo = parseFloat(weekDayDoc.data().clubs[clubName].precio);
    }
    if (precioMinimo == null || isNaN(precioMinimo)) {
      spinner.classList.add('hidden');
      alert('No se pudo validar el precio mínimo del club. Contacta con el administrador.');
      return;
    }
    const suma = parseFloat(el.impPag.value) + parseFloat(el.impPro.value);
    const pax = parseInt(el.pax.value) || 1;
    const precioPorPersona = suma / pax;
    if (precioPorPersona < precioMinimo) {
      spinner.classList.add('hidden');
      alert(`El precio por persona (${precioPorPersona.toFixed(2)}€) es inferior al mínimo permitido por el club (${precioMinimo}€). Corrige los importes.`);
      return;
    }

    // --- FIN VALIDACIÓN ---
  const fechaTxt = new Date(el.fecha.value).toLocaleDateString('es-ES',{weekday:'short', day:'numeric', month:'long'});
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
  Object.entries(map).forEach(([id,val])=>{ const e=$("#"+id); if(e) e.textContent = val; });
  console.log('[Formulario] Mostrando resumen de reserva:', map);

  $('#reservaForm').classList.add('hidden');
  $('#resumenReserva').classList.remove('hidden');
}

async function enviarReserva(el, spinner, success, resumen){
  spinner.classList.remove('hidden');
  console.log('[Formulario] Enviando reserva...');

  try {
    const { db: firebaseDb } = await loadFirebase();
    const id   = crypto.randomUUID();
    const data = {
      ReservationID: id,
      Fecha        : el.fecha.value,
      FechaTexto   : new Date(el.fecha.value).toLocaleDateString('es-ES'),
      Club         : el.club.value,
      NombreCliente: el.nombre.value,
      Pax          : parseInt(el.pax.value),
      Promotor     : localStorage.getItem('nombre'),
      PromotorUid  : localStorage.getItem('uid'),
      Precio       : parseFloat(el.impPag.value),
      Pagado       : parseFloat(el.impPro.value),
      Email        : el.email.value,
      Telefono     : el.movil.value.replace(/\D/g,''),
      Estado       : 'Pendiente',
      creadoEn     : window.firebase.firestore.FieldValue.serverTimestamp()
    };
    console.log('[Formulario] Datos a guardar:', data);



    /* grabar en las tres rutas */
    await Promise.all([
      firebaseDb.collection('reservas').doc(id).set(data),
      firebaseDb.collection('reservas_por_dia').doc(data.Fecha).collection('reservas').doc(id).set(data),
      firebaseDb.collection('reservas_por_promotor').doc(data.PromotorUid).collection('reservas').doc(id).set(data)
    ]);

    const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwJSZWWiidAOgs3HxCOiSQPaNyqdygjPUGF5-REGzx3pV-ylYw9Pi4BAGAFDGHEtqZ4GA/exec";

    // Formatea la fecha en los tres formatos que necesitas
    const fechaFormateada = {
      human: fechaObj.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
      iso: el.fecha.value, // YYYY-MM-DD del input
      timestamp: fechaObj.getTime()
    };

    const cleanMovil = el.movil.value.replace(/\D/g, '');

    const reserva = {
      promoterName: localStorage.getItem('nombre'),
      fecha: fechaFormateada.human,
      fechaISO: fechaFormateada.iso,
      fechaTimestamp: fechaFormateada.timestamp,
      club: el.club.value,
      nombreCliente: el.nombre.value,
      paxTotal: +el.pax.value,
      importePagar: +el.impPag.value,
      importePagadoPromotor: +el.impPro.value,
      emailCliente: el.email.value,
      movilCliente: cleanMovil
    };

    await fetch(SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({ accion: 'guardarReserva', reserva }),
      headers: { 'Content-Type': 'application/json' }
    });

    spinner.classList.add('hidden');
    resumen.classList.add('hidden');
    success.classList.remove('hidden');
    console.log('[Formulario] Reserva guardada correctamente.');

    timers.push(setTimeout(()=>{ success.classList.add('hidden'); },1500));
    timers.push(setTimeout(()=>{ init(); },1700));             // reiniciar wizard

  } catch(err){
    console.error('[Reserva] error:', err);
    alert('Error al guardar reserva');
    spinner.classList.add('hidden');
  }
}

/* ───────────────────────── utilidades ───────────────────────── */
function disableBlocks(arr){ arr.forEach(id=>toggleBlock(id,true)); }
function enableBlocks(arr){  arr.forEach(id=>toggleBlock(id,false)); }

function toggleBlock(id, disabled){
  const blk = document.getElementById(id);
  if(!blk) return;
  blk.classList.toggle('disabled-question', disabled);
  blk.querySelectorAll('input,select,button').forEach(el=> el.disabled = disabled);
}

function addListener(el, ev, fn){
  if(!el) return;
  el.addEventListener(ev, fn);
  listeners.push({el, ev, fn});
}

/* ───────────────────────── cleanup ───────────────────────── */
function cleanup(){
  listeners.forEach(({el,ev,fn})=> el.removeEventListener(ev,fn));
  listeners.length = 0;
  timers.forEach(t=> clearTimeout(t));
  timers.length = 0;
  console.log('[Formulario] cleanup');
}
