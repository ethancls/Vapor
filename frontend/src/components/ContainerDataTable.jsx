import { useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, ChevronsUpDown } from 'lucide-react'

function valueAt(item, key) {
  if (!key) return ''
  const raw = item?.[key]
  if (raw == null) return ''
  if (typeof raw === 'object') return JSON.stringify(raw)
  return String(raw)
}

function fallbackColumns(items) {
  const seen = new Set()
  for (const item of items.slice(0, 5)) {
    Object.keys(item || {}).forEach((key) => {
      if (key !== 'raw') seen.add(key)
    })
  }
  return [...seen].slice(0, 5).map((key) => ({ key, label: key }))
}

function SortTh({ col, sort, onSort }) {
  const active = sort.key === col.key
  const Icon = active ? (sort.dir === 'asc' ? ChevronUp : ChevronDown) : ChevronsUpDown
  return (
    <th
      onClick={() => col.key && onSort(col.key)}
      style={{
        padding: '12px 18px',
        textAlign: 'left',
        fontSize: 10.5,
        color: active ? 'var(--accent)' : 'var(--text-secondary)',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        cursor: col.key ? 'pointer' : 'default',
      }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        {col.label}
        {col.key && <Icon size={11} style={{ opacity: active ? 1 : 0.45 }} />}
      </span>
    </th>
  )
}

export default function ContainerDataTable({ items = [], columns, empty = 'No resources', renderActions }) {
  const resolvedColumns = useMemo(() => columns?.length ? columns : fallbackColumns(items), [columns, items])
  const [sort, setSort] = useState({ key: resolvedColumns[0]?.key || '', dir: 'asc' })

  function toggleSort(key) {
    setSort((current) => current.key === key
      ? { key, dir: current.dir === 'asc' ? 'desc' : 'asc' }
      : { key, dir: 'asc' })
  }

  const sorted = useMemo(() => [...items].sort((a, b) => {
    const cmp = valueAt(a, sort.key).localeCompare(valueAt(b, sort.key))
    return sort.dir === 'asc' ? cmp : -cmp
  }), [items, sort])

  return (
    <div className="instances-table-shell" style={{ background: 'var(--card-1)', borderRadius: 'var(--r-card)', border: '1px solid var(--border)', overflow: 'visible' }}>
      <div className="instances-table-scroll no-scrollbar" style={{ overflowX: 'auto', overflowY: 'visible' }}>
        <table style={{ width: '100%', minWidth: 760, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {resolvedColumns.map((col) => <SortTh key={col.key || col.label} col={col} sort={sort} onSort={toggleSort} />)}
              {renderActions && <th style={{ padding: '12px 18px', textAlign: 'right', fontSize: 10.5, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr>
                <td colSpan={resolvedColumns.length + (renderActions ? 1 : 0)} style={{ padding: 34, textAlign: 'center' }}>
                  <span className="mono" style={{ fontSize: 12, color: 'var(--text-muted)' }}>{empty}</span>
                </td>
              </tr>
            )}
            {sorted.map((item, idx) => (
              <tr key={item.id || item.name || item.image || idx} style={{ borderBottom: idx < sorted.length - 1 ? '1px solid var(--border)' : 'none' }}>
                {resolvedColumns.map((col) => (
                  <td key={col.key || col.label} style={{ padding: '13px 18px', maxWidth: col.maxWidth || 300 }}>
                    <span className="mono" style={{ fontSize: 12, color: col.accent ? 'var(--accent)' : 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>
                      {col.render ? col.render(item) : (valueAt(item, col.key) || '-')}
                    </span>
                  </td>
                ))}
                {renderActions && (
                  <td style={{ padding: '13px 18px', textAlign: 'right' }}>
                    {renderActions(item)}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
