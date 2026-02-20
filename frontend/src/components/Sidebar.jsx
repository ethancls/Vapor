import { NavLink, useLocation } from 'react-router-dom'
import { LayoutDashboard, Server, Plus, Settings, Sun, Moon, Monitor, ChevronLeft, Camera, Network, Image, Command, ShieldCheck } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useStats } from '../hooks/useStats'
import { useTheme } from '../contexts/ThemeContext'
import { api } from '../api/client'
import CustomSelect from './CustomSelect'

const NAV = [
  { to: '/dashboard',    Icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/instances',    Icon: Server,          label: 'Instances', matchPaths: ['/instances', '/instances/new'], matchPrefix: '/instances/' },
  { to: '/snapshots',    Icon: Camera,          label: 'Snapshots' },
  { to: '/updates',      Icon: ShieldCheck,     label: 'Updates' },
  { to: '/networks',     Icon: Network,         label: 'Networks' },
  { to: '/images',       Icon: Image,           label: 'Images' },
  { to: '/aliases',      Icon: Command,         label: 'Aliases' },
  { to: '/settings',     Icon: Settings,        label: 'Settings' },
]

const THEME_OPTIONS = [
  { value: 'dark',   label: 'Dark'   },
  { value: 'light',  label: 'Light'  },
  { value: 'system', label: 'System' },
]

const THEME_ICONS = { dark: Moon, light: Sun, system: Monitor }
const THEME_CYCLE = { dark: 'light', light: 'system', system: 'dark' }

export default function Sidebar({ onNewInstance, collapsed, onToggle }) {
  const { data: stats } = useStats()
  const { theme, setTheme } = useTheme()
  const location = useLocation()
  const pathname = location.pathname
  const { data: versionData } = useQuery({
    queryKey: ['version'],
    queryFn: () => api.getVersion(),
    staleTime: Infinity,
    retry: false,
  })
  const daemonOk = stats?.daemon_running ?? true
  const ThemeIcon = THEME_ICONS[theme]

  const version = (() => {
    const v = versionData?.version
    if (!v) return null
    if (typeof v === 'string') {
      const m = v.match(/multipass\s+([\d.]+)/i)
      return m ? m[1] : v.split('\n')[0].trim()
    }
    return v?.multipass || v?.multipassd || null
  })()

  return (
    <aside
      className={`sidebar${collapsed ? ' collapsed' : ''}`}
      style={{
        background: 'var(--card-1)',
        borderRight: '1px solid var(--border)',
        borderRadius: '0 20px 20px 0',
        display: 'flex', flexDirection: 'column',
        height: '100vh', padding: collapsed ? '18px 12px' : '18px 16px',
        transition: 'padding 0.38s cubic-bezier(0.4,0,0.2,1)',
      }}
    >
      {/* ── Logo row ── */}
      <div style={{
        display: 'flex', alignItems: 'center',
        marginBottom: 26,
      }}>
        <div
          className="logo-row"
          onClick={collapsed ? onToggle : undefined}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            overflow: 'hidden',
            transition: 'gap 0.38s cubic-bezier(0.4,0,0.2,1)',
            cursor: collapsed ? 'pointer' : 'default',
          }}
        >
          <img
            src="/vapor.png"
            width={40} height={40}
            alt="Vapor"
            style={{ imageRendering: 'auto', flexShrink: 0, display: 'block' }}
          />
          <span className="sidebar-label" style={{
            fontFamily: 'Syne', fontWeight: 800, fontSize: 22,
            letterSpacing: '-0.6px', lineHeight: 1,
            color: 'var(--text-primary)',
          }}>Vapor</span>
        </div>

        {!collapsed && (
          <button
            onClick={onToggle}
            title="Collapse sidebar (⌘B)"
            className=""
            style={{
              marginLeft: 'auto',
              background: 'none', border: 'none', padding: '3px',
              cursor: 'pointer', display: 'flex', alignItems: 'center',
              flexShrink: 0, borderRadius: 6, opacity: 0.65,
              transition: 'opacity 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.opacity = '1'}
            onMouseLeave={e => e.currentTarget.style.opacity = '0.65'}
          >
            <ChevronLeft size={22} color="var(--accent)" strokeWidth={3} />
          </button>
        )}
      </div>

      {!collapsed && (
        <p className="section-label" style={{ padding: '0 6px', marginBottom: 8 }}>Navigation</p>
      )}

      <nav style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {NAV.map(({ to, Icon, label, matchPaths, matchPrefix }) => {
          const isActive = (matchPaths && matchPaths.includes(pathname)) || (matchPrefix && pathname.startsWith(matchPrefix)) || pathname === to
          return (
            <NavLink
              key={to}
              to={to}
              state={{ from: pathname }}
              title={collapsed ? label : undefined}
              className={() => `nav-item${isActive ? ' active' : ''}`}
            >
              <Icon size={16} style={{ flexShrink: 0 }} />
              <span className="sidebar-label">{label}</span>
            </NavLink>
          )
        })}
      </nav>

      <div style={{ flex: 1 }} />

      {/* New instance */}
      {collapsed ? (
        <button
          onClick={onNewInstance}
          title="New Instance"
          className=""
          style={{
            background: 'var(--accent)', border: 'none', borderRadius: 10,
            padding: '10px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 8, transition: 'opacity 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.opacity = '0.82'}
          onMouseLeave={e => e.currentTarget.style.opacity = '1'}
        >
          <Plus size={16} color="#0a0a0a" />
        </button>
      ) : (
        <button
          className="btn-accent"
          style={{ width: '100%', justifyContent: 'center', marginBottom: 8 }}
          onClick={onNewInstance}
        >
          <Plus size={13} /> New Instance
        </button>
      )}

      {/* Theme — CustomSelect expanded, icon-cycle collapsed */}
      <div style={{ marginBottom: 8 }}>
        {collapsed ? (
          <button
            onClick={() => setTheme(THEME_CYCLE[theme])}
            title={`Theme: ${theme}`}
            className=""
            style={{
              width: '100%', background: 'var(--card-2)', border: '1px solid var(--border)',
              borderRadius: 'var(--r-sm)', padding: '9px',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-secondary)', transition: 'color 0.15s, border-color 0.15s, background 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.color='var(--text-primary)'; e.currentTarget.style.borderColor='var(--border-hover)'; e.currentTarget.style.background='var(--card-3)' }}
            onMouseLeave={e => { e.currentTarget.style.color='var(--text-secondary)'; e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.background='var(--card-2)' }}
          >
            <ThemeIcon size={14} />
          </button>
        ) : (
          <CustomSelect
            value={theme}
            onChange={setTheme}
            options={THEME_OPTIONS}
            dropUp
          />
        )}
      </div>

      {/* Daemon dot + version */}
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '4px 0', overflow: 'hidden',
          justifyContent: 'center',
        }}
        title={`multipass ${daemonOk ? 'running' : 'offline'}${version ? ` v${version}` : ''}`}
      >
        <div className={`daemon-dot ${daemonOk ? 'running' : 'offline'}`} style={{ flexShrink: 0 }} />
        {version && (
          <span className="mono sidebar-label" style={{ fontSize: 10.5, color: 'var(--text-muted)', lineHeight: 1, whiteSpace: 'nowrap' }}>
            v{version}
          </span>
        )}
      </div>
    </aside>
  )
}
