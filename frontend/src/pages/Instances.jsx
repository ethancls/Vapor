import { useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Search, X, FileText, Play, Square, Trash2, Info, ArrowUpRight } from 'lucide-react'
import { sileo } from 'sileo'
import { api } from '../api/client'
import ContainerDataTable from '../components/ContainerDataTable'
import Modal from '../components/Modal'
import ConfirmModal from '../components/ConfirmModal'
import BrandIcon from '../components/BrandIcon'
import { SkeletonTable } from '../components/Skeletons'

const EMPTY_MACHINES = []

function machineNameText(item) {
  return item.name || item.id || item.raw?.name || '-'
}

function machineState(item) {
  return item.state || item.status || item.raw?.state || item.raw?.status || '-'
}

function machineImage(item) {
  return item.image || item.raw?.image || item.raw?.kernel || '-'
}

export default function Instances() {
  const qc = useQueryClient()
  const location = useLocation()
  const [query, setQuery] = useState('')
  const [filterState, setFilterState] = useState('All')
  const [logsFor, setLogsFor] = useState(null)
  const [inspectMachine, setInspectMachine] = useState(null)
  const [deleteName, setDeleteName] = useState(null)

  const machinesQuery = useQuery({
    queryKey: ['instances'],
    queryFn: () => api.getInstances(),
    refetchInterval: 10000,
    retry: false,
  })

  const machines = machinesQuery.data?.instances || EMPTY_MACHINES
  const counts = useMemo(() => ({
    All: machines.length,
    Running: machines.filter((item) => machineState(item) === 'Running').length,
    Stopped: machines.filter((item) => machineState(item) === 'Stopped').length,
  }), [machines])

  const filteredMachines = useMemo(() => {
    let list = machines
    if (filterState !== 'All') {
      list = list.filter(item => machineState(item) === filterState)
    }
    const q = query.trim().toLowerCase()
    if (!q) return list
    return list.filter((item) => [machineNameText(item), machineState(item), machineImage(item)].join(' ').toLowerCase().includes(q))
  }, [machines, query, filterState])

  async function runMachineAction(name, action, title) {
    const promise = api.machineAction(name, action).then(() => {
      qc.invalidateQueries({ queryKey: ['instances'] })
      qc.invalidateQueries({ queryKey: ['stats'] })
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
          <h1 className="page-title">Machines</h1>
        </div>
      </div>

      {!machinesQuery.isLoading && (
        <div className="instances-controls" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
          <div className="instances-state-filters" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', flex: '1 1 280px' }}>
            {Object.entries(counts).map(([label, count]) => (
              <button
                key={label}
                className={`filter-pill ${filterState === label ? 'active' : ''}`}
                onClick={() => setFilterState(label)}
                type="button"
              >
                {label}
                <span className="pill-count">{count}</span>
              </button>
            ))}
          </div>
          <div className="instances-search-control" style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', padding: '0 10px', height: 36, minWidth: 260, background: 'var(--card-1)' }}>
            <Search size={14} color="var(--text-muted)" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search machines..."
              style={{ flex: 1, minWidth: 0, background: 'transparent', border: 0, outline: 0, color: 'var(--text-primary)', fontSize: 13 }}
            />
            {query && <button type="button" onClick={() => setQuery('')} style={{ background: 'none', border: 0, color: 'var(--text-muted)', cursor: 'pointer' }}><X size={14} /></button>}
          </div>
        </div>
      )}

      {machinesQuery.error && (
        <div className="card" style={{ padding: 16, marginBottom: 16, borderColor: 'rgba(255,123,220,0.30)', background: 'rgba(255,123,220,0.08)' }}>
          <p style={{ margin: 0, fontWeight: 800, color: 'var(--text-primary)' }}>Machine API is not available</p>
          <p className="mono" style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            {machinesQuery.error.message}
          </p>
        </div>
      )}

      {machinesQuery.isLoading ? (
        <SkeletonTable cols={[{ w: 140 }, { w: 100 }, { w: 220 }, { w: 100 }, { w: 120 }]} rows={5} />
      ) : (
        <ContainerDataTable
          items={filteredMachines}
          empty={query.trim() ? `No machines match "${query}"` : 'No machines'}
          columns={[
            {
              key: 'name',
              label: 'Name',
              accent: false,
              render: (item) => {
                const name = machineNameText(item)
                return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--card-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)', flexShrink: 0 }}>
                      <BrandIcon name={name} type="machine" size={16} />
                    </div>
                    <Link to={`/instances/${encodeURIComponent(name)}`} state={{ from: location.pathname }} className="mono" style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {name}
                    </Link>
                    <Link to={`/instances/${encodeURIComponent(name)}`} state={{ from: location.pathname }} aria-label={`Open ${name}`} style={{ color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}>
                      <ArrowUpRight size={13} />
                    </Link>
                  </div>
                )
              },
            },
            { key: 'state', label: 'State', render: machineState },
            { key: 'image', label: 'Kernel / Image', render: machineImage },
            { key: 'cpus', label: 'CPUs' },
            { key: 'created', label: 'Created' },
          ]}
          renderActions={(item) => {
            const name = machineNameText(item)
            const state = machineState(item)
            return (
              <div style={{ display: 'inline-flex', gap: 5, alignItems: 'center' }}>
                {state !== 'Running' && <button className="icon-btn" title="Run" onClick={() => runMachineAction(name, 'run', `Started ${name}`)}><Play size={14} /></button>}
                {state === 'Running' && <button className="icon-btn" title="Stop" onClick={() => runMachineAction(name, 'stop', `Stopped ${name}`)}><Square size={14} /></button>}
                <button className="icon-btn" title="Inspect" onClick={() => setInspectMachine(name)}><Info size={14} /></button>
                <button className="icon-btn" title="Logs" onClick={() => setLogsFor(name)}><FileText size={14} /></button>
                <button className="icon-btn danger" title="Delete" onClick={() => setDeleteName(name)}><Trash2 size={14} /></button>
              </div>
            )
          }}
        />
      )}


      {logsFor && <MachineLogsModal name={logsFor} onClose={() => setLogsFor(null)} />}
      {inspectMachine && <MachineInspectModal name={inspectMachine} onClose={() => setInspectMachine(null)} />}
      {deleteName && (
        <ConfirmModal
          title={`Delete ${deleteName}`}
          description="This Apple Container machine will be removed."
          confirmLabel="Delete"
          variant="confirm"
          onClose={() => setDeleteName(null)}
          onConfirm={() => runMachineAction(deleteName, 'delete', `Deleted ${deleteName}`).finally(() => setDeleteName(null))}
        />
      )}
    </div>
  )
}

function MachineLogsModal({ name, onClose }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['machine-logs', name],
    queryFn: () => api.getMachineLogs(name),
    enabled: Boolean(name),
    retry: false,
  })
  return (
    <Modal title={`Machine Logs · ${name}`} onClose={onClose} size="lg">
      <pre className="mono" style={{ minHeight: 260, maxHeight: '60vh', overflow: 'auto', margin: 0, padding: 14, background: 'var(--card-2)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>
        {isLoading ? 'Loading logs...' : error ? error.message : (data?.logs || 'No logs')}
      </pre>
    </Modal>
  )
}

function MachineInspectModal({ name, onClose }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['machine', name],
    queryFn: () => api.getMachine(name),
    enabled: Boolean(name),
    retry: false,
  })
  return (
    <Modal title={`Inspect · ${name}`} onClose={onClose} size="lg">
      <pre className="mono" style={{ minHeight: 260, maxHeight: '60vh', overflow: 'auto', margin: 0, padding: 14, background: 'var(--card-2)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>
        {isLoading ? 'Loading machine...' : error ? error.message : JSON.stringify(data?.machine || data || {}, null, 2)}
      </pre>
    </Modal>
  )
}
