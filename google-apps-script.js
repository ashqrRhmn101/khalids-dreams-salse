// =============================================
// Khalid's Dreams — Google Apps Script v3
// JSONP + Invoice No sync fix
// Deploy as Web App: Anyone can access
// =============================================

function doGet(e) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const p     = e.parameter;

    // ★ Use the invoiceNo from the website (same as PDF)
    const invNo = p.invoiceNo || ('KD-' + Date.now().toString().slice(-6));

    sheet.appendRow([
      invNo,                // A: Invoice No  ← same as PDF now
      p.name     || '',     // B: Customer Name
      p.phone    || '',     // C: Phone
      p.district || '',     // D: District
      p.thana    || '',     // E: Thana
      p.address  || '',     // F: Address
      p.items    || '',     // G: Products
      Number(p.total)||0,   // H: Total Amount
      p.datetime || '',     // I: Date & Time
      p.note     || '',     // J: Note
      new Date()            // K: Server Timestamp
    ]);

    const callback = p.callback || 'callback';
    const result   = JSON.stringify({ success: true, invoice: invNo });
    return ContentService
      .createTextOutput(callback + '(' + result + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);

  } catch (err) {
    const callback = (e.parameter && e.parameter.callback) || 'callback';
    const result   = JSON.stringify({ success: false, error: err.message });
    return ContentService
      .createTextOutput(callback + '(' + result + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
}

function doPost(e) { return doGet(e); }
