import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Play, Square, Pause, Camera, Trash2, Loader2 } from 'lucide-react'
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
  if (gb >= 1) return `${gb.toFixed(1)} GB`
  return `${(bytes / (1024 ** 2)).toFixed(0)} MB`
}

const FILTERS = ['All', 'Running', 'Stopped', 'Suspended']

export default function InstancesTable({ instances = [] }) {
  const [stateFilter, setStateFilter] = useState('All')
  const [loading, setLoading] = useState({})
  const [confirmDelete, setConfirmDelete] = useState(null)
  const qc = useQueryClient()
  const toast = useToast()

  const filtered = stateFilter === 'All' ? instances : instances.filter(i => i.state === stateFilter)

  async function doAction(name, fn, successMsg) {
    setLoading(l => ({ ...l, [name]: true }))
    try {
      const res = await fn()
      if (res?.status === 'error') toast(res.error || 'Action failed', 'error')
      else toast(successMsg, 'success')
      qc.invalidateQueries({ queryKey: ['instances'] })
      qc.invalidateQueries({ queryKey: ['stats'] })
      qc.invalidateQueries({ queryKey: ['activity'] })
    } catch (e) { toast(e.message, 'error') }
    finally { setLoading(l => ({ ...l, [name]: false })) }
  }

  return (
    <>
      {/* Filter pills */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 18, flexWrap: 'wrap' }}>
        {FILTERS.map(f => {
          const count = f === 'All' ? instances.length : instances.filter(i => i.state === f).length
          return (
            <button key={f} onClick={() => setStateFilter(f)}
              className={`filter-pill${stateFilter === f ? ' active' : ''}`}>
              {f}
              <span className="pill-count">{count}</span>
            </button>
          )
        })}
      </div>

      {/* Table */}
      <div style={{ background: 'var(--card-1)', borderRadius: 'var(--r-card)', border: '1px solid var(--border)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['Name', 'State', 'IPv4', 'Image', 'CPUs', 'Memory', 'Disk', 'Actions'].map(h => (
                <th key={h} style={{
                  padding: '12px 18px', textAlign: 'left',
                  fontSize: 10.5, fontWeight: 700, color: 'var(--text-muted)',
                  textTransform: 'uppercase', letterSpacing: '0.08em', whiteSpace: 'nowrap',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={8} style={{ padding: '36px 18px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                No instances
              </td></tr>
            )}
            {filtered.map((inst, idx) => {
              const { name, state, ipv4 = [], image, cpus, memory, disk } = inst
              const ip = ipv4[0] ?? '—'
              const busy = loading[name]
              return (
                <tr key={name}
                  style={{ borderBottom: idx < filtered.length - 1 ? '1px solid var(--border)' : 'none', transition: 'background 0.1s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.018)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ padding: '14px 18px' }}>
                    <span className="mono" style={{ fontSize: 13, fontWeight: 600 }}>{name}</span>
                  </td>
                  <td style={{ padding: '14px 18px' }}><StateBadge state={state} /></td>
                  <td style={{ padding: '14px 18px' }}>
                    <span className="mono" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{ip}</span>
                  </td>
                  <td style={{ padding: '14px 18px' }}>
                    <span className="mono" style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{image || '—'}</span>
                  </td>
                  <td style={{ padding: '14px 18px' }}>
                    <span className="mono" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{cpus || '—'}</span>
                  </td>
                  <td style={{ padding: '14px 18px' }}>
                    <span className="mono" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{fmt(memory?.total)}</span>
                  </td>
                  <td style={{ padding: '14px 18px' }}>
                    <span className="mono" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{fmt(disk?.total)}</span>
                  </td>
                  <td style={{ padding: '14px 18px' }}>
                    <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                      {busy ? (
                        <Loader2 size={16} style={{ color: 'var(--text-muted)', animation: 'spin 0.7s linear infinite' }} />
                      ) : (
                        <>
                          {state !== 'Running' && (
                            <ActionBtn icon={<Play size={11} />} color="var(--running)" title="Start"
                              onClick={() => doAction(name, () => api.startInstance(name), `Started ${name}`)} />
                          )}
                          {state === 'Running' && (
                            <ActionBtn icon={<Square size={11} />} color="var(--stopped)" title="Stop"
                              onClick={() => doAction(name, () => api.stopInstance(name), `Stopped ${name}`)} />
                          )}
                          {state === 'Running' && (
                            <ActionBtn icon={<Pause size={11} />} color="var(--suspended)" title="Suspend"
                              onClick={() => doAction(name, () => api.suspendInstance(name), `Suspended ${name}`)} />
                          )}
                          <ActionBtn icon={<Camera size={11} />} color="#a78bfa" title="Snapshot"
                            onClick={() => doAction(name, () => api.createSnapshot(name), 'Snapshot created')} />
                          <ActionBtn icon={<Trash2 size={11} />} color="var(--stopped)" title="Delete"
                            onClick={() => setConfirmDelete(name)} />
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {confirmDelete && (
        <ConfirmModal
          title={`Delete ${confirmDelete}`}
          description={`The instance "${confirmDelete}" will be permanently deleted and purged. All data inside will be lost.`}
          confirmLabel="Delete"
          confirmValue={confirmDelete}
          variant="name"
          onClose={() => setConfirmDelete(null)}
          onConfirm={() => doAction(confirmDelete, () => api.deleteInstance(confirmDelete), `Deleted ${confirmDelete}`)}
        />
      )}
    </>
  )
}

function ActionBtn({ icon, color, title, onClick }) {
  return (
    <button onClick={onClick} title={title} style={{
      width: 30, height: 30, borderRadius: 8, border: '1px solid var(--border)',
      background: 'var(--card-2)', color, cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      transition: 'border-color 0.12s, background 0.12s', flexShrink: 0,
    }}
      onMouseEnter={e => { e.currentTarget.style.borderColor=color; e.currentTarget.style.background='var(--card-3)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.background='var(--card-2)' }}
    >{icon}</button>
  )
}
