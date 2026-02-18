import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

/**
 * Base modal component.
 * Props:
 *   title       string
 *   size        'sm' | 'md' | 'lg' | 'xl'  (default 'md')
 *   onClose     () => void
 *   footer      ReactNode  (optional — custom footer buttons)
 *   children
 */
export default function Modal({ title, size = 'md', onClose, footer, children }) {
  const overlayRef = useRef(null)

  // Close on Escape
  useEffect(() => {
    const fn = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [onClose])

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  const widths = { sm: 400, md: 480, lg: 600, xl: 760 }

  return (
    <div
      ref={overlayRef}
      onClick={e => { if (e.target === overlayRef.current) onClose() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.72)',
        backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
    >
      <div style={{
        background: 'var(--card-1)',
        border: '1px solid var(--border)',
        borderRadius: 20,
        width: '100%',
        maxWidth: widths[size],
        maxHeight: '92vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 24px 64px rgba(0,0,0,0.7)',
        animation: 'modal-in 0.18s cubic-bezier(0.4,0,0.2,1)',
      }}>
        <style>{`
          @keyframes modal-in {
            from { opacity:0; transform:scale(0.96) translateY(8px); }
            to   { opacity:1; transform:scale(1) translateY(0); }
          }
        `}</style>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 24px 0',
          flexShrink: 0,
        }}>
          <h2 style={{
            margin: 0, fontSize: 18, fontWeight: 800,
            letterSpacing: '-0.3px', lineHeight: 1,
          }}>{title}</h2>
          <button
            onClick={onClose}
            style={{
              background: 'var(--card-2)', border: '1px solid var(--border)',
              borderRadius: 8, padding: '5px 6px', cursor: 'pointer',
              color: 'var(--text-secondary)', display: 'flex', alignItems: 'center',
              transition: 'color 0.15s, border-color 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.borderColor = 'var(--border-hover)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'var(--border)' }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: 'var(--border)', margin: '18px 0 0' }} />

        {/* Body */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <>
            <div style={{ height: 1, background: 'var(--border)' }} />
            <div style={{ padding: '16px 24px', display: 'flex', justifyContent: 'flex-end', gap: 8, flexShrink: 0 }}>
              {footer}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
