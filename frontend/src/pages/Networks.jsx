import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { RefreshCw, Network } from 'lucide-react'
import { api } from '../api/client'
import CustomSelect from '../components/CustomSelect'

function toText(value) {
  if (value == null) return ''
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) return value.map((entry) => toText(entry)).filter(Boolean).join(', ')
  return ''
}

function stringifyValue(value) {
  if (value == null || value === '') return '—'
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) return value.map((entry) => stringifyValue(entry)).join(', ')
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function normalizeNetwork(item, index) {
  const data = item && typeof item === 'object' ? item : {}
  const name = toText(data.name || data.interface || data.id || data.network || `network-${index}`)
  const type = toText(data.type || data.kind || data.mode || 'unknown')
  const description = toText(data.description || data.note || data.driver || '')
  const status = toText(data.status || data.state || data.link_state || '')
  const ipv4 = toText(data.ipv4 || data.address || data.gateway || data.addresses || '')

  const details = Object.entries(data)
    .filter(([_, value]) => value != null && value !== '')
    .map(([key, value]) => ({ key, value: stringifyValue(value) }))

  return {
    id: name || `network-${index}`,
    name: name || `network-${index}`,
    type,
    description,
    status,
    ipv4,
    details,
  }
}

export default function Networks() {
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')

  const networksQuery = useQuery({
    queryKey: ['networks'],
    queryFn: () => api.getNetworks(),
    refetchInterval: 30000,
  })

  const networks = useMemo(
    () => (networksQuery.data?.networks || []).map((item, index) => normalizeNetwork(item, index)),
    [networksQuery.data],
  )

  const typeOptions = useMemo(() => {
    const allTypes = [...new Set(networks.map((item) => item.type).filter(Boolean))].sort((a, b) => a.localeCompare(b))
    return [{ value: 'all', label: 'All types' }, ...allTypes.map((type) => ({ value: type, label: type }))]
  }, [networks])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return networks.filter((item) => {
      if (typeFilter !== 'all' && item.type !== typeFilter) return false
      if (!q) return true
      const haystack = [item.name, item.type, item.description, item.status, item.ipv4]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [networks, query, typeFilter])

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 className="page-title">Networks</h1>
          <p className="mono" style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 7 }}>
            {networks.length} network{networks.length !== 1 ? 's' : ''} available on host
          </p>
        </div>
        <button className="btn-ghost" onClick={() => networksQuery.refetch()}>
          <RefreshCw size={13} /> Refresh
        </button>
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
            placeholder="Search networks"
            style={{
              background: 'none', border: 'none', outline: 'none',
              color: 'var(--text-primary)', fontFamily: 'IBM Plex Mono', fontSize: 12,
              width: '100%',
            }}
          />
        </div>
        <CustomSelect
          value={typeFilter}
          onChange={setTypeFilter}
          options={typeOptions}
          controlHeight={36}
          style={{ minWidth: 170, width: 'clamp(170px, 24vw, 230px)' }}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 26 }}>
          <p className="mono" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            {query.trim() ? `No networks match "${query}"` : 'No networks available'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))', gap: 12 }}>
          {filtered.map((item) => (
            <div key={item.id} className="card" style={{ padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <p className="mono" style={{
                    fontSize: 13, fontWeight: 700, lineHeight: 1, color: 'var(--text-primary)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {item.name}
                  </p>
                  <p style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 6 }}>
                    {item.description || 'No description'}
                  </p>
                </div>
                <span className="badge" style={{
                  background: 'var(--accent-dim)',
                  borderColor: 'var(--accent-border)',
                  color: 'var(--accent)',
                }}>
                  <span className="badge-dot" style={{ background: 'var(--accent)' }} />
                  {item.type || 'unknown'}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, marginBottom: 10 }}>
                <div style={{ background: 'var(--card-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 10px' }}>
                  <p className="section-label" style={{ marginBottom: 5 }}>Status</p>
                  <p className="mono" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{item.status || '—'}</p>
                </div>
                <div style={{ background: 'var(--card-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 10px' }}>
                  <p className="section-label" style={{ marginBottom: 5 }}>Address</p>
                  <p className="mono" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{item.ipv4 || '—'}</p>
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                <p className="section-label" style={{ marginBottom: 8 }}>Details</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 6 }}>
                  {item.details.slice(0, 8).map((entry) => (
                    <div key={`${item.id}-${entry.key}`} style={{ minWidth: 0 }}>
                      <p style={{
                        fontSize: 10.5, color: 'var(--text-muted)', margin: 0,
                        textTransform: 'uppercase', letterSpacing: '0.07em',
                      }}>
                        {entry.key}
                      </p>
                      <p className="mono" style={{
                        fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 3, marginBottom: 0,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {entry.value}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end', color: 'var(--text-muted)' }}>
                <Network size={13} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
