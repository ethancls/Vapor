import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Package, CircleArrowUp, Loader2, Search, X, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import { sileo } from 'sileo'
import { api } from '../api/client'
import Tooltip from '../components/Tooltip'
import { SkeletonTable } from '../components/Skeletons'
import UpdatesModal from '../components/instances/UpdatesModal'
import InstanceStateBadge from '../components/instances/InstanceStateBadge'

const STATUS_FILTERS = [
  { key: 'all',       label: 'All'          },
  { key: 'outdated',  label: 'Needs updates' },
  { key: 'uptodate',  label: 'Up to date'   },
  { key: 'unchecked', label: 'Not checked'  },
]

const COLUMNS = [
  { key: 'instance',        label: 'Instance'  },
  { key: 'state',           label: 'State'     },
  { key: 'upgradable',      label: 'Updates'   },
  { key: 'security',        label: 'Security'  },
  { key: 'reboot_required', label: 'Reboot'    },
  { key: null,              label: 'Actions'   },
]

const SKEL_COLS = [
  { w: 120 },
  { w: 60  },
  { w: 30  },
  { w: 30  },
  { w: 55  },
  { w: 120 },
]

function SortTh({ col, sort, onSort, children }) {
  const active = sort.key === col.key
  const Icon = active ? (sort.dir === 'asc' ? ChevronUp : ChevronDown) : ChevronsUpDown
  return (
    <th
      onClick={() => col.key && onSort(col.key)}
      style={{
        padding: '12px 18px', textAlign: 'left',
        fontSize: 10.5, fontWeight: 700, whiteSpace: 'nowrap',
        color: active ? 'var(--accent)' : 'var(--text-secondary)',
        textTransform: 'uppercase', letterSpacing: '0.08em',
        cursor: col.key ? 'pointer' : 'default', userSelect: 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {children}
        {col.key && <Icon size={11} style={{ opacity: active ? 1 : 0.4, flexShrink: 0 }} />}
      </div>
    </th>
  )
}

function ActionIconButton({ icon, color, label, onClick, disabled = false, isLoading = false }) {
  return (
    <Tooltip label={label}>
      <button
        type="button"
        aria-label={label}
        aria-disabled={isLoading || disabled}
        onClick={!isLoading && !disabled ? onClick : undefined}
        style={{
          width: 34, height: 34, borderRadius: 9, border: 'none',
          background: 'transparent', color: disabled && !isLoading ? 'var(--text-muted)' : color,
          cursor: isLoading || disabled ? 'default' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'background 0.12s, color 0.12s, opacity 0.12s',
          flexShrink: 0,
          opacity: disabled && !isLoading ? 0.3 : 1,
        }}
        onMouseEnter={(e) => { if (!disabled && !isLoading) e.currentTarget.style.background = `color-mix(in srgb, ${color} 12%, transparent)` }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
      >
        {isLoading
          ? (
            <Loader2
              size={14}
              style={{
                animation: 'spin 0.7s linear infinite',
                transformOrigin: '50% 50%',
                backfaceVisibility: 'hidden',
                transform: 'translateZ(0)',
                display: 'block',
              }}
            />
          )
          : icon}
      </button>
    </Tooltip>
  )
}

export default function Updates() {
  const qc = useQueryClient()
  const [filter, setFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState({ key: 'instance', dir: 'asc' })
  const [busyInstance, setBusyInstance] = useState('')
  const [busyAll, setBusyAll] = useState(false)
  const [previewInstance, setPreviewInstance] = useState('')

  const updatesQuery = useQuery({
    queryKey: ['updates'],
    queryFn: () => api.getUpdates(),
    refetchInterval: 60000,
  })

  const items = updatesQuery.data?.updates || []

  const counts = useMemo(() => ({
    all:       items.length,
    outdated:  items.filter((i) => (i.upgradable || 0) > 0).length,
    uptodate:  items.filter((i) => i.checked && (i.upgradable || 0) === 0).length,
    unchecked: items.filter((i) => !i.checked).length,
  }), [items])

  const updatableInstances = useMemo(
    () => items
      .filter((item) => (item.upgradable || 0) > 0 && item.checked && item.state === 'Running')
      .map((item) => item.instance),
    [items],
  )

  function toggleSort(key) {
    setSort((s) => s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' })
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = items.filter((item) => {
      if (filter === 'outdated'  && (item.upgradable || 0) === 0)                     return false
      if (filter === 'uptodate'  && (!item.checked || (item.upgradable || 0) > 0))    return false
      if (filter === 'unchecked' && item.checked)                                      return false
      if (!q) return true
      return [item.instance, item.state, item.error, item.source].join(' ').toLowerCase().includes(q)
    })
    return [...list].sort((a, b) => {
      if (!sort.key) return 0
      const av = a[sort.key] ?? ''
      const bv = b[sort.key] ?? ''
      const cmp = typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv))
      return sort.dir === 'asc' ? cmp : -cmp
    })
  }, [items, filter, query, sort])

  async function runUpdates(instance) {
    setBusyInstance(instance)
    try {
      const result = await api.runInstanceUpdates(instance, {
        full_upgrade: false,
        refresh: true,
        autoremove: true,
      })
      const remaining = Number(result?.upgradable_remaining || 0)
      await Promise.all([
        updatesQuery.refetch(),
        qc.invalidateQueries({ queryKey: ['instance-updates', instance] }),
        qc.invalidateQueries({ queryKey: ['activity'] }),
      ])
      if (result?.checked === false) {
        sileo.warning({
          title: 'Updates completed, verification failed',
          description: result?.error || 'Could not verify remaining updates.',
        })
      } else if (result?.checked === true && remaining > 0) {
        sileo.warning({
          title: 'Updates completed with pending packages',
          description: `${remaining} update${remaining > 1 ? 's' : ''} still pending on ${instance}.`,
        })
      } else {
        sileo.success({ title: `Updates completed on ${instance}` })
      }
    } catch (err) {
      const details = typeof err?.message === 'string' && err.message.trim()
        ? err.message.trim()
        : `Failed to update ${instance}`
      sileo.error({
        title: 'Updates error',
        description: details,
        button: {
          title: 'Copy',
          onClick: () => {
            if (!navigator?.clipboard?.writeText) return
            navigator.clipboard.writeText(details).catch(() => {})
          },
        },
      })
    } finally {
      setBusyInstance('')
    }
  }

  async function runAllUpdates() {
    if (!updatableInstances.length) return
    setBusyAll(true)
    try {
      const results = await Promise.allSettled(
        updatableInstances.map((instance) => api.runInstanceUpdates(instance, {
          full_upgrade: false,
          refresh: true,
          autoremove: true,
        })),
      )
      await Promise.all([
        updatesQuery.refetch(),
        qc.invalidateQueries({ queryKey: ['instance-updates'] }),
        qc.invalidateQueries({ queryKey: ['activity'] }),
      ])

      const successCount = results.filter((r) => r.status === 'fulfilled').length
      const failed = results.filter((r) => r.status === 'rejected')
      const failCount = failed.length

      if (failCount === 0) {
        sileo.success({ title: `Updates completed on ${successCount} instance${successCount > 1 ? 's' : ''}` })
      } else if (successCount > 0) {
        const firstError = failed[0]?.reason?.message || 'One or more updates failed'
        sileo.error({
          title: `Updates finished with ${failCount} failure${failCount > 1 ? 's' : ''}`,
          description: firstError,
        })
      } else {
        const firstError = failed[0]?.reason?.message || 'Failed to run updates'
        sileo.error({ title: 'Updates error', description: firstError })
      }
    } finally {
      setBusyAll(false)
    }
  }

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 className="page-title">Updates</h1>
        </div>
        <button
          className="btn-accent"
          onClick={runAllUpdates}
          disabled={busyAll || busyInstance !== '' || updatableInstances.length === 0}
        >
          {busyAll
            ? <><Loader2 size={13} style={{ animation: 'spin 0.7s linear infinite' }} /> Updating…</>
            : <><CircleArrowUp size={13} /> Update All</>}
        </button>
      </div>

      {!updatesQuery.isLoading && (
      <div className="instances-controls" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
        <div className="instances-state-filters" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', flex: '1 1 280px' }}>
          {STATUS_FILTERS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`filter-pill${filter === key ? ' active' : ''}`}
            >
              {label}
              <span className="pill-count">{counts[key] ?? 0}</span>
            </button>
          ))}
        </div>
        <div className="instances-controls-right" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginLeft: 'auto' }}>
          <div className="instances-search-control" style={{
            display: 'flex', alignItems: 'center', gap: 7,
            background: 'var(--card-2)', border: '1px solid var(--border)',
            borderRadius: 'var(--r-sm)', padding: '0 10px', height: 36,
            width: 'clamp(150px, 22vw, 220px)',
          }}>
            <Search size={12} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search updates..."
              style={{
                background: 'none', border: 'none', outline: 'none',
                color: 'var(--text-primary)', fontFamily: 'IBM Plex Mono', fontSize: 12,
                width: '100%',
              }}
            />
            {query && (
              <button onClick={() => setQuery('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}>
                <X size={11} />
              </button>
            )}
          </div>
        </div>
      </div>
      )}

      {updatesQuery.isLoading ? (
        <SkeletonTable cols={SKEL_COLS} rows={5} minWidth={860} />
      ) : (
      <div className="instances-table-shell" style={{ background: 'var(--card-1)', borderRadius: 'var(--r-card)', border: '1px solid var(--border)', overflow: 'visible' }}>
        <div className="instances-table-scroll no-scrollbar" style={{ overflowX: 'auto', overflowY: 'visible' }}>
          <table style={{ width: '100%', minWidth: 860, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {COLUMNS.map((col) => (
                  <SortTh key={col.label} col={col} sort={sort} onSort={toggleSort}>{col.label}</SortTh>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: '34px 18px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
                    {query.trim() ? `No instances match "${query}"` : 'No instances'}
                  </td>
                </tr>
              )}
              {filtered.map((item, idx) => {
                const outdated = (item.upgradable || 0) > 0
                const blocked = !item.checked
                const runEnabled = outdated && !blocked && item.state === 'Running'
                const runColor = runEnabled ? '#22d3ee' : 'var(--text-muted)'
                const runDisabled = busyAll || !runEnabled || busyInstance === item.instance
                const runLabel = busyInstance === item.instance
                  ? 'Running updates…'
                  : runEnabled
                    ? 'Run updates'
                    : 'No updates'
                const inspectEnabled = outdated && !blocked
                const inspectColor = inspectEnabled ? '#22d3ee' : 'var(--text-muted)'
                const inspectLabel = inspectEnabled ? 'View packages' : 'No updates'
                return (
                  <tr
                    key={item.instance}
                    style={{ borderBottom: idx < filtered.length - 1 ? '1px solid var(--border)' : 'none', transition: 'background 0.1s' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.018)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                  >
                    <td style={{ padding: '14px 18px' }}>
                      <Link to={`/instances/${encodeURIComponent(item.instance)}`} className="mono" style={{ fontSize: 12.5, color: 'var(--accent)', fontWeight: 700 }}>
                        {item.instance}
                      </Link>
                    </td>
                    <td style={{ padding: '14px 18px' }}>
                      <InstanceStateBadge state={item.state} />
                    </td>
                    <td style={{ padding: '14px 18px' }}>
                      <span className="mono" style={{ fontSize: 12, color: outdated ? '#facc15' : 'var(--text-secondary)' }}>
                        {item.upgradable || 0}
                      </span>
                    </td>
                    <td style={{ padding: '14px 18px' }}>
                      <span className="mono" style={{ fontSize: 12, color: (item.security || 0) > 0 ? 'var(--stopped)' : 'var(--text-secondary)' }}>
                        {item.security || 0}
                      </span>
                    </td>
                    <td style={{ padding: '14px 18px' }}>
                      <span className="mono" style={{ fontSize: 11.5, color: item.reboot_required ? '#fb923c' : 'var(--text-secondary)' }}>
                        {item.reboot_required ? 'required' : 'no'}
                      </span>
                    </td>
                    <td style={{ padding: '14px 18px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <ActionIconButton
                          label={inspectLabel}
                          color={inspectColor}
                          disabled={!inspectEnabled}
                          onClick={() => setPreviewInstance(item.instance)}
                          icon={<Package size={14} />}
                        />
                        <ActionIconButton
                          label={runLabel}
                          color={runColor}
                          disabled={runDisabled}
                          isLoading={busyInstance === item.instance}
                          onClick={() => runUpdates(item.instance)}
                          icon={<CircleArrowUp size={14} />}
                        />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {previewInstance && (
        <UpdatesModal
          instanceName={previewInstance}
          onClose={() => setPreviewInstance('')}
        />
      )}
    </div>
  )
}
