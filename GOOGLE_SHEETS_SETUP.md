# Google Sheets Setup — Khalid's Dreams v6

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

## নতুন কী হলো? (v6)
- ✅ **Phone Auto-fill**: ফোন নম্বর দিলে repeat customer-এর নাম/ঠিকানা auto-fill হবে
- ✅ **Phone Normalize**: এখন থেকে সব ফোন নম্বরের আগে স্বয়ংক্রিয়ভাবে `0` যুক্ত হবে
  (যেমন 1710979757 → 01710979757)
- ✅ **PDF সাদা ব্যাকগ্রাউন্ড + কালো টেক্সট + লোগো**
- ✅ **PDF ফাইল সাইজ ছোট** কিন্তু টেক্সট sharp (JPEG compression)

## পুরনো ডেটা ঠিক করতে (একবার মাত্র করুন)
আপনার পুরনো Sheet-এর phone column-এ `0` ছাড়া নম্বর থাকলে:
1. Apps Script এডিটরে যান
2. Function dropdown থেকে **fixExistingPhoneNumbers** সিলেক্ট করুন
3. ▶️ Run বাটনে ক্লিক করুন
4. এটা পুরনো সব ফোন নম্বরের আগে `0` যুক্ত করে দেবে
