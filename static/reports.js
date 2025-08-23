function ymd(d){ return d.toISOString().slice(0,10); }

async function initReports(){
  const today = new Date();
  const start = ymd(today);
  document.getElementById('repStart').value = start;
  runReport();
}

async function runReport(){
  const period = document.getElementById('repPeriod').value;
  const start = document.getElementById('repStart').value;
  const sort = document.getElementById('repSort').value;
  const tag = document.getElementById('repTag').value.trim();
  const url = new URL('/api/reports', location.origin);
  url.searchParams.set('period', period);
  url.searchParams.set('start', start);
  url.searchParams.set('sort', sort);
  if (tag) url.searchParams.set('tag', tag);

  const r = await fetch(url.toString());
  const data = await r.json();

  document.getElementById('repMeta').textContent = `Showing ${data.count} rows • ${data.start} → ${data.end}`;

  // Goals table
  document.getElementById('goalsMonth').textContent = data.goalsMonth || '';
  const gbody = document.querySelector('#goalsTable tbody');
  gbody.innerHTML = '';
  for (const g of (data.goals||[])){
    const tr = document.createElement('tr');
    const color = g.percent >= 75 ? 'green' : g.percent >= 25 ? 'orange' : 'red';
    tr.innerHTML = `<td>${g.habit}</td><td>${g.monthlyGoal}</td><td>${g.doneCount}</td><td style="color:${color}">${g.percent}%</td>`;
    gbody.appendChild(tr);
  }

  // Rows table
  const tbody = document.querySelector('#repTable tbody');
  tbody.innerHTML = '';
  renderSummary(data);
  for (const row of data.rows){
    const tr = document.createElement('tr');
    const tags = (row.tags||[]).join(', ');
    tr.innerHTML = `
      <td>${row.type}</td>
      <td>${row.date||''}</td>
      <td>${row.type==='habit' ? (row.habit||'') : (row.text||'')}</td>
      <td>${row.type==='habit' ? (row.kind||'') : (row.category||'')}</td>
      <td>${row.type==='habit' ? (row.done?'✔':'') : (row.checked?'✔':'')}</td>
      <td>${row.rating ?? ''}</td>
      <td>${tags}</td>
      <td>${row.link ? `<a href="${row.link}" target="_blank" rel="noopener">link</a>` : ''}</td>
    `;
    tbody.appendChild(tr);
  }
}

// Render summary with streaks
function renderSummary(data){
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
