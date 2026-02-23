import { NavLink, useLocation } from 'react-router-dom'
import { useMemo, useState } from 'react'
import { version as APP_VERSION } from '../../package.json'
import { Boxes, Plus, Sun, Moon, Monitor, ChevronLeft, Files, EthernetPort, CircleFadingArrowUp, Check, LogOut, Settings, Users, History, Layers2, LayoutGrid, Lock } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useTheme } from '../contexts/ThemeContext'
import { api, authLogout } from '../api/client'
import ForbiddenActionModal from './ForbiddenActionModal'
import { canAccessUsers, normalizeRole } from '../utils/rbac'

const NAV = [
  { group: null,        to: '/dashboard', Icon: LayoutGrid, label: 'Dashboard' },
  { group: 'Compute',   to: '/instances', Icon: Boxes, label: 'Instances', matchPaths: ['/instances', '/instances/new'], matchPrefix: '/instances/' },
  { group: 'Compute',   to: '/snapshots', Icon: Files, label: 'Snapshots' },
  { group: 'Compute',   to: '/updates',   Icon: CircleFadingArrowUp, label: 'Updates' },
  { group: 'Resources', to: '/networks',  Icon: EthernetPort, label: 'Networks' },
  { group: 'Resources', to: '/images',    Icon: Layers2, label: 'Images' },
  { group: 'System',    to: '/users',     Icon: Users, label: 'Users' },
  { group: 'System',    to: '/logs',      Icon: History, label: 'Logs' },
  { group: 'System',    to: '/settings',  Icon: Settings, label: 'Settings' },
]

const THEME_OPTIONS = [
  { value: 'dark', label: 'Dark', Icon: Moon },
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'system', label: 'System', Icon: Monitor },
]
const THEME_ORDER = ['dark', 'light', 'system']

function canAccessNavItem(role, to) {
  if (to === '/users') return canAccessUsers(role)
  return true
}

function SidebarAvatar({ user, size = 30 }) {
  const [failed, setFailed] = useState(false)
  const avatar = user?.avatar_url || ''

  const fallback = String(user?.name || user?.login || '?').trim().charAt(0).toUpperCase() || '?'

  return (
    <span style={{
      width: size,
      height: size,
      borderRadius: 999,
      overflow: 'hidden',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--card-3)',
      border: '1px solid var(--border)',
      flexShrink: 0,
    }}>
      {avatar && !failed ? (
        <img
          src={avatar}
          alt={user?.login || 'avatar'}
          width={size}
          height={size}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="mono" style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary)', lineHeight: 1 }}>
          {fallback}
        </span>
      )}
    </span>
  )
}

export default function Sidebar({ onNewInstance, collapsed, onToggle, onLogout }) {
  const { theme, setTheme } = useTheme()
  const location = useLocation()
  const pathname = location.pathname

  const { data: updatesData } = useQuery({
    queryKey: ['updates'],
    queryFn: () => api.getUpdates(),
    refetchInterval: 120000,
    staleTime: 60000,
    retry: false,
  })
  const updatesItems    = updatesData?.updates || []
  const outdatedCount   = updatesItems.filter(u => (u.upgradable || 0) > 0).length
  const allCheckedAndOk = updatesItems.length > 0
    && updatesItems.every(u => u.checked)
    && outdatedCount === 0
  const { data: meData } = useQuery({
    queryKey: ['current-user'],
    queryFn: () => api.getCurrentUser(),
    staleTime: 60000,
    retry: false,
  })
  const me = meData?.user || null
  const [forbiddenNav, setForbiddenNav] = useState(null)
  const currentRole = normalizeRole(me?.role)

  const accountName = me?.name || me?.login || 'Account'
  const accountLogin = me?.login || 'local'

  async function handleSignOut() {
    try {
      await authLogout()
    } finally {
      onLogout?.()
    }
  }

  const activeTheme = useMemo(
    () => THEME_OPTIONS.find((option) => option.value === theme) || THEME_OPTIONS[0],
    [theme],
  )
  const navEntries = useMemo(
    () => NAV.map((item) => ({ ...item, allowed: canAccessNavItem(currentRole, item.to) })),
    [currentRole],
  )

  function cycleTheme() {
    const currentIndex = THEME_ORDER.indexOf(theme)
    const nextTheme = THEME_ORDER[(currentIndex + 1) % THEME_ORDER.length]
    setTheme(nextTheme)
  }

  return (
    <aside
      className={`sidebar${collapsed ? ' collapsed' : ''}`}
      style={{
        background: 'var(--card-1)',
        borderRight: '1px solid var(--border)',
        borderRadius: '0 20px 20px 0',
        display: 'flex', flexDirection: 'column',
        height: '100vh', padding: collapsed ? '18px 12px' : '18px 16px',
        transition: 'padding var(--sidebar-anim-duration) var(--sidebar-anim-ease)',
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
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (collapsed && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onToggle() } }}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            overflow: 'hidden',
            cursor: collapsed ? 'pointer' : 'default',
          }}
        >
          <img
            src="/vapor.png"
            width={40} height={40}
            alt="Vapor"
            style={{
              imageRendering: 'auto',
              display: 'block',
              flex: '0 0 40px',
              width: 40,
              height: 40,
              minWidth: 40,
              minHeight: 40,
              maxWidth: 'none',
              objectFit: 'contain',
            }}
          />
          <div className="sidebar-label" style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
            <span style={{
              display: 'block',
              fontFamily: 'Syne', fontWeight: 800, fontSize: 22,
              letterSpacing: '-0.6px', lineHeight: 1,
              color: 'var(--text-primary)',
            }}>Vapor</span>
            <span className="mono" style={{ display: 'block', width: '100%', textAlign: 'right', fontSize: 10, color: '#ffffff', lineHeight: 1.5 }}>v{APP_VERSION}</span>
          </div>
        </div>

        {!collapsed && (
          <button
            type="button"
            aria-label="Collapse sidebar (⌘B)"
            title="Collapse sidebar (⌘B)"
            onClick={onToggle}
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

      <nav style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {navEntries.map((item, idx) => {
          const { group, to, label, matchPaths, matchPrefix, allowed } = item
          const isActive = (matchPaths && matchPaths.includes(pathname)) || (matchPrefix && pathname.startsWith(matchPrefix)) || pathname === to
          const prevGroup = idx > 0 ? navEntries[idx - 1].group : null
          const startsGroup = !!group && group !== prevGroup
          return (
            <div key={to} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {!collapsed && startsGroup && (
                <p className="section-label" style={{ padding: '8px 10px 2px', margin: 0, opacity: 0.78 }}>
                  {group}
                </p>
              )}
              {collapsed && startsGroup && (
                <div
                  aria-hidden="true"
                  style={{
                    height: 18,
                    padding: '0 8px',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <span style={{ width: '100%', borderTop: '1px dashed var(--border)' }} />
                </div>
              )}
              {allowed ? (
                <NavLink
                  to={to}
                  state={{ from: pathname }}
                  title={collapsed ? label : undefined}
                  className={() => `nav-item${isActive ? ' active' : ''}`}
                >
                  {/* Icon — with dot badge when collapsed and updates pending */}
                  <span style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
                    <item.Icon size={22} />
                    {to === '/updates' && collapsed && outdatedCount > 0 && (
                      <span style={{
                        position: 'absolute', top: -3, right: -4,
                        width: 10, height: 10, borderRadius: '50%',
                        background: '#22d3ee',
                        border: '2px solid var(--card-1)',
                      }} />
                    )}
                  </span>

                  {/* Label — with count or check badge when expanded */}
                  <span className="sidebar-label" style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
                    {label}
                    {to === '/updates' && !collapsed && outdatedCount > 0 && (
                      <span style={{
                        marginLeft: 'auto',
                        flexShrink: 0,
                        color: '#22d3ee',
                        fontSize: 11.5,
                        fontWeight: 700,
                        fontFamily: 'IBM Plex Mono',
                        lineHeight: 1,
                      }}>
                        {outdatedCount}
                      </span>
                    )}
                    {to === '/updates' && !collapsed && allCheckedAndOk && (
                      <Check size={11} style={{ marginLeft: 'auto', flexShrink: 0, color: 'var(--running)' }} />
                    )}
                  </span>
                </NavLink>
              ) : (
                <button
                  type="button"
                  title={collapsed ? `${label} (Restricted)` : undefined}
                  className="nav-item nav-item-locked"
                  onClick={() => setForbiddenNav({
                    title: 'Action Not Permitted',
                    description: `Your role does not allow access to ${label}.`,
                  })}
                >
                  <span style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
                    <item.Icon size={22} />
                  </span>
                  <span className="sidebar-label" style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
                    {label}
                    {!collapsed && <Lock size={11} style={{ marginLeft: 'auto', flexShrink: 0 }} />}
                  </span>
                </button>
              )}
            </div>
          )
        })}
      </nav>

      <div style={{ flex: 1 }} />

      {/* New instance */}
      {collapsed ? (
          <button
            type="button"
            aria-label="New Instance"
            title="New Instance"
          onClick={onNewInstance}
          className=""
          style={{
            background: 'var(--accent-fill)', border: 'none', borderRadius: 10,
            width: '100%',
            height: 40,
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 8,
          }}
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

      {/* Theme */}
      <div style={{ marginBottom: 8 }}>
        <button
          type="button"
          aria-label="Switch theme"
          title={`Theme: ${activeTheme.label}`}
          className={`sidebar-theme-cycle${collapsed ? ' is-collapsed' : ''}`}
          onClick={cycleTheme}
        >
          <span className="sidebar-theme-cycle-icon">
            <activeTheme.Icon size={16} />
          </span>
          {!collapsed && (
            <span className="mono sidebar-theme-cycle-label">
              {activeTheme.label}
            </span>
          )}
        </button>
      </div>

      {/* Account */}
      <div style={{ marginBottom: 8 }}>
        <button
          type="button"
          aria-label="Sign out"
          title="Sign out"
          onClick={handleSignOut}
          className={`sidebar-account-signout${collapsed ? ' is-collapsed' : ''}`}
        >
          <SidebarAvatar key={me?.avatar_url || ''} user={me} size={28} />
          {!collapsed && (
            <>
              <div className="sidebar-account-meta">
                <p className="sidebar-account-name">{accountName}</p>
                <p className="mono sidebar-account-login">
                  @{accountLogin}
                </p>
              </div>
              <LogOut size={17} />
            </>
          )}
        </button>
      </div>

      {forbiddenNav && (
        <ForbiddenActionModal
          title={forbiddenNav.title}
          description={forbiddenNav.description}
          onClose={() => setForbiddenNav(null)}
        />
      )}

    </aside>
  )
}
