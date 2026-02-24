import { lazy, Suspense } from 'react'
import { Link } from 'react-router-dom'
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
    <div className="dashboard-skeleton-card">
      <div className="dashboard-skeleton-card-top">
        <div className="skeleton" style={{ width: 90, height: 14 }} />
        <div className="skeleton" style={{ width: 54, height: 20, borderRadius: 100 }} />
      </div>
      <div className="skeleton" style={{ width: '60%', height: 11, marginBottom: 8 }} />
      <div className="skeleton" style={{ width: '40%', height: 11, marginBottom: 18 }} />
      <div className="dashboard-skeleton-card-actions">
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
    <div className="page dashboard-page">
      {/* ── Header ── */}
      <div className="dashboard-header">
        <div className="dashboard-header-title">
          <h1 className="page-title">Dashboard</h1>
        </div>
        <div className="dashboard-header-actions">
          <SearchBar fluid triggerLabel="Search" controlHeight={40} tourId="dashboard-search" />
          <button className="btn-accent dashboard-new-btn" data-tour="new-instance-primary" onClick={onNewInstance}>
            <Plus size={13} /> New Instance
          </button>
        </div>
      </div>

      {/* ── Top row: Overview + Instances ── */}
      <div className="dashboard-main-grid">
        <div className="dashboard-main-overview">
        <OverviewCard />
        </div>

        <div className="dashboard-main-instances">
          {/* Header: title + See all on left, nav buttons on right */}
          <div className="dashboard-instances-head">
            <p className="section-title">My Instances</p>
            <Link className="dashboard-see-all" to="/instances">
              See all ({instances.length})
            </Link>
          </div>

          {isLoading ? (
            <div className="dashboard-instances-grid">
              {['s0','s1','s2'].map(k => <SkeletonCard key={k} />)}
            </div>
          ) : instances.length === 0 ? (
            <div className="dashboard-empty-state">
              <p className="dashboard-empty-state-text">No instances yet</p>
              <button className="btn-accent" onClick={onNewInstance}><Plus size={13} /> Launch first VM</button>
            </div>
          ) : (
            <div className="dashboard-instances-grid">
              {instances.slice(0, 3).map(inst => (
                <InstanceCard key={inst.name} instance={inst} />
              ))}
            </div>
          )}

          {running.length > 0 && totalRam > 0 && (
            <div className="dashboard-ram-section">
              <p className="section-label dashboard-ram-title">RAM distribution — running</p>
              <div className="dashboard-ram-bar">
                {running.map((inst, i) => (
                  <div key={inst.name}
                    style={{ width: `${((inst.memory?.total ?? 0) / totalRam) * 100}%`, background: DIST_COLORS[i % DIST_COLORS.length], transition: 'width 0.4s' }}
                    title={`${inst.name}: ${((inst.memory?.total ?? 0) / (1024**3)).toFixed(1)}G`}
                  />
                ))}
              </div>
              <div className="dashboard-ram-legend">
                {running.map((inst, i) => (
                  <div key={inst.name} className="dashboard-ram-legend-item">
                    <div className="dashboard-ram-legend-dot" style={{ background: DIST_COLORS[i % DIST_COLORS.length] }} />
                    <span className="mono dashboard-ram-legend-name">{inst.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom: Chart then Activity ── */}
      <div className="dashboard-bottom-stack">
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
