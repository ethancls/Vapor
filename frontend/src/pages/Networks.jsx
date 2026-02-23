import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, X, Table2, Grid3X3, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import CustomSelect from '../components/CustomSelect'
import { SkeletonTable, SkeletonCards } from '../components/Skeletons'

function normalizeNetwork(item, index) {
  const data = item && typeof item === 'object' ? item : {}
  return {
    id:          data.name || `network-${index}`,
    name:        data.name || `network-${index}`,
    type:        data.type || 'unknown',
    description: data.description || '',
    status:      data.status || 'unknown',
    address:     data.address || '',
    instances:   Array.isArray(data.instances) ? data.instances : [],
  }
}

function StatusBadge({ status }) {
  const cfg = {
    up:      { bg: 'transparent',            color: 'var(--running)',    border: 'rgba(181,242,61,0.28)', dot: 'var(--running)' },
    down:    { bg: 'var(--card-2)',          color: 'var(--text-muted)', border: 'var(--border)',         dot: 'var(--text-muted)' },
    unknown: { bg: 'var(--card-2)',          color: 'var(--text-muted)', border: 'var(--border)',         dot: 'var(--text-muted)' },
  }[status] || { bg: 'var(--card-2)', color: 'var(--text-muted)', border: 'var(--border)', dot: 'var(--text-muted)' }

  return (
    <span className="badge" style={{ background: cfg.bg, color: cfg.color, borderColor: cfg.border }}>
      <span className="badge-dot" style={{ background: cfg.dot }} />
      {status === 'down' ? 'inactive' : status}
    </span>
  )
}

function InstancePills({ names, max = 3 }) {
  const [expanded, setExpanded] = useState(false)
  if (!names.length) return <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>—</span>
  const visible = expanded ? names : names.slice(0, max)
  const hidden = names.length - max
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
      {visible.map((name) => (
        <Link
          key={name}
          to={`/instances/${encodeURIComponent(name)}`}
          className="mono"
          style={{
            fontSize: 11, fontWeight: 700,
            background: 'var(--accent-dim)', color: 'var(--accent)',
            border: '1px solid var(--accent-border)', borderRadius: 6,
            padding: '2px 7px', textDecoration: 'none', whiteSpace: 'nowrap',
          }}
        >
          {name}
        </Link>
      ))}
      {!expanded && hidden > 0 && (
        <button
          onClick={(e) => { e.stopPropagation(); setExpanded(true) }}
          className="mono"
          style={{
            fontSize: 11, fontWeight: 700, cursor: 'pointer',
            background: 'var(--card-3)', color: 'var(--text-secondary)',
            border: '1px solid var(--border)', borderRadius: 6,
            padding: '2px 7px', whiteSpace: 'nowrap',
          }}
        >
          +{hidden}
        </button>
      )}
      {expanded && names.length > max && (
        <button
          onClick={(e) => { e.stopPropagation(); setExpanded(false) }}
          className="mono"
          style={{
            fontSize: 11, cursor: 'pointer',
            background: 'none', color: 'var(--text-muted)',
            border: 'none', padding: '2px 4px',
          }}
        >
          less
        </button>
      )}
    </div>
  )
}

const COLUMNS = [
  { key: 'name',      label: 'Name'      },
  { key: 'type',      label: 'Type'      },
  { key: 'status',    label: 'Status'    },
  { key: 'address',   label: 'Address'   },
  { key: 'instances', label: 'Instances' },
]

const SKEL_COLS = [
  { w: 110 },
  { w: 60, pill: true },
  { w: 70, pill: true },
  { w: 110 },
  { w: 140 },
]

function SortTh({ col, sort, onSort, children }) {
  const active = sort.key === col.key
  const Icon = active ? (sort.dir === 'asc' ? ChevronUp : ChevronDown) : ChevronsUpDown
  return (
    <th
      onClick={() => onSort(col.key)}
      style={{
        padding: '11px 18px', textAlign: 'left', cursor: 'pointer', userSelect: 'none',
        fontSize: 10.5, fontWeight: 700, whiteSpace: 'nowrap',
        color: active ? 'var(--accent)' : 'var(--text-secondary)',
        textTransform: 'uppercase', letterSpacing: '0.08em',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {children}
        <Icon size={11} style={{ opacity: active ? 1 : 0.4, flexShrink: 0 }} />
      </div>
    </th>
  )
}

function TableView({ networks }) {
  const [sort, setSort] = useState({ key: 'name', dir: 'asc' })

  function toggleSort(key) {
    setSort((s) => s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' })
  }

  const sorted = [...networks].sort((a, b) => {
    const av = sort.key === 'instances' ? a.instances.length : (a[sort.key] || '')
    const bv = sort.key === 'instances' ? b.instances.length : (b[sort.key] || '')
    const cmp = typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv))
    return sort.dir === 'asc' ? cmp : -cmp
  })

  return (
    <div className="instances-table-shell" style={{
      background: 'var(--card-1)', borderRadius: 'var(--r-card)',
      border: '1px solid var(--border)', overflow: 'visible',
    }}>
      <div className="instances-table-scroll no-scrollbar" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', minWidth: 700, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {COLUMNS.map((col) => (
                <SortTh key={col.key} col={col} sort={sort} onSort={toggleSort}>
                  {col.label}
                </SortTh>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length} style={{ padding: '32px 18px', textAlign: 'center' }}>
                  <span className="mono" style={{ fontSize: 12, color: 'var(--text-muted)' }}>No networks</span>
                </td>
              </tr>
            )}
            {sorted.map((item, i) => (
              <tr
                key={item.id}
                style={{ borderBottom: i < sorted.length - 1 ? '1px solid var(--border)' : 'none' }}
              >
                <td style={{ padding: '13px 18px' }}>
                  <span className="mono" style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                    {item.name}
                  </span>
                </td>
                <td style={{ padding: '13px 18px' }}>
                  <span className="badge" style={{ background: 'var(--accent-dim)', color: 'var(--accent)', borderColor: 'var(--accent-border)' }}>
                    {item.type}
                  </span>
                </td>
                <td style={{ padding: '13px 18px' }}>
                  <StatusBadge status={item.status} />
                </td>
                <td style={{ padding: '13px 18px' }}>
                  <span className="mono" style={{ fontSize: 12, color: item.address ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                    {item.address || '—'}
                  </span>
                </td>
                <td style={{ padding: '13px 18px' }}>
                  <InstancePills names={item.instances} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function CardsView({ networks }) {
  return (
    <div className="instances-cards-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(320px, 100%), 1fr))', gap: 12 }}>
      {networks.map((item) => (
        <div
          key={item.id}
          className="card"
          style={{ padding: 16, transition: 'border-color 0.18s, background 0.18s', boxSizing: 'border-box', height: '100%' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(181,242,61,0.22)'; e.currentTarget.style.background = 'var(--card-2)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--card-1)' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 14 }}>
            <div style={{ minWidth: 0 }}>
              <p className="mono" style={{ fontSize: 13, fontWeight: 700, lineHeight: 1, color: 'var(--text-primary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {item.name}
              </p>
              <div style={{ marginTop: 7 }}>
                <StatusBadge status={item.status} />
              </div>
            </div>
            <span className="badge" style={{ background: 'var(--accent-dim)', color: 'var(--accent)', borderColor: 'var(--accent-border)', flexShrink: 0 }}>
              {item.type}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10, marginBottom: 12 }}>
            <div className="stat-cell">
              <span className="stat-label">Type</span>
              <span className="mono stat-value" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                {item.type || '—'}
              </span>
            </div>
            <div className="stat-cell">
              <span className="stat-label">Address</span>
              <span className="mono stat-value" style={{ fontSize: 12, color: item.address ? 'var(--text-secondary)' : 'var(--text-muted)' }}>
                {item.address || '—'}
              </span>
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
            <p className="section-label" style={{ marginBottom: 7 }}>Instances</p>
            {item.instances.length > 0 ? <InstancePills names={item.instances} /> : <span className="mono" style={{ fontSize: 12, color: 'var(--text-muted)' }}>—</span>}
          </div>
        </div>
      ))}
    </div>
  )
}

export default function Networks() {
  const [query, setQuery]           = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [viewMode, setViewMode]     = useState('table')

  const { data, isLoading } = useQuery({
    queryKey: ['networks'],
    queryFn: () => api.getNetworks(),
    refetchInterval: 30000,
  })

  const networks = useMemo(
    () => (data?.networks || []).map((item, i) => normalizeNetwork(item, i)),
    [data],
  )

  const typeOptions = useMemo(() => {
    const types = [...new Set(networks.map((n) => n.type).filter(Boolean))].sort()
    return [{ value: 'all', label: 'All types' }, ...types.map((t) => ({ value: t, label: t }))]
  }, [networks])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return networks.filter((n) => {
      if (typeFilter !== 'all' && n.type !== typeFilter) return false
      if (!q) return true
      return [n.name, n.type, n.status, n.address, ...n.instances].join(' ').toLowerCase().includes(q)
    })
  }, [networks, query, typeFilter])

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 className="page-title">Networks</h1>
        </div>
      </div>

      <div className="instances-controls" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
        <div className="instances-state-filters" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', flex: '1 1 280px' }}>
          {isLoading ? (
            <span className="skeleton" style={{ display: 'inline-block', width: 62, height: 20, borderRadius: 999 }} />
          ) : (
            <span className="filter-pill active" style={{ cursor: 'default' }}>
              All
              <span className="pill-count">{networks.length}</span>
            </span>
          )}
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
              placeholder="Search networks..."
              style={{ background: 'none', border: 'none', outline: 'none', color: 'var(--text-primary)', fontFamily: 'IBM Plex Mono', fontSize: 12, width: '100%' }}
            />
            {query && (
              <button onClick={() => setQuery('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}>
                <X size={11} />
              </button>
            )}
          </div>

          <CustomSelect
            value={typeFilter}
            onChange={setTypeFilter}
            options={typeOptions}
            controlHeight={36}
            style={{ minWidth: 140, width: 'clamp(160px, 24vw, 240px)', flex: '0 1 auto' }}
          />

          <div className="instances-view-toggle" style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', overflow: 'hidden', height: 36 }}>
            {[
              { mode: 'table', Icon: Table2,  title: 'Table view'  },
              { mode: 'cards', Icon: Grid3X3, title: 'Cards view'  },
            ].map(({ mode, Icon, title }) => (
              <button
                key={mode}
                type="button"
                aria-label={title}
                className="btn-ghost"
                onClick={() => setViewMode(mode)}
                style={{
                  border: 'none', borderRadius: 0, height: '100%', padding: '0 12px',
                  background: viewMode === mode ? 'var(--accent-dim)' : 'transparent',
                  color: viewMode === mode ? 'var(--accent)' : 'var(--text-secondary)',
                }}
              >
                <Icon size={13} />
              </button>
            ))}
          </div>
        </div>
      </div>

      {isLoading ? (
        viewMode === 'table' ? (
          <SkeletonTable cols={SKEL_COLS} rows={5} minWidth={700} />
        ) : (
          <SkeletonCards count={6} />
        )
      ) : filtered.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 32 }}>
          <p className="mono" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            {query.trim() ? `No networks match "${query}"` : 'No networks available'}
          </p>
        </div>
      ) : viewMode === 'table' ? (
        <TableView networks={filtered} />
      ) : (
        <CardsView networks={filtered} />
      )}
    </div>
  )
}
