import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Play, Square, Pause, RotateCcw, Trash2, RefreshCw, ChevronLeft, KeyRound, ShieldAlert } from 'lucide-react'
import { sileo } from 'sileo'
import { api } from '../api/client'
import ConfirmModal from '../components/ConfirmModal'
import DetailsTabs from '../components/instance-details/DetailsTabs'
import OverviewPanel from '../components/instance-details/OverviewPanel'
import HistoryPanel from '../components/instance-details/HistoryPanel'
import SnapshotsPanel from '../components/instance-details/SnapshotsPanel'
import ShellPanel from '../components/instance-details/ShellPanel'
import InstanceStateBadge from '../components/instances/InstanceStateBadge'
import SshAccessModal from '../components/instances/SshAccessModal'
import UpdatesModal from '../components/instances/UpdatesModal'

const TABS = [
  { value: 'overview',  label: 'Overview'  },
  { value: 'shell',     label: 'Shell'     },
  { value: 'history',   label: 'History'   },
  { value: 'snapshots', label: 'Snapshots' },
]

function fmt(bytes) {
  if (!bytes) return null
  const gb = bytes / (1024 ** 3)
  if (gb >= 1) return `${gb.toFixed(1)} GB`
  return `${(bytes / (1024 ** 2)).toFixed(0)} MB`
}

export default function InstanceDetails() {
  const { name: rawName } = useParams()
  const navigate          = useNavigate()
  const qc                = useQueryClient()
  const name              = decodeURIComponent(rawName || '')

  const [tab,           setTab]           = useState('overview')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [sshDialogOpen, setSshDialogOpen] = useState(false)
  const [updatesDialogOpen, setUpdatesDialogOpen] = useState(false)
  const [busy,          setBusy]          = useState(false)

  const instanceQuery = useQuery({
    queryKey: ['instance', name],
    queryFn:  () => api.getInstance(name),
    enabled:  Boolean(name),
    refetchInterval: 7000,
  })

  const historyQuery = useQuery({
    queryKey: ['history', name],
    queryFn:  () => api.getHistory(name),
    enabled:  Boolean(name),
    refetchInterval: 7000,
  })

  const snapshotsQuery = useQuery({
    queryKey: ['snapshots', name],
    queryFn:  () => api.getSnapshots(name),
    enabled:  Boolean(name),
  })

  async function runAction(fn, successTitle) {
    setBusy(true)
    const promise = fn().then(result => {
      qc.invalidateQueries({ queryKey: ['instances'] })
      qc.invalidateQueries({ queryKey: ['instance', name] })
      qc.invalidateQueries({ queryKey: ['stats'] })
      qc.invalidateQueries({ queryKey: ['activity'] })
      qc.invalidateQueries({ queryKey: ['history', name] })
      qc.invalidateQueries({ queryKey: ['snapshots', name] })
      return result
    })
    sileo.promise(promise, {
      loading: { title: 'Working…' },
      success: { title: successTitle },
      error:   (error) => ({ title: error.message }),
    })
    try { await promise } catch { /* noop */ } finally { setBusy(false) }
  }

  if (instanceQuery.isLoading) {
    return (
      <div className="page">
        <p className="mono" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Loading…</p>
      </div>
    )
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

  const instance  = instanceQuery.data
  const snapshots = snapshotsQuery.data?.snapshots || []
  const history   = historyQuery.data?.history     || []
  const isRunning = instance.state === 'Running'

  const ips = Array.isArray(instance.ipv4) ? instance.ipv4.filter(Boolean) : []
  const infoItems = [
    ips.length ? ips.join(' · ') : null,
    instance.image,
    instance.cpus ? `${instance.cpus} vCPU` : null,
    fmt(instance.memory?.total) ? `${fmt(instance.memory?.total)} RAM` : null,
    fmt(instance.disk?.total)   ? `${fmt(instance.disk?.total)} disk` : null,
  ].filter(Boolean)

  return (
    <div className="page">

      {/* ── Header ── */}
      <div style={{ marginBottom: 20 }}>
        {/* Back + name row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
          <div>
            <button
              onClick={() => navigate(-1)}
              style={{
                background: 'none', border: 'none', padding: '0 0 6px 0',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                color: 'var(--text-muted)', fontSize: 12, fontFamily: 'Syne',
                transition: 'color 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-secondary)' }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)' }}
            >
              <ChevronLeft size={14} /> Instances
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h1 className="page-title" style={{ fontSize: 26, lineHeight: 1 }}>{name}</h1>
              <InstanceStateBadge state={instance.state} />
            </div>
            {/* Info strip */}
            {infoItems.length > 0 && (
              <div style={{ display: 'flex', gap: 16, marginTop: 7, flexWrap: 'wrap' }}>
                {infoItems.map(item => (
                  <span key={item} className="mono" style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                    {item}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            {!isRunning && (
              <button className="btn-ghost" style={{ height: 34, padding: '0 11px' }}
                onClick={() => runAction(() => api.startInstance(name), `Started ${name}`)} disabled={busy}>
                <Play size={13} /> Start
              </button>
            )}
            {isRunning && (<>
              <button className="btn-ghost" style={{ height: 34, padding: '0 11px' }}
                onClick={() => runAction(() => api.stopInstance(name), `Stopped ${name}`)} disabled={busy}>
                <Square size={13} /> Stop
              </button>
              <button className="btn-ghost" style={{ height: 34, padding: '0 11px' }}
                onClick={() => runAction(() => api.suspendInstance(name), `Suspended ${name}`)} disabled={busy}>
                <Pause size={13} /> Suspend
              </button>
              <button className="btn-ghost" style={{ height: 34, padding: '0 11px' }}
                onClick={() => runAction(() => api.restartInstance(name), `Restarted ${name}`)} disabled={busy}>
                <RotateCcw size={13} /> Restart
              </button>
            </>)}
            <button className="btn-ghost" style={{ height: 34, padding: '0 11px' }}
              onClick={() => instanceQuery.refetch()} disabled={busy}>
              <RefreshCw size={13} /> Refresh
            </button>
            <button className="btn-ghost" style={{ height: 34, padding: '0 11px' }}
              onClick={() => setSshDialogOpen(true)} disabled={busy}>
              <KeyRound size={13} /> SSH Access
            </button>
            <button className="btn-ghost" style={{ height: 34, padding: '0 11px' }}
              onClick={() => setUpdatesDialogOpen(true)} disabled={busy}>
              <ShieldAlert size={13} /> Updates
            </button>
            <button className="btn-danger" style={{ height: 34, padding: '0 11px' }}
              onClick={() => setConfirmDelete(true)}>
              <Trash2 size={13} /> Delete
            </button>
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <DetailsTabs tabs={TABS} value={tab} onChange={setTab} />

      {/* ── Panels ── */}
      {tab === 'overview'  && <OverviewPanel instance={instance} />}
      {tab === 'shell'     && <ShellPanel name={name} isRunning={isRunning} />}
      {tab === 'history'   && <HistoryPanel history={history} />}
      {tab === 'snapshots' && (
        <SnapshotsPanel
          snapshots={snapshots}
          loading={busy}
          onCreate={(snapName, comment) =>
            runAction(() => api.createSnapshot(name, snapName, comment), `Snapshot created`)}
          onRestore={(snapName) =>
            runAction(() => api.restoreSnapshot(name, snapName), `Restored ${snapName}`)}
          onDelete={(snapName) =>
            runAction(() => api.deleteSnapshot(name, snapName), `Deleted ${snapName}`)}
        />
      )}

      {/* ── Confirm delete ── */}
      {confirmDelete && (
        <ConfirmModal
          title={`Delete ${name}`}
          description={`The instance "${name}" will be permanently deleted and purged. All data will be lost.`}
          confirmLabel="Delete"
          confirmValue={name}
          variant="name"
          onClose={() => setConfirmDelete(false)}
          onConfirm={async () => {
            await runAction(() => api.deleteInstance(name), `Deleted ${name}`)
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
