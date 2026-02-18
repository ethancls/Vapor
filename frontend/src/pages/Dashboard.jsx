import { useState } from 'react'
import { useInstances } from '../hooks/useInstances'
import OverviewCard from '../components/OverviewCard'
import InstanceCard from '../components/InstanceCard'
import ResourceChart from '../components/ResourceChart'
import ActivityFeed from '../components/ActivityFeed'
import SearchBar from '../components/SearchBar'
import { RefreshCw, Plus, ChevronLeft, ChevronRight } from 'lucide-react'

const DIST_COLORS = ['#b5f23d', '#60a5fa', '#f472b6', '#fb923c', '#a78bfa']
const PER_PAGE = 3

export default function Dashboard({ onNewInstance }) {
  const { instances, isLoading, refetch } = useInstances()
  const [page, setPage] = useState(0)

  const totalPages = Math.ceil(instances.length / PER_PAGE)
  const visible = instances.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE)
  const canPrev = page > 0
  const canNext = page < totalPages - 1

  const running = instances.filter(i => i.state === 'Running')
  const totalRam = running.reduce((s, i) => s + (i.memory?.total ?? 0), 0)

  return (
    <div className="page">
      {/* ── Header — title left, all controls right on one line ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28, gap: 12 }}>
        <div style={{ flexShrink: 0 }}>
          <h1 className="page-title">Dashboard</h1>
          <p className="mono" style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 6 }}>
            {new Date().toLocaleString('en', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        {/* Controls — single row, no wrap */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
          <SearchBar />
          <button className="btn-ghost" onClick={() => refetch()} style={{ whiteSpace: 'nowrap' }}>
            <RefreshCw size={13} /> Refresh
          </button>
          <button className="btn-accent" onClick={onNewInstance} style={{ whiteSpace: 'nowrap' }}>
            <Plus size={13} /> New Instance
          </button>
        </div>
      </div>

      {/* ── Top row: Overview + Instances ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(260px, 300px) 1fr',
        gap: 18, marginBottom: 18, alignItems: 'start',
      }}>
        <OverviewCard onNewInstance={onNewInstance} />

        <div style={{ minWidth: 0 }}>
          {/* Section header with carousel nav */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <p className="section-title">My Instances</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {instances.length > PER_PAGE && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <button
                    onClick={() => setPage(p => p - 1)}
                    disabled={!canPrev}
                    style={{
                      width: 28, height: 28, borderRadius: 8,
                      background: 'var(--card-2)', border: '1px solid var(--border)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: canPrev ? 'pointer' : 'default',
                      color: canPrev ? 'var(--text-primary)' : 'var(--text-muted)',
                      opacity: canPrev ? 1 : 0.4,
                      transition: 'border-color 0.13s, background 0.13s',
                    }}
                    onMouseEnter={e => { if (canPrev) { e.currentTarget.style.borderColor='var(--border-hover)'; e.currentTarget.style.background='var(--card-3)' }}}
                    onMouseLeave={e => { e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.background='var(--card-2)' }}
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 32, textAlign: 'center' }}>
                    {page + 1} / {totalPages}
                  </span>
                  <button
                    onClick={() => setPage(p => p + 1)}
                    disabled={!canNext}
                    style={{
                      width: 28, height: 28, borderRadius: 8,
                      background: 'var(--card-2)', border: '1px solid var(--border)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: canNext ? 'pointer' : 'default',
                      color: canNext ? 'var(--text-primary)' : 'var(--text-muted)',
                      opacity: canNext ? 1 : 0.4,
                      transition: 'border-color 0.13s, background 0.13s',
                    }}
                    onMouseEnter={e => { if (canNext) { e.currentTarget.style.borderColor='var(--border-hover)'; e.currentTarget.style.background='var(--card-3)' }}}
                    onMouseLeave={e => { e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.background='var(--card-2)' }}
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              )}
              <a href="/instances" style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 700, cursor: 'pointer' }}>
                See all
              </a>
            </div>
          </div>

          {/* Cards */}
          {isLoading ? (
            <p className="mono" style={{ fontSize: 12, color: 'var(--text-muted)', padding: '20px 0' }}>Loading…</p>
          ) : instances.length === 0 ? (
            <div style={{
              padding: '32px 24px', textAlign: 'center',
              background: 'var(--card-1)', borderRadius: 'var(--r-card)',
              border: '1px dashed rgba(255,255,255,0.08)',
            }}>
              <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 14 }}>No instances yet</p>
              <button className="btn-accent" onClick={onNewInstance}>
                <Plus size={13} /> Launch first VM
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 13 }}>
              {visible.map(inst => <InstanceCard key={inst.name} instance={inst} />)}
            </div>
          )}

          {/* RAM distribution bar */}
          {running.length > 0 && totalRam > 0 && (
            <div style={{ marginTop: 18 }}>
              <p className="section-label" style={{ marginBottom: 9 }}>RAM distribution — running</p>
              <div style={{ height: 6, borderRadius: 4, overflow: 'hidden', background: 'var(--card-2)', display: 'flex' }}>
                {running.map((inst, i) => (
                  <div key={inst.name}
                    style={{ width: `${((inst.memory?.total ?? 0) / totalRam) * 100}%`, background: DIST_COLORS[i % DIST_COLORS.length], transition: 'width 0.4s' }}
                    title={`${inst.name}: ${((inst.memory?.total ?? 0) / (1024**3)).toFixed(1)}G`}
                  />
                ))}
              </div>
              <div style={{ display: 'flex', gap: 14, marginTop: 8, flexWrap: 'wrap' }}>
                {running.map((inst, i) => (
                  <div key={inst.name} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 3, background: DIST_COLORS[i % DIST_COLORS.length], flexShrink: 0 }} />
                    <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>{inst.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom row: Chart + Activity ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr minmax(280px, 340px)', gap: 18, alignItems: 'start' }}>
        <ResourceChart instances={instances} />
        <ActivityFeed />
      </div>
    </div>
  )
}
