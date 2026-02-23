import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, X } from 'lucide-react'
import { api } from '../api/client'
import { SkeletonTable } from '../components/Skeletons'
import CustomSelect from '../components/CustomSelect'

const STATUS_FILTERS = ['ALL', 'success', 'error']

function fmtDate(ts) {
  if (!ts) return '—'
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString()
}

function activityStatusColor(status) {
  const normalized = String(status || '').toLowerCase()
  if (normalized === 'success') return 'var(--running)'
  if (normalized === 'error') return 'var(--stopped)'
  return 'var(--text-secondary)'
}

export default function Logs() {
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [actionFilter, setActionFilter] = useState('ALL')
  const [search, setSearch] = useState('')

  const activityQuery = useQuery({
    queryKey: ['activity', 'logs-page'],
    queryFn: () => api.getActivity(1000),
    refetchInterval: 15000,
    retry: false,
  })

  const activity = activityQuery.data?.activity || []

  const actionFilters = useMemo(() => {
    const actions = Array.from(
      new Set(
        activity
          .map((entry) => String(entry.action || '').trim())
          .filter(Boolean),
      ),
    )
    return ['ALL', ...actions]
  }, [activity])
  const actionOptions = useMemo(
    () => actionFilters.map((action) => ({
      value: action,
      label: action === 'ALL' ? 'All actions' : action,
    })),
    [actionFilters],
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return activity.filter((entry) => {
      const status = String(entry.status || '').toLowerCase()
      if (statusFilter !== 'ALL' && status !== statusFilter) return false
      const action = String(entry.action || '').trim()
      if (actionFilter !== 'ALL' && action !== actionFilter) return false
      if (!q) return true
      const hay = [
        entry.action,
        entry.vm_name,
        entry.status,
        entry.error,
      ].join(' ').toLowerCase()
      return hay.includes(q)
    })
  }, [activity, statusFilter, actionFilter, search])

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 className="page-title">Activity</h1>
        </div>
      </div>

      <div className="instances-controls" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
        <div className="instances-state-filters" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', flex: '1 1 300px' }}>
          {STATUS_FILTERS.map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`filter-pill${statusFilter === status ? ' active' : ''}`}
            >
              {status}
            </button>
          ))}
        </div>
        <div className="instances-controls-right" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginLeft: 'auto' }}>
          <div
            className="instances-search-control"
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              background: 'var(--card-2)', border: '1px solid var(--border)',
              borderRadius: 'var(--r-sm)', padding: '0 10px', height: 36,
              width: 'clamp(150px, 22vw, 220px)',
            }}
          >
            <Search size={12} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search activity..."
              style={{
                background: 'none', border: 'none', outline: 'none',
                color: 'var(--text-primary)', fontFamily: 'IBM Plex Mono', fontSize: 12,
                width: '100%',
              }}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}
              >
                <X size={11} />
              </button>
            )}
          </div>
          <CustomSelect
            value={actionFilter}
            onChange={setActionFilter}
            options={actionOptions}
            controlHeight={36}
            searchable
            style={{ minWidth: 140, width: 'clamp(160px, 24vw, 240px)', flex: '0 1 auto' }}
          />
        </div>
      </div>

      {activityQuery.isLoading ? (
        <SkeletonTable
          cols={[{ w: 160 }, { w: 180 }, { w: 180 }, { w: 120 }, { w: 420 }]}
          rows={8}
          minWidth={1060}
        />
      ) : activityQuery.isError ? (
        <div className="card">
          <p className="mono" style={{ margin: 0, fontSize: 12, color: 'var(--stopped)' }}>
            {activityQuery.error?.message || 'Failed to load activity'}
          </p>
        </div>
      ) : (
        <div className="instances-table-shell" style={{ background: 'var(--card-1)', borderRadius: 'var(--r-card)', border: '1px solid var(--border)', overflow: 'visible' }}>
          <div className="instances-table-scroll no-scrollbar" style={{ overflowX: 'auto', overflowY: 'visible' }}>
            <table style={{ width: '100%', minWidth: 1060, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Time', 'Action', 'Instance', 'Status', 'Error'].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: '12px 18px',
                        textAlign: 'left',
                        fontSize: 10.5,
                        fontWeight: 700,
                        color: 'var(--text-secondary)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '28px 18px', textAlign: 'center' }}>
                      <p className="mono" style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>
                        No activity for current filters.
                      </p>
                    </td>
                  </tr>
                ) : filtered.map((entry, idx) => (
                  <tr key={entry.timestamp || `${entry.vm_name || ''}-${entry.action || ''}-${idx}`} style={{ borderBottom: idx < filtered.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <td style={{ padding: '13px 18px' }}>
                      <span className="mono" style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>{fmtDate(entry.timestamp)}</span>
                    </td>
                    <td style={{ padding: '13px 18px' }}>
                      <span className="mono" style={{ fontSize: 11.5, color: 'var(--text-primary)', fontWeight: 700 }}>
                        {entry.action || '—'}
                      </span>
                    </td>
                    <td style={{ padding: '13px 18px' }}>
                      <span className="mono" style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                        {entry.vm_name || '—'}
                      </span>
                    </td>
                    <td style={{ padding: '13px 18px' }}>
                      <span className="mono" style={{ fontSize: 11.5, color: activityStatusColor(entry.status), fontWeight: 700 }}>
                        {entry.status || '—'}
                      </span>
                    </td>
                    <td style={{ padding: '13px 18px', maxWidth: 500 }}>
                      <span className="mono" style={{ fontSize: 11.5, color: 'var(--text-secondary)', wordBreak: 'break-word' }}>
                        {entry.error || '—'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
