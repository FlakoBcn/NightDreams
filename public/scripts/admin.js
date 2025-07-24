/*****************************************************************
 * NightDreams – Panel Admin (stand-alone)
 * - Carga Firebase Compat en orden seguro
 * - Autenticación admin robusta
 * - Renderizado dinámico y claro
 *****************************************************************/

// Configuración global de Firebase
const SDK_VERSION = '10.12.1';
const CDN = `https://www.gstatic.com/firebasejs/${SDK_VERSION}`;
const firebaseConfig = {
  apiKey: 'AIzaSyAojJehdlYbQjfpjaDPCh-59y0rZG-fM34',
  authDomain: 'nightdreams-f90b0.firebaseapp.com',
  projectId: 'nightdreams-f90b0',
  storageBucket: 'nightdreams-f90b0.appspot.com',
  messagingSenderId: '1011859565794',
  appId: '1:1011859565794:web:f9a5faa6ea2a10f47202bb',
  measurementId: 'G-NHMYKW05DT'
};

let firebase, auth, db, messaging;

// Inicialización robusta y en orden de Firebase
async function initFirebase() {
  if (!window.firebase) {
    const appMod = await import(`${CDN}/firebase-app-compat.js`);
    window.firebase = appMod.default ?? appMod.firebase ?? appMod;

    await import(`${CDN}/firebase-auth-compat.js`);
    await import(`${CDN}/firebase-firestore-compat.js`);
    await import(`${CDN}/firebase-messaging-compat.js`);

    if (window.firebase.apps.length === 0) {
      window.firebase.initializeApp(firebaseConfig);
    }
  }

  firebase = window.firebase;
  auth = firebase.auth();
  db = firebase.firestore();
  messaging = firebase.messaging.isSupported() ? firebase.messaging() : null;

  return { auth, db, messaging };
}

// Verificación sólida del rol admin
async function requireAdmin(auth, db) {
  return new Promise(resolve => {
    auth.onAuthStateChanged(async user => {
      if (!user) return location.href = 'access.html';

      const snap = await db.collection('usuarios').doc(user.uid).get();
      const data = snap.data();

      if (!snap.exists || !(data.rol === 'admin' || data.correo === 'official.nightdreams@gmail.com')) {
        location.href = 'access.html';
        return;
      }

      resolve({ uid: user.uid, ...data });
    });
  });
}

// Inicializar el Dashboard completo
async function renderDashboard(db) {
  document.getElementById('adminPanel').innerHTML = `
    <div class="row g-4">
      <div class="col-lg-4">${cardToken()}</div>
      <div class="col-lg-8">${card('Usuarios','users',`<div id="usuariosTable">Cargando usuarios...</div>`)}</div>
      <div class="col-12">${card('Clubs','building',`<div id="clubsTable">Cargando clubs...</div>`)}</div>
      <div class="col-12">${card('Productos','package',`<div id="productosTable">Cargando productos...</div>`)}</div>
      <div class="col-12">${card('Week Schedule','calendar-days',`<div id="weekTable">Cargando horarios...</div>`)}</div>
    </div>
    <div id="modalContainer"></div>
  `;
  window.lucide?.createIcons();
  bindStaticButtons();
  loadAllData(db);
}

// Componentes de tarjetas reutilizables
const card = (title, icon, body) => `
  <div class="card shadow mb-3">
    <div class="card-header bg-gradient text-white d-flex align-items-center">
      <i data-lucide="${icon}" class="me-2"></i>${title}
    </div>
    <div class="card-body">${body}</div>
  </div>`;

const cardToken = () => `
  <div class="card shadow mb-3">
    <div class="card-header bg-gradient text-white">
      <i data-lucide="key" class="me-2"></i>Token Push Admin
    </div>
    <div class="card-body">
      <div id="tokenDisp" class="token-display mb-2">—</div>
      <button id="getTokenBtn" class="btn btn-primary btn-sm">Obtener Token</button>
      <button id="copyTokenBtn" class="btn btn-secondary btn-sm">Copiar Token</button>
    </div>
  </div>`;

// Eventos de botones estáticos
function bindStaticButtons() {
  document.getElementById('getTokenBtn').onclick = obtenerToken;
  document.getElementById('copyTokenBtn').onclick = () => {
    const token = document.getElementById('tokenDisp').textContent;
    navigator.clipboard.writeText(token);
  };
}

// Cargar todos los datos iniciales
function loadAllData(db) {
  loadCollection(db, 'usuarios', '#usuariosTable', doc => `${doc.nombre} – ${doc.correo}`);
  loadCollection(db, 'clubs', '#clubsTable', doc => `${doc.nombre}`);
  loadCollection(db, 'Productos', '#productosTable', doc => `${doc.nombre}`);
  loadCollection(db, 'WeekDays', '#weekTable', doc => `${doc.id}`);
}

// Función general para cargar colecciones
async function loadCollection(db, collection, selector, render) {
  const host = document.querySelector(selector);
  host.innerHTML = 'Cargando...';
  try {
    const snap = await db.collection(collection).get();
    if (snap.empty) {
      host.innerHTML = `<div class="text-muted">Sin datos en ${collection}</div>`;
      return;
    }
    host.innerHTML = snap.docs.map(d => `<div>${render(d.data(), d)}</div>`).join('');
  } catch (err) {
    console.error(`Error cargando ${collection}:`, err);
    host.innerHTML = `<div class="text-danger">Error al cargar ${collection}</div>`;
  }
}

// Obtener token push para notificaciones
async function obtenerToken() {
  try {
    if (!messaging) throw Error('Messaging no soportado');
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') throw Error('Permiso no concedido');

    const token = await messaging.getToken({ vapidKey: VAPID_KEY });
    document.getElementById('tokenDisp').textContent = token;

    const uid = auth.currentUser.uid;
    await db.collection('usuarios').doc(uid).update({
      tokenPush: token,
      ultimoTokenUpdate: firebase.firestore.FieldValue.serverTimestamp()
    });

    alert('Token obtenido y guardado.');
  } catch (err) {
    console.error('Error al obtener token:', err);
    document.getElementById('tokenDisp').textContent = 'Error al obtener token';
  }
}

// Iniciar toda la lógica cuando DOM cargue
document.addEventListener('DOMContentLoaded', async () => {
  const { auth, db, messaging } = await initFirebase();
  await requireAdmin(auth, db);
  renderDashboard(db);
});
