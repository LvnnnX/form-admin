import { google } from 'googleapis';
import { PassThrough } from 'stream';

// Menaikkan batas ukuran file di Vercel menjadi 10MB
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  try {
    const { action, payload } = req.body;

    // 1. PEMBERSIHAN ENVIRONMENT VARIABLES (SUPER KETAT)
    // Ini akan menghapus tanda kutip (") dan spasi yang sering bikin error di Vercel
    const clientEmail = (process.env.VITE_GOOGLE_CLIENT_EMAIL || '').replace(/"/g, '').trim();
    const privateKey = (process.env.VITE_GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n').replace(/"/g, '').trim();
    const pinAdmin = (process.env.VITE_PIN_ADMIN || '').replace(/"/g, '').trim();
    const sheetId = (process.env.VITE_GOOGLE_SHEET_ID || '').replace(/"/g, '').trim();
    const folderId = (process.env.VITE_GOOGLE_FOLDER_ID || '').replace(/"/g, '').trim();

    // 2. AUTENTIKASI MENGGUNAKAN GoogleAuth (Jauh lebih stabil dari JWT)
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
    const RANGE = 'Sheet1!A:E'; // Pastikan nama sheet di bawah Google Spreadsheet Anda adalah "Sheet1"

    // ---------------------------------------------------------
    // A. LOGIKA LOGIN ADMIN (PIN)
    // ---------------------------------------------------------
    if (action === 'cekLogin') {
      // Membandingkan PIN input dengan PIN di env dengan aman
      const isMatch = String(payload.pin).trim() === pinAdmin;
      return res.status(200).json({ success: isMatch });
    }

    // ---------------------------------------------------------
    // B. LOGIKA SUBMIT FORM (Upload Drive & Simpan ke Sheet)
    // ---------------------------------------------------------
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

        // Upload file ke Drive
        const driveRes = await drive.files.create({
          requestBody: { name: payload.fileName, parents: [folderId] },
          media: { mimeType: mimeType, body: bufferStream },
          fields: 'webViewLink' 
        });
        fileUrl = driveRes.data.webViewLink;
      }

      // Format Data: [Waktu, Nama, Email, Link KTP, Status]
      const values = [
        new Date().toISOString(),
        payload.nama,
        payload.email,
        fileUrl,
        'PENDING'
      ];

      // Tulis baris baru ke Spreadsheet
      await sheets.spreadsheets.values.append({
        spreadsheetId: sheetId,
        range: RANGE,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [values] }
      });

      return res.status(200).json({ success: true, message: 'Data berhasil disimpan' });
    }

    // ---------------------------------------------------------
    // C. LOGIKA AMBIL DATA (Untuk Admin)
    // ---------------------------------------------------------
    if (action === 'getData') {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: RANGE,
      });
      const rows = response.data.values || [];
      const data = rows.length > 1 ? rows.slice(1) : []; // Hapus header
      return res.status(200).json({ success: true, data: data });
    }

    // ---------------------------------------------------------
    // D. LOGIKA UPDATE STATUS (Untuk Admin)
    // ---------------------------------------------------------
    if (action === 'updateStatus') {
      const barisKe = payload.index + 2; 

      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `Sheet1!E${barisKe}`, // E adalah kolom status
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