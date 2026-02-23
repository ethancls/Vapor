import { lazy, Suspense } from 'react'
import { useInstances } from '../hooks/useInstances'
import OverviewCard from '../components/OverviewCard'
import InstanceCard from '../components/InstanceCard'
import ActivityFeed from '../components/ActivityFeed'
import SearchBar from '../components/SearchBar'
import { Plus } from 'lucide-react'

const ResourceChart  = lazy(() => import('../components/ResourceChart'))
const CostEstimator  = lazy(() => import('../components/CostEstimator'))

const DIST_COLORS = ['#b5f23d', '#60a5fa', '#f472b6', '#fb923c', '#a78bfa', '#67e8f9', '#f87171', '#34d399']

function SkeletonCard() {
  return (
    <div style={{
      background: 'var(--card-1)', border: '1px solid var(--border)',
      borderRadius: 'var(--r-card)', padding: 20,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <div className="skeleton" style={{ width: 90, height: 14 }} />
        <div className="skeleton" style={{ width: 54, height: 20, borderRadius: 100 }} />
      </div>
      <div className="skeleton" style={{ width: '60%', height: 11, marginBottom: 8 }} />
      <div className="skeleton" style={{ width: '40%', height: 11, marginBottom: 18 }} />
      <div style={{ display: 'flex', gap: 8 }}>
        <div className="skeleton" style={{ flex: 1, height: 30, borderRadius: 8 }} />
        <div className="skeleton" style={{ width: 32, height: 30, borderRadius: 8 }} />
      </div>
    </div>
  )
}

export default function Dashboard({ onNewInstance }) {
  const { instances, isLoading } = useInstances()

  const running = instances.filter(i => i.state === 'Running')
  const totalRam = running.reduce((s, i) => s + (i.memory?.total ?? 0), 0)

  return (
    <div className="page">
      {/* ── Header ── */}
      <div className="dashboard-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flexShrink: 0 }}>
          <h1 className="page-title">Dashboard</h1>
        </div>
        <div className="dashboard-header-actions" style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0, flexWrap: 'wrap' }}>
          <SearchBar />
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
          {/* Header: title + See all on left, nav buttons on right */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <p className="section-title">My Instances</p>
            <a href="/instances" style={{
              fontSize: 12.5, color: 'var(--accent)', fontWeight: 700,
              transition: 'opacity 0.15s',
            }}
              onMouseEnter={e => { e.currentTarget.style.opacity = '0.7' }}
              onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
            >
              See all ({instances.length})
            </a>
          </div>

          {isLoading ? (
            <div className="dashboard-instances-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(260px, 100%), 1fr))', gap: 13 }}>
              {['s0','s1','s2'].map(k => <SkeletonCard key={k} />)}
            </div>
          ) : instances.length === 0 ? (
            <div style={{ padding: '32px 24px', textAlign: 'center', background: 'var(--card-1)', borderRadius: 'var(--r-card)', border: '1px dashed rgba(255,255,255,0.08)' }}>
              <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 14 }}>No instances yet</p>
              <button className="btn-accent" onClick={onNewInstance}><Plus size={13} /> Launch first VM</button>
            </div>
          ) : (
            <>
              <div className="dashboard-instances-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(260px, 100%), 1fr))', gap: 13 }}>
                {instances.slice(0, 3).map(inst => (
                  <InstanceCard key={inst.name} instance={inst} />
                ))}
              </div>
            </>
          )}

          {running.length > 0 && totalRam > 0 && (
            <div style={{ marginTop: 18 }}>
              <p className="section-label" style={{ marginBottom: 9, color: 'var(--text-secondary)' }}>RAM distribution — running</p>
              <div style={{ height: 6, borderRadius: 4, overflow: 'hidden', background: 'var(--card-2)', display: 'flex' }}>
                {running.map((inst, i) => (
                  <div key={inst.name}
                    style={{ width: `${((inst.memory?.total ?? 0) / totalRam) * 100}%`, background: DIST_COLORS[i % DIST_COLORS.length], transition: 'width 0.4s' }}
                    title={`${inst.name}: ${((inst.memory?.total ?? 0) / (1024**3)).toFixed(1)}G`}
                  />
                ))}
              </div>
              <div style={{ display: 'flex', gap: 18, marginTop: 10, flexWrap: 'wrap' }}>
                {running.map((inst, i) => (
                  <div key={inst.name} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 3, background: DIST_COLORS[i % DIST_COLORS.length], flexShrink: 0 }} />
                    <span className="mono" style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>{inst.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom: Chart then Activity ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <Suspense fallback={null}>
          <ResourceChart instances={instances} />
        </Suspense>
        <Suspense fallback={null}>
          <CostEstimator instances={instances} />
        </Suspense>
        <ActivityFeed />
      </div>
    </div>
  )
}
