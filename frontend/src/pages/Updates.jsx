import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { RefreshCw, ShieldAlert, ShieldCheck, Wrench } from 'lucide-react'
import { sileo } from 'sileo'
import { api } from '../api/client'
import CustomSelect from '../components/CustomSelect'

export default function Updates() {
  const qc = useQueryClient()
  const [filter, setFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [busyInstance, setBusyInstance] = useState('')
  const updatesQuery = useQuery({
    queryKey: ['updates'],
    queryFn: () => api.getUpdates(),
    refetchInterval: 60000,
  })

  const items = updatesQuery.data?.updates || []
  const counts = useMemo(() => ({
    all: items.length,
    outdated: items.filter((item) => (item.upgradable || 0) > 0).length,
    uptodate: items.filter((item) => item.checked && (item.upgradable || 0) === 0).length,
    unchecked: items.filter((item) => !item.checked).length,
  }), [items])

  const options = [
    { value: 'all', label: 'All instances' },
    { value: 'outdated', label: 'Needs updates' },
    { value: 'uptodate', label: 'Up to date' },
    { value: 'unchecked', label: 'Not checked' },
  ]

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items.filter((item) => {
      if (filter === 'outdated' && (item.upgradable || 0) === 0) return false
      if (filter === 'uptodate' && (!(item.checked) || (item.upgradable || 0) > 0)) return false
      if (filter === 'unchecked' && item.checked) return false
      if (!q) return true
      const text = [item.instance, item.state, item.error, item.source].join(' ').toLowerCase()
      return text.includes(q)
    })
  }, [items, filter, query])

  async function runUpdates(instance, fullUpgrade = false) {
    setBusyInstance(instance)
    const promise = api.runInstanceUpdates(instance, {
      full_upgrade: fullUpgrade,
      refresh: true,
      autoremove: true,
    }).then(async (result) => {
      await Promise.all([
        updatesQuery.refetch(),
        qc.invalidateQueries({ queryKey: ['instance-updates', instance] }),
        qc.invalidateQueries({ queryKey: ['activity'] }),
      ])
      return result
    })

    sileo.promise(promise, {
      loading: { title: fullUpgrade ? `Full upgrade on ${instance}…` : `Upgrade on ${instance}…` },
      success: { title: fullUpgrade ? `Full upgrade done on ${instance}` : `Upgrade done on ${instance}` },
      error: (e) => ({ title: e.message }),
    })
    try {
      await promise
    } catch (err) {
      void err
    } finally {
      setBusyInstance('')
    }
  }

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 className="page-title">Updates</h1>
          <p className="mono" style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 7 }}>
            {counts.outdated} instance{counts.outdated !== 1 ? 's' : ''} need updates · {counts.uptodate} up to date
          </p>
        </div>
        <button className="btn-ghost" onClick={() => updatesQuery.refetch()}>
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 7,
          background: 'var(--card-2)', border: '1px solid var(--border)',
          borderRadius: 'var(--r-sm)', padding: '0 10px', height: 36, width: 'clamp(180px, 35vw, 280px)',
        }}>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search instances"
            style={{
              background: 'none', border: 'none', outline: 'none',
              color: 'var(--text-primary)', fontFamily: 'IBM Plex Mono', fontSize: 12,
              width: '100%',
            }}
          />
        </div>
        <CustomSelect
          value={filter}
          onChange={setFilter}
          options={options}
          controlHeight={36}
          style={{ minWidth: 170, width: 'clamp(170px, 24vw, 230px)' }}
        />
      </div>

      <div className="instances-table-shell" style={{ background: 'var(--card-1)', borderRadius: 'var(--r-card)', border: '1px solid var(--border)' }}>
        <div className="instances-table-scroll" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: 860, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Instance', 'State', 'Updates', 'Security', 'Reboot', 'Status', 'Actions'].map((label) => (
                  <th key={label} style={{
                    padding: '12px 18px', textAlign: 'left',
                    fontSize: 10.5, fontWeight: 700, color: 'var(--text-secondary)',
                    textTransform: 'uppercase', letterSpacing: '0.08em', whiteSpace: 'nowrap',
                  }}>
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ padding: '34px 18px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
                    No matching instances
                  </td>
                </tr>
              )}
              {filtered.map((item) => {
                const outdated = (item.upgradable || 0) > 0
                const blocked = !item.checked
                return (
                  <tr key={item.instance} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '14px 18px' }}>
                      <Link to={`/instances/${encodeURIComponent(item.instance)}`} className="mono" style={{ fontSize: 12.5, color: 'var(--accent)', fontWeight: 700 }}>
                        {item.instance}
                      </Link>
                    </td>
                    <td style={{ padding: '14px 18px' }}>
                      <span className="mono" style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>{item.state}</span>
                    </td>
                    <td style={{ padding: '14px 18px' }}>
                      <span className="mono" style={{ fontSize: 12, color: outdated ? '#facc15' : 'var(--text-secondary)' }}>{item.upgradable || 0}</span>
                    </td>
                    <td style={{ padding: '14px 18px' }}>
                      <span className="mono" style={{ fontSize: 12, color: (item.security || 0) > 0 ? 'var(--stopped)' : 'var(--text-secondary)' }}>{item.security || 0}</span>
                    </td>
                    <td style={{ padding: '14px 18px' }}>
                      <span className="mono" style={{ fontSize: 11.5, color: item.reboot_required ? '#fb923c' : 'var(--text-secondary)' }}>
                        {item.reboot_required ? 'required' : 'no'}
                      </span>
                    </td>
                    <td style={{ padding: '14px 18px' }}>
                      {blocked ? (
                        <span className="mono" style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                          {item.error || 'not checked'}
                        </span>
                      ) : outdated ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#facc15', fontSize: 12, fontWeight: 700 }}>
                          <ShieldAlert size={12} /> pending
                        </span>
                      ) : (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--running)', fontSize: 12, fontWeight: 700 }}>
                          <ShieldCheck size={12} /> up to date
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '14px 18px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          className="btn-ghost"
                          style={{ height: 30, padding: '0 9px' }}
                          disabled={item.state !== 'Running' || busyInstance === item.instance}
                          onClick={() => runUpdates(item.instance, false)}
                        >
                          <Wrench size={11} /> Run
                        </button>
                        <button
                          className="btn-ghost"
                          style={{ height: 30, padding: '0 9px' }}
                          disabled={item.state !== 'Running' || busyInstance === item.instance}
                          onClick={() => runUpdates(item.instance, true)}
                        >
                          <Wrench size={11} /> Full
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
