# Google Sheets Setup Guide — Khalid's Dreams

## Step-by-Step Instructions

### Step 1: Create Google Sheet
1. Go to https://sheets.google.com
2. Create a new spreadsheet
3. Name it: **Khalid's Dreams — Sales Data**
4. Add these headers in Row 1:
   `Timestamp | Invoice No | Customer Name | Phone | District | Thana | Address | Items | Total Amount | Note`

### Step 2: Open Apps Script
1. In your Google Sheet, click: **Extensions → Apps Script**
2. Delete the default code
3. Paste the code from `google-apps-script.js` file

### Step 3: Deploy Apps Script
1. Click **Deploy → New Deployment**
2. Select type: **Web App**
3. Execute as: **Me**
4. Who has access: **Anyone**
5. Click **Deploy**
6. Copy the **Web App URL** (looks like: https://script.google.com/macros/s/xxxxx/exec)

### Step 4: Connect to Website
1. Open `js/app.js`
2. Find line: `const SHEET_URL = 'YOUR_GOOGLE_APPS_SCRIPT_URL';`
3. Replace with your copied URL

### Done! ✅
Every sale will now automatically save to your Google Sheet.
