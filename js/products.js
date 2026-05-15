// ══════════════════════════════════════════════
//  Khalid's Dreams — Product Catalog
// ══════════════════════════════════════════════

const CATEGORIES = ['সব', 'মধু', 'ঘি', 'তেল', 'চাল', 'ডাল', 'মসলা', 'অন্যান্য'];
const CAT_EMOJI  = { 'মধু':'🍯','ঘি':'🧈','তেল':'🫙','চাল':'🌾','ডাল':'🫘','মসলা':'🌶️','অন্যান্য':'📦' };

let products      = JSON.parse(localStorage.getItem('kd_products') || '[]');
let editingId     = null;
let activeFilter  = 'সব';

function saveProducts() {
  localStorage.setItem('kd_products', JSON.stringify(products));
}

function genId() { return 'p_' + Date.now() + '_' + Math.random().toString(36).slice(2,6); }

// ── RENDER STOCK SUMMARY ──
function renderProductSummary() {
  const total = products.length;
  const low   = products.filter(p => p.stock > 0 && p.stock <= 5).length;
  const out   = products.filter(p => p.stock === 0).length;
  document.getElementById('p-total').textContent = total;
  document.getElementById('p-low').textContent   = low;
  document.getElementById('p-out').textContent   = out;
}

// ── RENDER CATEGORY FILTERS ──
function renderCatFilter() {
  const el = document.getElementById('cat-filter');
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
  const filtered = activeFilter === 'সব'
    ? products
    : products.filter(p => p.category === activeFilter);

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <span class="e-icon">📦</span>
        <p>${activeFilter === 'সব' ? 'এখনো কোনো পণ্য যোগ করা হয়নি' : `"${activeFilter}" ক্যাটাগরিতে কোনো পণ্য নেই`}</p>
      </div>`;
    return;
  }

  grid.innerHTML = filtered.map(p => {
    const emoji = CAT_EMOJI[p.category] || '📦';
    const stockClass = p.stock === 0 ? 'out' : p.stock <= 5 ? 'low' : 'ok';
    const stockText  = p.stock === 0 ? 'স্টক নেই' : p.stock <= 5 ? `মাত্র ${p.stock} টি` : `${p.stock} টি`;
    return `
    <div class="product-card">
      <span class="p-emoji">${emoji}</span>
      <div class="p-name">${p.name}</div>
      <div class="p-cat">${p.category}</div>
      <div class="p-price">৳ ${Number(p.price).toLocaleString('en-US')}</div>
      <span class="p-stock ${stockClass}">${stockText}</span>
      <div class="p-actions">
        <button class="p-btn edit" onclick="openEditModal('${p.id}')">✏️ এডিট</button>
        <button class="p-btn delete" onclick="deleteProduct('${p.id}')">🗑️</button>
      </div>
    </div>`;
  }).join('');
}

// ── ADD PRODUCT ──
function addProduct() {
  const name  = document.getElementById('p-name').value.trim();
  const price = parseFloat(document.getElementById('p-price').value);
  const stock = parseInt(document.getElementById('p-stock').value) || 0;
  const cat   = document.getElementById('p-category').value;

  if (!name) return showToast('error', 'দরকারি', 'পণ্যের নাম দিন।');
  if (!price || price <= 0) return showToast('error', 'দরকারি', 'সঠিক মূল্য দিন।');

  const product = { id: genId(), name, price, stock, category: cat, createdAt: new Date().toISOString() };
  products.unshift(product);
  saveProducts();

  document.getElementById('p-name').value  = '';
  document.getElementById('p-price').value = '';
  document.getElementById('p-stock').value = '';

  renderAll();
  showToast('success', 'যোগ হয়েছে!', `"${name}" পণ্য তালিকায় যোগ করা হয়েছে।`);
}

// ── DELETE PRODUCT ──
function deleteProduct(id) {
  if (!confirm('এই পণ্যটি মুছে ফেলবেন?')) return;
  products = products.filter(p => p.id !== id);
  saveProducts();
  renderAll();
  showToast('success', 'মুছে গেছে', 'পণ্যটি তালিকা থেকে সরানো হয়েছে।');
}

// ── EDIT MODAL ──
function openEditModal(id) {
  const p = products.find(x => x.id === id);
  if (!p) return;
  editingId = id;
  document.getElementById('edit-p-name').value  = p.name;
  document.getElementById('edit-p-price').value = p.price;
  document.getElementById('edit-p-stock').value = p.stock;
  document.getElementById('edit-p-category').value = p.category;
  document.getElementById('product-modal').classList.add('open');
}

function closeEditModal() {
  document.getElementById('product-modal').classList.remove('open');
  editingId = null;
}

function saveEditProduct() {
  const p = products.find(x => x.id === editingId);
  if (!p) return;
  const name  = document.getElementById('edit-p-name').value.trim();
  const price = parseFloat(document.getElementById('edit-p-price').value);
  const stock = parseInt(document.getElementById('edit-p-stock').value) || 0;
  const cat   = document.getElementById('edit-p-category').value;

  if (!name) return showToast('error', 'দরকারি', 'পণ্যের নাম দিন।');
  if (!price || price <= 0) return showToast('error', 'দরকারি', 'সঠিক মূল্য দিন।');

  p.name = name; p.price = price; p.stock = stock; p.category = cat;
  saveProducts();
  closeEditModal();
  renderAll();
  showToast('success', 'আপডেট হয়েছে!', `"${name}" এর তথ্য আপডেট করা হয়েছে।`);
}

function renderAll() {
  renderProductSummary();
  renderCatFilter();
  renderProductGrid();
}

// ── INIT ──
function initProducts() { renderAll(); }
