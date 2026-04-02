import { google } from 'googleapis';
import { PassThrough } from 'stream';

export const config = {
  api: { bodyParser: { sizeLimit: '10mb' } },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  
  try {
    const { action, payload } = req.body;
    
    // ====================================================================
    // 1. AMBIL KREDENSIAL OAUTH 2.0 DARI ENVIRONMENT VARIABLES
    // ====================================================================
    const clientId = process.env.VITE_GOOGLE_CLIENT_ID;
    const clientSecret = process.env.VITE_GOOGLE_CLIENT_SECRET;
    const refreshToken = process.env.VITE_GOOGLE_REFRESH_TOKEN;

    if (!clientId || !clientSecret || !refreshToken) {
      throw new Error("Kredensial OAuth 2.0 belum lengkap di Environment Variables.");
    }

    const pinAdmin = (process.env.ADMIN_PIN || '123456').replace(/^['"]|['"]$/g, '').trim();
    const sheetId = (process.env.GOOGLE_SHEET_ID || '').replace(/^['"]|['"]$/g, '').trim();
    const folderId = (process.env.GOOGLE_FOLDER_ID || '').replace(/^['"]|['"]$/g, '').trim();

    // ====================================================================
    // 2. OTENTIKASI OAUTH 2.0
    // ====================================================================
    if (action === 'cekLogin') {
      const isMatch = String(payload.pin).trim() === pinAdmin;
      return res.status(200).json({ success: isMatch, message: isMatch ? "OK" : "PIN Salah" });
    }

    // Inisialisasi OAuth2 Client
    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      "https://developers.google.com/oauthplayground"
    );

    // Set Refresh Token agar bisa akses kapan saja tanpa login ulang
    oauth2Client.setCredentials({
      refresh_token: refreshToken
    });

    const sheets = google.sheets({ version: 'v4', auth: oauth2Client });
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    const RANGE = 'Sheet1!A:E'; // Pastikan nama Tab Anda "Sheet1"

    // ====================================================================
    // 3. AKSI: SUBMIT FORM (Sekarang menggunakan kuota Drive pribadi Anda)
    // ====================================================================
    if (action === 'submitForm') {
      let fileUrl = '';
      if (payload.fileData) {
        let mimeType = 'application/octet-stream', base64Data = payload.fileData;
        if (payload.fileData.includes(',')) { 
          const p = payload.fileData.split(','); 
          const m = p[0].match(/:(.*?);/); 
          if (m) mimeType = m[1]; 
          base64Data = p[1]; 
        }
        const buf = Buffer.from(base64Data, 'base64');
        const stream = new PassThrough(); 
        stream.end(buf);
        
        const dr = await drive.files.create({ 
          requestBody: { name: payload.fileName, parents: [folderId] }, 
          media: { mimeType, body: stream }, 
          fields: 'webViewLink' 
        });
        fileUrl = dr.data.webViewLink;
      }
      
      const values = [[new Date().toISOString(), payload.nama, payload.email, fileUrl, 'PENDING']];
      await sheets.spreadsheets.values.append({ 
        spreadsheetId: sheetId, 
        range: RANGE, 
        valueInputOption: 'USER_ENTERED', 
        requestBody: { values } 
      });
      return res.status(200).json({ success: true, message: 'Data berhasil disimpan' });
    }
    
    // ====================================================================
    // 4. AKSI: GET DATA & UPDATE STATUS (UNTUK ADMIN)
    // ====================================================================
    if (action === 'getData') { 
      const r = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: RANGE }); 
      return res.status(200).json({ success: true, data: (r.data.values || []).slice(1) }); 
    }
    
    if (action === 'updateStatus') { 
      await sheets.spreadsheets.values.update({ 
        spreadsheetId: sheetId, 
        range: `Sheet1!E${payload.index + 2}`, 
        valueInputOption: 'USER_ENTERED', 
        requestBody: { values: [[payload.statusBaru]] } 
      }); 
      return res.status(200).json({ success: true }); 
    }
    
    return res.status(400).json({ success: false, message: 'Aksi tidak ditemukan' });
  } catch (error) { 
    console.error('API Error:', error); 
    return res.status(500).json({ success: false, message: error.message }); 
  }
}