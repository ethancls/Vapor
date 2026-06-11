import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, X, Network } from 'lucide-react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import CustomSelect from '../components/CustomSelect'
import { SkeletonTable } from '../components/Skeletons'
import BrandIcon from '../components/BrandIcon'
import ContainerDataTable from '../components/ContainerDataTable'

function StatusBadge({ status }) {
  const cfg = {
    up:      { bg: 'transparent',            color: 'var(--running)',    border: 'var(--accent-border)', dot: 'var(--running)' },
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
  if (!names || !names.length) return <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>—</span>
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

function networkName(item) {
  const name = item.name || '-'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ 
        width: 28, height: 28, borderRadius: 6, background: 'var(--card-2)', 
        display: 'flex', alignItems: 'center', justifyContent: 'center', 
        border: '1px solid var(--border)', flexShrink: 0 
      }}>
        <BrandIcon name={name} type="network" size={16} />
      </div>
      <span className="mono" style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>{name}</span>
    </div>
  )
}

export default function Networks() {
  const [query, setQuery]           = useState('')
  const [typeFilter, setTypeFilter] = useState('all')

  const { data, isLoading } = useQuery({
    queryKey: ['networks'],
    queryFn: () => api.getNetworks(),
    refetchInterval: 30000,
  })

  const networks = data?.networks || []

  const typeOptions = useMemo(() => {
    const types = [...new Set(networks.map((n) => n.type).filter(Boolean))].sort()
    return [{ value: 'all', label: 'All types' }, ...types.map((t) => ({ value: t, label: t }))]
  }, [networks])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return networks.filter((n) => {
      if (typeFilter !== 'all' && n.type !== typeFilter) return false
      if (!q) return true
      return [n.name, n.type, n.status, n.address].join(' ').toLowerCase().includes(q)
    })
  }, [networks, query, typeFilter])

  return (
    <div className="page">
      <div className="instances-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 className="page-title">Networks</h1>
        </div>
      </div>

      <div className="instances-controls" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
        <div className="instances-state-filters" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', flex: '1 1 280px' }}>
          <button className="filter-pill active" type="button">All <span className="pill-count">{networks.length}</span></button>
        </div>
        <div className="instances-controls-right" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginLeft: 'auto' }}>
          <div className="instances-search-control" style={{
            display: 'flex', alignItems: 'center', gap: 7,
            background: 'var(--card-1)', border: '1px solid var(--border)',
            borderRadius: 'var(--r-sm)', padding: '0 10px', height: 36,
            width: 'clamp(150px, 22vw, 220px)',
          }}>
            <Search size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search networks..."
              style={{ background: 'none', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: 13, width: '100%' }}
            />
            {query && (
              <button onClick={() => setQuery('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
                <X size={14} />
              </button>
            )}
          </div>

          <CustomSelect
            value={typeFilter}
            onChange={setTypeFilter}
            options={typeOptions}
            controlHeight={38}
            style={{ width: 160 }}
          />
        </div>
      </div>

      {isLoading ? (
        <SkeletonTable cols={[{ w: 140 }, { w: 80 }, { w: 70 }, { w: 140 }, { w: 180 }]} rows={5} />
      ) : (
        <ContainerDataTable
          items={filtered}
          empty={query.trim() ? `No networks match "${query}"` : 'No networks available'}
          columns={[
            { key: 'name', label: 'Name', accent: false, render: networkName },
            { key: 'type', label: 'Type', render: (item) => <span className="badge" style={{ background: 'var(--accent-dim)', color: 'var(--accent)', borderColor: 'var(--accent-border)' }}>{item.type}</span> },
            { key: 'status', label: 'Status', render: (item) => <StatusBadge status={item.status} /> },
            { key: 'address', label: 'Address', render: (item) => item.address || '—' },
            { key: 'instances', label: 'Instances', render: (item) => <InstancePills names={item.instances} /> },
          ]}
        />
      )}
    </div>
  )
}
