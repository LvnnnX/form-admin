# 🚀 Deploy Guide - Modern KTP App

## Option 1: Vercel (Recommended - Easiest & Free)

### Steps:

1. **Install Vercel CLI**
   ```bash
   npm install -g vercel
   ```

2. **Create .env file** (copy from .env.example)
   ```bash
   cp .env.example .env
   ```

3. **Edit .env with your values**
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   VITE_ADMIN_PIN=123456
   ```

4. **Deploy**
   ```bash
   vercel
   ```
   
   Follow the prompts:
   - Set up and deploy? `Y`
   - Which scope? `Your account`
   - Link to existing project? `N`
   - Project name? `ktp-app`
   - Directory? `./`
   - Override settings? `N`

5. **For production**
   ```bash
   vercel --prod
   ```

### Connect to GitHub (Optional but recommended)

1. Push to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Import project from GitHub
4. Set environment variables in Vercel dashboard
5. Deploy automatically on push!

---

## Option 2: Netlify (Also Free)

### Steps:

1. **Install Netlify CLI**
   ```bash
   npm install -g netlify-cli
   ```

2. **Build first**
   ```bash
   npm run build
   ```

3. **Deploy**
   ```bash
   netlify deploy --prod --dir=dist
   ```

---

## Option 3: Cloudflare Pages (Fastest CDN)

1. Go to [pages.cloudflare.com](https://pages.cloudflare.com)
2. Connect GitHub repo
3. Build command: `npm run build`
4. Output directory: `dist`
5. Add environment variables

---

## Database Setup: Supabase (Free)

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Create account → New project
3. Wait for setup (takes ~2 minutes)

### 2. Get API Keys

1. Go to Settings → API
2. Copy:
   - `Project URL` → `VITE_SUPABASE_URL`
   - `anon public` key → `VITE_SUPABASE_ANON_KEY`

### 3. Create Database Table

Go to SQL Editor in Supabase dashboard and run:

```sql
-- Create table
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

-- Enable Row Level Security
ALTER TABLE ktp_data ENABLE ROW LEVEL SECURITY;

-- Allow public access (for form submissions)
CREATE POLICY "Allow all inserts" ON ktp_data FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all selects" ON ktp_data FOR SELECT USING (true);
CREATE POLICY "Allow all updates" ON ktp_data FOR UPDATE USING (true);
CREATE POLICY "Allow all deletes" ON ktp_data FOR DELETE USING (true);
```

### 4. Enable Storage (for KTP images)

1. Go to Storage in Supabase
2. Create new bucket: `ktp-images`
3. Set as Public bucket
4. Add policy:
```sql
-- Allow everyone to upload
CREATE POLICY "Public uploads" ON storage.objects
FOR ALL USING (bucket_id = 'ktp-images');
```

---

## Alternative: Keep Using Google Sheets

If you prefer Google Sheets:

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create new project
3. Enable **Google Sheets API**
4. Create Service Account
5. Download JSON key
6. Share your spreadsheet with the service account email
7. Set in .env:
   ```
   VITE_USE_GOOGLE_SHEETS=true
   VITE_GOOGLE_SHEET_ID=your-sheet-id
   ```

---

## Troubleshooting

### "Module not found" errors
```bash
npm install
npm run build
```

### Environment variables not working
- Vercel: Add in Project Settings → Environment Variables
- Netlify: Add in Site Settings → Environment Variables

### Build errors
```bash
npm run build
```
Check for any TypeScript/JS errors

---

## Custom Domain (Optional)

### Vercel
1. Project Settings → Domains
2. Add your domain
3. Update DNS records as shown

### Netlify
1. Site Settings → Domain management
2. Add custom domain
3. Add DNS records

---

## Performance Comparison

| Platform | Cold Start | CDN | Free Tier |
|----------|-----------|-----|-----------|
| Vercel | <100ms | Global | 100GB bandwidth |
| Netlify | <100ms | Global | 100GB bandwidth |
| Cloudflare | <50ms | Fastest | Unlimited |
| GAS | 2-5s | None | 100 users |

**Recommendation**: Use Vercel + Supabase for best performance and developer experience.
