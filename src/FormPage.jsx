import { useState, useContext } from 'react'
import { AppContext } from './App'
import { supabase } from './supabase'

function createConfetti() {
  const container = document.createElement('div')
  container.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9998;overflow:hidden'
  document.body.appendChild(container)
  const colors = ['#6366f1', '#10b981', '#ec4899', '#f59e0b', '#3b82f6']
  for (let i = 0; i < 60; i++) {
    const confetti = document.createElement('div')
    confetti.style.cssText = `position:absolute;width:10px;height:10px;background:${colors[Math.floor(Math.random() * colors.length)]};left:${Math.random() * 100}%;animation:confetti ${1.5 + Math.random()}s ease-out forwards;`
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
  const [form, setForm] = useState({ nama: '', email: '', ktp_number: '', notes: '' })

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

  const handleKtpChange = (e) => {
    // Hanya izinkan angka, maksimal 16 digit
    const val = e.target.value.replace(/\D/g, '').substring(0, 16);
    setForm({ ...form, ktp_number: val });
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!file) { alert('Dokumen Wajib - Silakan upload foto KTP'); return }
    if (form.ktp_number.length !== 16) { alert('Nomor KTP harus terdiri dari 16 digit angka'); return }
    
    setLoading(true)

    try {
      // 1. Upload File ke Supabase Storage
      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('dokumen_ktp')
        .upload(fileName, file)

      if (uploadError) throw uploadError

      // 2. Dapatkan URL Publik File
      const { data: publicUrlData } = supabase.storage
        .from('dokumen_ktp')
        .getPublicUrl(fileName)

      // 3. Simpan Data ke Database sesuai Schema Baru
      const { error: dbError } = await supabase
        .from('ktp_data')
        .insert([
          { 
            nama: form.nama, 
            email: form.email, 
            ktp_number: form.ktp_number,
            notes: form.notes,
            ktp_image_url: publicUrlData.publicUrl,
            status: 'Pending'
          }
        ])

      if (dbError) throw dbError

      alert('Berhasil Dikirim! Data Anda telah tersimpan.') 
      e.target.reset()
      setForm({ nama: '', email: '', ktp_number: '', notes: '' })
      removeFile()
      createConfetti()

    } catch (error) {
      console.error(error)
      alert('Gagal mengirim: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className='form-page'>
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
        <div className='form-card'>
          <div className='form-header'><div className='form-icon'><span className='material-icons-round'>badge</span></div><h1>Registrasi Data</h1><p>Lengkapi formulir dengan data yang valid</p></div>
          <form onSubmit={handleSubmit}>
            <div className='form-group'>
              <label className='form-label'>Nama Lengkap <span className='required'>*</span></label>
              <input type='text' className='form-input' placeholder='Sesuai KTP' value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} required />
            </div>
            
            <div className='form-group'>
              <label className='form-label'>Alamat Email <span className='required'>*</span></label>
              <input type='email' className='form-input' placeholder='nama@email.com' value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            </div>

            <div className='form-group'>
              <label className='form-label'>Nomor KTP (NIK) <span className='required'>*</span></label>
              <input type='text' className='form-input' placeholder='16 Digit NIK' value={form.ktp_number} onChange={handleKtpChange} required />
              <p className="form-hint">Contoh: 3171234567890123</p>
            </div>

            <div className='form-group'>
              <label className='form-label'>Dokumen KTP <span className='required'>*</span></label>
              <input type='file' id='ktpFile' accept='image/*,.pdf' onChange={(e) => handleFileChange(e.target.files[0])} style={{ display: 'none' }} />
              {!file ? (
                <div className={'upload-zone ' + (dragOver ? 'dragover' : '')} onClick={() => document.getElementById('ktpFile').click()} onDragOver={(e) => { e.preventDefault(); setDragOver(true) }} onDragLeave={() => setDragOver(false)} onDrop={handleDrop}>
                  <div className='upload-icon'><span className='material-icons-round'>upload_file</span></div>
                  <p className='upload-text'>Seret file ke sini atau <strong>pilih file</strong></p>
                  <p className='upload-hint'>Format: JPG, PNG, PDF (maks. 3MB)</p>
                </div>
              ) : (
                <div className='preview-container show'>
                  {preview && <img src={preview} alt='Preview' style={{width: '100%', borderRadius: '12px'}} />}
                  <div className='preview-info'>
                    <span className='file-name'><span className='material-icons-round'>check_circle</span>{file.name}</span>
                    <button type='button' className='btn-remove' onClick={removeFile}><span className='material-icons-round'>delete</span></button>
                  </div>
                </div>
              )}
            </div>

            <div className='form-group'>
              <label className='form-label'>Catatan Tambahan (Opsional)</label>
              <textarea className='form-input' placeholder='Tulis pesan atau keterangan tambahan di sini...' value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} style={{resize: 'vertical', minHeight: '80px'}}></textarea>
            </div>

            <button type='submit' className='btn-submit' disabled={loading}>{loading ? <><div className='spinner'></div>Mengunggah...</> : <><span className='material-icons-round'>send</span>Kirim Data</>}</button>
          </form>
        </div>
      </div>
      <button className='admin-link' onClick={() => navigate('login')}><span className='material-icons-round'>admin_panel_settings</span>Admin Panel</button>
    </div>
  )
}