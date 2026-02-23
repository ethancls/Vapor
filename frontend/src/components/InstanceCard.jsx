import { useState, useRef, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useLocation, useNavigate } from 'react-router-dom'
import { createPortal } from 'react-dom'
import { Play, Square, Pause, Camera, Trash2, Grip, Loader2, Key, CircleArrowUp, ArrowUpRight, RotateCcw, CopyPlus, ArchiveRestore } from 'lucide-react'
import { api } from '../api/client'
import { sileo } from 'sileo'
import ConfirmModal from './ConfirmModal'
import InstanceStateBadge from './instances/InstanceStateBadge'
import CopyIP from './instances/CopyIP'
import SshAccessModal from './instances/SshAccessModal'
import UpdatesModal from './instances/UpdatesModal'
import CloneInstanceModal from './instances/CloneInstanceModal'
import ResourceUsage from './instances/ResourceUsage'
import { invalidateInstanceQueries, randomSnapshotName } from './instances/instancesUtils'

const TARGET_STATE = {
  start:   'Running',
  stop:    'Stopped',
  suspend: 'Suspended',
  restart: 'Running',
  recover: 'Stopped',
}

export default function InstanceCard({ instance }) {
  const [menuOpen, setMenuOpen]           = useState(false)
  const [menuPos, setMenuPos]             = useState({ top: 0, left: 0 })
  const [loading, setLoading]             = useState(null) // action key or null
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [sshDialogOpen, setSshDialogOpen] = useState(false)
  const [updatesDialogOpen, setUpdatesDialogOpen] = useState(false)
  const [cloneDialog, setCloneDialog]     = useState(null)
  const btnRef     = useRef(null)
  const menuRef    = useRef(null)
  const timeoutRef = useRef(null)
  const qc = useQueryClient()
  const navigate = useNavigate()
  const location = useLocation()
  const updatesItems = useQuery({
    queryKey: ['updates'],
    queryFn: () => api.getUpdates(),
    staleTime: 60000,
    refetchInterval: 120000,
  }).data?.updates || []

  // Clear spinner when WebSocket pushes the target state
  useEffect(() => {
    if (!loading) return
    const target = TARGET_STATE[loading]
    if (target && instance.state === target) {
      setLoading(null)
      clearTimeout(timeoutRef.current)
    }
  }, [instance.state, loading])

  useEffect(() => () => clearTimeout(timeoutRef.current), [])

  useEffect(() => {
    if (!menuOpen) return
    const fn = (e) => {
      if (btnRef.current?.contains(e.target)) return
      if (menuRef.current?.contains(e.target)) return
      setMenuOpen(false)
    }
    const onEsc = (e) => { if (e.key === 'Escape') setMenuOpen(false) }
    document.addEventListener('mousedown', fn)
    window.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', fn)
      window.removeEventListener('keydown', onEsc)
    }
  }, [menuOpen])

  async function doAction(actionKey, fn, successMsg) {
    setLoading(actionKey)
    setMenuOpen(false)
    try {
      await fn()
      invalidateInstanceQueries(qc)
      sileo.success({ title: successMsg })
      if (!TARGET_STATE[actionKey]) {
        setLoading(null)
        return
      }
      clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(() => setLoading(null), 30_000)
    } catch (err) {
      sileo.error({ title: err.message })
      setLoading(null)
      clearTimeout(timeoutRef.current)
    }
  }

  function handleToggleMenu(e) {
    e.stopPropagation()
    if (!menuOpen && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      setMenuPos({ top: rect.bottom + 6, right: window.innerWidth - rect.right })
    }
    setMenuOpen(o => !o)
  }

  const { name, state, ipv4 = [], image, cpus, memory, disk } = instance

  const updatesEntry      = updatesItems.find(u => u.instance === name)
  const hasPendingUpdates = (updatesEntry?.upgradable || 0) > 0
  const updatesColor      = hasPendingUpdates ? '#22d3ee' : 'var(--text-muted)'

  return (
    <>
      <div
        className="card"
        style={{ position: 'relative', transition: 'border-color 0.18s, background 0.18s', height: '100%', boxSizing: 'border-box' }}
        onMouseEnter={e => { e.currentTarget.style.borderColor='rgba(181,242,61,0.22)'; e.currentTarget.style.background='var(--card-2)' }}
        onMouseLeave={e => { e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.background='var(--card-1)' }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 7 }}>
              <p className="mono" style={{ fontWeight: 600, fontSize: 13, lineHeight: 1, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {name}
              </p>
              <button
                type="button"
                aria-label={`Open ${name}`}
                onClick={(e) => {
                  e.stopPropagation()
                  navigate(`/instances/${encodeURIComponent(name)}`, { state: { from: location.pathname } })
                }}
                style={{
                  background: 'none', border: 'none', padding: 0, margin: 0,
                  cursor: 'pointer', color: 'var(--text-secondary)',
                  display: 'inline-flex', alignItems: 'center', flexShrink: 0,
                  transition: 'color 0.13s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent)' }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)' }}
              >
                <ArrowUpRight size={13} />
              </button>
            </div>
            <InstanceStateBadge state={state} />
          </div>

          <button
            ref={btnRef}
            onClick={handleToggleMenu}
            style={{
              background: 'var(--card-2)', border: '1px solid var(--border)',
              borderRadius: 8, padding: '5px 6px', cursor: 'pointer',
              color: 'var(--text-secondary)', display: 'flex', alignItems: 'center',
              flexShrink: 0, marginLeft: 8,
              transition: 'border-color 0.13s, color 0.13s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor='var(--border-hover)'; e.currentTarget.style.color='var(--text-primary)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.color='var(--text-secondary)' }}
          >
            {loading ? <Loader2 size={14} style={{ animation: 'spin 0.7s linear infinite' }} /> : <Grip size={14} />}
          </button>
        </div>

        {/* IP */}
        <div className="stat-cell" style={{ marginBottom: 10 }}>
          <span className="stat-label">IP</span>
          <CopyIP ips={ipv4} />
        </div>

        {/* CPU / RAM / Disk */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 12 }}>
          <div className="stat-cell">
            <span className="stat-label">CPU</span>
            <span className="stat-value">{cpus || '—'}</span>
          </div>
          {[
            { label: 'RAM',  used: memory?.used,  total: memory?.total },
            { label: 'Disk', used: disk?.used,    total: disk?.total   },
          ].map(({ label, used, total }) => (
            <div className="stat-cell" key={label}>
              <span className="stat-label">{label}</span>
              <ResourceUsage used={used} total={total} compact />
            </div>
          ))}
        </div>

        <p className="mono" style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1 }}>
          {image || '—'}
        </p>
      </div>

      {/* Dropdown portal */}
      {menuOpen && createPortal(
        <div
          ref={menuRef}
          style={{
            position: 'fixed',
            top: menuPos.top,
            right: menuPos.right,
            zIndex: 9999,
            background: 'var(--card-3)', border: '1px solid var(--border)',
            borderRadius: 13, padding: 5, minWidth: 165,
            boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
          }}
        >
          {state !== 'Running' && state !== 'Deleted' && (
            <MenuItem icon={<Play size={14} />} label="Start" color="var(--running)"
              disabled={!!loading}
              onClick={() => doAction('start', () => api.startInstance(name), `Started ${name}`)} />
          )}
          {state === 'Running' && (
            <MenuItem icon={<Square size={14} />} label="Stop" color="var(--stopped)"
              disabled={!!loading}
              onClick={() => doAction('stop', () => api.stopInstance(name), `Stopped ${name}`)} />
          )}
          {state === 'Running' && (
            <MenuItem icon={<Pause size={14} />} label="Suspend" color="var(--suspended)"
              disabled={!!loading}
              onClick={() => doAction('suspend', () => api.suspendInstance(name), `Suspended ${name}`)} />
          )}
          {state === 'Running' && (
            <MenuItem icon={<RotateCcw size={14} />} label="Restart" color="#60a5fa"
              disabled={!!loading}
              onClick={() => doAction('restart', () => api.restartInstance(name), `Restarted ${name}`)} />
          )}
          <div style={{ height: 1, background: 'var(--border)', margin: '4px 6px' }} />
          <MenuItem icon={<Key size={14} />} label="SSH Access" color="#facc15"
            disabled={!!loading || state !== 'Running'}
            onClick={() => { setMenuOpen(false); setSshDialogOpen(true) }} />
          <MenuItem icon={<CircleArrowUp size={14} />} label="Updates" color={updatesColor}
            disabled={!!loading || state !== 'Running' || !hasPendingUpdates}
            onClick={() => { setMenuOpen(false); setUpdatesDialogOpen(true) }} />
          <MenuItem icon={<Camera size={14} />} label="Snapshot" color="#a78bfa"
            disabled={!!loading || state !== 'Stopped'}
            onClick={() => doAction('snapshot', () => api.createSnapshot(name, randomSnapshotName(name)), `Snapshot created`)} />
          <MenuItem icon={<CopyPlus size={14} />} label="Clone" color="#34d399"
            disabled={!!loading || state !== 'Stopped'}
            onClick={() => { setMenuOpen(false); setCloneDialog({ source: name, suggested: `${name}-clone` }) }} />
          {state === 'Deleted' && (
            <MenuItem icon={<ArchiveRestore size={14} />} label="Recover" color="#34d399"
              disabled={!!loading}
              onClick={() => doAction('recover', () => api.recoverInstance(name), `Recovered ${name}`)} />
          )}
          <div style={{ height: 1, background: 'var(--border)', margin: '4px 6px' }} />
          <MenuItem icon={<Trash2 size={14} />} label={state === 'Deleted' ? 'Purge' : 'Delete'} color="var(--stopped)"
            disabled={!!loading}
            onClick={() => { setMenuOpen(false); setConfirmDelete(true) }} />
        </div>,
        document.body,
      )}

      {confirmDelete && (
        <ConfirmModal
          title={`Delete ${name}`}
          description={`The instance "${name}" will be permanently deleted and purged. All data inside will be lost.`}
          confirmLabel="Delete"
          confirmValue={name}
          variant="name"
          onClose={() => setConfirmDelete(false)}
          onConfirm={() => doAction('delete', () => api.deleteInstance(name), `Deleted ${name}`)}
        />
      )}

      {sshDialogOpen && (
        <SshAccessModal instanceName={name} onClose={() => setSshDialogOpen(false)} />
      )}

      {updatesDialogOpen && (
        <UpdatesModal instanceName={name} onClose={() => setUpdatesDialogOpen(false)} />
      )}

      {cloneDialog && (
        <CloneInstanceModal
          sourceName={cloneDialog.source}
          initialName={cloneDialog.suggested}
          onClose={() => setCloneDialog(null)}
          onConfirm={(cloneName) => doAction(
            'clone',
            () => api.cloneInstance(cloneDialog.source, cloneName),
            `Cloned ${cloneDialog.source} → ${cloneName}`,
          )}
        />
      )}
    </>
  )
}

function MenuItem({ icon, label, color, onClick, disabled }) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 8, width: '100%',
        background: 'none', border: 'none', padding: '8px 11px',
        color: disabled ? 'var(--text-muted)' : (color || 'var(--text-primary)'),
        fontSize: 13, cursor: disabled ? 'not-allowed' : 'pointer',
        borderRadius: 8, fontFamily: 'Syne', fontWeight: 600,
        opacity: disabled ? 0.45 : 1,
        transition: 'background 0.1s', lineHeight: 1,
      }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
    >
      {icon} {label}
    </button>
  )
}
