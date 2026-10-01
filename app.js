/* ===== STATE ===== */
let state = {
  subjects: [],
  planner: {},        // { "YYYY-MM-DD": [{subjectId, topicId, goalMin}] }
  timer: {
    running: false,
    paused: false,
    subjectId: null,
    topicId: null,
    seconds: 0,
    interval: null
  }
};

let currentPlannerDate = todayKey();
let pendingSubjectIdForTopic = null;
let selectedColor = '#6366f1';
let editSelectedColor = '#6366f1';

/* ===== PERSISTENCE ===== */
function save() {
  try { localStorage.setItem('studyflow_v2', JSON.stringify(state)); } catch(e) {}
}

function load() {
  try {
    const raw = localStorage.getItem('studyflow_v2');
    if (raw) state = JSON.parse(raw);
    // migration: ensure arrays
    if (!state.subjects) state.subjects = [];
    if (!state.planner) state.planner = {};
    if (!state.timer) state.timer = { running: false, paused: false, subjectId: null, topicId: null, seconds: 0, interval: null };
  } catch(e) {}
}

/* ===== HELPERS ===== */
function uid() { return Math.random().toString(36).slice(2,10) + Date.now().toString(36); }

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function formatDate(key) {
  const [y,m,d] = key.split('-');
  const date = new Date(y, m-1, d);
  return date.toLocaleDateString('en-US', { weekday:'long', month:'short', day:'numeric', year:'numeric' });
}

function fmtSecs(s) {
  const h = Math.floor(s/3600), m = Math.floor((s%3600)/60), sec = s%60;
  if (h > 0) return `${h}h ${String(m).padStart(2,'0')}m`;
  return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
}

function fmtSecsLong(s) {
  const h = Math.floor(s/3600), m = Math.floor((s%3600)/60), sec = s%60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
}

function getSubject(id) { return state.subjects.find(s => s.id === id); }
function getTopic(subjectId, topicId) {
  const sub = getSubject(subjectId);
  return sub ? sub.topics.find(t => t.id === topicId) : null;
}

function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2500);
}

function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

/* ===== GREETING ===== */
function setGreeting() {
  const h = new Date().getHours();
  const g = h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
  document.getElementById('timeGreeting').textContent = g;
}

/* ===== NAV ===== */
function setView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('view-'+name).classList.add('active');
  document.querySelector(`[data-view="${name}"]`).classList.add('active');
  document.getElementById('topbarTitle').textContent = {
    dashboard:'Dashboard', subjects:'Subjects & Topics', planner:'Study Planner', progress:'Progress'
  }[name];
  renderForView(name);
  // close on mobile
  if (window.innerWidth <= 640) {
    document.getElementById('sidebar').classList.remove('mobile-open');
  }
}

function renderForView(name) {
  if (name === 'dashboard') renderDashboard();
  if (name === 'subjects') renderSubjects();
  if (name === 'planner') renderPlanner();
  if (name === 'progress') renderProgress();
}

/* ===== SIDEBAR TOGGLE ===== */
document.getElementById('hamburger').addEventListener('click', () => {
  const sb = document.getElementById('sidebar');
  const mw = document.querySelector('.main-wrapper');
  if (window.innerWidth <= 640) {
    sb.classList.toggle('mobile-open');
  } else {
    sb.classList.toggle('collapsed');
    mw.classList.toggle('expanded');
  }
});

document.getElementById('sidebarToggle').addEventListener('click', () => {
  const sb = document.getElementById('sidebar');
  const mw = document.querySelector('.main-wrapper');
  if (window.innerWidth <= 640) {
    sb.classList.remove('mobile-open');
  } else {
    sb.classList.add('collapsed');
    mw.classList.add('expanded');
  }
});

/* ===== NAV ITEMS ===== */
document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => setView(btn.dataset.view));
});

/* ===== THEME ===== */
document.getElementById('themeToggle').addEventListener('click', () => {
  const dark = document.documentElement.getAttribute('data-theme') === 'dark';
  document.documentElement.setAttribute('data-theme', dark ? 'light' : 'dark');
  document.getElementById('themeToggle').textContent = dark ? '🌙' : '☀️';
  localStorage.setItem('studyflow_theme', dark ? 'light' : 'dark');
});

function loadTheme() {
  const t = localStorage.getItem('studyflow_theme') || 'light';
  document.documentElement.setAttribute('data-theme', t);
  document.getElementById('themeToggle').textContent = t === 'dark' ? '☀️' : '🌙';
}

/* ===== COLOR PICKER ===== */
function initColorPicker(pickerId, onSelect) {
  document.querySelectorAll(`#${pickerId} .color-dot`).forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll(`#${pickerId} .color-dot`).forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      onSelect(btn.dataset.color);
    });
  });
}

initColorPicker('colorPicker', c => selectedColor = c);
initColorPicker('editColorPicker', c => editSelectedColor = c);

/* ===== ADD SUBJECT ===== */
function openAddSubjectModal() {
  selectedColor = '#6366f1';
  document.getElementById('subjectNameInput').value = '';
  document.getElementById('subjectIconInput').value = '';
  document.querySelectorAll('#colorPicker .color-dot').forEach((b,i) => b.classList.toggle('active', i===0));
  openModal('addSubjectModal');
  document.getElementById('subjectNameInput').focus();
}

document.getElementById('openAddSubject').addEventListener('click', openAddSubjectModal);
document.getElementById('openAddSubject2').addEventListener('click', openAddSubjectModal);

function saveSubject() {
  const name = document.getElementById('subjectNameInput').value.trim();
  if (!name) { toast('Enter a subject name!'); return; }
  const icon = document.getElementById('subjectIconInput').value.trim() || '📖';
  state.subjects.push({ id: uid(), name, color: selectedColor, icon, topics: [] });
  save();
  closeModal('addSubjectModal');
  renderAll();
  toast(`"${name}" added!`);
}

/* ===== EDIT SUBJECT ===== */
function openEditSubject(id) {
  const s = getSubject(id);
  if (!s) return;
  document.getElementById('editSubjectId').value = id;
  document.getElementById('editSubjectName').value = s.name;
  document.getElementById('editSubjectIcon').value = s.icon || '📖';
  editSelectedColor = s.color || '#6366f1';
  document.querySelectorAll('#editColorPicker .color-dot').forEach(b => {
    b.classList.toggle('active', b.dataset.color === editSelectedColor);
  });
  openModal('editSubjectModal');
}

function updateSubject() {
  const id = document.getElementById('editSubjectId').value;
  const s = getSubject(id);
  if (!s) return;
  s.name = document.getElementById('editSubjectName').value.trim() || s.name;
  s.icon = document.getElementById('editSubjectIcon').value.trim() || s.icon;
  s.color = editSelectedColor;
  save(); closeModal('editSubjectModal'); renderAll();
  toast('Subject updated!');
}

function deleteSubject() {
  const id = document.getElementById('editSubjectId').value;
  if (!confirm('Delete this subject and all its topics?')) return;
  state.subjects = state.subjects.filter(s => s.id !== id);
  // remove planner entries
  Object.keys(state.planner).forEach(day => {
    state.planner[day] = state.planner[day].filter(e => e.subjectId !== id);
  });
  save(); closeModal('editSubjectModal'); renderAll();
  toast('Subject deleted.');
}

/* ===== ADD TOPIC ===== */
function openAddTopicModal(subjectId) {
  pendingSubjectIdForTopic = subjectId;
  document.getElementById('topicNameInput').value = '';
  document.getElementById('topicDescInput').value = '';
  document.getElementById('topicPriorityInput').value = 'medium';
  openModal('addTopicModal');
  document.getElementById('topicNameInput').focus();
}

function saveTopic() {
  const name = document.getElementById('topicNameInput').value.trim();
  if (!name) { toast('Enter a topic name!'); return; }
  const sub = getSubject(pendingSubjectIdForTopic);
  if (!sub) return;
  sub.topics.push({
    id: uid(),
    name,
    desc: document.getElementById('topicDescInput').value.trim(),
    priority: document.getElementById('topicPriorityInput').value,
    done: false,
    timeSpent: 0   // seconds
  });
  save(); closeModal('addTopicModal'); renderAll();
  toast(`Topic "${name}" added!`);
}

function deleteTopic(subjectId, topicId) {
  const sub = getSubject(subjectId);
  if (!sub) return;
  sub.topics = sub.topics.filter(t => t.id !== topicId);
  save(); renderAll();
  toast('Topic removed.');
}

function toggleTopicDone(subjectId, topicId) {
  const t = getTopic(subjectId, topicId);
  if (!t) return;
  t.done = !t.done;
  save(); renderAll();
}

/* ===== TIMER ===== */
let timerInterval = null;

function startGlobalTimer() {
  if (!state.timer.subjectId) { toast('Select a topic first!'); return; }
  if (state.timer.running) return;
  state.timer.running = true;
  state.timer.paused = false;
  timerInterval = setInterval(tickTimer, 1000);
  updateTimerUI();
}

function pauseGlobalTimer() {
  if (!state.timer.running) return;
  clearInterval(timerInterval); timerInterval = null;
  state.timer.running = false;
  state.timer.paused = true;
  updateTimerUI();
}

function stopGlobalTimer() {
  if (state.timer.seconds > 0 && state.timer.subjectId && state.timer.topicId) {
    const t = getTopic(state.timer.subjectId, state.timer.topicId);
    if (t) { t.timeSpent = (t.timeSpent || 0) + state.timer.seconds; }
    save();
  }
  clearInterval(timerInterval); timerInterval = null;
  state.timer.running = false;
  state.timer.paused = false;
  state.timer.seconds = 0;
  state.timer.subjectId = null;
  state.timer.topicId = null;
  updateTimerUI();
  renderAll();
  toast('Session saved!');
}

function tickTimer() {
  state.timer.seconds++;
  updateTimerUI();
}

function updateTimerUI() {
  const display = fmtSecsLong(state.timer.seconds);
  document.getElementById('bigTimer').textContent = display;
  
  const badge = document.getElementById('globalTimerBadge');
  document.getElementById('globalTimerDisplay').textContent = fmtSecs(state.timer.seconds);

  const startBtn = document.getElementById('timerStartBtn');
  const pauseBtn = document.getElementById('timerPauseBtn');
  const stopBtn = document.getElementById('timerStopBtn');

  if (state.timer.running) {
    startBtn.style.display = 'none';
    pauseBtn.style.display = '';
    stopBtn.style.display = '';
    badge.style.display = 'flex';
  } else if (state.timer.paused) {
    startBtn.style.display = '';
    startBtn.textContent = '▶ Resume';
    pauseBtn.style.display = 'none';
    stopBtn.style.display = '';
    badge.style.display = 'flex';
  } else {
    startBtn.style.display = '';
    startBtn.textContent = '▶ Start';
    pauseBtn.style.display = 'none';
    stopBtn.style.display = 'none';
    badge.style.display = 'none';
  }

  const sub = getSubject(state.timer.subjectId);
  const top = getTopic(state.timer.subjectId, state.timer.topicId);
  document.getElementById('activeSubjectName').textContent = sub ? sub.name.toUpperCase() : '—';
  document.getElementById('activeTopicName').textContent = top ? top.name : 'No session running';
  document.getElementById('globalTimerLabel').textContent = top ? top.name.slice(0,18) : '';
}

function startTopicTimer(subjectId, topicId) {
  if (state.timer.running || state.timer.paused) {
    if (!confirm('A timer is already running. Stop it and start a new one?')) return;
    stopGlobalTimer();
  }
  state.timer.subjectId = subjectId;
  state.timer.topicId = topicId;
  state.timer.seconds = 0;
  state.timer.running = false;
  state.timer.paused = false;
  // Switch to dashboard
  setView('dashboard');
  updateTimerUI();
  startGlobalTimer();
}

/* ===== RENDER SIDEBAR SUBJECTS ===== */
function renderSidebarSubjects() {
  const el = document.getElementById('subjectList');
  el.innerHTML = '';
  if (!state.subjects.length) {
    el.innerHTML = '<p class="sidebar-label" style="margin-top:.5rem;font-size:.72rem">No subjects yet</p>';
    return;
  }
  state.subjects.forEach(s => {
    const btn = document.createElement('button');
    btn.className = 'subject-nav-item';
    btn.innerHTML = `<span class="subject-nav-dot" style="background:${s.color}"></span>${s.icon || '📖'} ${s.name}`;
    btn.addEventListener('click', () => setView('subjects'));
    el.appendChild(btn);
  });
}

/* ===== RENDER DASHBOARD ===== */
function renderDashboard() {
  // Stats
  const totalTopics = state.subjects.reduce((a,s) => a + s.topics.length, 0);
  const doneTopics = state.subjects.reduce((a,s) => a + s.topics.filter(t=>t.done).length, 0);
  const pct = totalTopics ? Math.round(doneTopics/totalTopics*100) : 0;
  const totalSecs = state.subjects.reduce((a,s) => a + s.topics.reduce((b,t) => b + (t.timeSpent||0), 0), 0);
  const totalHours = (totalSecs/3600).toFixed(1);

  document.getElementById('statSubjects').textContent = state.subjects.length;
  document.getElementById('statTopics').textContent = totalTopics;
  document.getElementById('statDone').textContent = pct + '%';
  document.getElementById('statTime').textContent = totalHours + 'h';

  // Streak (count consecutive days with planner entries)
  let streak = 0;
  const td = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(td); d.setDate(d.getDate() - i);
    const k = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    if (state.planner[k] && state.planner[k].length > 0) streak++;
    else if (i > 0) break;
  }
  document.getElementById('streakCount').textContent = `${streak} day streak`;

  // Today topics
  const todayEl = document.getElementById('todayTopics');
  const todayEntries = (state.planner[todayKey()] || []);
  if (!todayEntries.length) {
    todayEl.innerHTML = '<p class="empty-msg">No topics scheduled today.<br>Go to <b>Planner</b> to add some.</p>';
  } else {
    todayEl.innerHTML = '';
    todayEntries.forEach(entry => {
      const sub = getSubject(entry.subjectId);
      const top = getTopic(entry.subjectId, entry.topicId);
      if (!sub || !top) return;
      const div = document.createElement('div');
      div.className = 'today-entry' + (top.done ? ' done' : '');
      div.style.borderLeftColor = sub.color;
      div.innerHTML = `
        <div class="today-entry-info">
          <div class="today-entry-name">${top.name}</div>
          <div class="today-entry-subject">${sub.icon} ${sub.name}</div>
        </div>
        <div class="today-entry-time">Goal: ${entry.goalMin}m</div>
      `;
      div.addEventListener('click', () => {
        if (!top.done) startTopicTimer(entry.subjectId, entry.topicId);
      });
      todayEl.appendChild(div);
    });
  }

  // Subject overview cards
  const socEl = document.getElementById('dashSubjectCards');
  if (!state.subjects.length) {
    socEl.innerHTML = '<p class="empty-msg">Add subjects from the sidebar to get started.</p>';
  } else {
    socEl.innerHTML = '';
    state.subjects.forEach(s => {
      const done = s.topics.filter(t=>t.done).length;
      const total = s.topics.length;
      const p = total ? Math.round(done/total*100) : 0;
      const card = document.createElement('div');
      card.className = 'subject-overview-card';
      card.innerHTML = `
        <div class="soc-icon">${s.icon || '📖'}</div>
        <div class="soc-name">${s.name}</div>
        <div class="soc-bar-bg"><div class="soc-bar-fill" style="width:${p}%;background:${s.color}"></div></div>
        <div class="soc-stats">${done}/${total} topics · ${p}%</div>
      `;
      card.addEventListener('click', () => setView('subjects'));
      socEl.appendChild(card);
    });
  }

  updateTimerUI();
}

/* ===== RENDER SUBJECTS ===== */
function renderSubjects() {
  const container = document.getElementById('subjectsContainer');
  const empty = document.getElementById('subjectsEmpty');
  container.innerHTML = '';

  if (!state.subjects.length) {
    empty.style.display = '';
    return;
  }
  empty.style.display = 'none';

  state.subjects.forEach(sub => {
    const done = sub.topics.filter(t=>t.done).length;
    const total = sub.topics.length;
    const pct = total ? Math.round(done/total*100) : 0;
    const totalTime = sub.topics.reduce((a,t) => a + (t.timeSpent||0), 0);

    const card = document.createElement('div');
    card.className = 'subject-card';
    card.innerHTML = `
      <div class="subject-card-header">
        <div class="subject-card-color-bar" style="background:${sub.color}"></div>
        <div class="subject-card-icon">${sub.icon || '📖'}</div>
        <div class="subject-card-info">
          <div class="subject-card-name">${sub.name}</div>
          <div class="subject-card-meta">${total} topics · ${fmtSecs(totalTime)} studied</div>
        </div>
        <div class="subject-card-actions">
          <button class="btn-sm edit">✏️ Edit</button>
          <button class="btn-sm add-topic">+ Topic</button>
        </div>
      </div>
      <div class="subject-card-progress">
        <div class="progress-bar-bg"><div class="progress-bar-fill" style="width:${pct}%;background:${sub.color}"></div></div>
        <span class="progress-pct" style="color:${sub.color}">${pct}%</span>
      </div>
      <div class="topics-list" id="topics-${sub.id}"></div>
      <div class="add-topic-btn-row">
        <button class="btn-sm add-topic" style="font-size:.82rem;padding:.45rem 1rem">+ Add Topic</button>
      </div>
    `;

    card.querySelectorAll('.btn-sm.edit').forEach(btn => btn.addEventListener('click', e => { e.stopPropagation(); openEditSubject(sub.id); }));
    card.querySelectorAll('.btn-sm.add-topic').forEach(btn => btn.addEventListener('click', e => { e.stopPropagation(); openAddTopicModal(sub.id); }));

    // Topics
    const topicsEl = card.querySelector(`#topics-${sub.id}`);
    if (!sub.topics.length) {
      topicsEl.innerHTML = '<p class="empty-msg" style="padding:.5rem 0">No topics yet. Add your first topic!</p>';
    } else {
      sub.topics.forEach(t => {
        const isRunning = state.timer.running && state.timer.topicId === t.id;
        const row = document.createElement('div');
        row.className = 'topic-row' + (t.done ? ' done' : '');
        row.innerHTML = `
          <div class="topic-check ${t.done ? 'checked' : ''}" title="Mark complete">
            ${t.done ? '✓' : ''}
          </div>
          <div class="topic-info">
            <div class="topic-name">${t.name}</div>
            ${t.desc ? `<div class="topic-desc">${t.desc}</div>` : ''}
            <div class="topic-meta">
              <span class="priority-badge priority-${t.priority}">${{high:'🔴 High',medium:'🟡 Med',low:'🟢 Low'}[t.priority]}</span>
              ${t.timeSpent ? `<span class="topic-time">⏱ ${fmtSecs(t.timeSpent)}</span>` : ''}
            </div>
          </div>
          <div class="topic-actions-row">
            <button class="btn-topic-timer ${isRunning ? 'running' : ''}" title="Start timer">
              ${isRunning ? '⏸ Running' : '▶ Start'}
            </button>
            <button class="btn-topic-action delete-topic" title="Delete topic">🗑</button>
          </div>
        `;

        row.querySelector('.topic-check').addEventListener('click', e => {
          e.stopPropagation(); toggleTopicDone(sub.id, t.id);
        });

        row.querySelector('.btn-topic-timer').addEventListener('click', e => {
          e.stopPropagation();
          if (isRunning) { pauseGlobalTimer(); renderSubjects(); }
          else startTopicTimer(sub.id, t.id);
        });

        row.querySelector('.delete-topic').addEventListener('click', e => {
          e.stopPropagation();
          if (confirm(`Delete topic "${t.name}"?`)) deleteTopic(sub.id, t.id);
        });

        topicsEl.appendChild(row);
      });
    }

    container.appendChild(card);
  });
}

/* ===== RENDER PLANNER ===== */
function renderPlanner() {
  document.getElementById('plannerDate').textContent = formatDate(currentPlannerDate);

  // Populate subject select
  const subSel = document.getElementById('plannerSubjectSelect');
  const prevSubVal = subSel.value;
  subSel.innerHTML = '<option value="">— choose subject —</option>';
  state.subjects.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.id; opt.textContent = `${s.icon} ${s.name}`;
    subSel.appendChild(opt);
  });
  if (prevSubVal) { subSel.value = prevSubVal; populatePlannerTopics(); }

  // Entries
  const entries = state.planner[currentPlannerDate] || [];
  const el = document.getElementById('plannerEntries');
  if (!entries.length) {
    el.innerHTML = '<p class="empty-msg">Nothing scheduled for this day.</p>';
  } else {
    el.innerHTML = '';
    entries.forEach((entry, idx) => {
      const sub = getSubject(entry.subjectId);
      const top = getTopic(entry.subjectId, entry.topicId);
      if (!sub || !top) return;
      const row = document.createElement('div');
      row.className = 'planner-entry';
      row.innerHTML = `
        <div class="planner-entry-color" style="background:${sub.color}"></div>
        <div class="planner-entry-info">
          <div class="planner-entry-name">${top.name}</div>
          <div class="planner-entry-subject">${sub.icon} ${sub.name}</div>
          <div class="planner-entry-goal">Goal: ${entry.goalMin} min</div>
        </div>
        <button class="btn-delete-entry" title="Remove">✕</button>
      `;
      row.querySelector('.btn-delete-entry').addEventListener('click', () => {
        state.planner[currentPlannerDate].splice(idx, 1);
        save(); renderPlanner(); renderDashboard();
      });
      el.appendChild(row);
    });
  }
}

function populatePlannerTopics() {
  const subId = document.getElementById('plannerSubjectSelect').value;
  const topSel = document.getElementById('plannerTopicSelect');
  topSel.innerHTML = '<option value="">— choose topic —</option>';
  if (!subId) return;
  const sub = getSubject(subId);
  if (!sub) return;
  sub.topics.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t.id;
    opt.textContent = (t.done ? '✓ ' : '') + t.name;
    topSel.appendChild(opt);
  });
}

document.getElementById('plannerSubjectSelect').addEventListener('change', populatePlannerTopics);

function addPlannerEntry() {
  const subId = document.getElementById('plannerSubjectSelect').value;
  const topId = document.getElementById('plannerTopicSelect').value;
  const goalMin = parseInt(document.getElementById('plannerGoalMin').value) || 30;
  if (!subId || !topId) { toast('Select a subject and topic first!'); return; }
  if (!state.planner[currentPlannerDate]) state.planner[currentPlannerDate] = [];
  // avoid duplicate
  if (state.planner[currentPlannerDate].find(e => e.topicId === topId)) {
    toast('Topic already in this day!'); return;
  }
  state.planner[currentPlannerDate].push({ subjectId: subId, topicId: topId, goalMin });
  save(); renderPlanner(); renderDashboard();
  toast('Added to plan!');
  document.getElementById('plannerGoalMin').value = '';
}

function changeDay(delta) {
  const [y,m,d] = currentPlannerDate.split('-').map(Number);
  const date = new Date(y, m-1, d);
  date.setDate(date.getDate() + delta);
  currentPlannerDate = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  renderPlanner();
}

/* ===== RENDER PROGRESS ===== */
function renderProgress() {
  const container = document.getElementById('progressContainer');
  const empty = document.getElementById('progressEmpty');
  container.innerHTML = '';

  if (!state.subjects.length) {
    empty.style.display = '';
    return;
  }
  empty.style.display = 'none';

  state.subjects.forEach(sub => {
    const done = sub.topics.filter(t=>t.done).length;
    const total = sub.topics.length;
    const pct = total ? Math.round(done/total*100) : 0;

    const block = document.createElement('div');
    block.className = 'progress-subject-block';
    block.innerHTML = `
      <div class="psb-header">
        <span class="psb-icon">${sub.icon||'📖'}</span>
        <span class="psb-name">${sub.name}</span>
        <span class="psb-pct" style="color:${sub.color}">${pct}%</span>
      </div>
      <div class="psb-bar-wrap">
        <div class="psb-bar-bg"><div class="psb-bar-fill" style="width:${pct}%;background:${sub.color}"></div></div>
      </div>
      <div class="psb-topics" id="ptopics-${sub.id}"></div>
    `;

    const topicsEl = block.querySelector(`#ptopics-${sub.id}`);
    if (!sub.topics.length) {
      topicsEl.innerHTML = '<p class="empty-msg">No topics added yet.</p>';
    } else {
      sub.topics.forEach(t => {
        const row = document.createElement('div');
        row.className = 'psb-topic-row' + (t.done ? ' done' : '');
        row.innerHTML = `
          <div class="psb-topic-check ${t.done ? 'yes' : 'no'}">${t.done ? '✓' : ''}</div>
          <span class="psb-topic-name">${t.name}</span>
          <span class="psb-topic-time">${t.timeSpent ? '⏱ ' + fmtSecs(t.timeSpent) : 'Not studied'}</span>
        `;
        topicsEl.appendChild(row);
      });
    }

    container.appendChild(block);
  });
}

/* ===== RENDER ALL ===== */
function renderAll() {
  renderSidebarSubjects();
  renderDashboard();
  const active = document.querySelector('.view.active');
  if (active) {
    const id = active.id.replace('view-','');
    if (id === 'subjects') renderSubjects();
    if (id === 'planner') renderPlanner();
    if (id === 'progress') renderProgress();
  }
}

/* ===== CLOSE MODALS ON OVERLAY CLICK ===== */
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target === overlay) overlay.classList.remove('open');
  });
});

/* ===== KEYBOARD SHORTCUTS ===== */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
  }
  if (e.ctrlKey || e.metaKey) {
    if (e.key === '1') { e.preventDefault(); setView('dashboard'); }
    if (e.key === '2') { e.preventDefault(); setView('subjects'); }
    if (e.key === '3') { e.preventDefault(); setView('planner'); }
    if (e.key === '4') { e.preventDefault(); setView('progress'); }
  }
});

/* ===== ENTER KEY FOR MODALS ===== */
document.getElementById('subjectNameInput').addEventListener('keydown', e => { if (e.key === 'Enter') saveSubject(); });
document.getElementById('topicNameInput').addEventListener('keydown', e => { if (e.key === 'Enter') saveTopic(); });

/* ===== INIT ===== */
load();
loadTheme();
setGreeting();
renderAll();
document.getElementById('plannerDate').textContent = formatDate(currentPlannerDate);
updateTimerUI();
