import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { RefreshCw, Camera, History, Trash2 } from 'lucide-react'
import { sileo } from 'sileo'
import { api } from '../api/client'
import ConfirmModal from '../components/ConfirmModal'
import CustomSelect from '../components/CustomSelect'

function toText(value) {
  if (value == null) return ''
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return ''
}

function parseSnapshot(item, index) {
  const rawName = toText(item?.snapshot || item?.name || item?.id || item?.snapshot_name)
  let instance = toText(item?.instance || item?.vm_name || item?.vm || item?.parent || item?.instance_name)
  let snapshot = rawName

  if (!instance && rawName.includes('.')) {
    const [head, ...rest] = rawName.split('.')
    if (head && rest.length > 0) {
      instance = head
      snapshot = rest.join('.')
    }
  }

  const created = toText(item?.created_at || item?.created || item?.timestamp || item?.time || item?.updated_at)
  const comment = toText(item?.comment || item?.description || item?.note)
  const state = toText(item?.state || item?.status)
  const ref = instance && snapshot ? `${instance}.${snapshot}` : rawName || `snapshot-${index}`

  return {
    id: ref || `snapshot-${index}`,
    instance,
    snapshot,
    ref,
    created,
    comment,
    state,
    raw: item || {},
  }
}

function fmtDate(value) {
  if (!value) return '—'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleString('en', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function Snapshots() {
  const qc = useQueryClient()
  const [query, setQuery] = useState('')
  const [instanceFilter, setInstanceFilter] = useState('all')
  const [createInstance, setCreateInstance] = useState('')
  const [createName, setCreateName] = useState('')
  const [createComment, setCreateComment] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [busyRef, setBusyRef] = useState('')

  const snapshotsQuery = useQuery({
    queryKey: ['snapshots'],
    queryFn: () => api.getAllSnapshots(),
    refetchInterval: 10000,
  })
  const instancesQuery = useQuery({
    queryKey: ['instances'],
    queryFn: () => api.getInstances(),
    refetchInterval: 10000,
  })

  const instances = instancesQuery.data?.instances || []
  const snapshots = useMemo(
    () => (snapshotsQuery.data?.snapshots || []).map((item, index) => parseSnapshot(item, index)),
    [snapshotsQuery.data],
  )

  const knownInstances = useMemo(() => {
    const set = new Set(instances.map((item) => item.name).filter(Boolean))
    snapshots.forEach((item) => {
      if (item.instance) set.add(item.instance)
    })
    return [...set].sort((a, b) => a.localeCompare(b))
  }, [instances, snapshots])

  const instanceOptions = useMemo(
    () => [{ value: 'all', label: 'All instances' }, ...knownInstances.map((name) => ({ value: name, label: name }))],
    [knownInstances],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return snapshots.filter((item) => {
      if (instanceFilter !== 'all' && item.instance !== instanceFilter) return false
      if (!q) return true
      const haystack = [item.instance, item.snapshot, item.ref, item.comment, item.created, item.state]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [snapshots, instanceFilter, query])

  async function runMutation(fn, successTitle) {
    const promise = fn().then((result) => {
      qc.invalidateQueries({ queryKey: ['snapshots'] })
      qc.invalidateQueries({ queryKey: ['instances'] })
      qc.invalidateQueries({ queryKey: ['activity'] })
      return result
    })
    sileo.promise(promise, {
      loading: { title: 'Working…' },
      success: { title: successTitle },
      error: (error) => ({ title: error.message }),
    })
    return promise
  }

  async function submitCreate(event) {
    event.preventDefault()
    if (!createInstance) return
    setBusyRef(`create:${createInstance}`)
    try {
      await runMutation(
        () => api.createSnapshot(createInstance, createName.trim() || undefined, createComment.trim() || undefined),
        `Snapshot created on ${createInstance}`,
      )
      setCreateName('')
      setCreateComment('')
    } finally {
      setBusyRef('')
    }
  }

  const loading = snapshotsQuery.isLoading || instancesQuery.isLoading

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 className="page-title">Snapshots</h1>
          <p className="mono" style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 7 }}>
            {snapshots.length} snapshot{snapshots.length !== 1 ? 's' : ''} across {knownInstances.length} instance{knownInstances.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button className="btn-ghost" onClick={() => { snapshotsQuery.refetch(); instancesQuery.refetch() }}>
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      <div className="card" style={{ padding: 16, marginBottom: 12 }}>
        <form className="snapshots-create-form" onSubmit={submitCreate} style={{ display: 'grid', gridTemplateColumns: 'minmax(170px, 1fr) 1fr 1fr auto', gap: 8 }}>
          <CustomSelect
            value={createInstance}
            onChange={setCreateInstance}
            options={knownInstances.map((name) => ({ value: name, label: name }))}
            placeholder="Select instance"
            searchable
            controlHeight={36}
          />
          <input
            className="input"
            style={{ height: 36, padding: '0 12px' }}
            placeholder="Snapshot name (optional)"
            value={createName}
            onChange={(event) => setCreateName(event.target.value)}
          />
          <input
            className="input"
            style={{ height: 36, padding: '0 12px' }}
            placeholder="Comment (optional)"
            value={createComment}
            onChange={(event) => setCreateComment(event.target.value)}
          />
          <button className="btn-accent" style={{ height: 36 }} type="submit" disabled={!createInstance || busyRef.startsWith('create:')}>
            <Camera size={13} /> Snapshot
          </button>
        </form>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 7,
          background: 'var(--card-2)', border: '1px solid var(--border)',
          borderRadius: 'var(--r-sm)', padding: '0 10px', height: 36, width: 'clamp(180px, 35vw, 280px)',
        }}>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search snapshots"
            style={{
              background: 'none', border: 'none', outline: 'none',
              color: 'var(--text-primary)', fontFamily: 'IBM Plex Mono', fontSize: 12,
              width: '100%',
            }}
          />
        </div>
        <CustomSelect
          value={instanceFilter}
          onChange={setInstanceFilter}
          options={instanceOptions}
          searchable
          controlHeight={36}
          style={{ minWidth: 180, width: 'clamp(180px, 28vw, 260px)' }}
        />
      </div>

      <div className="instances-table-shell" style={{ background: 'var(--card-1)', borderRadius: 'var(--r-card)', border: '1px solid var(--border)' }}>
        <div className="instances-table-scroll" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: 880, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Snapshot', 'Instance', 'Created', 'Comment', 'Actions'].map((label) => (
                  <th key={label} style={{
                    padding: '12px 18px', textAlign: 'left',
                    fontSize: 10.5, fontWeight: 700, color: 'var(--text-secondary)',
                    textTransform: 'uppercase', letterSpacing: '0.08em', whiteSpace: 'nowrap',
                  }}>
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: '34px 18px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
                    {query.trim() ? `No snapshots match "${query}"` : 'No snapshots'}
                  </td>
                </tr>
              )}
              {filtered.map((item) => {
                const isBusy = busyRef === item.ref
                return (
                  <tr key={item.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '14px 18px' }}>
                      <p className="mono" style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>
                        {item.snapshot || item.ref}
                      </p>
                      {item.state && (
                        <p className="mono" style={{ fontSize: 10.5, color: 'var(--text-secondary)', marginTop: 5 }}>
                          {item.state}
                        </p>
                      )}
                    </td>
                    <td style={{ padding: '14px 18px' }}>
                      {item.instance ? (
                        <Link
                          to={`/instances/${encodeURIComponent(item.instance)}`}
                          className="mono"
                          style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}
                        >
                          {item.instance}
                        </Link>
                      ) : (
                        <span className="mono" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '14px 18px' }}>
                      <span className="mono" style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>{fmtDate(item.created)}</span>
                    </td>
                    <td style={{ padding: '14px 18px', maxWidth: 280 }}>
                      <span className="mono" style={{
                        fontSize: 11.5, color: 'var(--text-secondary)',
                        display: 'inline-block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%',
                      }}>
                        {item.comment || '—'}
                      </span>
                    </td>
                    <td style={{ padding: '14px 18px' }}>
                      {item.instance && item.snapshot ? (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            className="btn-ghost"
                            style={{ height: 32, padding: '0 10px' }}
                            disabled={isBusy}
                            onClick={async () => {
                              setBusyRef(item.ref)
                              try {
                                await runMutation(
                                  () => api.restoreSnapshot(item.instance, item.snapshot),
                                  `Restored ${item.ref}`,
                                )
                              } finally {
                                setBusyRef('')
                              }
                            }}
                          >
                            <History size={12} /> Restore
                          </button>
                          <button
                            className="btn-danger"
                            style={{ height: 32, padding: '0 10px' }}
                            disabled={isBusy}
                            onClick={() => setDeleteTarget(item)}
                          >
                            <Trash2 size={12} /> Delete
                          </button>
                        </div>
                      ) : (
                        <span className="mono" style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Unavailable</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {deleteTarget && (
        <ConfirmModal
          title={`Delete ${deleteTarget.ref}`}
          description={`Snapshot "${deleteTarget.ref}" will be permanently deleted.`}
          confirmLabel="Delete snapshot"
          confirmValue={deleteTarget.ref}
          variant="name"
          onClose={() => setDeleteTarget(null)}
          onConfirm={async () => {
            setBusyRef(deleteTarget.ref)
            try {
              await runMutation(
                () => api.deleteSnapshot(deleteTarget.instance, deleteTarget.snapshot),
                `Deleted ${deleteTarget.ref}`,
              )
              setDeleteTarget(null)
            } finally {
              setBusyRef('')
            }
          }}
        />
      )}
    </div>
  )
}
