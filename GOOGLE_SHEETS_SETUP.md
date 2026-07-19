# Google Sheets Setup — Khalid's Dreams v9

## Sheet Headers (Row 1) — সম্পূর্ণ নতুন
| Col | Header |
|-----|--------|
| A | Invoice No |
| B | Customer Name |
| C | Phone |
| D | District |
| E | Thana |
| F | Address |
| G | Products |
| H | Subtotal |
| I | Courier Charge |
| J | Discount |
| K | Advance |
| L | Grand Total |
| M | Due |
| N | Date & Time |
| O | Note |
| P | Timestamp |
| Q | Tracking Code (Steadfast) |
| R | Delivery Status |
| S | Consignment ID |

## Apps Script Update করুন
1. Google Sheet → Extensions → Apps Script
2. পুরো কোড মুছে `google-apps-script.js` কোড paste করুন
3. Save (Ctrl+S)

## API Key বদলাতে হলে (মাসে একবার)
Apps Script-এর একদম উপরে এই দুটি line খুঁজুন:
```
const STEADFAST_API_KEY    = 'আপনার_API_KEY';
const STEADFAST_SECRET_KEY = 'আপনার_SECRET_KEY';
```
শুধু এই দুটো value বদলান, বাকি কিছু ছুঁবেন না।

## Re-Deploy
1. Deploy → Manage Deployments
2. ✏️ Edit → New Version → Deploy
3. URL একই থাকবে ✅

## Steadfast Status Manual Refresh (যেকোনো সময়)
Apps Script editor-এ:
1. Function dropdown → `refreshAllStatuses`
2. ▶️ Run করুন
