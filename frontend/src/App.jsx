import { BrowserRouter, Routes, Route, Navigate, Link, useNavigate, useLocation } from 'react-router-dom'
import { useState, useEffect, useCallback } from 'react'
import { ChevronLeft, TriangleAlert } from 'lucide-react'
import Sidebar from './components/Sidebar'
import MobileTopbar from './components/MobileTopbar'
import MobileNavDrawer from './components/MobileNavDrawer'
import GuidedTour from './components/GuidedTour'
import { useStats } from './hooks/useStats'
import useMediaQuery from './hooks/useMediaQuery'
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
import { ThemeProvider } from './contexts/ThemeContext'
import { useTheme } from './contexts/useTheme'
import { authMe, setOnUnauthorized } from './api/client'

function routeTitle(pathname) {
  if (!pathname) return ''
  const path = pathname.split('?')[0].split('#')[0]
  if (path === '/dashboard' || path === '/') return 'Dashboard'
  if (path === '/instances') return 'Instances'
  if (path === '/instances/new') return 'New Instance'
  if (path.startsWith('/instances/')) return decodeURIComponent(path.slice('/instances/'.length)) || 'Instance'
  if (path === '/snapshots') return 'Snapshots'
  if (path === '/updates') return 'Updates'
  if (path === '/networks') return 'Networks'
  if (path === '/images') return 'Images'
  if (path === '/users') return 'Users'
  if (path === '/logs') return 'Activity'
  if (path === '/settings') return 'Settings'
  return ''
}

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
        <Link to="/dashboard" className="btn-accent" style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
          Back to Dashboard
        </Link>
      </div>
    </div>
  )
}

function AppInner({ onLogout }) {
  const navigate = useNavigate()
  const location = useLocation()
  const isMobile = useMediaQuery('(max-width: 780px), ((pointer: coarse) and (max-height: 520px))')
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('sidebar-collapsed') === 'true' } catch (err) { void err; return false }
  })
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const goNewInstance = useCallback(
    () => navigate('/instances/new', { state: { from: location.pathname } }),
    [navigate, location.pathname]
  )

  const toggleSidebar = useCallback(() => {
    if (isMobile) return
    setCollapsed(c => {
      const next = !c
      try { localStorage.setItem('sidebar-collapsed', String(next)) } catch (err) { void err }
      return next
    })
  }, [isMobile])

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

  const pageTitle = routeTitle(location.pathname)

  // Document title
  useEffect(() => {
    document.title = pageTitle ? `Vapor | ${pageTitle}` : 'Vapor'
  }, [pageTitle])

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
      else if (shortcutKey === 'd') { e.preventDefault(); navigate('/dashboard', { state: { from: location.pathname } }) }
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
  const sidebarCollapsed = !isMobile && collapsed
  return (
    <>
      <a href="#main-content" className="skip-link">Skip to Main Content</a>
      <div className={`layout${isMobile ? ' layout-mobile' : ''}`}>
      {!isMobile ? (
        <Sidebar
          onNewInstance={goNewInstance}
          collapsed={sidebarCollapsed}
          onToggle={toggleSidebar}
          onLogout={onLogout}
        />
      ) : (
        <>
          <MobileTopbar
            navOpen={mobileNavOpen}
            onToggleNav={() => setMobileNavOpen((prev) => !prev)}
            onNewInstance={goNewInstance}
            title={pageTitle || 'Vapor'}
            backLabel={backTarget ? routeLabel(backTarget) : ''}
            onBack={backTarget ? () => navigate(backTarget, { state: { from: location.pathname } }) : null}
          />
          <MobileNavDrawer
            open={mobileNavOpen}
            onClose={() => setMobileNavOpen(false)}
          >
            <Sidebar
              onNewInstance={goNewInstance}
              collapsed={false}
              onToggle={() => {}}
              onLogout={onLogout}
              isMobile
              disableCollapse
              onNavigate={() => setMobileNavOpen(false)}
            />
          </MobileNavDrawer>
        </>
      )}

      <main id="main-content" className={`main-content${isMobile ? ' main-content-mobile' : ''}`}>
        {!daemonOk && (
          <div className="daemon-alert-wrap">
            <div className="daemon-alert">
              <TriangleAlert size={15} className="daemon-alert-icon" />
              <span>Multipass daemon is not responding, please restart it</span>
            </div>
          </div>
        )}
        {backTarget && !isMobile && (
          <div className="global-back-link-wrap">
            <Link
              to={backTarget}
              state={{ from: location.pathname }}
              className="global-back-link"
            >
              <ChevronLeft size={17} />
              Back to {routeLabel(backTarget)}
            </Link>
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
      <GuidedTour isMobile={isMobile} setMobileNavOpen={setMobileNavOpen} />
      </div>
    </>
  )
}

export default function App() {
  const [authState, setAuthState] = useState('loading') // 'loading' | 'authenticated' | 'unauthenticated'

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
