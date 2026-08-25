// ══════════════════════════════════════════════
//  Khalid's Dreams — Product Catalog v3
//  Google Sheet "Products" sync + Stock tracking
//  + Details modal + Dropdown in order form
// ══════════════════════════════════════════════

const CATEGORIES = ['সব','মধু','ঘি','তেল','চাল','ডাল','মসলা','অন্যান্য'];
const CAT_EMOJI  = {'মধু':'🍯','ঘি':'🧈','তেল':'🫙','চাল':'🌾','ডাল':'🫘','মসলা':'🌶️','অন্যান্য':'📦'};
const UNITS      = ['কেজি','গ্রাম','লিটার','পিস','প্যাকেট'];

let products       = [];
let editingId      = null;
let activeFilter   = 'সব';
let productsLoaded = false;

// ── JSONP call using SHEET_URL from config.js ──
function productSheetCall(params) {
  return new Promise((resolve) => {
    if (typeof SHEET_URL === 'undefined' || !SHEET_URL) {
      console.error('SHEET_URL not defined. Check config.js');
      return resolve({ success: false, error: 'SHEET_URL missing' });
    }
    const cb = 'prdCb_' + Date.now();
    const p  = new URLSearchParams({ ...params, callback: cb });
    window[cb] = (resp) => {
      delete window[cb];
      try { document.head.removeChild(sc); } catch(e){}
      resolve(resp);
    };
    const sc = document.createElement('script');
    sc.src = SHEET_URL + '?' + p.toString();
    sc.onerror = () => { delete window[cb]; resolve({ success: false, error: 'network' }); };
    setTimeout(() => {
      if (window[cb]) { delete window[cb]; try { document.head.removeChild(sc); } catch(e){} resolve({ success: false, error: 'timeout' }); }
    }, 15000);
    document.head.appendChild(sc);
  });
}

function genProductId() {
  return 'p_' + Date.now() + '_' + Math.random().toString(36).slice(2,6);
}

// ── FETCH products from Google Sheet ──
async function fetchProductsFromSheet() {
  const result = await productSheetCall({ action: 'fetch_products' });
  if (result.success && Array.isArray(result.data)) {
    products = result.data.map(r => ({
      id:        r.id        || genProductId(),
      name:      r.name      || '',
      category:  r.category  || 'অন্যান্য',
      unitPrice: parseFloat(r.unitPrice) || 0,
      stock:     parseFloat(r.stock)     || 0,
      unit:      r.unit      || 'কেজি',
      details:   r.details   || '',
      rowIndex:  r.rowIndex  || 0,
    }));
    localStorage.setItem('kd_products', JSON.stringify(products));
    return true;
  }
  // Fallback: localStorage cache
  const cached = localStorage.getItem('kd_products');
  if (cached) products = JSON.parse(cached);
  return false;
}

// ── SAVE product to Google Sheet ──
async function saveProductToSheet(product) {
  return await productSheetCall({
    action:    'save_product',
    id:        product.id,
    name:      product.name,
    category:  product.category,
    unitPrice: product.unitPrice,
    stock:     product.stock,
    unit:      product.unit,
    details:   product.details || '',
    rowIndex:  product.rowIndex || 0,
  });
}

// ── DELETE product from Sheet ──
async function deleteProductFromSheet(productId, rowIndex) {
  return await productSheetCall({ action: 'delete_product', id: productId, rowIndex: rowIndex || 0 });
}

// ── UPDATE STOCK in Sheet (called after sale) ──
async function updateStockInSheet(productId, newStock) {
  return await productSheetCall({ action: 'update_stock', id: productId, stock: newStock });
}

// ── SUMMARY CARDS ──
function renderProductSummary() {
  const totalEl = document.getElementById('p-total');
  const lowEl   = document.getElementById('p-low');
  const outEl   = document.getElementById('p-out');
  if (totalEl) totalEl.textContent = products.length;
  if (lowEl)   lowEl.textContent   = products.filter(p => p.stock > 0 && p.stock <= 5).length;
  if (outEl)   outEl.textContent   = products.filter(p => p.stock <= 0).length;
}

// ── CATEGORY FILTER ──
function renderCatFilter() {
  const el = document.getElementById('cat-filter');
  if (!el) return;
  el.innerHTML = CATEGORIES.map(c => `
    <button class="cat-btn ${c === activeFilter ? 'active':''}" onclick="setCatFilter('${c}')">${c}</button>
  `).join('');
}

function setCatFilter(cat) {
  activeFilter = cat;
  renderCatFilter();
  renderProductGrid();
}

// ── RENDER PRODUCT GRID ──
function renderProductGrid() {
  const grid = document.getElementById('product-grid');
  if (!grid) return;

  const filtered = activeFilter === 'সব'
    ? products
    : products.filter(p => p.category === activeFilter);

  if (!filtered.length) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <span class="e-icon">📦</span>
        <p>${activeFilter==='সব' ? 'এখনো কোনো পণ্য যোগ করা হয়নি' : `"${activeFilter}" ক্যাটাগরিতে কোনো পণ্য নেই`}</p>
      </div>`;
    return;
  }

  grid.innerHTML = filtered.map(p => {
    const emoji     = CAT_EMOJI[p.category] || '📦';
    const stockCls  = p.stock <= 0 ? 'out' : p.stock <= 5 ? 'low' : 'ok';
    const stockText = p.stock <= 0 ? 'স্টক নেই' : p.stock <= 5 ? `মাত্র ${p.stock} ${p.unit}` : `${p.stock} ${p.unit}`;
    return `
    <div class="product-card">
      <span class="p-emoji">${emoji}</span>
      <div class="p-name">${p.name}</div>
      <div class="p-cat">${p.category}</div>
      <div class="p-price">৳${Number(p.unitPrice).toLocaleString('en-US')} / ${p.unit}</div>
      <span class="p-stock ${stockCls}">${stockText}</span>
      <div class="p-actions" style="flex-direction:column;gap:5px;margin-top:.5rem;">
        <div style="display:flex;gap:6px;">
          <button class="p-btn edit"   onclick="openEditModal('${p.id}')">✏️ এডিট</button>
          <button class="p-btn delete" onclick="deleteProduct('${p.id}')">🗑️</button>
        </div>
        <button class="p-btn" onclick="openProductDetails('${p.id}')"
          style="background:rgba(99,102,241,.12);color:#a5b4fc;border:1px solid rgba(99,102,241,.25);width:100%;padding:6px;">
          📝 বিস্তারিত
        </button>
      </div>
    </div>`;
  }).join('');
}

// ── ADD NEW PRODUCT ──
async function addProduct() {
  const name      = document.getElementById('p-name')?.value.trim();
  const unitPrice = parseFloat(document.getElementById('p-price')?.value);
  const stock     = parseFloat(document.getElementById('p-stock-qty')?.value) || 0;
  const unit      = document.getElementById('p-unit')?.value || 'কেজি';
  const category  = document.getElementById('p-category')?.value || 'অন্যান্য';

  if (!name)              return showToast('error','দরকারি','পণ্যের নাম দিন।');
  if (!unitPrice || unitPrice <= 0) return showToast('error','দরকারি','সঠিক মূল্য দিন।');

  const btn = document.getElementById('add-product-btn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="btn-spinner"></span> যোগ হচ্ছে...'; }

  const product = {
    id: genProductId(), name, category, unitPrice, stock, unit, details: '', rowIndex: 0
  };

  const result = await saveProductToSheet(product);

  if (result.success) {
    product.rowIndex = result.rowIndex || 0;
    products.unshift(product);
    localStorage.setItem('kd_products', JSON.stringify(products));

    // Clear form
    ['p-name','p-price','p-stock-qty'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });

    renderAll();
    refreshOrderItemDropdowns();
    showToast('success','✅ যোগ হয়েছে!',`"${name}" পণ্য তালিকায় যোগ হয়েছে।`);
  } else {
    showToast('error','সমস্যা',`Sheet-এ save হয়নি: ${result.error || 'অজানা সমস্যা'}`);
  }

  if (btn) { btn.disabled = false; btn.innerHTML = '➕ পণ্য যোগ করুন'; }
}

// ── DELETE PRODUCT ──
async function deleteProduct(id) {
  if (!confirm('এই পণ্যটি মুছে ফেলবেন?')) return;
  const product = products.find(p => p.id === id);
  if (!product) return;

  const result = await deleteProductFromSheet(id, product.rowIndex);
  if (result.success) {
    products = products.filter(p => p.id !== id);
    localStorage.setItem('kd_products', JSON.stringify(products));
    renderAll();
    refreshOrderItemDropdowns();
    showToast('success','মুছে গেছে','পণ্যটি তালিকা থেকে সরানো হয়েছে।');
  } else {
    showToast('error','সমস্যা','মুছতে পারা যায়নি।');
  }
}

// ── EDIT MODAL ──
function openEditModal(id) {
  const p = products.find(x => x.id === id);
  if (!p) return;
  editingId = id;

  const setVal = (elId, val) => { const el = document.getElementById(elId); if(el) el.value = val; };
  setVal('edit-p-name',      p.name);
  setVal('edit-p-price',     p.unitPrice);
  setVal('edit-p-stock-qty', p.stock);
  setVal('edit-p-unit',      p.unit);
  setVal('edit-p-category',  p.category);

  document.getElementById('product-modal')?.classList.add('open');
}

function closeEditModal() {
  document.getElementById('product-modal')?.classList.remove('open');
  editingId = null;
}

async function saveEditProduct() {
  const p = products.find(x => x.id === editingId);
  if (!p) return;

  const getVal = (id) => document.getElementById(id)?.value || '';
  p.name      = getVal('edit-p-name').trim();
  p.unitPrice = parseFloat(getVal('edit-p-price'))     || 0;
  p.stock     = parseFloat(getVal('edit-p-stock-qty')) || 0;
  p.unit      = getVal('edit-p-unit') || 'কেজি';
  p.category  = getVal('edit-p-category') || 'অন্যান্য';

  if (!p.name) return showToast('error','দরকারি','পণ্যের নাম দিন।');

  const btn = document.getElementById('save-edit-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'সেভ হচ্ছে...'; }

  const result = await saveProductToSheet(p);
  if (result.success) {
    localStorage.setItem('kd_products', JSON.stringify(products));
    closeEditModal();
    renderAll();
    refreshOrderItemDropdowns();
    showToast('success','আপডেট হয়েছে!',`"${p.name}" আপডেট হয়েছে।`);
  } else {
    showToast('error','সমস্যা','Sheet-এ আপডেট হয়নি।');
  }
  if (btn) { btn.disabled = false; btn.textContent = '💾 সেভ করুন'; }
}

// ── PRODUCT DETAILS MODAL ──
function openProductDetails(id) {
  const p = products.find(x => x.id === id);
  if (!p) return;
  window._detailProductId = id;

  const titleEl = document.getElementById('pd-title');
  const detEl   = document.getElementById('pd-details');
  if (titleEl) titleEl.textContent = `${CAT_EMOJI[p.category]||'📦'} ${p.name}`;
  if (detEl)   detEl.value         = p.details || '';

  document.getElementById('product-details-modal')?.classList.add('open');
}

function closeProductDetails() {
  document.getElementById('product-details-modal')?.classList.remove('open');
}

async function saveProductDetails() {
  const id = window._detailProductId;
  const p  = products.find(x => x.id === id);
  if (!p) return;

  p.details = document.getElementById('pd-details')?.value || '';

  const btn = document.getElementById('save-pd-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'সেভ হচ্ছে...'; }

  const result = await saveProductToSheet(p);
  if (result.success) {
    localStorage.setItem('kd_products', JSON.stringify(products));
    closeProductDetails();
    showToast('success','সেভ হয়েছে ✅','বিস্তারিত সেভ হয়েছে।');
  } else {
    showToast('error','সমস্যা','সেভ হয়নি।');
  }
  if (btn) { btn.disabled = false; btn.textContent = '💾 সেভ করুন'; }
}

// ── REFRESH ORDER ITEM DROPDOWNS ──
// Called after products load/add/delete so home page dropdowns stay updated
function refreshOrderItemDropdowns() {
  document.querySelectorAll('.product-select').forEach(sel => {
    const current = sel.value;
    sel.innerHTML = '<option value="">📦 তালিকা থেকে বেছে নিন</option>' +
      products.map(p =>
        `<option value="${p.id}" data-price="${p.unitPrice}" data-unit="${p.unit}" data-name="${p.name}">
          ${CAT_EMOJI[p.category]||'📦'} ${p.name} — ৳${p.unitPrice}/${p.unit}
        </option>`
      ).join('');
    if (current) sel.value = current;
  });
}

// ── RENDER ALL ──
function renderAll() {
  renderProductSummary();
  renderCatFilter();
  renderProductGrid();
}

// ── INIT ──
async function initProducts() {
  if (productsLoaded) { renderAll(); refreshOrderItemDropdowns(); return; }

  const grid = document.getElementById('product-grid');
  if (grid) grid.innerHTML = `
    <div class="empty-state" style="grid-column:1/-1">
      <div class="spinner"></div><p>Google Sheet থেকে লোড হচ্ছে...</p>
    </div>`;

  const ok = await fetchProductsFromSheet();
  productsLoaded = true;
  renderAll();
  refreshOrderItemDropdowns();

  if (!ok && products.length === 0) {
    showToast('error','লোড সমস্যা','Sheet থেকে পণ্য আনা যায়নি। Cache ব্যবহার হচ্ছে।');
  }
}

function refreshProducts() {
  productsLoaded = false;
  initProducts();
}
