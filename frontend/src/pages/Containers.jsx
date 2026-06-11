import { useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, Play, Square, Skull, Trash2, FileText, X, ArrowUpRight, Info } from 'lucide-react'
import { sileo } from 'sileo'
import { api } from '../api/client'
import ContainerDataTable from '../components/ContainerDataTable'
import Modal from '../components/Modal'
import ConfirmModal from '../components/ConfirmModal'
import BrandIcon from '../components/BrandIcon'
import ResourceActionButton from '../components/ResourceActionButton'
import { SkeletonTable } from '../components/Skeletons'

const EMPTY_CONTAINERS = []

function displayNameText(item) {
  return item.name || item.id || item.raw?.name || item.raw?.id || '-'
}

function displayImage(item) {
  return item.image || item.raw?.image || item.raw?.configuration?.image?.reference || '-'
}

function displayState(item) {
  return item.state || item.status || item.raw?.status || '-'
}

export default function Containers() {
  const qc = useQueryClient()
  const location = useLocation()
  const [query, setQuery] = useState('')
  const [filterState, setFilterState] = useState('All')
  const [newOpen, setNewOpen] = useState(false)
  const [logsFor, setLogsFor] = useState(null)
  const [inspectContainer, setInspectContainer] = useState(null)
  const [deleteName, setDeleteName] = useState(null)

  const containersQuery = useQuery({
    queryKey: ['containers'],
    queryFn: () => api.getContainers(),
    refetchInterval: 10000,
    retry: false,
  })

  const containers = containersQuery.data?.containers || EMPTY_CONTAINERS
  
  const filtered = useMemo(() => {
    let list = containers
    if (filterState !== 'All') {
      list = list.filter(item => displayState(item) === filterState)
    }
    const q = query.trim().toLowerCase()
    if (!q) return list
    return list.filter((item) => [displayNameText(item), displayImage(item), displayState(item)].join(' ').toLowerCase().includes(q))
  }, [containers, query, filterState])

  async function runAction(name, action, title) {
    const promise = api.containerAction(name, action).then(() => {
      qc.invalidateQueries({ queryKey: ['containers'] })
      qc.invalidateQueries({ queryKey: ['instances'] })
    })
    sileo.promise(promise, {
      loading: { title: `${title}...` },
      success: { title },
      error: (e) => ({ title: e.message }),
    })
    await promise
  }

  return (
    <div className="page">
      <div className="instances-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 className="page-title">Containers</h1>
        </div>
        <button className="btn-accent" onClick={() => setNewOpen(true)}>
          <Plus size={15} /> New Container
        </button>
      </div>

      <div className="instances-controls" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
        <div className="instances-state-filters" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', flex: '1 1 280px' }}>
          {['All', 'Running', 'Stopped'].map((state) => (
            <button
              key={state}
              className={`filter-pill ${filterState === state ? 'active' : ''}`}
              onClick={() => setFilterState(state)}
              type="button"
            >
              {state}
              <span className="pill-count">{state === 'All' ? containers.length : containers.filter((item) => displayState(item) === state).length}</span>
            </button>
          ))}
        </div>
        <div className="instances-search-control" style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', padding: '0 10px', height: 36, minWidth: 260, background: 'var(--card-1)' }}>
          <Search size={14} color="var(--text-muted)" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search containers..."
            style={{ flex: 1, minWidth: 0, background: 'transparent', border: 0, outline: 0, color: 'var(--text-primary)', fontSize: 13 }}
          />
          {query && <button type="button" onClick={() => setQuery('')} style={{ background: 'none', border: 0, color: 'var(--text-muted)', cursor: 'pointer' }}><X size={14} /></button>}
        </div>
      </div>

      {containersQuery.isLoading ? (
        <SkeletonTable cols={[{ w: 140 }, { w: 100 }, { w: 220 }, { w: 120 }]} rows={5} />
      ) : (
        <ContainerDataTable
          items={filtered}
          empty={query ? `No containers match "${query}"` : 'No containers'}
          columns={[
            {
              key: 'name',
              label: 'Name',
              accent: false,
              render: (item) => {
                const name = displayNameText(item)
                return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--card-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)', flexShrink: 0 }}>
                      <BrandIcon name={name} type="container" size={16} />
                    </div>
                    <Link to={`/containers/${encodeURIComponent(name)}`} state={{ from: location.pathname }} className="mono" style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {name}
                    </Link>
                    <Link to={`/containers/${encodeURIComponent(name)}`} state={{ from: location.pathname }} aria-label={`Open ${name}`} style={{ color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}>
                      <ArrowUpRight size={13} />
                    </Link>
                  </div>
                )
              },
            },
            { key: 'state', label: 'State', render: displayState },
            { key: 'image', label: 'Image', render: displayImage, maxWidth: 360 },
            { key: 'created', label: 'Created' },
          ]}
          renderActions={(item) => {
            const name = displayNameText(item)
            const state = displayState(item)
            const isRunning = String(state).toLowerCase() === 'running'
            return (
              <div style={{ display: 'inline-flex', gap: 5, alignItems: 'center' }}>
                {!isRunning && <ResourceActionButton icon={<Play size={14} />} label="Start" color="var(--running)" onClick={() => runAction(name, 'start', `Started ${name}`)} />}
                {isRunning && <ResourceActionButton icon={<Square size={14} />} label="Stop" color="var(--stopped)" onClick={() => runAction(name, 'stop', `Stopped ${name}`)} />}
                {isRunning && <ResourceActionButton icon={<Skull size={14} />} label="Kill" color="var(--stopped)" onClick={() => runAction(name, 'kill', `Killed ${name}`)} />}
                <ResourceActionButton icon={<Info size={14} />} label="Inspect" color="#a78bfa" onClick={() => setInspectContainer(name)} />
                <ResourceActionButton icon={<FileText size={14} />} label="Logs" color="#60a5fa" onClick={() => setLogsFor(name)} />
                <ResourceActionButton icon={<Trash2 size={14} />} label="Delete" color="var(--stopped)" onClick={() => setDeleteName(name)} />
              </div>
            )
          }}
        />
      )}


      {newOpen && <NewContainerModal onClose={() => setNewOpen(false)} />}
      {logsFor && <ContainerLogsModal name={logsFor} onClose={() => setLogsFor(null)} />}
      {inspectContainer && <ContainerInspectModal name={inspectContainer} onClose={() => setInspectContainer(null)} />}
      {deleteName && (
        <ConfirmModal
          title={`Delete ${deleteName}`}
          description="This container will be removed."
          confirmLabel="Delete"
          variant="confirm"
          onClose={() => setDeleteName(null)}
          onConfirm={() => runAction(deleteName, 'delete', `Deleted ${deleteName}`).finally(() => setDeleteName(null))}
        />
      )}
    </div>
  )
}

function NewContainerModal({ onClose }) {
  const qc = useQueryClient()
  const [image, setImage] = useState('alpine:latest')
  const [name, setName] = useState('')
  const [args, setArgs] = useState('')

  async function submit(e) {
    e.preventDefault()
    const body = {
      mode: 'run',
      image,
      name: name.trim(),
      args: args.trim() ? args.trim().split(/\s+/) : [],
      options: { '--detach': true },
    }
    const promise = api.createContainer(body).then(() => qc.invalidateQueries({ queryKey: ['containers'] }))
    sileo.promise(promise, {
      loading: { title: `Running ${image}` },
      success: { title: 'Container started' },
      error: (err) => ({ title: err.message }),
    })
    await promise
    onClose()
  }

  return (
    <Modal title="New Container" onClose={onClose} size="md">
      <form onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
        <label className="field-label">Image</label>
        <input className="input" value={image} onChange={(e) => setImage(e.target.value)} placeholder="nginx:latest" required />
        <label className="field-label">Name</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="optional-name" />
        <label className="field-label">Command args</label>
        <input className="input" value={args} onChange={(e) => setArgs(e.target.value)} placeholder="optional command args" />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-accent">Run</button>
        </div>
      </form>
    </Modal>
  )
}

function ContainerInspectModal({ name, onClose }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['container', name],
    queryFn: () => api.getContainer(name),
    enabled: Boolean(name),
    retry: false,
  })
  return (
    <Modal title={`Inspect · ${name}`} onClose={onClose} size="lg">
      <pre className="mono" style={{ minHeight: 260, maxHeight: '60vh', overflow: 'auto', margin: 0, padding: 14, background: 'var(--card-2)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>
        {isLoading ? 'Loading container...' : error ? error.message : JSON.stringify(data?.container || data || {}, null, 2)}
      </pre>
    </Modal>
  )
}

function ContainerLogsModal({ name, onClose }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['container-logs', name],
    queryFn: () => api.getContainerLogs(name),
    enabled: Boolean(name),
    retry: false,
  })
  return (
    <Modal title={`Logs · ${name}`} onClose={onClose} size="lg">
      <pre className="mono" style={{ minHeight: 260, maxHeight: '60vh', overflow: 'auto', margin: 0, padding: 14, background: 'var(--card-2)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>
        {isLoading ? 'Loading logs...' : error ? error.message : (data?.logs || 'No logs')}
      </pre>
    </Modal>
  )
}
