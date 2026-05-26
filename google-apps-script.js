// =====================================================
//  Khalid's Dreams — Google Apps Script v4
//  Supports: POST (save) + GET (fetch for history)
// =====================================================

function doGet(e) {
  const p = e.parameter;

  // ── FETCH MODE (Sales History & Customer page) ──
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
          phone:     r[2]  || '',
          district:  r[3]  || '',
          thana:     r[4]  || '',
          address:   r[5]  || '',
          items:     r[6]  || '',
          total:     parseFloat(r[7]) || 0,
          datetime:  r[8]  || '',
          note:      r[9]  || '',
          timestamp: r[10] || '',
        });
      }

      const cb     = p.callback || 'callback';
      const result = JSON.stringify({ success: true, data });
      return ContentService
        .createTextOutput(cb + '(' + result + ')')
        .setMimeType(ContentService.MimeType.JAVASCRIPT);

    } catch(err) {
      const cb = p.callback || 'callback';
      return ContentService
        .createTextOutput(cb + '(' + JSON.stringify({ success:false, error:err.message }) + ')')
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
  }

  // ── SAVE MODE (new sale from website) ──
  try {
    const sheet  = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const invNo  = p.invoiceNo || ('KD-' + Date.now().toString().slice(-6));

    sheet.appendRow([
      invNo,
      p.name      || '',
      p.phone     || '',
      p.district  || '',
      p.thana     || '',
      p.address   || '',
      p.items     || '',
      parseFloat(p.total) || 0,
      p.datetime  || '',
      p.note      || '',
      p.timestamp || '',
    ]);

    const cb     = p.callback || 'callback';
    const result = JSON.stringify({ success: true, invoice: invNo });
    return ContentService
      .createTextOutput(cb + '(' + result + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);

  } catch(err) {
    const cb = (p && p.callback) || 'callback';
    return ContentService
      .createTextOutput(cb + '(' + JSON.stringify({ success:false, error:err.message }) + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
}

function doPost(e) { return doGet(e); }
