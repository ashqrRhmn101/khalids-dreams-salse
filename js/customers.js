// ══════════════════════════════════════════════
//  Khalid's Dreams — Customer Directory
// ══════════════════════════════════════════════

let allCustomers     = [];
let filteredCustomers = [];
let customerLoaded   = false;
let sortMode         = 'total'; // total | count | name | recent

// ── PAGINATION ──
const CUST_PAGE_SIZE = 20;
let customerPage = 1;
let _currentCustomerList = [];

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
  const sorted = sortCustomers(customers, sortMode);
  _currentCustomerList = sorted;
  customerPage = 1;
  _renderCustomerRows();
}

function _renderCustomerRows() {
  const grid = document.getElementById('customer-grid');
  const paged = _currentCustomerList.slice(0, customerPage * CUST_PAGE_SIZE);

  if (!paged.length) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <span class="e-icon">👥</span>
        <p>কোনো গ্রাহক পাওয়া যায়নি</p>
      </div>`;
    document.getElementById('cust-seemore-wrap')?.remove();
    return;
  }

  grid.innerHTML = paged.map((c, idx) => {
    const badge  = idx === 0 && sortMode === 'total' ? '🥇' :
                   idx === 1 && sortMode === 'total' ? '🥈' :
                   idx === 2 && sortMode === 'total' ? '🥉' : '';
    const tier    = c.totalSpent >= 10000 ? 'vip' : c.orderCount >= 5 ? 'regular' : 'new';
    const tierLbl = tier === 'vip' ? '⭐ VIP' : tier === 'regular' ? '🔄 নিয়মিত' : '🆕 নতুন';
    return `
    <div class="customer-card" onclick="openCustomerDetail('${c.phone}')">
      <div class="cust-card-top">
        <div class="cust-avatar">${c.name.charAt(0).toUpperCase()}</div>
        <div class="cust-info">
          <div class="cust-name">${badge} ${c.name}</div>
          <div class="cust-phone">📞 ${c.phone}</div>
        </div>
        <span class="cust-tier ${tier}">${tierLbl}</span>
      </div>
      ${c.district ? `<div class="cust-location">📍 ${c.district}${c.thana?' / '+c.thana:''}</div>` : ''}
      <div class="cust-stats">
        <div class="cs-item"><span class="cs-val">৳${c.totalSpent.toLocaleString('en-US')}</span><span class="cs-lbl">মোট কেনাকাটা</span></div>
        <div class="cs-item"><span class="cs-val">${c.orderCount}</span><span class="cs-lbl">মোট অর্ডার</span></div>
        <div class="cs-item"><span class="cs-val">৳${Math.round(c.totalSpent/c.orderCount).toLocaleString('en-US')}</span><span class="cs-lbl">গড় অর্ডার</span></div>
      </div>
      ${c.lastOrder ? `<div class="cust-last">🕐 সর্বশেষ: ${c.lastOrder.split(' at ')[0]}</div>` : ''}
    </div>`;
  }).join('');

  // see more
  document.getElementById('cust-seemore-wrap')?.remove();
  const remaining = _currentCustomerList.length - paged.length;
  if (remaining > 0) {
    const wrap = document.createElement('div');
    wrap.id = 'cust-seemore-wrap';
    wrap.style.cssText = 'grid-column:1/-1;text-align:center;padding:1rem 0;';
    wrap.innerHTML = `<button class="see-more-btn" onclick="customerLoadMore()">
      আরো দেখুন (${remaining}জন বাকি ↓)
    </button>`;
    grid.after(wrap);
  }

  document.getElementById('c-result-count').textContent =
    _currentCustomerList.length + 'জন গ্রাহক';
}

function customerLoadMore() {
  customerPage++;
  _renderCustomerRows();
}

// ── CUSTOMER DETAIL MODAL ──

// Store current detail customer for edit/pdf
let _detailCustomer = null;

function openCustomerDetail(phone) {
  const c = allCustomers.find(x => x.phone === phone);
  if (!c) return;
  _detailCustomer = c;

  const sorted = [...c.orders].sort((a,b) => new Date(b.timestamp||0) - new Date(a.timestamp||0));
  const orderRows = sorted.map(o => `
    <tr>
      <td><span class="inv-badge" style="font-size:.65rem;">${o.invoiceNo}</span></td>
      <td style="font-size:.75rem;color:var(--white-dim);max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${o.items||'—'}</td>
      <td style="font-size:.82rem;font-weight:700;color:var(--gold-light);">৳${Number(o.total||0).toLocaleString('en-US')}</td>
      <td style="font-size:.7rem;color:var(--white-dim);">${o.datetime ? o.datetime.split(' at ')[0] : '—'}</td>
      <td style="white-space:nowrap;">
        <button class="cd-action-btn edit-btn" title="এডিট" onclick="openInvoiceEdit('${o.invoiceNo}')">✏️</button>
        <button class="cd-action-btn pdf-btn"  title="PDF ডাউনলোড" onclick="downloadInvoicePDF('${o.invoiceNo}')">📄</button>
      </td>
    </tr>`).join('');

  document.getElementById('cd-avatar').textContent  = c.name.charAt(0).toUpperCase();
  document.getElementById('cd-name').textContent     = c.name;
  document.getElementById('cd-phone').textContent    = c.phone;
  document.getElementById('cd-location').textContent = (c.district + (c.thana?' / '+c.thana:'')) || '—';
  document.getElementById('cd-total').textContent    = '৳' + c.totalSpent.toLocaleString('en-US');
  document.getElementById('cd-count').textContent    = c.orderCount + 'টি';
  document.getElementById('cd-avg').textContent      = '৳' + Math.round(c.totalSpent/c.orderCount).toLocaleString('en-US');
  document.getElementById('cd-orders').innerHTML     = orderRows;
  document.getElementById('customer-detail-modal').classList.add('open');
}

// ── INVOICE EDIT ──
function openInvoiceEdit(invoiceNo) {
  const c = _detailCustomer;
  if (!c) return;
  const order = c.orders.find(o => o.invoiceNo === invoiceNo);
  if (!order) return;

  document.getElementById('edit-inv-no').textContent    = invoiceNo;
  document.getElementById('edit-inv-total').value       = order.total    || 0;
  document.getElementById('edit-inv-courier').value     = order.courier  || 0;
  document.getElementById('edit-inv-discount').value    = order.discount || 0;
  document.getElementById('edit-inv-advance').value     = order.advance  || 0;
  document.getElementById('edit-inv-due').value         = order.due      || 0;
  document.getElementById('edit-inv-note').value        = order.note     || '';
  document.getElementById('invoice-edit-modal').classList.add('open');
  window._editingInvoiceNo = invoiceNo;
}

function closeInvoiceEdit() {
  document.getElementById('invoice-edit-modal').classList.remove('open');
  window._editingInvoiceNo = null;
}

async function saveInvoiceEdit() {
  const invNo    = window._editingInvoiceNo;
  if (!invNo) return;
  const btn = document.getElementById('save-inv-edit-btn');
  btn.disabled = true; btn.textContent = 'সেভ হচ্ছে...';

  const updData = {
    action:    'edit_invoice',
    invoiceNo: invNo,
    total:     document.getElementById('edit-inv-total').value,
    courier:   document.getElementById('edit-inv-courier').value,
    discount:  document.getElementById('edit-inv-discount').value,
    advance:   document.getElementById('edit-inv-advance').value,
    due:       document.getElementById('edit-inv-due').value,
    note:      document.getElementById('edit-inv-note').value,
  };

  const result = await sheetCall(updData);
  if (result.success) {
    showToast('success', 'আপডেট হয়েছে! ✅', `${invNo} সফলভাবে এডিট হয়েছে।`);
    closeInvoiceEdit();
    closeCustomerDetail();
    customerLoaded = false;
    if (typeof allSales !== 'undefined') window.allSales = [];
    await initCustomers();
  } else {
    showToast('error', 'সমস্যা', 'আপডেট হয়নি। আবার চেষ্টা করুন।');
  }
  btn.disabled = false; btn.textContent = '💾 সেভ করুন';
}

// JSONP helper for sheet calls
function sheetCall(params) {
  return new Promise((resolve) => {
    const cb = 'shCb_' + Date.now();
    const p  = new URLSearchParams({ ...params, callback: cb });
    window[cb] = (resp) => {
      delete window[cb];
      try { document.head.removeChild(sc); } catch(e){}
      resolve(resp);
    };
    const sc = document.createElement('script');
    sc.src = SHEET_URL + '?' + p;
    sc.onerror = () => { delete window[cb]; resolve({ success: false }); };
    setTimeout(() => { if (window[cb]) { delete window[cb]; resolve({ success: false }); } }, 12000);
    document.head.appendChild(sc);
  });
}

// ── DOWNLOAD INVOICE PDF (re-generate from stored data) ──
async function downloadInvoicePDF(invoiceNo) {
  const c     = _detailCustomer;
  if (!c) return;
  const order = c.orders.find(o => o.invoiceNo === invoiceNo);
  if (!order) return;

  showToast('success', 'PDF তৈরি হচ্ছে...', `${invoiceNo}`);

  // Parse items string back to array
  const itemsRaw = order.items || '';
  const parsedItems = itemsRaw.split(',').map(it => {
    const m = it.match(/^(.+?)\((.+?kg)\s*×\s*৳?([\d.]+)\s*=\s*৳?([\d.]+)\)/);
    if (m) return { name: m[1].trim(), qty: parseFloat(m[2]), rate: parseFloat(m[3]), price: parseFloat(m[4]) };
    const m2 = it.match(/^(.+?)\(৳?([\d.]+)\)/);
    if (m2) return { name: m2[1].trim(), qty: 1, rate: parseFloat(m2[2]), price: parseFloat(m2[2]) };
    return { name: it.trim(), qty: 1, rate: 0, price: 0 };
  }).filter(i => i.name);

  const formData = {
    name:      c.name,
    phone:     c.phone,
    district:  c.district || '',
    thana:     c.thana    || '',
    address:   c.address  || '',
    items:     parsedItems,
    subtotal:  order.subtotal   || order.total || 0,
    courier:   order.courier    || 0,
    discount:  order.discount   || 0,
    prevDue:   0,
    advance:   order.advance    || 0,
    grandTotal:order.total      || 0,
    due:       order.due        || 0,
    datetime:  order.datetime   || '',
    note:      order.note       || '',
  };

  await generatePDF(formData, invoiceNo);
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
