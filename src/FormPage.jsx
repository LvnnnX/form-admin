import { useState, useContext } from 'react'
import { AppContext } from './App'

const CONFIG = {
  sheetId: import.meta.env.VITE_GOOGLE_SHEET_ID || '1H1uw245vdylR6Zuesz9WZeZJJWe0ego9p19x8KHAfws',
  credentials: null
}

if (import.meta.env.VITE_GOOGLE_CREDENTIALS) {
  try {
    CONFIG.credentials = JSON.parse(import.meta.env.VITE_GOOGLE_CREDENTIALS)
  } catch (e) {
    console.error('Invalid credentials')
  }
}

const GoogleSheets = {
  accessToken: null,
  tokenExpiry: 0,

  async getAccessToken() {
    if (this.accessToken && Date.now() < this.tokenExpiry) return this.accessToken
    if (!CONFIG.credentials) return null

    const { client_email, private_key } = CONFIG.credentials
    const now = Math.floor(Date.now() / 1000)
    const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
    const claim = btoa(JSON.stringify({
      iss: client_email,
      scope: 'https://www.googleapis.com/auth/spreadsheets',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now
    }))

    try {
      const pemLines = private_key.split('\\n')
      const base64 = pemLines.filter(line => !line.startsWith('-----')).join('')
      const binaryStr = atob(base64)
      const bytes = new Uint8Array(binaryStr.length)
      for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i)

      const key = await crypto.subtle.importKey('pkcs8', bytes.buffer, { name: 'RSASSA-PKCS1-V1_5', hash: 'SHA-256' }, false, ['sign'])
      const signature = await crypto.subtle.sign('RSASSA-PKCS1-V1_5', key, new TextEncoder().encode(header + '.' + claim))
      const sigBase64 = btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=/g, '')
      const jwt = header + '.' + claim + '.' + sigBase64

      const resp = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'grant_type=urn%3Aietf%3Aparams%3Aoauth2%3Agrant-type%3Ajwt-bearer&assertion=' + jwt
      })
      const data = await resp.json()
      if (data.access_token) {
        this.accessToken = data.access_token
        this.tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000
        return this.accessToken
      }
    } catch (err) { console.error('Auth error:', err) }
    return null
  },

  async appendRow(formData) {
    const token = await this.getAccessToken()
    if (!token) return false

    const values = [
      new Date().toISOString(),
      'KTP-' + Date.now().toString(36).toUpperCase(),
      formData.nama,
      formData.email,
      formData.fileName || '',
      formData.fileData || '',
      '',
      '',
      '',
      '',
      ''
    ]

    try {
      await fetch('https://sheets.googleapis.com/v4/spreadsheets/' + CONFIG.sheetId + '/values/A:A:append?valueInputOption=RAW', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: [values] })
      })
      return true
    } catch (err) { console.error('Append error:', err); return false }
  }
}

function createConfetti() {
  const container = document.createElement('div')
  container.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9998;overflow:hidden'
  document.body.appendChild(container)
  const colors = ['#6366f1', '#10b981', '#ec4899', '#f59e0b', '#3b82f6']
  for (let i = 0; i < 60; i++) {
    const confetti = document.createElement('div')
    confetti.style.cssText = 'position:absolute;width:10px;height:10px;background:' + colors[Math.floor(Math.random() * colors.length)] + ';left:' + (Math.random() * 100) + '%;animation:confetti ' + (1.5 + Math.random()) + 's ease-out forwards'
    container.appendChild(confetti)
  }
  setTimeout(() => container.remove(), 3000)
}

export default function FormPage() {
  const { navigate } = useContext(AppContext)
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const [form, setForm] = useState({ nama: '', email: '' })

  const handleFileChange = (f) => {
    if (!f) return
    if (f.size > 3 * 1024 * 1024) { alert('File Terlalu Besar - Maksimal 3MB'); return }
    setFile(f)
    if (f.type.startsWith('image/')) { const reader = new FileReader(); reader.onload = (e) => setPreview(e.target.result); reader.readAsDataURL(f) }
  }

  const handleDrop = (e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFileChange(f) }
  const removeFile = () => { setFile(null); setPreview(null) }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!file) { alert('Dokumen Wajib - Silakan upload KTP'); return }
    setLoading(true)

    const reader = new FileReader()
    reader.onload = async (event) => {
      const payload = { nama: form.nama, email: form.email, fileName: file.name, fileData: event.target.result }
      const success = await GoogleSheets.appendRow(payload)
      
      if (success) { 
        alert('Berhasil Dikirim! Data Anda telah tersimpan di Google Spreadsheet.') 
        e.target.reset(); setForm({ nama: '', email: '' }); removeFile(); createConfetti() 
      } else {
        alert('Gagal mengirim ke Google Spreadsheet. Pastikan konfigurasi sudah benar.')
      }
      setLoading(false)
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className='form-page'>
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
        <div className='form-card'>
          <div className='form-header'><div className='form-icon'><span className='material-icons-round'>badge</span></div><h1>Registrasi Data</h1><p>Lengkapi formulir dengan data yang valid</p></div>
          <form onSubmit={handleSubmit}>
            <div className='form-group'><label className='form-label'>Nama Lengkap <span className='required'>*</span></label><input type='text' className='form-input' placeholder='Masukkan nama sesuai KTP' value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} required /></div>
            <div className='form-group'><label className='form-label'>Alamat Email <span className='required'>*</span></label><input type='email' className='form-input' placeholder='nama@email.com' value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></div>
            <div className='form-group'>
              <label className='form-label'>Dokumen KTP <span className='required'>*</span></label>
              <input type='file' id='ktpFile' accept='image/*,.pdf' onChange={(e) => handleFileChange(e.target.files[0])} style={{ display: 'none' }} />
              {!file ? (<div className={'upload-zone ' + (dragOver ? 'dragover' : '')} onClick={() => document.getElementById('ktpFile').click()} onDragOver={(e) => { e.preventDefault(); setDragOver(true) }} onDragLeave={() => setDragOver(false)} onDrop={handleDrop}><div className='upload-icon'><span className='material-icons-round'>upload_file</span></div><p className='upload-text'>Seret file ke sini atau <strong>pilih file</strong></p><p className='upload-hint'>Format: JPG, PNG, PDF (maks. 3MB)</p></div>) : (<div className='preview-container show'>{preview && <img src={preview} alt='Preview' />}<div className='preview-info'><span className='file-name'><span className='material-icons-round'>check_circle</span>{file.name}</span><button type='button' className='btn-remove' onClick={removeFile}><span className='material-icons-round'>delete</span></button></div></div>)}
            </div>
            <button type='submit' className='btn-submit' disabled={loading}>{loading ? <><div className='spinner'></div>Mengunggah...</> : <><span className='material-icons-round'>send</span>Kirim Data</>}</button>
          </form>
        </div>
      </div>
      <button className='admin-link' onClick={() => navigate('login')}><span className='material-icons-round'>admin_panel_settings</span>Admin Panel</button>
    </div>
  )
}
