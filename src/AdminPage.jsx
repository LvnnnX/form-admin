import { useState, useContext, useCallback } from 'react'
import { AppContext } from './App'

const API = {
  async login(pin) {
    const formData = { action: 'cekLogin', pin: pin }
    try {
      const res = await fetch(import.meta.env.VITE_GAS_URL || '', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(formData) })
      return await res.json()
    } catch (error) { return { success: false } }
  },
  async getData() {
    const formData = { action: 'ambilData' }
    try {
      const res = await fetch(import.meta.env.VITE_GAS_URL || '', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(formData) })
      return await res.json()
    } catch (error) { return { success: false, data: [] } }
  },
  async updateStatus(baris, statusBaru) {
    const formData = { action: 'updateStatus', baris: baris, statusBaru: statusBaru }
    try {
      const res = await fetch(import.meta.env.VITE_GAS_URL || '', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(formData) })
      return await res.json()
    } catch (error) { return { success: false } }
  }
}

export default function AdminPage() {
  const { navigate } = useContext(AppContext)
  const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem('adminToken'))
  const [pin, setPin] = useState('')
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState('ALL')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [modalActive, setModalActive] = useState(false)

  const handleLogin = async () => {
    setLoading(true)
    const response = await API.login(pin)
    if (response.success) {
      localStorage.setItem('adminToken', 'true')
      setIsLoggedIn(true)
      loadData()
    } else {
      alert('PIN Salah')
    }
    setLoading(false)
  }

  const loadData = useCallback(async () => {
    setLoading(true)
    const response = await API.getData()
    if (response.success) { setData(response.data) }
    setLoading(false)
  }, [])

  const handleVerifikasi = async (index, statusBaru) => {
    const barisSheet = index + 2
    await API.updateStatus(barisSheet, statusBaru)
    const newData = [...data]
    newData[index][4] = statusBaru
    setData(newData)
  }

  const getStatusClass = (status) => {
    if (status === 'DIVERIFIKASI') return 'verified'
    if (status === 'TERTOLAK') return 'rejected'
    return 'pending'
  }

  const getStatusLabel = (status) => {
    if (status === 'DIVERIFIKASI') return 'Disetujui'
    if (status === 'TERTOLAK') return 'Ditolak'
    return 'Pending'
  }

  const openModal = (entry, idx) => { setSelected({ ...entry, index: idx }); setModalActive(true) }
  const closeModal = () => { setModalActive(false); setTimeout(() => setSelected(null), 300) }

  const filteredData = data.filter(row => {
    const status = row[4] || ''
    const statusUpper = status.toUpperCase()
    if (filter === 'PENDING' && statusUpper !== 'PENDING' && statusUpper !== '') return false
    if (filter === 'DIVERIFIKASI' && statusUpper !== 'DIVERIFIKASI') return false
    if (filter === 'TERTOLAK' && statusUpper !== 'TERTOLAK') return false
    if (search) {
      const searchLower = search.toLowerCase()
      return (row[1] || '').toLowerCase().includes(searchLower) || (row[2] || '').toLowerCase().includes(searchLower)
    }
    return true
  })

  const pendingCount = data.filter(row => { const s = (row[4] || '').toUpperCase(); return s !== 'DIVERIFIKASI' && s !== 'TERTOLAK' }).length

  if (!isLoggedIn) {
    return (
      <div className='login-page'>
        <div className='login-card'>
          <div className='login-header'>
            <div className='login-icon'><span className='material-icons-round'>admin_panel_settings</span></div>
            <h1>Portal Admin</h1>
            <p>Masukkan PIN untuk mengakses data responden</p>
          </div>
          <div className='form-group'>
            <input type='password' className='form-input' placeholder='Masukkan PIN' value={pin} onChange={(e) => setPin(e.target.value)} style={{ textAlign: 'center', letterSpacing: '5px', fontSize: '20px' }} />
          </div>
          <button className='btn-login' onClick={handleLogin} disabled={loading || pin.length < 4}>
            {loading ? 'Memeriksa...' : 'Masuk ke Dashboard'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className='admin-page'>
      <aside className='sidebar'>
        <div className='sidebar-header'><span className='material-icons-round'>dashboard</span> Dashboard</div>
        <nav className='sidebar-nav'>
          <button className={'nav-btn ' + (filter === 'ALL' ? 'active' : '')} onClick={() => setFilter('ALL')}><span className='material-icons-round'>inbox</span> Semua Data</button>
          <button className={'nav-btn ' + (filter === 'PENDING' ? 'active' : '')} onClick={() => setFilter('PENDING')}><span className='material-icons-round'>schedule</span> Antrean {pendingCount > 0 && <span className='nav-badge'>{pendingCount}</span>}</button>
          <button className={'nav-btn ' + (filter === 'DIVERIFIKASI' ? 'active' : '')} onClick={() => setFilter('DIVERIFIKASI')}><span className='material-icons-round'>verified</span> Disetujui</button>
          <button className={'nav-btn ' + (filter === 'TERTOLAK' ? 'active' : '')} onClick={() => setFilter('TERTOLAK')}><span className='material-icons-round'>cancel</span> Ditolak</button>
        </nav>
        <div style={{ padding: '16px' }}>
          <button className='btn-logout' onClick={() => { localStorage.removeItem('adminToken'); navigate('form') }}><span className='material-icons-round'>logout</span> Logout</button>
        </div>
      </aside>
      <main className='main-content'>
        <header className='content-header'>
          <h1 className='page-title'>Data Responden</h1>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <div className='search-box'>
              <span className='material-icons-round' style={{ color: 'var(--gray-400)' }}>search</span>
              <input type='text' placeholder='Cari nama atau email...' value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <button className='btn-refresh' onClick={loadData}><span className='material-icons-round'>refresh</span></button>
          </div>
        </header>
        <div className='stats-grid'>
          <div className='stat-card' onClick={() => setFilter('ALL')}><div className='stat-icon' style={{ background: 'linear-gradient(135deg,#6366f1,#818cf8)' }}><span className='material-icons-round'>people</span></div><div className='stat-info'><span className='stat-value'>{data.length}</span><span className='stat-label'>Total Masuk</span></div></div>
          <div className='stat-card' onClick={() => setFilter('PENDING')}><div className='stat-icon' style={{ background: 'linear-gradient(135deg,#f59e0b,#fbbf24)' }}><span className='material-icons-round'>schedule</span></div><div className='stat-info'><span className='stat-value'>{pendingCount}</span><span className='stat-label'>Antrean</span></div></div>
          <div className='stat-card' onClick={() => setFilter('DIVERIFIKASI')}><div className='stat-icon' style={{ background: 'linear-gradient(135deg,#10b981,#34d399)' }}><span className='material-icons-round'>verified</span></div><div className='stat-info'><span className='stat-value'>{data.filter(r => (r[4] || '').toUpperCase() === 'DIVERIFIKASI').length}</span><span className='stat-label'>Disetujui</span></div></div>
          <div className='stat-card' onClick={() => setFilter('TERTOLAK')}><div className='stat-icon' style={{ background: 'linear-gradient(135deg,#ef4444,#f87171)' }}><span className='material-icons-round'>cancel</span></div><div className='stat-info'><span className='stat-value'>{data.filter(r => (r[4] || '').toUpperCase() === 'TERTOLAK').length}</span><span className='stat-label'>Ditolak</span></div></div>
        </div>
        <div className='table-container'>
          <table className='data-table'>
            <thead><tr><th>Responden</th><th>Email</th><th>Tanggal</th><th>Status</th><th>Aksi</th></tr></thead>
            <tbody>
              {filteredData.length === 0 ? <tr><td colSpan='5' style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>Tidak ada data</td></tr> : filteredData.map((row, idx) => {
                const actualIdx = data.indexOf(row)
                return (
                  <tr key={idx} onClick={() => openModal(row, actualIdx)}>
                    <td><div className='name-cell'><div className='avatar'>{(row[1] || '?').charAt(0).toUpperCase()}</div>{row[1] || '-'}</div></td>
                    <td>{row[2] || '-'}</td>
                    <td>{row[0] || '-'}</td>
                    <td><span className={'status-badge ' + getStatusClass(row[4])}>{getStatusLabel(row[4])}</span></td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <button className='action-btn' onClick={() => openModal(row, actualIdx)}><span className='material-icons-round'>visibility</span></button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </main>
      <div className={'modal-overlay ' + (modalActive ? 'active' : '')} onClick={closeModal}>
        <div className='modal' onClick={(e) => e.stopPropagation()}>
          {selected && (
            <>
              <div className='modal-header'><h2>Detail Responden</h2><button className='btn-close' onClick={closeModal}><span className='material-icons-round'>close</span></button></div>
              <div className='modal-body'>
                <div className='detail-grid'>
                  <div className='detail-item'><span className='detail-label'>Nama Lengkap</span><span className='detail-value'>{selected[1]}</span></div>
                  <div className='detail-item'><span className='detail-label'>Alamat Email</span><span className='detail-value'>{selected[2]}</span></div>
                  <div className='detail-item'><span className='detail-label'>Waktu Pendaftaran</span><span className='detail-value'>{selected[0]}</span></div>
                  <div className='detail-item'><span className='detail-label'>Status Verifikasi</span><span className={'status-badge ' + getStatusClass(selected[4])}>{getStatusLabel(selected[4])}</span></div>
                  {selected[3] && (
                    <div className='detail-item full' style={{ marginTop: '15px' }}>
                      <span className='detail-label'>Dokumen KTP</span>
                      <div style={{ background: 'var(--gray-50)', padding: '15px', borderRadius: '12px', border: '1px solid var(--gray-200)', textAlign: 'center', marginTop: '8px' }}>
                        {selected[3].match(/\/d\/([a-zA-Z0-9-_]+)/) && (
                          <div className='file-preview-container'><iframe src={'https://drive.google.com/file/d/' + selected[3].match(/\/d\/([a-zA-Z0-9-_]+)/)[1] + '/preview'} title='KTP Preview' /></div>
                        )}
                        <a href={selected[3]} target='_blank' rel='noreferrer' className='open-file-btn' style={{ marginTop: '12px' }}><span className='material-icons-round' style={{ fontSize: '18px' }}>open_in_new</span> Buka File Penuh</a>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className='modal-footer'>
                {(selected[4] || '').toUpperCase() === 'PENDING' || (selected[4] || '') === '' ? (
                  <>
                    <button className='btn-action reject' onClick={() => { handleVerifikasi(selected.index, 'TERTOLAK'); closeModal() }}><span className='material-icons-round' style={{ fontSize: '18px' }}>close</span> Tolak Data</button>
                    <button className='btn-action approve' onClick={() => { handleVerifikasi(selected.index, 'DIVERIFIKASI'); closeModal() }}><span className='material-icons-round' style={{ fontSize: '18px' }}>check</span> Setujui Data</button>
                  </>
                ) : <div style={{ color: 'var(--gray-500)', fontSize: '14px', padding: '10px' }}>Data telah diproses.</div>}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}