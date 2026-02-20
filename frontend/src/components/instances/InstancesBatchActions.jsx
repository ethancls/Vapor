import { Play, Square, RotateCcw, Pause, Camera, Trash2 } from 'lucide-react'

function BatchButton({ label, icon, onClick, danger = false }) {
  const baseStyle = {
    height: 34,
    padding: '0 12px',
    borderRadius: 10,
    border: '1px solid var(--border)',
    background: 'var(--card-1)',
    color: 'var(--text-secondary)',
    fontSize: 12,
    fontWeight: 600,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    cursor: 'pointer',
    transition: 'border-color 0.12s, color 0.12s, background 0.12s',
    lineHeight: 1,
  }
  const dangerStyle = danger
    ? {
        color: 'var(--stopped)',
        border: '1px solid rgba(240,71,71,0.3)',
        background: 'rgba(240,71,71,0.06)',
      }
    : {}

  return (
    <button
      onClick={onClick}
      style={{ ...baseStyle, ...dangerStyle }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = danger ? 'rgba(240,71,71,0.5)' : 'var(--border-hover)'
        e.currentTarget.style.color = danger ? 'var(--stopped)' : 'var(--text-primary)'
        e.currentTarget.style.background = danger ? 'rgba(240,71,71,0.1)' : 'var(--card-2)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = danger ? 'rgba(240,71,71,0.3)' : 'var(--border)'
        e.currentTarget.style.color = danger ? 'var(--stopped)' : 'var(--text-secondary)'
        e.currentTarget.style.background = danger ? 'rgba(240,71,71,0.06)' : 'var(--card-1)'
      }}
    >
      {icon}
      {label}
    </button>
  )
}

export default function InstancesBatchActions({ selectedCount, onStart, onStop, onRestart, onSuspend, onSnapshot, onDelete, onClear }) {
  if (!selectedCount) return null
  return (
    <div className="instances-batch-actions" style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      flexWrap: 'wrap',
      marginBottom: 12,
      padding: '10px 12px',
      borderRadius: 14,
      border: '1px solid var(--border)',
      background: 'var(--card-2)',
    }}>
      <span className="mono instances-batch-summary" style={{
        fontSize: 11.5,
        color: 'var(--accent)',
        fontWeight: 700,
        background: 'var(--accent-dim)',
        border: '1px solid var(--accent-border)',
        borderRadius: 999,
        padding: '6px 10px',
        lineHeight: 1,
      }}>
        {selectedCount} selected
      </span>
      <BatchButton label="Start" icon={<Play size={13} />} onClick={onStart} />
      <BatchButton label="Stop" icon={<Square size={13} />} onClick={onStop} />
      <BatchButton label="Restart" icon={<RotateCcw size={13} />} onClick={onRestart} />
      <BatchButton label="Suspend" icon={<Pause size={13} />} onClick={onSuspend} />
      <BatchButton label="Snapshot" icon={<Camera size={13} />} onClick={onSnapshot} />
      <BatchButton label="Delete" icon={<Trash2 size={13} />} onClick={onDelete} danger />
      <button
        className="instances-batch-clear"
        onClick={onClear}
        style={{
          height: 34,
          padding: '0 10px',
          marginLeft: 'auto',
          border: 'none',
          background: 'none',
          color: 'var(--text-secondary)',
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
          borderRadius: 8,
          transition: 'color 0.12s, background 0.12s',
          lineHeight: 1,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = 'var(--text-primary)'
          e.currentTarget.style.background = 'var(--card-1)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = 'var(--text-secondary)'
          e.currentTarget.style.background = 'none'
        }}
      >
        Clear
      </button>
    </div>
  )
}
