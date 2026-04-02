import { google } from 'googleapis';
import { PassThrough } from 'stream';

export const config = {
  api: {
    bodyParser: { sizeLimit: '10mb' },
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  try {
    const { action, payload } = req.body;

    // ====================================================================
    // 1. PEMBERSIH ENVIRONMENT VARIABLES (JURUS ANTI-ERROR VERCEL)
    // ====================================================================
    let clientEmail = process.env.VITE_GOOGLE_CLIENT_EMAIL || '';
    let privateKey = process.env.VITE_GOOGLE_PRIVATE_KEY || '';
    let pinAdmin = process.env.VITE_ADMIN_PIN || '';
    let sheetId = process.env.VITE_GOOGLE_SHEET_ID || '';
    let folderId = process.env.VITE_GOOGLE_FOLDER_ID || '';

    // Menghapus tanda kutip tunggal/ganda di awal & akhir yang sering nyangkut
    clientEmail = clientEmail.replace(/^['"]|['"]$/g, '').trim();
    pinAdmin = pinAdmin.replace(/^['"]|['"]$/g, '').trim();
    sheetId = sheetId.replace(/^['"]|['"]$/g, '').trim();
    folderId = folderId.replace(/^['"]|['"]$/g, '').trim();

    // PERBAIKAN KRUSIAL UNTUK PRIVATE KEY (Invalid JWT Signature)
    // Menghapus kutip, lalu mengubah teks harfiah "\n" menjadi karakter baris baru (newline) yang sebenarnya
    privateKey = privateKey.replace(/^['"]|['"]$/g, '').replace(/\\n/g, '\n');

    if (!privateKey.includes('BEGIN PRIVATE KEY')) {
      throw new Error("Format Private Key salah. Pastikan kuncinya utuh.");
    }

    // ====================================================================
    // 2. AUTENTIKASI GOOGLE
    // ====================================================================
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: clientEmail,
        private_key: privateKey,
      },
      scopes: [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive'
      ],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const drive = google.drive({ version: 'v3', auth });
    const RANGE = 'Sheet1!A:E';

    // ====================================================================
    // A. LOGIN ADMIN
    // ====================================================================
    if (action === 'cekLogin') {
      const isMatch = String(payload.pin).trim() === pinAdmin;
      if (isMatch) {
        return res.status(200).json({ success: true });
      } else {
        return res.status(200).json({ success: false, message: "PIN Salah" });
      }
    }

    // ====================================================================
    // B. SUBMIT FORM
    // ====================================================================
    if (action === 'submitForm') {
      let fileUrl = '';
      
      if (payload.fileData) {
        let mimeType = 'application/octet-stream';
        let base64Data = payload.fileData;

        if (payload.fileData.includes(',')) {
          const parts = payload.fileData.split(',');
          const match = parts[0].match(/:(.*?);/);
          if (match) mimeType = match[1];
          base64Data = parts[1];
        }
        
        const buffer = Buffer.from(base64Data, 'base64');
        const bufferStream = new PassThrough();
        bufferStream.end(buffer);

        const driveRes = await drive.files.create({
          requestBody: { name: payload.fileName, parents: [folderId] },
          media: { mimeType: mimeType, body: bufferStream },
          fields: 'webViewLink' 
        });
        fileUrl = driveRes.data.webViewLink;
      }

      const values = [
        new Date().toISOString(),
        payload.nama,
        payload.email,
        fileUrl,
        'PENDING'
      ];

      await sheets.spreadsheets.values.append({
        spreadsheetId: sheetId,
        range: RANGE,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [values] }
      });

      return res.status(200).json({ success: true, message: 'Data berhasil disimpan' });
    }

    // ====================================================================
    // C. AMBIL DATA
    // ====================================================================
    if (action === 'getData') {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: RANGE,
      });
      const rows = response.data.values || [];
      const data = rows.length > 1 ? rows.slice(1) : []; 
      return res.status(200).json({ success: true, data: data });
    }

    // ====================================================================
    // D. UPDATE STATUS
    // ====================================================================
    if (action === 'updateStatus') {
      const barisKe = payload.index + 2; 

      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `Sheet1!E${barisKe}`,
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