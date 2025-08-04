/*─────────────────────────────────────────────────────────────*/
/* NightDreams – App ULTRALIGERA                        */

/*─────────────────────────────────────────────────────────────*/
console.time('[ND] startup');

let firebase, auth, db, messaging;
let firebaseReady = false;

const firebaseConfig = {
  apiKey           : 'AIzaSyAojJehdlYbQjfpjaDPCh-59y0rZG-fM34',
  authDomain       : 'nightdreams-f90b0.firebaseapp.com',
  projectId        : 'nightdreams-f90b0',
  storageBucket    : 'nightdreams-f90b0.appspot.com',
  messagingSenderId: '1011859565794',
  appId            : '1:1011859565794:web:f9a5faa6ea2a10f47202bb',
  measurementId    : 'G-NHMYKW05DT'
};

export async function loadFirebase() {
  if (firebaseReady) return { auth, db, messaging };

  // Firebase ya está cargado por el HTML, solo inicializa la app si hace falta:
  firebase = window.firebase;

  if (firebase.apps.length === 0) {
    firebase.initializeApp(firebaseConfig);
  }

  auth = firebase.auth();
  db   = firebase.firestore();
  messaging = (firebase.messaging.isSupported?.())
      ? firebase.messaging()
      : null;

  firebaseReady = true;
  console.log('✅ Firebase ready');
  return { auth, db, messaging };
}

// Exportar referencias
export { db, auth, messaging };




/* VAPID para notificaciones */
/**
 * VAPID_KEY is the public key used for Firebase Cloud Messaging (FCM) to authorize push notifications.
 * It should be passed when requesting the FCM token for web push notifications.
 */
const VAPID_KEY = 'BJklec5TmcAlNhPnCeyTRbDV44eDLHH-pTWcSRFYZw0E6RZI4PG6vbijPmnZcrkUDzc2z365GEksr8rNX8lePdo';
function isInStandaloneMode() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  );
}
/* SERVICE WORKER ***********************************************************/
if ('serviceWorker' in navigator) {
  if (isInStandaloneMode()) {
    // SOLO registra el SW si es PWA
    navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js')
      .then(existingRegistration => {
        if (existingRegistration) {
          console.log('[SW] Service Worker already registered:', existingRegistration.scope);
        } else {
          console.log('[SW] Registering new Service Worker...');
          navigator.serviceWorker.register('/firebase-messaging-sw.js')
            .then(r => console.log('[SW] Registered successfully:', r.scope))
            .catch(err => console.warn('[SW] Registration failed:', err));
        }
      })
      .catch(err => console.error('[SW] Error checking existing registration:', err));
  } else {
    // Si NO es PWA, elimina cualquier SW existente
    navigator.serviceWorker.getRegistrations().then(regs => {
      regs.forEach(reg => reg.unregister());
    });
    // Limpia tokens FCM de localStorage para evitar residuos
    localStorage.removeItem('fcmToken');
  }
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
let dailyDashboardBtn, logoutBtn, notifBtn, saveTokenBtn, refreshBtn;

function initDOM() {
  content = document.getElementById('content');
  navButtons = document.querySelectorAll('.nav-btn');
  menuBtn = document.getElementById('menuBtn');
  sideMenuWrapper = document.getElementById('sideMenuWrapper');
  overlay = document.getElementById('overlay');
  sideMenu = document.getElementById('sideMenu');
  dailyDashboardBtn = document.getElementById('dailyDashboardBtn');
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

async function handleDeniedAccess(res, user, currentPage) {
  console.log('[AUTH] Acceso denegado:', res.motivo);

  if (res.motivo === 'pendiente_aprobacion') {
    setLocalStorageUser(user.uid, res.userData, false);
    if (!currentPage.includes('espera.html')) location.replace('espera.html');
    return;
  }

  // usuario eliminado u otros casos
  limpiarSesionLocal();
if (auth.currentUser) {
  await auth.signOut();
}
location.replace('access.html');
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

  console.log('[AUTH] ✅ Acceso concedido');
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
  const bossBtnEl = document.getElementById('panelBossBtnWrapper');

  if (userNameEl) userNameEl.textContent = nombre;
  if (userEmailEl) userEmailEl.textContent = correo;
  if (userCatEl) userCatEl.textContent = rol || 'Promotor';
  if (isAdmin && adminPanelEl) adminPanelEl.classList.remove('hidden');
  // Solo el correo especial puede ver el botón Boss
  if (correo === 'official.nightdreams@gmail.com' && bossBtnEl) bossBtnEl.classList.remove('hidden');
  // --- CONTROL VISIBILIDAD DEL BOTÓN LOGOUT SEGÚN ROL ---
  // Para ocultar el logout a promotores, descomenta el siguiente bloque:
  /*
  if (logoutBtn) {
    if (!isAdmin) {
      logoutBtn.classList.add('hidden'); // O usa logoutBtn.style.display = 'none';
    } else {
      logoutBtn.classList.remove('hidden');
    }
  }
  */
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

  // Daily Dashboard
  if (dailyDashboardBtn) {
    dailyDashboardBtn.addEventListener('click', () => {
      // Por ahora solo muestra un mensaje. Más adelante puedes implementar la lógica real.
      alert('DailyDashboard aún no implementado. Próximamente aquí 😉');
      // Ejemplo futuro: loadPage('dailydashboard');
    });
  }
  // Refresh
  if (refreshBtn) refreshBtn.addEventListener('click', () => location.reload());

  // Notifications
  if (notifBtn) {
    notifBtn.addEventListener('click', async () => {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') return alert('Permiso de notificación denegado.');
       const token = await getFcmToken();
    if (token) localStorage.setItem('fcmToken', token);
     notifBtn.style.display = 'none'; // Oculta el botón tras activar
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

function checkNotificationStatus() {
  const notifBtn = document.getElementById('notificacionesBtn');
  const token = localStorage.getItem('fcmToken');
  if (!notifBtn) return;
  if (token) {
    notifBtn.style.display = 'none';
    return;
  }
  if (!isInStandaloneMode()) {
    notifBtn.disabled = true;
    notifBtn.title = "Instala la app para activar las notificaciones";
    notifBtn.style.opacity = 0.5;
  } else {
    notifBtn.disabled = false;
    notifBtn.title = "";
    notifBtn.style.display = '';
  }
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
function mostrarBannerNotificacion(title, body) {
  document.getElementById('bannerNotiTitle').textContent = title || '🔔 Notificación';
  document.getElementById('bannerNotiBody').textContent = body || '';
  const banner = document.getElementById('bannerNotificacion');
  banner.style.display = 'block';

  // Oculta automáticamente después de 5 segundos
  clearTimeout(window.bannerTimeout);
  window.bannerTimeout = setTimeout(() => {
    banner.style.display = 'none';
  }, 5000);
}



async function initMessaging() {
  if (!messaging) return;

  // Notificación directa primer plano (cuando app abierta)
  messaging.onMessage(payload => {
    console.log('[FCM] Notificación en primer plano:', payload);

    if (payload.data) {
      mostrarBannerNotificacion(
        payload.data.title ?? 'NightDreams',
        payload.data.body ?? ''
      );
    }
  });

  // Escucha eventos PUSH_IN_APP desde Service Worker
  navigator.serviceWorker.addEventListener('message', event => {
    if (event.data?.type === 'PUSH_IN_APP') {
      const data = event.data.payload.data;
      mostrarBannerNotificacion(
        data.title || 'NightDreams',
        data.body || ''
      );
    }
  });
}

/* INIT APP *****************************************************************/
async function initializeDOM() {
  initDOM();
  checkNotificationStatus();
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
          if (auth.currentUser) {
            await auth.signOut();
          }
          location.replace('access.html');
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

  // Redirección del botón Admin
  const adminButton = document.querySelector('[data-page="admin"]');
  if (adminButton) {
      adminButton.addEventListener('click', () => {
          window.location.href = '/pages/admin.html'; // Redirige al panel de administración
      });
  }

  console.timeEnd('[ND] startup');
});