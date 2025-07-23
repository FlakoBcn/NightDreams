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
}

/* ───────────────────────── lógica paso a paso ───────────────────────── */
function onFecha(el){
  if(!el.fecha.value) return;
  enableBlocks(['q-club']);
  cargarClubs(el.fecha.value, el.club);
  disableBlocks(['q-nombre','q-pax','q-ticketType','q-importePagar','q-importePagado','q-email','q-movil','q-review']);
}

function onClub(el){
  if(!el.club.value) return;
  enableBlocks(['q-nombre']);
  disableBlocks(['q-pax','q-ticketType','q-importePagar','q-importePagado','q-email','q-movil','q-review']);
  configurarButtonsPorClub(el);
}

function onNombre(el){
  const ok = el.nombre.value.trim() !== '';
  ok ? enableBlocks(['q-pax']) : disableBlocks(['q-pax']);
  disableBlocks(['q-ticketType','q-importePagar','q-importePagado','q-email','q-movil','q-review']);
}

function onPax(el){
  const ok = parseInt(el.pax.value)||0;
  ok ? enableBlocks(['q-ticketType']) : disableBlocks(['q-ticketType']);
  disableBlocks(['q-importePagar','q-importePagado','q-email','q-movil','q-review']);
}

function onTicket(el, tipo){
  /* visual */
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
  ok ? enableBlocks(['q-importePagado']) : disableBlocks(['q-importePagado']);
  disableBlocks(['q-email','q-movil','q-review']);
}

function onImportePromotor(el){
  const ok = parseFloat(el.impPro.value) >= 0;
  ok ? enableBlocks(['q-email']) : disableBlocks(['q-email']);
  disableBlocks(['q-movil','q-review']);
}

function onEmail(el){
  const ok = el.email.checkValidity();
  ok ? enableBlocks(['q-movil']) : disableBlocks(['q-movil']);
  disableBlocks(['q-review']);
}

function onMovil(el){
  const ok = el.movil.value.trim().length > 0;
  ok ? enableBlocks(['q-review']) : disableBlocks(['q-review']);
}

/* ───────────────────────── carga de clubs ───────────────────────── */
async function cargarClubs(fecha, select){

  // Normaliza tildes: 'miércoles' -> 'miercoles', 'sábado' -> 'sabado'
  function normalize(s) {
    return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }
  select.innerHTML = '<option>Cargando…</option>';
  select.disabled  = true;
  const diaSemanaRaw = new Date(fecha).toLocaleDateString('es-ES', { weekday: 'long' }).toLowerCase();
  const diaSemana = normalize(diaSemanaRaw);
  console.log(`[Clubs] Cargando clubs para ${fecha} (${diaSemanaRaw} -> ${diaSemana})`);

  try {
    if (!db) {
      throw new Error('Base de datos no inicializada');
    }

    // Primero probar una consulta simple
    console.log('[Clubs] Probando conexión a Firestore...');
    const testSnap = await db.collection('clubs').limit(1).get();
    console.log(`[Clubs] Conexión OK. Total de clubs: ${testSnap.size}`);

    // Si no hay clubs, crear algunos de prueba
    if (testSnap.size === 0) {
      console.log('[Clubs] No hay clubs, creando datos de prueba...');
      await crearClubsDePrueba();
    }

    // Luego la consulta filtrada
    const snap = await db.collection('clubs')
      .where('activo','==',true)
      .get();

    console.log(`[Clubs] Clubs activos encontrados: ${snap.size}`);

    // Si no hay clubs para el día específico, mostrar todos los activos
    let filteredDocs = [];
    snap.forEach(doc => {
      const d = doc.data();
      const diasDisponibles = d.disponibilidad || {};
      console.log(`[Clubs] ${d.nombre} - días disponibles:`, diasDisponibles);
      
      // Si tiene el día disponible O si no tiene restricción de días
      if (diasDisponibles[diaSemana] === true || Object.keys(diasDisponibles).length === 0) {
        filteredDocs.push(doc);
      }
    });

    console.log(`[Clubs] Clubs para ${diaSemana}: ${filteredDocs.length}`);

    select.innerHTML = '<option value="" disabled selected>— Selecciona club —</option>';
    filteredDocs.forEach(doc => {
      const d = doc.data();
      console.log(`[Clubs] Agregando club: ${d.nombre}`);
      const opt = new Option(d.nombre, d.nombre);
      opt.dataset.full = d.fullTicket ? 'true':'false';
      opt.dataset.pre  = d.preSale ? 'true':'false';
      opt.dataset.clubId = doc.id;
      select.append(opt);
    });

    select.disabled = false;

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
  const opt = el.club.selectedOptions[0];
  if(!opt) return;
  const full = opt.dataset.full === 'true';
  const pre  = opt.dataset.pre  === 'true';

  /* reset */
  el.btnFull.disabled = el.btnPre.disabled = true;
  el.btnFull.classList.remove('bg-blue-600','text-white');
  el.btnPre .classList.remove('bg-blue-600','text-white');

  if (full) el.btnFull.disabled = false;
  if (pre ) el.btnPre .disabled = false;
}

/* ───────────────────────── resumen + envío ───────────────────────── */
function mostrarResumen(el){
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

  $('#reservaForm').classList.add('hidden');
  $('#resumenReserva').classList.remove('hidden');
}

async function enviarReserva(el, spinner, success, resumen){
  spinner.classList.remove('hidden');

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

    /* grabar en las tres rutas */
    await Promise.all([
      firebaseDb.collection('reservas').doc(id).set(data),
      firebaseDb.collection('reservas_por_dia').doc(data.Fecha).collection('reservas').doc(id).set(data),
      firebaseDb.collection('reservas_por_promotor').doc(data.PromotorUid).collection('reservas').doc(id).set(data)
    ]);

    spinner.classList.add('hidden');
    resumen.classList.add('hidden');
    success.classList.remove('hidden');

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
