import { useState, useRef, useEffect } from 'react'
import { Search, X, Server } from 'lucide-react'
import { useInstances } from '../hooks/useInstances'

function scoreMatch(text, query) {
  return text.toLowerCase().includes(query.toLowerCase())
}

export default function SearchBar() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const inputRef = useRef(null)
  const containerRef = useRef(null)
  const { instances } = useInstances()

  // Cmd/Ctrl+K to open
  useEffect(() => {
    const fn = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(true)
        setTimeout(() => inputRef.current?.focus(), 50)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [])

  useEffect(() => {
    const fn = (e) => { if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [])

  const q = query.trim()
  const results = q
    ? instances.filter(i =>
        scoreMatch(i.name, q) ||
        scoreMatch(i.state, q) ||
        scoreMatch(i.image || '', q) ||
        (i.ipv4 || []).some(ip => scoreMatch(ip, q))
      )
    : []

  function stateColor(state) {
    if (state === 'Running') return 'var(--running)'
    if (state === 'Stopped') return 'var(--stopped)'
    return 'var(--suspended)'
  }

  return (
    <div ref={containerRef} className="global-search" style={{ position: 'relative', flexShrink: 0, minWidth: 0 }}>
      {/* Trigger */}
      <button
        onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 50) }}
        className="global-search-trigger"
        style={{
          width: 'clamp(140px, 23vw, 200px)', display: 'flex', alignItems: 'center', gap: 9,
          background: 'var(--card-2)', border: '1px solid var(--border)',
          borderRadius: 10, padding: '0 13px', cursor: 'text',
          color: 'var(--text-secondary)', transition: 'border-color 0.15s',
          fontSize: 13, height: 36, lineHeight: 1,
        }}
        onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-hover)'}
        onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
      >
        <Search size={13} style={{ flexShrink: 0 }} />
        <span style={{ flex: 1, textAlign: 'left', fontSize: 12.5 }}>Search…</span>
        <kbd className="global-search-kbd" style={{
          fontSize: 10, fontFamily: 'IBM Plex Mono',
          background: 'var(--card-3)', border: '1px solid var(--border)',
          borderRadius: 5, padding: '2px 5px', color: 'var(--text-secondary)', flexShrink: 0,
        }}>⌘K</kbd>
      </button>

      {/* Dropdown — wider, right-anchored so it doesn't clip off screen */}
      {open && (
        <div className="global-search-dropdown" style={{
          position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 500,
          width: 'min(460px, calc(100vw - 36px))',
          background: 'var(--card-1)', border: '1px solid var(--border)',
          borderRadius: 14, boxShadow: '0 16px 48px rgba(0,0,0,0.55)',
          overflow: 'hidden',
        }}>
          {/* Input inside dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
            <Search size={14} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search by name, state, IP, image…"
              autoFocus
              style={{
                flex: 1, background: 'none', border: 'none', outline: 'none',
                color: 'var(--text-primary)', fontSize: 13,
                fontFamily: 'IBM Plex Mono',
              }}
            />
            {query && (
              <button onClick={() => setQuery('')} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-secondary)', display:'flex' }}>
                <X size={13} />
              </button>
            )}
          </div>

          {/* Results */}
          <div style={{ maxHeight: 320, overflowY: 'auto' }}>
            {!q && (
              <p style={{ padding: '16px 14px', fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'IBM Plex Mono', margin: 0 }}>
                {instances.length} instance{instances.length !== 1 ? 's' : ''} — type to search
              </p>
            )}
            {q && results.length === 0 && (
              <p style={{ padding: '16px 14px', fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'IBM Plex Mono', margin: 0 }}>
                No results for "{q}"
              </p>
            )}
            {results.map(inst => (
              <div
                key={inst.name}
                onClick={() => { setOpen(false); setQuery('') }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 11,
                  padding: '10px 14px', cursor: 'pointer',
                  borderBottom: '1px solid var(--border)',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{
                  width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                  background: 'var(--card-2)', border: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: stateColor(inst.state),
                }}>
                  <Server size={13} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p className="mono" style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1, marginBottom: 3 }}>
                    {inst.name}
                  </p>
                  <p style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1 }}>
                    {inst.image || '—'}
                    {inst.ipv4?.length ? ` · ${inst.ipv4[0]}` : ''}
                  </p>
                </div>
                <span className="badge" style={{
                  fontSize: 10, padding: '2px 7px',
                  background: inst.state === 'Running' ? 'rgba(181,242,61,0.1)' : inst.state === 'Stopped' ? 'rgba(240,71,71,0.1)' : 'rgba(255,159,10,0.1)',
                  color: stateColor(inst.state),
                  border: `1px solid ${stateColor(inst.state)}33`,
                  flexShrink: 0,
                }}>
                  {inst.state}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
