// =====================================================
//  Khalid's Dreams — Google Apps Script v14
//  ✅ Security: সব API key Properties Service-এ
//  Actions: fetch | save | payment | edit_invoice
//           steadfast_order | steadfast_track
//           steadfast_balance | steadfast_cancel
//           update_statuses | fraudbd_check
// =====================================================

// ══ KEY SETUP — একবার run করো, তারপর আর লাগবে না ══
// Apps Script editor-এ setSecretKeys() function select করে ▶️ Run করো
function setSecretKeys() {
  const props = PropertiesService.getScriptProperties();
  props.setProperties({
    'STEADFAST_API_KEY'    : 'oumpa8mpf0c5dfa0slj8dxrdprl2b0s8',
    'STEADFAST_SECRET_KEY' : 'btu7xsynyy2p8sy8u8bdqnlr',
    'STEADFAST_BASE_URL'   : 'https://portal.packzy.com/api/v1',
    'FRAUDBD_API_KEY'      : 'fe9a118ac2332c87c85cbd9b5b7b5af6f6b27e0974ece6360d189401bd78777a',
    'FRAUDBD_BASE_URL'     : 'https://fraudbd.com',
  });
  Logger.log('✅ Keys saved to Properties Service securely!');
}
// ════════════════════════════════════════════════════

// ── Runtime: Properties থেকে key পড়ো ──
function getProps_() {
  return PropertiesService.getScriptProperties().getProperties();
}

function normalizePhone_(phone) {
  let p = String(phone || '').trim().replace(/[\s\-]/g, '');
  p = p.replace(/^\+?88/, '');
  if (p.length === 10 && p.charAt(0) === '1') p = '0' + p;
  return p;
}

function jsonp_(cb, data) {
  return ContentService
    .createTextOutput(cb + '(' + JSON.stringify(data) + ')')
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function steadfastHeaders_() {
  const props = getProps_();
  return {
    'Api-Key'     : props.STEADFAST_API_KEY,
    'Secret-Key'  : props.STEADFAST_SECRET_KEY,
    'Content-Type': 'application/json',
  };
}

function fraudBdHeaders_() {
  const props = getProps_();
  return {
    'Authorization': 'Bearer ' + props.FRAUDBD_API_KEY,
    'Content-Type' : 'application/json',
  };
}

function getSteadfastBaseUrl_() {
  return getProps_().STEADFAST_BASE_URL || 'https://portal.packzy.com/api/v1';
}

function getFraudBdBaseUrl_() {
  return getProps_().FRAUDBD_BASE_URL || 'https://fraudbd.com';
}

// ════════════════════════════════════════════════════
function doGet(e) {
  const p  = e.parameter;
  const cb = p.callback || 'callback';

  // ── FETCH — বিক্রয় ইতিহাস ও গ্রাহক তালিকা ──
  if (p.action === 'fetch') {
    try {
      const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
      const rows  = sheet.getDataRange().getValues();
      const data  = [];
      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        if (!r[0]) continue;
        data.push({
          invoiceNo:    String(r[0]  || ''),
          name:         String(r[1]  || ''),
          phone:        normalizePhone_(r[2]),
          district:     String(r[3]  || ''),
          thana:        String(r[4]  || ''),
          address:      String(r[5]  || ''),
          items:        String(r[6]  || ''),
          subtotal:     parseFloat(r[7])  || 0,
          courier:      parseFloat(r[8])  || 0,
          discount:     parseFloat(r[9])  || 0,
          advance:      parseFloat(r[10]) || 0,
          total:        parseFloat(r[11]) || 0,
          due:          parseFloat(r[12]) || 0,
          datetime:     String(r[13] || ''),
          note:         String(r[14] || ''),
          timestamp:    String(r[15] || ''),
          trackingCode: String(r[16] || ''),
          sfStatus:     String(r[17] || ''),
          sfConsign:    String(r[18] || ''),
        });
      }
      return jsonp_(cb, { success: true, data });
    } catch(err) {
      return jsonp_(cb, { success: false, error: err.message });
    }
  }

  // ── PAYMENT — বাকি পরিশোধ (FIFO) ──
  if (p.action === 'payment') {
    try {
      const phone     = normalizePhone_(p.phone);
      let   remaining = parseFloat(p.amount) || 0;
      const sheet     = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
      const rows      = sheet.getDataRange().getValues();
      const dueRows   = [];
      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        if (!r[0]) continue;
        if (normalizePhone_(r[2]) !== phone) continue;
        const due = parseFloat(r[12]) || 0;
        if (due > 0) dueRows.push({ rowIdx: i + 1, due });
      }
      dueRows.sort((a, b) => a.rowIdx - b.rowIdx);
      const updated = [];
      for (const row of dueRows) {
        if (remaining <= 0) break;
        const deduct = Math.min(remaining, row.due);
        const newDue = parseFloat((row.due - deduct).toFixed(2));
        sheet.getRange(row.rowIdx, 13).setValue(newDue);
        updated.push({ row: row.rowIdx, oldDue: row.due, newDue });
        remaining = parseFloat((remaining - deduct).toFixed(2));
      }
      return jsonp_(cb, { success: true, updated, remaining });
    } catch(err) {
      return jsonp_(cb, { success: false, error: err.message });
    }
  }

  // ── EDIT INVOICE ──
  if (p.action === 'edit_invoice') {
    try {
      const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
      const rows  = sheet.getDataRange().getValues();
      let   found = false;
      for (let i = 1; i < rows.length; i++) {
        if (String(rows[i][0]) === String(p.invoiceNo)) {
          if (p.total    !== undefined) sheet.getRange(i+1, 12).setValue(parseFloat(p.total)    || 0);
          if (p.courier  !== undefined) sheet.getRange(i+1,  9).setValue(parseFloat(p.courier)  || 0);
          if (p.discount !== undefined) sheet.getRange(i+1, 10).setValue(parseFloat(p.discount) || 0);
          if (p.advance  !== undefined) sheet.getRange(i+1, 11).setValue(parseFloat(p.advance)  || 0);
          if (p.due      !== undefined) sheet.getRange(i+1, 13).setValue(parseFloat(p.due)      || 0);
          if (p.note     !== undefined) sheet.getRange(i+1, 15).setValue(p.note || '');
          found = true;
          break;
        }
      }
      return jsonp_(cb, { success: found, message: found ? 'Updated' : 'Invoice not found' });
    } catch(err) {
      return jsonp_(cb, { success: false, error: err.message });
    }
  }

  // ── STEADFAST: নতুন অর্ডার তৈরি ──
  if (p.action === 'steadfast_order') {
    try {
      const BASE = getSteadfastBaseUrl_();
      const payload = JSON.stringify({
        invoice          : String(p.invoiceNo || ''),
        recipient_name   : String(p.name      || ''),
        recipient_phone  : normalizePhone_(p.phone),
        recipient_address: String(p.address   || ''),
        cod_amount       : parseFloat(p.codAmount) || 0,
        note             : String(p.note || ''),
        item_type        : 'parcel',
      });

      const resp   = UrlFetchApp.fetch(BASE + '/create_order', {
        method: 'POST', headers: steadfastHeaders_(),
        payload: payload, muteHttpExceptions: true,
      });
      const result = JSON.parse(resp.getContentText());

      if (result.status === 200 && result.consignment) {
        const consign  = result.consignment;
        const tracking = consign.tracking_code || '';
        const sfId     = String(consign.id || '');
        const status   = consign.status || 'pending';

        const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
        const rows  = sheet.getDataRange().getValues();
        for (let i = 1; i < rows.length; i++) {
          if (String(rows[i][0]) === String(p.invoiceNo)) {
            sheet.getRange(i + 1, 17).setValue(tracking);
            sheet.getRange(i + 1, 18).setValue(status);
            sheet.getRange(i + 1, 19).setValue(sfId);
            break;
          }
        }
        return jsonp_(cb, { success: true, trackingCode: tracking, consignmentId: sfId, status });
      } else {
        return jsonp_(cb, { success: false, message: result.message || 'Steadfast order failed' });
      }
    } catch(err) {
      return jsonp_(cb, { success: false, error: err.message });
    }
  }

  // ── STEADFAST: Status by consignment ID ──
  if (p.action === 'steadfast_track') {
    try {
      const BASE = getSteadfastBaseUrl_();
      const resp   = UrlFetchApp.fetch(
        BASE + '/status_by_cid/' + p.consignmentId,
        { method: 'GET', headers: steadfastHeaders_(), muteHttpExceptions: true }
      );
      return jsonp_(cb, { success: true, data: JSON.parse(resp.getContentText()) });
    } catch(err) {
      return jsonp_(cb, { success: false, error: err.message });
    }
  }

  // ── STEADFAST: Account Balance ──
  if (p.action === 'steadfast_balance') {
    try {
      const BASE   = getSteadfastBaseUrl_();
      const resp   = UrlFetchApp.fetch(
        BASE + '/get_balance',
        { method: 'GET', headers: steadfastHeaders_(), muteHttpExceptions: true }
      );
      const result = JSON.parse(resp.getContentText());
      return jsonp_(cb, { success: true, balance: result.current_balance || 0 });
    } catch(err) {
      return jsonp_(cb, { success: false, error: err.message });
    }
  }

  // ── STEADFAST: অর্ডার বাতিল ──
  if (p.action === 'steadfast_cancel') {
    try {
      const BASE   = getSteadfastBaseUrl_();
      const resp   = UrlFetchApp.fetch(BASE + '/update_payment_status', {
        method:  'POST',
        headers: steadfastHeaders_(),
        payload: JSON.stringify({ consignment_id: p.consignmentId }),
        muteHttpExceptions: true,
      });
      const result = JSON.parse(resp.getContentText());

      if (p.invoiceNo) {
        const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
        const rows  = sheet.getDataRange().getValues();
        for (let i = 1; i < rows.length; i++) {
          if (String(rows[i][0]) === String(p.invoiceNo)) {
            sheet.getRange(i + 1, 18).setValue('cancelled');
            break;
          }
        }
      }
      return jsonp_(cb, { success: true, data: result });
    } catch(err) {
      return jsonp_(cb, { success: false, error: err.message });
    }
  }

  // ── STEADFAST: Batch status update ──
  if (p.action === 'update_statuses') {
    try {
      const BASE    = getSteadfastBaseUrl_();
      const sheet   = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
      const rows    = sheet.getDataRange().getValues();
      let   updated = 0;
      const finalSt = ['delivered', 'cancelled', 'partial_delivered', 'returned'];

      for (let i = 1; i < rows.length; i++) {
        const sfId  = String(rows[i][18] || '');
        if (!sfId) continue;
        const status = String(rows[i][17] || '').toLowerCase();
        if (finalSt.includes(status)) continue;
        try {
          const resp      = UrlFetchApp.fetch(BASE + '/status_by_cid/' + sfId,
            { method: 'GET', headers: steadfastHeaders_(), muteHttpExceptions: true });
          const res       = JSON.parse(resp.getContentText());
          const newStatus = String(res.delivery_status || res.status || '').toLowerCase();
          if (newStatus && newStatus !== status) {
            sheet.getRange(i + 1, 18).setValue(newStatus);
            updated++;
          }
        } catch(e) {}
        Utilities.sleep(300);
      }
      return jsonp_(cb, { success: true, updated });
    } catch(err) {
      return jsonp_(cb, { success: false, error: err.message });
    }
  }

  // ── FRAUDBD: Phone দিয়ে customer history ──
  if (p.action === 'fraudbd_check') {
    try {
      const BASE   = getFraudBdBaseUrl_();
      const phone  = normalizePhone_(p.phone);
      const resp   = UrlFetchApp.fetch(
        BASE + '/api/check-phone/' + phone,
        { method: 'GET', headers: fraudBdHeaders_(), muteHttpExceptions: true }
      );
      const code   = resp.getResponseCode();
      const result = JSON.parse(resp.getContentText());

      if (code === 200 && result.status) {
        const sf  = (result.data && result.data.Summaries && result.data.Summaries.Steadfast) || {};
        const all = (result.data && result.data.totalSummary) || {};
        return jsonp_(cb, {
          success: true,
          steadfast:   { total: sf.total||0,  success: sf.success||0,  cancel: sf.cancel||0  },
          allCouriers: { total: all.total||0, success: all.success||0, cancel: all.cancel||0 },
        });
      } else {
        return jsonp_(cb, { success: false, message: result.message || 'Not found', code });
      }
    } catch(err) {
      return jsonp_(cb, { success: false, error: err.message });
    }
  }

  // ── SAVE — নতুন sale ──
  try {
    const sheet  = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const invNo  = p.invoiceNo || ('KD-' + Date.now().toString().slice(-6));
    sheet.appendRow([
      invNo,
      p.name       || '',
      "'" + normalizePhone_(p.phone),
      p.district   || '',
      p.thana      || '',
      p.address    || '',
      p.items      || '',
      parseFloat(p.subtotal) || 0,  // H
      parseFloat(p.courier)  || 0,  // I
      parseFloat(p.discount) || 0,  // J
      parseFloat(p.advance)  || 0,  // K
      parseFloat(p.total)    || 0,  // L — Grand Total
      parseFloat(p.due)      || 0,  // M — Due
      p.datetime   || '',            // N
      p.note       || '',            // O
      p.timestamp  || '',            // P
      '',                            // Q — Tracking Code
      '',                            // R — Delivery Status
      '',                            // S — Consignment ID
    ]);
    return jsonp_(cb, { success: true, invoice: invNo });
  } catch(err) {
    return jsonp_(cb, { success: false, error: err.message });
  }
}

function doPost(e) { return doGet(e); }

// ════════════════════════════════════════════════════
// ── Manual Functions ──
// ════════════════════════════════════════════════════

// ★ STEP 1: এটা প্রথমে run করো — সব key Properties-এ save হবে
function setSecretKeys() {
  PropertiesService.getScriptProperties().setProperties({
    'STEADFAST_API_KEY'    : 'oumpa8mpf0c5dfa0slj8dxrdprl2b0s8',
    'STEADFAST_SECRET_KEY' : 'btu7xsynyy2p8sy8u8bdqnlr',
    'STEADFAST_BASE_URL'   : 'https://portal.packzy.com/api/v1',
    'FRAUDBD_API_KEY'      : 'fe9a118ac2332c87c85cbd9b5b7b5af6f6b27e0974ece6360d189401bd78777a',
    'FRAUDBD_BASE_URL'     : 'https://fraudbd.com',
  });
  Logger.log('✅ All keys saved securely!');
}

// API connection test
function testConnection() {
  const BASE = getSteadfastBaseUrl_();
  const resp = UrlFetchApp.fetch(BASE + '/get_balance', {
    method: 'GET', headers: steadfastHeaders_(), muteHttpExceptions: true,
  });
  Logger.log('Status: ' + resp.getResponseCode());
  Logger.log('Response: ' + resp.getContentText());
}

// Phone number fix — একবার run করলেই হবে
function fixExistingPhoneNumbers() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const rows  = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    const cur   = String(rows[i][2] || '').replace(/^'/, '');
    const fixed = normalizePhone_(cur);
    if (fixed && fixed !== cur) sheet.getRange(i + 1, 3).setValue("'" + fixed);
  }
  Logger.log('✅ Phone numbers fixed!');
}

// Steadfast সব pending status refresh
function refreshAllStatuses() {
  const BASE       = getSteadfastBaseUrl_();
  const sheet      = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const rows       = sheet.getDataRange().getValues();
  let   updated    = 0;
  const finalSt    = ['delivered', 'cancelled', 'partial_delivered', 'returned'];
  for (let i = 1; i < rows.length; i++) {
    const sfId  = String(rows[i][18] || '');
    if (!sfId) continue;
    const status = String(rows[i][17] || '').toLowerCase();
    if (finalSt.includes(status)) continue;
    try {
      const resp = UrlFetchApp.fetch(BASE + '/status_by_cid/' + sfId,
        { method: 'GET', headers: steadfastHeaders_(), muteHttpExceptions: true });
      const res       = JSON.parse(resp.getContentText());
      const newStatus = String(res.delivery_status || res.status || '').toLowerCase();
      if (newStatus && newStatus !== status) {
        sheet.getRange(i + 1, 18).setValue(newStatus);
        updated++;
        Logger.log('Row ' + (i+1) + ': ' + status + ' → ' + newStatus);
      }
    } catch(e) { Logger.log('Error row ' + (i+1) + ': ' + e.message); }
    Utilities.sleep(300);
  }
  Logger.log('✅ Total updated: ' + updated);
}
