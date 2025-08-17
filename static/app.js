let state = { habits: [], today: "", selected: null, viewYear: null, viewMonth: null, entries: [], allTags: [] };
let metricsHabitId = null;

function parseTags(str){
  if (!str) return [];
  const out = []; const seen = new Set();
  for (let raw of str.split(',')){
    const t = raw.trim(); if (!t) continue;
    const key = t.toLowerCase(); if (!seen.has(key)){ seen.add(key); out.push(t); }
  }
  return out;
}

async function fetchAllTags(){
  const r = await fetch('/api/tags'); if (r.ok) state.allTags = await r.json();
}

async function fetchData(){
  const r = await fetch('/api/data');
  if (r.status === 401) { location.href = '/login'; return; }
  const data = await r.json();
  state.habits = data.habits || []; state.today = data.today;
  const t = new Date(state.today);
  if (state.viewYear === null) { state.viewYear = t.getFullYear(); }
  if (state.viewMonth === null) { state.viewMonth = t.getMonth(); }
  if (!state.selected) state.selected = state.today;
  await fetchAllTags(); await loadEntries(); render();
}

async function loadEntries(){
  const r = await fetch('/api/media/list?date=' + encodeURIComponent(state.selected));
  if (r.ok){ state.entries = await r.json(); } else { state.entries = []; }
}

function ymd(d){ return d.toISOString().slice(0,10); }
function startOfMonth(y, m){ return new Date(y, m, 1); }
function endOfMonth(y, m){ return new Date(y, m+1, 0); }

function shiftMonth(n){
  state.viewMonth += n;
  if (state.viewMonth < 0) { state.viewMonth += 12; state.viewYear--; }
  if (state.viewMonth > 11) { state.viewMonth -= 12; state.viewYear++; }
  renderCalendar();
}

function goToday(){
  const t = new Date(state.today);
  state.viewYear = t.getFullYear(); state.viewMonth = t.getMonth(); state.selected = state.today;
  fetchData();
}

function setSelected(dateStr){ state.selected = dateStr; fetchData(); }

function renderCalendar(){
  const monthLabel = document.getElementById('monthLabel');
  const calendar = document.getElementById('calendar');
  const monthStart = startOfMonth(state.viewYear, state.viewMonth);
  const monthEnd = endOfMonth(state.viewYear, state.viewMonth);
  const startWeekday = (new Date(state.viewYear, state.viewMonth, 1).getDay() + 6) % 7;
  const totalDays = monthEnd.getDate();

  monthLabel.textContent = monthStart.toLocaleString(undefined, { month:'long', year:'numeric' });

  let html = '';
  const weekNames = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  for (const w of weekNames) html += `<div class="cal-head">${w}</div>`;

  const prevMonth = new Date(state.viewYear, state.viewMonth, 0);
  const prevDays = prevMonth.getDate();

  for (let i = 0; i < startWeekday; i++){
    const day = prevDays - startWeekday + 1 + i;
    const dt = new Date(state.viewYear, state.viewMonth-1, day);
    html += dayCellHTML(dt, true);
  }
  for (let d = 1; d <= totalDays; d++){
    const dt = new Date(state.viewYear, state.viewMonth, d);
    html += dayCellHTML(dt, false);
  }
  const cellsSoFar = 7 + startWeekday + totalDays;
  const remainder = cellsSoFar % 7;
  const add = remainder === 0 ? 0 : 7 - remainder;
  for (let i = 1; i <= add; i++){
    const dt = new Date(state.viewYear, state.viewMonth+1, i);
    html += dayCellHTML(dt, true);
  }
  calendar.innerHTML = html;

  [...calendar.querySelectorAll('.cal-cell')].forEach(cell => {
    cell.addEventListener('click', () => setSelected(cell.dataset.date));
  });

  document.getElementById('selectedDate').textContent = state.selected;
}

function dayCellHTML(dt, otherMonth){
  const dateStr = ymd(dt);
  const isToday = (dateStr === state.today);
  const isSelected = (dateStr === state.selected);
  return `<div class="cal-cell ${otherMonth?'other':''} ${isToday?'today':''} ${isSelected?'selected':''}" data-date="${dateStr}">
    <div class="date">${dt.getDate()}</div>
  </div>`;
}

function tagBadges(tags){
  if (!tags || !tags.length) return '<span class="muted">no tags</span>';
  return tags.map(t => `<span class="tag">${t}</span>`).join(' ');
}

function renderHabits(){
  const wrap = document.getElementById('habits');
  if (!state.habits.length){
    wrap.innerHTML = '<div class="muted">No habits yet. Add one with the button above.</div>';
    return;
  }
  let html = '';
  for (const h of state.habits){
    const rec = (h.records||{})[state.selected];
    const done = (typeof rec === 'boolean') ? rec : (rec && rec.done);
    const badge = h.kind === 'checkbox'
      ? (done ? 'Done' : 'Not done')
      : (rec && rec.metrics
          ? `${rec.metrics.timeMin||0} min • ${rec.metrics.distanceKm||0} km`
          : '—');

    const tags = h.tags || [];
    html += `<div class="card">
      <div class="row">
        <div class="badge" style="border-color:${h.color}">${h.name}</div>
        <div class="muted">(${h.kind})</div>
        <div class="spacer"></div>
        <div class="muted">${badge}</div>
      </div>
      <div class="mt">${tagBadges(tags)}</div>
      <div class="row mt">
        <input class="grow" type="text" placeholder="add tags (comma separated)" value="${tags.join(', ')}" data-habit-tags="${h.id}">
        <button class="btn" data-act="saveHabitTags" data-id="${h.id}">Save tags</button>
      </div>
      <div class="actions">
        ${h.kind === 'checkbox'
          ? `<button class="btn" data-act="toggle" data-id="${h.id}">Toggle</button>`
          : `<button class="btn" data-act="metrics" data-id="${h.id}">Enter values</button>
             <button class="btn" data-act="clear" data-id="${h.id}">Clear</button>`}
        <button class="btn" data-act="delete" data-id="${h.id}">Delete</button>
      </div>
    </div>`;
  }
  wrap.innerHTML = html;

  wrap.querySelectorAll('[data-act="toggle"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      await fetch('/api/toggle', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ id: btn.dataset.id, date: state.selected }) });
      fetchData();
    });
  });
  wrap.querySelectorAll('[data-act="metrics"]').forEach(btn => {
    btn.addEventListener('click', () => {
      metricsHabitId = btn.dataset.id;
      const h = state.habits.find(x => x.id == metricsHabitId);
      const rec = (h.records||{})[state.selected];
      document.getElementById('metricTime').value = rec && rec.metrics ? (rec.metrics.timeMin||'') : '';
      document.getElementById('metricDistance').value = rec && rec.metrics ? (rec.metrics.distanceKm||'') : '';
      document.getElementById('metricsTitle').textContent = `${h.name} • ${state.selected}`;
      document.getElementById('metricsModal').classList.add('show');
    });
  });
  wrap.querySelectorAll('[data-act="clear"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      await fetch('/api/clear', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ id: btn.dataset.id, date: state.selected }) });
      fetchData();
    });
  });
  wrap.querySelectorAll('[data-act="delete"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this habit?')) return;
      await fetch('/api/habits/delete', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ id: btn.dataset.id }) });
      fetchData();
    });
  });
  wrap.querySelectorAll('[data-act="saveHabitTags"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const input = document.querySelector(`[data-habit-tags="${btn.dataset.id}"]`);
      const tags = parseTags(input.value);
      await fetch('/api/habits/tags', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id: btn.dataset.id, tags }) });
      fetchData();
    });
  });
}

function renderEntries(){
  const wrap = document.getElementById('entries');
  if (!state.entries.length){
    wrap.innerHTML = '<div class="muted">No entries for this day yet.</div>';
    return;
  }
  let html = '';
  for (const e of state.entries){
    const checked = e.checked ? 'checked' : '';
    const rating = (e.rating ?? '') + '';
    const tags = e.tags || [];
    html += `<div class="entry" data-id="${e.id}">
      <input type="checkbox" data-act="toggle" ${checked}>
      <input class="grow" type="text" data-act="text" value="${e.text.replace(/"/g,'&quot;')}">
      <input class="grow" type="text" data-act="link" placeholder="link" value="${e.link || ''}">
      <input type="text" data-act="category" placeholder="category" value="${e.category || ''}" style="width:120px">
      <label>Rating</label>
      <select data-act="rating" style="width:80px">
        <option value="" ${rating===''?'selected':''}>(none)</option>
        ${[0,1,2,3,4,5].map(n => `<option value="${n}" ${rating===(n+'')?'selected':''}>${n}</option>`).join('')}
      </select>
      <input class="grow" type="text" data-act="tags" placeholder="tags (comma separated)" value="${tags.join(', ')}">
      <button class="btn" data-act="save">Save</button>
      <button class="btn" data-act="delete">Delete</button>
    </div>`;
  }
  wrap.innerHTML = html;

  wrap.querySelectorAll('.entry').forEach(row => {
    const id = row.dataset.id;
    row.querySelector('[data-act="toggle"]').addEventListener('change', async (ev) => {
      await fetch('/api/media/update', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id, checked: ev.target.checked }) });
    });
    row.querySelector('[data-act="save"]').addEventListener('click', async () => {
      const text = row.querySelector('[data-act="text"]').value;
      const link = row.querySelector('[data-act="link"]').value;
      const category = row.querySelector('[data-act="category"]').value;
      const ratingSel = row.querySelector('[data-act="rating"]');
      const rating = ratingSel.value === '' ? null : Number(ratingSel.value);
      const tags = parseTags(row.querySelector('[data-act="tags"]').value);
      await fetch('/api/media/update', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id, text, link, category, rating, tags }) });
      await loadEntries(); renderEntries();
    });
    row.querySelector('[data-act="delete"]').addEventListener('click', async () => {
      if (!confirm('Delete this entry?')) return;
      await fetch('/api/media/delete', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id }) });
      await loadEntries(); renderEntries();
    });
  });
}

function openAddModal(){ document.getElementById('addModal').classList.add('show'); }
function closeAddModal(){ document.getElementById('addModal').classList.remove('show'); }
async function addHabit(){
  const name = document.getElementById('habitName').value.trim();
  const color = document.getElementById('habitColor').value;
  const kind = [...document.getElementsByName('habitKind')].find(r => r.checked)?.value || 'checkbox';
  const tags = parseTags(document.getElementById('habitTags').value);
  if (!name) return;
  await fetch('/api/habits/add', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ name, color, kind, tags }) });
  closeAddModal(); fetchData();
}

async function addEntry(){
  const text = document.getElementById('entryText').value.trim();
  const link = document.getElementById('entryLink').value.trim();
  const category = document.getElementById('entryCategory').value.trim();
  const checked = document.getElementById('entryChecked').checked;
  const ratingStr = document.getElementById('entryRating').value;
  const rating = ratingStr === '' ? null : Number(ratingStr);
  const tags = parseTags(document.getElementById('entryTags').value);
  if (!text) return;
  await fetch('/api/media/add', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ date: state.selected, text, link, category, checked, rating, tags }) });
  document.getElementById('entryText').value=''; document.getElementById('entryLink').value='';
  document.getElementById('entryChecked').checked=false; document.getElementById('entryRating').value=''; document.getElementById('entryTags').value='';
  await loadEntries(); renderEntries();
}

function closeMetrics(){ document.getElementById('metricsModal').classList.remove('show'); }
async function saveMetrics(){
  const timeMin = Number(document.getElementById('metricTime').value || 0);
  const distanceKm = Number(document.getElementById('metricDistance').value || 0);
  await fetch('/api/metrics', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ id: metricsHabitId, date: state.selected, metrics: { timeMin, distanceKm } }) });
  closeMetrics(); fetchData();
}

function render(){
  document.getElementById('selectedDate').textContent = state.selected;
  renderCalendar(); renderHabits(); renderEntries();
}

window.addEventListener('DOMContentLoaded', fetchData);
