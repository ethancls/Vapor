import { createContext, useContext, useState, useCallback, useRef } from 'react'
import { CheckCircle, XCircle, Info, X } from 'lucide-react'

const ToastCtx = createContext(null)

const ICONS = {
  success: <CheckCircle size={15} />,
  error:   <XCircle    size={15} />,
  info:    <Info       size={15} />,
}

const COLORS = {
  success: { bg:'rgba(181,242,61,0.10)', border:'rgba(181,242,61,0.22)', color:'#c6f55e' },
  error:   { bg:'rgba(240,71,71,0.12)',  border:'rgba(240,71,71,0.25)',  color:'#f06565' },
  info:    { bg:'rgba(96,165,250,0.12)', border:'rgba(96,165,250,0.25)', color:'#7dbcfa' },
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const counter = useRef(0)

  const toast = useCallback((message, type = 'info', duration = 3500) => {
    const id = ++counter.current
    setToasts(t => [...t, { id, message, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), duration)
  }, [])

  function dismiss(id) { setToasts(t => t.filter(x => x.id !== id)) }

  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <div style={{
        position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
        display: 'flex', flexDirection: 'column', gap: 8,
        pointerEvents: 'none',
      }}>
        {toasts.map(t => {
          const c = COLORS[t.type] || COLORS.info
          return (
            <div key={t.id} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              background: 'var(--card-2)',
              border: `1px solid ${c.border}`,
              borderRadius: 12, padding: '11px 14px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              color: 'var(--text-primary)',
              fontSize: 13, fontWeight: 500,
              pointerEvents: 'auto',
              animation: 'toast-in 0.2s ease',
              minWidth: 240, maxWidth: 340,
            }}>
              <style>{`
                @keyframes toast-in {
                  from { opacity:0; transform:translateX(20px); }
                  to   { opacity:1; transform:translateX(0); }
                }
              `}</style>
              <span style={{ color: c.color, display:'flex', flexShrink:0 }}>{ICONS[t.type]}</span>
              <span style={{ flex:1 }}>{t.message}</span>
              <button onClick={() => dismiss(t.id)} style={{
                background:'none', border:'none', cursor:'pointer',
                color:'var(--text-secondary)', display:'flex', padding:0,
                flexShrink:0,
              }}>
                <X size={13} />
              </button>
            </div>
          )
        })}
      </div>
    </ToastCtx.Provider>
  )
}

export function useToast() {
  const fn = useContext(ToastCtx)
  if (!fn) throw new Error('useToast must be inside ToastProvider')
  return fn
}
