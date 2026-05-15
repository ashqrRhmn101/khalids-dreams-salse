// ══════════════════════════════════════════════
//  Khalid's Dreams — Order Tracker
// ══════════════════════════════════════════════

let pendingOrders   = JSON.parse(localStorage.getItem('kd_pending') || '[]');
let trackerItems    = [];
let trackerCounter  = 0;

function savePending() {
  localStorage.setItem('kd_pending', JSON.stringify(pendingOrders));
  updatePendingBadge();
}

function updatePendingBadge() {
  const count = pendingOrders.filter(o => o.status === 'pending').length;
  const badge = document.getElementById('pending-badge');
  if (badge) {
    badge.textContent = count;
    badge.style.display = count > 0 ? 'inline' : 'none';
  }
}

// ── TRACKER STATS ──
function renderTrackerStats() {
  const pending   = pendingOrders.filter(o => o.status === 'pending').length;
  const completed = pendingOrders.filter(o => o.status === 'completed').length;
  const value     = pendingOrders
    .filter(o => o.status === 'pending')
    .reduce((s, o) => s + o.subtotal, 0);

  document.getElementById('t-pending-count').textContent  = pending;
  document.getElementById('t-done-count').textContent     = completed;
  document.getElementById('t-pending-value').textContent  = '৳' + value.toLocaleString('en-US');
}

// ── TRACKER FORM ITEMS ──
function addTrackerItem() {
  trackerCounter++;
  trackerItems.push({ id: trackerCounter, name: '', price: 0 });
  renderTrackerItems();
}

function removeTrackerItem(id) {
  if (trackerItems.length <= 1) return;
  trackerItems = trackerItems.filter(i => i.id !== id);
  renderTrackerItems();
  updateTrackerSubtotal();
}

function updateTrackerItem(id, field, value) {
  const item = trackerItems.find(i => i.id === id);
  if (!item) return;
  item[field] = field === 'price' ? (parseFloat(value) || 0) : value;
  updateTrackerSubtotal();
}

function renderTrackerItems() {
  const c = document.getElementById('tracker-items-container');
  c.innerHTML = '';
  trackerItems.forEach((item, idx) => {
    const row = document.createElement('div');
    row.className = 't-item-row';
    row.innerHTML = `
      <input type="text" placeholder="পণ্যের নাম..." value="${item.name}"
        oninput="updateTrackerItem(${item.id},'name',this.value)" />
      <input type="number" placeholder="৳ মূল্য" value="${item.price||''}" min="0"
        oninput="updateTrackerItem(${item.id},'price',this.value)" />
      <button class="remove-item-btn" onclick="removeTrackerItem(${item.id})"
        style="width:32px;height:44px;font-size:.75rem;">✕</button>`;
    c.appendChild(row);
  });
}

function updateTrackerSubtotal() {
  const sub = trackerItems.reduce((s,i) => s + i.price, 0);
  const el = document.getElementById('tracker-subtotal');
  if (el) el.textContent = '৳ ' + sub.toLocaleString('en-US', {minimumFractionDigits:2});
}

// ── ADD PENDING ORDER ──
function addPendingOrder() {
  const name    = document.getElementById('t-cust-name').value.trim();
  const phone   = document.getElementById('t-cust-phone').value.trim();
  const address = document.getElementById('t-address').value.trim();
  const note    = document.getElementById('t-note').value.trim();

  if (!name)  return showToast('error', 'দরকারি', 'গ্রাহকের নাম দিন।');
  if (!phone) return showToast('error', 'দরকারি', 'ফোন নম্বর দিন।');
  const validItems = trackerItems.filter(i => i.name.trim());
  if (!validItems.length) return showToast('error', 'দরকারি', 'কমপক্ষে একটি পণ্য দিন।');

  const subtotal = validItems.reduce((s,i) => s + i.price, 0);
  const order = {
    id:        'ord_' + Date.now(),
    name, phone, address, note,
    items:     validItems,
    subtotal,
    status:    'pending',
    createdAt: new Date().toISOString(),
  };

  pendingOrders.unshift(order);
  savePending();

  // Reset form
  document.getElementById('t-cust-name').value  = '';
  document.getElementById('t-cust-phone').value = '';
  document.getElementById('t-address').value    = '';
  document.getElementById('t-note').value       = '';
  trackerItems = []; trackerCounter = 0;
  addTrackerItem();

  renderTrackerStats();
  renderPendingList();
  showToast('success', 'পেন্ডিং যোগ হয়েছে!', `${name}-এর অর্ডার পেন্ডিং লিস্টে রাখা হয়েছে।`);
}

// ── RENDER PENDING LIST ──
function renderPendingList() {
  const container = document.getElementById('pending-list');
  if (!container) return;

  const sorted = [...pendingOrders].sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));

  if (sorted.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <span class="e-icon">⏳</span>
        <p>কোনো পেন্ডিং অর্ডার নেই</p>
      </div>`;
    return;
  }

  container.innerHTML = sorted.map(order => {
    const age      = getAgeText(order.createdAt);
    const isOld    = getDaysOld(order.createdAt) >= 2;
    const isDone   = order.status === 'completed';
    const itemHTML = order.items.map(i => `
      <div class="item-line">
        <span>${i.name}</span>
        <span>৳${Number(i.price).toLocaleString('en-US')}</span>
      </div>`).join('');

    return `
    <div class="pending-card ${isDone ? 'completed' : ''}" id="card-${order.id}">
      <div class="pending-card-top">
        <div class="pending-card-info">
          <div class="p-cust-name">👤 ${order.name}</div>
          <div class="p-cust-phone">📞 ${order.phone}</div>
        </div>
        <span class="pending-status ${isDone ? 'done-tag' : 'waiting'}">
          ${isDone ? '✅ সম্পন্ন' : '⏳ পেন্ডিং'}
        </span>
      </div>
      <div class="pending-card-meta">
        ${order.address ? `<span>📍 ${order.address}</span>` : ''}
        <span>🕐 ${age} <span class="age-tag ${isOld ? 'old' : ''}">${isOld ? 'পুরনো!' : 'নতুন'}</span></span>
      </div>
      <div class="pending-items-preview">
        ${itemHTML}
        <div class="pending-total-line">
          <span class="pt-label">মোট</span>
          <span class="pt-value">৳ ${Number(order.subtotal).toLocaleString('en-US', {minimumFractionDigits:2})}</span>
        </div>
      </div>
      ${order.note ? `<div style="font-size:.75rem;color:var(--white-dim);margin-bottom:.75rem;padding:.5rem .75rem;background:var(--dark-3);border-radius:7px;">📝 ${order.note}</div>` : ''}
      ${!isDone ? `
      <div class="pending-actions">
        <button class="pend-btn complete-btn" onclick="completeOrder('${order.id}')">
          🧾 সেল সম্পন্ন ও PDF ডাউনলোড
        </button>
        <button class="pend-btn delete-btn" onclick="deletePendingOrder('${order.id}')">🗑️</button>
      </div>` : `
      <div style="font-size:.75rem;color:#81c784;text-align:center;padding:.4rem;">
        ✅ সম্পন্ন হয়েছে
      </div>`}
    </div>`;
  }).join('');
}

// ── COMPLETE ORDER (PDF + Sheet) ──
async function completeOrder(id) {
  const order = pendingOrders.find(o => o.id === id);
  if (!order) return;

  const btn = document.querySelector(`#card-${id} .complete-btn`);
  if (btn) { btn.disabled = true; btn.textContent = 'প্রসেস হচ্ছে...'; }

  const invNo = 'KD-' + Date.now().toString().slice(-6);

  // Build formData same as home page
  const formData = {
    name:      order.name,
    phone:     order.phone,
    district:  order.address || '',
    thana:     '',
    address:   order.address || '',
    items:     order.items,
    subtotal:  order.subtotal,
    datetime:  new Date().toLocaleString('en-US', {year:'numeric',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:true}),
    note:      order.note || '',
    timestamp: new Date().toISOString(),
  };

  try {
    await generatePDF(formData, invNo);
    await saveToGoogleSheets(formData, invNo);

    // Update daily totals
    dailyTotal += order.subtotal;
    dailySales += 1;
    localStorage.setItem('kd_daily_total', dailyTotal.toString());
    localStorage.setItem('kd_daily_sales', dailySales.toString());
    localStorage.setItem('kd_last_date', new Date().toDateString());
    updateDailyDisplay();

    // Mark completed
    order.status = 'completed';
    order.completedAt = new Date().toISOString();
    savePending();
    renderTrackerStats();
    renderPendingList();
    showToast('success', 'সম্পন্ন!', 'PDF ডাউনলোড ও Google Sheets-এ সেভ হয়েছে।');

  } catch(e) {
    console.error(e);
    showToast('error', 'ত্রুটি', 'সমস্যা হয়েছে, আবার চেষ্টা করুন।');
    if (btn) { btn.disabled = false; btn.textContent = '🧾 সেল সম্পন্ন ও PDF ডাউনলোড'; }
  }
}

// ── DELETE PENDING ──
function deletePendingOrder(id) {
  if (!confirm('এই অর্ডারটি মুছে ফেলবেন?')) return;
  pendingOrders = pendingOrders.filter(o => o.id !== id);
  savePending();
  renderTrackerStats();
  renderPendingList();
  showToast('success', 'মুছে গেছে', 'অর্ডারটি সরানো হয়েছে।');
}

// ── TIME HELPERS ──
function getDaysOld(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.floor(diff / (1000*60*60*24));
}

function getAgeText(dateStr) {
  const ms   = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(ms/60000);
  const hrs  = Math.floor(ms/3600000);
  const days = Math.floor(ms/86400000);
  if (mins < 1)  return 'এইমাত্র';
  if (mins < 60) return `${mins} মিনিট আগে`;
  if (hrs < 24)  return `${hrs} ঘণ্টা আগে`;
  return `${days} দিন আগে`;
}

// ── INIT ──
function initTracker() {
  trackerItems = []; trackerCounter = 0;
  addTrackerItem();
  renderTrackerStats();
  renderPendingList();
  updatePendingBadge();
}
