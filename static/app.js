function yyyymm(d){ return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,'0'); }
function ymd(d){ return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,'0')+"-"+String(d.getDate()).padStart(2,'0'); }
function el(id){ return document.getElementById(id); }

let allHabits = [];

const state = {
  month: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  selectedDay: new Date().toISOString().slice(0,10),
  habits: [],
  activity: {},
  selectedHabitId: null,
  currentHabitAction: null
};

async function setSelectedDay(dayStr){
  state.selectedDay = dayStr;
  const sd = el('selectedDay'); if(sd) sd.value = dayStr;
  el('selectedDate').textContent = new Date(dayStr + 'T00:00:00').toDateString();
  await fetchData();                    // <-- ✅ Ensure state.activity is updated
  populateHabitPicker();               // ✅ Ensure dropdown is filled
  await refreshDay();
  renderSelectedHabitCard();
  renderCalendar();
  renderHabits(displayedHabits);
}

async function fetchData(){
  const res = await fetch('/api/data'); const data = await res.json(); state.habits = data.habits || [];
  const monthStr = yyyymm(state.month);
  const a = await fetch('/api/activity?month='+monthStr); const j = await a.json(); state.activity = j.dateCounts || {};
}

function renderCalendar(){
  el('monthLabel').textContent = state.month.toLocaleString(undefined,{month:'long', year:'numeric'});
  const cont = el('calendar'); const first = new Date(state.month.getFullYear(), state.month.getMonth(), 1);
  const start = new Date(first); start.setDate(first.getDate() - ((first.getDay()+6)%7));
  const todayStr = new Date().toISOString().slice(0,10);
  let html = '<div class="cal-grid">';
  for(let i=0;i<42;i++){
    const d = new Date(start); d.setDate(start.getDate()+i); const ds = ymd(d);
    const inMonth = d.getMonth() === state.month.getMonth(); const count = state.activity[ds] || 0;
    const sel = ds===state.selectedDay?' selected':''; const dim = inMonth?'':' dim'; const shade = count>0?' has-data':''; const today = ds===todayStr?' today':'';
    html += `<div class="cal-cell${sel}${dim}${shade}${today}" data-day="${ds}"><div class="cal-num">${d.getDate()}</div></div>`;
  }
  html += '</div>'; cont.innerHTML = html;
  cont.querySelectorAll('.cal-cell').forEach(c=>c.addEventListener('click',()=>setSelectedDay(c.dataset.day)));
}

/* ---------- Habit picker UI ---------- */
function populateHabitPicker(){
  const sel = el('habitSelect'); if(!sel) return;
  const opts = state.habits.map(h=>`<option value="${h.id}">${h.name} (${h.kind})</option>`).join('');
  sel.innerHTML = `<option value="">(choose a habit)</option>` + opts;
  if(state.selectedHabitId){ sel.value = String(state.selectedHabitId); }
}

function getHabitById(id){ return state.habits.find(h=>String(h.id)===String(id)); }


function renderSelectedHabitCard(){
  const wrap = el('habitCard'); if(!wrap) return;
  if(!state.selectedHabitId){ wrap.innerHTML = '<div class="muted">Select a habit above.</div>'; return; }

  const h = getHabitById(state.selectedHabitId);
  if(!h){ wrap.innerHTML = '<div class="muted">Habit not found or inactive.</div>'; return; }

  const day = state.selectedDay;
  const value = h.records?.[day] ?? null;
  const primary = h.kind==='checkbox' ? 'Toggle' : (value ? 'Edit value' : 'Enter value');

  wrap.innerHTML = `
    <div class="card" data-id="${h.id}">
      <div class="card-header">
        <div class="badge name" style="background:${h.color}">${h.name}</div>
        <div class="spacer"></div><div class="muted">${h.kind}</div>
      </div>
      <div class="card-body">
        ${value !== null ? `<p>Value: <strong>${value.value ?? value}</strong></p>` : '<p>No value set for this day.</p>'}
        <div class="row wrap">
          <button class="btn action" id="habitPrimary">${primary}</button>
          ${value ? `<button class="btn danger" id="habitValueDelete">Delete value</button>` : ''}
        </div>
      </div>
    </div>`;

  el('habitPrimary').addEventListener('click', ()=>primaryAction(String(h.id), h.kind));

  if (el('habitValueDelete')) {
    el('habitValueDelete').addEventListener('click', async ()=>{
      await fetch('/api/habit/delete-value', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ habit_id: h.id, date: day })
      });
      await loadAndRender();
    });
  }
}



// No longer rendering all habit cards:
function renderHabitsForDay(){ /* intentionally empty (picker replaces bulk list) */ }

function saveHabitValue(habitId, value){
    fetch(`/api/habit/${habitId}/set`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ day: state.selectedDay, value: Number(value) })
    }).then(() => fetchData());
}

function deleteHabitValue(habitId) {
    fetch('/api/habit/delete-value', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ habit_id: habitId, date: selectedDate })
    })
    .then(() => renderHabits());
}


function renderHabits(habits) {
    const container = document.getElementById('habitCard');
    container.innerHTML = '';

    habits.forEach(habit => {
        const card = document.createElement('div');
        card.className = 'card';

        // Habit name and type
        const title = document.createElement('div');
        title.className = 'row wrap';
        title.innerHTML = `<span class="pill" style="background-color:${habit.color}">${habit.name}</span>
        <div class="spacer"></div>
        <span class="muted">${habit.kind}</span>`;
        card.appendChild(title);

        // Tags
        if (habit.tags.length > 0) {
            const tags = document.createElement('div');
            habit.tags.forEach(t => {
                const tag = document.createElement('span');
                tag.className = 'tag';
                tag.textContent = t;
                tags.appendChild(tag);
            });
            card.appendChild(tags);
        }

        // Habit record for selected day
        const rec = habit.records?.[state.selectedDay];

        if (habit.kind === 'numeric') {
            if (rec && typeof rec === 'object' && 'value' in rec) {
                const show = document.createElement('p');
                show.textContent = `Value: ${rec.value}`;
                card.appendChild(show);
            }

            const editBtn = document.createElement('button');
            editBtn.className = 'btn';
            editBtn.textContent = 'Edit value';
            editBtn.onclick = () => openNumeric(habit.id, habit.name, rec?.value);
            card.appendChild(editBtn);

            if (rec && typeof rec === 'object' && 'value' in rec) {
                const delBtn = document.createElement('button');
                delBtn.className = 'btn danger';
                delBtn.textContent = 'Delete value';
                delBtn.onclick = () => deleteHabitValue(habit.id);
                card.appendChild(delBtn);
            }
        }

        const deleteHabitBtn = document.createElement('button');
        deleteHabitBtn.className = 'btn danger';
        deleteHabitBtn.textContent = 'Delete habit';
        deleteHabitBtn.onclick = () => deleteHabit(habit.id);
        card.appendChild(deleteHabitBtn);

        container.appendChild(card);
    });
}


async function primaryAction(id, kind){
  const day = state.selectedDay;
  if(kind==='checkbox'){
    await fetch('/api/toggle', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({id, date: day})});
    await loadAndRender();
  }else if(kind==='metrics'){
    openMetricsModal(id, 'metrics');
  }else if(kind==='numeric'){
    openMetricsModal(id, 'numeric');
  }
}

/* ---------- Metrics / Numeric modal ---------- */
function openMetricsModal(id, mode){
  state.currentHabitAction = { id, kind: mode };
  document.getElementById('metricsFields').style.display = (mode==='metrics')?'block':'none';
  document.getElementById('numericFields').style.display = (mode==='numeric')?'block':'none';
  document.getElementById('metricTime').value='';
  document.getElementById('metricDistance').value='';
  document.getElementById('numericValue').value='';
  document.getElementById('metricsModal').classList.add('show');
}
function closeMetrics(){ document.getElementById('metricsModal').classList.remove('show'); }

async function saveMetrics(){
  const day = state.selectedDay; const a = state.currentHabitAction; if(!a) return;
  if(a.kind==='metrics'){
    const timeMin = parseFloat(document.getElementById('metricTime').value||0);
    const distanceKm = parseFloat(document.getElementById('metricDistance').value||0);
    await fetch('/api/metrics', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({id:a.id, date:day, metrics:{timeMin, distanceKm}})});
  }else{
    const value = parseFloat(document.getElementById('numericValue').value||0);
    await fetch('/api/numeric/set', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({id:a.id, date:day, value})});
  }
  closeMetrics(); await loadAndRender();
}

/* ---------- Journal ---------- */
async function refreshDay(){
  const res = await fetch('/api/media/list?date='+state.selectedDay); const rows = await res.json();
  const box = document.getElementById('entries');
  box.innerHTML = rows.map(r=>`
    <div class="row wrap mt">
      <label><input type="checkbox" ${r.checked?'checked':''} data-entry="${r.id}" data-act="entryCheck"></label>
      <span class="badge">${r.category||''}</span>
      <a href="${r.link||'#'}" target="_blank">${r.text}</a>
      <span class="muted">rating: ${r.rating ?? ''}</span>
      ${(r.tags||[]).map(t=>`<span class="badge">${t}</span>`).join(' ')}
      <button class="btn danger" data-act="entryDelete" data-id="${r.id}">Delete</button>
    </div>`).join('');
  box.querySelectorAll('[data-act="entryCheck"]').forEach(cb=>cb.addEventListener('change', async ()=>{
    await fetch('/api/media/update', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({id: cb.dataset.entry, checked: cb.checked})});
  }));
  box.querySelectorAll('[data-act="entryDelete"]').forEach(btn=>btn.addEventListener('click', async ()=>{
    await fetch('/api/media/delete', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({id: btn.dataset.id})});
    await refreshDay();
  }));
}

/* ---------- Page lifecycle ---------- */
async function loadAndRender(){
  await fetchData();
  renderCalendar();
  populateHabitPicker();
  renderSelectedHabitCard();
  await refreshDay();
}
function goToday(){ state.month = new Date(new Date().getFullYear(), new Date().getMonth(), 1); setSelectedDay(new Date().toISOString().slice(0,10)); loadAndRender(); }
function shiftMonth(delta){ state.month = new Date(state.month.getFullYear(), state.month.getMonth()+delta, 1); loadAndRender(); }

document.addEventListener('DOMContentLoaded', async ()=>{
  setSelectedDay(state.selectedDay);
  await loadAndRender();
  const sel = el('habitSelect'); const btn = el('openHabitBtn');
  if(sel && btn){
    btn.addEventListener('click', ()=>{ state.selectedHabitId = sel.value || null; renderSelectedHabitCard(); });
  }
});
