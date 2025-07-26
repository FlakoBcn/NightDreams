import { loadFirebase, db, auth, messaging } from './app.js';

export async function init() {
  await loadFirebase();
  initWelcomeSection();
  const currentDateEl = document.getElementById('currentDate');
  if (currentDateEl) {
    currentDateEl.textContent = new Date().toLocaleDateString('es-ES', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
  }

    // Refresh iconos Lucide
  if (window.lucide) {
    window.lucide.createIcons();
  }


  loadWeekScheduleHome();
  loadHomeConfig();
  setupHomeAnimations();
  
}

function initWelcomeSection(element = document) {
  const userName = localStorage.getItem('nombre') || 'Usuario';
  const userRole = localStorage.getItem('rol') || '';

  element.querySelectorAll('[data-user-name]').forEach(el => el.textContent = userName);
  element.querySelectorAll('[data-user-role]').forEach(el => el.textContent = userRole ? `Rol: ${userRole}` : '');
}

function setupHomeAnimations() {
  const animatedElements = document.querySelectorAll('[data-animate]');
  animatedElements.forEach((element, index) => {
    element.style.opacity = '0';
    element.style.transform = 'translateY(20px)';
    setTimeout(() => {
      element.style.transition = 'all 0.3s ease';
      element.style.opacity = '1';
      element.style.transform = 'translateY(0)';
    }, index * 100);
  });
}

function loadHomeConfig() {
  const homeContainer = document.querySelector('#content');
  if (homeContainer) {
    homeContainer.classList.add('home-loaded');
  }
}

// Make sure to import or define 'db' before using it.
// Example import for Firebase Firestore (adjust as needed for your setup):
// import { db } from './firebase'; 
const WEEK_DAYS_ORDER = [
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'
];

// Normaliza IDs eliminando tildes: 'miércoles' -> 'miercoles'
const normalize = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');

async function loadWeekScheduleHome() {
  const container = document.getElementById('weekScheduleContainer');
  if (!container) return;

  try {
    const snap = await db.collection('WeekDays').get();
    const docs = {};
    snap.forEach(d => { docs[normalize(d.id)] = { id: d.id, ...d.data() }; });


    const scheduleHtml = WEEK_DAYS_ORDER.map(dia => {
      const data = docs[normalize(dia)] || {};
      const clubs = data.clubs || {};
      const hasClubs = Object.keys(clubs).length > 0;

      // Pills inline, scrollable si hay muchos clubs
      const clubRows = hasClubs
        ? `<div class="flex flex-wrap gap-2">
            ${Object.entries(clubs)
              .filter(([, v]) => v && typeof v === 'object')
              .map(([club, v]) => `
                <div class="flex flex-row items-center px-3 py-2 rounded-2xl shadow-sm bg-white border border-gray-100 hover:shadow transition-all duration-200 max-w-full gap-2 pill">
                  <span class="font-semibold text-indigo-700 truncate max-w-[90px]">${club}</span>
                  <span class="flex items-center gap-1">
                    <i data-lucide="glass-water" class="w-5 h-5 ${v.drink ? 'text-teal-500' : 'text-gray-300'}" aria-label="${v.drink ? 'Incluye consumición' : 'No incluye consumición'}"></i>
                    ${v.drink ? '<span class="text-teal-500 font-medium text-xs">Drink</span>' : ''}
                  </span>
                  ${v.precio ? `<span class="flex items-center gap-1 text-purple-700 font-bold"><i data-lucide="badge-dollar-sign" class="w-4 h-4" aria-label="Precio"></i>${v.precio}</span>` : ''}
                  ${v.hora ? `<span class="flex items-center gap-1 text-blue-700"><i data-lucide="clock" class="w-4 h-4" aria-label="Hora"></i>${v.hora}</span>` : ''}
                  ${v.otro ? `<span class="text-gray-500 text-xs truncate max-w-[50px]">${v.otro}</span>` : ''}
                </div>
              `).join('')}
          </div>`
        : '<div class="text-gray-300 px-4 py-3">Sin clubs asignados</div>';

      return `
        <details class="group bg-white rounded-xl shadow-md transition-all duration-300 ease-in-out overflow-hidden border border-gray-200 hover:shadow-lg">
          <summary class="flex items-center justify-between p-4 cursor-pointer list-none">
            <span class="text-lg font-bold text-indigo-800 capitalize">${dia}</span>
            <div class="flex items-center">
              <span class="text-sm font-medium mr-3 ${hasClubs ? 'text-indigo-600' : 'text-gray-500'}">
                ${hasClubs ? `${Object.keys(clubs).length} Club(s)` : 'Cerrado'}
              </span>
              <i data-lucide="chevron-down" class="w-5 h-5 text-indigo-600 transition-transform duration-300 group-open:rotate-180" aria-label="Desplegar"></i>
            </div>
          </summary>
          <div class="p-4 border-t border-gray-200 bg-indigo-50/30">
            ${clubRows}
          </div>
        </details>`;
    }).join('');

    container.innerHTML = scheduleHtml;
    if (window.lucide) {
      window.lucide.createIcons();
    }

  } catch (e) {
    container.innerHTML = `
      <div class="text-red-500 p-4 bg-red-100 rounded-lg">
        Error cargando horarios. Por favor, inténtalo de nuevo más tarde.
      </div>`;
    console.error('[Home] WeekSchedule:', e);
  }
}
export function cleanup() {
  console.log('🧹 [Home] Limpiando recursos de la página Home');
  const homeContainer = document.querySelector('#content');
  if (homeContainer) {
    homeContainer.classList.remove('home-loaded');
  }
}