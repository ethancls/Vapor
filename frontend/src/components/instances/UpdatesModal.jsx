import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { RefreshCw, ShieldAlert, ShieldCheck, Wrench } from 'lucide-react'
import { sileo } from 'sileo'
import Modal from '../Modal'
import { api } from '../../api/client'

export default function UpdatesModal({ instanceName, onClose }) {
  const qc = useQueryClient()
  const [running, setRunning] = useState(false)
  const updatesQuery = useQuery({
    queryKey: ['instance-updates', instanceName],
    queryFn: () => api.getInstanceUpdates(instanceName),
    enabled: Boolean(instanceName),
  })

  const item = useMemo(() => {
    const updates = updatesQuery.data?.updates
    if (!Array.isArray(updates) || updates.length === 0) return null
    return updates[0]
  }, [updatesQuery.data])

  const loading = updatesQuery.isLoading
  const error = updatesQuery.error?.message
  const hasUpdates = (item?.upgradable || 0) > 0
  const hasSecurity = (item?.security || 0) > 0
  const canRun = item?.state === 'Running' && !running

  async function runUpdates(fullUpgrade = false) {
    setRunning(true)
    const promise = api.runInstanceUpdates(instanceName, {
      full_upgrade: fullUpgrade,
      refresh: true,
      autoremove: true,
    }).then(async (result) => {
      await Promise.all([
        updatesQuery.refetch(),
        qc.invalidateQueries({ queryKey: ['updates'] }),
        qc.invalidateQueries({ queryKey: ['instance-updates', instanceName] }),
        qc.invalidateQueries({ queryKey: ['activity'] }),
      ])
      return result
    })

    sileo.promise(promise, {
      loading: { title: fullUpgrade ? 'Running full upgrade…' : 'Running upgrade…' },
      success: { title: fullUpgrade ? 'Full upgrade completed' : 'Upgrade completed' },
      error: (e) => ({ title: e.message }),
    })

    try {
      await promise
    } catch (err) {
      void err
    } finally {
      setRunning(false)
    }
  }

  return (
    <Modal
      title={`Updates · ${instanceName}`}
      onClose={onClose}
      size="md"
      footer={(
        <>
          <button className="btn-ghost" onClick={onClose}>Close</button>
          <button className="btn-ghost" onClick={() => runUpdates(false)} disabled={!canRun}>
            <Wrench size={13} /> {running ? 'Running…' : 'Run Upgrade'}
          </button>
          <button className="btn-ghost" onClick={() => runUpdates(true)} disabled={!canRun}>
            <Wrench size={13} /> Full Upgrade
          </button>
          <button className="btn-accent" onClick={() => updatesQuery.refetch()}>
            <RefreshCw size={13} /> Refresh
          </button>
        </>
      )}
    >
      {loading && (
        <p className="mono" style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>
          Checking updates…
        </p>
      )}

      {!loading && error && (
        <p className="mono" style={{ fontSize: 12, color: 'var(--stopped)', margin: 0 }}>
          {error}
        </p>
      )}

      {!loading && !error && item && (
        <div style={{ display: 'grid', gap: 10 }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
            background: hasUpdates ? 'rgba(250,204,21,0.08)' : 'rgba(181,242,61,0.08)',
            border: `1px solid ${hasUpdates ? 'rgba(250,204,21,0.22)' : 'rgba(181,242,61,0.22)'}`,
            borderRadius: 11, padding: '10px 12px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {hasUpdates ? <ShieldAlert size={14} color="#facc15" /> : <ShieldCheck size={14} color="var(--running)" />}
              <span style={{ fontSize: 12.5, fontWeight: 700, color: hasUpdates ? '#facc15' : 'var(--running)' }}>
                {hasUpdates ? 'Updates available' : 'System up to date'}
              </span>
            </div>
            <span className="mono" style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
              source: {item.source || 'unknown'}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
            <Stat label="Upgradable" value={String(item.upgradable || 0)} accent={hasUpdates} />
            <Stat label="Security" value={String(item.security || 0)} accent={hasSecurity} />
            <Stat label="Reboot" value={item.reboot_required ? 'required' : 'no'} accent={item.reboot_required} />
          </div>

          {!item.checked && item.error && (
            <p className="mono" style={{ fontSize: 11.5, color: 'var(--text-secondary)', margin: 0 }}>
              Check not executed: {item.error}
            </p>
          )}

          {item.state !== 'Running' && (
            <p className="mono" style={{ fontSize: 11.5, color: 'var(--text-secondary)', margin: 0 }}>
              Start the instance to run updates.
            </p>
          )}

          {item.packages?.length > 0 && (
            <div style={{ background: 'var(--card-2)', border: '1px solid var(--border)', borderRadius: 11, padding: '10px 12px' }}>
              <p className="section-label" style={{ marginBottom: 8 }}>Top upgradable packages</p>
              <div style={{ maxHeight: 180, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {item.packages.map((line) => (
                  <p key={line} className="mono" style={{ margin: 0, fontSize: 11.5, color: 'var(--text-secondary)' }}>
                    {line}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}

function Stat({ label, value, accent = false }) {
  return (
    <div style={{ background: 'var(--card-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 10px' }}>
      <p className="section-label" style={{ marginBottom: 5 }}>{label}</p>
      <p className="mono" style={{ margin: 0, fontSize: 12.5, color: accent ? 'var(--accent)' : 'var(--text-secondary)' }}>
        {value}
      </p>
    </div>
  )
}
