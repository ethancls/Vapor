import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { FileText, Info, Loader2, Power, PowerOff, Trash2 } from 'lucide-react'
import { sileo } from 'sileo'
import { api } from '../api/client'
import ConfirmModal from '../components/ConfirmModal'
import Tooltip from '../components/Tooltip'
import DetailsTabs from '../components/instance-details/DetailsTabs'
import InstanceStateBadge from '../components/instances/InstanceStateBadge'

const TABS = [
  { value: 'logs', label: 'Logs' },
  { value: 'inspect', label: 'Inspect' },
]

function rawMachine(data) {
  return data?.machine || data || {}
}

function machineValue(machine, keys, fallback = '—') {
  for (const key of keys) {
    const value = key.split('.').reduce((current, part) => current?.[part], machine)
    if (value != null && value !== '') return value
  }
  return fallback
}

function Stat({ label, value, accent = false }) {
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', height: 62, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
      <p className="section-label" style={{ margin: 0, lineHeight: 1 }}>{label}</p>
      <span className="mono" style={{ fontSize: 13, color: accent ? 'var(--accent)' : 'var(--text-primary)', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {value}
      </span>
    </div>
  )
}

function IconActionButton({ icon, label, color, disabled = false, onClick, isLoading = false }) {
  return (
    <Tooltip label={label}>
      <button
        type="button"
        aria-label={label}
        onClick={!isLoading && !disabled ? onClick : undefined}
        disabled={disabled}
        style={{ width: 34, height: 34, borderRadius: 9, border: 'none', background: 'transparent', color: disabled && !isLoading ? 'var(--text-muted)' : color, cursor: isLoading || disabled ? 'default' : 'pointer', opacity: disabled && !isLoading ? 0.45 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
        onMouseEnter={(e) => { if (!isLoading && !disabled) e.currentTarget.style.background = `color-mix(in srgb, ${color} 12%, transparent)` }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
      >
        {isLoading ? <Loader2 size={14} style={{ animation: 'spin 0.7s linear infinite' }} /> : icon}
      </button>
    </Tooltip>
  )
}

function LogsPanel({ name }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['machine-logs', name],
    queryFn: () => api.getMachineLogs(name),
    enabled: Boolean(name),
    retry: false,
  })
  return (
    <pre className="mono" style={{ minHeight: 460, maxHeight: '70vh', overflow: 'auto', margin: 0, padding: 14, background: 'var(--card-2)', border: '1px solid var(--border)', borderRadius: 14, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>
      {isLoading ? 'Loading logs...' : error ? error.message : (data?.logs || 'No logs')}
    </pre>
  )
}

function InspectPanel({ data, isLoading, error }) {
  return (
    <pre className="mono" style={{ minHeight: 460, maxHeight: '70vh', overflow: 'auto', margin: 0, padding: 14, background: 'var(--card-2)', border: '1px solid var(--border)', borderRadius: 14, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>
      {isLoading ? 'Loading machine...' : error ? error.message : JSON.stringify(rawMachine(data), null, 2)}
    </pre>
  )
}

export default function MachineDetails() {
  const { name: rawName } = useParams()
  const name = decodeURIComponent(rawName || '')
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [tab, setTab] = useState('logs')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [activeAction, setActiveAction] = useState('')

  const machineQuery = useQuery({
    queryKey: ['machine', name],
    queryFn: () => api.getMachine(name),
    enabled: Boolean(name),
    refetchInterval: 10000,
    retry: false,
  })

  async function runAction(action, title, after) {
    setActiveAction(action)
    try {
      await api.machineAction(name, action)
      qc.invalidateQueries({ queryKey: ['instances'] })
      qc.invalidateQueries({ queryKey: ['machine', name] })
      qc.invalidateQueries({ queryKey: ['stats'] })
      sileo.success({ title })
      if (after) after()
    } catch (err) {
      sileo.error({ title: err.message })
    } finally {
      setActiveAction('')
    }
  }

  const machine = rawMachine(machineQuery.data)
  const state = machineValue(machine, ['state', 'status', 'raw.state', 'raw.status'])
  const isRunning = String(state).toLowerCase() === 'running'
  const busy = Boolean(activeAction)

  if (machineQuery.isLoading) {
    return <div className="page"><div className="skeleton" style={{ width: 260, height: 34, borderRadius: 8 }} /></div>
  }

  if (machineQuery.error) {
    return <div className="page"><p className="mono" style={{ color: 'var(--stopped)', fontSize: 12 }}>{machineQuery.error.message}</p></div>
  }

  return (
    <div className="page">
      <div className="instances-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, minWidth: 0 }}>
          <h1 className="page-title" style={{ fontSize: 30, lineHeight: 1, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</h1>
          <InstanceStateBadge state={state} />
        </div>
        <div className="instance-details-header-actions" style={{ display: 'flex', gap: 4, alignItems: 'center', flexShrink: 0 }}>
          {!isRunning && <IconActionButton icon={<Power size={14} />} label="Run" color="var(--running)" disabled={busy && activeAction !== 'run'} isLoading={activeAction === 'run'} onClick={() => runAction('run', `Started ${name}`)} />}
          {isRunning && <IconActionButton icon={<PowerOff size={14} />} label="Stop" color="var(--stopped)" disabled={busy && activeAction !== 'stop'} isLoading={activeAction === 'stop'} onClick={() => runAction('stop', `Stopped ${name}`)} />}
          <IconActionButton icon={<FileText size={14} />} label="Logs" color="#60a5fa" disabled={busy} onClick={() => setTab('logs')} />
          <IconActionButton icon={<Info size={14} />} label="Inspect" color="#a78bfa" disabled={busy} onClick={() => setTab('inspect')} />
          <IconActionButton icon={<Trash2 size={14} />} label="Delete" color="var(--stopped)" disabled={busy && activeAction !== 'delete'} isLoading={activeAction === 'delete'} onClick={() => setConfirmDelete(true)} />
        </div>
      </div>

      <div className="instance-details-stats" style={{ marginBottom: 14 }}>
        <Stat label="vCPUs" value={machineValue(machine, ['cpus', 'cpu_count', 'configuration.cpus'])} accent />
        <Stat label="RAM" value={machineValue(machine, ['memory', 'memory_size', 'configuration.memory'], 'Unavailable')} />
        <Stat label="Disk" value={machineValue(machine, ['disk', 'disk_size', 'configuration.disk'], 'Unavailable')} />
        <Stat label="Kernel / Image" value={machineValue(machine, ['image', 'kernel', 'configuration.kernel'])} />
        <Stat label="Created" value={machineValue(machine, ['created', 'created_at'])} />
      </div>

      <DetailsTabs tabs={TABS} value={tab} onChange={setTab} />
      {tab === 'logs' && <LogsPanel name={name} />}
      {tab === 'inspect' && <InspectPanel data={machineQuery.data} isLoading={machineQuery.isLoading} error={machineQuery.error} />}

      {confirmDelete && (
        <ConfirmModal
          title={`Delete ${name}`}
          description="This Apple Container machine will be removed."
          confirmLabel="Delete"
          confirmValue={name}
          variant="name"
          onClose={() => setConfirmDelete(false)}
          onConfirm={() => runAction('delete', `Deleted ${name}`, () => navigate('/instances'))}
        />
      )}
    </div>
  )
}
