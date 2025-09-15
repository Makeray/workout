// Storage and state
const STORAGE_KEY = 'workout_diary_v1';

/** @typedef {{ id:string, name:string, category:'Arms'|'Legs'|'Chest'|'Back'|'Shoulders', entries: WorkoutEntry[] }} Exercise */
/** @typedef {{ id:string, date:string, warmup:number, working:number }} WorkoutEntry */

const Categories = ['All','Arms','Legs','Chest','Shoulders','Back'];

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

function createSeed() {
  const today = new Date();
  const daysAgo = (n) => new Date(today.getFullYear(), today.getMonth(), today.getDate() - n);
  const fmt = (dt) => dt.toISOString().slice(0,10);
  const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

  /** Sample exercise names per category */
  const sampleNamesByCategory = {
    Arms: ['Biceps Curl', 'Triceps Pushdown', 'Hammer Curl', 'EZ-Bar Curl', 'Cable Curl'],
    Legs: ['Squat', 'Leg Press', 'Lunges', 'Romanian Deadlift', 'Leg Extension'],
    Chest: ['Bench Press', 'Incline Dumbbell Press', 'Chest Fly', 'Cable Crossover', 'Push-up'],
    Back: ['Lat Pulldown', 'Seated Row', 'Deadlift', 'Pull-up', 'T-Bar Row'],
    Shoulders: ['Overhead Press', 'Lateral Raise', 'Front Raise', 'Rear Delt Fly', 'Arnold Press']
  };

  const exercises = [];
  // Generate 1–2 unique exercises per category
  ;['Arms','Legs','Chest','Back','Shoulders'].forEach((category) => {
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

// UI helpers
const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

const appScreen = $('#screen');
const tabsNav = $('#categoryTabs');

function renderTabs(active='All') {
  tabsNav.innerHTML = '';
  Categories.forEach((c) => {
    const count = c === 'All' ? state.exercises.length : state.exercises.filter(e=>e.category===c).length;
    const btn = document.createElement('button');
    btn.className = 'tab' + (c===active ? ' active':'');
    btn.textContent = c;
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
  const cats = ['Arms','Legs','Chest','Back','Shoulders'];
  cats.forEach((cat) => {
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
        ${['Arms','Legs','Chest','Back','Shoulders'].map(c=>`<option ${exercise?.category===c?'selected':''}>${c}</option>`).join('')}
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

// Top-level add
$('#addExerciseBtn').addEventListener('click', ()=> openExerciseForm());

// Initialize theme
initTheme();
setupThemeToggle();

// Start app rendering
function showGlobalChrome(show) {
  document.querySelector('.app-header').style.display = show ? '' : 'none';
  document.querySelector('#categoryTabs').style.display = show ? '' : 'none';
}

// Hook back button in detail to restore header/tabs
const origRenderHome = renderHome;
renderHome = function(active='All') {
  showGlobalChrome(true);
  return origRenderHome(active);
}

renderHome('All');


