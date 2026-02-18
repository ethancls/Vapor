import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Server, Plus, ChevronLeft, ChevronRight, Waves, Settings, Sun, Moon, Monitor } from 'lucide-react'
import { useStats } from '../hooks/useStats'
import { useTheme } from '../contexts/ThemeContext'

const NAV = [
  { to: '/dashboard', Icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/instances',  Icon: Server,          label: 'Instances' },
  { to: '/settings',   Icon: Settings,        label: 'Settings' },
]

const THEME_CYCLE = { dark: 'light', light: 'system', system: 'dark' }
const THEME_ICONS = { dark: Moon, light: Sun, system: Monitor }

function ThemeToggle({ collapsed }) {
  const { theme, setTheme } = useTheme()
  const Icon = THEME_ICONS[theme]
  return (
    <button
      onClick={() => setTheme(THEME_CYCLE[theme])}
      title={`Theme: ${theme} — click to cycle`}
      style={{
        display: 'flex', alignItems: 'center', gap: 9,
        padding: collapsed ? '9px' : '9px 12px',
        borderRadius: 10, border: '1px solid var(--border)',
        background: 'var(--card-2)', cursor: 'pointer',
        color: 'var(--text-secondary)', marginBottom: 8,
        justifyContent: collapsed ? 'center' : undefined,
        transition: 'color 0.15s, border-color 0.15s, background 0.15s',
        overflow: 'hidden',
      }}
      onMouseEnter={e => { e.currentTarget.style.color='var(--text-primary)'; e.currentTarget.style.borderColor='var(--border-hover)'; e.currentTarget.style.background='var(--card-3)' }}
      onMouseLeave={e => { e.currentTarget.style.color='var(--text-secondary)'; e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.background='var(--card-2)' }}
    >
      <Icon size={14} style={{ flexShrink: 0 }} />
      <span className="mono sidebar-label" style={{ fontSize: 11.5, lineHeight: 1, whiteSpace: 'nowrap' }}>
        {theme.charAt(0).toUpperCase() + theme.slice(1)}
      </span>
    </button>
  )
}

export default function Sidebar({ onNewInstance, collapsed, onToggle }) {
  const { data: stats } = useStats()
  const daemonOk = stats?.daemon_running ?? true

  return (
    <aside
      className={`sidebar${collapsed ? ' collapsed' : ''}`}
      style={{
        background: 'var(--card-1)',
        borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column',
        height: '100vh', padding: '18px 12px',
      }}
    >
      {/* Logo row */}
      <div style={{
        display: 'flex', alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'space-between',
        marginBottom: 26, paddingLeft: collapsed ? 0 : 2,
        overflow: 'hidden',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 12, flexShrink: 0,
            background: 'rgba(181,242,61,0.1)',
            border: '1px solid rgba(181,242,61,0.28)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 12px rgba(181,242,61,0.18)',
          }}>
            <img src="/vapor.png" width={22} height={22} alt="Vapor" style={{ imageRendering: 'auto' }} />
          </div>

          <span className="sidebar-label" style={{
            fontFamily: 'Syne', fontWeight: 800, fontSize: 20,
            letterSpacing: '-0.5px', lineHeight: 1,
            color: 'var(--text-primary)',
          }}>Vapor</span>
        </div>

        {!collapsed && (
          <button
            onClick={onToggle}
            title="Collapse sidebar"
            style={{
              background: 'var(--card-2)', border: '1px solid var(--border)',
              borderRadius: 7, padding: '4px 5px', cursor: 'pointer',
              color: 'var(--text-muted)', display: 'flex', alignItems: 'center',
              transition: 'color 0.15s, border-color 0.15s, background 0.15s', flexShrink: 0,
            }}
            onMouseEnter={e => { e.currentTarget.style.color='var(--text-primary)'; e.currentTarget.style.borderColor='var(--border-hover)'; e.currentTarget.style.background='var(--card-3)' }}
            onMouseLeave={e => { e.currentTarget.style.color='var(--text-muted)'; e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.background='var(--card-2)' }}
          >
            <ChevronLeft size={14} />
          </button>
        )}
      </div>

      {/* Expand button (collapsed only) */}
      {collapsed && (
        <button
          onClick={onToggle}
          title="Expand sidebar"
          style={{
            background: 'var(--card-2)', border: '1px solid var(--border)',
            borderRadius: 9, padding: '7px', cursor: 'pointer',
            color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 16, transition: 'color 0.15s, border-color 0.15s, background 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.color='var(--text-primary)'; e.currentTarget.style.borderColor='var(--border-hover)'; e.currentTarget.style.background='var(--card-3)' }}
          onMouseLeave={e => { e.currentTarget.style.color='var(--text-muted)'; e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.background='var(--card-2)' }}
        >
          <ChevronRight size={14} />
        </button>
      )}

      {!collapsed && <p className="section-label" style={{ padding: '0 4px', marginBottom: 8 }}>Navigation</p>}

      <nav style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {NAV.map(({ to, Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            title={collapsed ? label : undefined}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            style={{ justifyContent: collapsed ? 'center' : undefined }}
          >
            <Icon size={16} style={{ flexShrink: 0 }} />
            <span className="sidebar-label">{label}</span>
          </NavLink>
        ))}
      </nav>

      <div style={{ flex: 1 }} />

      {/* New instance */}
      {collapsed ? (
        <button
          onClick={onNewInstance}
          title="New Instance"
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

      {/* Theme toggle */}
      <ThemeToggle collapsed={collapsed} />

      {/* Daemon dot */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 9,
        padding: collapsed ? '10px' : '10px 12px',
        borderRadius: 11, background: 'var(--card-2)', border: '1px solid var(--border)',
        justifyContent: collapsed ? 'center' : undefined,
        overflow: 'hidden',
      }}
        title={collapsed ? `multipass ${daemonOk ? 'running' : 'offline'}` : undefined}
      >
        <div className={`daemon-dot ${daemonOk ? 'running' : 'offline'}`} />
        <span className="mono sidebar-label" style={{ fontSize: 11.5, color: 'var(--text-secondary)', lineHeight: 1 }}>
          multipass {daemonOk ? 'running' : 'offline'}
        </span>
      </div>
    </aside>
  )
}
