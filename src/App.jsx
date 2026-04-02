import { useState, createContext } from 'react'
import FormPage from './FormPage'
import AdminPage from './AdminPage'
import './index.css'

export const AppContext = createContext()

function App() {
  const [currentPage, setCurrentPage] = useState('form')

  const navigate = (page) => setCurrentPage(page)

  return (
    <AppContext.Provider value={{ page: currentPage, navigate }}>
      <div>
        {currentPage === 'form' ? (
          <FormPage />
        ) : (
          <AdminPage />
        )}
      </div>
    </AppContext.Provider>
  )
}

export default App