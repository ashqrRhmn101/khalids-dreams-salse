// ══════════════════════════════════════════════
//  Khalid's Dreams — Sales App v3
//  Fixes: Invoice sync, Bangla PDF, Mobile UI
// ══════════════════════════════════════════════

// ── YOUR GOOGLE SHEET URL ──
const SHEET_URL = 'https://script.google.com/macros/s/AKfycbyVkNaPQT-fPuvSeEofs4iTEqZWmmThzkx9r8Hmm2OyWyOsh7eNbSBJetc8lHPTwByuxQ/exec';

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
  orderItems.push({ id: itemCounter, name: '', price: 0 });
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
  item[field] = field === 'price' ? (parseFloat(value) || 0) : value;
  updateOrderSubtotal();
}

function renderOrderItems() {
  const c = document.getElementById('order-items-container');
  c.innerHTML = '';
  orderItems.forEach((item, idx) => {
    const row = document.createElement('div');
    row.className = 'item-row-inner';
    row.innerHTML = `
      <div class="serial">${idx + 1}</div>
      <div class="form-group" style="margin:0">
        <input type="text" placeholder="পণ্যের নাম..." value="${item.name}"
          oninput="updateItem(${item.id},'name',this.value)" />
      </div>
      <div class="form-group" style="margin:0">
        <input type="number" placeholder="মূল্য ৳" value="${item.price||''}" min="0"
          oninput="updateItem(${item.id},'price',this.value)" class="price-input" />
      </div>
      <button class="remove-item-btn" onclick="removeOrderItem(${item.id})" title="সরান">✕</button>`;
    c.appendChild(row);
  });
}

function updateOrderSubtotal() {
  const sub = orderItems.reduce((s,i) => s + i.price, 0);
  document.getElementById('order-subtotal').textContent =
    '৳ ' + sub.toLocaleString('en-US', {minimumFractionDigits:2});
}

// ── DATETIME ──
function setDateTime() {
  const now = new Date();
  const display = now.toLocaleString('en-US', {
    year:'numeric', month:'long', day:'numeric',
    hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:true
  });
  document.getElementById('datetime-display').textContent = display;
  document.getElementById('datetime-value').value = now.toISOString();
  showToast('success', 'সময় সেট হয়েছে', 'তারিখ ও সময় ক্যাপচার হয়েছে।');
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

// ══════════════════════════════════════════════
//  PDF — html2canvas approach (full Bangla support)
//  Renders a hidden receipt div → canvas → PDF
// ══════════════════════════════════════════════
async function generatePDF(data, invNo) {
  // Build receipt HTML
  const itemRows = data.items
    .filter(i => i.name.trim())
    .map((item, idx) => `
      <tr style="background:${idx%2===0?'#f8f6f2':'#ffffff'}">
        <td style="padding:8px 12px;color:#5a5040;font-size:13px;">${idx+1}</td>
        <td style="padding:8px 12px;color:#2a2a2a;font-size:13px;">${item.name}</td>
        <td style="padding:8px 12px;color:#2a2a2a;font-size:13px;text-align:right;">
          ৳ ${item.price.toLocaleString('en-US', {minimumFractionDigits:2})}
        </td>
      </tr>`).join('');

  const total = data.items.filter(i=>i.name.trim()).reduce((s,i)=>s+i.price,0);

  const receiptHTML = `
  <div id="pdf-receipt" style="
    width:595px; background:#ffffff; font-family:'Hind Siliguri','Noto Sans Bengali',sans-serif;
    padding:0; margin:0; position:fixed; top:-9999px; left:-9999px; z-index:-1;
  ">
    <!-- Header -->
    <div style="background:#1a1a1a;padding:24px 32px 18px;border-bottom:4px solid #C9A84C;">
      <div style="text-align:center;">
        <div style="font-size:28px;font-weight:900;color:#C9A84C;letter-spacing:1px;
          font-family:'Georgia',serif;">Khalid's Dreams</div>
        <div style="font-size:11px;color:#a09080;letter-spacing:3px;margin-top:4px;">INVOICE / SALES RECEIPT</div>
        <!-- Business Info -->
        <div style="margin-top:12px;padding-top:12px;border-top:1px solid rgba(201,168,76,0.25);">
          <div style="font-size:13px;font-weight:700;color:#e0d8c8;margin-bottom:3px;">Khalid Bin Walid</div>
          <div style="font-size:11px;color:#a09080;margin-bottom:3px;">Kalibari Road, Sirajganj</div>
          <div style="font-size:11px;color:#a09080;">Contact No: 01710979757 | 01710721807</div>
        </div>
      </div>
      <div style="display:flex;justify-content:space-between;margin-top:14px;font-size:11px;color:#807060;">
        <span>Invoice: <b style="color:#C9A84C;">${invNo}</b></span>
        <span>${data.datetime || new Date().toLocaleString('en-US')}</span>
      </div>
    </div>

    <!-- Customer Info -->
    <div style="margin:20px 24px 0;background:#f8f6f2;border:1px solid #C9A84C;
      border-radius:10px;padding:18px 20px;">
      <div style="font-size:10px;color:#9a7830;letter-spacing:2px;font-weight:700;margin-bottom:12px;">
        গ্রাহকের তথ্য / CUSTOMER INFORMATION
      </div>
      ${[
        ['নাম / Name', data.name],
        ['ফোন / Phone', data.phone],
        ['জেলা / District', data.district + (data.thana ? ' — ' + data.thana : '')],
        ['ঠিকানা / Address', data.address || '—'],
      ].map(([k,v]) => `
        <div style="display:flex;padding:5px 0;border-bottom:1px solid #e8e0d0;">
          <span style="width:160px;font-size:11px;color:#807060;flex-shrink:0;">${k}:</span>
          <span style="font-size:12px;color:#2a2a2a;">${v}</span>
        </div>`).join('')}
    </div>

    <!-- Order Table -->
    <div style="margin:16px 24px 0;">
      <div style="font-size:10px;color:#9a7830;letter-spacing:2px;font-weight:700;margin-bottom:10px;">
        অর্ডার বিবরণ / ORDER DETAILS
      </div>
      <table style="width:100%;border-collapse:collapse;border:1px solid #C9A84C;border-radius:8px;overflow:hidden;">
        <thead>
          <tr style="background:#1a1a1a;">
            <th style="padding:10px 12px;text-align:left;font-size:11px;color:#C9A84C;font-weight:600;width:40px;">#</th>
            <th style="padding:10px 12px;text-align:left;font-size:11px;color:#C9A84C;font-weight:600;">পণ্যের নাম</th>
            <th style="padding:10px 12px;text-align:right;font-size:11px;color:#C9A84C;font-weight:600;">মূল্য</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
      </table>
    </div>

    <!-- Total -->
    <div style="margin:14px 24px 0;background:#1a1a1a;
      border:1.5px solid #C9A84C;border-radius:10px;padding:14px 20px;
      display:flex;justify-content:space-between;align-items:center;">
      <span style="font-size:13px;color:#C9A84C;font-weight:700;letter-spacing:1px;">মোট / TOTAL AMOUNT</span>
      <span style="font-size:20px;font-weight:900;color:#C9A84C;">
        ৳ ${total.toLocaleString('en-US', {minimumFractionDigits:2})}
      </span>
    </div>

    ${data.note ? `
    <!-- Note -->
    <div style="margin:12px 24px 0;padding:12px 16px;background:#f8f6f2;border-radius:8px;
      border-left:3px solid #C9A84C;">
      <div style="font-size:10px;color:#9a7830;margin-bottom:4px;">নোট / Note:</div>
      <div style="font-size:12px;color:#2a2a2a;">${data.note}</div>
    </div>` : ''}

    <!-- Footer -->
    <div style="margin:20px 24px 24px;padding-top:16px;border-top:1px solid #C9A84C;text-align:center;">
      <div style="font-size:12px;color:#5a5040;font-style:italic;margin-bottom:4px;">
        Khalid's Dreams-এ কেনাকাটার জন্য ধন্যবাদ!
      </div>
      <div style="font-size:10px;color:#9a9080;">
        Developed by Md. Lavib Uddin Ashik
      </div>
    </div>
  </div>`;

  // Inject into DOM
  document.body.insertAdjacentHTML('beforeend', receiptHTML);
  const el = document.getElementById('pdf-receipt');

  try {
    // Render via html2canvas
    const canvas = await html2canvas(el, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
    });

    const imgData = canvas.toDataURL('image/png');
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4' });

    const pdfW = pdf.internal.pageSize.getWidth();
    const pdfH = (canvas.height * pdfW) / canvas.width;

    pdf.addImage(imgData, 'PNG', 0, 0, pdfW, pdfH);
    pdf.save('KhalidsDreams-' + invNo + '.pdf');
  } finally {
    el.remove();
  }
}

// ── GOOGLE SHEETS (JSONP) ──
function saveToGoogleSheets(data, invNo) {
  return new Promise((resolve) => {
    const cbName = 'kdCallback_' + Date.now();

    const params = new URLSearchParams({
      callback: cbName,
      invoiceNo: invNo,
      name:      data.name,
      phone:     data.phone,
      district:  data.district,
      thana:     data.thana || '',
      address:   data.address || '',
      items:     data.items.filter(i=>i.name.trim()).map(i=>`${i.name} (${i.price})`).join(', '),
      total:     data.subtotal,
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

// ── SUBMIT ──
async function handleSubmit() {
  if (!validateForm()) return;

  const btn = document.getElementById('submit-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="btn-spinner"></span> প্রসেস হচ্ছে...';

  // ★ Generate invoice number ONCE — used for both PDF & Sheet
  const invNo = 'KD-' + Date.now().toString().slice(-6);

  const subtotal = orderItems.reduce((s,i) => s+i.price, 0);
  const formData = {
    name:      document.getElementById('cust-name').value.trim(),
    phone:     document.getElementById('cust-phone').value.trim(),
    district:  document.getElementById('district').value,
    thana:     document.getElementById('thana').value,
    address:   document.getElementById('address').value.trim(),
    items:     orderItems.filter(i => i.name.trim()),
    subtotal,
    datetime:  document.getElementById('datetime-display').textContent || new Date().toLocaleString('en-US'),
    note:      document.getElementById('note').value.trim(),
    timestamp: new Date().toISOString(),
  };

  try {
    // PDF + Sheet use same invNo
    await generatePDF(formData, invNo);
    const sheetResult = await saveToGoogleSheets(formData, invNo);

    dailyTotal += subtotal;
    dailySales += 1;
    localStorage.setItem('kd_daily_total', dailyTotal.toString());
    localStorage.setItem('kd_daily_sales', dailySales.toString());
    localStorage.setItem('kd_last_date', new Date().toDateString());
    updateDailyDisplay();

    showToast('success', 'সেল সম্পন্ন! ✓',
      sheetResult.success ? 'PDF ডাউনলোড ও Sheet-এ সেভ হয়েছে।'
                          : 'PDF ডাউনলোড হয়েছে। Sheet সেভ চেক করুন।');
    setTimeout(resetForm, 2000);

  } catch (e) {
    console.error(e);
    showToast('error', 'ত্রুটি', 'সমস্যা হয়েছে। Console চেক করুন।');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '🧾 সেল সম্পন্ন করুন ও PDF ডাউনলোড';
  }
}

function resetForm() {
  ['cust-name','cust-phone','address','note'].forEach(id =>
    document.getElementById(id).value = '');
  document.getElementById('district').value = '';
  document.getElementById('thana').innerHTML = '<option value="">-- Thana select করুন --</option>';
  document.getElementById('datetime-display').textContent = '"এখনই সেট করুন" বাটনে ক্লিক করুন';
  document.getElementById('datetime-value').value = '';
  orderItems = []; itemCounter = 0;
  addOrderItem();
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
});
