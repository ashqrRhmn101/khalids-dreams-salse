// ══════════════════════════════════════════════
//  Khalid's Dreams — AI Assist
//  Google Gemini দিয়ে order text parse করে
//  form auto-fill করে
// ══════════════════════════════════════════════

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

// ── OPEN AI ASSIST MODAL ──
function openAIAssist() {
  document.getElementById('ai-assist-modal').classList.add('open');
  document.getElementById('ai-input-text').value = '';
  document.getElementById('ai-result-preview').style.display = 'none';
  document.getElementById('ai-extract-btn').style.display = 'inline-flex';
  setTimeout(() => document.getElementById('ai-input-text').focus(), 100);
}

function closeAIAssist() {
  document.getElementById('ai-assist-modal').classList.remove('open');
}

// ── EXTRACT — Gemini API call ──
async function aiExtractOrder() {
  const text = document.getElementById('ai-input-text').value.trim();
  if (!text) return showToast('error', 'খালি!', 'অর্ডারের text paste করুন।');

  // Get Gemini key from config.js
  const geminiKey = typeof GEMINI_API_KEY !== 'undefined' ? GEMINI_API_KEY : '';
  if (!geminiKey) {
    return showToast('error', 'API Key নেই', 'config.js-এ GEMINI_API_KEY বসান।');
  }

  const btn = document.getElementById('ai-extract-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="btn-spinner"></span> AI বিশ্লেষণ করছে...';

  const prompt = `তুমি একটি বাংলাদেশি e-commerce order form fill করার assistant।
নিচের text থেকে order তথ্য extract করো এবং শুধুমাত্র JSON format-এ return করো।

Text:
"""
${text}
"""

নিচের JSON format-এ return করো (বাংলা বা English যেকোনো ভাষায় থাকুক):
{
  "name": "গ্রাহকের পূর্ণ নাম",
  "phone": "ফোন নম্বর (01XXXXXXXXX format)",
  "address": "বাড়ি/রাস্তা/এলাকার ঠিকানা",
  "district": "জেলার নাম (বাংলায়, যেমন: Sylhet, Dhaka, Chittagong)",
  "thana": "থানা/উপজেলার নাম",
  "note": "বিশেষ নির্দেশনা থাকলে",
  "items": [
    {
      "name": "পণ্যের নাম",
      "qty": 1,
      "rate": 0
    }
  ]
}

নিয়ম:
- phone থেকে শুধু digits নাও, country code (+880/880) বাদ দাও, 01 দিয়ে শুরু করো
- district এবং thana আলাদা করো address থেকে
- items array-তে পণ্যের নাম, পরিমাণ (কেজি/পিস) এবং দর আলাদা করো
- rate না পাওয়া গেলে 0 দাও
- কোনো field না পেলে "" দাও
- শুধু JSON return করো, অন্য কিছু না`;

  try {
    const resp = await fetch(`${GEMINI_API_URL}?key=${geminiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 1000 },
      }),
    });

    if (!resp.ok) {
      const err = await resp.json();
      throw new Error(err.error?.message || 'API error');
    }

    const data     = await resp.json();
    const rawText  = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('AI response parse হয়নি');

    const parsed = JSON.parse(jsonMatch[0]);
    showAIPreview(parsed);

  } catch(err) {
    console.error('AI Assist error:', err);
    showToast('error', 'AI সমস্যা', err.message || 'Extract করা যায়নি।');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '✨ Extract করুন';
  }
}

// ── SHOW PREVIEW ──
function showAIPreview(data) {
  window._aiExtractedData = data;
  const preview = document.getElementById('ai-result-preview');

  const itemsHTML = (data.items || []).map((it, i) => `
    <div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid rgba(201,168,76,.1);">
      <span style="color:var(--white);">${it.name || '—'}</span>
      <span style="color:var(--gold-light);">${it.qty||1} × ৳${it.rate||0}</span>
    </div>`).join('') || '<div style="color:var(--white-dim);font-size:.8rem;">পণ্য পাওয়া যায়নি</div>';

  preview.innerHTML = `
    <div class="ai-preview-box">
      <div class="ai-preview-title">✅ AI এই তথ্য পেয়েছে — চেক করুন</div>
      <div class="ai-preview-grid">
        <div class="ai-preview-row"><span class="ap-label">নাম</span><span class="ap-val">${data.name||'—'}</span></div>
        <div class="ai-preview-row"><span class="ap-label">ফোন</span><span class="ap-val">${data.phone||'—'}</span></div>
        <div class="ai-preview-row"><span class="ap-label">জেলা</span><span class="ap-val">${data.district||'—'}</span></div>
        <div class="ai-preview-row"><span class="ap-label">থানা</span><span class="ap-val">${data.thana||'—'}</span></div>
        <div class="ai-preview-row"><span class="ap-label">ঠিকানা</span><span class="ap-val">${data.address||'—'}</span></div>
        ${data.note ? `<div class="ai-preview-row"><span class="ap-label">নোট</span><span class="ap-val">${data.note}</span></div>` : ''}
      </div>
      <div class="ai-preview-items">
        <div style="font-size:.72rem;color:var(--gold);letter-spacing:.08em;text-transform:uppercase;margin-bottom:.5rem;">পণ্য</div>
        ${itemsHTML}
      </div>
      <div class="ai-preview-actions">
        <button class="modal-btn cancel" onclick="closeAIAssist()" style="flex:0 0 auto;">বাতিল</button>
        <button class="modal-btn save" onclick="applyAIData()" style="flex:1;">
          ✅ Form-এ বসিয়ে দিন
        </button>
      </div>
    </div>`;
  preview.style.display = 'block';
  document.getElementById('ai-extract-btn').style.display = 'none';
}

// ── APPLY TO FORM ──
async function applyAIData() {
  const data = window._aiExtractedData;
  if (!data) return;

  // Name
  const nameEl = document.getElementById('cust-name');
  if (nameEl && data.name) nameEl.value = data.name;

  // Phone
  const phoneEl = document.getElementById('cust-phone');
  if (phoneEl && data.phone) {
    phoneEl.value = normalizePhone(data.phone);
    // Trigger auto-fill lookup
    await onPhoneInputLookup(phoneEl);
  }

  // Address
  const addrEl = document.getElementById('address');
  if (addrEl && data.address) addrEl.value = data.address;

  // District
  if (data.district) {
    const distSel = document.getElementById('district');
    if (distSel) {
      // Try exact match first, then partial
      const opts = Array.from(distSel.options);
      const match = opts.find(o =>
        o.value.toLowerCase() === data.district.toLowerCase() ||
        o.value.toLowerCase().includes(data.district.toLowerCase()) ||
        data.district.toLowerCase().includes(o.value.toLowerCase())
      );
      if (match) {
        distSel.value = match.value;
        onDistrictChange();
        // Set thana after district loads
        if (data.thana) {
          setTimeout(() => {
            const thanaSel = document.getElementById('thana');
            if (thanaSel) {
              const tMatch = Array.from(thanaSel.options).find(o =>
                o.value.toLowerCase().includes(data.thana.toLowerCase()) ||
                data.thana.toLowerCase().includes(o.value.toLowerCase())
              );
              if (tMatch) thanaSel.value = tMatch.value;
            }
          }, 100);
        }
      }
    }
  }

  // Note
  const noteEl = document.getElementById('note');
  if (noteEl && data.note) noteEl.value = data.note;

  // Items — reset and fill
  if (data.items && data.items.length) {
    orderItems = [];
    itemCounter = 0;
    data.items.forEach(it => {
      itemCounter++;
      orderItems.push({
        id:        itemCounter,
        name:      it.name || '',
        qty:       parseFloat(it.qty)  || 1,
        rate:      parseFloat(it.rate) || 0,
        price:     parseFloat(((it.qty||1) * (it.rate||0)).toFixed(2)),
        productId: '',
        unit:      'কেজি',
      });
    });
    renderOrderItems();
    updateOrderSubtotal();
  }

  // Datetime
  setDateTime();
  updateGrandTotal();

  closeAIAssist();
  showToast('success', '✨ AI Assist সম্পন্ন!', 'Form-এ তথ্য বসানো হয়েছে। চেক করুন।');
}
