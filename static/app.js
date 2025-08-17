
let state = { habits: [], today: "", selected: null, viewYear: null, viewMonth: null };
let metricsHabitId = null;

async function fetchData(){
  const r = await fetch('/api/data');
  if (r.status === 401) { location.href = '/login'; return; }
  const data = await r.json();
  state.habits = data.habits || [];
  state.today = data.today;
  const t = new Date(state.today);
  if (state.viewYear === null) { state.viewYear = t.getFullYear(); }
  if (state.viewMonth === null) { state.viewMonth = t.getMonth(); }
  if (!state.selected) state.selected = state.today;
  render();
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
  render();
}

function setSelected(dateStr){ state.selected = dateStr; renderHabits(); renderCalendar(); }

function renderCalendar(){
  const monthLabel = document.getElementById('monthLabel');
  const calendar = document.getElementById('calendar');
  const monthStart = startOfMonth(state.viewYear, state.viewMonth);
  const monthEnd = endOfMonth(state.viewYear, state.viewMonth);
  const startWeekday = (new Date(state.viewYear, state.viewMonth, 1).getDay() + 6) % 7; // Monday=0
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

    html += `<div class="card">
      <div class="row">
        <div class="badge" style="border-color:${h.color}">${h.name}</div>
        <div class="muted">(${h.kind})</div>
        <div class="spacer"></div>
        <div class="muted">${badge}</div>
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
}

function openAddModal(){ document.getElementById('addModal').classList.add('show'); }
function closeAddModal(){ document.getElementById('addModal').classList.remove('show'); }
async function addHabit(){
  const name = document.getElementById('habitName').value.trim();
  const color = document.getElementById('habitColor').value;
  const kind = [...document.getElementsByName('habitKind')].find(r => r.checked)?.value || 'checkbox';
  if (!name) return;
  await fetch('/api/habits/add', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ name, color, kind }) });
  closeAddModal(); fetchData();
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
  renderCalendar(); renderHabits();
}

window.addEventListener('DOMContentLoaded', fetchData);
