import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Play, Search, X } from 'lucide-react'
import { sileo } from 'sileo'
import ContainerDataTable from '../components/ContainerDataTable'
import CustomSelect from '../components/CustomSelect'
import { api } from '../api/client'

const EMPTY_COMMANDS = []

export default function Commands() {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState('')
  const [args, setArgs] = useState('')
  const [confirmMutation, setConfirmMutation] = useState(false)
  const [result, setResult] = useState(null)
  const commandsQuery = useQuery({
    queryKey: ['container-commands'],
    queryFn: () => api.getContainerCommands(),
    staleTime: 60000,
  })
  const commands = commandsQuery.data?.commands || EMPTY_COMMANDS
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return commands
    return commands.filter((cmd) => cmd.name.toLowerCase().includes(q))
  }, [commands, query])
  const selectedMeta = commands.find((cmd) => cmd.name === selected)

  async function run() {
    if (!selected) return
    const body = {
      command: selected,
      args: args.trim() ? args.trim().split(/\s+/) : [],
      confirm_mutation: confirmMutation,
    }
    const promise = api.runContainerCommand(body)
    sileo.promise(promise, {
      loading: { title: `Running container ${selected}` },
      success: { title: 'Command finished' },
      error: (e) => ({ title: e.message }),
    })
    setResult(await promise)
  }

  return (
    <div className="page">
      <div className="instances-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, gap: 16, flexWrap: 'wrap' }}>
        <h1 className="page-title">Commands</h1>
      </div>
      <div className="card" style={{ padding: 16, marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 1fr) minmax(220px, 2fr) auto', gap: 10, alignItems: 'center' }}>
          <CustomSelect
            value={selected}
            onChange={setSelected}
            options={commands.map((cmd) => ({
              value: cmd.name,
              label: cmd.name,
              tag: cmd.mutating ? 'mutating' : '',
            }))}
            placeholder="Select command..."
            searchable
            controlHeight={38}
          />
          <input className="input" value={args} onChange={(e) => setArgs(e.target.value)} placeholder="Arguments, split by spaces" />
          <button className="btn-accent" onClick={run} disabled={!selected}><Play size={14} /> Run</button>
        </div>
        {selectedMeta?.mutating && (
          <label className="mono" style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12, color: 'var(--text-secondary)', fontSize: 12 }}>
            <input type="checkbox" checked={confirmMutation} onChange={(e) => setConfirmMutation(e.target.checked)} />
            Confirm mutating command
          </label>
        )}
      </div>
      <div className="instances-search-control" style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', padding: '0 10px', height: 36, maxWidth: 360, background: 'var(--card-1)', marginBottom: 16 }}>
        <Search size={14} color="var(--text-muted)" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search commands..." style={{ flex: 1, minWidth: 0, background: 'transparent', border: 0, outline: 0, color: 'var(--text-primary)', fontSize: 13 }} />
        {query && <button type="button" onClick={() => setQuery('')} style={{ background: 'none', border: 0, color: 'var(--text-muted)', cursor: 'pointer' }}><X size={14} /></button>}
      </div>
      <ContainerDataTable
        items={filtered}
        empty="No commands"
        columns={[
          { key: 'name', label: 'Command', accent: true },
          { key: 'mutating', label: 'Mutating', render: (item) => item.mutating ? 'yes' : 'no' },
        ]}
      />
      {result && (
        <div className="card" style={{ padding: 16, marginTop: 16 }}>
          <pre className="mono" style={{ margin: 0, whiteSpace: 'pre-wrap', color: 'var(--text-secondary)' }}>{JSON.stringify(result.result || result, null, 2)}</pre>
        </div>
      )}
    </div>
  )
}
