// ══════════════════════════════════════════════
//  Khalid's Dreams — দেনা-পাওনা (Dues) Page
// ══════════════════════════════════════════════

let duesData       = [];   // raw sales from sheet
let duesLoaded     = false;
let duesRange      = '30'; // default range
let duesFilter     = '';   // search text

// ── FETCH ──
async function fetchDuesData() {
  return new Promise((resolve) => {
    const cb = 'duesCb_' + Date.now();
    const params = new URLSearchParams({ action: 'fetch', callback: cb });
    window[cb] = (resp) => {
      delete window[cb];
      try { document.head.removeChild(sc); } catch(e){}
      resolve(resp.success ? (resp.data || []) : []);
    };
    const sc = document.createElement('script');
    sc.src = SHEET_URL + '?' + params;
    sc.onerror = () => { delete window[cb]; resolve([]); };
    setTimeout(() => { if (window[cb]) { delete window[cb]; resolve([]); } }, 12000);
    document.head.appendChild(sc);
  });
}

// ── BUILD PER-CUSTOMER DUE MAP ──
function buildDuesMap(sales, rangeDays) {
  // All sales (no range filter) for computing cumulative due per customer
  const custMap = {};
  sales.forEach(s => {
    const key = normalizePhone(s.phone);
    if (!key) return;
    if (!custMap[key]) {
      custMap[key] = {
        name: s.name, phone: key,
        district: s.district || '', thana: s.thana || '',
        totalDue: 0, totalSales: 0, totalAdvance: 0,
        invoices: [], lastTs: 0,
      };
    }
    const due  = parseFloat(s.due)   || 0;
    const gt   = parseFloat(s.total) || 0;
    const adv  = parseFloat(s.advance)||0;
    custMap[key].totalDue     += due;
    custMap[key].totalSales   += gt;
    custMap[key].totalAdvance += adv;
    const ts = s.timestamp ? new Date(s.timestamp).getTime() : 0;
    if (ts > custMap[key].lastTs) {
      custMap[key].lastTs   = ts;
      custMap[key].name     = s.name     || custMap[key].name;
      custMap[key].district = s.district || custMap[key].district;
    }
    if (due > 0) {
      custMap[key].invoices.push({
        invoiceNo: s.invoiceNo,
        items:     s.items || '',
        grandTotal:gt,
        advance:   adv,
        due:       due,
        datetime:  s.datetime || '',
        timestamp: s.timestamp || '',
      });
    }
  });
  return Object.values(custMap).filter(c => c.totalDue > 0);
}

// ── SUMMARY STATS ──
function computeDuesSummary(sales, rangeDays) {
  const cutoff = rangeDays === 'all' ? 0 : Date.now() - parseInt(rangeDays)*86400000;
  const ranged = sales.filter(s => {
    if (rangeDays === 'all') return true;
    const ts = s.timestamp ? new Date(s.timestamp).getTime() : 0;
    return ts >= cutoff;
  });
  const totalSales   = ranged.reduce((s,r) => s + (parseFloat(r.total)  ||0), 0);
  const totalAdvance = ranged.reduce((s,r) => s + (parseFloat(r.advance)||0), 0);
  const totalDue     = ranged.reduce((s,r) => s + (parseFloat(r.due)    ||0), 0);
  const avgSale      = ranged.length ? totalSales / ranged.length : 0;
  return { totalSales, totalAdvance, totalDue, avgSale, count: ranged.length };
}

// ── RENDER SUMMARY ──
function renderDuesSummary() {
  const stats = computeDuesSummary(duesData, duesRange);
  const fmt = v => '৳' + v.toLocaleString('en-US', {minimumFractionDigits:0});
  document.getElementById('ds-sales').textContent   = fmt(stats.totalSales);
  document.getElementById('ds-advance').textContent = fmt(stats.totalAdvance);
  document.getElementById('ds-due').textContent     = fmt(stats.totalDue);
  document.getElementById('ds-avg').textContent     = fmt(stats.avgSale);
  renderDuesChart(duesData, duesRange);
}

// ── CHART ──
function renderDuesChart(sales, rangeDays) {
  const container = document.getElementById('dues-chart');
  if (!container) return;

  const cutoff = rangeDays === 'all' ? 0 : Date.now() - parseInt(rangeDays)*86400000;
  const ranged = sales.filter(s => {
    if (rangeDays === 'all') return true;
    const ts = s.timestamp ? new Date(s.timestamp).getTime() : 0;
    return ts >= cutoff;
  });

  // Group by day
  const dayMap = {};
  ranged.forEach(s => {
    const d = s.timestamp
      ? new Date(s.timestamp).toLocaleDateString('en-US', {month:'short', day:'numeric'})
      : 'Unknown';
    if (!dayMap[d]) dayMap[d] = { sales:0, advance:0, due:0 };
    dayMap[d].sales   += parseFloat(s.total)   || 0;
    dayMap[d].advance += parseFloat(s.advance)  || 0;
    dayMap[d].due     += parseFloat(s.due)      || 0;
  });

  const days   = Object.keys(dayMap).slice(-14);
  const maxVal = Math.max(...days.map(d => dayMap[d].sales), 1);

  if (!days.length) {
    container.innerHTML = '<div class="chart-empty">তথ্য নেই</div>';
    return;
  }

  const bars = days.map(d => {
    const sh = Math.round((dayMap[d].sales   / maxVal) * 90);
    const ah = Math.round((dayMap[d].advance / maxVal) * 90);
    const dh = Math.round((dayMap[d].due     / maxVal) * 90);
    return `
    <div class="chart-bar-wrap" title="${d}&#10;বিক্রয়: ৳${dayMap[d].sales.toFixed(0)}&#10;জমা: ৳${dayMap[d].advance.toFixed(0)}&#10;বাকি: ৳${dayMap[d].due.toFixed(0)}">
      <div style="display:flex;align-items:flex-end;gap:2px;height:90px;">
        <div style="width:10px;height:${sh}px;background:var(--gold);border-radius:3px 3px 0 0;" title="বিক্রয়"></div>
        <div style="width:10px;height:${ah}px;background:#81c784;border-radius:3px 3px 0 0;" title="জমা"></div>
        <div style="width:10px;height:${dh}px;background:#e57373;border-radius:3px 3px 0 0;" title="বাকি"></div>
      </div>
      <div class="chart-label">${d}</div>
    </div>`;
  }).join('');

  container.innerHTML = `
    <div style="display:flex;gap:12px;margin-bottom:8px;font-size:.72rem;">
      <span style="display:flex;align-items:center;gap:5px;"><span style="width:10px;height:10px;background:var(--gold);border-radius:2px;display:inline-block;"></span>বিক্রয়</span>
      <span style="display:flex;align-items:center;gap:5px;"><span style="width:10px;height:10px;background:#81c784;border-radius:2px;display:inline-block;"></span>জমা</span>
      <span style="display:flex;align-items:center;gap:5px;"><span style="width:10px;height:10px;background:#e57373;border-radius:2px;display:inline-block;"></span>বাকি</span>
    </div>
    <div class="chart-bars">${bars}</div>`;
}

// ── RENDER DUES LIST ──
const DUES_PAGE_SIZE = 20;
let duesPage = 1;
let _currentDuesList = [];

function renderDuesList() {
  const list = document.getElementById('dues-list');
  if (!list) return;

  const custList = buildDuesMap(duesData, duesRange);
  const q = duesFilter.toLowerCase();
  const filtered = q
    ? custList.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        c.district.toLowerCase().includes(q))
    : custList;

  // Sort by totalDue descending
  filtered.sort((a,b) => b.totalDue - a.totalDue);
  _currentDuesList = filtered;
  duesPage = 1;

  document.getElementById('dues-result-count').textContent =
    filtered.length + 'জন গ্রাহকের বাকি আছে';

  if (!filtered.length) {
    list.innerHTML = `<div class="empty-state"><span class="e-icon">🎉</span><p>কোনো বাকি নেই!</p></div>`;
    document.getElementById('dues-seemore-wrap')?.remove();
    return;
  }

  const paged = _currentDuesList.slice(0, duesPage * DUES_PAGE_SIZE);
  list.innerHTML = paged.map(c => `
    <div class="due-card">
      <div class="due-card-top" onclick="openDueDetail('${c.phone}')">
        <div class="due-avatar">${c.name.charAt(0).toUpperCase()}</div>
        <div class="due-info">
          <div class="due-name">${c.name}</div>
          <div class="due-meta">📞 ${c.phone}${c.district ? ' · 📍' + c.district : ''}</div>
          <div class="due-inv-count">${c.invoices.length}টি ইনভয়েসে বাকি</div>
        </div>
        <div class="due-amount-wrap">
          <div class="due-amount">৳${c.totalDue.toLocaleString('en-US', {minimumFractionDigits:2})}</div>
          <div class="due-amount-lbl">মোট বাকি</div>
        </div>
      </div>
      <div class="due-card-actions">
        <button class="due-pay-btn" onclick="openPaymentModal('${c.phone}','${c.name}',${c.totalDue})">
          💰 পরিশোধ নিন
        </button>
        <button class="due-detail-btn" onclick="openDueDetail('${c.phone}')">
          📋 বিস্তারিত
        </button>
      </div>
    </div>`).join('');

  // See more button
  document.getElementById('dues-seemore-wrap')?.remove();
  const duesRemaining = _currentDuesList.length - paged.length;
  if (duesRemaining > 0) {
    const wrap = document.createElement('div');
    wrap.id = 'dues-seemore-wrap';
    wrap.style.cssText = 'text-align:center;padding:1rem 0;';
    wrap.innerHTML = `<button class="see-more-btn" onclick="duesLoadMore()">
      আরো দেখুন (${duesRemaining}জন বাকি ↓)
    </button>`;
    list.after(wrap);
  }
}

function duesLoadMore() {
  duesPage++;
  const list   = document.getElementById('dues-list');
  const paged  = _currentDuesList.slice(0, duesPage * DUES_PAGE_SIZE);
  list.innerHTML = paged.map(c => `
    <div class="due-card">
      <div class="due-card-top" onclick="openDueDetail('${c.phone}')">
        <div class="due-avatar">${c.name.charAt(0).toUpperCase()}</div>
        <div class="due-info">
          <div class="due-name">${c.name}</div>
          <div class="due-meta">📞 ${c.phone}${c.district ? ' · 📍' + c.district : ''}</div>
          <div class="due-inv-count">${c.invoices.length}টি ইনভয়েসে বাকি</div>
        </div>
        <div class="due-amount-wrap">
          <div class="due-amount">৳${c.totalDue.toLocaleString('en-US', {minimumFractionDigits:2})}</div>
          <div class="due-amount-lbl">মোট বাকি</div>
        </div>
      </div>
      <div class="due-card-actions">
        <button class="due-pay-btn" onclick="openPaymentModal('${c.phone}','${c.name}',${c.totalDue})">
          💰 পরিশোধ নিন
        </button>
        <button class="due-detail-btn" onclick="openDueDetail('${c.phone}')">
          📋 বিস্তারিত
        </button>
      </div>
    </div>`).join('');

  document.getElementById('dues-seemore-wrap')?.remove();
  const remaining2 = _currentDuesList.length - paged.length;
  if (remaining2 > 0) {
    const wrap = document.createElement('div');
    wrap.id = 'dues-seemore-wrap';
    wrap.style.cssText = 'text-align:center;padding:1rem 0;';
    wrap.innerHTML = `<button class="see-more-btn" onclick="duesLoadMore()">
      আরো দেখুন (${remaining2}জন বাকি ↓)
    </button>`;
    list.after(wrap);
  }
}

// ── DUE DETAIL MODAL ──
function openDueDetail(phone) {
  const custList = buildDuesMap(duesData, 'all');
  const c = custList.find(x => x.phone === phone);
  if (!c) return;

  document.getElementById('dd-name').textContent    = c.name;
  document.getElementById('dd-phone').textContent   = c.phone;
  document.getElementById('dd-avatar').textContent  = c.name.charAt(0).toUpperCase();
  document.getElementById('dd-total-due').textContent =
    '৳' + c.totalDue.toLocaleString('en-US', {minimumFractionDigits:2});

  const tbody = document.getElementById('dd-invoices');
  tbody.innerHTML = c.invoices
    .sort((a,b) => new Date(b.timestamp||0) - new Date(a.timestamp||0))
    .map(inv => `
      <tr>
        <td><span class="inv-badge" style="font-size:.65rem;">${inv.invoiceNo}</span></td>
        <td style="font-size:.75rem;color:var(--white-dim);max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${inv.items}</td>
        <td style="font-size:.8rem;color:var(--white);">৳${Number(inv.grandTotal).toLocaleString('en-US')}</td>
        <td style="font-size:.8rem;color:#81c784;">৳${Number(inv.advance).toLocaleString('en-US')}</td>
        <td style="font-size:.85rem;font-weight:700;color:#e57373;">৳${Number(inv.due).toLocaleString('en-US', {minimumFractionDigits:2})}</td>
        <td style="font-size:.7rem;color:var(--white-dim);">${inv.datetime ? inv.datetime.split(' at ')[0] : '—'}</td>
      </tr>`).join('');

  document.getElementById('due-detail-modal').classList.add('open');
}

function closeDueDetail() {
  document.getElementById('due-detail-modal').classList.remove('open');
}

// ── PAYMENT MODAL ──
let _payPhone = '', _payName = '', _payTotal = 0;

function openPaymentModal(phone, name, totalDue) {
  _payPhone = phone; _payName = name; _payTotal = totalDue;
  document.getElementById('pay-modal-name').textContent =
    `${name} (${phone}) — মোট বাকি: ৳${totalDue.toLocaleString('en-US', {minimumFractionDigits:2})}`;
  document.getElementById('pay-amount').value = '';
  document.getElementById('pay-modal').classList.add('open');
  setTimeout(() => document.getElementById('pay-amount').focus(), 100);
}

function closePaymentModal() {
  document.getElementById('pay-modal').classList.remove('open');
}

// ── PROCESS PAYMENT ──
async function processPayment() {
  const amount = parseFloat(document.getElementById('pay-amount').value);
  if (!amount || amount <= 0) return showToast('error', 'ভুল', 'সঠিক পরিমাণ দিন।');
  if (amount > _payTotal + 0.01) return showToast('error', 'ভুল', `সর্বোচ্চ ৳${_payTotal.toFixed(2)} পরিশোধ করা যাবে।`);

  const btn = document.getElementById('pay-confirm-btn');
  btn.disabled = true;
  btn.textContent = 'প্রসেস হচ্ছে...';

  try {
    const result = await sendPaymentToSheet(_payPhone, amount);
    if (result.success) {
      closePaymentModal();
      showToast('success', 'পরিশোধ সফল! ✅', `৳${amount.toLocaleString('en-US')} পরিশোধ রেকর্ড হয়েছে।`);
      // Refresh data
      duesLoaded = false;
      customerLookupCache = null;
      if (typeof allSales !== 'undefined') window.allSales = [];
      if (typeof historyLoaded !== 'undefined') window.historyLoaded = false;
      await initDues();
    } else {
      showToast('error', 'সমস্যা', result.message || 'Sheet আপডেট হয়নি।');
    }
  } catch(e) {
    showToast('error', 'ত্রুটি', 'সমস্যা হয়েছে।');
  } finally {
    btn.disabled = false;
    btn.textContent = '✅ পরিশোধ নিশ্চিত করুন';
  }
}

// ── SEND PAYMENT TO SHEET (JSONP) ──
function sendPaymentToSheet(phone, amount) {
  return new Promise((resolve) => {
    const cb = 'payCb_' + Date.now();
    const params = new URLSearchParams({
      action:   'payment',
      callback: cb,
      phone:    phone,
      amount:   amount,
    });
    window[cb] = (resp) => {
      delete window[cb];
      try { document.head.removeChild(sc); } catch(e){}
      resolve(resp);
    };
    const sc = document.createElement('script');
    sc.src = SHEET_URL + '?' + params;
    sc.onerror = () => { delete window[cb]; resolve({ success: false }); };
    setTimeout(() => {
      if (window[cb]) { delete window[cb]; resolve({ success: false, message:'timeout' }); }
    }, 15000);
    document.head.appendChild(sc);
  });
}

// ── RANGE FILTER ──
function setDuesRange(days) {
  duesRange = days;
  document.querySelectorAll('.dues-range-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.range === days));
  renderDuesSummary();
  renderDuesList();
}

// ── SEARCH ──
function searchDues() {
  duesFilter = document.getElementById('dues-search').value.trim();
  renderDuesList();
}

// ── INIT ──
async function initDues() {
  if (duesLoaded) { renderDuesSummary(); renderDuesList(); return; }

  document.getElementById('dues-loading').style.display  = 'flex';
  document.getElementById('dues-content').style.display  = 'none';

  // Reuse cached sales if available
  if (typeof allSales !== 'undefined' && allSales && allSales.length) {
    duesData = allSales;
  } else {
    duesData = await fetchDuesData();
    if (typeof window.allSales !== 'undefined') window.allSales = duesData;
    if (typeof window.historyLoaded !== 'undefined') window.historyLoaded = true;
    if (typeof window.customerLoaded !== 'undefined') window.customerLoaded = false;
  }

  duesLoaded = true;
  document.getElementById('dues-loading').style.display = 'none';
  document.getElementById('dues-content').style.display = 'block';

  renderDuesSummary();
  renderDuesList();
}

function refreshDues() {
  duesLoaded = false;
  customerLookupCache = null;
  if (typeof window.allSales !== 'undefined') window.allSales = [];
  initDues();
}
