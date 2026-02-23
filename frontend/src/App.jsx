import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { useState, useEffect, useCallback } from 'react'
import { ChevronLeft, TriangleAlert } from 'lucide-react'
import Sidebar from './components/Sidebar'
import { useStats } from './hooks/useStats'
import Dashboard from './pages/Dashboard'
import Instances from './pages/Instances'
import NewInstance from './pages/NewInstance'
import InstanceDetails from './pages/InstanceDetails'
import Snapshots from './pages/Snapshots'
import Updates from './pages/Updates'
import Networks from './pages/Networks'
import Images from './pages/Images'
import Users from './pages/Users'
import Logs from './pages/Logs'
import Settings from './pages/Settings'
import LoginPage from './pages/LoginPage'
import { Toaster } from 'sileo'
import { ThemeProvider, useTheme } from './contexts/ThemeContext'
import { authMe, setOnUnauthorized } from './api/client'

function ThemedToaster() {
  const { theme } = useTheme()
  const isDark = theme === 'system'
    ? window.matchMedia('(prefers-color-scheme: dark)').matches
    : theme !== 'light'
  return (
    <Toaster
      position="top-center"
      options={isDark
        ? { fill: '#ffffff', roundness: 14, autopilot: { expand: 300, collapse: 2500 }, styles: { title: 'text-black!', description: 'text-black/70!' } }
        : { fill: '#171717', roundness: 14, autopilot: { expand: 300, collapse: 2500 }, styles: { title: 'text-white!', description: 'text-white/70!' } }
      }
    />
  )
}

function computeViewportGate() {
  if (typeof window === 'undefined') return { blocked: false, mobile: false, minDesktopWidth: 768 }
  const w = window.innerWidth || 0
  const coarse = window.matchMedia?.('(pointer: coarse)')?.matches ?? false
  const mobileUA = /Android|iPhone|iPad|iPod|Mobile/i.test(window.navigator?.userAgent || '')
  const minDesktopWidth = 768 // Tailwind md
  const mobile = coarse || mobileUA || w < minDesktopWidth
  const desktopTooSmall = !mobile && w < minDesktopWidth
  return { blocked: mobile || desktopTooSmall, mobile, minDesktopWidth }
}

function ViewportBlockedScreen({ mobile, minDesktopWidth }) {
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 99999,
      background: 'var(--bg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    }}>
      <div style={{
        width: 'min(560px, 100%)',
        border: '1px solid var(--border)',
        borderRadius: 18,
        background: 'var(--card-1)',
        padding: '28px 24px',
        textAlign: 'center',
      }}>
        <img src="/vapor.png" width={52} height={52} alt="Vapor" style={{ marginBottom: 14 }} />
        <p style={{ fontSize: 19, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8 }}>
          Unsupported screen
        </p>
        {mobile ? (
          <p className="mono" style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
            Use Vapor on desktop for the full experience.
          </p>
        ) : (
          <p className="mono" style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
            Agrandissez la fenêtre du navigateur (minimum {minDesktopWidth}px, environ la moitié de l&apos;écran).
          </p>
        )}
      </div>
    </div>
  )
}

function NotFound() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      height: '100%', gap: 24, padding: 40,
    }}>
      <img src="/vapor.png" width={56} height={56} alt="Vapor"/>
      <div style={{ textAlign: 'center' }}>
        <p className="mono" style={{ fontSize: 48, fontWeight: 700, color: 'var(--text-secondary)', lineHeight: 1, marginBottom: 12 }}>404</p>
        <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>Page not found</p>
        <a href="/dashboard" className="btn-accent" style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
          Back to Dashboard
        </a>
      </div>
    </div>
  )
}

function AppInner({ onLogout }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('sidebar-collapsed') === 'true' } catch { return false }
  })
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
    if (path === '/users') return 'Users'
    if (path === '/logs') return 'Activity'
    if (path === '/settings') return 'Settings'
    return 'Previous page'
  }

  // Document title
  useEffect(() => {
    const path = location.pathname.split('?')[0].split('#')[0]
    let label = ''
    if (path === '/' || path === '/dashboard') label = 'Dashboard'
    else if (path === '/instances') label = 'Instances'
    else if (path === '/instances/new') label = 'New Instance'
    else if (path.startsWith('/instances/')) label = decodeURIComponent(path.slice('/instances/'.length)) || 'Instance'
    else if (path === '/snapshots') label = 'Snapshots'
    else if (path === '/updates') label = 'Updates'
    else if (path === '/networks') label = 'Networks'
    else if (path === '/images') label = 'Images'
    else if (path === '/users') label = 'Users'
    else if (path === '/logs') label = 'Activity'
    else if (path === '/settings') label = 'Settings'
    document.title = label ? `Vapor | ${label}` : 'Vapor'
  }, [location.pathname])

  // Global keyboard shortcuts
  useEffect(() => {
    const fn = (e) => {
      const tag = document.activeElement?.tagName
      const key = (e.key || '').toLowerCase()
      const code = (e.code || '').toLowerCase()
      const shortcutKey = code.startsWith('key') ? code.slice(3) : key
      if (tag === 'TEXTAREA') return
      if (tag === 'INPUT' && shortcutKey !== 'k') return
      if (!(e.metaKey || e.ctrlKey)) return
      if (shortcutKey === 'b') { e.preventDefault(); toggleSidebar() }
      else if (shortcutKey === 'n') { e.preventDefault(); goNewInstance() }
      else if (shortcutKey === 'i') { e.preventDefault(); navigate('/instances', { state: { from: location.pathname } }) }
      else if (shortcutKey === 's') { e.preventDefault(); navigate('/snapshots', { state: { from: location.pathname } }) }
      else if (shortcutKey === 'u') { e.preventDefault(); navigate('/updates', { state: { from: location.pathname } }) }
    }
    document.addEventListener('keydown', fn, true)
    return () => document.removeEventListener('keydown', fn, true)
  }, [toggleSidebar, goNewInstance, navigate, location.pathname])

  const { data: stats, isError: statsError } = useStats()
  const daemonOk = !statsError && (stats?.daemon_running ?? true)

  return (
    <div className="layout">
      <Sidebar
        onNewInstance={goNewInstance}
        collapsed={collapsed}
        onToggle={toggleSidebar}
        onLogout={onLogout}
      />

      <main className="main-content">
        {!daemonOk && (
          <div style={{ padding: '16px 32px 0' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 16px',
              background: 'rgba(240,71,71,0.08)',
              border: '1px solid rgba(240,71,71,0.2)',
              borderRadius: 12,
              color: '#f06565',
              fontSize: 13, fontWeight: 600,
            }}>
              <TriangleAlert size={15} style={{ flexShrink: 0 }} />
              <span>Multipass daemon is not responding, please restart it</span>
            </div>
          </div>
        )}
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
          <Route path="/users" element={<Users />} />
          <Route path="/logs" element={<Logs />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </div>
  )
}

export default function App() {
  const [authState, setAuthState] = useState('loading') // 'loading' | 'authenticated' | 'unauthenticated'
  const [viewportGate, setViewportGate] = useState(() => computeViewportGate())

  useEffect(() => {
    const update = () => setViewportGate(computeViewportGate())
    update()
    window.addEventListener('resize', update)
    window.addEventListener('orientationchange', update)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('orientationchange', update)
    }
  }, [])

  useEffect(() => {
    authMe().then(user => {
      setAuthState(user ? 'authenticated' : 'unauthenticated')
    })
  }, [])

  useEffect(() => {
    setOnUnauthorized(() => setAuthState('unauthenticated'))
  }, [])

  if (authState === 'loading') {
    return (
      <ThemeProvider>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg)' }}>
          <div className="daemon-dot running" style={{ width: 10, height: 10 }} />
        </div>
      </ThemeProvider>
    )
  }

  if (viewportGate.blocked) {
    return (
      <ThemeProvider>
        <ViewportBlockedScreen mobile={viewportGate.mobile} minDesktopWidth={viewportGate.minDesktopWidth} />
      </ThemeProvider>
    )
  }

  if (authState === 'unauthenticated') {
    return (
      <ThemeProvider>
        <LoginPage onLogin={() => setAuthState('authenticated')} />
        <ThemedToaster />
      </ThemeProvider>
    )
  }

  return (
    <ThemeProvider>
      <BrowserRouter>
        <AppInner onLogout={() => setAuthState('unauthenticated')} />
      </BrowserRouter>
      <ThemedToaster />
    </ThemeProvider>
  )
}
