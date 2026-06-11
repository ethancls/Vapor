import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { FileText, Info, Loader2, Play, Skull, Square, Trash2 } from 'lucide-react'
import { sileo } from 'sileo'
import { api } from '../api/client'
import ConfirmModal from '../components/ConfirmModal'
import Tooltip from '../components/Tooltip'
import DetailsTabs from '../components/instance-details/DetailsTabs'
import ShellPanel from '../components/instance-details/ShellPanel'
import ResourceUsage from '../components/instances/ResourceUsage'
import InstanceStateBadge from '../components/instances/InstanceStateBadge'

const TABS = [
  { value: 'shell', label: 'Shell' },
  { value: 'logs', label: 'Logs' },
  { value: 'inspect', label: 'Inspect' },
  { value: 'stats', label: 'Stats' },
]

function rawContainer(data) {
  return data?.container || data || {}
}

function valueAt(item, paths, fallback = '—') {
  for (const path of paths) {
    const value = path.split('.').reduce((current, part) => current?.[part], item)
    if (value != null && value !== '') return value
  }
  return fallback
}

function toBytes(value) {
  if (value == null || value === '') return 0
  if (typeof value === 'number') return value
  const text = String(value).trim()
  const match = /^([\d.]+)\s*([kmgt]?i?b?|b)?$/i.exec(text)
  if (!match) return Number(value) || 0
  const n = Number(match[1])
  const unit = (match[2] || 'b').toLowerCase()
  const scale = unit.startsWith('t') ? 1024 ** 4 : unit.startsWith('g') ? 1024 ** 3 : unit.startsWith('m') ? 1024 ** 2 : unit.startsWith('k') ? 1024 : 1
  return n * scale
}

function extractStats(data) {
  const stats = data?.stats || data?.raw || data || {}
  const item = Array.isArray(stats) ? stats[0] || {} : stats
  const memoryUsed = toBytes(valueAt(item, ['memory.used', 'memory_usage', 'mem_used', 'MemUsage.used'], 0))
  const memoryTotal = toBytes(valueAt(item, ['memory.total', 'memory_limit', 'mem_limit', 'MemUsage.total'], 0))
  return {
    item,
    cpu: valueAt(item, ['cpu', 'cpu_percent', 'cpuPercentage', 'CPUPerc'], 'Unavailable'),
    memoryUsed,
    memoryTotal,
  }
}

function Stat({ label, value, accent = false, children = null }) {
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', height: 62, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
      <p className="section-label" style={{ margin: 0, lineHeight: 1 }}>{label}</p>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', minWidth: 0, overflow: 'hidden' }}>
        {children ?? (
          <span className="mono" style={{ fontSize: 13, color: accent ? 'var(--accent)' : 'var(--text-primary)', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {value}
          </span>
        )}
      </div>
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
    queryKey: ['container-logs', name],
    queryFn: () => api.getContainerLogs(name),
    enabled: Boolean(name),
    retry: false,
  })
  return (
    <pre className="mono" style={{ minHeight: 460, maxHeight: '70vh', overflow: 'auto', margin: 0, padding: 14, background: 'var(--card-2)', border: '1px solid var(--border)', borderRadius: 14, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>
      {isLoading ? 'Loading logs...' : error ? error.message : (data?.logs || data?.stderr || 'No logs')}
    </pre>
  )
}

function JsonPanel({ data, isLoading, error, loadingLabel }) {
  return (
    <pre className="mono" style={{ minHeight: 460, maxHeight: '70vh', overflow: 'auto', margin: 0, padding: 14, background: 'var(--card-2)', border: '1px solid var(--border)', borderRadius: 14, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>
      {isLoading ? loadingLabel : error ? error.message : JSON.stringify(data || {}, null, 2)}
    </pre>
  )
}

export default function ContainerDetails() {
  const { name: rawName } = useParams()
  const name = decodeURIComponent(rawName || '')
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [tab, setTab] = useState('shell')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [activeAction, setActiveAction] = useState('')

  const containerQuery = useQuery({
    queryKey: ['container', name],
    queryFn: () => api.getContainer(name),
    enabled: Boolean(name),
    refetchInterval: 10000,
    retry: false,
  })

  const statsQuery = useQuery({
    queryKey: ['container-stats', name],
    queryFn: () => api.getContainerStats(name),
    enabled: Boolean(name),
    refetchInterval: 7000,
    retry: false,
  })

  async function runAction(action, title, after) {
    setActiveAction(action)
    try {
      await api.containerAction(name, action)
      qc.invalidateQueries({ queryKey: ['containers'] })
      qc.invalidateQueries({ queryKey: ['container', name] })
      qc.invalidateQueries({ queryKey: ['container-stats', name] })
      qc.invalidateQueries({ queryKey: ['instances'] })
      sileo.success({ title })
      if (after) after()
    } catch (err) {
      sileo.error({ title: err.message })
    } finally {
      setActiveAction('')
    }
  }

  const container = rawContainer(containerQuery.data)
  const stats = useMemo(() => extractStats(statsQuery.data), [statsQuery.data])
  const state = valueAt(container, ['state', 'status', 'raw.status'])
  const isRunning = String(state).toLowerCase() === 'running'
  const busy = Boolean(activeAction)

  if (containerQuery.isLoading) {
    return <div className="page"><div className="skeleton" style={{ width: 260, height: 34, borderRadius: 8 }} /></div>
  }

  if (containerQuery.error) {
    return <div className="page"><p className="mono" style={{ color: 'var(--stopped)', fontSize: 12 }}>{containerQuery.error.message}</p></div>
  }

  return (
    <div className="page">
      <div className="instances-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, minWidth: 0 }}>
          <h1 className="page-title" style={{ fontSize: 30, lineHeight: 1, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</h1>
          <InstanceStateBadge state={state} />
        </div>
        <div className="instance-details-header-actions" style={{ display: 'flex', gap: 4, alignItems: 'center', flexShrink: 0 }}>
          {!isRunning && <IconActionButton icon={<Play size={14} />} label="Start" color="var(--running)" disabled={busy && activeAction !== 'start'} isLoading={activeAction === 'start'} onClick={() => runAction('start', `Started ${name}`)} />}
          {isRunning && <IconActionButton icon={<Square size={14} />} label="Stop" color="var(--stopped)" disabled={busy && activeAction !== 'stop'} isLoading={activeAction === 'stop'} onClick={() => runAction('stop', `Stopped ${name}`)} />}
          {isRunning && <IconActionButton icon={<Skull size={14} />} label="Kill" color="var(--stopped)" disabled={busy && activeAction !== 'kill'} isLoading={activeAction === 'kill'} onClick={() => runAction('kill', `Killed ${name}`)} />}
          <IconActionButton icon={<FileText size={14} />} label="Logs" color="#60a5fa" disabled={busy} onClick={() => setTab('logs')} />
          <IconActionButton icon={<Info size={14} />} label="Inspect" color="#a78bfa" disabled={busy} onClick={() => setTab('inspect')} />
          <IconActionButton icon={<Trash2 size={14} />} label="Delete" color="var(--stopped)" disabled={busy && activeAction !== 'delete'} isLoading={activeAction === 'delete'} onClick={() => setConfirmDelete(true)} />
        </div>
      </div>

      <div className="instance-details-stats" style={{ marginBottom: 14 }}>
        <Stat label="CPU" value={statsQuery.error ? 'Unavailable' : stats.cpu} accent />
        <Stat label="RAM">
          {statsQuery.error ? <span className="mono" style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 700 }}>Unavailable</span> : <ResourceUsage used={stats.memoryUsed} total={stats.memoryTotal} donutSize={22} donutStroke={3} />}
        </Stat>
        <Stat label="Image" value={valueAt(container, ['image', 'configuration.image.reference', 'raw.configuration.image.reference'])} />
        <Stat label="Command" value={valueAt(container, ['command', 'configuration.command', 'raw.configuration.command'])} />
        <Stat label="Created" value={valueAt(container, ['created', 'created_at'])} />
      </div>

      <DetailsTabs tabs={TABS} value={tab} onChange={setTab} />
      {tab === 'shell' && <ShellPanel name={name} isRunning={isRunning} wsBase="/ws/containers" resourceLabel="Container" storageKeyPrefix="eve-container-shell-session" />}
      {tab === 'logs' && <LogsPanel name={name} />}
      {tab === 'inspect' && <JsonPanel data={container} isLoading={containerQuery.isLoading} error={containerQuery.error} loadingLabel="Loading container..." />}
      {tab === 'stats' && <JsonPanel data={statsQuery.data} isLoading={statsQuery.isLoading} error={statsQuery.error} loadingLabel="Loading stats..." />}

      {confirmDelete && (
        <ConfirmModal
          title={`Delete ${name}`}
          description="This container will be removed."
          confirmLabel="Delete"
          confirmValue={name}
          variant="name"
          onClose={() => setConfirmDelete(false)}
          onConfirm={() => runAction('delete', `Deleted ${name}`, () => navigate('/containers'))}
        />
      )}
    </div>
  )
}
