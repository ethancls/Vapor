import { useState } from 'react'
import { TriangleAlert } from 'lucide-react'
import Modal from './Modal'

/**
 * Confirmation modal for destructive actions.
 *
 * variant='confirm'  — two-step: user clicks once, button turns red, click again to confirm
 * variant='name'     — user must type `confirmValue` exactly before button enables
 *
 * Props:
 *   title        string
 *   description  string | ReactNode
 *   confirmLabel string  (default "Delete")
 *   confirmValue string  (required for variant='name')
 *   variant      'confirm' | 'name'
 *   onConfirm    async () => void
 *   onClose      () => void
 */
export default function ConfirmModal({
  title,
  description,
  confirmLabel = 'Delete',
  confirmValue,
  variant = 'confirm',
  onConfirm,
  onClose,
}) {
  const [input, setInput] = useState('')
  const [step, setStep] = useState(0)   // for variant='confirm': 0=ready, 1=armed
  const [loading, setLoading] = useState(false)

  const nameMatch = variant === 'name' ? input === confirmValue : true
  const canConfirm = variant === 'name' ? nameMatch : step === 1

  async function handleClick() {
    if (variant === 'confirm' && step === 0) { setStep(1); return }
    if (!canConfirm) return
    setLoading(true)
    try { await onConfirm() } finally { setLoading(false) }
    onClose()
  }

  return (
    <Modal
      title={title}
      size="sm"
      onClose={onClose}
      footer={
        <>
          <button className="btn-ghost" onClick={onClose} disabled={loading}>Cancel</button>
          <button
            className="btn-danger"
            onClick={handleClick}
            disabled={loading || (variant === 'name' && !nameMatch)}
            style={{
              background: step === 1 ? 'rgba(240,71,71,0.25)' : undefined,
              borderColor: step === 1 ? 'rgba(240,71,71,0.5)' : undefined,
            }}
          >
            {loading ? 'Working…'
              : variant === 'confirm' && step === 0 ? confirmLabel
              : `Confirm ${confirmLabel}`}
          </button>
        </>
      }
    >
      {/* Warning icon */}
      <div style={{ display: 'flex', gap: 14, marginBottom: description ? 16 : 0 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 12, flexShrink: 0,
          background: 'rgba(240,71,71,0.12)', border: '1px solid rgba(240,71,71,0.22)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--stopped)',
        }}>
          <TriangleAlert size={18} />
        </div>
        <div>
          {description && (
            <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.55, margin: 0 }}>
              {description}
            </p>
          )}
        </div>
      </div>

      {/* Type-to-confirm */}
      {variant === 'name' && confirmValue && (
        <div style={{ marginTop: 16 }}>
          <label className="input-label">
            Type <span style={{ fontFamily:'IBM Plex Mono', color:'var(--accent)' }}>{confirmValue}</span> to confirm
          </label>
          <input
            className="input"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={confirmValue}
            autoFocus
            onKeyDown={e => { if (e.key === 'Enter' && canConfirm && !loading) handleClick() }}
          />
        </div>
      )}

      {/* Armed state hint */}
      {variant === 'confirm' && step === 1 && (
        <p style={{ marginTop: 12, fontSize: 12, color: 'var(--stopped)', fontFamily: 'IBM Plex Mono' }}>
          Click again to confirm — this cannot be undone.
        </p>
      )}
    </Modal>
  )
}
