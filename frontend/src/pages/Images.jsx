import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, X, Table2, Grid3X3, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import { api } from '../api/client'
import CustomSelect from '../components/CustomSelect'
import { SkeletonTable, SkeletonCards } from '../components/Skeletons'

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
  if (!catalog || typeof catalog !== 'object') return { images: [], blueprints: [] }
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
    deprecated: false,
  })).sort((a, b) => a.name.localeCompare(b.name))

  const blueprints = rawBlueprints.map(([name, meta]) => ({
    id: `bp:${name}`,
    name,
    group: 'Blueprints',
    description: getDescription(meta),
    tag: 'deprecated',
    aliases: Array.isArray(meta?.aliases) ? meta.aliases : [],
    deprecated: true,
  })).sort((a, b) => a.name.localeCompare(b.name))

  return { images, blueprints }
}

const TAG_COLORS = {
  latest:     { bg: 'var(--accent-dim)', color: 'var(--accent)', border: 'var(--accent-border)' },
  lts:        { bg: 'rgba(96,165,250,0.12)', color: '#60a5fa', border: 'rgba(96,165,250,0.22)' },
  daily:      { bg: 'rgba(251,146,60,0.12)', color: '#fb923c', border: 'rgba(251,146,60,0.22)' },
  app:        { bg: 'rgba(167,139,250,0.12)', color: '#a78bfa', border: 'rgba(167,139,250,0.22)' },
  deprecated: { bg: 'rgba(255,68,68,0.08)', color: 'var(--stopped)', border: 'rgba(255,68,68,0.25)' },
}

function TagBadge({ tag }) {
  if (!tag) return null
  const cfg = TAG_COLORS[tag] || TAG_COLORS.legacy
  return (
    <span style={{
      fontSize: 10, background: cfg.bg, color: cfg.color,
      border: `1px solid ${cfg.border}`, borderRadius: 5, padding: '2px 6px',
      fontFamily: 'Syne', fontWeight: 700, whiteSpace: 'nowrap',
    }}>
      {tag}
    </span>
  )
}

const TABLE_COLUMNS = [
  { key: 'name',        label: 'Name'        },
  { key: 'group',       label: 'Category'    },
  { key: 'description', label: 'Description' },
  { key: 'tag',         label: 'Tag'         },
  { key: null,          label: 'Aliases'     },
]

const SKEL_COLS = [
  { w: 100 },
  { w: 70  },
  { w: 180 },
  { w: 44, pill: true },
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

function TableView({ images }) {
  const [sort, setSort] = useState({ key: 'name', dir: 'asc' })

  function toggleSort(key) {
    setSort((s) => s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' })
  }

  const sorted = [...images].sort((a, b) => {
    const av = a[sort.key] || ''
    const bv = b[sort.key] || ''
    const cmp = String(av).localeCompare(String(bv))
    return sort.dir === 'asc' ? cmp : -cmp
  })

  return (
    <div className="instances-table-shell" style={{ background: 'var(--card-1)', borderRadius: 'var(--r-card)', border: '1px solid var(--border)', overflow: 'visible' }}>
      <div className="instances-table-scroll no-scrollbar" style={{ overflowX: 'auto', overflowY: 'visible' }}>
        <table style={{ width: '100%', minWidth: 700, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {TABLE_COLUMNS.map((col) => (
                <SortTh key={col.label} col={col} sort={sort} onSort={toggleSort}>{col.label}</SortTh>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: '34px 18px', textAlign: 'center' }}>
                  <span className="mono" style={{ fontSize: 12, color: 'var(--text-muted)' }}>No images</span>
                </td>
              </tr>
            )}
            {sorted.map((item, idx) => (
              <tr
                key={item.id}
                style={{ borderBottom: idx < sorted.length - 1 ? '1px solid var(--border)' : 'none', transition: 'background 0.1s' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.018)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
              >
                <td style={{ padding: '13px 18px' }}>
                  <span className="mono" style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{item.name}</span>
                </td>
                <td style={{ padding: '13px 18px' }}>
                  <span className="mono" style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>{item.group}</span>
                </td>
                <td style={{ padding: '13px 18px', maxWidth: 300 }}>
                  <span className="mono" style={{
                    fontSize: 11.5, color: 'var(--text-secondary)',
                    display: 'inline-block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%',
                  }}>
                    {item.description || '—'}
                  </span>
                </td>
                <td style={{ padding: '13px 18px' }}>
                  <TagBadge tag={item.tag} />
                </td>
                <td style={{ padding: '13px 18px' }}>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    {item.aliases.slice(0, 4).map((alias) => (
                      <span
                        key={`${item.id}-${alias}`}
                        className="mono"
                        style={{
                          fontSize: 10.5,
                          color: 'var(--accent)',
                          background: 'var(--accent-dim)',
                          border: '1px solid var(--accent-border)',
                          borderRadius: 999,
                          padding: '2px 7px',
                          lineHeight: 1,
                        }}
                      >
                        {alias}
                      </span>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function CardsView({ images }) {
  return (
    <div className="instances-cards-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(320px, 100%), 1fr))', gap: 12 }}>
      {images.map((item) => (
        <div
          key={item.id}
          className="card"
          style={{ padding: 16, transition: 'border-color 0.18s, background 0.18s', boxSizing: 'border-box', height: '100%' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(181,242,61,0.22)'; e.currentTarget.style.background = 'var(--card-2)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--card-1)' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start', marginBottom: 14 }}>
            <p className="mono" style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 700, lineHeight: 1, margin: 0, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {item.name}
            </p>
            {item.tag && <TagBadge tag={item.tag} />}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10, marginBottom: 12 }}>
            <div className="stat-cell">
              <span className="stat-label">Category</span>
              <span className="mono stat-value" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{item.group}</span>
            </div>
            <div className="stat-cell">
              <span className="stat-label">Aliases</span>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 2 }}>
                {item.aliases.length === 0
                  ? <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>—</span>
                  : item.aliases.slice(0, 4).map(alias => (
                    <span key={alias} className="mono" style={{
                      fontSize: 10.5,
                      color: 'var(--accent)',
                      background: 'var(--accent-dim)',
                      border: '1px solid var(--accent-border)',
                      borderRadius: 999,
                      padding: '2px 7px',
                      lineHeight: 1,
                    }}>{alias}</span>
                  ))
                }
              </div>
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
            <p className="section-label" style={{ marginBottom: 7 }}>Description</p>
            <p className="mono" style={{ fontSize: 11.5, color: item.description ? 'var(--text-secondary)' : 'var(--text-muted)', lineHeight: 1.45, margin: 0 }}>
              {item.description || '—'}
            </p>
          </div>

        </div>
      ))}
    </div>
  )
}

export default function Images() {
  const [query, setQuery] = useState('')
  const [groupFilter, setGroupFilter] = useState('all')
  const [viewMode, setViewMode] = useState('table')
  const [showDeprecated, setShowDeprecated] = useState(false)

  const imagesQuery = useQuery({
    queryKey: ['images-catalog'],
    queryFn: () => api.getImages(),
    staleTime: 5 * 60 * 1000,
  })

  const { images, blueprints } = useMemo(() => normalizeImages(imagesQuery.data), [imagesQuery.data])
  const entries = useMemo(() => showDeprecated ? [...images, ...blueprints] : images, [images, blueprints, showDeprecated])
  const groups = useMemo(() => [...new Set(entries.map((item) => item.group))].sort(), [entries])
  const groupOptions = useMemo(
    () => [{ value: 'all', label: 'All categories' }, ...groups.map((g) => ({ value: g, label: g }))],
    [groups],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return entries.filter((item) => {
      if (groupFilter !== 'all' && item.group !== groupFilter) return false
      if (!q) return true
      return [item.name, item.description, item.group, item.aliases.join(' '), item.tag].join(' ').toLowerCase().includes(q)
    })
  }, [entries, query, groupFilter])

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 className="page-title">Images</h1>
        </div>
      </div>

      <div className="instances-controls" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
        <div className="instances-state-filters" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', flex: '1 1 280px' }}>
          {imagesQuery.isLoading ? (
            <span className="skeleton" style={{ display: 'inline-block', width: 62, height: 20, borderRadius: 999 }} />
          ) : (
            <span className="filter-pill active" style={{ cursor: 'default' }}>
              All
              <span className="pill-count">{entries.length}</span>
            </span>
          )}
        </div>
        {blueprints.length > 0 && (
          <button
            type="button"
            onClick={() => setShowDeprecated(v => !v)}
            className="btn-ghost"
            style={{
              height: 36, fontSize: 12,
              color: showDeprecated ? 'var(--stopped)' : 'var(--text-secondary)',
              borderColor: showDeprecated ? 'rgba(255,68,68,0.3)' : undefined,
            }}
          >
            {showDeprecated ? 'Hide deprecated' : 'Show deprecated items'}
          </button>
        )}
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
              placeholder="Search images..."
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

          <CustomSelect
            value={groupFilter}
            onChange={setGroupFilter}
            options={groupOptions}
            controlHeight={36}
            style={{ minWidth: 160, width: 'clamp(160px, 24vw, 240px)' }}
          />

          <div className="instances-view-toggle" style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', overflow: 'hidden', height: 36 }}>
            {[
              { mode: 'table', Icon: Table2,  title: 'Table view' },
              { mode: 'cards', Icon: Grid3X3, title: 'Cards view' },
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

      {imagesQuery.isLoading ? (
        viewMode === 'table' ? (
          <SkeletonTable cols={SKEL_COLS} rows={8} minWidth={720} />
        ) : (
          <SkeletonCards count={12} minCardWidth={200} />
        )
      ) : filtered.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 32 }}>
          <p className="mono" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            {query.trim() ? `No images match "${query}"` : 'No images available'}
          </p>
        </div>
      ) : viewMode === 'table' ? (
        <TableView images={filtered} />
      ) : (
        <CardsView images={filtered} />
      )}
    </div>
  )
}
