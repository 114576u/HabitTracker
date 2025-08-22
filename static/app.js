
// --- Home page calendar + habits usage ---
function yyyymm(d){ return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,'0'); }
function ymd(d){ return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,'0')+"-"+String(d.getDate()).padStart(2,'0'); }
function el(id){ return document.getElementById(id); }

const state = {
  month: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  selectedDay: "2025-08-22",
  habits: [],
  activity: {}
};

function setSelectedDay(dayStr) {
  state.selectedDay = dayStr;
  const sd = el('selectedDay'); if (sd) sd.value = dayStr;
  const human = new Date(dayStr + "T00:00:00");
  el('selectedDate').textContent = human.toDateString();
  refreshDay();
}

async function fetchData() {
  const res = await fetch('/api/data');
  const data = await res.json();
  state.habits = data.habits || [];
  const monthStr = yyyymm(state.month);
  const ares = await fetch('/api/activity?month=' + monthStr);
  const act = await ares.json();
  state.activity = act.dateCounts || {};
}

function renderCalendar() {
  const cont = el('calendar');
  const first = new Date(state.month.getFullYear(), state.month.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - ((first.getDay()+6)%7));
  const todayStr = "2025-08-22";
  let html = '<div class="cal-grid">';
  for (let i=0;i<42;i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const ds = ymd(d);
    const inMonth = d.getMonth() === state.month.getMonth();
    const count = state.activity[ds] || 0;
    const sel = ds === state.selectedDay ? ' selected' : '';
    const dim = inMonth ? '' : ' dim';
    const shade = count>0 ? ' has-data' : '';
    const today = ds === todayStr ? ' today' : '';
    html += `<div class="cal-cell${sel}${dim}${shade}${today}" data-day="${ds}"><div class="cal-num">${d.getDate()}</div></div>`;
  }
  html += '</div>';
  cont.innerHTML = html;
  cont.querySelectorAll('.cal-cell').forEach(c => {
    c.addEventListener('click', () => setSelectedDay(c.dataset.day));
  });
}

function renderHabitsForDay() {
  const wrap = el('habits');
  if (!state.habits.length) { wrap.innerHTML = '<div class="muted">No habits yet.</div>'; return; }
  const day = state.selectedDay;
  wrap.innerHTML = state.habits.map(h => {
    const rec = (h.records||{})[day];
    const done = h.kind==='checkbox' ? !!rec : (h.kind==='metrics' ? (rec && rec.done) : (rec && (rec.value||0)>0));
    const primary = h.kind==='checkbox' ? 'Toggle' : 'Enter values';
    const tags = (h.tags||[]).map(t=>`<span class="badge">${t}</span>`).join(' ');
    return `
    <div class="card" data-id="${h.id}">
      <div class="card-header">
        <div class="badge name" style="background:${h.color}">${h.name}</div>
        <div class="spacer"></div>
        <div class="muted">${h.kind}</div>
      </div>
      <div class="card-body">
        <div class="mt">${tags}</div>
        <div class="actions">
          <button class="btn action" data-act="primary" data-id="${h.id}" data-kind="${h.kind}">${primary}</button>
          <button class="btn danger" data-act="delete" data-id="${h.id}">Delete</button>
        </div>
      </div>
    </div>`
  }).join('');
}

async function loadAndRender() {
  await fetchData();
  renderCalendar();
  renderHabitsForDay();
  await refreshDay();
}

async function refreshDay() {
  const res = await fetch('/api/media/list?date=' + state.selectedDay);
  const rows = await res.json();
  const box = document.getElementById('entries');
  box.innerHTML = rows.map(r => `
    <div class="row wrap mt">
      <label><input type="checkbox" ${r.checked ? 'checked' : ''} data-entry="${r.id}" data-act="entryCheck"></label>
      <span class="badge">${r.category || ''}</span>
      <a href="${r.link || '#'}" target="_blank">${r.text}</a>
      <span class="muted">rating: ${r.rating ?? ''}</span>
      ${(r.tags||[]).map(t=>`<span class="badge">${t}</span>`).join(" ")}
    </div>
  `).join('');
}

function goToday() { state.month = new Date(new Date().getFullYear(), new Date().getMonth(), 1); setSelectedDay("2025-08-22"); loadAndRender(); }
function shiftMonth(delta) { state.month = new Date(state.month.getFullYear(), state.month.getMonth() + delta, 1); loadAndRender(); }

document.addEventListener('DOMContentLoaded', async () => {
  if (el('selectedDay')) el('selectedDay').value = state.selectedDay;
  el('selectedDate').textContent = new Date(state.selectedDay + "T00:00:00").toDateString();
  await loadAndRender();
});
