// ══════════════════════════════════════════════
//  Khalid's Dreams — Steadfast Integration v9
// ══════════════════════════════════════════════

// ── JSONP helper ──
function sfCall(params) {
  return new Promise((resolve) => {
    const cb = 'sfCb_' + Date.now();
    const p  = new URLSearchParams({ ...params, callback: cb });
    window[cb] = (resp) => {
      delete window[cb];
      try { document.head.removeChild(sc); } catch(e){}
      resolve(resp);
    };
    const sc = document.createElement('script');
    sc.src = SHEET_URL + '?' + p;
    sc.onerror = () => { delete window[cb]; resolve({ success: false, error: 'network' }); };
    setTimeout(() => {
      if (window[cb]) { delete window[cb]; try { document.head.removeChild(sc); } catch(e){} resolve({ success: false, error: 'timeout' }); }
    }, 15000);
    document.head.appendChild(sc);
  });
}

// ── STATUS LABEL & COLOR ──
function sfStatusLabel(status) {
  const map = {
    'pending':           { label: '⏳ পেন্ডিং',       color: '#f59e0b' },
    'in_review':         { label: '🔍 রিভিউতে',        color: '#8b5cf6' },
    'processing':        { label: '📦 প্রসেসিং',       color: '#3b82f6' },
    'picked_up':         { label: '🚚 পিকআপ হয়েছে',   color: '#06b6d4' },
    'in_transit':        { label: '🛣️ ট্রানজিটে',     color: '#6366f1' },
    'out_for_delivery':  { label: '🏃 ডেলিভারিতে',    color: '#f97316' },
    'delivered':         { label: '✅ ডেলিভারড',       color: '#22c55e' },
    'partial_delivered': { label: '⚠️ আংশিক ডেলিভারড',color: '#eab308' },
    'cancelled':         { label: '❌ বাতিল',          color: '#ef4444' },
    'hold':              { label: '⏸️ হোল্ড',          color: '#94a3b8' },
    'returned':          { label: '↩️ ফেরত',           color: '#f43f5e' },
  };
  return map[status?.toLowerCase()] || { label: status || '—', color: '#94a3b8' };
}

// ── FRAUDBD: Phone দিয়ে customer history check ──
let fraudBdCache = {};

async function checkSteadfastPhone(phone) {
  const norm = normalizePhone(phone);
  if (norm.length < 11) return;

  // Show loading badge
  const el = document.getElementById('sf-customer-badge');
  if (el) {
    el.style.display = 'block';
    el.innerHTML = '<div class="sf-badge-wrap"><span class="sf-badge-title">🔍 গ্রাহকের ইতিহাস যাচাই হচ্ছে...</span></div>';
  }

  if (fraudBdCache[norm]) { renderSfBadge(fraudBdCache[norm]); return; }

  const result = await sfCall({ action: 'fraudbd_check', phone: norm });

  if (!result.success) {
    if (el) el.style.display = 'none';
    return;
  }

  const sf  = result.steadfast  || { total:0, success:0, cancel:0 };
  const all = result.allCouriers || { total:0, success:0, cancel:0 };

  const info = {
    sfTotal:    sf.total,
    sfSuccess:  sf.success,
    sfCancel:   sf.cancel,
    sfCancelRate: sf.total > 0 ? Math.round((sf.cancel / sf.total) * 100) : 0,
    allTotal:   all.total,
    allSuccess: all.success,
    allCancel:  all.cancel,
    allCancelRate: all.total > 0 ? Math.round((all.cancel / all.total) * 100) : 0,
  };

  fraudBdCache[norm] = info;
  renderSfBadge(info);
}

function renderSfBadge(info) {
  const el = document.getElementById('sf-customer-badge');
  if (!el) return;

  if (info.sfTotal === 0 && info.allTotal === 0) {
    el.style.display = 'block';
    el.innerHTML = '<span class="sf-badge new">🆕 কোনো courier ইতিহাস নেই — নতুন গ্রাহক</span>';
    return;
  }

  // Risk based on Steadfast cancel rate (or all-courier if no SF data)
  const rate      = info.sfTotal > 0 ? info.sfCancelRate : info.allCancelRate;
  const riskColor = rate >= 50 ? '#ef4444' : rate >= 30 ? '#f59e0b' : '#22c55e';
  const riskLabel = rate >= 50 ? '⚠️ উচ্চ ঝুঁকি — সতর্কতার সাথে অর্ডার করুন'
                  : rate >= 30 ? '🔶 মাঝারি ঝুঁকি'
                  : '✅ নির্ভরযোগ্য গ্রাহক';

  el.style.display = 'block';
  el.innerHTML = `
    <div class="sf-badge-wrap">
      <span class="sf-badge-title">📦 Courier ইতিহাস (FraudBD)</span>
      <div class="sf-badge-sections">
        ${info.sfTotal > 0 ? `
        <div class="sf-section">
          <div class="sf-section-title">🚚 Steadfast</div>
          <div class="sf-stats">
            <span class="sf-stat-item">মোট: <b>${info.sfTotal}</b></span>
            <span class="sf-stat-item" style="color:#22c55e">ডেলিভারড: <b>${info.sfSuccess}</b></span>
            <span class="sf-stat-item" style="color:#ef4444">বাতিল: <b>${info.sfCancel}</b></span>
            <span class="sf-stat-item">Cancel Rate: <b>${info.sfCancelRate}%</b></span>
          </div>
        </div>` : ''}
        ${info.allTotal > info.sfTotal ? `
        <div class="sf-section">
          <div class="sf-section-title">🌐 সব Courier মিলিয়ে</div>
          <div class="sf-stats">
            <span class="sf-stat-item">মোট: <b>${info.allTotal}</b></span>
            <span class="sf-stat-item" style="color:#22c55e">ডেলিভারড: <b>${info.allSuccess}</b></span>
            <span class="sf-stat-item" style="color:#ef4444">বাতিল: <b>${info.allCancel}</b></span>
          </div>
        </div>` : ''}
      </div>
      <div class="sf-stat-risk" style="color:${riskColor};margin-top:.5rem;font-size:.82rem;font-weight:700;">
        ${riskLabel} (Cancel: ${rate}%)
      </div>
    </div>`;
}

// ── CREATE STEADFAST ORDER ──
async function createSteadfastOrder(formData, invNo) {
  // Build full address for Steadfast label
  const addressParts = [
    formData.address,
    formData.thana,
    formData.district,
  ].filter(Boolean);
  const fullAddress = addressParts.join(', ');

  const result = await sfCall({
    action:    'steadfast_order',
    invoiceNo: invNo,           // ★ This shows on shipping label
    name:      formData.name,
    phone:     formData.phone,
    address:   fullAddress,
    codAmount: formData.due || formData.grandTotal || 0,
    note:      formData.note || '',
  });

  if (result.success) {
    console.log('Steadfast order created:', result.trackingCode, result.consignmentId);
  }
  return result;
}

// ── CANCEL STEADFAST ORDER ──
async function cancelSteadfastOrder(consignmentId, invoiceNo) {
  if (!confirm(`Invoice ${invoiceNo} — Steadfast-এ বাতিল করবেন?`)) return;

  const result = await sfCall({
    action:        'steadfast_cancel',
    consignmentId: consignmentId,
    invoiceNo:     invoiceNo,
  });

  if (result.success) {
    showToast('success', 'বাতিল সফল ✅', `${invoiceNo} Steadfast-এ বাতিল হয়েছে।`);
    trackingLoaded = false;
    if (typeof window.allSales !== 'undefined') window.allSales = [];
    await initTracking();
  } else {
    showToast('error', 'সমস্যা', result.message || 'বাতিল করা যায়নি।');
  }
  return result;
}

// ── TRACKING PAGE ──
let trackingData   = [];
let trackingLoaded = false;
let trackingRange  = 'all';
let trackingFilter = '';

async function initTracking() {
  if (trackingLoaded && trackingData.length) {
    renderTrackingStats();
    renderTrackingList();
    return;
  }

  document.getElementById('tracking-loading').style.display = 'flex';
  document.getElementById('tracking-content').style.display = 'none';

  // Reuse cached sales
  let sales = (typeof allSales !== 'undefined' && allSales && allSales.length)
    ? allSales : await (typeof fetchSalesData === 'function' ? fetchSalesData() : Promise.resolve([]));

  if (typeof window.allSales !== 'undefined') window.allSales = sales;

  // Only rows that have a consignment ID (sent via Steadfast)
  trackingData   = sales.filter(s => s.sfConsign || s.trackingCode);
  trackingLoaded = true;

  document.getElementById('tracking-loading').style.display = 'none';
  document.getElementById('tracking-content').style.display = 'block';

  renderTrackingStats();
  renderTrackingList();
}

function renderTrackingStats() {
  const data      = trackingData;
  const total     = data.length;
  const delivered = data.filter(s => s.sfStatus === 'delivered').length;
  const pending   = data.filter(s => !['delivered','cancelled'].includes(s.sfStatus)).length;
  const cancelled = data.filter(s => s.sfStatus === 'cancelled').length;

  document.getElementById('tr-total').textContent     = total;
  document.getElementById('tr-delivered').textContent  = delivered;
  document.getElementById('tr-pending').textContent    = pending;
  document.getElementById('tr-cancelled').textContent  = cancelled;
}

function renderTrackingList() {
  const list = document.getElementById('tracking-list');
  if (!list) return;

  const q = trackingFilter.toLowerCase();
  let filtered = trackingData;
  if (q) {
    filtered = filtered.filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.phone.includes(q) ||
      s.invoiceNo.toLowerCase().includes(q) ||
      (s.trackingCode||'').toLowerCase().includes(q)
    );
  }
  if (trackingRange !== 'all') {
    const cutoff = Date.now() - parseInt(trackingRange) * 86400000;
    filtered = filtered.filter(s => {
      const ts = s.timestamp ? new Date(s.timestamp).getTime() : 0;
      return ts >= cutoff;
    });
  }
  // Sort: pending first, then by date desc
  filtered.sort((a, b) => {
    const aFinal = ['delivered','cancelled'].includes(a.sfStatus);
    const bFinal = ['delivered','cancelled'].includes(b.sfStatus);
    if (aFinal !== bFinal) return aFinal ? 1 : -1;
    return new Date(b.timestamp||0) - new Date(a.timestamp||0);
  });

  document.getElementById('tr-result-count').textContent = filtered.length + 'টি শিপমেন্ট';

  if (!filtered.length) {
    list.innerHTML = `<div class="empty-state"><span class="e-icon">📦</span><p>কোনো Steadfast অর্ডার পাওয়া যায়নি</p></div>`;
    return;
  }

  list.innerHTML = filtered.map(s => {
    const sf = sfStatusLabel(s.sfStatus);
    return `
    <div class="tracking-card">
      <div class="tracking-card-top">
        <div class="tracking-inv">
          <span class="inv-badge">${s.invoiceNo}</span>
          ${s.trackingCode ? `<span class="tracking-code">🔖 ${s.trackingCode}</span>` : ''}
        </div>
        <span class="sf-status-tag" style="background:${sf.color}22;color:${sf.color};border:1px solid ${sf.color}44;">
          ${sf.label}
        </span>
      </div>
      <div class="tracking-card-body">
        <div class="tracking-cust">
          <span class="tc-name">👤 ${s.name}</span>
          <span class="tc-phone">📞 ${s.phone}</span>
          <span class="tc-loc">📍 ${s.district}${s.thana?' / '+s.thana:''}</span>
        </div>
        <div class="tracking-amount">
          <span class="ta-label">COD</span>
          <span class="ta-value">৳${Number(s.total||0).toLocaleString('en-US')}</span>
        </div>
      </div>
      <div class="tracking-card-footer">
        <span class="tc-date">${s.datetime ? s.datetime.split(' at ')[0] : '—'}</span>
        ${s.sfConsign ? `<button class="tr-refresh-btn" onclick="refreshSingleStatus('${s.sfConsign}','${s.invoiceNo}',this)">🔄 আপডেট করুন</button>` : ''}
      </div>
    </div>`;
  }).join('');
}

// ── REFRESH SINGLE STATUS ──
async function refreshSingleStatus(consignId, invoiceNo, btn) {
  if (btn) { btn.disabled = true; btn.textContent = '...'; }
  const result = await sfCall({ action: 'steadfast_track', consignmentId: consignId });
  if (result.success && result.data) {
    const newStatus = (result.data.delivery_status || result.data.status || '').toLowerCase();
    // Update local data
    const item = trackingData.find(s => s.sfConsign === consignId);
    if (item && newStatus) item.sfStatus = newStatus;
    renderTrackingList();
    renderTrackingStats();
    showToast('success', 'আপডেট হয়েছে', `${invoiceNo}: ${sfStatusLabel(newStatus).label}`);
  } else {
    showToast('error', 'সমস্যা', 'Status আপডেট করা যায়নি।');
  }
  if (btn) { btn.disabled = false; btn.textContent = '🔄 আপডেট করুন'; }
}

// ── REFRESH ALL STATUSES ──
async function refreshAllTrackingStatuses() {
  const btn = document.getElementById('tr-refresh-all-btn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ আপডেট হচ্ছে...'; }
  const result = await sfCall({ action: 'update_statuses' });
  if (result.success) {
    showToast('success', 'সম্পন্ন!', `${result.updated || 0}টি status আপডেট হয়েছে।`);
    trackingLoaded = false;
    if (typeof window.allSales !== 'undefined') window.allSales = [];
    await initTracking();
  } else {
    showToast('error', 'সমস্যা', 'Batch update হয়নি।');
  }
  if (btn) { btn.disabled = false; btn.textContent = '🔄 সব আপডেট করুন'; }
}

function setTrackingRange(range) {
  trackingRange = range;
  document.querySelectorAll('.tr-range-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.range === range));
  renderTrackingList();
}

function searchTracking() {
  trackingFilter = document.getElementById('tr-search').value.trim();
  renderTrackingList();
}

function refreshTracking() {
  trackingLoaded = false;
  if (typeof window.allSales !== 'undefined') window.allSales = [];
  initTracking();
}
