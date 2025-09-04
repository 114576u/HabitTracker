function ymd(d) {
  return d.toISOString().slice(0, 10);
}

async function initReports() {
  const today = new Date();
  const start = ymd(today);
  document.getElementById('repStart').value = start;
  runReport();
}

async function runReport() {
  const period = document.getElementById('repPeriod').value;
  const start = document.getElementById('repStart').value;
  const sort = document.getElementById('repSort').value;
  const tag = document.getElementById('repTag').value.trim();
  const url = new URL('/api/reports', location.origin);

  const sortOption = sort.toLowerCase();

  url.searchParams.set('period', period);
  url.searchParams.set('start', start);
  url.searchParams.set('sort', sort);
  // if (tag) url.searchParams.set('tag', tag);

  const r = await fetch(url.toString());
  const data = await r.json();

   console.log(data);

  document.getElementById('repMeta').textContent = `Showing ${data.count} rows • ${data.start} → ${data.end}`;

  //if (tag) {
  //  document.getElementById('repMeta').textContent += ` • Tag filter: "${tag}"`;
  //}

const repTableBody = document.querySelector('#repTable tbody');
repTableBody.innerHTML = ''; // clear old rows

for (const row of data.rows) {
  if (row.type !== 'habit') continue;
  const tr = document.createElement('tr');
  const tags = (row.tags || []).join(', ');
  console.log("*********")
  console.log(row);
  console.log(tags);
  console.log("*********")
  tr.innerHTML = `
    <td>${row.date}</td>
    <td>${row.habit}</td>
    <td>${row.kind}</td>
    <td>${row.done}</td>
    <td>${tags}</td>
  `;
  repTableBody.appendChild(tr);
}


  // Build a tag map per habit from data.rows
//  const habitTagMap = {};
//  rowTags = [];
//  for (const row of (data.rows || [])) {
//    console.log("inside loop");
//    console.log(row.tags);
//    console.log(row)
    //if (row.type === 'habit' && row.habit) {
    //  if (!habitTagMap[row.habit]) {
    //    habitTagMap[row.habit] = row.tags || [];
//        habitTagMap[row] = row.tags || [];
//        console.log("habitTagMap")
//        console.log(habitTagMap)

    //  }
    //}
//  }

  //  console.log("habitTagMap")
  //  console.log(habitTagMap)


  // Unified Habit Table
  document.getElementById('goalsMonth').textContent = data.goalsMonth || '';
  const merged = {};

  // Load summary data
  for (const row of (data.summary || [])) {
    merged[row.habit] = {
      habit: row.habit,
      kind: row.kind,
      color: row.color,
      unit: row.unit,
      count: row.count,
      sum: row.sum,
      currentStreak: row.currentStreak,
      bestStreak: row.bestStreak,
      goal: '',
      doneCount: '',
      percent: '',
      tags: habitTagMap[row.habit] || []
    };
  }

  // Load goals into merged map
  for (const g of (data.goals || [])) {
    if (!merged[g.habit]) {
      merged[g.habit] = {
        habit: g.habit,
        kind: '',
        color: '#ccc',
        unit: '',
        count: 0,
        sum: 0,
        currentStreak: 0,
        bestStreak: 0
      };
    }
    merged[g.habit].goal = g.monthlyGoal;
    merged[g.habit].doneCount = g.doneCount;
    merged[g.habit].percent = g.percent;
  }

  // Render unified habit table
  const hbody = document.querySelector('#habitTable tbody');
  hbody.innerHTML = '';

  const sortedKeys = Object.keys(merged).sort((a, b) => {
      if (sortOption === 'habit') {
        return a.localeCompare(b);
      }
      if (sortOption === 'rating') {
        const aRating = merged[a].percent || 0;
        const bRating = merged[b].percent || 0;
        return bRating - aRating;
      }
      return 0; // default to no sorting
    });

  //for (const key of Object.keys(merged).sort()) {
  for (const key of sortedKeys) {
    const r = merged[key];
    const color = r.percent >= 75 ? 'green' : r.percent >= 25 ? 'orange' : (r.percent !== '' ? 'red' : '');
    const progressText = r.percent !== '' ? `${r.percent}%` : '';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><span class="badge" style="border-color:${r.color}">${r.habit}</span></td>
      <td>${r.kind}</td>
      <td>${r.goal || ''}</td>
      <td>${r.doneCount || ''}</td>
      <td style="color:${color}">${progressText}</td>
      <td>${r.count}</td>
      <td>${r.kind === 'numeric' ? r.sum : ''}</td>
      <td>${r.kind === 'numeric' ? r.unit || '' : ''}</td>
      <td>${r.currentStreak || 0}</td>
      <td>${r.bestStreak || 0}</td>
      <td>${(r.tags || []).join(', ')}</td>
    `;
    hbody.appendChild(tr);
  }

  // Journal Rows Table
  const tbody = document.querySelector('#repTable tbody');
  tbody.innerHTML = '';
  for (const row of data.rows) {
    if (row.type !== 'journal') continue;
    const tr = document.createElement('tr');
    const tags = (row.tags || []).join(', ');
    tr.innerHTML = `
      <td>${row.type}</td>
      <td>${row.date || ''}</td>
      <td>${row.text || ''}</td>
      <td>${row.category || ''}</td>
      <td>${row.checked ? '✔' : ''}</td>
      <td>${row.rating ?? ''}</td>
      <td>${tags}</td>
      <td>${row.link ? `<a href="${row.link}" target="_blank" rel="noopener">link</a>` : ''}</td>
    `;
    tbody.appendChild(tr);
  }
}

// Legacy — no longer used (safe to remove or keep for now)
function renderSummary(data) {
  const tbody = document.querySelector('#summaryTable tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  (data.summary || []).forEach(row => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td><span class="badge" style="border-color:${row.color}">${row.habit}</span></td>
      <td>${row.kind}</td>
      <td>${row.count}</td>
      <td>${row.kind==='numeric' ? (row.sum || 0) : ''}</td>
      <td>${row.kind==='numeric' ? (row.unit || '') : ''}</td>
      <td>${row.currentStreak || 0}</td>
      <td>${row.bestStreak || 0}</td>`;
    tbody.appendChild(tr);
  });
}

document.getElementById('btnExportCsv')?.addEventListener('click', () => {
  const period = document.getElementById('periodSel')?.value || 'week';
  const start = document.getElementById('startDate')?.value || '';
  const tag = document.getElementById('filterTag')?.value || '';
  const params = new URLSearchParams({ period, start });
  if (tag) params.set('tag', tag);
  const url = '/export/csv?' + params.toString();
  window.location.href = url;
});

function exportCSV() {
  const period = document.getElementById("repPeriod").value;
  const start = document.getElementById("repStart").value;
  const tag = document.getElementById("repTag").value.trim();
  const params = new URLSearchParams({
    period: period,
    start: start
  });
  if (tag !== "") {
    params.append("tag", tag);
  }
  const url = `/export/csv?${params.toString()}`;
  window.location.href = url;
}
