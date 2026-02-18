import { Sun, Moon, Monitor, Check } from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'

const THEMES = [
  { value: 'dark',   label: 'Dark',   Icon: Moon,    desc: 'Dark background, easy on the eyes' },
  { value: 'light',  label: 'Light',  Icon: Sun,     desc: 'Light background, bright environment' },
  { value: 'system', label: 'System', Icon: Monitor, desc: 'Follows your OS preference' },
]

const SHORTCUTS = [
  { keys: ['⌘', 'K'], label: 'Open search' },
  { keys: ['⌘', 'B'], label: 'Toggle sidebar' },
  { keys: ['⌘', 'N'], label: 'New instance' },
  { keys: ['⌘', 'R'], label: 'Refresh data' },
]

export default function Settings() {
  const { theme, setTheme } = useTheme()

  return (
    <div className="page">
      <div style={{ marginBottom: 28 }}>
        <h1 className="page-title">Settings</h1>
        <p className="mono" style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 6 }}>
          Customize Vapor to your preferences
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 520 }}>

        {/* Appearance */}
        <div className="card">
          <p className="section-title" style={{ marginBottom: 4 }}>Appearance</p>
          <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 18 }}>Choose how Vapor looks</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {THEMES.map(({ value, label, Icon, desc }) => (
              <button
                key={value}
                onClick={() => setTheme(value)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 13,
                  padding: '12px 14px', borderRadius: 12, border: '1px solid',
                  background: theme === value ? 'var(--accent-dim)' : 'var(--card-2)',
                  borderColor: theme === value ? 'var(--accent-border)' : 'var(--border)',
                  cursor: 'pointer', textAlign: 'left',
                  transition: 'border-color 0.13s, background 0.13s',
                }}
                onMouseEnter={e => { if (theme !== value) { e.currentTarget.style.borderColor = 'var(--border-hover)'; e.currentTarget.style.background = 'var(--card-3)' }}}
                onMouseLeave={e => { if (theme !== value) { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--card-2)' }}}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                  background: theme === value ? 'var(--accent)' : 'var(--card-3)',
                  border: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: theme === value ? '#0a0a0a' : 'var(--text-muted)',
                }}>
                  <Icon size={15} />
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: 700, fontSize: 13.5, lineHeight: 1, marginBottom: 4, color: 'var(--text-primary)' }}>{label}</p>
                  <p style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1 }}>{desc}</p>
                </div>
                {theme === value && <Check size={15} style={{ color: 'var(--accent)', flexShrink: 0 }} />}
              </button>
            ))}
          </div>
        </div>

        {/* Keyboard Shortcuts */}
        <div className="card">
          <p className="section-title" style={{ marginBottom: 4 }}>Keyboard Shortcuts</p>
          <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 18 }}>Available shortcuts across the app</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {SHORTCUTS.map(({ keys, label }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{label}</span>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  {keys.map((k, i) => (
                    <kbd key={i} style={{
                      fontSize: 11, fontFamily: 'IBM Plex Mono',
                      background: 'var(--card-2)', border: '1px solid var(--border)',
                      borderRadius: 6, padding: '3px 8px', color: 'var(--text-primary)',
                      lineHeight: 1.6,
                    }}>{k}</kbd>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
