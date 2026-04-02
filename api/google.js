import { google } from 'googleapis';
import { PassThrough } from 'stream';

export const config = {
  api: { bodyParser: { sizeLimit: '10mb' } },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  try {
    const { action, payload } = req.body;
    let credentials = null;
    const credsJson = process.env.GOOGLE_CREDENTIALS || process.env.VITE_GOOGLE_CREDENTIALS;
    if (credsJson) { try { credentials = JSON.parse(credsJson); } catch (e) { try { credentials = JSON.parse(credsJson.replace(/\\n/g, '\n')); } catch (e2) {} } }
    const clientEmail = credentials?.client_email || process.env.GOOGLE_CLIENT_EMAIL || process.env.VITE_GOOGLE_CLIENT_EMAIL || '';
    let privateKey = credentials?.private_key || process.env.GOOGLE_PRIVATE_KEY || process.env.VITE_GOOGLE_PRIVATE_KEY || '';
    const pinAdmin = process.env.ADMIN_PIN || process.env.VITE_ADMIN_PIN || '';
    const sheetId = process.env.GOOGLE_SHEET_ID || process.env.VITE_GOOGLE_SHEET_ID || '';
    const folderId = process.env.GOOGLE_FOLDER_ID || process.env.VITE_GOOGLE_FOLDER_ID || '';
    const cleanEmail = clientEmail.replace(/^['"]|['"]$/g, '').trim();
    const cleanPin = pinAdmin.replace(/^['"]|['"]$/g, '').trim();
    const cleanSheetId = sheetId.replace(/^['"]|['"]$/g, '').trim();
    const cleanFolderId = folderId.replace(/^['"]|['"]$/g, '').trim();
    let cleanPrivateKey = privateKey.replace(/^['"]|['"]$/g, '');
    cleanPrivateKey = cleanPrivateKey.replace(/\\n/g, '\n');
    if (!cleanPrivateKey.includes('-----BEGIN PRIVATE KEY-----')) throw new Error('Format Private Key salah');
    const jwtClient = new google.auth.JWT({ email: cleanEmail, key: cleanPrivateKey, keyType: 'PKCS8', scopes: ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive'] });
    await jwtClient.authorize();
    const sheets = google.sheets({ version: 'v4', auth: jwtClient });
    const drive = google.drive({ version: 'v3', auth: jwtClient });
    const RANGE = 'Sheet1!A:E';
    if (action === 'cekLogin') return res.status(200).json({ success: String(payload.pin).trim() === cleanPin });
    if (action === 'submitForm') {
      let fileUrl = '';
      if (payload.fileData) {
        let mimeType = 'application/octet-stream', base64Data = payload.fileData;
        if (payload.fileData.includes(',')) { const p = payload.fileData.split(','); const m = p[0].match(/:(.*?);/); if (m) mimeType = m[1]; base64Data = p[1]; }
        const buf = Buffer.from(base64Data, 'base64'), stream = new PassThrough(); stream.end(buf);
        const dr = await drive.files.create({ requestBody: { name: payload.fileName, parents: [cleanFolderId] }, media: { mimeType, body: stream }, fields: 'webViewLink' });
        fileUrl = dr.data.webViewLink;
      }
      await sheets.spreadsheets.values.append({ spreadsheetId: cleanSheetId, range: RANGE, valueInputOption: 'USER_ENTERED', requestBody: { values: [[new Date().toISOString(), payload.nama, payload.email, fileUrl, 'PENDING']] } });
      return res.status(200).json({ success: true, message: 'Data berhasil disimpan' });
    }
    if (action === 'getData') { const r = await sheets.spreadsheets.values.get({ spreadsheetId: cleanSheetId, range: RANGE }); return res.status(200).json({ success: true, data: (r.data.values||[]).slice(1) }); }
    if (action === 'updateStatus') { await sheets.spreadsheets.values.update({ spreadsheetId: cleanSheetId, range: 'Sheet1!E'+(payload.index+2), valueInputOption: 'USER_ENTERED', requestBody: { values: [[payload.statusBaru]] } }); return res.status(200).json({ success: true }); }
    return res.status(400).json({ success: false, message: 'Aksi tidak ditemukan' });
  } catch (error) { console.error('API Error:', error); return res.status(500).json({ success: false, message: error.message }); }
}
