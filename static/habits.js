function ymd(d){ const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,'0'), day=String(d.getDate()).padStart(2,'0'); return `${y}-${m}-${day}`; }
const state = { habits: [], today: ymd(new Date()) };
function parseTags(str){ return (str||'').split(',').map(s=>s.trim()).filter(Boolean); }

async function fetchHabits(){
  const res = await fetch('/api/data?date='+state.today);
  const data = await res.json();
  state.habits = data.habits || [];
  renderHabits();
}

function renderHabits() {
  const wrap = document.getElementById('habitList');
  if (!state.habits.length) {
    wrap.innerHTML = '<div class="muted">No habits yet.</div>';
    return;
  }

  wrap.innerHTML = state.habits.map(h => `
    <div class="card" data-id="${h.id}">
      <div class="card-header row between wrap">
        <div class="row wrap">
          <div class="badge name" style="background:${h.color}">${h.name}</div>
          <div class="muted ml-sm">(${h.kind})</div>
        </div>
        <div class="muted">${h.active === false ? 'Inactive' : 'Active'}</div>
      </div>

      <div class="card-body">
        ${(h.tags || []).length > 0 ? `
          <div class="row wrap mt-sm mb-sm">
            ${h.tags.map(t => `<span class="badge">${t}</span>`).join(' ')}
          </div>` : ''
        }

        <div class="row wrap gap-sm mb-sm">
          <input class="grow" type="text" placeholder="edit tags (comma separated)" value="${(h.tags || []).join(', ')}" data-habit-tags="${h.id}">
          <button class="btn action" data-act="saveTags" data-id="${h.id}">Save tags</button>
        </div>

        <div class="row wrap gap-sm mb-sm">
          <input type="number" style="max-width:180px" min="0" placeholder="monthly goal" value="${h.monthlyGoal ?? ''}" data-habit-goal="${h.id}">
          <button class="btn action" data-act="saveGoal" data-id="${h.id}">Save goal</button>
        </div>

        ${h.kind === 'numeric' ? `
          <div class="muted mb-sm">
            Unit: <strong>${h.unit || '—'}</strong> •
            Agg: <strong>${h.aggregation || 'sum'}</strong> •
            Daily goal: <strong>${h.dailyGoal ?? '—'}</strong> •
            ${h.allowMulti ? 'Multi-entry' : 'Single value'}
          </div>
        ` : ''}

        <div class="row gap-sm mt-sm">
          <button class="btn" data-act="toggleActive" data-id="${h.id}">${h.active === false ? 'Enable' : 'Disable'}</button>
          <button class="btn danger" data-act="delete" data-id="${h.id}">Delete</button>
        </div>
      </div>
    </div>
  `).join('');

  // Action bindings (unchanged)
  wrap.querySelectorAll('[data-act="saveTags"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const input = document.querySelector(`[data-habit-tags="${id}"]`);
      const tags = parseTags(input.value);
      await fetch('/api/habits/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, tags })
      });
      fetchHabits();
    });
  });

  wrap.querySelectorAll('[data-act="saveGoal"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const input = document.querySelector(`[data-habit-goal="${id}"]`);
      const monthlyGoal = input.value === '' ? null : Number(input.value);
      await fetch('/api/habits/goal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, monthlyGoal })
      });
      fetchHabits();
    });
  });

  wrap.querySelectorAll('[data-act="toggleActive"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const h = state.habits.find(x => x.id == id);
      const active = !(h && h.active !== false);
      await fetch('/api/habits/active', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, active })
      });
      fetchHabits();
    });
  });

  wrap.querySelectorAll('[data-act="delete"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this habit?')) return;
      await fetch('/api/habits/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: btn.dataset.id })
      });
      fetchHabits();
    });
  });
}

// Create habit
document.getElementById('btnCreateHabit').addEventListener('click', async () => {
  const name = document.getElementById('hName').value.trim();
  const tags = document.getElementById('hTags').value.trim();
  const monthlyGoal = document.getElementById('hMonthlyGoal').value.trim();
  const color = document.getElementById('hColor').value;
  const kind = document.querySelector('input[name="hKind"]:checked').value;

  if (!name) {
    alert("Please enter a habit name.");
    return;
  }


const dailyGoal = document.getElementById('hDailyGoal').value.trim();
const unit = document.getElementById('hUnit').value.trim();
const aggregation = document.getElementById('hAggregation').value;
const allowMulti = document.getElementById('hAllowMulti').checked;


const habitData = {
  name,
  kind,
  color,
  monthlyGoal: monthlyGoal || null,
  dailyGoal: dailyGoal || null,
  unit: unit || null,
  aggregation: aggregation || 'sum',
  allowMulti: allowMulti || false,
  tags: parseTags(tags)  // make sure this is always an array
};


  try {
    const res = await fetch('/api/habits/add', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(habitData)
    });

    if (res.ok) {
      const newHabit = await res.json(); // assuming your API returns the created habit
      appendHabitCard(newHabit); // 👈 render it
      clearFormInputs();
    } else {
      const errorText = await res.text();
      alert("Error creating habit: " + errorText);
    }
  } catch (err) {
    console.error(err);
    alert("Unexpected error: " + err.message);
  }
});


function appendHabitCard(habit) {
  const container = document.querySelector('.habit-list');
  if (!container) return;

  const card = document.createElement('div');
  card.classList.add('card', 'habit-card');

  card.innerHTML = `
    <h5>${habit.name}</h5>
    <p>Type: ${habit.kind}</p>
    ${habit.tags ? `<p>Tags: ${habit.tags}</p>` : ''}
    ${habit.monthlyGoal ? `<p>Monthly goal: ${habit.monthlyGoal}</p>` : ''}
    <div style="width: 1.5rem; height: 1.5rem; background: ${habit.color}; border-radius: 50%; margin-top: 0.5rem"></div>
  `;

  card.style.transition = "background 0.5s";
  card.style.background = "#e0ffe0";
  setTimeout(() => {
    card.style.background = "";
  }, 1000);

  container.appendChild(card);
}


function clearFormInputs() {
  document.getElementById('hName').value = '';
  document.getElementById('hTags').value = '';
  document.getElementById('hMonthlyGoal').value = '';
  document.getElementById('hColor').value = '#8c88fc';
  document.querySelector('input[name="hKind"][value="checkbox"]').checked = true;
}




// Show/hide numeric opts
[...document.getElementsByName('hKind')].forEach(r => r.addEventListener('change', () => {
  const val = [...document.getElementsByName('hKind')].find(x=>x.checked)?.value;
  document.getElementById('hNumeric').style.display = (val==='numeric') ? 'block' : 'none';
}));

window.addEventListener('DOMContentLoaded', () => { fetchHabits(); });
