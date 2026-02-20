import { useState } from 'react'
import { Camera, History, Trash2 } from 'lucide-react'

function snapshotName(item) {
  if (!item || typeof item !== 'object') return ''
  if (item.name) return String(item.name)
  if (item.snapshot) return String(item.snapshot)
  if (item.id) return String(item.id)
  return ''
}

export default function SnapshotsPanel({
  snapshots = [],
  loading = false,
  onCreate,
  onRestore,
  onDelete,
}) {
  const [name, setName] = useState('')
  const [comment, setComment] = useState('')

  async function submitCreate(event) {
    event.preventDefault()
    await onCreate(name.trim() || undefined, comment.trim() || undefined)
    setName('')
    setComment('')
  }

  return (
    <div className="card">
      <p className="section-title" style={{ marginBottom: 12 }}>Snapshots</p>

      <form onSubmit={submitCreate} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, marginBottom: 14 }}>
        <input
          className="input"
          placeholder="Snapshot name (optional)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className="input"
          placeholder="Comment (optional)"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
        <button className="btn-accent" style={{ height: 38 }} type="submit" disabled={loading}>
          <Camera size={13} /> Snapshot
        </button>
      </form>

      {snapshots.length === 0 ? (
        <p className="mono" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          No snapshots for this instance.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {snapshots.map((item, index) => {
            const nameValue = snapshotName(item)
            const canAct = Boolean(nameValue)
            return (
              <div key={`${nameValue || 'snapshot'}-${index}`} style={{
                border: '1px solid var(--border)',
                borderRadius: 10,
                padding: '10px 12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                flexWrap: 'wrap',
                background: 'var(--card-2)',
              }}>
                <div style={{ minWidth: 0 }}>
                  <p className="mono" style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 3 }}>
                    {nameValue || 'Unnamed snapshot'}
                  </p>
                  <p className="mono" style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                    {item.comment || item.created_at || item.created || ''}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    className="btn-ghost"
                    style={{ height: 32, padding: '0 10px' }}
                    disabled={!canAct || loading}
                    onClick={() => onRestore(nameValue)}
                  >
                    <History size={12} /> Restore
                  </button>
                  <button
                    className="btn-danger"
                    style={{ height: 32, padding: '0 10px' }}
                    disabled={!canAct || loading}
                    onClick={() => onDelete(nameValue)}
                  >
                    <Trash2 size={12} /> Delete
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
