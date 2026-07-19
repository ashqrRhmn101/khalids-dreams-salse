// =====================================================
//  Khalid's Dreams — Google Apps Script v10
//  Actions: fetch | save | payment
//           steadfast_order | steadfast_track
//           steadfast_balance | update_statuses
//  Base URL: https://portal.packzy.com/api/v1
// =====================================================

// ══ CONFIG — মাসে একবার শুধু এই দুটো line বদলাও ══
const STEADFAST_API_KEY    = 'oumpa8mpf0c5dfa0slj8dxrdprl2b0s8';
const STEADFAST_SECRET_KEY = 'btu7xsynyy2p8sy8u8bdqnlr';
const STEADFAST_BASE_URL   = 'https://portal.packzy.com/api/v1';
// ════════════════════════════════════════════════════

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
  return {
    'Api-Key'     : STEADFAST_API_KEY,
    'Secret-Key'  : STEADFAST_SECRET_KEY,
    'Content-Type': 'application/json',
  };
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
      dueRows.sort((a, b) => a.rowIdx - b.rowIdx); // পুরনো invoice আগে
      const updated = [];
      for (const row of dueRows) {
        if (remaining <= 0) break;
        const deduct = Math.min(remaining, row.due);
        const newDue = parseFloat((row.due - deduct).toFixed(2));
        sheet.getRange(row.rowIdx, 13).setValue(newDue); // M = Due
        updated.push({ row: row.rowIdx, oldDue: row.due, newDue });
        remaining = parseFloat((remaining - deduct).toFixed(2));
      }
      return jsonp_(cb, { success: true, updated, remaining });
    } catch(err) {
      return jsonp_(cb, { success: false, error: err.message });
    }
  }

  // ── STEADFAST: নতুন অর্ডার তৈরি ──
  if (p.action === 'steadfast_order') {
    try {
      const payload = JSON.stringify({
        invoice          : p.invoiceNo  || '',
        recipient_name   : p.name       || '',
        recipient_phone  : normalizePhone_(p.phone),
        recipient_address: p.address    || '',
        cod_amount       : parseFloat(p.codAmount) || 0,
        note             : p.note       || '',
      });

      const resp   = UrlFetchApp.fetch(STEADFAST_BASE_URL + '/create_order', {
        method: 'POST', headers: steadfastHeaders_(),
        payload: payload, muteHttpExceptions: true,
      });
      const result = JSON.parse(resp.getContentText());

      if (result.status === 200 && result.consignment) {
        const consign  = result.consignment;
        const tracking = consign.tracking_code || '';
        const sfId     = String(consign.id || '');
        const status   = consign.status || 'pending';

        // Sheet-এ tracking code, status, consignment ID save করো
        const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
        const rows  = sheet.getDataRange().getValues();
        for (let i = 1; i < rows.length; i++) {
          if (String(rows[i][0]) === String(p.invoiceNo)) {
            sheet.getRange(i + 1, 17).setValue(tracking); // Q
            sheet.getRange(i + 1, 18).setValue(status);   // R
            sheet.getRange(i + 1, 19).setValue(sfId);     // S
            break;
          }
        }
        return jsonp_(cb, { success: true, trackingCode: tracking, consignmentId: sfId, status });
      } else {
        return jsonp_(cb, {
          success: false,
          message: result.message || 'Steadfast order failed',
        });
      }
    } catch(err) {
      return jsonp_(cb, { success: false, error: err.message });
    }
  }

  // ── STEADFAST: Consignment ID দিয়ে status check ──
  if (p.action === 'steadfast_track') {
    try {
      const resp   = UrlFetchApp.fetch(
        STEADFAST_BASE_URL + '/status_by_cid/' + p.consignmentId,
        { method: 'GET', headers: steadfastHeaders_(), muteHttpExceptions: true }
      );
      const result = JSON.parse(resp.getContentText());
      return jsonp_(cb, { success: true, data: result });
    } catch(err) {
      return jsonp_(cb, { success: false, error: err.message });
    }
  }

  // ── STEADFAST: Account Balance ──
  if (p.action === 'steadfast_balance') {
    try {
      const resp   = UrlFetchApp.fetch(
        STEADFAST_BASE_URL + '/get_balance',
        { method: 'GET', headers: steadfastHeaders_(), muteHttpExceptions: true }
      );
      const result = JSON.parse(resp.getContentText());
      return jsonp_(cb, { success: true, balance: result.current_balance || 0 });
    } catch(err) {
      return jsonp_(cb, { success: false, error: err.message });
    }
  }

  // ── STEADFAST: সব pending order-এর status batch update ──
  if (p.action === 'update_statuses') {
    try {
      const sheet   = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
      const rows    = sheet.getDataRange().getValues();
      let   updated = 0;
      const finalStatuses = ['delivered', 'cancelled', 'partial_delivered', 'returned'];

      for (let i = 1; i < rows.length; i++) {
        const sfId   = String(rows[i][18] || ''); // S = consignment ID
        if (!sfId) continue;
        const status = String(rows[i][17] || '').toLowerCase(); // R = status
        if (finalStatuses.includes(status)) continue; // final status হলে skip

        try {
          const resp = UrlFetchApp.fetch(
            STEADFAST_BASE_URL + '/status_by_cid/' + sfId,
            { method: 'GET', headers: steadfastHeaders_(), muteHttpExceptions: true }
          );
          const res       = JSON.parse(resp.getContentText());
          const newStatus = String(res.delivery_status || res.status || '').toLowerCase();
          if (newStatus && newStatus !== status) {
            sheet.getRange(i + 1, 18).setValue(newStatus);
            updated++;
          }
        } catch(e) { /* individual error skip */ }
        Utilities.sleep(300); // rate limit — 300ms gap
      }
      return jsonp_(cb, { success: true, updated });
    } catch(err) {
      return jsonp_(cb, { success: false, error: err.message });
    }
  }

  // ── SAVE — নতুন sale Google Sheet-এ save ──
  try {
    const sheet  = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const invNo  = p.invoiceNo || ('KD-' + Date.now().toString().slice(-6));
    sheet.appendRow([
      invNo,                              // A — Invoice No
      p.name       || '',                 // B — Customer Name
      "'" + normalizePhone_(p.phone),    // C — Phone (force text, leading 0 রক্ষা)
      p.district   || '',                 // D — District
      p.thana      || '',                 // E — Thana
      p.address    || '',                 // F — Address
      p.items      || '',                 // G — Products
      parseFloat(p.subtotal) || 0,       // H — Subtotal
      parseFloat(p.courier)  || 0,       // I — Courier Charge
      parseFloat(p.discount) || 0,       // J — Discount
      parseFloat(p.advance)  || 0,       // K — Advance
      parseFloat(p.total)    || 0,       // L — Grand Total
      parseFloat(p.due)      || 0,       // M — Due
      p.datetime   || '',                 // N — Date & Time
      p.note       || '',                 // O — Note
      p.timestamp  || '',                 // P — Timestamp
      '',                                 // Q — Tracking Code (Steadfast)
      '',                                 // R — Delivery Status
      '',                                 // S — Consignment ID
    ]);
    return jsonp_(cb, { success: true, invoice: invNo });
  } catch(err) {
    return jsonp_(cb, { success: false, error: err.message });
  }
}

function doPost(e) { return doGet(e); }

// ════════════════════════════════════════════════════
// ── Manual Functions — Apps Script editor থেকে run করো ──
// ════════════════════════════════════════════════════

// API connection test — balance check
function testConnection() {
  const resp = UrlFetchApp.fetch(STEADFAST_BASE_URL + '/get_balance', {
    method: 'GET', headers: steadfastHeaders_(), muteHttpExceptions: true,
  });
  Logger.log('Status: ' + resp.getResponseCode());
  Logger.log('Balance: ' + resp.getContentText());
}

// সব পুরনো phone number-এ 0 যোগ করো (একবার run করলেই হবে)
function fixExistingPhoneNumbers() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const rows  = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    const cur   = String(rows[i][2] || '').replace(/^'/, '');
    const fixed = normalizePhone_(cur);
    if (fixed && fixed !== cur) sheet.getRange(i + 1, 3).setValue("'" + fixed);
  }
  Logger.log('Phone numbers fixed!');
}

// সব pending Steadfast order-এর status refresh করো
function refreshAllStatuses() {
  const sheet        = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const rows         = sheet.getDataRange().getValues();
  let   updated      = 0;
  const finalStatuses = ['delivered', 'cancelled', 'partial_delivered', 'returned'];

  for (let i = 1; i < rows.length; i++) {
    const sfId  = String(rows[i][18] || '');
    if (!sfId) continue;
    const status = String(rows[i][17] || '').toLowerCase();
    if (finalStatuses.includes(status)) continue;

    try {
      const resp = UrlFetchApp.fetch(
        STEADFAST_BASE_URL + '/status_by_cid/' + sfId,
        { method: 'GET', headers: steadfastHeaders_(), muteHttpExceptions: true }
      );
      const res       = JSON.parse(resp.getContentText());
      const newStatus = String(res.delivery_status || res.status || '').toLowerCase();
      if (newStatus && newStatus !== status) {
        sheet.getRange(i + 1, 18).setValue(newStatus);
        updated++;
        Logger.log('Updated row ' + (i+1) + ': ' + status + ' → ' + newStatus);
      }
    } catch(e) {
      Logger.log('Error row ' + (i+1) + ': ' + e.message);
    }
    Utilities.sleep(300);
  }
  Logger.log('Total updated: ' + updated);
}
