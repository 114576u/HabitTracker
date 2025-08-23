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


function appendHabitCard(habit) {
  const container = document.getElementById('habit-list');
  if (!container) return;

  const card = document.createElement('div');
  card.classList.add('card', 'habit-card');

  card.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center;">
      <h5 style="margin: 0; font-size: 1.1rem;">${habit.name}</h5>
      <div style="width: 1.25rem; height: 1.25rem; background: ${habit.color}; border-radius: 50%;"></div>
    </div>
    <div style="margin-top: 0.5rem;">
      <p style="margin: 0.25rem 0;"><strong>Type:</strong> ${habit.kind}</p>
      ${habit.tags?.length ? `<p style="margin: 0.25rem 0;"><strong>Tags:</strong> ${habit.tags.join(', ')}</p>` : ''}
      ${habit.monthlyGoal ? `<p style="margin: 0.25rem 0;"><strong>Monthly goal:</strong> ${habit.monthlyGoal}</p>` : ''}
    </div>
  `;

  card.style.marginBottom = '1rem';
  card.style.padding = '1rem';
  card.style.borderRadius = '0.5rem';
  card.style.transition = "background 0.5s";
  card.style.background = "#e0ffe0";
  setTimeout(() => {
    card.style.background = "";
  }, 1000);

  container.appendChild(card);
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
      const result = await res.json(); // ✅ FIXED: properly named result
      // ✅ Merge local habit data with the returned ID and append to UI
      //appendHabitCard({
      //  ...habitData,
      //  id: result.id || null
      //});

      const newHabit = {
        ...habitData,
        id: result.id
      };
      appendHabitCard(newHabit);
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




function clearFormInputs() {
  document.getElementById('hName').value = '';
  document.getElementById('hTags').value = '';
  document.getElementById('hMonthlyGoal').value = '';
  document.getElementById('hColor').value = '#8c88fc';
  document.querySelector('input[name="hKind"][value="checkbox"]').checked = true;
}


function deleteHabit(habitId) {
  fetch(`/api/delete_habit/${habitId}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
  })
  .then(res => {
    if (res.ok) {
      // Remove the habit card from the DOM
      const deleteButton = document.querySelector(`.delete-btn[data-id="${habitId}"]`);
      const card = deleteButton?.closest(".habit-card");
      if (card) {
        card.style.transition = 'opacity 0.3s ease, height 0.3s ease, margin 0.3s ease';
        card.style.opacity = '0';
        card.style.height = '0';
        card.style.margin = '0';
        setTimeout(() => card.remove(), 300);
      }

      // If no cards remain, show the empty message
      if (document.querySelectorAll(".habit-card").length === 0) {
        document.getElementById("habit-list").innerHTML = "<p>No habits yet. Start by creating one above!</p>";
      }
    } else {
      return res.json()
        .then(data => { throw new Error(data.message); })
        .catch(() => { throw new Error("Server did not return valid JSON"); });
    }
  })
  .catch(err => {
    alert("Error deleting habit: " + err.message);
  });
}


function showConfirmDialog(habitId) {
  const modal = document.getElementById('confirmModal');
  const yesBtn = document.getElementById('confirmYes');
  const noBtn = document.getElementById('confirmNo');
  const closeModal = () => {
    modal.style.display = 'none';
  };
  // Remove any previous 'click' event listeners
  const newYesBtn = yesBtn.cloneNode(true);
  yesBtn.parentNode.replaceChild(newYesBtn, yesBtn);
  newYesBtn.addEventListener('click', () => {
    closeModal();
    deleteHabit(habitId);
  });
  noBtn.onclick = () => {
    console.log("Canceled deletion");
    closeModal();
  };
  modal.style.display = 'block';
}


document.addEventListener('click', (e) => {
  if (e.target.classList.contains('delete-btn')) {
    const habitId = e.target.getAttribute('data-id');
    //deleteHabit(habitId);
    showConfirmDialog(habitId);
  }
});



// Show/hide numeric opts
[...document.getElementsByName('hKind')].forEach(r => r.addEventListener('change', () => {
  const val = [...document.getElementsByName('hKind')].find(x=>x.checked)?.value;
  document.getElementById('hNumeric').style.display = (val==='numeric') ? 'block' : 'none';
}));

window.addEventListener('DOMContentLoaded', () => { fetchHabits(); });
