# Google Sheets API Setup Guide

## Prerequisites
- Google Account
- Your existing Google Spreadsheet ID: `1H1uw245vdylR6Zuesz9WZeZJJWe0ego9p19x8KHAfws`

---

## Step 1: Create Google Cloud Project

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Click **"Select a project"** at the top
3. Click **"New Project"**
4. Name it: `KTP-API`
5. Click **"Create"**

---

## Step 2: Enable Google Sheets API

1. In your new project, go to **"APIs & Services"** → **"Library"**
2. Search for **"Google Sheets API"**
3. Click on it → Click **"Enable"**

---

## Step 3: Create Service Account

1. Go to **"APIs & Services"** → **"Credentials"**
2. Click **"Create Credentials"** → **"Service Account"**
3. Name it: `ktp-api-access`
4. Click **"Create and Continue"**
5. Skip roles (click **"Continue"**)
6. Click **"Done"**

---

## Step 4: Generate Service Account Key

1. Click on your new service account (under "Service Accounts")
2. Go to **"Keys"** tab
3. Click **"Add Key"** → **"Create new key"**
4. Select **"JSON"** → Click **"Create"**
5. JSON file will download (SAVE THIS!)

---

## Step 5: Get Service Account Email

1. In the service account details, copy the **"Email"** address
2. It looks like: `ktp-api-access@ktp-api-492107.iam.gserviceaccount.com`

---

## Step 6: Share Your Spreadsheet

1. Open your Google Spreadsheet: [1H1uw245vdylR6Zuesz9WZeZJJWe0ego9p19x8KHAfws](https://docs.google.com/spreadsheets/d/1H1uw245vdylR6Zuesz9WZeZJJWe0ego9p19x8KHAfws)
2. Click **"Share"**
3. Paste the service account email
4. Select **"Editor"**
5. Check **"Notify people"** → Uncheck it
6. Click **"Share"**

---

## Step 7: Set Up the Spreadsheet Headers

Make sure your spreadsheet has these headers in Row 1:

| A | B | C | D | E | F | G | H | I | J | K |
|---|---|---|---|---|---|---|---|---|---|---|
| Timestamp | ID | Nama | Email | No. KTP | KTP Image URL | KTP File ID | Status | Processed By | Processed At | Notes |

---

## Step 8: Convert JSON to Single Line

You'll need to put the JSON key in an environment variable. First, format it to single line:

1. Open the downloaded JSON file
2. Use this tool to minify it: [https://jsonformatter.org/json-minify](https://jsonformatter.org/json-minify)
3. Or paste this JavaScript in browser console:
```javascript
const json = {
  "type": "service_account",
  "project_id": "ktp-api-492107",
  "private_key_id": "9c2b2918229868b1ed0716e2f63dd3cb47f5c07c",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDVm0m117TYPnS9\nqFbGDL/+qb7jbkiQoA6JzE0TPoGNMArkqOk3zWiLK4WJwiRSJIet2u8a0wjusdIy\n/psoZKq0gtFdIE/k1NAkUGreCH0FHuwUydabl4gm3/bCPRTtt51Sb3LBUU94uYAo\n0YqGxYD4U8BV8YtOf9HF4OpxMbt9vars+Sopb41rgglUpuTryamnC5sjHvBbo9X1\n/oE1uFibdMClNROAYSQzrs95GZuPJ3gbyegh4mt2CARKVUzJE9v88GbVlp6QUnO+\nlk0I1ogWM9N1E6kcBPVvEkBXWfsmgvpaYrmGjtSVYPE3+cOLYHuvfFtuCtQuWHtF\nJMuFtfqPAgMBAAECggEAAb63ltyZVryEj6tleDRWP1ErYYLZk2sut/zpIEeb/rBG\nyONLADCSxZ26BPjz1NYrbrAYF6hIdEqRKuHG/XnuwRzBaIrGli6NQ/pBDcCcuRo4\nZWus3LIbomXWHU4avEgHcULk4PLyLxCGwKs1Yfcmsvkl4Z+O01Uxucn059S3OA0z\nfAuv5sxlzOiA/ICfz5owUmqREXFcnnYNEAEFPGLvf5jgLgzHZ49jnRDo7nR186U+\nR95g8v0bnLF91aM//w523pHKDhXwurU4cBoxdL8HBlLZgutxfXeAFPoHsDV0eT0Q\nLsoiieEpG9Bxtu2Qe24bX0Vt69ScrkPRGqwM44kXaQKBgQD19THQ1NoOEUbgwn/a\n7rwS6JKx3nZlvCY92iMX/TQoei398/C82VDBsP7MpqgYzd6xlSw1SrZ2AQs3gEMQ\nlFBa4ScJFxW04DTE16nDfakb4aMpSv0ACKFcx7tB+62RgdEvAlvpLtE+MjBYTh0v\nu7ZKn5aDbI1Qlm5yulJPEjQ7YwKBgQDeU/ORj+VUKVK9l38qhGyOOWczgtZ0yylC\nJ9zvLRnWLyhTZccWOTIMPnTxoyGldRzCQA/KtIibpbh+8ym30n1XaS2X9OTquI23\nlrANZyz2Zjti8nXP5pa7NZh1Y0Fs9s3Iune8uy3uRPwAPhFlcTc2O45uYXAAzG0/\n8sOOxL4p5QKBgQDYsTQ5Yz3VhP0oCdPxA8Ho+sQ7Nt6i1PfwKF4gxXCNdM9OXPus\ntd1DOHfTv8R7Te00EVPIg9Fq95J1TGhJlBGTb6gfhxoVqC51effUBsLVkJ5aQ/nQ\nbMoVXtao1F5fwrqUKwTk1N1+aWNUeUWXh06cQiuuEBYUeORH6cWYalZgNwKBgQDX\n286qT3mrQwvQhBy1nSkA1X77platwurmDmoV1kY1jEes4S5wx0tuU92bFnX+fTxU\n5Xnvp2TTKg19RH4Gudl0Wuwnk2AG/PSrgSShfsFK4mtaYGo+VnWWgizqHFpTfzTB\nZToIBfxMULITUi/1u/yNLTnWtcfXHqQb6IoyPZcceQKBgDXlopv/nGts8XfPD3Wl\n9IRWAlLPmR5kVudE55AZNKsk1nw2UAkKQjv5ivA2aNlxMsuqw5/IB0pFXbVcYGxd\npMlYXqxNrqxZ8NRZQvrIBcNJT8GFL6Q5kNFrkR8RsE6L5zy91up6OE5R7kly0B8b\nZDk7Tf7w366JRY6Ih3uBJFRu\n-----END PRIVATE KEY-----\n",
  "client_email": "ktp-api-access@ktp-api-492107.iam.gserviceaccount.com",
  "client_id": "100811564302025999721",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/ktp-api-access%40ktp-api-492107.iam.gserviceaccount.com",
  "universe_domain": "googleapis.com"
}
; // paste the whole JSON object
console.log(JSON.stringify(json));
```

Copy the output - that's your `VITE_GOOGLE_CREDENTIALS`

---

## Step 9: Deploy to Vercel

### Option A: via GitHub (Recommended)

1. **Push to GitHub:**
   ```bash
   cd modern-ktp-app
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/ktp-app.git
   git push -u origin main
   ```

   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

2. **Connect to Vercel:**
   - Go to [vercel.com](https://vercel.com)
   - Click "Add New" → "Project"
   - Import your GitHub repo
   - Click "Environment Variables"
   - Add these:

   | Name | Value |
   |------|-------|
   | `VITE_USE_GOOGLE_SHEETS` | `true` |
   | `VITE_GOOGLE_SHEET_ID` | `1H1uw245vdylR6Zuesz9WZeZJJWe0ego9p19x8KHAfws` |
   | `VITE_GOOGLE_CREDENTIALS` | (the minified JSON) |
   | `VITE_ADMIN_PIN` | `123456` |

   - Click "Deploy"

### Option B: via Vercel CLI

1. Install Vercel CLI:
   ```bash
   npm install -g vercel
   ```

2. Deploy:
   ```bash
   cd modern-ktp-app
   vercel
   ```

3. Add environment variables when prompted, or set them later in Vercel dashboard.

---

## Step 10: Test Your App

1. After deployment, Vercel gives you a URL like: `https://ktp-app.vercel.app`
2. Form page: `https://ktp-app.vercel.app`
3. Admin page: `https://ktp-app.vercel.app/#admin`
4. Login with PIN: `123456`

---

## Troubleshooting

### "Permission denied" error
- Make sure you shared the spreadsheet with the service account email
- Check that the service account has "Editor" access

### "Sheet not found" error
- Make sure the sheet name in your spreadsheet is exactly `Sheet1` or update the code

### CORS errors
- The Google Sheets API should work. If not, check if the API is enabled.

### Slow responses
- First request to Google Sheets API takes ~1-2 seconds
- Subsequent requests are faster (cached)

---

## API Limits

| Plan | Requests/day | Requests/100s |
|------|-------------|----------------|
| Free | 100,000 | 1,000 |
| Paid | 1,000,000+ | 10,000+ |

For most use cases, the free tier is more than enough.

---

## Cost

| Service | Cost |
|---------|------|
| Vercel (Hobby) | FREE (100GB bandwidth) |
| Google Sheets | FREE (15GB shared storage) |
| **Total** | **$0/month** |
