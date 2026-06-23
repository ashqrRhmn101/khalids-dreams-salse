# Google Sheets Setup — Khalid's Dreams (Final)

## Sheet Headers (Row 1)
| A | B | C | D | E | F | G | H | I | J | K |
|---|---|---|---|---|---|---|---|---|---|---|
| Invoice No | Customer Name | Phone | District | Thana | Address | Products | Total Amount | Date & Time | Note | Timestamp |

## Apps Script Update করুন
1. Google Sheet → Extensions → Apps Script
2. পুরো কোড মুছে `google-apps-script.js` এর কোড paste করুন
3. Save করুন (Ctrl+S)

## Re-Deploy
1. Deploy → Manage Deployments
2. ✏️ Edit → New Version → Deploy
3. URL একই থাকবে ✅

## নতুন কী হলো?
- `?action=fetch` — বিক্রয় ইতিহাস ও গ্রাহক তালিকা লোড করে
- `?invoiceNo=...` — নতুন sale সেভ করে (আগের মতই)
