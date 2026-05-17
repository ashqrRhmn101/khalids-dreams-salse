// ══════════════════════════════════════════════
//  Khalid's Dreams — Sales History
// ══════════════════════════════════════════════

let allSales      = [];
let filteredSales = [];
let historyLoaded = false;
let activeRange   = '30';

// ── FETCH FROM GOOGLE SHEETS ──
function fetchSalesData() {
  return new Promise((resolve) => {
    const cb = 'histCb_' + Date.now();
    const params = new URLSearchParams({ action: 'fetch', callback: cb });
    window[cb] = (resp) => {
      delete window[cb];
      try { document.head.removeChild(sc); } catch(e){}
      if (resp.success) resolve(resp.data || []);
      else resolve([]);
    };
    const sc = document.createElement('script');
    sc.src = SHEET_URL + '?' + params;
    sc.onerror = () => { delete window[cb]; resolve([]); };
    setTimeout(() => { if (window[cb]) { delete window[cb]; resolve([]); } }, 12000);
    document.head.appendChild(sc);
  });
}

// ── FILTER BY DATE RANGE ──
function filterByRange(sales, days) {
  if (days === 'all') return sales;
  const cutoff = Date.now() - (parseInt(days) * 24*60*60*1000);
  return sales.filter(s => {
    const ts = s.timestamp ? new Date(s.timestamp).getTime() : 0;
    return ts >= cutoff;
  });
}

// ── COMPUTE SUMMARY ──
function computeSummary(sales) {
  const total   = sales.reduce((s, r) => s + r.total, 0);
  const count   = sales.length;
  const avg     = count ? total / count : 0;

  // top product
  const prodMap = {};
  sales.forEach(s => {
    (s.items || '').split(',').forEach(item => {
      const name = item.split('(')[0].trim();
      if (name) prodMap[name] = (prodMap[name] || 0) + 1;
    });
  });
  const topProd = Object.entries(prodMap).sort((a,b)=>b[1]-a[1])[0];

  return { total, count, avg, topProd: topProd ? topProd[0] : '—' };
}

// ── RENDER SUMMARY CARDS ──
function renderHistorySummary(sales) {
  const { total, count, avg, topProd } = computeSummary(sales);
  document.getElementById('h-total').textContent  = '৳' + total.toLocaleString('en-US', {minimumFractionDigits:0});
  document.getElementById('h-count').textContent  = count;
  document.getElementById('h-avg').textContent    = '৳' + Math.round(avg).toLocaleString('en-US');
  document.getElementById('h-top').textContent    = topProd;
}

// ── RENDER CHART (simple SVG bar chart) ──
function renderChart(sales) {
  const container = document.getElementById('sales-chart');
  if (!sales.length) { container.innerHTML = '<div class="chart-empty">তথ্য নেই</div>'; return; }

  // Group by day
  const dayMap = {};
  sales.forEach(s => {
    const d = s.timestamp ? new Date(s.timestamp).toLocaleDateString('en-US',{month:'short',day:'numeric'}) : 'Unknown';
    dayMap[d] = (dayMap[d] || 0) + s.total;
  });

  const days   = Object.keys(dayMap).slice(-14); // last 14 days max
  const values = days.map(d => dayMap[d]);
  const maxVal = Math.max(...values, 1);
  const barW   = Math.max(24, Math.floor(260 / days.length));

  const bars = days.map((d, i) => {
    const h   = Math.round((values[i] / maxVal) * 100);
    const val = values[i] >= 1000 ? (values[i]/1000).toFixed(1)+'k' : values[i];
    return `
    <div class="chart-bar-wrap" title="${d}: ৳${values[i].toLocaleString('en-US')}">
      <div class="chart-val">${val}</div>
      <div class="chart-bar" style="height:${h}%"></div>
      <div class="chart-label">${d}</div>
    </div>`;
  }).join('');

  container.innerHTML = `<div class="chart-bars">${bars}</div>`;
}

// ── RENDER TABLE ──
function renderHistoryTable(sales) {
  const tbody = document.getElementById('history-tbody');
  if (!sales.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--white-dim);">কোনো রেকর্ড নেই</td></tr>`;
    return;
  }
  const sorted = [...sales].sort((a,b) => new Date(b.timestamp||0) - new Date(a.timestamp||0));
  tbody.innerHTML = sorted.map(s => `
    <tr>
      <td><span class="inv-badge">${s.invoiceNo}</span></td>
      <td>
        <div class="td-name">${s.name}</div>
        <div class="td-sub">${s.phone}</div>
      </td>
      <td>
        <div class="td-sub" style="max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"
          title="${s.items}">${s.items || '—'}</div>
      </td>
      <td><span class="td-amount">৳${Number(s.total).toLocaleString('en-US')}</span></td>
      <td>
        <div class="td-sub">${s.district}${s.thana?' / '+s.thana:''}</div>
      </td>
      <td>
        <div class="td-sub">${s.datetime ? s.datetime.split(' at ')[0] : '—'}</div>
      </td>
    </tr>`).join('');
}

// ── SEARCH ──
function searchHistory() {
  const q = document.getElementById('h-search').value.trim().toLowerCase();
  filteredSales = q
    ? allSales.filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.phone.includes(q) ||
        s.invoiceNo.toLowerCase().includes(q) ||
        (s.items||'').toLowerCase().includes(q))
    : [...allSales];
  applyRangeFilter();
}

// ── RANGE FILTER ──
function setHistoryRange(days) {
  activeRange = days;
  document.querySelectorAll('.h-range-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.range === days);
  });
  applyRangeFilter();
}

function applyRangeFilter() {
  const ranged = filterByRange(filteredSales, activeRange);
  renderHistorySummary(ranged);
  renderChart(ranged);
  renderHistoryTable(ranged);
  document.getElementById('h-result-count').textContent = ranged.length + 'টি রেকর্ড';
}

// ── EXPORT CSV ──
function exportCSV() {
  const ranged = filterByRange(filteredSales, activeRange);
  if (!ranged.length) return showToast('error', 'কিছু নেই', 'Export করার মতো কোনো তথ্য নেই।');
  const header = ['Invoice No','Name','Phone','District','Thana','Items','Total','DateTime'];
  const rows   = ranged.map(s => [
    s.invoiceNo, s.name, s.phone, s.district, s.thana||'', s.items||'', s.total, s.datetime||''
  ].map(v => `"${String(v).replace(/"/g,'""')}"`).join(','));
  const csv  = [header.join(','), ...rows].join('\n');
  const blob = new Blob(['\uFEFF'+csv], {type:'text/csv;charset=utf-8'});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = 'KhalidsDreams-Sales-' + new Date().toISOString().slice(0,10) + '.csv';
  a.click(); URL.revokeObjectURL(url);
  showToast('success', 'Export সম্পন্ন!', 'CSV ফাইল ডাউনলোড হয়েছে।');
}

// ── INIT ──
async function initHistory() {
  if (historyLoaded) {
    filteredSales = [...allSales];
    applyRangeFilter();
    return;
  }

  document.getElementById('history-loading').style.display = 'flex';
  document.getElementById('history-content').style.display = 'none';

  allSales = await fetchSalesData();
  historyLoaded = true;
  filteredSales = [...allSales];

  document.getElementById('history-loading').style.display = 'none';
  document.getElementById('history-content').style.display = 'block';

  applyRangeFilter();
}

// Refresh
function refreshHistory() {
  historyLoaded = false;
  initHistory();
}
