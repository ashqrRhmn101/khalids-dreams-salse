// ══════════════════════════════════════════════
//  Khalid's Dreams — Product Catalog v2
//  Google Sheet "Products" sync + Stock tracking
// ══════════════════════════════════════════════

const CATEGORIES  = ['সব', 'মধু', 'ঘি', 'তেল', 'চাল', 'ডাল', 'মসলা', 'অন্যান্য'];
const CAT_EMOJI   = { 'মধু':'🍯','ঘি':'🧈','তেল':'🫙','চাল':'🌾','ডাল':'🫘','মসলা':'🌶️','অন্যান্য':'📦' };

let products      = [];
let editingId     = null;
let activeFilter  = 'সব';
let productsLoaded = false;

// ── JSONP helper for product calls ──
function productCall(params) {
  return new Promise((resolve) => {
    const cb = 'prdCb_' + Date.now();
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

function genId() { return 'p_' + Date.now() + '_' + Math.random().toString(36).slice(2,6); }

// ── FETCH products from Google Sheet ──
async function fetchProductsFromSheet() {
  const result = await productCall({ action: 'fetch_products' });
  if (result.success && result.data) {
    products = result.data.map(r => ({
      id:       r.id       || genId(),
      name:     r.name     || '',
      category: r.category || 'অন্যান্য',
      unitPrice:parseFloat(r.unitPrice) || 0,
      stock:    parseFloat(r.stock)     || 0,
      unit:     r.unit     || 'কেজি',
      details:  r.details  || '',
      rowIndex: r.rowIndex || 0,
    }));
    // Also save to localStorage as cache
    localStorage.setItem('kd_products', JSON.stringify(products));
    return true;
  }
  // Fallback to localStorage
  products = JSON.parse(localStorage.getItem('kd_products') || '[]');
  return false;
}

// ── SAVE product to Sheet ──
async function saveProductToSheet(product) {
  return await productCall({
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
async function deleteProductFromSheet(productId) {
  return await productCall({ action: 'delete_product', id: productId });
}

// ── UPDATE STOCK in Sheet ──
async function updateStockInSheet(productId, newStock) {
  return await productCall({ action: 'update_stock', id: productId, stock: newStock });
}

// ── RENDER SUMMARY ──
function renderProductSummary() {
  document.getElementById('p-total').textContent = products.length;
  document.getElementById('p-low').textContent   = products.filter(p => p.stock > 0 && p.stock <= 5).length;
  document.getElementById('p-out').textContent   = products.filter(p => p.stock <= 0).length;
}

// ── CATEGORY FILTER ──
function renderCatFilter() {
  const el = document.getElementById('cat-filter');
  if (!el) return;
  el.innerHTML = CATEGORIES.map(c => `
    <button class="cat-btn ${c === activeFilter ? 'active' : ''}"
      onclick="setCatFilter('${c}')">${c}</button>
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
  const filtered = activeFilter === 'সব' ? products
    : products.filter(p => p.category === activeFilter);

  if (!filtered.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
      <span class="e-icon">📦</span>
      <p>${activeFilter === 'সব' ? 'কোনো পণ্য নেই' : `"${activeFilter}" ক্যাটাগরিতে পণ্য নেই`}</p>
    </div>`;
    return;
  }

  grid.innerHTML = filtered.map(p => {
    const emoji      = CAT_EMOJI[p.category] || '📦';
    const stockClass = p.stock <= 0 ? 'out' : p.stock <= 5 ? 'low' : 'ok';
    const stockText  = p.stock <= 0 ? 'স্টক নেই' : `${p.stock} ${p.unit}`;
    return `
    <div class="product-card">
      <span class="p-emoji">${emoji}</span>
      <div class="p-name">${p.name}</div>
      <div class="p-cat">${p.category}</div>
      <div class="p-price">৳${Number(p.unitPrice).toLocaleString('en-US')} / ${p.unit}</div>
      <span class="p-stock ${stockClass}">${stockText}</span>
      <div class="p-actions" style="flex-direction:column;gap:5px;">
        <div style="display:flex;gap:6px;">
          <button class="p-btn edit" onclick="openEditModal('${p.id}')">✏️ এডিট</button>
          <button class="p-btn delete" onclick="deleteProduct('${p.id}')">🗑️</button>
        </div>
        <button class="p-btn" onclick="openProductDetails('${p.id}')"
          style="background:rgba(99,102,241,.12);color:#a5b4fc;border:1px solid rgba(99,102,241,.25);width:100%;">
          📝 বিস্তারিত
        </button>
      </div>
    </div>`;
  }).join('');
}

// ── ADD PRODUCT ──
async function addProduct() {
  const name      = document.getElementById('p-name').value.trim();
  const unitPrice = parseFloat(document.getElementById('p-price').value);
  const stock     = parseFloat(document.getElementById('p-stock-qty').value) || 0;
  const unit      = document.getElementById('p-unit').value || 'কেজি';
  const cat       = document.getElementById('p-category').value;

  if (!name)                 return showToast('error','দরকারি','পণ্যের নাম দিন।');
  if (!unitPrice || unitPrice<=0) return showToast('error','দরকারি','সঠিক মূল্য দিন।');

  const btn = document.getElementById('add-product-btn');
  btn.disabled = true; btn.textContent = 'যোগ হচ্ছে...';

  const product = { id: genId(), name, category: cat, unitPrice, stock, unit, details: '', rowIndex: 0 };
  const result  = await saveProductToSheet(product);

  if (result.success) {
    product.rowIndex = result.rowIndex || 0;
    products.unshift(product);
    localStorage.setItem('kd_products', JSON.stringify(products));
    document.getElementById('p-name').value      = '';
    document.getElementById('p-price').value     = '';
    document.getElementById('p-stock-qty').value = '';
    renderAll();
    // Refresh order item dropdowns
    refreshOrderItemDropdowns();
    showToast('success','যোগ হয়েছে!',`"${name}" পণ্য তালিকায় যোগ হয়েছে।`);
  } else {
    showToast('error','সমস্যা','Sheet-এ save হয়নি। আবার চেষ্টা করুন।');
  }
  btn.disabled = false; btn.textContent = '➕ পণ্য যোগ করুন';
}

// ── DELETE PRODUCT ──
async function deleteProduct(id) {
  if (!confirm('এই পণ্যটি মুছে ফেলবেন?')) return;
  const result = await deleteProductFromSheet(id);
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
  document.getElementById('edit-p-name').value     = p.name;
  document.getElementById('edit-p-price').value    = p.unitPrice;
  document.getElementById('edit-p-stock-qty').value= p.stock;
  document.getElementById('edit-p-unit').value     = p.unit;
  document.getElementById('edit-p-category').value = p.category;
  document.getElementById('product-modal').classList.add('open');
}

function closeEditModal() {
  document.getElementById('product-modal').classList.remove('open');
  editingId = null;
}

async function saveEditProduct() {
  const p = products.find(x => x.id === editingId);
  if (!p) return;
  p.name      = document.getElementById('edit-p-name').value.trim();
  p.unitPrice = parseFloat(document.getElementById('edit-p-price').value)     || 0;
  p.stock     = parseFloat(document.getElementById('edit-p-stock-qty').value) || 0;
  p.unit      = document.getElementById('edit-p-unit').value || 'কেজি';
  p.category  = document.getElementById('edit-p-category').value;
  if (!p.name) return showToast('error','দরকারি','পণ্যের নাম দিন।');

  const btn = document.getElementById('save-edit-btn');
  btn.disabled = true; btn.textContent = 'সেভ হচ্ছে...';

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
  btn.disabled = false; btn.textContent = '💾 সেভ করুন';
}

// ── PRODUCT DETAILS MODAL ──
function openProductDetails(id) {
  const p = products.find(x => x.id === id);
  if (!p) return;
  window._detailProductId = id;
  document.getElementById('pd-title').textContent   = p.name;
  document.getElementById('pd-details').value       = p.details || '';
  document.getElementById('product-details-modal').classList.add('open');
}

function closeProductDetails() {
  document.getElementById('product-details-modal').classList.remove('open');
}

async function saveProductDetails() {
  const id = window._detailProductId;
  const p  = products.find(x => x.id === id);
  if (!p) return;
  p.details = document.getElementById('pd-details').value;
  const result = await saveProductToSheet(p);
  if (result.success) {
    localStorage.setItem('kd_products', JSON.stringify(products));
    closeProductDetails();
    showToast('success','সেভ হয়েছে','বিস্তারিত সেভ হয়েছে।');
  } else {
    showToast('error','সমস্যা','সেভ হয়নি।');
  }
}

// ── ORDER ITEM DROPDOWN REFRESH ──
function refreshOrderItemDropdowns() {
  document.querySelectorAll('.product-select').forEach(sel => {
    const current = sel.value;
    sel.innerHTML = '<option value="">-- পণ্য সিলেক্ট করুন --</option>' +
      products.map(p => `<option value="${p.id}" data-price="${p.unitPrice}" data-unit="${p.unit}">${p.name} (৳${p.unitPrice}/${p.unit})</option>`).join('');
    if (current) sel.value = current;
  });
}

function renderAll() {
  renderProductSummary();
  renderCatFilter();
  renderProductGrid();
}

// ── INIT ──
async function initProducts() {
  if (productsLoaded) { renderAll(); return; }

  document.getElementById('product-grid').innerHTML =
    '<div class="empty-state" style="grid-column:1/-1"><div class="spinner"></div><p>লোড হচ্ছে...</p></div>';

  await fetchProductsFromSheet();
  productsLoaded = true;
  renderAll();
}

function refreshProducts() {
  productsLoaded = false;
  initProducts();
}
