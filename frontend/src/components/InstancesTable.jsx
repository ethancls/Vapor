import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Play, Square, Pause, Camera, RotateCcw, CopyPlus, Trash2, Loader2, Copy, Check, ChevronsUpDown, ChevronUp, ChevronDown, TerminalSquare, KeyRound, ShieldAlert } from 'lucide-react'
import { sileo } from 'sileo'
import { api } from '../api/client'
import ConfirmModal from './ConfirmModal'
import InstanceStateBadge from './instances/InstanceStateBadge'
import InstancesCheckbox from './instances/InstancesCheckbox'
import ActionRadialMenu from './instances/ActionRadialMenu'
import CloneInstanceModal from './instances/CloneInstanceModal'
import SshAccessModal from './instances/SshAccessModal'
import UpdatesModal from './instances/UpdatesModal'
import { fmtResource, sortValue } from './instances/instancesUtils'

const COLUMNS = [
  { key: 'name', label: 'Name' },
  { key: 'state', label: 'State' },
  { key: 'ipv4', label: 'IPv4' },
  { key: 'image', label: 'Image' },
  { key: 'cpus', label: 'CPUs' },
  { key: 'memory', label: 'Memory' },
  { key: 'disk', label: 'Disk' },
  { key: null, label: 'Actions' },
]

function CopyIP({ ips = [] }) {
  const [copiedIp, setCopiedIp] = useState('')
  const items = Array.isArray(ips) ? ips.filter(Boolean) : []
  if (items.length === 0) return <span className="mono" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>—</span>

  function doCopy(e, ip) {
    e.stopPropagation()
    navigator.clipboard.writeText(ip).then(() => {
      setCopiedIp(ip)
      setTimeout(() => setCopiedIp((current) => (current === ip ? '' : current)), 1800)
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {items.map((ip) => (
        <div key={ip} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span className="mono" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{ip}</span>
          <button
            onClick={(e) => doCopy(e, ip)}
            title={copiedIp === ip ? 'Copied!' : 'Copy IP'}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: '2px 3px',
              color: copiedIp === ip ? 'var(--running)' : 'var(--text-secondary)',
              display: 'flex', alignItems: 'center', borderRadius: 4, transition: 'color 0.2s', flexShrink: 0,
            }}
          >
            {copiedIp === ip ? <Check size={11} /> : <Copy size={11} />}
          </button>
          <a
            href={`ssh://ubuntu@${ip}`}
            title={`Open SSH: ssh ubuntu@${ip}`}
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: '2px 3px',
              color: 'var(--text-secondary)',
              display: 'flex', alignItems: 'center', borderRadius: 4, transition: 'color 0.2s',
              flexShrink: 0,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent)' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)' }}
          >
            <TerminalSquare size={11} />
          </a>
        </div>
      ))}
    </div>
  )
}

function ActionBtn({ icon, color, title, onClick }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: 34, height: 34, borderRadius: 9, border: 'none',
        background: 'transparent', color, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'background 0.12s', flexShrink: 0,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = `color-mix(in srgb, ${color} 12%, transparent)` }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
    >
      {icon}
    </button>
  )
}

export default function InstancesTable({
  instances = [],
  selectedNames = new Set(),
  onToggleSelect,
  onToggleSelectAll,
  searchQuery = '',
}) {
  const location = useLocation()
  const [sort, setSort] = useState({ key: 'name', dir: 'asc' })
  const [loading, setLoading] = useState({})
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [cloneDialog, setCloneDialog] = useState(null)
  const [sshDialogInstance, setSshDialogInstance] = useState('')
  const [updatesDialogInstance, setUpdatesDialogInstance] = useState('')
  const qc = useQueryClient()

  function toggleSort(key) {
    if (!key) return
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }))
  }

  const sorted = [...instances].sort((a, b) => {
    if (!sort.key) return 0
    const av = sortValue(a, sort.key)
    const bv = sortValue(b, sort.key)
    const cmp = typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv))
    return sort.dir === 'asc' ? cmp : -cmp
  })

  const allSelected = sorted.length > 0 && sorted.every((i) => selectedNames.has(i.name))

  async function doAction(name, fn, successMsg) {
    setLoading((l) => ({ ...l, [name]: true }))
    const MIN = new Promise((r) => setTimeout(r, 500))
    const promise = Promise.all([fn(), MIN]).then(([res]) => {
      qc.invalidateQueries({ queryKey: ['instances'] })
      qc.invalidateQueries({ queryKey: ['stats'] })
      qc.invalidateQueries({ queryKey: ['activity'] })
      return res
    })

    sileo.promise(promise, {
      loading: { title: 'Working…' },
      success: { title: successMsg },
      error: (e) => ({ title: e.message }),
    })
    try {
      await promise
    } catch (err) {
      void err
    }
    setLoading((l) => ({ ...l, [name]: false }))
  }

  return (
    <>
      <div className="instances-table-shell" style={{ background: 'var(--card-1)', borderRadius: 'var(--r-card)', border: '1px solid var(--border)', overflow: 'visible' }}>
        <div className="instances-table-scroll no-scrollbar" style={{ overflowX: 'auto', overflowY: 'visible' }}>
          <table className="instances-table" style={{ width: '100%', minWidth: 980, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <th style={{ padding: '12px 10px 12px 14px', width: 40 }}>
                <InstancesCheckbox checked={allSelected} onChange={() => onToggleSelectAll(sorted.map((s) => s.name), allSelected)} />
              </th>
              {COLUMNS.map(({ key, label }) => {
                const active = sort.key === key
                const SortIcon = active ? (sort.dir === 'asc' ? ChevronUp : ChevronDown) : ChevronsUpDown
                return (
                  <th
                    key={label}
                    onClick={() => toggleSort(key)}
                    style={{
                      padding: '12px 18px', textAlign: 'left',
                      fontSize: 10.5, fontWeight: 700, color: active ? 'var(--accent)' : 'var(--text-secondary)',
                      textTransform: 'uppercase', letterSpacing: '0.08em', whiteSpace: 'nowrap',
                      cursor: key ? 'pointer' : 'default', userSelect: 'none',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      {label}
                      {key && <SortIcon size={11} style={{ opacity: active ? 1 : 0.4, flexShrink: 0 }} />}
                    </div>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr>
                <td colSpan={9} style={{ padding: '36px 18px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
                  {searchQuery.trim() ? `No results for "${searchQuery}"` : 'No instances'}
                </td>
              </tr>
            )}
            {sorted.map((inst, idx) => {
              const { name, state, ipv4 = [], image, cpus, memory, disk } = inst
              const busy = loading[name]
              return (
                <tr
                  key={name}
                  style={{ borderBottom: idx < sorted.length - 1 ? '1px solid var(--border)' : 'none', transition: 'background 0.1s' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.018)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                >
                  <td style={{ padding: '14px 10px 14px 14px' }}>
                    <InstancesCheckbox checked={selectedNames.has(name)} onChange={() => onToggleSelect(name)} />
                  </td>
                  <td style={{ padding: '14px 18px' }}>
                    <Link
                      to={`/instances/${encodeURIComponent(name)}`}
                      state={{ from: location.pathname }}
                      className="mono"
                      style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}
                    >
                      {name}
                    </Link>
                  </td>
                  <td style={{ padding: '14px 18px' }}><InstanceStateBadge state={state} /></td>
                  <td style={{ padding: '14px 18px' }}><CopyIP ips={ipv4} /></td>
                  <td style={{ padding: '14px 18px' }}>
                    <span className="mono" style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>{image || '—'}</span>
                  </td>
                  <td style={{ padding: '14px 18px' }}>
                    <span className="mono" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{cpus || '—'}</span>
                  </td>
                  <td style={{ padding: '14px 18px' }}>
                    <span className="mono" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{fmtResource(memory?.total)}</span>
                  </td>
                  <td style={{ padding: '14px 18px' }}>
                    <span className="mono" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{fmtResource(disk?.total)}</span>
                  </td>
                  <td style={{ padding: '14px 18px' }}>
                    <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                      {busy ? (
                        <Loader2 size={16} style={{ color: 'var(--text-secondary)', animation: 'spin 0.7s linear infinite' }} />
                      ) : (
                        <>
                          {state !== 'Running' && (
                            <ActionBtn icon={<Play size={14} />} color="var(--running)" title="Start" onClick={() => doAction(name, () => api.startInstance(name), `Started ${name}`)} />
                          )}
                          {state === 'Running' && (
                            <ActionBtn icon={<Square size={14} />} color="var(--stopped)" title="Stop" onClick={() => doAction(name, () => api.stopInstance(name), `Stopped ${name}`)} />
                          )}
                          {state === 'Running' && (
                            <ActionBtn icon={<Pause size={14} />} color="var(--suspended)" title="Suspend" onClick={() => doAction(name, () => api.suspendInstance(name), `Suspended ${name}`)} />
                          )}
                          {state === 'Running' && (
                            <ActionBtn icon={<RotateCcw size={14} />} color="#60a5fa" title="Restart" onClick={() => doAction(name, () => api.restartInstance(name), `Restarted ${name}`)} />
                          )}
                          <ActionRadialMenu
                            actions={[
                              {
                                label: 'SSH Access',
                                icon: <KeyRound size={13} />,
                                color: '#facc15',
                                onClick: () => setSshDialogInstance(name),
                              },
                              {
                                label: 'Updates',
                                icon: <ShieldAlert size={13} />,
                                color: '#60a5fa',
                                onClick: () => setUpdatesDialogInstance(name),
                              },
                              {
                                label: 'Snapshot',
                                icon: <Camera size={13} />,
                                color: '#a78bfa',
                                onClick: () => doAction(name, () => api.createSnapshot(name), `Snapshot created for ${name}`),
                              },
                              {
                                label: 'Clone',
                                icon: <CopyPlus size={13} />,
                                color: '#34d399',
                                onClick: () => setCloneDialog({ source: name, suggested: `${name}-clone` }),
                              },
                            ]}
                          />
                          <ActionBtn icon={<Trash2 size={14} />} color="var(--stopped)" title="Delete" onClick={() => setConfirmDelete(name)} />
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
          </table>
        </div>
      </div>

      {confirmDelete && (
        <ConfirmModal
          title={`Delete ${confirmDelete}`}
          description={`The instance "${confirmDelete}" will be permanently deleted and purged. All data inside will be lost.`}
          confirmLabel="Delete"
          confirmValue={confirmDelete}
          variant="name"
          onClose={() => setConfirmDelete(null)}
          onConfirm={() => doAction(confirmDelete, () => api.deleteInstance(confirmDelete), `Deleted ${confirmDelete}`)}
        />
      )}

      {cloneDialog && (
        <CloneInstanceModal
          sourceName={cloneDialog.source}
          initialName={cloneDialog.suggested}
          onClose={() => setCloneDialog(null)}
          onConfirm={(cloneName) => doAction(
            cloneDialog.source,
            () => api.cloneInstance(cloneDialog.source, cloneName),
            `Cloned ${cloneDialog.source} → ${cloneName}`,
          )}
        />
      )}

      {sshDialogInstance && (
        <SshAccessModal
          instanceName={sshDialogInstance}
          onClose={() => setSshDialogInstance('')}
        />
      )}

      {updatesDialogInstance && (
        <UpdatesModal
          instanceName={updatesDialogInstance}
          onClose={() => setUpdatesDialogInstance('')}
        />
      )}
    </>
  )
}
