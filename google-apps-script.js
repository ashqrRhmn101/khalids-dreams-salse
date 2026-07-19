// =====================================================
//  Khalid's Dreams — Google Apps Script v9
//  Actions: fetch | save | payment | steadfast_order
//           steadfast_track | steadfast_check_phone
//           update_status
// =====================================================

// ══ CONFIG — শুধু এখানে API key বদলাও ══
const STEADFAST_API_KEY    = 'oumpa8mpf0c5dfa0slj8dxrdprl2b0s8';
const STEADFAST_SECRET_KEY = 'btu7xsynyy2p8sy8u8bdqnlr';
const STEADFAST_BASE_URL   = 'https://portal.steadfast.com.bd/api/v1';

// ═════════════════════════════════════════

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
    'Api-Key'    : STEADFAST_API_KEY,
    'Secret-Key' : STEADFAST_SECRET_KEY,
    'Content-Type': 'application/json',
  };
}

function doGet(e) {
  const p  = e.parameter;
  const cb = p.callback || 'callback';

  // ── FETCH MODE ──
  if (p.action === 'fetch') {
    try {
      const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
      const rows  = sheet.getDataRange().getValues();
      const data  = [];
      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        if (!r[0]) continue;
        data.push({
          invoiceNo:    r[0]  || '',
          name:         r[1]  || '',
          phone:        normalizePhone_(r[2]),
          district:     r[3]  || '',
          thana:        r[4]  || '',
          address:      r[5]  || '',
          items:        r[6]  || '',
          subtotal:     parseFloat(r[7])  || 0,
          courier:      parseFloat(r[8])  || 0,
          discount:     parseFloat(r[9])  || 0,
          advance:      parseFloat(r[10]) || 0,
          total:        parseFloat(r[11]) || 0,
          due:          parseFloat(r[12]) || 0,
          datetime:     r[13] || '',
          note:         r[14] || '',
          timestamp:    r[15] || '',
          trackingCode: r[16] || '',   // Q — Steadfast tracking
          sfStatus:     r[17] || '',   // R — Delivery status
          sfConsign:    r[18] || '',   // S — Consignment ID
        });
      }
      return jsonp_(cb, { success: true, data });
    } catch(err) {
      return jsonp_(cb, { success: false, error: err.message });
    }
  }

  // ── PAYMENT MODE ──
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

  // ── STEADFAST: CREATE ORDER ──
  if (p.action === 'steadfast_order') {
    try {
      const payload = {
        invoice:          p.invoiceNo,
        recipient_name:   p.name,
        recipient_phone:  normalizePhone_(p.phone),
        recipient_address: p.address,
        cod_amount:       parseFloat(p.codAmount) || 0,
        note:             p.note || '',
      };

      const resp = UrlFetchApp.fetch(STEADFAST_BASE_URL + '/create_order', {
        method:  'POST',
        headers: steadfastHeaders_(),
        payload: JSON.stringify(payload),
        muteHttpExceptions: true,
      });

      const result = JSON.parse(resp.getContentText());

      if (result.status === 200 || result.consignment) {
        const consign  = result.consignment || {};
        const tracking = consign.tracking_code || '';
        const sfId     = consign.id || '';
        const status   = consign.status || 'pending';

        // Update the row in sheet — find by invoiceNo
        const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
        const rows  = sheet.getDataRange().getValues();
        for (let i = 1; i < rows.length; i++) {
          if (rows[i][0] === p.invoiceNo) {
            sheet.getRange(i + 1, 17).setValue(tracking); // Q
            sheet.getRange(i + 1, 18).setValue(status);   // R
            sheet.getRange(i + 1, 19).setValue(sfId);     // S
            break;
          }
        }
        return jsonp_(cb, {
          success: true,
          trackingCode: tracking,
          consignmentId: sfId,
          status,
        });
      } else {
        return jsonp_(cb, {
          success: false,
          message: result.message || 'Steadfast order failed',
          raw: result,
        });
      }
    } catch(err) {
      return jsonp_(cb, { success: false, error: err.message });
    }
  }

  // ── STEADFAST: TRACK BY CONSIGNMENT ID ──
  if (p.action === 'steadfast_track') {
    try {
      const resp = UrlFetchApp.fetch(
        STEADFAST_BASE_URL + '/status_by_cid/' + p.consignmentId,
        { method: 'GET', headers: steadfastHeaders_(), muteHttpExceptions: true }
      );
      const result = JSON.parse(resp.getContentText());
      return jsonp_(cb, { success: true, data: result });
    } catch(err) {
      return jsonp_(cb, { success: false, error: err.message });
    }
  }

  // ── STEADFAST: CHECK PHONE (fraud/history check) ──
  if (p.action === 'steadfast_check_phone') {
    try {
      const resp = UrlFetchApp.fetch(
        STEADFAST_BASE_URL + '/get_order_by_phone/' + normalizePhone_(p.phone),
        { method: 'GET', headers: steadfastHeaders_(), muteHttpExceptions: true }
      );
      const result = JSON.parse(resp.getContentText());
      return jsonp_(cb, { success: true, data: result });
    } catch(err) {
      return jsonp_(cb, { success: false, error: err.message });
    }
  }

  // ── UPDATE DELIVERY STATUS (batch refresh) ──
  if (p.action === 'update_statuses') {
    try {
      const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
      const rows  = sheet.getDataRange().getValues();
      let updated = 0;

      for (let i = 1; i < rows.length; i++) {
        const sfId = rows[i][18]; // S = consignment ID
        if (!sfId) continue;
        const status = rows[i][17]; // R = current status
        // Skip already-final statuses
        if (['delivered','cancelled','partial_delivered'].includes(status)) continue;

        try {
          const resp = UrlFetchApp.fetch(
            STEADFAST_BASE_URL + '/status_by_cid/' + sfId,
            { method: 'GET', headers: steadfastHeaders_(), muteHttpExceptions: true }
          );
          const res = JSON.parse(resp.getContentText());
          const newStatus = (res.delivery_status || res.status || '').toLowerCase();
          if (newStatus && newStatus !== status) {
            sheet.getRange(i + 1, 18).setValue(newStatus);
            updated++;
          }
        } catch(e) { /* skip individual errors */ }
        Utilities.sleep(200); // rate limit
      }
      return jsonp_(cb, { success: true, updated });
    } catch(err) {
      return jsonp_(cb, { success: false, error: err.message });
    }
  }

  // ── SAVE MODE (new sale) ──
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
      parseFloat(p.subtotal) || 0,   // H
      parseFloat(p.courier)  || 0,   // I
      parseFloat(p.discount) || 0,   // J
      parseFloat(p.advance)  || 0,   // K
      parseFloat(p.total)    || 0,   // L
      parseFloat(p.due)      || 0,   // M
      p.datetime   || '',             // N
      p.note       || '',             // O
      p.timestamp  || '',             // P
      '',                             // Q — tracking (filled by steadfast_order)
      '',                             // R — status
      '',                             // S — consignment ID
    ]);
    return jsonp_(cb, { success: true, invoice: invNo });
  } catch(err) {
    return jsonp_(cb, { success: false, error: err.message });
  }
}

function doPost(e) { return doGet(e); }

// ── One-time phone fix ──
function fixExistingPhoneNumbers() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const rows  = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    const cur   = String(rows[i][2] || '').replace(/^'/, '');
    const fixed = normalizePhone_(cur);
    if (fixed && fixed !== cur) sheet.getRange(i + 1, 3).setValue("'" + fixed);
  }
}

// ── Manual: refresh all Steadfast statuses ──
// Run this from Apps Script editor to update all delivery statuses at once
function refreshAllStatuses() {
  const result = update_statuses_internal_();
  Logger.log('Updated ' + result + ' rows');
}

function update_statuses_internal_() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const rows  = sheet.getDataRange().getValues();
  let updated = 0;
  for (let i = 1; i < rows.length; i++) {
    const sfId  = rows[i][18];
    if (!sfId) continue;
    const status = rows[i][17];
    if (['delivered','cancelled','partial_delivered'].includes(status)) continue;
    try {
      const resp = UrlFetchApp.fetch(
        STEADFAST_BASE_URL + '/status_by_cid/' + sfId,
        { method: 'GET', headers: steadfastHeaders_(), muteHttpExceptions: true }
      );
      const res       = JSON.parse(resp.getContentText());
      const newStatus = (res.delivery_status || res.status || '').toLowerCase();
      if (newStatus && newStatus !== status) {
        sheet.getRange(i + 1, 18).setValue(newStatus);
        updated++;
      }
    } catch(e) {}
    Utilities.sleep(200);
  }
  return updated;
}
