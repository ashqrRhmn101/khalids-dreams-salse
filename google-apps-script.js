// =====================================================
//  Khalid's Dreams — Google Apps Script v8
//  Actions: fetch | save | payment
// =====================================================

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
          invoiceNo: r[0]  || '',
          name:      r[1]  || '',
          phone:     normalizePhone_(r[2]),
          district:  r[3]  || '',
          thana:     r[4]  || '',
          address:   r[5]  || '',
          items:     r[6]  || '',
          subtotal:  parseFloat(r[7])  || 0,
          courier:   parseFloat(r[8])  || 0,
          discount:  parseFloat(r[9])  || 0,
          advance:   parseFloat(r[10]) || 0,
          total:     parseFloat(r[11]) || 0,
          due:       parseFloat(r[12]) || 0,
          datetime:  r[13] || '',
          note:      r[14] || '',
          timestamp: r[15] || '',
          _rowIndex: i + 1, // 1-based for sheet
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
      const phone    = normalizePhone_(p.phone);
      let   remaining = parseFloat(p.amount) || 0;
      const sheet    = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
      const rows     = sheet.getDataRange().getValues();

      // Collect rows with due > 0 for this phone, oldest first (FIFO)
      const dueRows = [];
      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        if (!r[0]) continue;
        if (normalizePhone_(r[2]) !== phone) continue;
        const due = parseFloat(r[12]) || 0;
        if (due > 0) dueRows.push({ rowIdx: i + 1, due });
      }
      dueRows.sort((a, b) => a.rowIdx - b.rowIdx); // FIFO

      const updated = [];
      for (const row of dueRows) {
        if (remaining <= 0) break;
        const deduct  = Math.min(remaining, row.due);
        const newDue  = parseFloat((row.due - deduct).toFixed(2));
        sheet.getRange(row.rowIdx, 13).setValue(newDue); // col M = due
        updated.push({ row: row.rowIdx, oldDue: row.due, newDue });
        remaining = parseFloat((remaining - deduct).toFixed(2));
      }

      return jsonp_(cb, {
        success: true,
        updated,
        amountApplied: parseFloat(p.amount) - remaining,
        remaining,
      });
    } catch(err) {
      return jsonp_(cb, { success: false, error: err.message });
    }
  }

  // ── SAVE MODE (new sale) ──
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const invNo = p.invoiceNo || ('KD-' + Date.now().toString().slice(-6));
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
      parseFloat(p.total)    || 0,  // L - Grand Total
      parseFloat(p.due)      || 0,  // M - Due
      p.datetime   || '',            // N
      p.note       || '',            // O
      p.timestamp  || '',            // P
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
