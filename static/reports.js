
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

  const tbody = document.querySelector('#repTable tbody');
  tbody.innerHTML = '';
  for (const row of data.rows){
    const tr = document.createElement('tr');
    const tags = (row.tags||[]).join(', ');
    tr.innerHTML = `
      <td>${row.type}</td>
      <td>${row.date||''}</td>
      <td>${row.type==='habit' ? (row.habit||'') : (row.text||'')}</td>
      <td>${row.type==='habit' ? (row.kind||'') : (row.category||'')}</td>
      <td>${row.type==='habit' ? (row.done?'✔':'') : (row.checked?'✔':'')}</td>
      <td>${row.timeMin ?? ''}</td>
      <td>${row.distanceKm ?? ''}</td>
      <td>${row.rating ?? ''}</td>
      <td>${tags}</td>
      <td>${row.link ? `<a href="${row.link}" target="_blank" rel="noopener">link</a>` : ''}</td>
    `;
    tbody.appendChild(tr);
  }
}
