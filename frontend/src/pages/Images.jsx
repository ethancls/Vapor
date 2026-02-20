import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { RefreshCw, Image as ImageIcon } from 'lucide-react'
import { api } from '../api/client'
import CustomSelect from '../components/CustomSelect'

function safeEntries(input) {
  if (!input) return []
  if (Array.isArray(input)) {
    return input
      .map((item, index) => [String(item?.name || item?.image || item?.alias || item?.id || `item-${index}`), item])
      .filter(([key]) => Boolean(key))
  }
  if (typeof input === 'object') return Object.entries(input)
  return []
}

function parseVersionName(name) {
  const match = /^(\d+)\.(\d+)$/.exec(String(name))
  if (!match) return null
  return { major: Number(match[1]), minor: Number(match[2]) }
}

function latestStableImageName(rawImages) {
  let latest = null
  for (const [name, meta] of rawImages) {
    if (meta?.remote) continue
    const version = parseVersionName(name)
    if (!version) continue
    if (!latest || version.major > latest.version.major || (version.major === latest.version.major && version.minor > latest.version.minor)) {
      latest = { name, version }
    }
  }
  return latest?.name || null
}

function groupFromItem(name, meta = {}) {
  if (meta.remote === 'appliance' || name.startsWith('appliance:')) return 'Appliances'
  if (meta.remote === 'daily' || name.startsWith('daily:')) return 'Daily'
  if (name === 'core' || name.startsWith('core')) return 'Ubuntu Core'
  return 'Images'
}

function getTag(name, meta = {}, latestName = null) {
  const aliases = Array.isArray(meta.aliases) ? meta.aliases : []
  const release = String(meta.release || '')
  if (latestName && name === latestName) return 'latest'
  if (/\blts\b/i.test(release) || aliases.includes('lts')) return 'lts'
  if (meta.remote === 'daily' || name.startsWith('daily:')) return 'daily'
  if (meta.remote === 'appliance' || name.startsWith('appliance:')) return 'app'
  return ''
}

function getDescription(meta = {}) {
  return [meta.os, meta.release].filter(Boolean).join(' ').trim()
}

function normalizeImages(payload) {
  const catalog = payload && typeof payload === 'object' && payload.images ? payload.images : payload
  if (!catalog || typeof catalog !== 'object') return []
  const rawImages = safeEntries(catalog.images)
  const rawBlueprints = safeEntries(catalog['blueprints (deprecated)'] || catalog.blueprints)
  const latestName = latestStableImageName(rawImages)

  const images = rawImages.map(([name, meta]) => ({
    id: `img:${name}`,
    name,
    group: groupFromItem(name, meta),
    description: getDescription(meta),
    tag: getTag(name, meta, latestName),
    aliases: Array.isArray(meta?.aliases) ? meta.aliases : [],
  }))

  const blueprints = rawBlueprints.map(([name, meta]) => ({
    id: `bp:${name}`,
    name,
    group: 'Blueprints',
    description: getDescription(meta),
    tag: 'legacy',
    aliases: Array.isArray(meta?.aliases) ? meta.aliases : [],
  }))

  return [...images, ...blueprints].sort((a, b) => a.name.localeCompare(b.name))
}

export default function Images() {
  const [query, setQuery] = useState('')
  const [groupFilter, setGroupFilter] = useState('all')

  const imagesQuery = useQuery({
    queryKey: ['images-catalog'],
    queryFn: () => api.getImages(),
    staleTime: 5 * 60 * 1000,
  })

  const entries = useMemo(() => normalizeImages(imagesQuery.data), [imagesQuery.data])
  const groups = useMemo(() => [...new Set(entries.map((item) => item.group))].sort((a, b) => a.localeCompare(b)), [entries])
  const groupOptions = useMemo(() => [{ value: 'all', label: 'All categories' }, ...groups.map((group) => ({ value: group, label: group }))], [groups])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return entries.filter((item) => {
      if (groupFilter !== 'all' && item.group !== groupFilter) return false
      if (!q) return true
      const haystack = [item.name, item.description, item.group, item.aliases.join(' '), item.tag].join(' ').toLowerCase()
      return haystack.includes(q)
    })
  }, [entries, query, groupFilter])

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 className="page-title">Images</h1>
          <p className="mono" style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 7 }}>
            {entries.length} image{entries.length !== 1 ? 's' : ''} in catalog
          </p>
        </div>
        <button className="btn-ghost" onClick={() => imagesQuery.refetch()}>
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
            placeholder="Search images"
            style={{
              background: 'none', border: 'none', outline: 'none',
              color: 'var(--text-primary)', fontFamily: 'IBM Plex Mono', fontSize: 12,
              width: '100%',
            }}
          />
        </div>
        <CustomSelect
          value={groupFilter}
          onChange={setGroupFilter}
          options={groupOptions}
          controlHeight={36}
          style={{ minWidth: 170, width: 'clamp(170px, 24vw, 230px)' }}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 26 }}>
          <p className="mono" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            {query.trim() ? `No images match "${query}"` : 'No images available'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(260px, 100%), 1fr))', gap: 12 }}>
          {filtered.map((item) => (
            <div key={item.id} className="card" style={{ padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start', marginBottom: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <p className="mono" style={{
                    fontSize: 13, color: 'var(--text-primary)', fontWeight: 700,
                    lineHeight: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {item.name}
                  </p>
                  <p style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 6 }}>
                    {item.group}
                  </p>
                </div>
                {item.tag ? (
                  <span style={{
                    fontSize: 10, background: 'var(--accent-dim)', color: 'var(--accent)',
                    border: '1px solid var(--accent-border)', borderRadius: 5, padding: '2px 6px',
                    fontFamily: 'Syne', fontWeight: 700, whiteSpace: 'nowrap',
                  }}>
                    {item.tag}
                  </span>
                ) : (
                  <ImageIcon size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                )}
              </div>

              <p className="mono" style={{ fontSize: 11.5, color: 'var(--text-secondary)', lineHeight: 1.45, minHeight: 32 }}>
                {item.description || 'No description'}
              </p>

              {item.aliases.length > 0 && (
                <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {item.aliases.slice(0, 4).map((alias) => (
                    <span
                      key={`${item.id}-${alias}`}
                      className="mono"
                      style={{
                        fontSize: 10.5,
                        color: 'var(--text-secondary)',
                        background: 'var(--card-2)',
                        border: '1px solid var(--border)',
                        borderRadius: 999,
                        padding: '3px 7px',
                        lineHeight: 1,
                      }}
                    >
                      {alias}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
