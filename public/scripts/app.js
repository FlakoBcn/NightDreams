/*─────────────────────────────────────────────────────────────*/
/* NightDreams – App ULTRALIGERA v15.1                         */
/* Zero‑preload – Firebase lazy                                */
/*─────────────────────────────────────────────────────────────*/
console.time('[ND] startup');

/* FIREBASE - LAZY LOAD *********************************************************/
let firebase, auth, db, messaging;
let firebaseReady = false;

const firebaseConfig = {
  apiKey           : 'AIzaSyAojJehdlYbQjfpjaDPCh-59y0rZG-fM34',
  authDomain       : 'nightdreams-f90b0.firebaseapp.com',
  projectId        : 'nightdreams-f90b0',
  storageBucket    : 'nightdreams-f90b0.appspot.com',             // ✔ dominio corregido
  messagingSenderId: '1011859565794',
  appId            : '1:1011859565794:web:f9a5faa6ea2a10f47202bb',
  measurementId    : 'G-NHMYKW05DT'
};

export async function loadFirebase() {
  if (firebaseReady) return { auth, db, messaging };

  console.log('🔥  Firebase loading…');

  /* 1️⃣ Importar SDK Compat ES Modules */
  if (!window.firebase) {
    // firebase‑app
    const appMod = await import('https://www.gstatic.com/firebasejs/10.12.1/firebase-app-compat.js');
    window.firebase = appMod.default ?? appMod.firebase ?? appMod;   // ← asegura global

    // resto de compat‑SDK
    await Promise.all([
      import('https://www.gstatic.com/firebasejs/10.12.1/firebase-auth-compat.js'),
      import('https://www.gstatic.com/firebasejs/10.12.1/firebase-firestore-compat.js'),
      import('https://www.gstatic.com/firebasejs/10.12.1/firebase-messaging-compat.js')
    ]);
  }

  firebase = window.firebase;

  /* 2️⃣ Inicializar solo si no existe App */
  if (firebase.apps.length === 0) {
    firebase.initializeApp(firebaseConfig);
  }

  auth = firebase.auth();
  db   = firebase.firestore();

  /* 3️⃣ Messaging solo si está soportado */
  messaging = (firebase.messaging.isSupported?.())
      ? firebase.messaging()
      : null;

  firebaseReady = true;
  console.log('✅ Firebase ready');

  // 👉 deja los objetos accesibles para otros módulos
  return { auth, db, messaging };
}

/* 4️⃣ Exports que necesitan otros scripts */
// Exportar referencias directas para compatibilidad con scripts que requieren acceso inmediato a los objetos Firebase
export { db, auth, messaging };

/* VAPID para notificaciones */
/**
 * VAPID_KEY is the public key used for Firebase Cloud Messaging (FCM) to authorize push notifications.
 * It should be passed when requesting the FCM token for web push notifications.
 */
const VAPID_KEY = 'BJklec5TmcAlNhPnCeyTRbDV44eDLHH-pTWcSRFYZw0E6RZI4PG6vbijPmnZcrkUDzc2z365GEksr8rNX8lePdo';

/* SERVICE WORKER ***********************************************************/
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/ServiceWorker.js')
  .then(r => console.log('[SW] registrado', r.scope))
  .catch(console.warn);
}

/* CONEXIÓN *****************************************************************/
let isOnline = navigator.onLine;

function showOfflineBanner() {
  if (!document.getElementById('offline-banner')) {
    const banner = document.createElement('div');
    banner.id = 'offline-banner';
    banner.className = 'offline-banner';
    banner.innerHTML = '🌐❌ SIN CONEXIÓN - NightDreams requiere internet';
    document.body.appendChild(banner);
  }
}

function hideOfflineBanner() {
  const banner = document.getElementById('offline-banner');
  if (banner) banner.remove();
}

window.addEventListener('offline', () => {
  isOnline = false;
  showOfflineBanner();
});

window.addEventListener('online', () => {
  isOnline = true;
  hideOfflineBanner();
});

if (!isOnline) showOfflineBanner();

/* DOM ELEMENTS *************************************************************/
let content, navButtons, menuBtn, sideMenuWrapper, overlay, sideMenu;
let clearCacheBtn, logoutBtn, notifBtn, saveTokenBtn, refreshBtn;

function initDOM() {
  content = document.getElementById('content');
  navButtons = document.querySelectorAll('.nav-btn');
  menuBtn = document.getElementById('menuBtn');
  sideMenuWrapper = document.getElementById('sideMenuWrapper');
  overlay = document.getElementById('overlay');
  sideMenu = document.getElementById('sideMenu');
  clearCacheBtn = document.getElementById('clearCacheBtn');
  logoutBtn = document.getElementById('logoutBtn');
  notifBtn = document.getElementById('notificacionesBtn');
  saveTokenBtn = document.getElementById('guardarTokenBtn');
  refreshBtn = document.getElementById('refreshBtn');
}

/* SISTEMA UNIFICADO DE AUTENTICACIÓN Y ROLES ******************************/

// Función principal de verificación de acceso
async function verificarAccesoUsuario(uid) {
  try {
    const ref  = db.collection('usuarios').doc(uid);
    let   snap = await ref.get();

    /* 3️⃣ Nuevo usuario → crear doc Pendiente */
    if (!snap.exists) {
      const authUser = auth.currentUser;
      await ref.set({
        nombre : authUser.displayName ?? '',
        correo : authUser.email       ?? '',
        rol    : 'promotor',
        estado : 'Pendiente',
        fechaRegistro: firebase.firestore.FieldValue.serverTimestamp()
      });
      snap = await ref.get();               // refrescar
      console.log('[AUTH] Documento auto‑creado (nuevo usuario)');
      return { acceso:false, motivo:'pendiente_aprobacion', userData:snap.data() };
    }

    const data = snap.data();
    const isAdmin = data.rol === 'admin' || data.correo === 'official.nightdreams@gmail.com';

    if (isAdmin || data.estado === 'Aprobado') {
      return { acceso:true, esAdmin:isAdmin, userData:data };
    }

    return { acceso:false, motivo:'pendiente_aprobacion', userData:data };

  } catch (err) {
    console.error('[AUTH] Error verificando acceso:', err);
    return { acceso:false, motivo:'error_verificacion' };
  }
}

// Función para limpiar sesión local
function limpiarSesionLocal() {
  console.log('[AUTH] Limpiando sesión local');
  ['uid','nombre','correo','rol','estado','esAdmin']
    .forEach(k => localStorage.removeItem(k));
}
/* AUTH SISTEMA UNIFICADO ***************************************************/
function handleNoUser(currentPage) {
  console.log('[AUTH] No hay usuario autenticado');
  limpiarSesionLocal();
  if (!currentPage.includes('access.html') && !currentPage.includes('espera.html')) {
    window.location.href = 'access.html';
  }
}

function handleDeniedAccess(res, user, currentPage) {
  console.log('[AUTH] Acceso denegado:', res.motivo);

  if (res.motivo === 'pendiente_aprobacion') {
    setLocalStorageUser(user.uid, res.userData, false);
    if (!currentPage.includes('espera.html')) location.replace('espera.html');
    return;
  }

  // usuario eliminado u otros casos
  limpiarSesionLocal();
  auth.signOut().finally(() => location.replace('access.html'));
}

function setLocalStorageUser(uid, userData, esAdmin) {
  localStorage.setItem('uid', uid);
  localStorage.setItem('nombre', userData.nombre || '');
  localStorage.setItem('correo', userData.correo || '');
  localStorage.setItem('rol', userData.rol || 'promotor');
  localStorage.setItem('estado', userData.estado || (esAdmin ? 'Aprobado' : 'Pendiente'));
  localStorage.setItem('esAdmin', esAdmin ? 'true' : 'false');
}

async function handleAuthStateChanged(user, currentPage) {
  if (!user) {
    handleNoUser(currentPage);
    return;
  }

  console.log('[AUTH] Usuario autenticado, verificando acceso...');
  const resultado = await verificarAccesoUsuario(user.uid);

  if (!resultado.acceso) {
    handleDeniedAccess(resultado, user, currentPage);
    return;
  }

  // ✅ Acceso concedido - actualizar localStorage
  const { userData, esAdmin } = resultado;
  setLocalStorageUser(user.uid, userData, esAdmin);

  // Actualizar UI solo en index.html
  if (currentPage.includes('index.html') || currentPage === '/') {
    updateUserUI(userData.nombre, userData.correo, userData.rol, esAdmin);
  }

  console.log('[AUTH] ✅ Acceso concedido y UI actualizada');
}

async function initAuth() {
  const currentPage = window.location.pathname;
  if (currentPage.includes('access.html') || currentPage.includes('espera.html')) {
    console.log('[AUTH] En página de acceso/espera, saltando verificaciones');
    return;
  }

  auth.onAuthStateChanged(user => {
    handleAuthStateChanged(user, currentPage);
  });
}

    console.log('[AUTH] ✅ Acceso concedido y UI actualizada');
/**
 * Updates the user interface with the current user's information and role.
 * @param {string} nombre - The user's display name.
 * @param {string} correo - The user's email address.
 * @param {string} rol - The user's role (e.g., 'admin', 'promotor').
 * @param {boolean} isAdmin - Whether the user has admin privileges.
 */
function updateUserUI(nombre, correo, rol, isAdmin) {
  const userNameEl = document.getElementById('userName');
  const userEmailEl = document.getElementById('userEmail');
  const userCatEl = document.getElementById('userRole');
  const adminPanelEl = document.getElementById('adminPanelBtnWrapper');
  
  if (userNameEl) userNameEl.textContent = nombre;
  if (userEmailEl) userEmailEl.textContent = correo;
  if (userCatEl) userCatEl.textContent = rol || 'Promotor';
  if (isAdmin && adminPanelEl) {
    adminPanelEl.classList.remove('hidden');
  }
}

async function loadPage(page = 'home') {
  if (!content) return;

  try {
    const res = await fetch(`/pages/${page}.html`);
    if (!res.ok) throw new Error('404');
    const html = await res.text();
    content.innerHTML = html;

    // Iconos bajo demanda
    if (window.loadLucide) window.loadLucide();

    // JS module bajo demanda
    try {
      const mod = await import(`/scripts/${page}.js`).catch(() => null);
      if (mod?.init) mod.init();
    } catch (err) {
      console.warn(`[SPA] ${page}.js failed:`, err);
    }

    // Optionally, add debug logging here if needed
    // console.log(`[SPA] ${page} loaded`);
  } catch (err) {
    content.innerHTML = '<div style="padding:20px;text-align:center;color:#ff4444;">Página no encontrada</div>';
  }
}

function updateActiveNav(page) {
  if (navButtons.length) {
    navButtons.forEach(btn => btn.classList.toggle('text-blue-600', btn.dataset.page === page));
  }
}

/* EVENT LISTENERS **********************************************************/
function initEventListeners() {
  // Navigation
  navButtons.forEach(btn => {
    btn.addEventListener('click', e => {
      e.preventDefault();
      const page = btn.dataset.page || 'home';
      history.pushState({ page }, '', `#${page}`);
      loadPage(page);
      updateActiveNav(page);
    });
  });

  // Browser back/forward
  window.addEventListener('popstate', () => {
    const page = location.hash.replace('#', '') || 'home';
    loadPage(page);
    updateActiveNav(page);
  });

  // Sidebar
  if (menuBtn) {
    menuBtn.addEventListener('click', () => {
      if (sideMenuWrapper) {
        sideMenuWrapper.classList.add('active');
        sideMenuWrapper.classList.remove('hidden');
        setTimeout(() => sideMenu?.classList.remove('-translate-x-full'), 20);
      }
    });
  }

  if (overlay) {
    overlay.addEventListener('click', closeSidebar);
  }

  // Logout
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await auth.signOut();
      localStorage.clear();
      window.location.href = 'access.html';
    });
  }

  // Cache clear
  if (clearCacheBtn) clearCacheBtn.addEventListener('click', clearAppCache);
  if (refreshBtn) refreshBtn.addEventListener('click', clearAppCache);

  // Notifications
  if (notifBtn) {
    notifBtn.addEventListener('click', async () => {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') return alert('Permiso de notificación denegado.');
      await getFcmToken();
      alert('Notificaciones activadas ✔️');
    });
  }

  if (saveTokenBtn) {
    saveTokenBtn.addEventListener('click', getFcmToken);
  }
}

function closeSidebar() {
  if (sideMenu) sideMenu.classList.add('-translate-x-full');
  setTimeout(() => sideMenuWrapper?.classList.add('hidden'), 300);
  sideMenuWrapper?.classList.remove('active');
}

/* CACHE MANAGEMENT *********************************************************/
async function clearAppCache() {
  if (!confirm('¿Recargar la app?')) return;
  location.reload();
}

/* NOTIFICATIONS ************************************************************/
async function getFcmToken() {
  try {
    if (!messaging) throw new Error('El navegador no soporta FCM');
    
    const currentToken = await messaging.getToken({ 
      vapidKey: VAPID_KEY
    });
    
    if (!currentToken) throw new Error('No se pudo obtener token');
    console.log('[FCM] Token:', currentToken);

    const uid = auth.currentUser?.uid;
    if (uid) {
      await db.collection('usuarios').doc(uid).update({
        tokenPush: currentToken,
        ultimoTokenUpdate: firebase.firestore.FieldValue.serverTimestamp()
      });
    }
    return currentToken;
  } catch (err) {
    console.error('[FCM] Error:', err);
    alert(err.message || 'No se pudo guardar el token FCM.');
  }
}

/* MESSAGING - Notificaciones en primer plano ******************************/
async function initMessaging() {
  if (!messaging) return;                  // ← evita fallo Safari

  messaging.onMessage(payload => {
    console.log('[FCM] Notificación en primer plano:', payload);
    
    // Mostrar notificación personalizada
    if (payload.notification) {
      new Notification(payload.notification.title ?? 'NightDreams', {
        body: payload.notification.body,
        icon: '/icon-192.png'
      });
    }
  });
}

/* INIT APP *****************************************************************/
async function initializeDOM() {
  initDOM();
  initEventListeners();
}

async function initializeFirebase() {
  await loadFirebase();
}

async function initializeAuth() {
  await initAuth();
}

async function initializeMessaging() {
  await initMessaging();
}

async function loadInitialPage() {
  loadPage(location.hash.replace('#', '') || 'home');
}

function setupPeriodicVerification() {
  const currentPage = window.location.pathname;
  if (currentPage.includes('index.html') || currentPage === '/') {
    setInterval(async () => {
      const uid = localStorage.getItem('uid');
      if (uid && auth.currentUser) {
        const resultado = await verificarAccesoUsuario(uid);
        if (!resultado.acceso && resultado.motivo === 'usuario_no_existe') {
          alert('Tu cuenta ha sido eliminada. Serás redirigido al login.');
          limpiarSesionLocal();
          await auth.signOut();
          window.location.href = 'access.html';
        }
      }
    }, 30000); // 30 segundos
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  console.log('🚀 NightDreams starting...');
  await initializeDOM();
  await initializeFirebase();
  await initializeAuth();
  await initializeMessaging();
  await loadInitialPage();
  setupPeriodicVerification();
  console.timeEnd('[ND] startup');
});