import { useState, useContext, useEffect } from 'react'
import { useGoogleLogin } from '@react-oauth/google'
import { AppContext } from './App'

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
  const [user, setUser] = useState(null)
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const [form, setForm] = useState({ nama: '', email: '' })

  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''

  const googleLogin = useGoogleLogin({
    onSuccess: (response) => {
      setUser(response)
    },
    onError: (error) => {
      console.error('Login failed:', error)
      alert('Gagal login dengan Google. Silakan coba lagi.')
    },
    scope: 'https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile',
    flow: 'implicit',
  })

  useEffect(() => {
    if (user) {
      // Decode JWT to get user info
      try {
        const payload = JSON.parse(atob(user.access_token.split('.')[1]))
        setForm(prev => ({
          ...prev,
          email: prev.email || payload.email,
          nama: prev.nama || payload.name || ''
        }))
      } catch (e) {
        console.error('Failed to decode token:', e)
      }
    }
  }, [user])

  // Check if OAuth is configured
  const isOAuthConfigured = !!clientId

  const handleFileChange = (f) => {
    if (!f) return
    if (f.size > 3 * 1024 * 1024) { alert('File Terlalu Besar - Maksimal 3MB'); return }
    setFile(f)
    if (f.type.startsWith('image/')) { 
      const reader = new FileReader(); 
      reader.onload = (e) => setPreview(e.target.result); 
      reader.readAsDataURL(f) 
    } else {
      setPreview(null)
    }
  }

  const handleDrop = (e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFileChange(f) }
  const removeFile = () => { setFile(null); setPreview(null) }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!file) { alert('Dokumen Wajib - Silakan upload KTP'); return }
    
    // If OAuth is configured, require login
    if (isOAuthConfigured && !user) {
      alert('Silakan login dengan Google terlebih dahulu')
      return
    }
    
    setLoading(true)

    const reader = new FileReader()
    reader.onload = async (event) => {
      // Get user email from Google login or form input
      let userEmail = form.email
      
      if (user) {
        try {
          const payload = JSON.parse(atob(user.access_token.split('.')[1]))
          userEmail = payload.email
        } catch (e) {}
      }
      
      const payload = { 
        nama: form.nama, 
        email: userEmail, 
        fileName: file.name, 
        fileData: event.target.result,
        submittedBy: user ? JSON.parse(atob(user.access_token.split('.')[1])).email : null
      }
      
      try {
        // --- PERUBAHAN UTAMA: Memanggil API Vercel lokal ---
        const response = await fetch('/api/google', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'submitForm', payload })
        })
        const data = await response.json()
        
        if (data.success) { 
          alert('Berhasil Dikirim! Data Anda telah tersimpan di Google Spreadsheet.') 
          e.target.reset(); setForm({ nama: '', email: '' }); removeFile(); createConfetti() 
        } else {
          alert('Gagal mengirim ke server: ' + data.message)
        }
      } catch (err) {
        alert('Gagal terhubung ke API Vercel.')
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
          
          {isOAuthConfigured && (
            <div className='form-group'>
              {!user ? (
                <div style={{ textAlign: 'center', padding: '20px', background: 'var(--gray-50)', borderRadius: '12px', marginBottom: '20px' }}>
                  <p style={{ marginBottom: '15px', color: 'var(--gray-600)' }}>Silakan login dengan Google untuk melanjutkan</p>
                  <button 
                    type="button" 
                    onClick={() => googleLogin()} 
                    style={{ 
                      background: '#4285f4', 
                      color: 'white', 
                      border: 'none', 
                      padding: '12px 24px', 
                      borderRadius: '8px', 
                      fontSize: '14px', 
                      fontWeight: '600', 
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M17.64 9.2C17.64 8.5669 17.5827 7.95274 17.4724 7.36364H9V10.845H13.8617C13.6025 12.1598 12.8341 13.3223 11.7317 14.0727V16.4636H14.8273C16.5176 14.9218 17.64 12.7351 17.64 9.2Z" fill="white"/>
                      <path d="M9 18C11.49 18 13.59 17.1545 14.8273 16.4636L11.7317 14.0727C10.8822 14.6455 9.80949 15 9 15C6.65516 15 4.67627 13.2626 3.93281 11.0577H1.05664V13.4718C2.40627 16.4018 5.59181 18 9 18Z" fill="white"/>
                      <path d="M3.93281 11.0577C3.66025 10.348 3.5 9.59679 3.5 8.81818C3.5 8.03958 3.66025 7.28836 3.93281 6.57874V4.16464H1.05664C0.3725 5.54828 0 7.09649 0 8.81818C0 10.5399 0.3725 12.0881 1.05664 13.4718L3.93281 11.0577Z" fill="white"/>
                      <path d="M9 3.40909C10.1699 3.40909 11.2434 3.76364 12.1036 4.52727L14.8991 1.73182C13.5886 0.404545 11.4851 -0.272728 9 -0.272728C5.59181 -0.272728 2.40627 1.32727 1.05664 4.25727L3.93281 6.67136C4.67627 4.46646 6.65516 3.40909 9 3.40909Z" fill="white"/>
                    </svg>
                    Login dengan Google
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: '#dcfce7', borderRadius: '12px', marginBottom: '20px', border: '1px solid #86efac' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold' }}>
                    {form.nama ? form.nama.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '600', color: '#166534' }}>{form.nama || 'User'}</div>
                    <div style={{ fontSize: '13px', color: '#15803d' }}>{form.email}</div>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setUser(null)}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#15803d', fontSize: '13px' }}
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          )}
          
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