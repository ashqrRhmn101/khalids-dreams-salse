// ══════════════════════════════════════════════
//  Khalid's Dreams — Customer Directory
// ══════════════════════════════════════════════

let allCustomers     = [];
let filteredCustomers = [];
let customerLoaded   = false;
let sortMode         = 'total'; // total | count | name | recent

// ── BUILD CUSTOMER LIST FROM SALES ──
function buildCustomerList(sales) {
  const map = {};
  sales.forEach(s => {
    const key = normalizePhone(s.phone);
    if (!key) return;
    if (!map[key]) {
      map[key] = {
        name:      s.name,
        phone:     key, // store normalized form for display
        district:  s.district || '',
        thana:     s.thana || '',
        address:   s.address || '',
        totalSpent: 0,
        orderCount: 0,
        orders:    [],
        lastOrder: '',
        lastTs:    0,
      };
    }
    map[key].totalSpent += s.total;
    map[key].orderCount += 1;
    map[key].orders.push(s);
    const ts = s.timestamp ? new Date(s.timestamp).getTime() : 0;
    if (ts > map[key].lastTs) {
      map[key].lastTs    = ts;
      map[key].lastOrder = s.datetime || '';
      map[key].name      = s.name; // use latest name
      map[key].district  = s.district || map[key].district;
      map[key].address   = s.address || map[key].address;
    }
  });
  return Object.values(map);
}

// ── SORT ──
function sortCustomers(list, mode) {
  const copy = [...list];
  if (mode === 'total')  return copy.sort((a,b) => b.totalSpent - a.totalSpent);
  if (mode === 'count')  return copy.sort((a,b) => b.orderCount - a.orderCount);
  if (mode === 'name')   return copy.sort((a,b) => a.name.localeCompare(b.name));
  if (mode === 'recent') return copy.sort((a,b) => b.lastTs - a.lastTs);
  return copy;
}

// ── RENDER SUMMARY ──
function renderCustomerSummary(customers) {
  const total  = customers.length;
  const repeat = customers.filter(c => c.orderCount > 1).length;
  const topVal = customers.length ? Math.max(...customers.map(c=>c.totalSpent)) : 0;
  const topCust = customers.find(c => c.totalSpent === topVal);
  document.getElementById('c-total').textContent  = total;
  document.getElementById('c-repeat').textContent = repeat;
  document.getElementById('c-top').textContent    = topCust ? topCust.name : '—';
}

// ── RENDER CUSTOMER GRID ──
function renderCustomerGrid(customers) {
  const sorted  = sortCustomers(customers, sortMode);
  const grid    = document.getElementById('customer-grid');

  if (!sorted.length) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <span class="e-icon">👥</span>
        <p>কোনো গ্রাহক পাওয়া যায়নি</p>
      </div>`;
    return;
  }

  grid.innerHTML = sorted.map((c, idx) => {
    const badge  = idx === 0 && sortMode === 'total' ? '🥇' :
                   idx === 1 && sortMode === 'total' ? '🥈' :
                   idx === 2 && sortMode === 'total' ? '🥉' : '';
    const tier   = c.totalSpent >= 10000 ? 'vip' : c.orderCount >= 5 ? 'regular' : 'new';
    const tierLbl = tier === 'vip' ? '⭐ VIP' : tier === 'regular' ? '🔄 নিয়মিত' : '🆕 নতুন';
    const tierCls = tier;

    return `
    <div class="customer-card" onclick="openCustomerDetail('${c.phone}')">
      <div class="cust-card-top">
        <div class="cust-avatar">${c.name.charAt(0).toUpperCase()}</div>
        <div class="cust-info">
          <div class="cust-name">${badge} ${c.name}</div>
          <div class="cust-phone">📞 ${c.phone}</div>
        </div>
        <span class="cust-tier ${tierCls}">${tierLbl}</span>
      </div>
      ${c.district ? `<div class="cust-location">📍 ${c.district}${c.thana?' / '+c.thana:''}</div>` : ''}
      <div class="cust-stats">
        <div class="cs-item">
          <span class="cs-val">৳${c.totalSpent.toLocaleString('en-US')}</span>
          <span class="cs-lbl">মোট কেনাকাটা</span>
        </div>
        <div class="cs-item">
          <span class="cs-val">${c.orderCount}</span>
          <span class="cs-lbl">মোট অর্ডার</span>
        </div>
        <div class="cs-item">
          <span class="cs-val">৳${Math.round(c.totalSpent/c.orderCount).toLocaleString('en-US')}</span>
          <span class="cs-lbl">গড় অর্ডার</span>
        </div>
      </div>
      ${c.lastOrder ? `<div class="cust-last">🕐 সর্বশেষ: ${c.lastOrder.split(' at ')[0]}</div>` : ''}
    </div>`;
  }).join('');

  document.getElementById('c-result-count').textContent = sorted.length + 'জন গ্রাহক';
}

// ── CUSTOMER DETAIL MODAL ──
function openCustomerDetail(phone) {
  const c = allCustomers.find(x => x.phone === phone);
  if (!c) return;

  const sorted = [...c.orders].sort((a,b) => new Date(b.timestamp||0) - new Date(a.timestamp||0));
  const orderRows = sorted.map(o => `
    <tr>
      <td><span class="inv-badge" style="font-size:.65rem;">${o.invoiceNo}</span></td>
      <td style="font-size:.78rem;color:var(--white-dim);max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${o.items||'—'}</td>
      <td><span class="td-amount" style="font-size:.85rem;">৳${Number(o.total).toLocaleString('en-US')}</span></td>
      <td style="font-size:.72rem;color:var(--white-dim);">${o.datetime ? o.datetime.split(' at ')[0] : '—'}</td>
    </tr>`).join('');

  document.getElementById('cd-avatar').textContent = c.name.charAt(0).toUpperCase();
  document.getElementById('cd-name').textContent    = c.name;
  document.getElementById('cd-phone').textContent   = c.phone;
  document.getElementById('cd-location').textContent = c.district + (c.thana?' / '+c.thana:'') || '—';
  document.getElementById('cd-total').textContent   = '৳' + c.totalSpent.toLocaleString('en-US');
  document.getElementById('cd-count').textContent   = c.orderCount + 'টি';
  document.getElementById('cd-avg').textContent     = '৳' + Math.round(c.totalSpent/c.orderCount).toLocaleString('en-US');
  document.getElementById('cd-orders').innerHTML    = orderRows;
  document.getElementById('customer-detail-modal').classList.add('open');
}

function closeCustomerDetail() {
  document.getElementById('customer-detail-modal').classList.remove('open');
}

// ── SEARCH ──
function searchCustomers() {
  const q = document.getElementById('c-search').value.trim().toLowerCase();
  filteredCustomers = q
    ? allCustomers.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        (c.district||'').toLowerCase().includes(q))
    : [...allCustomers];
  renderCustomerGrid(filteredCustomers);
  renderCustomerSummary(filteredCustomers);
}

// ── SET SORT ──
function setCustomerSort(mode) {
  sortMode = mode;
  document.querySelectorAll('.c-sort-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.sort === mode);
  });
  renderCustomerGrid(filteredCustomers);
}

// ── INIT ──
async function initCustomers() {
  if (customerLoaded) {
    renderCustomerSummary(filteredCustomers);
    renderCustomerGrid(filteredCustomers);
    return;
  }

  document.getElementById('customer-loading').style.display = 'flex';
  document.getElementById('customer-content').style.display = 'none';

  // Reuse cached sales if history already loaded
  let sales = allSales && allSales.length ? allSales : await fetchSalesData();
  if (!allSales.length) { allSales = sales; historyLoaded = true; }

  allCustomers      = buildCustomerList(sales);
  filteredCustomers = [...allCustomers];
  customerLoaded    = true;

  document.getElementById('customer-loading').style.display = 'none';
  document.getElementById('customer-content').style.display = 'block';

  renderCustomerSummary(filteredCustomers);
  renderCustomerGrid(filteredCustomers);
}

function refreshCustomers() {
  customerLoaded = false;
  historyLoaded  = false;
  allSales       = [];
  initCustomers();
}
