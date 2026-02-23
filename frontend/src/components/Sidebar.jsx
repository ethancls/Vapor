import { NavLink, useLocation } from 'react-router-dom'
import { useMemo, useState } from 'react'
import { version as APP_VERSION } from '../../package.json'
import { Boxes, Plus, Sun, Moon, Monitor, ChevronLeft, Files, EthernetPort, CircleFadingArrowUp, Check, LogOut, Settings, Users, History, Layers2, LayoutGrid, Lock, Github } from 'lucide-react'
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
      className={`sidebar sidebar-shell${collapsed ? ' collapsed' : ''}`}
    >
      {/* ── Logo row ── */}
      <div className="sidebar-header">
        <div
          className={`sidebar-brand${collapsed ? ' is-collapsed' : ''}`}
          onClick={collapsed ? onToggle : undefined}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (collapsed && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onToggle() } }}
        >
          <img
            src="/vapor.png"
            width={40} height={40}
            alt="Vapor"
            className="sidebar-brand-logo"
          />
          <div className="sidebar-brand-copy sidebar-label">
            <span className="sidebar-brand-title">Vapor</span>
          </div>
        </div>

        {!collapsed && (
          <button
            type="button"
            aria-label="Collapse sidebar (⌘B)"
            title="Collapse sidebar (⌘B)"
            onClick={onToggle}
            className="sidebar-collapse-toggle"
          >
            <ChevronLeft size={22} color="var(--accent)" strokeWidth={3} />
          </button>
        )}
      </div>

      <nav className="sidebar-nav">
        {navEntries.map((item, idx) => {
          const { group, to, label, matchPaths, matchPrefix, allowed } = item
          const isActive = (matchPaths && matchPaths.includes(pathname)) || (matchPrefix && pathname.startsWith(matchPrefix)) || pathname === to
          const prevGroup = idx > 0 ? navEntries[idx - 1].group : null
          const startsGroup = !!group && group !== prevGroup
          return (
            <div key={to} className="sidebar-nav-section">
              {!collapsed && startsGroup && (
                <p className="section-label sidebar-group-label">
                  {group}
                </p>
              )}
              {collapsed && startsGroup && (
                <div aria-hidden="true" className="sidebar-group-divider">
                  <span className="sidebar-group-divider-line" />
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
                  <span className="sidebar-nav-icon-wrap">
                    <item.Icon size={22} />
                    {to === '/updates' && collapsed && outdatedCount > 0 && (
                      <span className="sidebar-nav-updates-dot" />
                    )}
                  </span>

                  {/* Label — with count or check badge when expanded */}
                  <span className="sidebar-label sidebar-nav-label">
                    {label}
                    {to === '/updates' && !collapsed && outdatedCount > 0 && (
                      <span className="sidebar-nav-updates-count mono">
                        {outdatedCount}
                      </span>
                    )}
                    {to === '/updates' && !collapsed && allCheckedAndOk && (
                      <Check size={11} className="sidebar-nav-updates-check" />
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
                  <span className="sidebar-nav-icon-wrap">
                    <item.Icon size={22} />
                  </span>
                  <span className="sidebar-label sidebar-nav-label">
                    {label}
                    {!collapsed && <Lock size={11} className="sidebar-nav-lock" />}
                  </span>
                </button>
              )}
            </div>
          )
        })}
      </nav>

      <div className="sidebar-fill" />

      {/* New instance */}
      {collapsed ? (
        <button
          type="button"
          aria-label="New Instance"
          title="New Instance"
          onClick={onNewInstance}
          className="sidebar-new-instance-button"
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
      <div className={`sidebar-footer${collapsed ? ' is-collapsed' : ''}`}>
        {!collapsed ? (
          <div className="sidebar-theme-picker" role="group" aria-label="Theme">
            {THEME_OPTIONS.map((option) => {
              const isActive = theme === option.value
              const Icon = option.Icon
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setTheme(option.value)}
                  className={`sidebar-theme-picker-option${isActive ? ' is-active' : ''}`}
                  aria-label={`Set ${option.label} theme`}
                  aria-pressed={isActive}
                >
                  <Icon size={16} />
                </button>
              )
            })}
          </div>
        ) : (
          <button
            type="button"
            aria-label="Switch theme"
            title={`Theme: ${activeTheme.label}`}
            className="sidebar-theme-cycle is-collapsed"
            onClick={cycleTheme}
          >
            <span className="sidebar-theme-cycle-icon">
              <activeTheme.Icon size={18} />
            </span>
          </button>
        )}

        {!collapsed ? (
          <div className="sidebar-user-row">
            <SidebarAvatar key={me?.avatar_url || ''} user={me} size={34} />
            <div className="sidebar-user-meta">
              <p className="sidebar-user-name">{accountName}</p>
              <p className="mono sidebar-user-login">
                @{accountLogin}
              </p>
            </div>
            <button
              type="button"
              aria-label="Sign out"
              title="Sign out"
              onClick={handleSignOut}
              className="sidebar-logout-button"
            >
              <LogOut size={18} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            aria-label="Sign out"
            title="Sign out"
            onClick={handleSignOut}
            className="sidebar-footer-action-button sidebar-footer-action-button-danger"
          >
            <LogOut size={18} />
          </button>
        )}

        {!collapsed && (
          <div className="sidebar-footer-version-row">
            <p className="mono sidebar-footer-version-text">
              v{APP_VERSION}
            </p>
            <a
              className="sidebar-footer-github-link"
              href="https://github.com/ethancls/Vapor"
              target="_blank"
              rel="noreferrer"
              aria-label="Open Vapor GitHub repository"
              title="GitHub"
            >
              <Github size={14} />
            </a>
          </div>
        )}
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
