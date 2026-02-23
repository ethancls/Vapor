import { useState, lazy, Suspense } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Power, PowerOff, Pause, RotateCcw, Trash2, Key, CircleArrowUp, Loader2 } from 'lucide-react'
import { sileo } from 'sileo'
import { api } from '../api/client'
import ConfirmModal from '../components/ConfirmModal'
import Tooltip from '../components/Tooltip'
import DetailsTabs from '../components/instance-details/DetailsTabs'
import OverviewPanel from '../components/instance-details/OverviewPanel'
const HistoryPanel = lazy(() => import('../components/instance-details/HistoryPanel'))
import SnapshotsPanel from '../components/instance-details/SnapshotsPanel'
import ShellPanel from '../components/instance-details/ShellPanel'
import InstanceStateBadge from '../components/instances/InstanceStateBadge'
import SshAccessModal from '../components/instances/SshAccessModal'
import UpdatesModal from '../components/instances/UpdatesModal'

const TABS = [
  { value: 'shell', label: 'Shell' },
  { value: 'history', label: 'History' },
  { value: 'snapshots', label: 'Snapshots' },
]

function InstanceDetailsSkeleton() {
  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, gap: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="skeleton" style={{ width: 240, height: 30, borderRadius: 8 }} />
          <div className="skeleton" style={{ width: 92, height: 22, borderRadius: 999 }} />
        </div>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {['s0','s1','s2','s3'].map(k => (
            <div key={k} className="skeleton" style={{ width: 34, height: 34, borderRadius: 9 }} />
          ))}
        </div>
      </div>

      <div style={{ marginTop: 4 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          {['s0','s1','s2'].map(k => (
            <div key={k} className="skeleton" style={{ width: 96, height: 34, borderRadius: 999 }} />
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(130px, 100%), 1fr))', gap: 10 }}>
          {['s0','s1','s2','s3','s4'].map(k => (
            <div key={k} className="skeleton" style={{ height: 72, borderRadius: 10 }} />
          ))}
        </div>
        <div className="skeleton" style={{ height: 150, borderRadius: 10, marginTop: 16 }} />
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
        style={{
          width: 34,
          height: 34,
          borderRadius: 9,
          border: 'none',
          background: 'transparent',
          color: disabled && !isLoading ? 'var(--text-muted)' : color,
          cursor: isLoading || disabled ? 'default' : 'pointer',
          opacity: disabled && !isLoading ? 0.45 : 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'background 0.12s',
          flexShrink: 0,
        }}
        onMouseEnter={(e) => {
          if (!isLoading && !disabled) e.currentTarget.style.background = `color-mix(in srgb, ${color} 12%, transparent)`
        }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
      >
        {isLoading
          ? <Loader2 size={14} style={{ animation: 'spin 0.7s linear infinite' }} />
          : icon}
      </button>
    </Tooltip>
  )
}

export default function InstanceDetails() {
  const { name: rawName } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const name = decodeURIComponent(rawName || '')
  const updatesItems = useQuery({
    queryKey: ['updates'],
    queryFn: () => api.getUpdates(),
    staleTime: 60000,
    refetchInterval: 120000,
  }).data?.updates || []

  const updatesEntry      = updatesItems.find(u => u.instance === name)
  const hasPendingUpdates = (updatesEntry?.upgradable || 0) > 0
  const updatesColor      = hasPendingUpdates ? '#22d3ee' : 'var(--text-muted)'

  const [tab, setTab] = useState('shell')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [sshDialogOpen, setSshDialogOpen] = useState(false)
  const [updatesDialogOpen, setUpdatesDialogOpen] = useState(false)
  const [activeAction, setActiveAction] = useState('')

  const instanceQuery = useQuery({
    queryKey: ['instance', name],
    queryFn: () => api.getInstance(name),
    enabled: Boolean(name),
    refetchInterval: 7000,
  })

  const historyQuery = useQuery({
    queryKey: ['history', name],
    queryFn: () => api.getHistory(name),
    enabled: Boolean(name),
    refetchInterval: 7000,
  })

  const snapshotsQuery = useQuery({
    queryKey: ['snapshots', name],
    queryFn: () => api.getSnapshots(name),
    enabled: Boolean(name),
  })

  async function runAction(actionKey, fn, successTitle) {
    setActiveAction(actionKey)
    try {
      const result = await fn()
      qc.invalidateQueries({ queryKey: ['instances'] })
      qc.invalidateQueries({ queryKey: ['instance', name] })
      qc.invalidateQueries({ queryKey: ['stats'] })
      qc.invalidateQueries({ queryKey: ['activity'] })
      qc.invalidateQueries({ queryKey: ['history', name] })
      qc.invalidateQueries({ queryKey: ['snapshots', name] })
      sileo.success({ title: successTitle })
      return result
    } catch (error) {
      sileo.error({ title: error?.message || 'Action failed' })
    } finally {
      setActiveAction('')
    }
  }


  if (instanceQuery.isLoading) {
    return <InstanceDetailsSkeleton />
  }

  if (instanceQuery.error || !instanceQuery.data) {
    return (
      <div className="page">
        <p className="mono" style={{ fontSize: 12, color: 'var(--stopped)' }}>
          Instance not found or unavailable.
        </p>
      </div>
    )
  }

  const instance = instanceQuery.data
  const snapshots = snapshotsQuery.data?.snapshots || []
  const history = historyQuery.data?.history || []
  const isRunning = instance.state === 'Running'
  const busy = Boolean(activeAction)



  return (
    <div className="page">
      <div className="instances-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, minWidth: 0 }}>
          <h1 className="page-title" style={{ fontSize: 30, lineHeight: 1, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</h1>
          <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
            <InstanceStateBadge state={instance.state} />
          </span>
        </div>

        <div className="instance-details-header-actions" style={{ display: 'flex', gap: 4, alignItems: 'center', flexShrink: 0 }}>
          {!isRunning && (
            <IconActionButton
              icon={<Power size={14} />}
              label="Start"
              color="var(--running)"
              disabled={busy && activeAction !== 'start'}
              isLoading={activeAction === 'start'}
              onClick={() => runAction('start', () => api.startInstance(name), `Started ${name}`)}
            />
          )}

          {isRunning && (
            <>
              <IconActionButton
                icon={<PowerOff size={14} />}
                label="Stop"
                color="var(--stopped)"
                disabled={busy && activeAction !== 'stop'}
                isLoading={activeAction === 'stop'}
                onClick={() => runAction('stop', () => api.stopInstance(name), `Stopped ${name}`)}
              />
              <IconActionButton
                icon={<Pause size={14} />}
                label="Suspend"
                color="var(--suspended)"
                disabled={busy && activeAction !== 'suspend'}
                isLoading={activeAction === 'suspend'}
                onClick={() => runAction('suspend', () => api.suspendInstance(name), `Suspended ${name}`)}
              />
              <IconActionButton
                icon={<RotateCcw size={14} />}
                label="Restart"
                color="#60a5fa"
                disabled={busy && activeAction !== 'restart'}
                isLoading={activeAction === 'restart'}
                onClick={() => runAction('restart', () => api.restartInstance(name), `Restarted ${name}`)}
              />
            </>
          )}

          <IconActionButton
            icon={<Key size={14} />}
            label="SSH Access"
            color="#facc15"
            disabled={busy}
            onClick={() => setSshDialogOpen(true)}
          />

          <IconActionButton
            icon={<CircleArrowUp size={14} />}
            label={hasPendingUpdates ? 'Updates' : 'No updates'}
            color={updatesColor}
            disabled={busy || !hasPendingUpdates}
            onClick={() => setUpdatesDialogOpen(true)}
          />

          <IconActionButton
            icon={<Trash2 size={14} />}
            label="Delete"
            color="var(--stopped)"
            disabled={busy && activeAction !== 'delete'}
            isLoading={activeAction === 'delete'}
            onClick={() => setConfirmDelete(true)}
          />
        </div>
      </div>

      <div style={{ marginTop: 4 }}>
        <OverviewPanel instance={instance} />
        <DetailsTabs tabs={TABS} value={tab} onChange={setTab} />

        {tab === 'shell' && <ShellPanel name={name} isRunning={isRunning} />}
        {tab === 'history' && <Suspense fallback={null}><HistoryPanel history={history} /></Suspense>}
        {tab === 'snapshots' && (
          <SnapshotsPanel
            instanceName={name}
            snapshots={snapshots}
            loading={busy}
            onCreate={(snapName, comment) => runAction('snapshot-create', () => api.createSnapshot(name, snapName, comment), 'Snapshot created')}
            onRestore={(snapName) => runAction('snapshot-restore', () => api.restoreSnapshot(name, snapName), `Restored ${snapName}`)}
            onDelete={(snapName) => runAction('snapshot-delete', () => api.deleteSnapshot(name, snapName), `Deleted ${snapName}`)}
          />
        )}
      </div>

      {confirmDelete && (
        <ConfirmModal
          title={`Delete ${name}`}
          description={`The instance "${name}" will be permanently deleted and purged. All data will be lost.`}
          confirmLabel="Delete"
          confirmValue={name}
          variant="name"
          onClose={() => setConfirmDelete(false)}
          onConfirm={async () => {
            await runAction('delete', () => api.deleteInstance(name), `Deleted ${name}`)
            navigate('/instances')
          }}
        />
      )}

      {sshDialogOpen && (
        <SshAccessModal
          instanceName={name}
          onClose={() => setSshDialogOpen(false)}
        />
      )}

      {updatesDialogOpen && (
        <UpdatesModal
          instanceName={name}
          onClose={() => setUpdatesDialogOpen(false)}
        />
      )}
    </div>
  )
}
