import { useState, useContext, useCallback, useEffect } from 'react'
import { AppContext } from './App'
import { supabase } from './supabase'

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
    const validPin = import.meta.env.VITE_PIN_ADMIN || '123456'
    
    if (pin === validPin) {
      localStorage.setItem('adminToken', 'true')
      setIsLoggedIn(true)
      loadData()
    } else {
      alert('PIN Salah!')
    }
    setLoading(false)
  }

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const { data: responden, error } = await supabase
        .from('responden')
        .select('*')
        .order('created_at', { ascending: false }) 

      if (error) throw error
      setData(responden || [])
    } catch (err) {
      console.error('Gagal load data:', err)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (isLoggedIn) loadData()
  }, [isLoggedIn, loadData])

  const handleVerifikasi = async (id, statusBaru) => {
    setLoading(true)
    try {
      const updatePayload = {
        status: statusBaru,
        processed_by: 'Admin Vercel', // Bisa diganti sesuai user yang login
        processed_at: new Date().toISOString()
      }

      const { error } = await supabase
        .from('responden')
        .update(updatePayload)
        .eq('id', id)

      if (error) throw error
      
      setData(prevData => prevData.map(item => item.id === id ? { ...item, ...updatePayload } : item))
      closeModal()
    } catch (e) {
      alert("Gagal update status: " + e.message)
    }
    setLoading(false)
  }

  const handleDelete = async (id) => {
    if(confirm("Yakin ingin menghapus data ini secara permanen?")) {
      setLoading(true)
      try {
        const { error } = await supabase.from('responden').delete().eq('id', id)
        if(error) throw error
        setData(prevData => prevData.filter(item => item.id !== id))
        closeModal()
      } catch (e) {
        alert("Gagal menghapus data.")
      }
      setLoading(false)
    }
  }

  const getStatusClass = (status) => {
    if (status === 'Verified') return 'verified'
    if (status === 'Rejected') return 'rejected'
    return 'pending'
  }

  const openModal = (entry) => { setSelected(entry); setModalActive(true) }
  const closeModal = () => { setModalActive(false); setTimeout(() => setSelected(null), 300) }

  const filteredData = data.filter(row => {
    const status = row.status || 'Pending'
    if (filter === 'PENDING' && status !== 'Pending') return false
    if (filter === 'DIVERIFIKASI' && status !== 'Verified') return false
    if (filter === 'TERTOLAK' && status !== 'Rejected') return false
    if (search) {
      const searchLower = search.toLowerCase()
      return (row.nama || '').toLowerCase().includes(searchLower) 
          || (row.email || '').toLowerCase().includes(searchLower)
          || (row.ktp_number || '').includes(searchLower)
    }
    return true
  })

  const pendingCount = data.filter(row => (row.status || 'Pending') === 'Pending').length

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
            <input type='password' className='form-input' placeholder='Masukkan PIN' value={pin} onChange={(e) => setPin(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleLogin()} style={{ textAlign: 'center', letterSpacing: '5px', fontSize: '20px' }} />
          </div>
          <button className='btn-login' onClick={handleLogin} disabled={loading || pin.length < 4}>
            {loading ? 'Memeriksa...' : 'Masuk ke Dashboard'}
          </button>
          <button onClick={() => navigate('form')} style={{marginTop: '20px', width:'100%', background:'transparent', border:'none', color:'var(--gray-500)', cursor:'pointer'}}>⬅ Kembali ke Form</button>
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
          <button className='btn-logout' onClick={() => { localStorage.removeItem('adminToken'); setIsLoggedIn(false); navigate('form') }}><span className='material-icons-round'>logout</span> Logout</button>
        </div>
      </aside>
      
      <main className='main-content'>
        <header className='content-header'>
          <h1 className='page-title'>Data Responden</h1>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <div className='search-box'>
              <span className='material-icons-round' style={{ color: 'var(--gray-400)' }}>search</span>
              <input type='text' placeholder='Cari nama, email, NIK...' value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <button className='btn-refresh' onClick={loadData}><span className='material-icons-round'>refresh</span></button>
          </div>
        </header>
        <div className='stats-grid'>
          <div className='stat-card' onClick={() => setFilter('ALL')}><div className='stat-icon' style={{ background: 'linear-gradient(135deg,#6366f1,#818cf8)' }}><span className='material-icons-round'>people</span></div><div className='stat-info'><span className='stat-value'>{data.length}</span><span className='stat-label'>Total Masuk</span></div></div>
          <div className='stat-card' onClick={() => setFilter('PENDING')}><div className='stat-icon' style={{ background: 'linear-gradient(135deg,#f59e0b,#fbbf24)' }}><span className='material-icons-round'>schedule</span></div><div className='stat-info'><span className='stat-value'>{pendingCount}</span><span className='stat-label'>Antrean</span></div></div>
          <div className='stat-card' onClick={() => setFilter('DIVERIFIKASI')}><div className='stat-icon' style={{ background: 'linear-gradient(135deg,#10b981,#34d399)' }}><span className='material-icons-round'>verified</span></div><div className='stat-info'><span className='stat-value'>{data.filter(r => r.status === 'Verified').length}</span><span className='stat-label'>Disetujui</span></div></div>
          <div className='stat-card' onClick={() => setFilter('TERTOLAK')}><div className='stat-icon' style={{ background: 'linear-gradient(135deg,#ef4444,#f87171)' }}><span className='material-icons-round'>cancel</span></div><div className='stat-info'><span className='stat-value'>{data.filter(r => r.status === 'Rejected').length}</span><span className='stat-label'>Ditolak</span></div></div>
        </div>
        <div className='table-container'>
          <table className='data-table'>
            <thead><tr><th>Responden</th><th>Email</th><th>NIK KTP</th><th>Tanggal</th><th>Status</th><th>Aksi</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan='6' style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>Memuat data...</td></tr> : filteredData.length === 0 ? <tr><td colSpan='6' style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>Tidak ada data</td></tr> : filteredData.map((row) => (
                  <tr key={row.id} onClick={() => openModal(row)}>
                    <td><div className='name-cell'><div className='avatar'>{(row.nama || '?').charAt(0).toUpperCase()}</div>{row.nama}</div></td>
                    <td>{row.email}</td>
                    <td>{row.ktp_number || '-'}</td>
                    <td>{new Date(row.created_at).toLocaleDateString('id-ID')}</td>
                    <td><span className={'status-badge ' + getStatusClass(row.status)}>{row.status}</span></td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <button className='action-btn' onClick={() => openModal(row)}><span className='material-icons-round'>visibility</span></button>
                    </td>
                  </tr>
              ))}
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
                  <div className='detail-item'><span className='detail-label'>Nama Lengkap</span><span className='detail-value'>{selected.nama}</span></div>
                  <div className='detail-item'><span className='detail-label'>Alamat Email</span><span className='detail-value'>{selected.email}</span></div>
                  <div className='detail-item'><span className='detail-label'>NIK KTP</span><span className='detail-value'>{selected.ktp_number || '-'}</span></div>
                  <div className='detail-item'><span className='detail-label'>Status Verifikasi</span><span className={'status-badge ' + getStatusClass(selected.status)}>{selected.status}</span></div>
                  
                  <div className='detail-item'><span className='detail-label'>Waktu Pendaftaran</span><span className='detail-value'>{new Date(selected.created_at).toLocaleString('id-ID')}</span></div>
                  
                  {selected.status !== 'Pending' && (
                    <div className='detail-item'>
                      <span className='detail-label'>Diproses Oleh & Waktu</span>
                      <span className='detail-value'>
                        {selected.processed_by || 'Admin'} <br/>
                        <span style={{color:'var(--gray-500)', fontSize:'12px'}}>{selected.processed_at ? new Date(selected.processed_at).toLocaleString('id-ID') : '-'}</span>
                      </span>
                    </div>
                  )}

                  {selected.notes && (
                    <div className='detail-item full'>
                      <span className='detail-label'>Catatan Pendaftar</span>
                      <div className='detail-value' style={{ background: '#fffbeb', padding: '12px', borderRadius: '8px', borderLeft: '4px solid #f59e0b', fontSize: '13px' }}>
                        {selected.notes}
                      </div>
                    </div>
                  )}

                  {selected.ktp_image_url && (
                    <div className='detail-item full' style={{ marginTop: '5px' }}>
                      <span className='detail-label'>Dokumen KTP</span>
                      <div style={{ background: 'var(--gray-50)', padding: '15px', borderRadius: '12px', border: '1px solid var(--gray-200)', textAlign: 'center', marginTop: '8px' }}>
                        {selected.ktp_image_url.match(/\.(jpeg|jpg|gif|png|webp)$/i) ? (
                          <img src={selected.ktp_image_url} alt="KTP" style={{ width: '100%', maxHeight: '300px', objectFit: 'contain', borderRadius: '8px' }} />
                        ) : (
                          <div style={{ padding: '20px' }}><span className='material-icons-round' style={{fontSize:'40px', color:'var(--gray-400)'}}>description</span><p>Dokumen File</p></div>
                        )}
                        <a href={selected.ktp_image_url} target='_blank' rel='noreferrer' className='open-file-btn' style={{ marginTop: '12px', display:'inline-flex', alignItems:'center', gap:'8px', textDecoration:'none', color:'var(--primary)', fontWeight:'bold', border:'1px solid var(--gray-200)', padding:'8px 16px', borderRadius:'8px' }}><span className='material-icons-round' style={{ fontSize: '18px' }}>open_in_new</span> Lihat Dokumen Penuh</a>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className='modal-footer'>
                <button className='btn-action reject' onClick={() => handleDelete(selected.id)} style={{background: 'transparent', color: 'var(--danger)', border: '1px solid var(--danger)', marginRight: 'auto'}}><span className='material-icons-round' style={{ fontSize: '18px' }}>delete</span> Hapus Data</button>
                
                {selected.status === 'Pending' ? (
                  <>
                    <button className='btn-action reject' onClick={() => handleVerifikasi(selected.id, 'Rejected')}><span className='material-icons-round' style={{ fontSize: '18px' }}>close</span> Tolak</button>
                    <button className='btn-action approve' onClick={() => handleVerifikasi(selected.id, 'Verified')}><span className='material-icons-round' style={{ fontSize: '18px' }}>check</span> Setujui</button>
                  </>
                ) : <div style={{ color: 'var(--gray-500)', fontSize: '14px', padding: '10px' }}>Status telah diproses.</div>}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}