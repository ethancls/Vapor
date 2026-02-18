import { useState } from 'react'
import { Play, Square, Pause, Trash2, Rocket, Camera, Activity } from 'lucide-react'
import { useActivity } from '../hooks/useActivity'

const ACTION_META = {
  start:    { Icon: Play,     color: 'var(--running)',  bg: 'rgba(181,242,61,0.08)'  },
  stop:     { Icon: Square,   color: 'var(--stopped)',  bg: 'rgba(240,71,71,0.08)'   },
  suspend:  { Icon: Pause,    color: 'var(--suspended)',bg: 'rgba(255,159,10,0.08)'  },
  delete:   { Icon: Trash2,   color: '#666',            bg: 'rgba(255,255,255,0.04)' },
  launch:   { Icon: Rocket,   color: '#60a5fa',         bg: 'rgba(96,165,250,0.08)'  },
  snapshot: { Icon: Camera,   color: '#a78bfa',         bg: 'rgba(167,139,250,0.08)' },
}

const FILTERS = ['ALL', 'START', 'STOP', 'LAUNCH', 'SNAPSHOT']

function groupByDate(entries) {
  const groups = {}
  for (const e of entries) {
    const d = new Date(e.timestamp).toLocaleDateString('en', { month: 'short', day: 'numeric' })
    if (!groups[d]) groups[d] = []
    groups[d].push(e)
  }
  return groups
}

export default function ActivityFeed() {
  const [filter, setFilter] = useState('ALL')
  const { data, isLoading } = useActivity(100)
  const all = data?.activity ?? []
  const filtered = filter === 'ALL' ? all : all.filter(e => e.action?.toUpperCase() === filter)
  const grouped = groupByDate(filtered.slice(0, 24))

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <Activity size={14} style={{ color: 'var(--text-muted)' }} />
        <p className="section-title">Recent Activity</p>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 5, marginBottom: 14, flexWrap: 'wrap' }}>
        {FILTERS.map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`filter-pill${filter === f ? ' active' : ''}`}
            style={{ fontSize: 10.5, padding: '4px 9px' }}
          >{f}</button>
        ))}
      </div>

      {/* Feed */}
      <div style={{ flex: 1, overflowY: 'auto', marginRight: -4, paddingRight: 4 }}>
        {isLoading && <p className="mono" style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Loading…</p>}
        {!isLoading && filtered.length === 0 && (
          <p className="mono" style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>No activity yet</p>
        )}
        {Object.entries(grouped).map(([date, entries]) => (
          <div key={date} style={{ marginBottom: 12 }}>
            <p className="section-label" style={{ marginBottom: 7 }}>{date}</p>
            {entries.map((e, i) => {
              const meta = ACTION_META[e.action] ?? { Icon: Activity, color: 'var(--text-secondary)', bg: 'rgba(255,255,255,0.04)' }
              const time = new Date(e.timestamp).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })
              return (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 9,
                  padding: '7px 0', borderBottom: '1px solid var(--border)',
                }}>
                  <div style={{
                    width: 27, height: 27, borderRadius: 7, flexShrink: 0,
                    background: meta.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: meta.color,
                  }}>
                    <meta.Icon size={11} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p className="mono" style={{ fontSize: 12, fontWeight: 600, lineHeight: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {e.vm_name}
                    </p>
                    <p style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 3, lineHeight: 1, textTransform: 'capitalize' }}>
                      {e.action}
                    </p>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flexShrink: 0 }}>
                    <span className="mono" style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1 }}>{time}</span>
                    <span style={{ fontSize: 9.5, fontWeight: 700, lineHeight: 1, color: e.status === 'success' ? 'var(--running)' : 'var(--stopped)' }}>
                      {e.status}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
