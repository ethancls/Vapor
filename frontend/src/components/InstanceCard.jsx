import { useState, useRef, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Play, Square, Pause, Camera, Trash2, MoreHorizontal, Loader2, Copy, Check } from 'lucide-react'
import { api } from '../api/client'
import { useToast } from './Toast'
import ConfirmModal from './ConfirmModal'

function StateBadge({ state }) {
  const cls = state === 'Running' ? 'badge-running' : state === 'Stopped' ? 'badge-stopped' : 'badge-suspended'
  const dot = state === 'Running' ? 'var(--running)' : state === 'Stopped' ? 'var(--stopped)' : 'var(--suspended)'
  return (
    <span className={`badge ${cls}`}>
      <span className="badge-dot" style={{ background: dot }} />
      {state}
    </span>
  )
}

function fmt(bytes) {
  if (!bytes) return '—'
  const gb = bytes / (1024 ** 3)
  if (gb >= 1) return `${gb.toFixed(1)}G`
  return `${(bytes / (1024 ** 2)).toFixed(0)}M`
}

function CopyIP({ ip }) {
  const [copied, setCopied] = useState(false)
  if (ip === '—') return <span className="stat-value">—</span>

  function doCopy(e) {
    e.stopPropagation()
    navigator.clipboard.writeText(ip).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    })
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <span className="mono" style={{
        fontSize: 11.5, color: 'var(--text-secondary)', fontWeight: 500, lineHeight: 1,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>{ip}</span>
      <button
        onClick={doCopy}
        title={copied ? 'Copied!' : 'Copy IP'}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          padding: '2px 3px', flexShrink: 0,
          color: copied ? 'var(--running)' : 'var(--text-muted)',
          display: 'flex', alignItems: 'center',
          borderRadius: 4, transition: 'color 0.2s',
        }}
        onMouseEnter={e => { if (!copied) e.currentTarget.style.color = 'var(--text-primary)' }}
        onMouseLeave={e => { if (!copied) e.currentTarget.style.color = 'var(--text-muted)' }}
      >
        {copied ? <Check size={11} /> : <Copy size={11} />}
      </button>
    </div>
  )
}

export default function InstanceCard({ instance }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [loading, setLoading] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const menuRef = useRef(null)
  const qc = useQueryClient()
  const toast = useToast()

  useEffect(() => {
    const fn = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false) }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [])

  async function doAction(fn, label, successMsg) {
    setLoading(label)
    setMenuOpen(false)
    try {
      const res = await fn()
      if (res?.status === 'error') { toast(res.error || `${label} failed`, 'error') }
      else { toast(successMsg, 'success') }
      qc.invalidateQueries({ queryKey: ['instances'] })
      qc.invalidateQueries({ queryKey: ['stats'] })
      qc.invalidateQueries({ queryKey: ['activity'] })
    } catch (e) {
      toast(e.message, 'error')
    } finally { setLoading(null) }
  }

  const { name, state, ipv4 = [], image, cpus, memory, disk } = instance
  const ip = ipv4[0] ?? '—'

  return (
    <>
      <div
        className="card"
        style={{ position: 'relative', transition: 'border-color 0.18s, background 0.18s' }}
        onMouseEnter={e => { e.currentTarget.style.borderColor='rgba(181,242,61,0.22)'; e.currentTarget.style.background='var(--card-2)' }}
        onMouseLeave={e => { e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.background='var(--card-1)' }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
          <div style={{ minWidth: 0 }}>
            <p className="mono" style={{ fontWeight: 600, fontSize: 13, lineHeight: 1, marginBottom: 7, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {name}
            </p>
            <StateBadge state={state} />
          </div>

          <div ref={menuRef} style={{ position: 'relative', flexShrink: 0, marginLeft: 8 }}>
            <button
              onClick={() => setMenuOpen(o => !o)}
              style={{
                background: 'var(--card-2)', border: '1px solid var(--border)',
                borderRadius: 8, padding: '5px 6px', cursor: 'pointer',
                color: 'var(--text-secondary)', display: 'flex', alignItems: 'center',
                transition: 'border-color 0.13s, color 0.13s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor='var(--border-hover)'; e.currentTarget.style.color='var(--text-primary)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.color='var(--text-secondary)' }}
            >
              {loading ? <Loader2 size={14} style={{ animation: 'spin 0.7s linear infinite' }} /> : <MoreHorizontal size={14} />}
              <style>{`@keyframes spin { to { transform:rotate(360deg) } }`}</style>
            </button>

            {menuOpen && (
              <div style={{
                position: 'absolute', right: 0, top: 'calc(100% + 6px)', zIndex: 200,
                background: 'var(--card-3)', border: '1px solid var(--border)',
                borderRadius: 13, padding: 5, minWidth: 155,
                boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
              }}>
                {state !== 'Running' && (
                  <MenuItem icon={<Play size={12} />} label="Start" color="var(--running)"
                    onClick={() => doAction(() => api.startInstance(name), 'start', `Started ${name}`)} />
                )}
                {state === 'Running' && (
                  <MenuItem icon={<Square size={12} />} label="Stop" color="var(--stopped)"
                    onClick={() => doAction(() => api.stopInstance(name), 'stop', `Stopped ${name}`)} />
                )}
                {state === 'Running' && (
                  <MenuItem icon={<Pause size={12} />} label="Suspend" color="var(--suspended)"
                    onClick={() => doAction(() => api.suspendInstance(name), 'suspend', `Suspended ${name}`)} />
                )}
                <MenuItem icon={<Camera size={12} />} label="Snapshot" color="#a78bfa"
                  onClick={() => doAction(() => api.createSnapshot(name), 'snapshot', `Snapshot created`)} />
                <div style={{ height: 1, background: 'var(--border)', margin: '4px 6px' }} />
                <MenuItem icon={<Trash2 size={12} />} label="Delete" color="var(--stopped)"
                  onClick={() => { setMenuOpen(false); setConfirmDelete(true) }} />
              </div>
            )}
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.6fr) repeat(3,minmax(0,1fr))', gap: 10 }}>
          <div className="stat-cell" style={{ minWidth: 0 }}>
            <span className="stat-label">IP</span>
            <CopyIP ip={ip} />
          </div>
          {[
            { label: 'CPU',  value: cpus ? String(cpus) : '—' },
            { label: 'RAM',  value: fmt(memory?.total) },
            { label: 'Disk', value: fmt(disk?.total) },
          ].map(({ label, value }) => (
            <div className="stat-cell" key={label} style={{ minWidth: 0 }}>
              <span className="stat-label">{label}</span>
              <span className="stat-value" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{value}</span>
            </div>
          ))}
        </div>

        <p className="mono" style={{ marginTop: 12, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1 }}>
          {image || '—'}
        </p>
      </div>

      {confirmDelete && (
        <ConfirmModal
          title={`Delete ${name}`}
          description={`The instance "${name}" will be permanently deleted and purged. All data inside will be lost.`}
          confirmLabel="Delete"
          confirmValue={name}
          variant="name"
          onClose={() => setConfirmDelete(false)}
          onConfirm={() => doAction(() => api.deleteInstance(name), 'delete', `Deleted ${name}`)}
        />
      )}
    </>
  )
}

function MenuItem({ icon, label, color, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 8, width: '100%',
        background: 'none', border: 'none', padding: '8px 11px',
        color: color || 'var(--text-primary)', fontSize: 13,
        cursor: 'pointer', borderRadius: 8, fontFamily: 'Syne', fontWeight: 600,
        transition: 'background 0.1s', lineHeight: 1,
      }}
      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
      onMouseLeave={e => e.currentTarget.style.background = 'none'}
    >
      {icon} {label}
    </button>
  )
}
