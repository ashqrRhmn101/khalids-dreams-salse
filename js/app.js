// ══════════════════════════════════════════════
//  Khalid's Dreams — Sales App v11
//  Fixes: Invoice sync, Bangla PDF, Mobile UI
// ══════════════════════════════════════════════

// ── YOUR GOOGLE SHEET URL ──


// ── STATE ──
let orderItems  = [];
let itemCounter = 0;
let dailyTotal  = parseFloat(localStorage.getItem('kd_daily_total') || '0');
let dailySales  = parseInt(localStorage.getItem('kd_daily_sales')  || '0');

// Reset daily totals at midnight
const lastDate = localStorage.getItem('kd_last_date');
const todayStr = new Date().toDateString();
if (lastDate !== todayStr) {
  dailyTotal = 0; dailySales = 0;
  localStorage.setItem('kd_daily_total', '0');
  localStorage.setItem('kd_daily_sales', '0');
  localStorage.setItem('kd_last_date', todayStr);
}

// ── PHONE NORMALIZE (adds missing leading 0) ──
function normalizePhone(phone) {
  let p = String(phone || '').trim().replace(/[\s\-]/g, '');
  p = p.replace(/^\+?88/, ''); // remove country code if present
  if (p.length === 10 && p.startsWith('1')) p = '0' + p; // 1XXXXXXXXX -> 01XXXXXXXXX
  return p;
}

// ── CUSTOMER AUTO-FILL (repeat customer lookup) ──
let customerLookupCache = null; // { phone: {name, district, thana, address} }
let customerLookupLoading = false;

async function ensureCustomerLookup() {
  if (customerLookupCache) return customerLookupCache;
  if (customerLookupLoading) return null;
  customerLookupLoading = true;

  const sales = (typeof allSales !== 'undefined' && allSales && allSales.length)
    ? allSales
    : await fetchSalesDataSafe();

  const map = {};
  sales.forEach(s => {
    const key = normalizePhone(s.phone);
    if (!key) return;
    const ts = s.timestamp ? new Date(s.timestamp).getTime() : 0;
    if (!map[key]) {
      map[key] = { name:'', district:'', thana:'', address:'', _ts:0, previousDue:0 };
    }
    // accumulate due from all invoices of this phone
    map[key].previousDue += parseFloat(s.due) || 0;
    // keep latest customer info
    if (ts > map[key]._ts) {
      map[key]._ts      = ts;
      map[key].name     = s.name     || map[key].name;
      map[key].district = s.district || map[key].district;
      map[key].thana    = s.thana    || map[key].thana;
      map[key].address  = s.address  || map[key].address;
    }
  });

  customerLookupCache = map;
  customerLookupLoading = false;
  return map;
}

// Safe fetch wrapper in case history.js fetchSalesData isn't loaded yet
async function fetchSalesDataSafe() {
  if (typeof fetchSalesData === 'function') {
    try { return await fetchSalesData(); } catch(e) { return []; }
  }
  return [];
}

async function onPhoneInputLookup(inputEl) {
  const phone = normalizePhone(inputEl.value);
  if (phone.length < 11) return;

  const map = await ensureCustomerLookup();
  if (!map) return;
  const match = map[phone];
  if (!match) return;

  // Fill name
  const nameEl = document.getElementById('cust-name');
  if (nameEl && !nameEl.value.trim()) nameEl.value = match.name || '';

  // Fill district/thana
  if (match.district) {
    const distSel = document.getElementById('district');
    if (distSel && !distSel.value) {
      distSel.value = match.district;
      onDistrictChange();
      setTimeout(() => {
        const thanaSel = document.getElementById('thana');
        if (thanaSel && match.thana) thanaSel.value = match.thana;
      }, 50);
    }
  }

  // Fill address
  const addrEl = document.getElementById('address');
  if (addrEl && !addrEl.value.trim() && match.address) addrEl.value = match.address;

  // ★ Auto-fill previous due
  const prevDueEl = document.getElementById('prev-due');
  if (prevDueEl && match.previousDue > 0) {
    prevDueEl.value = match.previousDue.toFixed(2);
    updateGrandTotal();
  }

  const dueMsg = match.previousDue > 0
    ? ` | পূর্বের বাকি: ৳${match.previousDue.toLocaleString('en-US')}`
    : '';
  showToast('success', 'পরিচিত গ্রাহক! 👋', `${match.name}-এর তথ্য অটো-ফিল হয়েছে।${dueMsg}`);

  // Steadfast fraud/history check (async, non-blocking)
  if (typeof checkSteadfastPhone === 'function') {
    checkSteadfastPhone(phone);
  }
}

// ── DISTRICTS & THANAS ──
function populateDistricts() {
  const sel = document.getElementById('district');
  Object.keys(bangladeshData).sort().forEach(d => {
    const o = document.createElement('option');
    o.value = d; o.textContent = d;
    sel.appendChild(o);
  });
}

function onDistrictChange() {
  const d  = document.getElementById('district').value;
  const ts = document.getElementById('thana');
  ts.innerHTML = '<option value="">-- Thana select করুন --</option>';
  if (d && bangladeshData[d]) {
    bangladeshData[d].sort().forEach(t => {
      const o = document.createElement('option');
      o.value = t; o.textContent = t;
      ts.appendChild(o);
    });
  }
}

// ── ORDER ITEMS ──
function addOrderItem() {
  itemCounter++;
  orderItems.push({ id: itemCounter, name: '', qty: 1, rate: 0, price: 0 });
  renderOrderItems();
}

function removeOrderItem(id) {
  if (orderItems.length <= 1) {
    return showToast('error', 'সরানো যাবে না', 'কমপক্ষে একটি পণ্য থাকতে হবে।');
  }
  orderItems = orderItems.filter(i => i.id !== id);
  renderOrderItems();
  updateOrderSubtotal();
}

function updateItem(id, field, value) {
  const item = orderItems.find(i => i.id === id);
  if (!item) return;
  if (field === 'qty')  item.qty  = parseFloat(value) || 0;
  else if (field === 'rate') item.rate = parseFloat(value) || 0;
  else if (field === 'name') item.name = value;
  // auto-calculate price = qty × rate
  item.price = parseFloat((item.qty * item.rate).toFixed(2));
  // update price display
  const priceEl = document.getElementById(`price-display-${id}`);
  if (priceEl) priceEl.textContent = '৳ ' + item.price.toLocaleString('en-US', {minimumFractionDigits:2});
  updateOrderSubtotal();
}

function renderOrderItems() {
  const c = document.getElementById('order-items-container');
  c.innerHTML = '';
  orderItems.forEach((item, idx) => {
    const row = document.createElement('div');
    row.className = 'item-row-v7';
    row.innerHTML = `
      <div class="item-row-top">
        <div class="serial">${idx + 1}</div>
        <div class="form-group" style="margin:0;flex:1;">
          <input type="text" placeholder="পণ্যের নাম..." value="${item.name}"
            oninput="updateItem(${item.id},'name',this.value)" />
        </div>
        <button class="remove-item-btn" onclick="removeOrderItem(${item.id})" title="সরান">✕</button>
      </div>
      <div class="item-row-bottom">
        <div class="form-group" style="margin:0;">
          <label style="font-size:.62rem;color:var(--white-dim);">পরিমাণ (কেজি)</label>
          <input type="number" placeholder="0.5" value="${item.qty||''}" min="0" step="0.1"
            oninput="updateItem(${item.id},'qty',this.value)" />
        </div>
        <div class="item-multiply">×</div>
        <div class="form-group" style="margin:0;">
          <label style="font-size:.62rem;color:var(--white-dim);">দর (৳/কেজি)</label>
          <input type="number" placeholder="500" value="${item.rate||''}" min="0"
            oninput="updateItem(${item.id},'rate',this.value)" />
        </div>
        <div class="item-equals">=</div>
        <div class="item-price-result">
          <label style="font-size:.62rem;color:var(--white-dim);">মোট</label>
          <div class="price-result-val" id="price-display-${item.id}">
            ৳ ${item.price.toLocaleString('en-US', {minimumFractionDigits:2})}
          </div>
        </div>
      </div>`;
    c.appendChild(row);
  });
}

function updateOrderSubtotal() {
  const sub = orderItems.reduce((s,i) => s + i.price, 0);
  document.getElementById('order-subtotal').textContent =
    '৳ ' + sub.toLocaleString('en-US', {minimumFractionDigits:2});
  // also update grand total
  updateGrandTotal();
}

// ── GRAND TOTAL CALCULATION ──
function updateGrandTotal() {
  const subtotal  = orderItems.reduce((s,i) => s + i.price, 0);
  const advance   = parseFloat(document.getElementById('advance')?.value)  || 0;
  const courier   = parseFloat(document.getElementById('courier')?.value)  || 0;
  const discount  = parseFloat(document.getElementById('discount')?.value) || 0;
  const prevDue   = parseFloat(document.getElementById('prev-due')?.value) || 0;

  const grandTotal = subtotal + courier - discount + prevDue;
  const due        = Math.max(0, grandTotal - advance);

  const fmt = v => '৳ ' + v.toLocaleString('en-US', {minimumFractionDigits:2});

  const gtEl  = document.getElementById('grand-total-display');
  const dueEl = document.getElementById('due-display');
  if (gtEl)  gtEl.textContent = fmt(grandTotal);
  if (dueEl) dueEl.textContent = fmt(due);

  window._calcData = { subtotal, advance, courier, discount, prevDue, grandTotal, due };
}


function setDateTime() {
  const now = new Date();
  const display = now.toLocaleString('en-US', {
    year:'numeric', month:'long', day:'numeric',
    hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:true
  });
  document.getElementById('datetime-display').textContent = display;
  document.getElementById('datetime-value').value = now.toISOString();
}

// ── NAV CLOCK ──
function updateNavClock() {
  const el = document.getElementById('nav-datetime');
  if (!el) return;
  const now = new Date();
  el.textContent = now.toLocaleString('en-US', {
    month:'short', day:'numeric',
    hour:'2-digit', minute:'2-digit', hour12:true
  });
}

// ── DAILY STATS DISPLAY ──
function updateDailyDisplay() {
  const el = document.getElementById('daily-total-value');
  if (el) el.innerHTML =
    '<span class="currency-sign">৳</span>' +
    dailyTotal.toLocaleString('en-US', {minimumFractionDigits:2});
  const sc = document.getElementById('daily-sales-count');
  if (sc) sc.textContent = dailySales;
}

// ── VALIDATION ──
function validateForm() {
  const checks = [
    [!document.getElementById('cust-name').value.trim(), 'গ্রাহকের নাম দিন'],
    [!document.getElementById('cust-phone').value.trim(), 'ফোন নম্বর দিন'],
    [!document.getElementById('district').value, 'জেলা সিলেক্ট করুন'],
    [!orderItems.some(i => i.name.trim()), 'কমপক্ষে একটি পণ্য যোগ করুন'],
  ];
  for (const [fail, msg] of checks) {
    if (fail) { showToast('error', 'প্রয়োজনীয়', msg); return false; }
  }
  return true;
}

async function generatePDF(data, invNo) {
  const validItems = data.items.filter(i => i.name.trim());

  const itemRows = validItems.map((item, idx) => `
    <tr style="background:${idx%2===0?'#f7f5f0':'#ffffff'}">
      <td style="padding:7px 10px;color:#1a1a1a;font-size:12px;">${idx+1}</td>
      <td style="padding:7px 10px;color:#1a1a1a;font-size:12px;">${item.name}</td>
      <td style="padding:7px 10px;color:#1a1a1a;font-size:12px;text-align:center;">${item.qty} কেজি</td>
      <td style="padding:7px 10px;color:#1a1a1a;font-size:12px;text-align:right;">৳${Number(item.rate).toLocaleString('en-US')}</td>
      <td style="padding:7px 10px;color:#1a1a1a;font-size:12px;text-align:right;font-weight:600;">
        ৳${Number(item.price).toLocaleString('en-US', {minimumFractionDigits:2})}
      </td>
    </tr>`).join('');

  const subtotal   = data.subtotal   || 0;
  const advance    = data.advance    || 0;
  const courier    = data.courier    || 0;
  const discount   = data.discount   || 0;
  const grandTotal = data.grandTotal || subtotal;
  const due        = data.due        || grandTotal;

  const finRows = `
    <tr>
      <td colspan="2" style="padding:6px 10px;font-size:11px;color:#5a5040;">পণ্যের মোট (Subtotal)</td>
      <td style="padding:6px 10px;font-size:11px;text-align:right;color:#1a1a1a;">৳${subtotal.toLocaleString('en-US',{minimumFractionDigits:2})}</td>
    </tr>
    ${courier > 0 ? `<tr>
      <td colspan="2" style="padding:6px 10px;font-size:11px;color:#5a5040;">কুরিয়ার চার্জ</td>
      <td style="padding:6px 10px;font-size:11px;text-align:right;color:#1a1a1a;">+ ৳${courier.toLocaleString('en-US',{minimumFractionDigits:2})}</td>
    </tr>` : ''}
    ${discount > 0 ? `<tr>
      <td colspan="2" style="padding:6px 10px;font-size:11px;color:#5a5040;">ছাড় (Discount)</td>
      <td style="padding:6px 10px;font-size:11px;text-align:right;color:#c0392b;">- ৳${discount.toLocaleString('en-US',{minimumFractionDigits:2})}</td>
    </tr>` : ''}
    ${prevDue > 0 ? `<tr>
      <td colspan="2" style="padding:6px 10px;font-size:11px;color:#e57373;font-weight:600;">পূর্বের জের (Previous Due)</td>
      <td style="padding:6px 10px;font-size:11px;text-align:right;color:#e57373;font-weight:600;">+ ৳${prevDue.toLocaleString('en-US',{minimumFractionDigits:2})}</td>
    </tr>` : ''}
    ${advance > 0 ? `<tr>
      <td colspan="2" style="padding:6px 10px;font-size:11px;color:#5a5040;">অগ্রিম প্রদান</td>
      <td style="padding:6px 10px;font-size:11px;text-align:right;color:#27ae60;">- ৳${advance.toLocaleString('en-US',{minimumFractionDigits:2})}</td>
    </tr>` : ''}`;

  const receiptHTML = `
  <div id="pdf-receipt" style="
    width:595px;background:#ffffff;font-family:'Hind Siliguri','Noto Sans Bengali',sans-serif;
    padding:0;margin:0;position:fixed;top:-9999px;left:-9999px;z-index:-1;">
    <div style="background:#ffffff;padding:20px 28px 14px;border-bottom:3px solid #C9A84C;">
      <div style="display:flex;align-items:center;justify-content:center;gap:10px;margin-bottom:4px;">
        <div style="width:40px;height:40px;background:linear-gradient(135deg,#C9A84C,#9A7830);border-radius:9px;display:flex;align-items:center;justify-content:center;font-family:Georgia,serif;font-weight:900;font-size:17px;color:#fff;flex-shrink:0;">KD</div>
        <div style="font-size:24px;font-weight:900;color:#9A7830;letter-spacing:1px;font-family:Georgia,serif;">Khalid\'s Dreams</div>
      </div>
      <div style="text-align:center;font-size:11px;color:#7a7060;letter-spacing:3px;">INVOICE / SALES RECEIPT</div>
      <div style="text-align:center;margin-top:10px;padding-top:10px;border-top:1px solid #e8e0d0;">
        <div style="font-size:13px;font-weight:700;color:#1a1a1a;margin-bottom:2px;">Khalid Bin Walid</div>
        <div style="font-size:11px;color:#5a5040;margin-bottom:2px;">Kalibari Road, Sirajganj</div>
        <div style="font-size:11px;color:#5a5040;">Contact: 01710979757 | 01710721807</div>
      </div>
      <div style="display:flex;justify-content:space-between;margin-top:10px;font-size:11px;color:#7a7060;">
        <span>Invoice: <b style="color:#9A7830;">${invNo}</b></span>
        <span>${data.datetime || new Date().toLocaleString('en-US')}</span>
      </div>
    </div>
    <div style="margin:14px 20px 0;background:#f7f5f0;border:1px solid #C9A84C;border-radius:10px;padding:12px 16px;">
      <div style="font-size:10px;color:#9a7830;letter-spacing:2px;font-weight:700;margin-bottom:8px;">গ্রাহকের তথ্য / CUSTOMER INFORMATION</div>
      ${[['নাম',data.name],['ফোন',data.phone],['জেলা',data.district+(data.thana?' — '+data.thana:'')],['ঠিকানা',data.address||'—']].map(([k,v])=>`
        <div style="display:flex;padding:4px 0;border-bottom:1px solid #e8e0d0;">
          <span style="width:70px;font-size:11px;color:#5a5040;flex-shrink:0;">${k}:</span>
          <span style="font-size:12px;color:#1a1a1a;font-weight:500;">${v}</span>
        </div>`).join('')}
    </div>
    <div style="margin:12px 20px 0;">
      <div style="font-size:10px;color:#9a7830;letter-spacing:2px;font-weight:700;margin-bottom:8px;">অর্ডার বিবরণ / ORDER DETAILS</div>
      <table style="width:100%;border-collapse:collapse;border:1px solid #C9A84C;">
        <thead>
          <tr style="background:#f0e8d0;">
            <th style="padding:8px;text-align:left;font-size:10px;color:#9a7830;font-weight:700;">#</th>
            <th style="padding:8px;text-align:left;font-size:10px;color:#9a7830;font-weight:700;">পণ্যের নাম</th>
            <th style="padding:8px;text-align:center;font-size:10px;color:#9a7830;font-weight:700;">পরিমাণ</th>
            <th style="padding:8px;text-align:right;font-size:10px;color:#9a7830;font-weight:700;">দর/কেজি</th>
            <th style="padding:8px;text-align:right;font-size:10px;color:#9a7830;font-weight:700;">মোট</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
      </table>
    </div>
    <div style="margin:10px 20px 0;">
      <table style="width:100%;border-collapse:collapse;border:1px solid #e8e0d0;">
        <tbody>
          ${finRows}
          <tr style="background:#f0e8d0;">
            <td colspan="2" style="padding:9px 10px;font-size:13px;font-weight:700;color:#1a1a1a;">সর্বমোট / GRAND TOTAL</td>
            <td style="padding:9px 10px;font-size:15px;font-weight:900;text-align:right;color:#9A7830;">৳${grandTotal.toLocaleString('en-US',{minimumFractionDigits:2})}</td>
          </tr>
          ${advance>0?`<tr style="background:#eafaf1;">
            <td colspan="2" style="padding:7px 10px;font-size:12px;color:#27ae60;font-weight:600;">বাকি / DUE</td>
            <td style="padding:7px 10px;font-size:13px;font-weight:900;text-align:right;color:#27ae60;">৳${due.toLocaleString('en-US',{minimumFractionDigits:2})}</td>
          </tr>`:''}
        </tbody>
      </table>
    </div>
    ${data.note?`<div style="margin:10px 20px 0;padding:9px 12px;background:#f7f5f0;border-radius:8px;border-left:3px solid #C9A84C;">
      <div style="font-size:10px;color:#9a7830;margin-bottom:3px;font-weight:700;">নোট:</div>
      <div style="font-size:12px;color:#1a1a1a;">${data.note}</div>
    </div>`:''}
    <div style="margin:14px 20px 18px;padding-top:12px;border-top:1px solid #C9A84C;text-align:center;">
      <div style="font-size:12px;color:#1a1a1a;font-style:italic;margin-bottom:3px;">Khalid\'s Dreams-এ কেনাকাটার জন্য ধন্যবাদ!</div>
      <div style="font-size:10px;color:#7a7060;">Developed by Md. Lavib Uddin Ashik</div>
    </div>
  </div>`;

  document.body.insertAdjacentHTML('beforeend', receiptHTML);
  const el = document.getElementById('pdf-receipt');
  try {
    const canvas = await html2canvas(el, { scale:1.5, useCORS:true, backgroundColor:'#ffffff', logging:false });
    const imgData = canvas.toDataURL('image/jpeg', 0.92);
    const { jsPDF } = window.jspdf;
    const pdfW = 210;
    const pdfH = (canvas.height * pdfW) / canvas.width;
    const pdf  = new jsPDF({ orientation:'portrait', unit:'mm', format:[pdfW, pdfH] });
    pdf.addImage(imgData, 'JPEG', 0, 0, pdfW, pdfH, undefined, 'FAST');
    pdf.save('KhalidsDreams-' + invNo + '.pdf');
  } finally { el.remove(); }
}


// ── GOOGLE SHEETS (JSONP) ──
function saveToGoogleSheets(data, invNo) {
  return new Promise((resolve) => {
    const cbName = 'kdCallback_' + Date.now();

    const params = new URLSearchParams({
      callback:  cbName,
      invoiceNo: invNo,
      name:      data.name,
      phone:     data.phone,
      district:  data.district,
      thana:     data.thana || '',
      address:   data.address || '',
      items:     data.items.filter(i=>i.name.trim()).map(i=>`${i.name} (${i.qty}kg × ৳${i.rate} = ৳${i.price})`).join(', '),
      total:     data.grandTotal,
      subtotal:  data.subtotal,
      advance:   data.advance  || 0,
      courier:   data.courier  || 0,
      discount:  data.discount || 0,
      prevDue:   data.prevDue  || 0,
      due:       data.due      || 0,
      note:      data.note || '',
      datetime:  data.datetime || new Date().toLocaleString('en-US'),
      timestamp: data.timestamp,
    });

    window[cbName] = () => {
      delete window[cbName];
      try { document.head.removeChild(script); } catch(e){}
      resolve({ success: true });
    };

    const script = document.createElement('script');
    script.src = SHEET_URL + '?' + params.toString();
    script.onerror = () => {
      delete window[cbName];
      try { document.head.removeChild(script); } catch(e){}
      resolve({ success: false });
    };

    setTimeout(() => {
      if (window[cbName]) {
        delete window[cbName];
        try { document.head.removeChild(script); } catch(e){}
        resolve({ success: false, reason:'timeout' });
      }
    }, 10000);

    document.head.appendChild(script);
  });
}

// ── SUBMIT: PDF + Sheet only ──
let isSubmitting = false;
let lastSubmitInvNo = '';  // prevent exact duplicate within 10s

async function handleSubmit() {
  if (!validateForm()) return;
  if (isSubmitting) return;
  isSubmitting = true;
  await _doSubmit(false);
  isSubmitting = false;
}

// ── SUBMIT: PDF + Sheet + Steadfast ──
async function handleSubmitWithSteadfast() {
  if (!validateForm()) return;
  if (isSubmitting) return;
  isSubmitting = true;
  await _doSubmit(true);
  isSubmitting = false;
}

async function _doSubmit(withSteadfast) {
  const btn1 = document.getElementById('submit-btn');
  const btn2 = document.getElementById('submit-btn-sf');
  const L1 = '🧾 PDF ও Sheet-এ সেভ করুন';
  const L2 = '🚀 PDF + Sheet + Steadfast অর্ডার';
  if (btn1) { btn1.disabled = true; btn1.innerHTML = '<span class="btn-spinner"></span> প্রসেস হচ্ছে...'; }
  if (btn2) { btn2.disabled = true; btn2.innerHTML = '<span class="btn-spinner"></span> প্রসেস হচ্ছে...'; }

  // ★ Auto-refresh datetime at submit moment
  setDateTime();

  const invNo    = 'KD-' + Date.now().toString().slice(-6);
  const subtotal = orderItems.reduce((s,i) => s+i.price, 0);
  const calc     = window._calcData || { subtotal, advance:0, courier:0, discount:0, prevDue:0, grandTotal:subtotal, due:subtotal };

  const formData = {
    name:      document.getElementById('cust-name').value.trim(),
    phone:     normalizePhone(document.getElementById('cust-phone').value),
    district:  document.getElementById('district').value,
    thana:     document.getElementById('thana').value,
    address:   document.getElementById('address').value.trim(),
    items:     orderItems.filter(i => i.name.trim()),
    subtotal:  calc.subtotal,
    advance:   calc.advance,
    courier:   calc.courier,
    discount:  calc.discount,
    prevDue:   calc.prevDue,
    grandTotal:calc.grandTotal,
    due:       calc.due,
    datetime:  document.getElementById('datetime-display').textContent || new Date().toLocaleString('en-US'),
    note:      document.getElementById('note').value.trim(),
    timestamp: new Date().toISOString(),
  };

  try {
    await generatePDF(formData, invNo);
    const sheetResult = await saveToGoogleSheets(formData, invNo);

    let sfResult = null;
    if (withSteadfast && typeof createSteadfastOrder === 'function') {
      sfResult = await createSteadfastOrder(formData, invNo);
    }

    dailyTotal += calc.grandTotal;
    dailySales += 1;
    localStorage.setItem('kd_daily_total', dailyTotal.toString());
    localStorage.setItem('kd_daily_sales', dailySales.toString());
    localStorage.setItem('kd_last_date', new Date().toDateString());
    updateDailyDisplay();

    if (withSteadfast && sfResult && sfResult.success) {
      showToast('success', '🚀 সম্পন্ন!',
        `PDF ✓ | Sheet ✓ | Steadfast ✓ — Tracking: ${sfResult.trackingCode}`);
    } else if (withSteadfast && sfResult && !sfResult.success) {
      showToast('error', 'Steadfast সমস্যা',
        'PDF ও Sheet সেভ হয়েছে। Steadfast: ' + (sfResult.message || 'failed'));
    } else {
      showToast('success', 'সেল সম্পন্ন! ✓',
        sheetResult.success ? 'PDF ডাউনলোড ও Sheet-এ সেভ হয়েছে।'
                            : 'PDF হয়েছে। Sheet চেক করুন।');
    }

    customerLookupCache = null;
    if (typeof sfPhoneCache !== 'undefined') sfPhoneCache = {};
    setTimeout(resetForm, 2000);

  } catch(e) {
    console.error(e);
    showToast('error', 'ত্রুটি', 'সমস্যা হয়েছে। Console চেক করুন।');
  } finally {
    if (btn1) { btn1.disabled = false; btn1.innerHTML = L1; }
    if (btn2) { btn2.disabled = false; btn2.innerHTML = L2; }
  }
}

function resetForm() {
  ['cust-name','cust-phone','address','note','advance','courier','discount','prev-due'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('district').value = '';
  document.getElementById('thana').innerHTML = '<option value="">-- থানা সিলেক্ট করুন --</option>';
  document.getElementById('datetime-display').textContent = '"এখনই সেট করুন" বাটনে ক্লিক করুন';
  document.getElementById('datetime-value').value = '';
  orderItems = []; itemCounter = 0;
  window._calcData = null;
  addOrderItem();
  updateGrandTotal();
  setDateTime(); // auto-refresh datetime for next sale
}

// ── TOAST ──
function showToast(type, title, msg) {
  const t = document.getElementById('toast');
  t.className = 'toast ' + type;
  t.querySelector('.toast-icon').textContent = type === 'success' ? '✅' : '❌';
  t.querySelector('.toast-text').innerHTML = `<strong>${title}</strong>${msg}`;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 4000);
}

// ── INIT ──
document.addEventListener('DOMContentLoaded', () => {
  populateDistricts();
  addOrderItem();
  updateDailyDisplay();
  updateNavClock();
  setInterval(updateNavClock, 30000);
  setDateTime(); // ★ Auto-set datetime on page load

  // Auto-fill on phone input pause / blur
  const phoneEl = document.getElementById('cust-phone');
  if (phoneEl) {
    let debounceTimer;
    phoneEl.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => onPhoneInputLookup(phoneEl), 500);
    });
    phoneEl.addEventListener('blur', () => onPhoneInputLookup(phoneEl));
  }
});
