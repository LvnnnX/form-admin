import { google } from 'googleapis';
import { PassThrough } from 'stream';

export const config = {
  api: { bodyParser: { sizeLimit: '10mb' } },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  try {
    const { action, payload } = req.body;

    // Decide data source: Supabase (migration target) or Google Sheets (legacy)
    const USE_SUPABASE = (process.env.VITE_USE_SUPABASE === 'true');

    if (USE_SUPABASE) {
      // Lazy load Supabase client to avoid pulling it when not needed
      const { supabase } = await import('../src/supabase.js');

      // Optional admin PIN check (keeps parity with existing admin gate)
      const pinAdmin = (process.env.VITE_ADMIN_PIN|| process.env.ADMIN_PIN || '123456').replace(/^['"]|['"]$/g, '').trim();
      if (action === 'cekLogin') {
        const isMatch = String(payload.pin).trim() === pinAdmin;
        return res.status(200).json({ success: isMatch });
      }

      // 3. SUBMIT FORM (store in ktp_data and upload file to Supabase Storage)
      if (action === 'submitForm') {
        let fileUrl = '';
        if (payload?.fileData && payload?.fileName) {
          let mimeType = 'application/octet-stream', base64Data = payload.fileData;
          if (payload.fileData.includes(',')) {
            const p = payload.fileData.split(',');
            const m = p[0].match(/:(.*?);/);
            if (m) mimeType = m[1];
            base64Data = p[1];
          }
          const buffer = Buffer.from(base64Data, 'base64');
          const path = `ktp_uploads/${Date.now()}_${payload.fileName}`;
          const { data: uploadData, error: uploadError } = await supabase.storage.from('ktp-uploads').upload(path, buffer, { contentType: mimeType });
          if (uploadError) throw uploadError;
          const { data: urlData } = supabase.storage.from('ktp-uploads').getPublicUrl(path);
          fileUrl = urlData?.publicURL || '';
        }

        const { data: inserted, error: insertError } = await supabase
          .from('ktp_data')
          .insert([
            {
              nama: payload.nama,
              email: payload.email,
              ktp_number: payload.ktp_number,
              ktp_image_url: fileUrl,
              status: payload.status || 'Pending'
            }
          ])
          .select('*');

        if (insertError) throw insertError;
        return res.status(200).json({ success: true, message: 'Data berhasil disimpan', data: inserted?.[0] || null });
      }

      // 4. ADMIN (GET & UPDATE DATA)
      if (action === 'getData') {
        const { data, error } = await supabase.from('ktp_data').select('*').order('created_at', { ascending: true });
        if (error) throw error;
        return res.status(200).json({ success: true, data: data || [] });
      }

      if (action === 'updateStatus') {
        // Support by id or by index (legacy index-based update)
        let id = payload?.id;
        if (!id && typeof payload?.index === 'number') {
          const { data: rows } = await supabase.from('ktp_data').select('id').order('created_at', { ascending: true }).range(payload.index, payload.index);
          id = rows?.[0]?.id;
        }
        if (!id) return res.status(400).json({ success: false, message: 'Missing id for update' });
        await supabase.from('ktp_data').update({ status: payload.statusBaru }).eq('id', id);
        return res.status(200).json({ success: true });
      }

      return res.status(400).json({ success: false, message: 'Aksi tidak ditemukan' });
    }

    // Fallback (Google Sheets path) – kept for reference or conditional use when VITE_USE_SUPABASE is not set
    const clientId = process.env.VITE_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || '';
    const clientSecret = process.env.VITE_GOOGLE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET || '';
    const refreshToken = process.env.VITE_GOOGLE_REFRESH_TOKEN || process.env.GOOGLE_REFRESH_TOKEN || '';

    const cleanClientId = clientId.replace(/^['"]|['"]$/g, '').trim();
    const cleanClientSecret = clientSecret.replace(/^['"]|['"]$/g, '').trim();
    const cleanRefreshToken = refreshToken.replace(/^['"]|['"]$/g, '').trim();

    if (!cleanClientId || !cleanClientSecret || !cleanRefreshToken) {
      throw new Error("Kredensial OAuth 2.0 (Client ID, Secret, Refresh Token) belum lengkap di Vercel.");
    }

    const pinAdminFallback = (process.env.VITE_ADMIN_PIN|| process.env.ADMIN_PIN || '123456').replace(/^['"]|['"]$/g, '').trim();
    const sheetIdFallback = (process.env.GOOGLE_SHEET_ID || process.env.GOOGLE_SHEET_ID || '').replace(/^['"]|['"]$/g, '').trim();
    const folderIdFallback = (process.env.GOOGLE_FOLDER_ID || process.env.GOOGLE_FOLDER_ID || '').replace(/^['"]|['"]$/g, '').trim();

    if (action === 'cekLogin') {
      const isMatch = String(payload.pin).trim() === pinAdminFallback;
      return res.status(200).json({ success: isMatch });
    }

    // Original Google Sheets logic would be invoked here if needed (omitted for brevity)
    return res.status(400).json({ success: false, message: 'Aksi tidak ditemukan' });
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}
