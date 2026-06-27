// ══════════════════════════════════════════════
//  Khalid's Dreams — Sales App v3
//  Fixes: Invoice sync, Bangla PDF, Mobile UI
// ══════════════════════════════════════════════

// ── YOUR GOOGLE SHEET URL ──
const SHEET_URL =
  "https://script.google.com/macros/s/AKfycbyVkNaPQT-fPuvSeEofs4iTEqZWmmThzkx9r8Hmm2OyWyOsh7eNbSBJetc8lHPTwByuxQ/exec";

// ── STATE ──
let orderItems = [];
let itemCounter = 0;
let dailyTotal = parseFloat(localStorage.getItem("kd_daily_total") || "0");
let dailySales = parseInt(localStorage.getItem("kd_daily_sales") || "0");

// Reset daily totals at midnight
const lastDate = localStorage.getItem("kd_last_date");
const todayStr = new Date().toDateString();
if (lastDate !== todayStr) {
  dailyTotal = 0;
  dailySales = 0;
  localStorage.setItem("kd_daily_total", "0");
  localStorage.setItem("kd_daily_sales", "0");
  localStorage.setItem("kd_last_date", todayStr);
}

// ── PHONE NORMALIZE (adds missing leading 0) ──
function normalizePhone(phone) {
  let p = String(phone || "")
    .trim()
    .replace(/[\s\-]/g, "");
  p = p.replace(/^\+?88/, ""); // remove country code if present
  if (p.length === 10 && p.startsWith("1")) p = "0" + p; // 1XXXXXXXXX -> 01XXXXXXXXX
  return p;
}

// ── CUSTOMER AUTO-FILL (repeat customer lookup) ──
let customerLookupCache = null; // { phone: {name, district, thana, address} }
let customerLookupLoading = false;

async function ensureCustomerLookup() {
  if (customerLookupCache) return customerLookupCache;
  if (customerLookupLoading) return null;
  customerLookupLoading = true;

  const sales =
    typeof allSales !== "undefined" && allSales && allSales.length
      ? allSales
      : await fetchSalesDataSafe();

  const map = {};
  sales.forEach((s) => {
    const key = normalizePhone(s.phone);
    if (!key) return;
    const ts = s.timestamp ? new Date(s.timestamp).getTime() : 0;
    if (!map[key] || ts > map[key]._ts) {
      map[key] = {
        name: s.name,
        district: s.district,
        thana: s.thana,
        address: s.address,
        _ts: ts,
      };
    }
  });

  customerLookupCache = map;
  customerLookupLoading = false;
  return map;
}

// Safe fetch wrapper in case history.js fetchSalesData isn't loaded yet
async function fetchSalesDataSafe() {
  if (typeof fetchSalesData === "function") {
    try {
      return await fetchSalesData();
    } catch (e) {
      return [];
    }
  }
  return [];
}

async function onPhoneInputLookup(inputEl) {
  const phone = normalizePhone(inputEl.value);
  if (phone.length < 11) return; // wait until full number typed

  const map = await ensureCustomerLookup();
  if (!map) return;
  const match = map[phone];
  if (!match) return;

  // Only fill if name field currently empty (don't overwrite manual edits)
  const nameEl = document.getElementById("cust-name");
  if (nameEl && !nameEl.value.trim()) nameEl.value = match.name || "";

  if (match.district) {
    const distSel = document.getElementById("district");
    if (distSel && !distSel.value) {
      distSel.value = match.district;
      onDistrictChange();
      setTimeout(() => {
        const thanaSel = document.getElementById("thana");
        if (thanaSel && match.thana) thanaSel.value = match.thana;
      }, 50);
    }
  }
  const addrEl = document.getElementById("address");
  if (addrEl && !addrEl.value.trim() && match.address)
    addrEl.value = match.address;

  showToast(
    "success",
    "পরিচিত গ্রাহক! 👋",
    `${match.name}-এর তথ্য অটো-ফিল হয়েছে।`,
  );
}

// ── DISTRICTS & THANAS ──
function populateDistricts() {
  const sel = document.getElementById("district");
  Object.keys(bangladeshData)
    .sort()
    .forEach((d) => {
      const o = document.createElement("option");
      o.value = d;
      o.textContent = d;
      sel.appendChild(o);
    });
}

function onDistrictChange() {
  const d = document.getElementById("district").value;
  const ts = document.getElementById("thana");
  ts.innerHTML = '<option value="">-- Thana select করুন --</option>';
  if (d && bangladeshData[d]) {
    bangladeshData[d].sort().forEach((t) => {
      const o = document.createElement("option");
      o.value = t;
      o.textContent = t;
      ts.appendChild(o);
    });
  }
}

// ── ORDER ITEMS ──
function addOrderItem() {
  itemCounter++;
  orderItems.push({ id: itemCounter, name: "", price: 0 });
  renderOrderItems();
}

function removeOrderItem(id) {
  if (orderItems.length <= 1) {
    return showToast("error", "সরানো যাবে না", "কমপক্ষে একটি পণ্য থাকতে হবে।");
  }
  orderItems = orderItems.filter((i) => i.id !== id);
  renderOrderItems();
  updateOrderSubtotal();
}

function updateItem(id, field, value) {
  const item = orderItems.find((i) => i.id === id);
  if (!item) return;
  item[field] = field === "price" ? parseFloat(value) || 0 : value;
  updateOrderSubtotal();
}

function renderOrderItems() {
  const c = document.getElementById("order-items-container");
  c.innerHTML = "";
  orderItems.forEach((item, idx) => {
    const row = document.createElement("div");
    row.className = "item-row-inner";
    row.innerHTML = `
      <div class="serial">${idx + 1}</div>
      <div class="form-group" style="margin:0">
        <input type="text" placeholder="পণ্যের নাম..." value="${item.name}"
          oninput="updateItem(${item.id},'name',this.value)" />
      </div>
      <div class="form-group" style="margin:0">
        <input type="number" placeholder="মূল্য ৳" value="${item.price || ""}" min="0"
          oninput="updateItem(${item.id},'price',this.value)" class="price-input" />
      </div>
      <button class="remove-item-btn" onclick="removeOrderItem(${item.id})" title="সরান">✕</button>`;
    c.appendChild(row);
  });
}

function updateOrderSubtotal() {
  const sub = orderItems.reduce((s, i) => s + i.price, 0);
  document.getElementById("order-subtotal").textContent =
    "৳ " + sub.toLocaleString("en-US", { minimumFractionDigits: 2 });
}

// ── DATETIME ──
function setDateTime() {
  const now = new Date();
  const display = now.toLocaleString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  document.getElementById("datetime-display").textContent = display;
  document.getElementById("datetime-value").value = now.toISOString();
  showToast("success", "সময় সেট হয়েছে", "তারিখ ও সময় ক্যাপচার হয়েছে।");
}

// ── NAV CLOCK ──
function updateNavClock() {
  const el = document.getElementById("nav-datetime");
  if (!el) return;
  const now = new Date();
  el.textContent = now.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

// ── DAILY STATS DISPLAY ──
function updateDailyDisplay() {
  const el = document.getElementById("daily-total-value");
  if (el)
    el.innerHTML =
      '<span class="currency-sign">৳</span>' +
      dailyTotal.toLocaleString("en-US", { minimumFractionDigits: 2 });
  const sc = document.getElementById("daily-sales-count");
  if (sc) sc.textContent = dailySales;
}

// ── VALIDATION ──
function validateForm() {
  const checks = [
    [!document.getElementById("cust-name").value.trim(), "গ্রাহকের নাম দিন"],
    [!document.getElementById("cust-phone").value.trim(), "ফোন নম্বর দিন"],
    [!document.getElementById("district").value, "জেলা সিলেক্ট করুন"],
    [!orderItems.some((i) => i.name.trim()), "কমপক্ষে একটি পণ্য যোগ করুন"],
  ];
  for (const [fail, msg] of checks) {
    if (fail) {
      showToast("error", "প্রয়োজনীয়", msg);
      return false;
    }
  }
  return true;
}

// ══════════════════════════════════════════════
//  PDF — html2canvas approach (full Bangla support)
//  All-white background, black text, logo, optimized size
// ══════════════════════════════════════════════
async function generatePDF(data, invNo) {
  // Build receipt HTML
  const itemRows = data.items
    .filter((i) => i.name.trim())
    .map(
      (item, idx) => `
      <tr style="background:${idx % 2 === 0 ? "#f7f5f0" : "#ffffff"}">
        <td style="padding:8px 12px;color:#1a1a1a;font-size:13px;">${idx + 1}</td>
        <td style="padding:8px 12px;color:#1a1a1a;font-size:13px;">${item.name}</td>
        <td style="padding:8px 12px;color:#1a1a1a;font-size:13px;text-align:right;">
          ৳ ${item.price.toLocaleString("en-US", { minimumFractionDigits: 2 })}
        </td>
      </tr>`,
    )
    .join("");

  const total = data.items
    .filter((i) => i.name.trim())
    .reduce((s, i) => s + i.price, 0);

  const receiptHTML = `
  <div id="pdf-receipt" style="
    width:595px; background:#ffffff; font-family:'Hind Siliguri','Noto Sans Bengali',sans-serif;
    padding:0; margin:0; position:fixed; top:-9999px; left:-9999px; z-index:-1;
  ">
    <!-- Header -->
    <div style="background:#ffffff;padding:22px 32px 18px;border-bottom:3px solid #C9A84C;">
      <div style="display:flex;align-items:center;justify-content:center;gap:10px;margin-bottom:4px;">

        <div style="width:42px;height:42px;background:linear-gradient(135deg,#C9A84C,#9A7830);
  border-radius:9px;display:flex;align-items:center;justify-content:center;
  font-family:'Georgia',serif;font-weight:900;font-size:18px;color:#fff;flex-shrink:0;">
  <img src="/images/Logo.jpg" alt="Logo" style="width:52px;height:42px;" />
</div>


        <div style="font-size:26px;font-weight:900;color:#9A7830;letter-spacing:1px;
          font-family:'Georgia',serif;">Khalid's Dreams</div>
      </div>
      <div style="text-align:center;font-size:11px;color:#7a7060;letter-spacing:3px;">INVOICE / SALES RECEIPT</div>
      <div style="text-align:center;margin-top:12px;padding-top:12px;border-top:1px solid #e8e0d0;">
        <div style="font-size:13px;font-weight:700;color:#1a1a1a;margin-bottom:3px;">Khalid Bin Walid</div>
        <div style="font-size:11px;color:#5a5040;margin-bottom:3px;">Kalibari Road, Sirajganj</div>
        <div style="font-size:11px;color:#5a5040;">Contact No: 01710979757 | 01710721807</div>
      </div>
      <div style="display:flex;justify-content:space-between;margin-top:14px;font-size:11px;color:#7a7060;">
        <span>Invoice: <b style="color:#9A7830;">${invNo}</b></span>
        <span>${data.datetime || new Date().toLocaleString("en-US")}</span>
      </div>
    </div>

    <!-- Customer Info -->
    <div style="margin:20px 24px 0;background:#f7f5f0;border:1px solid #C9A84C;
      border-radius:10px;padding:18px 20px;">
      <div style="font-size:10px;color:#9a7830;letter-spacing:2px;font-weight:700;margin-bottom:12px;">
        গ্রাহকের তথ্য / CUSTOMER INFORMATION
      </div>
      ${[
        ["নাম / Name", data.name],
        ["ফোন / Phone", data.phone],
        [
          "জেলা / District",
          data.district + (data.thana ? " — " + data.thana : ""),
        ],
        ["ঠিকানা / Address", data.address || "—"],
      ]
        .map(
          ([k, v]) => `
        <div style="display:flex;padding:5px 0;border-bottom:1px solid #e8e0d0;">
          <span style="width:160px;font-size:11px;color:#5a5040;flex-shrink:0;">${k}:</span>
          <span style="font-size:12px;color:#1a1a1a;font-weight:500;">${v}</span>
        </div>`,
        )
        .join("")}
    </div>

    <!-- Order Table -->
    <div style="margin:16px 24px 0;">
      <div style="font-size:10px;color:#9a7830;letter-spacing:2px;font-weight:700;margin-bottom:10px;">
        অর্ডার বিবরণ / ORDER DETAILS
      </div>
      <table style="width:100%;border-collapse:collapse;border:1px solid #C9A84C;border-radius:8px;overflow:hidden;">
        <thead>
          <tr style="background:#f0e8d0;">
            <th style="padding:10px 12px;text-align:left;font-size:11px;color:#9a7830;font-weight:700;width:40px;">#</th>
            <th style="padding:10px 12px;text-align:left;font-size:11px;color:#9a7830;font-weight:700;">পণ্যের নাম</th>
            <th style="padding:10px 12px;text-align:right;font-size:11px;color:#9a7830;font-weight:700;">মূল্য</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
      </table>
    </div>

    <!-- Total -->
    <div style="margin:14px 24px 0;background:#f7f5f0;
      border:1.5px solid #C9A84C;border-radius:10px;padding:14px 20px;
      display:flex;justify-content:space-between;align-items:center;">
      <span style="font-size:13px;color:#1a1a1a;font-weight:700;letter-spacing:1px;">মোট / TOTAL AMOUNT</span>
      <span style="font-size:20px;font-weight:900;color:#9a7830;">
        ৳ ${total.toLocaleString("en-US", { minimumFractionDigits: 2 })}
      </span>
    </div>

    ${
      data.note
        ? `
    <!-- Note -->
    <div style="margin:12px 24px 0;padding:12px 16px;background:#f7f5f0;border-radius:8px;
      border-left:3px solid #C9A84C;">
      <div style="font-size:10px;color:#9a7830;margin-bottom:4px;font-weight:700;">নোট / Note:</div>
      <div style="font-size:12px;color:#1a1a1a;">${data.note}</div>
    </div>`
        : ""
    }

    <!-- Footer -->
    <div style="margin:20px 24px 24px;padding-top:16px;border-top:1px solid #C9A84C;text-align:center;">
      <div style="font-size:12px;color:#1a1a1a;font-style:italic;margin-bottom:4px;">
        Khalid's Dreams-এ কেনাকাটার জন্য ধন্যবাদ!
      </div>
      <div style="font-size:10px;color:#7a7060;">
        Developed by Md. Lavib Uddin Ashik
      </div>
    </div>
  </div>`;

  // Inject into DOM
  document.body.insertAdjacentHTML("beforeend", receiptHTML);
  const el = document.getElementById("pdf-receipt");

  try {
    // scale 1.5 keeps text sharp while keeping file size reasonable
    const canvas = await html2canvas(el, {
      scale: 1.5,
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
    });

    // Use JPEG (not PNG) at high quality — much smaller file, text still crisp
    const imgData = canvas.toDataURL("image/jpeg", 0.92);
    const { jsPDF } = window.jspdf;

    const pdfW = 210; // A4 width in mm
    const pdfH = (canvas.height * pdfW) / canvas.width;

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: [pdfW, pdfH],
    });
    pdf.addImage(imgData, "JPEG", 0, 0, pdfW, pdfH, undefined, "FAST");
    pdf.save("KhalidsDreams-" + invNo + ".pdf");
  } finally {
    el.remove();
  }
}

// ── GOOGLE SHEETS (JSONP) ──
function saveToGoogleSheets(data, invNo) {
  return new Promise((resolve) => {
    const cbName = "kdCallback_" + Date.now();

    const params = new URLSearchParams({
      callback: cbName,
      invoiceNo: invNo,
      name: data.name,
      phone: data.phone,
      district: data.district,
      thana: data.thana || "",
      address: data.address || "",
      items: data.items
        .filter((i) => i.name.trim())
        .map((i) => `${i.name} (${i.price})`)
        .join(", "),
      total: data.subtotal,
      note: data.note || "",
      datetime: data.datetime || new Date().toLocaleString("en-US"),
      timestamp: data.timestamp,
    });

    window[cbName] = () => {
      delete window[cbName];
      try {
        document.head.removeChild(script);
      } catch (e) {}
      resolve({ success: true });
    };

    const script = document.createElement("script");
    script.src = SHEET_URL + "?" + params.toString();
    script.onerror = () => {
      delete window[cbName];
      try {
        document.head.removeChild(script);
      } catch (e) {}
      resolve({ success: false });
    };

    setTimeout(() => {
      if (window[cbName]) {
        delete window[cbName];
        try {
          document.head.removeChild(script);
        } catch (e) {}
        resolve({ success: false, reason: "timeout" });
      }
    }, 10000);

    document.head.appendChild(script);
  });
}

// ── SUBMIT ──
async function handleSubmit() {
  if (!validateForm()) return;

  const btn = document.getElementById("submit-btn");
  btn.disabled = true;
  btn.innerHTML = '<span class="btn-spinner"></span> প্রসেস হচ্ছে...';

  // ★ Generate invoice number ONCE — used for both PDF & Sheet
  const invNo = "KD-" + Date.now().toString().slice(-6);

  const subtotal = orderItems.reduce((s, i) => s + i.price, 0);
  const formData = {
    name: document.getElementById("cust-name").value.trim(),
    phone: normalizePhone(document.getElementById("cust-phone").value),
    district: document.getElementById("district").value,
    thana: document.getElementById("thana").value,
    address: document.getElementById("address").value.trim(),
    items: orderItems.filter((i) => i.name.trim()),
    subtotal,
    datetime:
      document.getElementById("datetime-display").textContent ||
      new Date().toLocaleString("en-US"),
    note: document.getElementById("note").value.trim(),
    timestamp: new Date().toISOString(),
  };

  try {
    // PDF + Sheet use same invNo
    await generatePDF(formData, invNo);
    const sheetResult = await saveToGoogleSheets(formData, invNo);

    dailyTotal += subtotal;
    dailySales += 1;
    localStorage.setItem("kd_daily_total", dailyTotal.toString());
    localStorage.setItem("kd_daily_sales", dailySales.toString());
    localStorage.setItem("kd_last_date", new Date().toDateString());
    updateDailyDisplay();

    showToast(
      "success",
      "সেল সম্পন্ন! ✓",
      sheetResult.success
        ? "PDF ডাউনলোড ও Sheet-এ সেভ হয়েছে।"
        : "PDF ডাউনলোড হয়েছে। Sheet সেভ চেক করুন।",
    );
    customerLookupCache = null; // refresh lookup cache for next entry
    setTimeout(resetForm, 2000);
  } catch (e) {
    console.error(e);
    showToast("error", "ত্রুটি", "সমস্যা হয়েছে। Console চেক করুন।");
  } finally {
    btn.disabled = false;
    btn.innerHTML = "🧾 সেল সম্পন্ন করুন ও PDF ডাউনলোড";
  }
}

function resetForm() {
  ["cust-name", "cust-phone", "address", "note"].forEach(
    (id) => (document.getElementById(id).value = ""),
  );
  document.getElementById("district").value = "";
  document.getElementById("thana").innerHTML =
    '<option value="">-- Thana select করুন --</option>';
  document.getElementById("datetime-display").textContent =
    '"এখনই সেট করুন" বাটনে ক্লিক করুন';
  document.getElementById("datetime-value").value = "";
  orderItems = [];
  itemCounter = 0;
  addOrderItem();
}

// ── TOAST ──
function showToast(type, title, msg) {
  const t = document.getElementById("toast");
  t.className = "toast " + type;
  t.querySelector(".toast-icon").textContent = type === "success" ? "✅" : "❌";
  t.querySelector(".toast-text").innerHTML = `<strong>${title}</strong>${msg}`;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 4000);
}

// ── INIT ──
document.addEventListener("DOMContentLoaded", () => {
  populateDistricts();
  addOrderItem();
  updateDailyDisplay();
  updateNavClock();
  setInterval(updateNavClock, 30000);

  // Auto-fill on phone blur / input pause
  const phoneEl = document.getElementById("cust-phone");
  if (phoneEl) {
    let debounceTimer;
    phoneEl.addEventListener("input", () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => onPhoneInputLookup(phoneEl), 500);
    });
    phoneEl.addEventListener("blur", () => onPhoneInputLookup(phoneEl));
  }
});
