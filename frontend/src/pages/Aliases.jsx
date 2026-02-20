import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { RefreshCw, Plus, Star, Trash2 } from 'lucide-react'
import { sileo } from 'sileo'
import { api } from '../api/client'
import ConfirmModal from '../components/ConfirmModal'

function toText(value) {
  if (value == null) return ''
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return ''
}

function normalizeAliases(payload) {
  if (!payload) return []

  if (Array.isArray(payload)) {
    return payload.map((item, index) => {
      const data = item && typeof item === 'object' ? item : {}
      const name = toText(data.name || data.alias || data.id || `alias-${index}`)
      const definition = toText(data.definition || data.command || data.value || data.target)
      const context = toText(data.context || data.instance || data.prefer || data.preferred || '')
      return { id: name || `alias-${index}`, name, definition, context, raw: data }
    })
  }

  if (typeof payload === 'object') {
    return Object.entries(payload).map(([name, value]) => {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        return {
          id: name,
          name,
          definition: toText(value.definition || value.command || value.value || ''),
          context: toText(value.context || value.instance || value.prefer || value.preferred || ''),
          raw: value,
        }
      }
      return {
        id: name,
        name,
        definition: toText(value),
        context: '',
        raw: value,
      }
    })
  }

  return []
}

export default function Aliases() {
  const qc = useQueryClient()
  const [query, setQuery] = useState('')
  const [definition, setDefinition] = useState('')
  const [name, setName] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [busy, setBusy] = useState(false)

  const aliasesQuery = useQuery({
    queryKey: ['aliases'],
    queryFn: () => api.getAliases(),
    refetchInterval: 30000,
  })

  const aliases = useMemo(() => normalizeAliases(aliasesQuery.data?.aliases), [aliasesQuery.data])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return aliases
    return aliases.filter((item) => [item.name, item.definition, item.context].join(' ').toLowerCase().includes(q))
  }, [aliases, query])

  async function runMutation(fn, successTitle) {
    const promise = fn().then((result) => {
      qc.invalidateQueries({ queryKey: ['aliases'] })
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
    const def = definition.trim()
    if (!def) return
    setBusy(true)
    try {
      await runMutation(() => api.createAlias(def, name.trim() || undefined), `Alias ${name.trim() || def} created`)
      setDefinition('')
      setName('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 className="page-title">Aliases</h1>
          <p className="mono" style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 7 }}>
            {aliases.length} alias{aliases.length !== 1 ? 'es' : ''}
          </p>
        </div>
        <button className="btn-ghost" onClick={() => aliasesQuery.refetch()}>
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      <div className="card" style={{ padding: 16, marginBottom: 12 }}>
        <form className="aliases-create-form" onSubmit={submitCreate} style={{ display: 'grid', gridTemplateColumns: '1fr minmax(140px, 220px) auto', gap: 8 }}>
          <input
            className="input"
            style={{ height: 36, padding: '0 12px' }}
            value={definition}
            onChange={(event) => setDefinition(event.target.value)}
            placeholder="Alias definition (example: vm.ls:ls -la)"
          />
          <input
            className="input"
            style={{ height: 36, padding: '0 12px' }}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Alias name (optional)"
          />
          <button className="btn-accent" type="submit" style={{ height: 36 }} disabled={busy || !definition.trim()}>
            <Plus size={13} /> Add alias
          </button>
        </form>
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 7,
          background: 'var(--card-2)', border: '1px solid var(--border)',
          borderRadius: 'var(--r-sm)', padding: '0 10px', height: 36, width: 'clamp(180px, 35vw, 320px)',
        }}>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search aliases"
            style={{
              background: 'none', border: 'none', outline: 'none',
              color: 'var(--text-primary)', fontFamily: 'IBM Plex Mono', fontSize: 12,
              width: '100%',
            }}
          />
        </div>
      </div>

      <div className="instances-table-shell" style={{ background: 'var(--card-1)', borderRadius: 'var(--r-card)', border: '1px solid var(--border)' }}>
        <div className="instances-table-scroll" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: 760, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Alias', 'Definition', 'Context', 'Actions'].map((label) => (
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
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ padding: '34px 18px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
                    {query.trim() ? `No aliases match "${query}"` : 'No aliases'}
                  </td>
                </tr>
              )}
              {filtered.map((item) => (
                <tr key={item.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '14px 18px' }}>
                    <span className="mono" style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)' }}>
                      {item.name || '—'}
                    </span>
                  </td>
                  <td style={{ padding: '14px 18px', maxWidth: 360 }}>
                    <span className="mono" style={{
                      fontSize: 11.5, color: 'var(--text-secondary)',
                      display: 'inline-block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%',
                    }}>
                      {item.definition || '—'}
                    </span>
                  </td>
                  <td style={{ padding: '14px 18px' }}>
                    <span className="mono" style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                      {item.context || '—'}
                    </span>
                  </td>
                  <td style={{ padding: '14px 18px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {item.name && (
                        <button
                          className="btn-ghost"
                          style={{ height: 32, padding: '0 10px' }}
                          onClick={async () => {
                            if (!item.name) return
                            setBusy(true)
                            try {
                              await runMutation(() => api.preferAlias(item.name), `Preferred ${item.name}`)
                            } finally {
                              setBusy(false)
                            }
                          }}
                          disabled={busy}
                        >
                          <Star size={12} /> Prefer
                        </button>
                      )}
                      {item.name && (
                        <button
                          className="btn-danger"
                          style={{ height: 32, padding: '0 10px' }}
                          onClick={() => setDeleteTarget(item)}
                          disabled={busy}
                        >
                          <Trash2 size={12} /> Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {deleteTarget && (
        <ConfirmModal
          title={`Delete alias ${deleteTarget.name}`}
          description={`Alias "${deleteTarget.name}" will be removed.`}
          confirmLabel="Delete alias"
          confirmValue={deleteTarget.name}
          variant="name"
          onClose={() => setDeleteTarget(null)}
          onConfirm={async () => {
            setBusy(true)
            try {
              await runMutation(() => api.deleteAlias(deleteTarget.name), `Alias ${deleteTarget.name} deleted`)
              setDeleteTarget(null)
            } finally {
              setBusy(false)
            }
          }}
        />
      )}
    </div>
  )
}
