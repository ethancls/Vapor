import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { useState, useEffect, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ChevronLeft } from 'lucide-react'
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import Instances from './pages/Instances'
import NewInstance from './pages/NewInstance'
import InstanceDetails from './pages/InstanceDetails'
import Snapshots from './pages/Snapshots'
import Updates from './pages/Updates'
import Networks from './pages/Networks'
import Images from './pages/Images'
import Aliases from './pages/Aliases'
import Settings from './pages/Settings'
import { Toaster } from 'sileo'
import { ThemeProvider } from './contexts/ThemeContext'

function NotFound() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      height: '100%', gap: 24, padding: 40,
    }}>
      <img src="/vapor.png" width={56} height={56} alt="Vapor" style={{ opacity: 0.5 }} />
      <div style={{ textAlign: 'center' }}>
        <p className="mono" style={{ fontSize: 48, fontWeight: 700, color: 'var(--text-secondary)', lineHeight: 1, marginBottom: 12 }}>404</p>
        <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>Page not found</p>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 28, maxWidth: 360 }}>
          This page doesn't exist. Head back to the dashboard to manage your Multipass VMs.
        </p>
        <a href="/dashboard" className="btn-accent" style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
          Back to Dashboard
        </a>
      </div>
    </div>
  )
}

function AppInner() {
  const navigate = useNavigate()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('sidebar-collapsed') === 'true' } catch { return false }
  })
  const qc = useQueryClient()
  const goNewInstance = useCallback(
    () => navigate('/instances/new', { state: { from: location.pathname } }),
    [navigate, location.pathname]
  )

  const toggleSidebar = useCallback(() => {
    setCollapsed(c => {
      const next = !c
      try { localStorage.setItem('sidebar-collapsed', String(next)) } catch {}
      return next
    })
  }, [])

  const currentPath = location.pathname
  const explicitFrom = typeof location.state?.from === 'string' ? location.state.from : null
  const fallbackFrom = (() => {
    if (currentPath === '/instances/new') return '/instances'
    if (currentPath.startsWith('/instances/')) return '/instances'
    return null
  })()
  const backTarget = explicitFrom && explicitFrom !== currentPath ? explicitFrom : fallbackFrom

  function routeLabel(pathname) {
    if (!pathname) return ''
    const path = pathname.split('?')[0].split('#')[0]
    if (path === '/dashboard') return 'Dashboard'
    if (path === '/instances') return 'Instances'
    if (path === '/instances/new') return 'New Instance'
    if (path.startsWith('/instances/')) return 'Instances'
    if (path === '/snapshots') return 'Snapshots'
    if (path === '/updates') return 'Updates'
    if (path === '/networks') return 'Networks'
    if (path === '/images') return 'Images'
    if (path === '/aliases') return 'Aliases'
    if (path === '/settings') return 'Settings'
    return 'Previous page'
  }

  // Global keyboard shortcuts
  useEffect(() => {
    const fn = (e) => {
      const tag = document.activeElement?.tagName
      if (tag === 'TEXTAREA') return
      if (tag === 'INPUT' && e.key !== 'k') return
      if (!(e.metaKey || e.ctrlKey)) return
      if (e.key === 'b') { e.preventDefault(); toggleSidebar() }
      else if (e.key === 'n') { e.preventDefault(); goNewInstance() }
      else if (e.key === 'r') { e.preventDefault(); qc.invalidateQueries() }
    }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [toggleSidebar, goNewInstance, qc])

  return (
    <div className="layout">
      <Sidebar
        onNewInstance={goNewInstance}
        collapsed={collapsed}
        onToggle={toggleSidebar}
      />

      <main className="main-content">
        {backTarget && (
          <div className="global-back-link-wrap" style={{ padding: '6px 32px 0', marginBottom: '-12px', transform: 'translateY(6px)' }}>
            <button
              onClick={() => navigate(backTarget)}
              style={{
                background: 'none',
                border: 'none',
                padding: '2px 0',
                height: 'auto',
                color: 'var(--accent)',
                fontWeight: 700,
                fontSize: 13,
                letterSpacing: '0.01em',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <ChevronLeft size={13} />
              Back to {routeLabel(backTarget)}
            </button>
          </div>
        )}
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard onNewInstance={goNewInstance} />} />
          <Route path="/instances" element={<Instances onNewInstance={goNewInstance} />} />
          <Route path="/instances/new" element={<NewInstance />} />
          <Route path="/instances/:name" element={<InstanceDetails />} />
          <Route path="/snapshots" element={<Snapshots />} />
          <Route path="/updates" element={<Updates />} />
          <Route path="/networks" element={<Networks />} />
          <Route path="/images" element={<Images />} />
          <Route path="/aliases" element={<Aliases />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AppInner />
      </BrowserRouter>
      <Toaster
        position="top-center"
        options={{
          fill: '#161616',
          roundness: 14,
          autopilot: { expand: 300, collapse: 2500 },
        }}
      />
    </ThemeProvider>
  )
}
