import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check } from 'lucide-react'

export default function CustomSelect({ value, onChange, options, placeholder = 'Select…', style = {} }) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)
  const selected = options.find(o => o.value === value)

  useEffect(() => {
    const fn = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [])

  // close on Escape
  useEffect(() => {
    if (!open) return
    const fn = (e) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [open])

  return (
    <div ref={containerRef} style={{ position: 'relative', ...style }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 8,
          background: 'var(--card-2)', border: '1px solid',
          borderColor: open ? 'rgba(181,242,61,0.4)' : 'var(--border)',
          borderRadius: 'var(--r-sm)', padding: '10px 13px',
          color: selected ? 'var(--text-primary)' : 'var(--text-muted)',
          fontFamily: 'IBM Plex Mono', fontSize: 13, lineHeight: 1,
          cursor: 'pointer', textAlign: 'left',
          transition: 'border-color 0.15s',
        }}
        onMouseEnter={e => { if (!open) e.currentTarget.style.borderColor = 'var(--border-hover)' }}
        onMouseLeave={e => { if (!open) e.currentTarget.style.borderColor = 'var(--border)' }}
      >
        <span style={{ flex: 1 }}>{selected?.label ?? placeholder}</span>
        {selected?.tag && (
          <span style={{
            fontSize: 10, background: 'var(--accent-dim)', color: 'var(--accent)',
            border: '1px solid var(--accent-border)', borderRadius: 5, padding: '2px 6px',
            fontFamily: 'Syne', fontWeight: 700, flexShrink: 0,
          }}>{selected.tag}</span>
        )}
        <ChevronDown
          size={13}
          style={{
            color: 'var(--text-muted)', flexShrink: 0,
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.15s',
          }}
        />
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 400,
          background: 'var(--card-3)', border: '1px solid var(--border)',
          borderRadius: 12, boxShadow: 'var(--shadow-lg)',
          overflow: 'hidden',
        }}>
          {options.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false) }}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                width: '100%', background: 'none', border: 'none',
                padding: '9px 13px', cursor: 'pointer',
                color: value === opt.value ? 'var(--accent)' : 'var(--text-primary)',
                fontFamily: 'IBM Plex Mono', fontSize: 13, lineHeight: 1,
                transition: 'background 0.1s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}
            >
              <span style={{ flex: 1 }}>{opt.label}</span>
              {opt.tag && (
                <span style={{
                  fontSize: 10, background: 'var(--accent-dim)', color: 'var(--accent)',
                  border: '1px solid var(--accent-border)', borderRadius: 5, padding: '2px 6px',
                  fontFamily: 'Syne', fontWeight: 700,
                }}>{opt.tag}</span>
              )}
              {value === opt.value && <Check size={12} style={{ color: 'var(--accent)', flexShrink: 0 }} />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
