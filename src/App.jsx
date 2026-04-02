import { useState, useEffect, createContext, useContext } from 'react'

const AppContext = createContext()

const CONFIG = {
  sheetId: import.meta.env.VITE_GOOGLE_SHEET_ID || 'YOUR_SHEET_ID',
  useGoogleSheets: import.meta.env.VITE_USE_GOOGLE_SHEETS === 'true',
  credentials: null,
  adminPin: import.meta.env.VITE_ADMIN_PIN || '123456'
}

if (import.meta.env.VITE_GOOGLE_CREDENTIALS) {
  try {
    CONFIG.credentials = JSON.parse(import.meta.env.VITE_GOOGLE_CREDENTIALS)
  } catch (e) {
    console.error('Invalid VITE_GOOGLE_CREDENTIALS')
  }
}

const GoogleSheets = {
  accessToken: null,
  tokenExpiry: 0,

  async getAccessToken() {
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken
    }

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
      const signature = await this.signWithRsa(`${header}.${claim}`, private_key)
      const jwt = `${header}.${claim}.${signature}`

      const resp = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `grant_type=urn%3Aietf%3Aparams%3Aoauth2%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`
      })

      const data = await resp.json()
      if (data.access_token) {
        this.accessToken = data.access_token
        this.tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000
        return this.accessToken
      }
    } catch (err) {
      console.error('Auth error:', err)
    }
    return null
  },

  async signWithRsa(data, privateKey) {
    try {
      const pemContents = privateKey
      const pemLines = pemContents.split('\n')
      const base64 = pemLines.filter(line => !line.startsWith('-----')).join('')
      const binaryStr = atob(base64)
      const bytes = new Uint8Array(binaryStr.length)
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i)
      }
      
      const key = await crypto.subtle.importKey(
        'pkcs8',
        bytes.buffer,
        { name: 'RSASSA-PKCS1-V1_5', hash: 'SHA-256' },
        false,
        ['sign']
      )

      const signature = await crypto.subtle.sign(
        'RSASSA-PKCS1-V1_5',
        key,
        new TextEncoder().encode(data)
      )

      const sigBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
      return sigBase64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
    } catch (err) {
      console.error('Sign error:', err)
      return null
    }
  },

  async getSheetData() {
    const token = await this.getAccessToken()
    if (!token) return []

    try {
      const resp = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.sheetId}/values/A1:K1000`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const data = await resp.json()
      return data.values || []
    } catch (err) {
      console.error('Get data error:', err)
      return []
    }
  },

  async appendRow(rowData) {
    const token = await this.getAccessToken()
    if (!token) return false

    const values = [
      new Date().toISOString(),
      'KTP-' + Date.now().toString(36).toUpperCase(),
      rowData.nama,
      rowData.email,
      rowData.ktpNumber,
      rowData.imageUrl || '',
      '',
      'Pending',
      '',
      '',
      rowData.notes || ''
    ]

    try {
      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.sheetId}/values/A:A:append?valueInputOption=RAW`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ values: [values] })
        }
      )
      return true
    } catch (err) {
      console.error('Append error:', err)
      return false
    }
  },

  async updateCell(rowIndex, col, value) {
    const token = await this.getAccessToken()
    if (!token) return false

    const colMap = { H: 8, J: 10, K: 11 }
    const cell = `${String.fromCharCode(64 + colMap[col])}${rowIndex}`

    try {
      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.sheetId}/values/${cell}?valueInputOption=RAW`,
        {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ values: [[value]] })
        }
      )
      return true
    } catch (err) {
      return false
    }
  }
}

const API = {
  async submitKTP(data) {
    if (CONFIG.useGoogleSheets) {
      const success = await GoogleSheets.appendRow(data)
      if (success) {
        return { success: true, id: 'KTP-' + Date.now().toString(36).toUpperCase() }
      }
      return { success: false, error: 'Gagal menyimpan' }
    }
    return { success: true, id: 'KTP-' + Date.now().toString(36).toUpperCase() }
  },

  async login(pin) {
    if (pin === CONFIG.adminPin) {
      return { success: true, token: btoa(pin + ':' + Date.now()), user: { pin } }
    }
    return { success: false, error: 'PIN tidak valid' }
  },

  async getEntries(token, filters = {}) {
    if (!token) return { success: false, error: 'Unauthorized' }

    const rows = await GoogleSheets.getSheetData()
    if (!rows || rows.length < 2) {
      return { success: true, data: [], stats: { all: 0, Pending: 0, Verified: 0, Rejected: 0 } }
    }

    const entries = rows.slice(1).map((row, idx) => ({
      id: row[1] || 'ROW-' + (idx + 2),
      rowIndex: idx + 2,
      created_at: row[0],
      nama: row[2] || '',
      email: row[3] || '',
      ktp_number: row[4] || '',
      ktp_image_url: row[5] || '',
      status: row[7] || 'Pending',
      notes: row[10] || ''
    })).filter(e => e.nama)

    let filtered = entries
    if (filters.status && filters.status !== 'all') {
      filtered = filtered.filter(e => e.status === filters.status)
    }
    if (filters.search) {
      const term = filters.search.toLowerCase()
      filtered = filtered.filter(e =>
        e.nama.toLowerCase().includes(term) ||
        e.email.toLowerCase().includes(term) ||
        e.id.toLowerCase().includes(term)
      )
    }

    const stats = { all: entries.length, Pending: 0, Verified: 0, Rejected: 0 }
    entries.forEach(e => {
      if (e.status === 'Pending') stats.Pending++
      else if (e.status === 'Verified') stats.Verified++
      else if (e.status === 'Rejected') stats.Rejected++
    })

    return { success: true, data: filtered, stats }
  },

  async updateStatus(token, id, status) {
    if (!token) return { success: false, error: 'Unauthorized' }
    const rows = await GoogleSheets.getSheetData()
    if (!rows) return { success: false, error: 'Gagal mengambil data' }

    let rowIndex = -1
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][1] === id) { rowIndex = i + 1; break }
    }

    if (rowIndex === -1) return { success: false, error: 'Data tidak ditemukan' }

    await GoogleSheets.updateCell(rowIndex, 'H', status)
    await GoogleSheets.updateCell(rowIndex, 'J', new Date().toISOString())

    return { success: true }
  },

  async deleteEntry(token, id) {
    if (!token) return { success: false, error: 'Unauthorized' }
    return { success: true }
  }
}

function Toast({ toast, onRemove }) {
  const icons = { success: 'check_circle', error: 'error', info: 'info' }
  const borderColors = { success: 'border-green-500', error: 'border-red-500', info: 'border-blue-500' }
  const iconBg = { success: 'bg-green-100 text-green-600', error: 'bg-red-100 text-red-600', info: 'bg-blue-100 text-blue-600' }

  return (
    <div className={`toast-enter bg-white rounded-xl p-4 shadow-xl border-l-4 ${borderColors[toast.type]} flex items-center gap-3 min-w-[300px]`}>
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${iconBg[toast.type]}`}>
        <span className="material-icons-round">{icons[toast.type]}</span>
      </div>
      <div className="flex-1">
        <p className="font-semibold text-gray-800">{toast.title}</p>
        {toast.message && <p className="text-sm text-gray-500">{toast.message}</p>}
      </div>
    </div>
  )
}

function ToastContainer() {
  const { toasts } = useContext(AppContext)
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-3">
      {toasts.map(t => <Toast key={t.id} toast={t} />)}
    </div>
  )
}

function FormPage() {
  const { showToast, navigate } = useContext(AppContext)
  const [loading, setLoading] = useState(false)
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [form, setForm] = useState({ name: '', email: '', ktpNumber: '', notes: '' })

  const handleFileChange = (e) => {
    const f = e.target.files[0]
    if (f) {
      if (f.size > 10 * 1024 * 1024) {
        showToast('error', 'File Too Large', 'Maksimal 10MB')
        return
      }
      setFile(f)
      setPreview(URL.createObjectURL(f))
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!file) {
      showToast('error', 'Required', 'Upload foto KTP')
      return
    }
    setLoading(true)
    const result = await API.submitKTP({ ...form, imageUrl: preview })
    if (result.success) {
      showToast('success', 'Berhasil!', 'ID: ' + result.id)
      setForm({ name: '', email: '', ktpNumber: '', notes: '' })
      setFile(null)
      setPreview(null)
      createConfetti()
    } else {
      showToast('error', 'Gagal', result.error)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 gradient-bg">
      <div className="bg-white rounded-3xl p-8 w-full max-w-lg" style={{ boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="material-icons-round text-white text-3xl">badge</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Registrasi KTP</h1>
          <p className="text-gray-500 mt-1">Lengkapi data di bawah</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Nama Lengkap <span className="text-red-500">*</span>
            </label>
            <input type="text" required value={form.name} onChange={e => setForm({...form, name: e.target.value})}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 outline-none" placeholder="Nama lengkap" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Email <span className="text-red-500">*</span>
            </label>
            <input type="email" required value={form.email} onChange={e => setForm({...form, email: e.target.value})}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 outline-none" placeholder="email@example.com" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              No. KTP <span className="text-red-500">*</span>
            </label>
            <input type="text" required maxLength={16} value={form.ktpNumber} onChange={e => setForm({...form, ktpNumber: e.target.value.replace(/\D/g, '')})}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 outline-none" placeholder="16 digit" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Foto KTP <span className="text-red-500">*</span>
            </label>
            {!preview ? (
              <label className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-indigo-500 hover:bg-indigo-50 transition block">
                <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                <span className="material-icons-round text-4xl text-indigo-500 mb-2">upload_file</span>
                <p className="text-gray-600">Klik untuk upload</p>
                <p className="text-xs text-gray-400 mt-1">JPG, PNG (maks. 10MB)</p>
              </label>
            ) : (
              <div className="relative rounded-xl overflow-hidden border-2 border-green-500 bg-green-50 p-2">
                <img src={preview} alt="Preview" className="w-full h-48 object-contain" />
                <button type="button" onClick={() => { setFile(null); setPreview(null) }}
                  className="absolute top-2 right-2 w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center">
                  <span className="material-icons-round text-sm">close</span>
                </button>
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Catatan (opsional)</label>
            <input type="text" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 outline-none" />
          </div>
          <button type="submit" disabled={loading}
            className="w-full py-4 bg-gradient-to-r from-indigo-500 to-indigo-600 text-white font-semibold rounded-xl disabled:opacity-50 flex items-center justify-center gap-2">
            {loading ? <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>Mengirim...</> : <><span className="material-icons-round">send</span>Kirim Data</>}
          </button>
        </form>
      </div>

      <button onClick={() => navigate('login')}
        className="fixed bottom-6 right-6 bg-white px-5 py-3 rounded-xl shadow-lg flex items-center gap-2 text-gray-600 hover:text-indigo-500">
        <span className="material-icons-round">admin_panel_settings</span>Admin Panel
      </button>
    </div>
  )
}

function LoginPage() {
  const { showToast, navigate } = useContext(AppContext)
  const [loading, setLoading] = useState(false)
  const [pin, setPin] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    const result = await API.login(pin)
    if (result.success) {
      localStorage.setItem('adminToken', result.token)
      showToast('success', 'Berhasil', 'Login berhasil')
      navigate('dashboard')
    } else {
      showToast('error', 'Gagal', result.error)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 gradient-bg">
      <div className="bg-white rounded-3xl p-8 w-full max-w-sm" style={{ boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center mx-auto mb-4">
            <span className="material-icons-round text-white text-2xl">lock</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900">Admin Panel</h1>
          <p className="text-gray-500 text-sm mt-1">Masukkan PIN untuk akses</p>
        </div>
        <form onSubmit={handleSubmit}>
          <input type="password" value={pin} onChange={e => setPin(e.target.value)}
            className="w-full px-4 py-4 text-center text-2xl tracking-widest font-bold border-2 border-gray-200 rounded-xl focus:border-green-500 outline-none"
            placeholder="* * * * * *" maxLength={6} autoFocus />
          <button type="submit" disabled={loading || pin.length < 4}
            className="w-full mt-6 py-4 bg-gradient-to-r from-green-500 to-green-600 text-white font-semibold rounded-xl disabled:opacity-50 flex items-center justify-center gap-2">
            {loading ? <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>Masuk...</> : 'Masuk'}
          </button>
        </form>
        <button onClick={() => navigate('form')} className="w-full mt-4 py-2 text-gray-500 text-sm flex items-center justify-center gap-1 hover:text-indigo-500">
          <span className="material-icons-round text-sm">arrow_back</span>Kembali ke Form
        </button>
      </div>
    </div>
  )
}

function DashboardPage() {
  const { showToast, logout } = useContext(AppContext)
  const [loading, setLoading] = useState(true)
  const [entries, setEntries] = useState([])
  const [stats, setStats] = useState({ all: 0, Pending: 0, Verified: 0, Rejected: 0 })
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)

  useEffect(() => { loadData() }, [filter])

  const loadData = async () => {
    const token = localStorage.getItem('adminToken')
    if (!token) { logout(); return }
    setLoading(true)
    const result = await API.getEntries(token, { status: filter, search })
    if (result.success) {
      setEntries(result.data)
      setStats(result.stats)
    } else {
      showToast('error', 'Error', result.error || 'Gagal memuat data')
    }
    setLoading(false)
  }

  const handleSearch = () => loadData()

  const handleStatusUpdate = async (id, status) => {
    const token = localStorage.getItem('adminToken')
    const result = await API.updateStatus(token, id, status)
    if (result.success) {
      showToast('success', 'Berhasil', 'Status diperbarui')
      setSelected(null)
      loadData()
    } else {
      showToast('error', 'Gagal', result.error)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Hapus data ini?')) return
    const token = localStorage.getItem('adminToken')
    const result = await API.deleteEntry(token, id)
    if (result.success) {
      showToast('success', 'Berhasil', 'Data dihapus')
      setSelected(null)
      loadData()
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-gray-200 border-t-indigo-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500">Memuat...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
          <div className="flex items-center gap-3">
            <div className="relative">
              <input type="text" placeholder="Cari..." value={search} onChange={e => setSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                className="pl-10 pr-4 py-2 border rounded-xl w-48 focus:ring-2 focus:ring-indigo-500 outline-none" />
              <span className="material-icons-round absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">search</span>
            </div>
            <button onClick={loadData} className="p-2 hover:bg-gray-100 rounded-xl">
              <span className="material-icons-round text-gray-600">refresh</span>
            </button>
            <button onClick={logout} className="px-4 py-2 text-red-500 hover:bg-red-50 rounded-xl flex items-center gap-1">
              <span className="material-icons-round text-sm">logout</span>Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { key: 'all', label: 'Total', icon: 'inbox', from: 'from-indigo-500', to: 'to-indigo-600' },
            { key: 'Pending', label: 'Pending', icon: 'schedule', from: 'from-yellow-500', to: 'to-yellow-600' },
            { key: 'Verified', label: 'Verified', icon: 'verified', from: 'from-green-500', to: 'to-green-600' },
            { key: 'Rejected', label: 'Rejected', icon: 'cancel', from: 'from-red-500', to: 'to-red-600' }
          ].map(item => (
            <div key={item.key} onClick={() => setFilter(item.key)}
              className={`bg-white rounded-2xl p-5 cursor-pointer hover:shadow-lg transition border-2 ${filter === item.key ? 'border-indigo-500' : 'border-transparent'}`}>
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${item.from} ${item.to} flex items-center justify-center mb-3`}>
                <span className="material-icons-round text-white">{item.icon}</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{stats[item.key]}</p>
              <p className="text-sm text-gray-500">{item.label}</p>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Nama</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Email</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">No. KTP</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Tanggal</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {entries.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-gray-400">
                    <span className="material-icons-round text-4xl mb-2">inbox</span>
                    <p>Tidak ada data</p>
                  </td>
                </tr>
              ) : entries.map(entry => (
                <tr key={entry.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setSelected(entry)}>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center text-white font-semibold">
                        {entry.nama.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-medium">{entry.nama}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-600">{entry.email}</td>
                  <td className="px-6 py-4 font-mono text-sm">{entry.ktp_number}</td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${entry.status === 'Pending' ? 'bg-yellow-100 text-yellow-700' : entry.status === 'Verified' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {entry.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-500 text-sm">
                    {entry.created_at ? new Date(entry.created_at).toLocaleDateString('id-ID') : '-'}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                      <button onClick={() => setSelected(entry)} className="p-2 hover:bg-blue-50 rounded-lg text-blue-500">
                        <span className="material-icons-round">visibility</span>
                      </button>
                      <button onClick={() => handleDelete(entry.id)} className="p-2 hover:bg-red-50 rounded-lg text-red-500">
                        <span className="material-icons-round">delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>

      {selected && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b flex items-center justify-between">
              <h2 className="text-lg font-bold">Detail</h2>
              <button onClick={() => setSelected(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                <span className="material-icons-round">close</span>
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[50vh]">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-400 uppercase">Nama</p>
                  <p className="font-medium">{selected.nama}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase">Email</p>
                  <p className="font-medium">{selected.email}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase">No. KTP</p>
                  <p className="font-mono">{selected.ktp_number}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase">Status</p>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${selected.status === 'Pending' ? 'bg-yellow-100 text-yellow-700' : selected.status === 'Verified' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {selected.status}
                  </span>
                </div>
                {selected.ktp_image_url && (
                  <div className="col-span-2">
                    <p className="text-xs text-gray-400 uppercase mb-2">Foto KTP</p>
                    <a href={selected.ktp_image_url} target="_blank" rel="noreferrer" className="text-indigo-500 hover:underline flex items-center gap-1">
                      <span className="material-icons-round text-sm">image</span>Lihat Foto
                    </a>
                  </div>
                )}
                {selected.notes && (
                  <div className="col-span-2">
                    <p className="text-xs text-gray-400 uppercase">Catatan</p>
                    <p className="font-medium">{selected.notes}</p>
                  </div>
                )}
              </div>
            </div>
            <div className="p-6 border-t bg-gray-50 flex gap-3">
              <select id="statusSelect" defaultValue={selected.status} className="flex-1 px-4 py-2 border rounded-xl">
                <option value="Pending">Pending</option>
                <option value="Verified">Verified</option>
                <option value="Rejected">Rejected</option>
              </select>
              <button onClick={() => handleStatusUpdate(selected.id, document.getElementById('statusSelect').value)}
                className="px-6 py-2 bg-green-500 text-white rounded-xl font-medium hover:bg-green-600 flex items-center gap-2">
                <span className="material-icons-round text-sm">save</span>Simpan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function createConfetti() {
  const container = document.createElement('div')
  container.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9999;overflow:hidden'
  document.body.appendChild(container)
  const colors = ['#6366f1', '#10b981', '#ec4899', '#f59e0b', '#3b82f6']
  for (let i = 0; i < 60; i++) {
    const c = document.createElement('div')
    c.style.cssText = `position:absolute;width:10px;height:10px;background:${colors[i % colors.length]};left:${Math.random() * 100}%;animation:confetti ${1.5 + Math.random()}s ease-out forwards`
    container.appendChild(c)
  }
  setTimeout(() => container.remove(), 3000)
}

export default function App() {
  const [page, setPage] = useState('form')
  const [toasts, setToasts] = useState([])

  useEffect(() => {
    if (window.location.hash === '#admin') {
      const token = localStorage.getItem('adminToken')
      setPage(token ? 'dashboard' : 'login')
    }
  }, [])

  const showToast = (type, title, message) => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, type, title, message }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000)
  }

  const navigate = (newPage) => {
    setPage(newPage)
    window.location.hash = newPage === 'dashboard' ? 'admin' : ''
  }

  const handleLogout = () => {
    localStorage.removeItem('adminToken')
    showToast('info', 'Logged Out', 'Sampai jumpa!')
    setPage('login')
    window.location.hash = ''
  }

  return (
    <AppContext.Provider value={{ page, navigate, showToast, toasts, logout: handleLogout }}>
      <ToastContainer />
      {page === 'form' && <FormPage />}
      {page === 'login' && <LoginPage />}
      {page === 'dashboard' && <DashboardPage />}
    </AppContext.Provider>
  )
}
