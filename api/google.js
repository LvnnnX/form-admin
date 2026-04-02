import { google } from 'googleapis';
import { PassThrough } from 'stream';

export default async function handler(req, res) {
  // Hanya menerima metode POST
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  try {
    const { action, payload } = req.body;

    // Autentikasi Service Account ke Google Cloud
    const auth = new google.auth.JWT(
      process.env.VITE_GOOGLE_CLIENT_EMAIL,
      null,
      process.env.VITE_GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive']
    );

    const sheets = google.sheets({ version: 'v4', auth });
    const drive = google.drive({ version: 'v3', auth });
    
    const SHEET_ID = process.env.VITE_GOOGLE_SHEET_ID;
    const FOLDER_ID = process.env.VITE_GOOGLE_FOLDER_ID;
    const RANGE = 'Sheet1!A:E'; // Asumsi nama sheet Anda adalah "Sheet1"

    // ---------------------------------------------------------
    // 1. LOGIKA SUBMIT FORM (Upload Drive & Simpan ke Sheet)
    // ---------------------------------------------------------
    if (action === 'submitForm') {
      let fileUrl = '';
      
      // Upload ke Google Drive
      if (payload.fileData) {
        const mimeType = payload.fileData.match(/data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+).*,/)[1];
        const base64Data = payload.fileData.split(',')[1];
        const buffer = Buffer.from(base64Data, 'base64');
        
        const bufferStream = new PassThrough();
        bufferStream.end(buffer);

        const driveRes = await drive.files.create({
          requestBody: { name: payload.fileName, parents: [FOLDER_ID] },
          media: { mimeType: mimeType, body: bufferStream },
          fields: 'webViewLink' // Mengambil URL File
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

      // Simpan ke Spreadsheet
      await sheets.spreadsheets.values.append({
        spreadsheetId: SHEET_ID,
        range: RANGE,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [values] }
      });

      return res.status(200).json({ success: true, message: 'Data berhasil disimpan' });
    }

    // ---------------------------------------------------------
    // 2. LOGIKA AMBIL DATA (Untuk Halaman Admin)
    // ---------------------------------------------------------
    if (action === 'getData') {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range: RANGE,
      });
      const rows = response.data.values || [];
      
      // Hapus baris pertama (Header) jika ada datanya
      const data = rows.length > 1 ? rows.slice(1) : [];
      return res.status(200).json({ success: true, data: data });
    }

    // ---------------------------------------------------------
    // 3. LOGIKA UPDATE STATUS (Untuk Halaman Admin)
    // ---------------------------------------------------------
    if (action === 'updateStatus') {
      const { index, statusBaru } = payload;
      const barisKe = index + 2; // +2 karena index array mulai dari 0 dan baris 1 adalah Header

      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: `Sheet1!E${barisKe}`, // Kolom E adalah kolom Status
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [[statusBaru]] }
      });
      
      return res.status(200).json({ success: true });
    }

    // ---------------------------------------------------------
    // 4. LOGIKA LOGIN ADMIN
    // ---------------------------------------------------------
    if (action === 'cekLogin') {
      const isValid = payload.pin === process.env.VITE_PIN_ADMIN;
      return res.status(200).json({ success: isValid });
    }

    return res.status(400).json({ success: false, message: 'Aksi tidak ditemukan' });

  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}