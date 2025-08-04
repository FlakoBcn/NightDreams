// scripts/admin.js – Panel Admin NightDreams (versión final, modular y robusto)
import { loadFirebase } from '/scripts/app.js';

let db, auth, weekClubs = {};
const WEEK_DAYS = [
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'
];
const listeners = [];

export async function init() {
  const firebase = await loadFirebase();
  db = firebase.db;
  auth = firebase.auth;


function setTab(tab) {
  ['tab-schedule', 'tab-notif', 'tab-catalogo', 'tab-usuarios'].forEach(id => {
    document.getElementById(id).classList.toggle('active', id === 'tab-' + tab);
  });
}

function sanitize(text) {
  if (typeof text !== "string") return text;
  const el = document.createElement('div');
  el.textContent = text;
  return el.innerHTML;
}

function clearContent() {
  document.getElementById('admin-content').innerHTML = '';
}

function renderSchedule() {
  setTab('schedule');
  document.getElementById('admin-content').innerHTML = `
    <h2 class="text-xl mb-4 font-semibold text-[#2850d2]">Week Schedule</h2>
    <div class="rounded-xl shadow border bg-white overflow-hidden mb-7">
      ${WEEK_DAYS.map(dia => `
        <div class="border-b last:border-b-0">
          <div class="flex items-center gap-3 bg-[#eef2fb] px-4 py-3">
            <span class="text-lg font-bold text-[#2850d2] flex-1">${sanitize(dia.charAt(0).toUpperCase() + dia.slice(1))}</span>
            <button class="btn-outline text-sm px-3 py-1.5" onclick="openAddClubModal('${dia}')">
              <i data-lucide='plus'></i> Añadir Club
            </button>
          </div>
          <div class="overflow-x-auto">
            <table class="table-admin w-full min-w-max" style="border-radius:0;">
              <thead>
                <tr>
                  <th>Club</th>
                  <th>Precio</th>
                  <th>Drink</th>
                  <th>Hora</th>
                  <th>PRcomisión</th>
                  <th>Devolver</th>
                  <th>Notificar</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                ${(weekClubs[dia] && weekClubs[dia].length)
                  ? weekClubs[dia].map((c, i) => `
                  <tr class="hover:bg-[#f3f6ff] transition-all">
                    <td><input class="input-td w-full font-semibold" value="${sanitize(c.club||'')}" onchange="updateClub('${dia}',${i},'club',this.value)" /></td>
                    <td><input class="input-td w-full text-right" type="number" min="0" value="${c.precio||''}" onchange="updateClub('${dia}',${i},'precio',this.value)" /></td>
                    <td class="text-center"><input type="checkbox" class="switch" ${c.drink?'checked':''} onchange="updateClub('${dia}',${i},'drink',this.checked)" /></td>
                    <td><input class="input-td w-full text-center" value="${sanitize(c.hora||'')}" onchange="updateClub('${dia}',${i},'hora',this.value)" /></td>
                    <td><input class="input-td w-full text-right" type="number" min="0" value="${c.prcomision||''}" onchange="updateClub('${dia}',${i},'prcomision',this.value)" /></td>
                    <td><input class="input-td w-full text-right" type="number" min="0" value="${c.devolver||''}" onchange="updateClub('${dia}',${i},'devolver',this.value)" /></td>
                    <td class="text-center"><input type="checkbox" class="switch" ${c.notificar?'checked':''} onchange="updateClub('${dia}',${i},'notificar',this.checked)" /></td>
                    <td><button class="btn-outline text-xs" onclick="removeClub('${dia}',${i})"><i data-lucide='trash-2'></i></button></td>
                  </tr>`).join('')
                  : `<tr><td colspan="8" class="text-center text-gray-400 py-3">No hay clubs aún para este día.</td></tr>`
                }
              </tbody>
            </table>
          </div>
        </div>`).join('')}
    </div>
    <div class="mt-4 flex gap-3">
      <button class="btn-primary" onclick="saveWeekClubs()"><i data-lucide="save"></i> Guardar Cambios</button>
      <button class="btn-outline" onclick="loadWeekClubs()">Cancelar</button>
    </div>
  `;
  if(window.lucide) lucide.createIcons();
}

function handleTabClick(e) {
  const id = e.target.id;
  setTab(id.replace('tab-',''));
  clearContent();
  if (id === 'tab-schedule') loadWeekClubs();
  else document.getElementById('admin-content').innerHTML = `
    <h2 class="text-xl font-semibold">${sanitize(e.target.textContent)}</h2>
    <p class="text-gray-500">Próximamente disponible.</p>`;
  if(window.lucide) lucide.createIcons();
}

['tab-schedule','tab-notif','tab-catalogo','tab-usuarios'].forEach(id => {
  const btn = document.getElementById(id);
  if (btn) btn.onclick = handleTabClick;
});

auth.onAuthStateChanged(async (user) => {
  if (!user) return (window.location.href = "access.html");
  const userDoc = await db.collection('usuarios').doc(user.uid).get();
  if (!userDoc.exists) return (window.location.href = "access.html");
  const userData = userDoc.data();
  if (userData.rol !== "admin" && userData.correo !== "official.nightdreams@gmail.com") {
    window.location.href = "access.html";
    return;
  }
  loadWeekClubs();
});

async function loadWeekClubs() {
  weekClubs = {};
  const snap = await db.collection('WeekDays').get();
  snap.forEach(doc => {
    const clubsArr = [];
    const clubs = doc.data().clubs || {};
    Object.entries(clubs).forEach(([club, info]) => {
      clubsArr.push({ club, ...info });
    });
    weekClubs[doc.id] = clubsArr;
  });
  WEEK_DAYS.forEach(dia => { if (!weekClubs[dia]) weekClubs[dia] = []; });
  renderSchedule();
}

async function saveWeekClubs() {
  for (const dia of WEEK_DAYS) {
    const clubsObj = {};
    weekClubs[dia].forEach(c => {
      const { club, ...rest } = c;
      clubsObj[club] = rest;
    });
    await db.collection('WeekDays').doc(dia).set({ clubs: clubsObj }, { merge: true });
  }
  showToast('Cambios guardados');
  loadWeekClubs();
}

window.updateClub = (dia, i, campo, valor) => {
  if (['drink', 'notificar'].includes(campo)) {
    weekClubs[dia][i][campo] = Boolean(valor);
  } else if (['precio','devolver','prcomision'].includes(campo)) {
    weekClubs[dia][i][campo] = Number(valor);
  } else {
    weekClubs[dia][i][campo] = valor;
  }
};
window.removeClub = (dia, i) => {
  if (confirm('¿Eliminar este club?')) {
    weekClubs[dia].splice(i, 1);
    renderSchedule();
  }
};
// Simple toast notification
function showToast(message) {
  let toast = document.createElement('div');
  toast.className = 'custom-toast';
  toast.textContent = message;
  Object.assign(toast.style, {
    position: 'fixed',
    bottom: '30px',
    left: '50%',
    transform: 'translateX(-50%)',
    background: '#2850d2',
    color: '#fff',
    padding: '12px 24px',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
    zIndex: 9999,
    fontSize: '1rem',
    opacity: 0,
    transition: 'opacity 0.3s'
  });
  document.body.appendChild(toast);
  setTimeout(() => { toast.style.opacity = 1; }, 10);
  setTimeout(() => {
    toast.style.opacity = 0;
    setTimeout(() => document.body.removeChild(toast), 300);
  }, 2000);
}

// Placeholder for openAddClubModal to prevent runtime errors
window.openAddClubModal = function(dia) {
  showToast(`Función para añadir club a "${dia}" aún no implementada.`);
};

window.removeClub = (dia,i) => confirm('¿Eliminar este club?') && weekClubs[dia].splice(i,1) && renderSchedule();

} // Close the init function properly

export function cleanup() {
  listeners.forEach(({ el, ev, fn }) => {
    if (el && ev && fn) el.removeEventListener(ev, fn);
  });
  listeners.length = 0;
  console.log('[Admin] cleanup');
}
