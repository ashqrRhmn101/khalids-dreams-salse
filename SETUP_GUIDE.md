# Khalid's Dreams — Complete Setup Guide

## ✅ Google Sheets Setup (Invoice No sync fix included)

### Step 1: Google Sheet এ Headers বসাও
Row 1 তে এই column headers বসাও:
| A | B | C | D | E | F | G | H | I | J | K |> update > P
|---|---|---|---|---|---|---|---|---|---|---|
| Invoice No | Customer Name | Phone | District | Thana | Address | Products | Total Amount | Date & Time | Note | Server Time |

### Step 2: Apps Script খোলো
Extensions → Apps Script → সব কোড মুছে `google-apps-script.js` এর কোড paste করো

### Step 3: Deploy করো
1. Deploy → New Deployment
2. Type: Web App
3. Execute as: Me
4. Who has access: Anyone
5. Deploy → URL copy করো

### Step 4: URL বসাও
`js/app.js` ফাইলের ২য় লাইনে:
```
const SHEET_URL = 'তোমার_URL_এখানে';
```

### ✅ Already configured URL:


### ⚠️ Important: Re-deploy করতে হবে!
নতুন code (v7) paste করার পর:
Deploy → Manage Deployments → Edit (pencil) → Version: New Version → Deploy
