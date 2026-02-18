import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import Instances from './pages/Instances'
import Settings from './pages/Settings'
import NewInstanceModal from './components/NewInstanceModal'
import { ToastProvider } from './components/Toast'
import { ThemeProvider } from './contexts/ThemeContext'

function AppInner() {
  const [showModal, setShowModal] = useState(false)
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('sidebar-collapsed') === 'true' } catch { return false }
  })
  const qc = useQueryClient()

  const toggleSidebar = useCallback(() => {
    setCollapsed(c => {
      const next = !c
      try { localStorage.setItem('sidebar-collapsed', String(next)) } catch {}
      return next
    })
  }, [])

  // Global keyboard shortcuts
  useEffect(() => {
    const fn = (e) => {
      const tag = document.activeElement?.tagName
      if (tag === 'TEXTAREA') return
      if (tag === 'INPUT' && e.key !== 'k') return // allow Cmd+K from inputs
      if (!(e.metaKey || e.ctrlKey)) return
      if (e.key === 'b') { e.preventDefault(); toggleSidebar() }
      else if (e.key === 'n') { e.preventDefault(); setShowModal(true) }
      else if (e.key === 'r') { e.preventDefault(); qc.invalidateQueries() }
    }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [toggleSidebar, qc])

  return (
    <div className="layout">
      <Sidebar
        onNewInstance={() => setShowModal(true)}
        collapsed={collapsed}
        onToggle={toggleSidebar}
      />
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard onNewInstance={() => setShowModal(true)} />} />
          <Route path="/instances" element={<Instances onNewInstance={() => setShowModal(true)} />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>
      {showModal && <NewInstanceModal onClose={() => setShowModal(false)} />}
    </div>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <BrowserRouter>
          <AppInner />
        </BrowserRouter>
      </ToastProvider>
    </ThemeProvider>
  )
}
