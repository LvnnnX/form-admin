# Modern KTP Registration App

## Quick Start

### Option A: Deploy to Vercel (Recommended - Free)

1. **Create the project:**
   ```bash
   npm create vite@latest ktp-app -- --template react
   cd ktp-app
   ```

2. **Copy the source files** from this project

3. **Deploy:**
   ```bash
   npm install -g vercel
   vercel
   ```

### Option B: Deploy to Netlify (Also Free)

```bash
npm install -g netlify-cli
netlify deploy --prod
```

---

## Database Options

### Option 1: Supabase (Recommended - Fastest)

1. Go to [supabase.com](https://supabase.com)
2. Create free account → New Project
3. Get your `Project URL` and `anon/public key`
4. Run this SQL in Supabase SQL Editor:

```sql
CREATE TABLE ktp_data (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  nama TEXT NOT NULL,
  email TEXT NOT NULL,
  ktp_number TEXT NOT NULL,
  ktp_image_url TEXT,
  status TEXT DEFAULT 'Pending',
  processed_by TEXT,
  processed_at TIMESTAMPTZ,
  notes TEXT
);

-- Enable RLS
ALTER TABLE ktp_data ENABLE ROW LEVEL SECURITY;

-- Allow public read/write
CREATE POLICY "Allow all" ON ktp_data FOR ALL USING (true);
```

5. Add to your `.env`:
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

### Option 2: Google Sheets (Your Current DB)

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create project → Enable Google Sheets API
3. Create Service Account → Download JSON key
4. Share your spreadsheet with the service account email
5. Add to `.env`:
   ```
   VITE_USE_GOOGLE_SHEETS=true
   VITE_GOOGLE_SHEET_ID=your-sheet-id
   VITE_GOOGLE_SERVICE_ACCOUNT={"type":"service_account",...}
   ```

---

## Environment Variables

Create `.env` file:

```env
# Supabase (if using)
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...

# Google Sheets (if using instead)
VITE_USE_GOOGLE_SHEETS=false
VITE_GOOGLE_SHEET_ID=1H1uw245vdylR6Zuesz9WZeZJJWe0ego9p19x8KHAfws
VITE_GOOGLE_SERVICE_ACCOUNT={"type":"service_account",...}

# Admin PIN
VITE_ADMIN_PIN=123456
```

---

## Development

```bash
npm install
npm run dev
```

---

## Tech Stack

- **Frontend**: React 18 + Vite
- **Styling**: Tailwind CSS
- **Database**: Supabase (PostgreSQL) OR Google Sheets
- **Hosting**: Vercel / Netlify (Free)
- **File Storage**: Supabase Storage OR Google Drive

---

## Features

- Modern UI with animations
- Fast loading (< 1 second)
- Real-time updates (with Supabase)
- Mobile responsive
- File upload with preview
- Admin dashboard with stats
- Search & filter
- Status management
