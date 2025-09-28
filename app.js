// Storage and state
const STORAGE_KEY = 'workout_diary_v1';

/** @typedef {{ id:string, name:string, category:'Biceps'|'Tricesp'|'Legs'|'Chest'|'Back'|'Shoulders', entries: WorkoutEntry[] }} Exercise */
/** @typedef {{ id:string, date:string, warmup:number, working:number }} WorkoutEntry */

const Categories = ['All','Biceps','Tricesp','Legs','Chest','Shoulders','Back'];

/** Simple uid */
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

function loadData() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const seed = createSeed();
    saveData(seed);
    return seed;
  }
  try {
    const data = JSON.parse(raw);
    if (!Array.isArray(data.exercises)) throw new Error('bad');
    return data;
  } catch {
    const fresh = createSeed();
    saveData(fresh);
    return fresh;
  }
}

function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function isValidDataShape(obj) {
  if (!obj || typeof obj !== 'object') return false;
  if (!Array.isArray(obj.exercises)) return false;
  return obj.exercises.every((ex)=> ex && typeof ex.id==='string' && typeof ex.name==='string' && typeof ex.category==='string' && Array.isArray(ex.entries));
}

async function exportData() {
  try {
    const data = JSON.stringify(state, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    
    // Проверяем, поддерживается ли File System Access API (современные браузеры)
    if ('showSaveFilePicker' in window) {
      try {
        const fileHandle = await window.showSaveFilePicker({
          suggestedName: 'workout-diary-export.json',
          types: [{
            description: 'JSON files',
            accept: { 'application/json': ['.json'] }
          }]
        });
        const writable = await fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();
        return;
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.warn('File System Access API failed, falling back to download:', error);
        }
      }
    }
    
    // Fallback для старых браузеров и APK приложений
    const url = URL.createObjectURL(blob);
    
    // Пробуем несколько методов для разных окружений
    try {
      // Метод 1: Стандартный download
      const a = document.createElement('a');
      a.href = url;
      a.download = 'workout-diary-export.json';
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      // Небольшая задержка перед очисткой URL
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      console.warn('Standard download failed, trying alternative method:', error);
      
      // Метод 2: Альтернативный способ для APK
      try {
        const link = document.createElement('a');
        link.href = url;
        link.download = 'workout-diary-export.json';
        link.target = '_blank';
        link.rel = 'noopener';
        
        // Добавляем событие для принудительного скачивания
        const event = new MouseEvent('click', {
          view: window,
          bubbles: true,
          cancelable: true
        });
        
        document.body.appendChild(link);
        link.dispatchEvent(event);
        document.body.removeChild(link);
        
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } catch (altError) {
        console.error('All download methods failed:', altError);
        
        // Метод 3: Показываем данные в новом окне для копирования
        const newWindow = window.open('', '_blank');
        if (newWindow) {
          newWindow.document.write(`
            <html>
              <head>
                <title>Workout Diary Export</title>
                <style>
                  body { font-family: monospace; padding: 20px; }
                  pre { background: #f5f5f5; padding: 15px; border-radius: 5px; }
                  button { padding: 10px 20px; margin: 10px 0; background: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer; }
                </style>
              </head>
              <body>
                <h2>Workout Diary Export</h2>
                <p>Copy the data below and save it as a .json file:</p>
                <button onclick="navigator.clipboard.writeText(document.querySelector('pre').textContent).then(() => alert('Copied to clipboard!'))">Copy to Clipboard</button>
                <pre>${data}</pre>
              </body>
            </html>
          `);
          newWindow.document.close();
        } else {
          // Последний fallback - показываем alert с данными
          alert('Export data (copy this text and save as .json file):\n\n' + data.substring(0, 500) + (data.length > 500 ? '...' : ''));
        }
      }
    }
  } catch (error) {
    console.error('Export failed:', error);
    alert('Export failed. Please try again or contact support.');
  }
}

function importDataFromFile(file) {
  if (!file) {
    console.warn('No file provided for import');
    return;
  }
  
  const reader = new FileReader();
  
  reader.onload = () => {
    try {
      const text = String(reader.result || '{}');
      const obj = JSON.parse(text);
      
      if (!isValidDataShape(obj)) {
        throw new Error('Invalid file format');
      }
      
      // Миграция данных
      (obj.exercises || []).forEach((ex) => {
        if (ex.category === 'Arms') ex.category = 'Biceps';
      });
      
      // Обновляем состояние
      state = obj;
      saveData(state);
      renderHome('All');
      
      // Показываем подтверждение
      alert('Data imported successfully!');
      
    } catch (e) {
      console.error('Import failed:', e);
      alert('Import failed. Please select a valid export file.');
    }
  };
  
  reader.onerror = () => {
    console.error('Failed to read file');
    alert('Failed to read file. Please try again.');
  };
  
  reader.readAsText(file);
}

// Добавляем новую функцию для экспорта в буфер обмена
async function exportToClipboard() {
  try {
    const data = JSON.stringify(state, null, 2);
    
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(data);
      alert('Data copied to clipboard! You can now paste it into a text file and save as .json');
    } else {
      // Fallback для старых браузеров
      const textArea = document.createElement('textarea');
      textArea.value = data;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      try {
        document.execCommand('copy');
        alert('Data copied to clipboard! You can now paste it into a text file and save as .json');
      } catch (err) {
        console.error('Failed to copy to clipboard:', err);
        alert('Failed to copy to clipboard. Please try the regular export method.');
      } finally {
        document.body.removeChild(textArea);
      }
    }
  } catch (error) {
    console.error('Clipboard export failed:', error);
    alert('Failed to copy to clipboard. Please try the regular export method.');
  }
}

function createSeed() {
  const today = new Date();
  const daysAgo = (n) => new Date(today.getFullYear(), today.getMonth(), today.getDate() - n);
  const fmt = (dt) => dt.toISOString().slice(0,10);
  const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

  /** Sample exercise names per category */
  const sampleNamesByCategory = {
    Biceps: ['Biceps Curl', 'Hammer Curl', 'EZ-Bar Curl', 'Cable Curl'],
    Tricesp: ['Triceps Pushdown'],
    Legs: ['Squat', 'Leg Press', 'Lunges', 'Romanian Deadlift', 'Leg Extension'],
    Chest: ['Bench Press', 'Incline Dumbbell Press', 'Chest Fly', 'Cable Crossover', 'Push-up'],
    Back: ['Lat Pulldown', 'Seated Row', 'Deadlift', 'Pull-up', 'T-Bar Row'],
    Shoulders: ['Overhead Press', 'Lateral Raise', 'Front Raise', 'Rear Delt Fly', 'Arnold Press']
  };

  const exercises = [];
  // Generate 1–2 unique exercises per category
  ;['Biceps','Tricesp','Legs','Chest','Back','Shoulders'].forEach((category) => {
    const names = [...sampleNamesByCategory[category]];
    const howMany = randInt(1, 2);
    for (let i = 0; i < howMany && names.length; i++) {
      const name = names.splice(randInt(0, names.length - 1), 1)[0];
      const entries = [0,1,2,3].map((d) => ({
        id: uid(),
        date: fmt(daysAgo(d)),
        warmup: randInt(5, 30) * 1,      // 5–30 kg
        working: randInt(30, 120) * 1    // 30–120 kg
      }));
      exercises.push({ id: uid(), name, category, entries });
    }
  });

  return { exercises };
}

let state = loadData();

// Migration: map legacy 'Arms' category to 'Biceps'
state.exercises.forEach((ex)=>{ if (ex.category === 'Arms') ex.category = 'Biceps'; });
saveData(state);

// UI helpers
const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

const appScreen = $('#screen');
const tabsNav = $('#categoryTabs');
const importFileInput = $('#importFile');

// Persisted custom order for categories (excluding 'All')
const ORDER_KEY = 'category_order_v1';

function loadCategoryOrder() {
  try {
    const raw = localStorage.getItem(ORDER_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

function saveCategoryOrder(order) {
  try { localStorage.setItem(ORDER_KEY, JSON.stringify(order)); } catch {}
}

function computeOrderedCategories() {
  const saved = loadCategoryOrder();
  const all = Categories.filter(c => c !== 'All');
  // Keep only existing categories from saved
  const kept = saved.filter(c => all.includes(c));
  // Append any new categories not present in saved
  const extras = all.filter(c => !kept.includes(c));
  return ['All', ...kept, ...extras];
}

let draggingCategory = null;

function onTabDragStart(e) {
  const cat = e.currentTarget?.dataset?.category;
  if (!cat || cat === 'All') return;
  draggingCategory = cat;
  try { e.dataTransfer.setData('text/plain', cat); } catch {}
}

function onTabDragOver(e) {
  e.preventDefault();
}

function onTabDrop(e, dropCat) {
  e.preventDefault();
  if (!draggingCategory || !dropCat || draggingCategory === dropCat) return;
  const current = computeOrderedCategories().filter(c => c !== 'All');
  const fromIdx = current.indexOf(draggingCategory);
  const toIdx = current.indexOf(dropCat);
  if (fromIdx === -1 || toIdx === -1) return;
  const next = [...current];
  next.splice(toIdx, 0, next.splice(fromIdx, 1)[0]);
  saveCategoryOrder(next);
  draggingCategory = null;
  renderHome(currentCategory || 'All');
}

// Distinct accent palettes per category for card left borders
const CATEGORY_ACCENT_PALETTES = {
  Biceps: ['#E57373', '#64B5F6', '#81C784', '#FFB74D'],
  Tricesp: ['#FFD54F', '#FFC107', '#FFEE58', '#FBC02D'],
  Shoulders: ['#4FC3F7', '#AED581', '#FF8A65', '#9575CD'],
  Legs: ['#7E57C2', '#8E24AA', '#5E35B1', '#9575CD'],
  Chest: ['#FF7043', '#EF5350', '#FBC02D', '#8D6E63'],
  Back: ['#66BB6A', '#81D4FA', '#FFCC80', '#CE93D8']
};

function hashStringToInt(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h * 16777619) >>> 0; }
  return h >>> 0;
}

function getAccentColor(category, stableKey) {
  const palette = CATEGORY_ACCENT_PALETTES[category];
  if (!palette || !palette.length) return null;
  const idx = hashStringToInt(String(stableKey)) % palette.length;
  return palette[idx];
}

function renderTabs(active='All') {
  tabsNav.innerHTML = '';
  const ordered = computeOrderedCategories();
  ordered.forEach((c) => {
    const count = c === 'All' ? state.exercises.length : state.exercises.filter(e=>e.category===c).length;
    const btn = document.createElement('button');
    btn.className = 'tab' + (c===active ? ' active':'');
    btn.textContent = c;
    btn.dataset.category = c;
    if (c !== 'All') {
      btn.draggable = true;
      btn.addEventListener('dragstart', onTabDragStart);
      btn.addEventListener('dragover', onTabDragOver);
      btn.addEventListener('drop', (ev)=> onTabDrop(ev, c));
    }
    const small = document.createElement('span');
    small.className = 'count';
    small.textContent = count.toString();
    btn.appendChild(small);
    btn.addEventListener('click', ()=> renderHome(c));
    tabsNav.appendChild(btn);
  });
}

function latestEntry(ex) {
  return [...ex.entries].sort((a,b)=>b.date.localeCompare(a.date))[0];
}

function renderHome(active='All') {
  renderTabs(active);
  appScreen.innerHTML = '';

  const container = document.createElement('div');
  const grouped = groupByCategory(state.exercises);
  const ordered = computeOrderedCategories().filter(c=>c!=='All');
  ordered.forEach((cat) => {
    if (active !== 'All' && active !== cat) return;
    const list = grouped[cat] || [];
    if (!list.length) return;
    const h = document.createElement('div');
    h.className = 'category-title';
    h.textContent = cat;
    container.appendChild(h);
    list.forEach((ex) => container.appendChild(renderExerciseCard(ex)) );
  });

  appScreen.appendChild(container);
}

function groupByCategory(items) {
  return items.reduce((acc, it)=>{ (acc[it.category] ||= []).push(it); return acc; }, {});
}

function renderExerciseCard(ex) {
  const tpl = $('#exercise-card-tpl');
  const node = tpl.content.firstElementChild.cloneNode(true);
  // Tag card with category class for styling (Figma left-border colors)
  try { node.classList.add(`cat-${String(ex.category || '').toLowerCase()}`); } catch {}
  // Keep category border color uniform via CSS; don't override per card
  $('.title', node).textContent = ex.name;
  const latest = latestEntry(ex);
  $('.summary .warmup', node).textContent = latest ? `${latest.warmup}kg` : '-';
  $('.summary .working', node).textContent = latest ? `${latest.working}kg` : '-';

  // Make whole card clickable
  node.addEventListener('click', () => renderDetail(ex.id));

  // Prevent navigation when clicking action buttons
  $('.open-detail', node).addEventListener('click', (e) => { e.stopPropagation(); renderDetail(ex.id); });
  $('.more', node).addEventListener('click', (e) => { e.stopPropagation(); openExerciseMenu(ex); });
  return node;
}

function renderDetail(exId) {
  const ex = state.exercises.find(e=>e.id===exId);
  if (!ex) return renderHome();
  appScreen.innerHTML = '';
  const tpl = $('#exercise-detail-tpl');
  const node = tpl.content.firstElementChild.cloneNode(true);
  $('.title', node).textContent = ex.name;
  $('.subtitle', node).textContent = ex.category;
  $('.back', node).addEventListener('click', ()=> renderHome('All'));
  $('.edit', node).addEventListener('click', ()=> openExerciseForm(ex));
  $('.add', node).addEventListener('click', ()=> openWorkoutForm(ex));

  const historyEl = $('.history', node);
  const sorted = [...ex.entries].sort((a,b)=>b.date.localeCompare(a.date));
  const display = sorted.slice(0, 4); // latest + three previous
  display.forEach((entry) => historyEl.appendChild(renderHistoryDay(ex, entry)));

  // Hide global header/nav when in detail screen
  document.querySelector('.app-header').style.display = 'none';
  document.querySelector('#categoryTabs').style.display = 'none';
  appScreen.appendChild(node);
}

function renderHistoryDay(ex, entry) {
  const tpl = $('#history-day-tpl');
  const node = tpl.content.firstElementChild.cloneNode(true);
  const dateEl = $('.date', node);
  $('.date-text', node).textContent = formatDate(entry.date);
  $('.warmup .weight', node).textContent = `${entry.warmup}kg`;
  $('.working .weight', node).textContent = `${entry.working}kg`;
  $('.edit', node).addEventListener('click', ()=> openWorkoutForm(ex, entry));
  $('.delete', node).addEventListener('click', ()=> deleteWorkout(ex.id, entry.id));

  // Make warmup and training tiles editable independently
  $('.set.warmup', node).addEventListener('click', () => openWeightQuickEdit(ex, entry, 'warmup'));
  $('.set.working', node).addEventListener('click', () => openWeightQuickEdit(ex, entry, 'working'));
  return node;
}

function formatDate(iso) {
  const [y,m,d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

// Modals
const modal = $('#modal');
const modalForm = $('#modalForm');

function openExerciseForm(exercise) {
  modalForm.innerHTML = '';
  const isEdit = !!exercise;
  modalForm.appendChild(buildModalHeader(isEdit ? 'Edit Exercise' : 'New Exercise'));
  const body = document.createElement('div');
  body.className = 'modal-body';
  body.innerHTML = `
    <div class="field">
      <label>Name</label>
      <input name="name" required value="${exercise?.name ?? ''}" />
    </div>
    <div class="field">
      <label>Category</label>
      <select name="category">
        ${['Biceps','Tricesp','Legs','Chest','Back','Shoulders'].map(c=>`<option ${exercise?.category===c?'selected':''}>${c}</option>`).join('')}
      </select>
    </div>`;
  modalForm.appendChild(body);
  const actions = document.createElement('div');
  actions.className = 'modal-actions';
  actions.innerHTML = `
    ${isEdit ? '<button class="btn danger" value="delete">Delete</button>' : ''}
    <button class="btn" value="cancel">Cancel</button>
    <button class="btn primary" value="ok">Save</button>`;
  modalForm.appendChild(actions);

  modal.showModal();
  modalForm.onsubmit = (e) => {
    const v = e.submitter?.value;
    if (v === 'cancel') return modal.close();
    if (v === 'delete' && exercise) { deleteExercise(exercise.id); modal.close(); return; }
    const formData = new FormData(modalForm);
    const name = String(formData.get('name')||'').trim();
    const category = String(formData.get('category'));
    if (!name) return;
    if (exercise) { exercise.name = name; exercise.category = category; }
    else { state.exercises.push({ id: uid(), name, category, entries: [] }); }
    saveData(state); modal.close(); renderHome(category==='All'? 'All': category);
  };
}

function buildModalHeader(title) {
  const h = document.createElement('div');
  h.className = 'section-title';
  h.style.margin = '16px';
  h.textContent = title;
  return h;
}

function openWorkoutForm(exercise, entry) {
  modalForm.innerHTML = '';
  const isEdit = !!entry;
  modalForm.appendChild(buildModalHeader(isEdit ? 'Edit Workout' : 'New Workout'));
  const body = document.createElement('div');
  body.className = 'modal-body';
  const today = new Date().toISOString().slice(0,10);
  body.innerHTML = `
    <div class="field">
      <label>Date</label>
      <input name="date" type="date" value="${entry?.date ?? today}" />
    </div>
    <div class="field">
      <label>Warmup weight (kg)</label>
      <input name="warmup" type="number" inputmode="numeric" value="${entry?.warmup ?? ''}" />
    </div>
    <div class="field">
      <label>Training weight (kg)</label>
      <input name="working" type="number" inputmode="numeric" value="${entry?.working ?? ''}" />
    </div>`;
  modalForm.appendChild(body);
  const actions = document.createElement('div');
  actions.className = 'modal-actions';
  actions.innerHTML = `
    ${isEdit ? '<button class=\"btn danger\" value=\"delete\">Delete</button>' : ''}
    <button class="btn" value="cancel">Cancel</button>
    <button class="btn primary" value="ok">Save</button>`;
  modalForm.appendChild(actions);
  modal.showModal();

  modalForm.onsubmit = (e) => {
    const v = e.submitter?.value;
    if (v==='cancel') return modal.close();
    if (v==='delete' && entry) { deleteWorkout(exercise.id, entry.id); modal.close(); return; }
    const fd = new FormData(modalForm);
    const data = {
      id: entry?.id ?? uid(),
      date: String(fd.get('date')),
      warmup: Number(fd.get('warmup')||0),
      working: Number(fd.get('working')||0),
    };
    if (entry) {
      Object.assign(entry, data);
    } else {
      exercise.entries.push(data);
    }
    saveData(state); modal.close(); renderDetail(exercise.id);
  }
}

function deleteExercise(id) {
  state.exercises = state.exercises.filter(e=>e.id!==id);
  saveData(state); renderHome('All');
}

function deleteWorkout(exId, entryId) {
  const ex = state.exercises.find(e=>e.id===exId);
  if (!ex) return;
  ex.entries = ex.entries.filter(en=>en.id!==entryId);
  saveData(state); renderDetail(exId);
}

function openExerciseMenu(ex) {
  openExerciseForm(ex);
}

function openWeightQuickEdit(exercise, entry, key) {
  const label = key === 'warmup' ? 'Warmup weight (kg)' : 'Training weight (kg)';
  modalForm.innerHTML = '';
  modalForm.appendChild(buildModalHeader(`Edit ${key === 'warmup' ? 'Warmup' : 'Training'}`));
  const body = document.createElement('div');
  body.className = 'modal-body';
  body.innerHTML = `
    <div class="field">
      <label>${label}</label>
      <input name="value" type="number" inputmode="numeric" value="${entry?.[key] ?? ''}" />
    </div>`;
  modalForm.appendChild(body);
  const actions = document.createElement('div');
  actions.className = 'modal-actions';
  actions.innerHTML = `
    <button class="btn" value="cancel">Cancel</button>
    <button class="btn primary" value="ok">Save</button>`;
  modalForm.appendChild(actions);
  modal.showModal();

  modalForm.onsubmit = (e) => {
    const v = e.submitter?.value;
    if (v==='cancel') return modal.close();
    const fd = new FormData(modalForm);
    const newValue = Number(fd.get('value')||0);
    if (Number.isFinite(newValue)) {
      entry[key] = newValue;
      saveData(state);
    }
    modal.close();
    renderDetail(exercise.id);
  };
}

const THEME_KEY = 'theme_pref_v1';

function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'dark') root.setAttribute('data-theme', 'dark');
  else root.removeAttribute('data-theme');
  const btn = document.getElementById('themeToggleBtn');
  if (btn) {
    const icon = btn.querySelector('.material-symbols-outlined');
    if (icon) icon.textContent = theme === 'dark' ? 'light_mode' : 'dark_mode';
  }
}

function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = saved || (prefersDark ? 'dark' : 'light');
  applyTheme(theme);
}

function setupThemeToggle() {
  const btn = document.getElementById('themeToggleBtn');
  if (!btn) return;
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const next = isDark ? 'light' : 'dark';
    localStorage.setItem(THEME_KEY, next);
    applyTheme(next);
  });
}

// Navigation state management
let currentScreen = 'home';
let currentCategory = 'All';

// Top-level add
$('#addExerciseBtn').addEventListener('click', ()=> openExerciseForm());
const settingsBtn = document.getElementById('settingsBtn');
const settingsMenu = document.getElementById('settingsMenu');
if (settingsBtn) settingsBtn.addEventListener('click', (e)=>{
  e.stopPropagation();
  if (settingsMenu) settingsMenu.style.display = settingsMenu.style.display === 'none' ? '' : 'none';
});
if (settingsMenu) {
  const hide = ()=> { if (settingsMenu) settingsMenu.style.display = 'none'; };
  document.addEventListener('click', hide);
  settingsMenu.addEventListener('click', (e)=> e.stopPropagation());
}
const menuExport = document.getElementById('menuExport');
if (menuExport) menuExport.addEventListener('click', ()=> { exportData(); if (settingsMenu) settingsMenu.style.display='none'; });
const menuExportClipboard = document.getElementById('menuExportClipboard');
if (menuExportClipboard) menuExportClipboard.addEventListener('click', ()=> { exportToClipboard(); if (settingsMenu) settingsMenu.style.display='none'; });
const menuImport = document.getElementById('menuImport');
if (menuImport) menuImport.addEventListener('click', ()=> { if (importFileInput) importFileInput.click(); });
if (importFileInput) importFileInput.addEventListener('change', (e)=>{
  const file = e.target?.files?.[0];
  if (file) importDataFromFile(file);
  if (importFileInput) importFileInput.value = '';
  if (settingsMenu) settingsMenu.style.display='none';
});

// Initialize theme
initTheme();
setupThemeToggle();

// Handle browser back/forward navigation
window.addEventListener('popstate', (event) => {
  if (event.state && event.state.screen === 'detail') {
    renderDetail(event.state.exerciseId);
  } else {
    renderHome(event.state?.category || 'All');
  }
});

// Start app rendering
function showGlobalChrome(show) {
  document.querySelector('.app-header').style.display = show ? '' : 'none';
  document.querySelector('#categoryTabs').style.display = show ? '' : 'none';
}

// Hook back button in detail to restore header/tabs
const origRenderHome = renderHome;
renderHome = function(active='All') {
  currentScreen = 'home';
  currentCategory = active;
  showGlobalChrome(true);
  
  // Update browser history
  const state = { screen: 'home', category: active };
  if (window.history.state?.screen !== 'home' || window.history.state?.category !== active) {
    window.history.pushState(state, '', window.location.pathname);
  }
  
  return origRenderHome(active);
}

// Hook detail rendering to update history
const origRenderDetail = renderDetail;
renderDetail = function(exId) {
  currentScreen = 'detail';
  showGlobalChrome(false);
  
  // Update browser history
  const state = { screen: 'detail', exerciseId: exId };
  window.history.pushState(state, '', window.location.pathname);
  
  return origRenderDetail(exId);
}

// Initialize with home screen
const initialState = { screen: 'home', category: 'All' };
window.history.replaceState(initialState, '', window.location.pathname);
renderHome('All');


