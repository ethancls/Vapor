import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { createPortal } from 'react-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Camera, History, Trash2, Search, X, ChevronUp, ChevronDown, ChevronsUpDown, Dices, Grid3X3, Table2, Grip } from 'lucide-react'
import { sileo } from 'sileo'
import { api } from '../api/client'
import ConfirmModal from '../components/ConfirmModal'
import CustomSelect from '../components/CustomSelect'
import Modal from '../components/Modal'
import Tooltip from '../components/Tooltip'
import InstancesCheckbox from '../components/instances/InstancesCheckbox'
import { SkeletonTable, SkeletonCards } from '../components/Skeletons'
import { randomSnapshotName } from '../components/instances/instancesUtils'

/* ── Helpers ──────────────────────────────────────────────────────────── */

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
    if (head && rest.length > 0) { instance = head; snapshot = rest.join('.') }
  }

  const created    = toText(item?.created_at || item?.created || item?.timestamp || item?.time || item?.updated_at)
  const comment    = toText(item?.comment || item?.description || item?.note)
  const state      = toText(item?.state || item?.status)
  const diskSpace  = toText(item?.disk_space  || item?.disk  || '')
  const memSize    = toText(item?.memory_size || item?.memory || '')
  const ref        = instance && snapshot ? `${instance}.${snapshot}` : rawName || `snapshot-${index}`

  return { id: ref || `snapshot-${index}`, instance, snapshot, ref, created, comment, state, diskSpace, memSize, raw: item || {} }
}

function fmtMpSize(str) {
  if (!str) return null
  const m = str.match(/^([\d.]+)\s*(GiB|MiB|TiB|GB|MB|TB|KiB|KB|B)$/i)
  if (!m) return str
  const val  = parseFloat(m[1])
  const unit = m[2].toUpperCase()
  if (unit === 'GIB' || unit === 'GB') return `${val.toFixed(1)} GB`
  if (unit === 'TIB' || unit === 'TB') return `${val.toFixed(1)} TB`
  if (unit === 'MIB' || unit === 'MB') return `${Math.round(val)} MB`
  if (unit === 'KIB' || unit === 'KB') return `${Math.round(val)} KB`
  return str
}

function fmtDate(value) {
  if (!value) return '—'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleString('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

/* ── Sort header ──────────────────────────────────────────────────────── */

const COLUMNS = [
  { key: 'snapshot',  label: 'Snapshot'  },
  { key: 'instance',  label: 'Instance'  },
  { key: 'created',   label: 'Created'   },
  { key: 'diskSpace', label: 'Disk'      },
  { key: 'memSize',   label: 'Memory'    },
  { key: 'comment',   label: 'Comment'   },
  { key: null,        label: 'Actions'   },
]
const MOBILE_TABLE_BREAKPOINT = '(max-width: 900px)'

function defaultSnapshotsViewMode() {
  if (typeof window === 'undefined') return 'table'
  return window.matchMedia(MOBILE_TABLE_BREAKPOINT).matches ? 'cards' : 'table'
}

const SKEL_COLS_TABLE = [
  { w: 140 },
  { w: 80  },
  { w: 90  },
  { w: 70  },
  { w: 70  },
  { w: 160 },
  { w: 70  },
]

function SortTh({ col, sort, onSort, children, style }) {
  const active = sort.key === col.key
  const Icon   = active ? (sort.dir === 'asc' ? ChevronUp : ChevronDown) : ChevronsUpDown
  return (
    <th
      onClick={() => col.key && onSort(col.key)}
      style={{
        padding: '12px 18px', textAlign: 'left',
        fontSize: 10.5, fontWeight: 700, whiteSpace: 'nowrap',
        color: active ? 'var(--accent)' : 'var(--text-secondary)',
        textTransform: 'uppercase', letterSpacing: '0.08em',
        cursor: col.key ? 'pointer' : 'default', userSelect: 'none',
        ...style,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {children}
        {col.key && <Icon size={11} style={{ opacity: active ? 1 : 0.4, flexShrink: 0 }} />}
      </div>
    </th>
  )
}

/* ── Action icon button ───────────────────────────────────────────────── */

function ActionBtn({ icon, color, label, onClick, disabled }) {
  return (
    <Tooltip label={label}>
      <button
        type="button"
        aria-label={label}
        onClick={onClick}
        disabled={disabled}
        style={{
          width: 34, height: 34, borderRadius: 9, border: 'none',
          background: 'transparent', color: disabled ? 'var(--text-muted)' : color,
          cursor: disabled ? 'not-allowed' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'background 0.12s', flexShrink: 0,
        }}
        onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.background = `color-mix(in srgb, ${color} 12%, transparent)` }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
      >
        {icon}
      </button>
    </Tooltip>
  )
}

/* ── Create modal ─────────────────────────────────────────────────────── */

function CreateSnapshotModal({ instances, onClose, onConfirm }) {
  const [selectedInstance, setSelectedInstance] = useState('')
  const [name,    setName]    = useState('')
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(false)

  const stopped         = instances.filter((inst) => inst.state === 'Stopped')
  const instanceOptions = stopped.map((inst) => ({ value: inst.name, label: inst.name }))

  function handleSelectInstance(val) { setSelectedInstance(val) }

  async function handleSubmit() {
    if (!selectedInstance || !name.trim() || loading) return
    setLoading(true)
    try { await onConfirm(selectedInstance, name.trim() || undefined, comment.trim() || undefined); onClose() }
    finally { setLoading(false) }
  }

  return (
    <Modal
      title="New Snapshot" size="sm" onClose={onClose}
      footer={(
        <>
          <button className="btn-ghost" onClick={onClose} disabled={loading}>Cancel</button>
          <button className="btn-accent" onClick={handleSubmit} disabled={!selectedInstance || !name.trim() || loading}>
            {loading ? 'Creating…' : 'Create Snapshot'}
          </button>
        </>
      )}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label className="input-label" htmlFor="snap-instance">Instance *</label>
          <CustomSelect
            id="snap-instance"
            value={selectedInstance} onChange={handleSelectInstance}
            options={instanceOptions}
            placeholder={stopped.length === 0 ? 'No stopped instances' : 'Select instance…'}
            searchable controlHeight={36} menuMaxHeight={111}
          />
          <p className="mono" style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.5 }}>
            Only stopped instances are shown, snapshots require the instance to be off.
          </p>
        </div>
        <div>
          <label className="input-label" htmlFor="snap-name">Snapshot name *</label>
          <div style={{ position: 'relative' }}>
            <input
              id="snap-name"
              className="input" placeholder="my-vm-snapshot"
              value={name} onChange={(e) => setName(e.target.value)}
              style={{ paddingRight: 36 }}
            />
            <Tooltip label="Generate" style={{ position: 'absolute', right: 7, top: '50%', transform: 'translateY(-50%)' }}>
              <button
                type="button" aria-label="Generate"
                onClick={() => setName(randomSnapshotName(selectedInstance || 'snap'))}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 5, display: 'flex', color: 'var(--text-muted)', transition: 'color 0.13s' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent)' }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)' }}
              >
                <Dices size={14} />
              </button>
            </Tooltip>
          </div>
        </div>
        <div>
          <label className="input-label" htmlFor="snap-comment">
            Comment <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span>
          </label>
          <input
            id="snap-comment"
            className="input" placeholder="Description…"
            value={comment} onChange={(e) => setComment(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit() }}
          />
        </div>
      </div>
    </Modal>
  )
}

/* ── Snapshot Card ────────────────────────────────────────────────────── */

function SnapshotCard({ item, selected, onSelect, onRestore, onDelete, busy }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 })
  const btnRef = useRef(null)
  const menuRef = useRef(null)

  useEffect(() => {
    if (!menuOpen) return
    const onMouseDown = (e) => {
      if (btnRef.current?.contains(e.target)) return
      if (menuRef.current?.contains(e.target)) return
      setMenuOpen(false)
    }
    const onEsc = (e) => { if (e.key === 'Escape') setMenuOpen(false) }
    document.addEventListener('mousedown', onMouseDown)
    window.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('keydown', onEsc)
    }
  }, [menuOpen])

  function toggleMenu(e) {
    e.stopPropagation()
    if (!menuOpen && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      setMenuPos({ top: rect.bottom + 6, right: window.innerWidth - rect.right })
    }
    setMenuOpen((v) => !v)
  }

  return (
    <>
      <div
        className="card"
        style={{
          background: selected ? 'var(--accent-dim)' : 'var(--card-1)',
          border: `1px solid ${selected ? 'var(--accent-border)' : 'var(--border)'}`,
          padding: 16,
          paddingBottom: 46,
          display: 'flex', flexDirection: 'column', gap: 12,
          transition: 'border-color 0.18s, background 0.18s',
          position: 'relative',
          boxSizing: 'border-box',
          height: '100%',
        }}
        onMouseEnter={(e) => {
          if (selected) return
          e.currentTarget.style.borderColor = 'rgba(181,242,61,0.22)'
          e.currentTarget.style.background = 'var(--card-2)'
        }}
        onMouseLeave={(e) => {
          if (selected) return
          e.currentTarget.style.borderColor = 'var(--border)'
          e.currentTarget.style.background = 'var(--card-1)'
        }}
      >
        <button
          ref={btnRef}
          type="button"
          aria-label="More actions"
          onClick={toggleMenu}
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            background: 'var(--card-2)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '5px 6px',
            cursor: 'pointer',
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            transition: 'border-color 0.13s, color 0.13s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-hover)'; e.currentTarget.style.color = 'var(--text-primary)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
        >
          <Grip size={14} />
        </button>

        {/* Name + instance */}
        <div style={{ paddingRight: 34 }}>
          <p className="mono" style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1, marginBottom: 7, wordBreak: 'break-word' }}>
            {item.snapshot || item.ref}
          </p>
          {item.instance && (
            <Link to={`/instances/${encodeURIComponent(item.instance)}`} className="mono"
              style={{ fontSize: 11.5, color: 'var(--accent)', fontWeight: 600, display: 'block', lineHeight: 1 }}>
              {item.instance}
            </Link>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
          <div className="stat-cell">
            <span className="stat-label">Created</span>
            <span className="mono stat-value" style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>{fmtDate(item.created)}</span>
          </div>
          <div className="stat-cell">
            <span className="stat-label">Disk</span>
            <span className="mono stat-value" style={{ fontSize: 12, color: fmtMpSize(item.diskSpace) ? 'var(--text-secondary)' : 'var(--text-muted)' }}>
              {fmtMpSize(item.diskSpace) || '—'}
            </span>
          </div>
          <div className="stat-cell">
            <span className="stat-label">Memory</span>
            <span className="mono stat-value" style={{ fontSize: 12, color: fmtMpSize(item.memSize) ? 'var(--text-secondary)' : 'var(--text-muted)' }}>
              {fmtMpSize(item.memSize) || '—'}
            </span>
          </div>
        </div>

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 5 }}>
          <p className="section-label" style={{ margin: 0 }}>Comment</p>
          {item.comment && (
            <span className="mono" style={{
              fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.4,
              overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
            }}>
              {item.comment}
            </span>
          )}
          {!item.comment && (
            <span className="mono" style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.4 }}>
              —
            </span>
          )}
        </div>

        <div
          style={{
            position: 'absolute',
            bottom: 12,
            right: 12,
            zIndex: 8,
            background: 'var(--card-1)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: 2,
          }}
        >
          <InstancesCheckbox checked={selected} onChange={onSelect} />
        </div>
      </div>

      {menuOpen && createPortal(
        <div
          ref={menuRef}
          style={{
            position: 'fixed',
            top: menuPos.top,
            right: menuPos.right,
            zIndex: 9999,
            background: 'var(--card-3)',
            border: '1px solid var(--border)',
            borderRadius: 13,
            padding: 5,
            minWidth: 150,
            boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
          }}
        >
          <button
            type="button"
            disabled={busy || !(item.instance && item.snapshot)}
            onClick={() => { setMenuOpen(false); onRestore() }}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, width: '100%',
              background: 'none', border: 'none', padding: '8px 11px',
              color: busy || !(item.instance && item.snapshot) ? 'var(--text-muted)' : '#a78bfa',
              fontSize: 13, cursor: busy || !(item.instance && item.snapshot) ? 'not-allowed' : 'pointer',
              borderRadius: 8, fontWeight: 600, opacity: busy || !(item.instance && item.snapshot) ? 0.45 : 1,
              lineHeight: 1,
            }}
            onMouseEnter={e => { if (!busy && item.instance && item.snapshot) e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
          >
            <History size={14} /> Restore
          </button>
          <button
            type="button"
            disabled={busy || !(item.instance && item.snapshot)}
            onClick={() => { setMenuOpen(false); onDelete() }}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, width: '100%',
              background: 'none', border: 'none', padding: '8px 11px',
              color: busy || !(item.instance && item.snapshot) ? 'var(--text-muted)' : 'var(--stopped)',
              fontSize: 13, cursor: busy || !(item.instance && item.snapshot) ? 'not-allowed' : 'pointer',
              borderRadius: 8, fontWeight: 600, opacity: busy || !(item.instance && item.snapshot) ? 0.45 : 1,
              lineHeight: 1,
            }}
            onMouseEnter={e => { if (!busy && item.instance && item.snapshot) e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
          >
            <Trash2 size={14} /> Delete
          </button>
        </div>,
        document.body,
      )}
    </>
  )
}

/* ── Page ─────────────────────────────────────────────────────────────── */

export default function Snapshots() {
  const qc = useQueryClient()
  const [query,          setQuery]          = useState('')
  const [instanceFilter, setInstanceFilter] = useState('all')
  const [sort,           setSort]           = useState({ key: 'created', dir: 'desc' })
  const [viewMode,       setViewMode]       = useState(defaultSnapshotsViewMode)
  const [selectedRefs,   setSelectedRefs]   = useState(new Set())
  const [createOpen,     setCreateOpen]     = useState(false)
  const [deleteTarget,   setDeleteTarget]   = useState(null)
  const [confirmBulkDel, setConfirmBulkDel] = useState(false)
  const [busyRef,        setBusyRef]        = useState('')

  const snapshotsQuery = useQuery({ queryKey: ['snapshots'], queryFn: () => api.getAllSnapshots(), refetchInterval: 10000 })
  const instancesQuery = useQuery({ queryKey: ['instances'], queryFn: () => api.getInstances(),   refetchInterval: 10000 })

  const instanceRows = instancesQuery.data?.instances
  const instances = useMemo(() => instanceRows ?? [], [instanceRows])
  const snapshots = useMemo(
    () => (snapshotsQuery.data?.snapshots || []).map((item, i) => parseSnapshot(item, i)),
    [snapshotsQuery.data],
  )

  const knownInstances = useMemo(() => {
    const set = new Set(instances.map((i) => i.name).filter(Boolean))
    snapshots.forEach((s) => { if (s.instance) set.add(s.instance) })
    return [...set].sort((a, b) => a.localeCompare(b))
  }, [instances, snapshots])

  const instanceOptions = useMemo(
    () => [{ value: 'all', label: 'All instances' }, ...knownInstances.map((n) => ({ value: n, label: n }))],
    [knownInstances],
  )

  function toggleSort(key) {
    setSort((s) => s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' })
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = snapshots.filter((item) => {
      if (instanceFilter !== 'all' && item.instance !== instanceFilter) return false
      if (!q) return true
      return [item.instance, item.snapshot, item.ref, item.comment, item.created, item.state]
        .filter(Boolean).join(' ').toLowerCase().includes(q)
    })
    return [...list].sort((a, b) => {
      const av = a[sort.key] || ''; const bv = b[sort.key] || ''
      const cmp = String(av).localeCompare(String(bv))
      return sort.dir === 'asc' ? cmp : -cmp
    })
  }, [snapshots, instanceFilter, query, sort])

  // Selection
  const allSelected = filtered.length > 0 && filtered.every((s) => selectedRefs.has(s.ref))
  function toggleSelect(ref) {
    setSelectedRefs((prev) => { const next = new Set(prev); next.has(ref) ? next.delete(ref) : next.add(ref); return next })
  }
  function toggleSelectAll() {
    setSelectedRefs((prev) => {
      const next = new Set(prev)
      if (allSelected) filtered.forEach((s) => next.delete(s.ref))
      else filtered.forEach((s) => next.add(s.ref))
      return next
    })
  }
  function clearSelection() { setSelectedRefs(new Set()) }
  const selectedItems = filtered.filter((s) => selectedRefs.has(s.ref))

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
      error:   (error) => ({ title: error.message }),
    })
    return promise
  }

  async function doRestore(item) {
    setBusyRef(item.ref)
    try { await runMutation(() => api.restoreSnapshot(item.instance, item.snapshot), `Restored ${item.ref}`) }
    finally { setBusyRef('') }
  }

  async function doBulkDelete() {
    const items = selectedItems.filter((s) => s.instance && s.snapshot)
    const promise = Promise.all(items.map((s) => api.deleteSnapshot(s.instance, s.snapshot))).then(() => {
      qc.invalidateQueries({ queryKey: ['snapshots'] })
      qc.invalidateQueries({ queryKey: ['instances'] })
      qc.invalidateQueries({ queryKey: ['activity'] })
    })
    sileo.promise(promise, {
      loading: { title: `Deleting ${items.length} snapshot(s)…` },
      success: { title: `Deleted ${items.length} snapshot(s)` },
      error:   (e) => ({ title: e.message }),
    })
    try { await promise; clearSelection() } catch { /* noop */ }
  }

  const isLoading = snapshotsQuery.isLoading || instancesQuery.isLoading

  return (
    <div className="page">

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 className="page-title">Snapshots</h1>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn-accent" onClick={() => setCreateOpen(true)} disabled={instances.filter((i) => i.state === 'Stopped').length === 0}>
            <Camera size={13} /> New Snapshot
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="instances-controls" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
        <div className="instances-state-filters" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', flex: '1 1 280px' }}>
          {isLoading ? (
            <span className="skeleton" style={{ display: 'inline-block', width: 62, height: 20, borderRadius: 999 }} />
          ) : (
            <span className="filter-pill active" style={{ cursor: 'default' }}>
              All
              <span className="pill-count">{snapshots.length}</span>
            </span>
          )}
        </div>
        <div className="instances-controls-right" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginLeft: 'auto' }}>
          {/* Search */}
          <div className="instances-search-control" style={{
            display: 'flex', alignItems: 'center', gap: 7,
            background: 'var(--card-2)', border: '1px solid var(--border)',
            borderRadius: 'var(--r-sm)', padding: '0 10px', height: 36,
            width: 'clamp(150px, 22vw, 220px)',
          }}>
            <Search size={12} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
            <input
              className="mono"
              value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Search snapshots..."
              style={{ background: 'none', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: 12, width: '100%' }}
            />
            {query && (
              <button onClick={() => setQuery('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}>
                <X size={11} />
              </button>
            )}
          </div>

          {/* Instance filter */}
          <CustomSelect
            value={instanceFilter} onChange={setInstanceFilter}
            options={instanceOptions} searchable controlHeight={36}
            style={{ minWidth: 160, width: 'clamp(160px, 24vw, 240px)' }}
          />

          {/* View toggle */}
          <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', overflow: 'hidden', height: 36 }}>
            {[{ mode: 'table', Icon: Table2, label: 'Table view' }, { mode: 'cards', Icon: Grid3X3, label: 'Card view' }].map((item) => {
              const active = viewMode === item.mode
              return (
                <button
                  key={item.mode}
                  type="button"
                  aria-label={item.label}
                  onClick={() => setViewMode(item.mode)}
                  style={{ border: 'none', borderRadius: 0, height: 36, padding: '0 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', background: active ? 'var(--accent-dim)' : 'transparent', color: active ? 'var(--accent)' : 'var(--text-secondary)', transition: 'background 0.15s, color 0.15s' }}
                  onMouseEnter={(e) => { if (!active) { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'var(--text-primary)' } }}
                  onMouseLeave={(e) => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)' } }}
                >
                  <item.Icon size={13} />
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Batch action bar */}
      {selectedItems.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: 'var(--card-2)', border: '1px solid var(--border)',
          borderRadius: 'var(--r-sm)', padding: '10px 16px', marginBottom: 12,
        }}>
          <span className="mono" style={{ fontSize: 12, color: 'var(--text-secondary)', flex: 1 }}>
            {selectedItems.length} snapshot{selectedItems.length !== 1 ? 's' : ''} selected
          </span>
          <button className="btn-danger" onClick={() => setConfirmBulkDel(true)}>
            <Trash2 size={12} /> Delete selected
          </button>
          <button className="btn-ghost" onClick={clearSelection}>
            <X size={12} /> Clear
          </button>
        </div>
      )}

      {/* Table view */}
      {viewMode === 'table' && (
        isLoading ? (
          <SkeletonTable cols={SKEL_COLS_TABLE} rows={5} hasCheckbox minWidth={900} />
        ) : (
        <div className="instances-table-shell" style={{ background: 'var(--card-1)', borderRadius: 'var(--r-card)', border: '1px solid var(--border)', overflow: 'visible' }}>
          <div className="instances-table-scroll no-scrollbar" style={{ overflowX: 'auto', overflowY: 'visible' }}>
            <table style={{ width: '100%', minWidth: 900, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '12px 10px 12px 14px', width: 40 }}>
                    <InstancesCheckbox checked={allSelected} onChange={toggleSelectAll} />
                  </th>
                  {COLUMNS.map((col) => (
                    <SortTh key={col.label} col={col} sort={sort} onSort={toggleSort}>{col.label}</SortTh>
                  ))}
                </tr>
              </thead>
              <tbody>
                {!isLoading && filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} style={{ padding: '34px 18px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
                      {query.trim() ? `No snapshots match "${query}"` : 'No snapshots'}
                    </td>
                  </tr>
                )}
                {filtered.map((item, idx) => {
                  const busy     = busyRef === item.ref
                  const selected = selectedRefs.has(item.ref)
                  return (
                    <tr
                      key={item.id}
                      style={{ borderBottom: idx < filtered.length - 1 ? '1px solid var(--border)' : 'none', transition: 'background 0.1s', background: selected ? 'rgba(181,242,61,0.04)' : 'transparent' }}
                      onMouseEnter={(e) => { if (!selected) e.currentTarget.style.background = 'rgba(255,255,255,0.018)' }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = selected ? 'rgba(181,242,61,0.04)' : 'transparent' }}
                    >
                      <td style={{ padding: '14px 10px 14px 14px' }}>
                        <InstancesCheckbox checked={selected} onChange={() => toggleSelect(item.ref)} />
                      </td>
                      <td style={{ padding: '14px 18px' }}>
                        <span className="mono" style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1 }}>
                          {item.snapshot || item.ref}
                        </span>
                      </td>
                      <td style={{ padding: '14px 18px' }}>
                        {item.instance
                          ? <Link to={`/instances/${encodeURIComponent(item.instance)}`} className="mono" style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>{item.instance}</Link>
                          : <span className="mono" style={{ fontSize: 13, color: 'var(--text-muted)' }}>—</span>}
                      </td>
                      <td style={{ padding: '14px 18px' }}>
                        <span className="mono" style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>{fmtDate(item.created)}</span>
                      </td>
                      <td style={{ padding: '14px 18px' }}>
                        <span className="mono" style={{ fontSize: 12, lineHeight: 1 }}>
                          {fmtMpSize(item.diskSpace)
                            ? <span style={{ color: 'var(--text-primary)' }}>{fmtMpSize(item.diskSpace)}</span>
                            : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                        </span>
                      </td>
                      <td style={{ padding: '14px 18px' }}>
                        <span className="mono" style={{ fontSize: 12, lineHeight: 1 }}>
                          {fmtMpSize(item.memSize)
                            ? <span style={{ color: 'var(--text-primary)' }}>{fmtMpSize(item.memSize)}</span>
                            : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                        </span>
                      </td>
                      <td style={{ padding: '14px 18px', maxWidth: 240 }}>
                        <span className="mono" style={{ fontSize: 11.5, color: 'var(--text-secondary)', display: 'inline-block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
                          {item.comment || '—'}
                        </span>
                      </td>
                      <td style={{ padding: '14px 18px' }}>
                        {item.instance && item.snapshot ? (
                          <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                            <ActionBtn icon={<History size={14} />} color="#a78bfa" label="Restore" disabled={busy} onClick={() => doRestore(item)} />
                            <ActionBtn icon={<Trash2 size={14} />}  color="var(--stopped)" label="Delete" disabled={busy} onClick={() => setDeleteTarget(item)} />
                          </div>
                        ) : (
                          <span className="mono" style={{ fontSize: 11, color: 'var(--text-secondary)' }}>—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
        )
      )}

      {/* Cards view */}
      {viewMode === 'cards' && (
        isLoading ? (
          <SkeletonCards count={6} />
        ) : (
        filtered.length === 0 ? (
          <div style={{ background: 'var(--card-1)', borderRadius: 'var(--r-card)', border: '1px dashed var(--border)', padding: '32px 24px', textAlign: 'center' }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{query.trim() ? `No snapshots match "${query}"` : 'No snapshots'}</p>
          </div>
        ) : (
          <div className="instances-cards-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(320px, 100%), 1fr))', gap: 12 }}>
            {filtered.map((item) => (
              <SnapshotCard
                key={item.id}
                item={item}
                selected={selectedRefs.has(item.ref)}
                onSelect={() => toggleSelect(item.ref)}
                busy={busyRef === item.ref}
                onRestore={() => doRestore(item)}
                onDelete={() => setDeleteTarget(item)}
              />
            ))}
          </div>
        )
        )
      )}

      {/* Modals */}
      {createOpen && (
        <CreateSnapshotModal
          instances={instances}
          onClose={() => setCreateOpen(false)}
          onConfirm={(instance, name, comment) =>
            runMutation(() => api.createSnapshot(instance, name, comment), `Snapshot created on ${instance}`)
          }
        />
      )}

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
              await runMutation(() => api.deleteSnapshot(deleteTarget.instance, deleteTarget.snapshot), `Deleted ${deleteTarget.ref}`)
              setDeleteTarget(null)
            } finally { setBusyRef('') }
          }}
        />
      )}

      {confirmBulkDel && (
        <ConfirmModal
          title={`Delete ${selectedItems.length} snapshots`}
          description="Selected snapshots will be permanently deleted."
          confirmLabel="Delete all"
          variant="confirm"
          onClose={() => setConfirmBulkDel(false)}
          onConfirm={() => { doBulkDelete(); setConfirmBulkDel(false) }}
        />
      )}
    </div>
  )
}
