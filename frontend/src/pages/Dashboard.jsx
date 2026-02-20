import { useInstances } from '../hooks/useInstances'
import OverviewCard from '../components/OverviewCard'
import InstanceCard from '../components/InstanceCard'
import ResourceChart from '../components/ResourceChart'
import ActivityFeed from '../components/ActivityFeed'
import SearchBar from '../components/SearchBar'
import { RefreshCcw, Plus } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

const DIST_COLORS = ['#b5f23d', '#60a5fa', '#f472b6', '#fb923c', '#a78bfa', '#67e8f9', '#f87171', '#34d399']

// AWS EC2 on-demand pricing, us-east-1, Linux (t3 family + EBS gp3, ~2025-2026)
const PRICE_VCPU_HR   = 0.0208  // t3 family: ~$0.0208/vCPU-hr
const PRICE_GBRAM_HR  = 0.0052  // t3 family: ~$0.0052/GB-hr
const PRICE_GBDISK_HR = 0.00011 // EBS gp3:   $0.08/GB-month ÷ 730

const CHART_PTS = [
  { t: '1h',  h: 1    },
  { t: '6h',  h: 6    },
  { t: '12h', h: 12   },
  { t: '1d',  h: 24   },
  { t: '3d',  h: 72   },
  { t: '7d',  h: 168  },
  { t: '14d', h: 336  },
  { t: '1mo', h: 730  },
  { t: '3mo', h: 2190 },
  { t: '6mo', h: 4380 },
  { t: '1y',  h: 8760 },
]

function CostEstimator({ instances }) {
  const running = instances.filter(i => i.state === 'Running')
  if (running.length === 0) return null

  const totalCpus   = running.reduce((s, i) => s + (i.cpus ?? 0), 0)
  const totalRamGb  = running.reduce((s, i) => s + ((i.memory?.total ?? 0) / (1024 ** 3)), 0)
  const totalDiskGb = running.reduce((s, i) => s + ((i.disk?.total ?? 0) / (1024 ** 3)), 0)

  const hourly = totalCpus * PRICE_VCPU_HR + totalRamGb * PRICE_GBRAM_HR + totalDiskGb * PRICE_GBDISK_HR

  const cpuCostHr  = totalCpus   * PRICE_VCPU_HR
  const ramCostHr  = totalRamGb  * PRICE_GBRAM_HR
  const diskCostHr = totalDiskGb * PRICE_GBDISK_HR

  const cpuPct  = (cpuCostHr  / hourly) * 100
  const ramPct  = (ramCostHr  / hourly) * 100
  const diskPct = 100 - cpuPct - ramPct

  const chartData = CHART_PTS.map(p => ({ t: p.t, cost: +(hourly * p.h).toFixed(4) }))

  const fmtY = v => v >= 1000 ? `$${(v/1000).toFixed(1)}k` : v >= 1 ? `$${v.toFixed(0)}` : `$${v.toFixed(2)}`

  return (
    <div className="card" style={{ padding: 22 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <p className="section-title">Cost Estimator</p>
          <a
            href="https://aws.amazon.com/ec2/pricing/on-demand/"
            target="_blank" rel="noreferrer"
            style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textDecoration: 'none', transition: 'color 0.15s', lineHeight: 1 }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)' }}
          >
            EC2 prices ↗
          </a>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p className="mono" style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>
            ${(hourly * 730).toFixed(4)}
          </p>
          <p style={{ fontSize: 10.5, color: 'var(--text-secondary)', marginTop: 3 }}>/month est.</p>
        </div>
      </div>

      {/* Breakdown legend */}
      <div style={{ display: 'flex', gap: 18, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { label: `${totalCpus} vCPU`,                cost: cpuCostHr,  color: '#b5f23d' },
          { label: `${totalRamGb.toFixed(1)} GB RAM`,  cost: ramCostHr,  color: '#60a5fa' },
          { label: `${totalDiskGb.toFixed(0)} GB Disk`,cost: diskCostHr, color: '#a78bfa' },
        ].map(({ label, cost, color }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <div style={{ width: 7, height: 7, borderRadius: 2, background: color, flexShrink: 0 }} />
            <span className="mono" style={{ fontSize: 12, color: 'var(--text-primary)' }}>{label}</span>
            <span className="mono" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>${cost.toFixed(4)}/hr</span>
          </div>
        ))}
      </div>

      {/* Cost over time chart */}
      <p className="section-label" style={{ marginBottom: 10 }}>Cumulative cost over time</p>
      <ResponsiveContainer width="100%" height={140}>
        <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="costGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#b5f23d" stopOpacity={0.18} />
              <stop offset="95%" stopColor="#b5f23d" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="t"
            tick={{ fontSize: 10, fill: 'var(--text-muted)', fontFamily: 'IBM Plex Mono' }}
            axisLine={false} tickLine={false}
          />
          <YAxis
            tickFormatter={fmtY}
            tick={{ fontSize: 10, fill: 'var(--text-muted)', fontFamily: 'IBM Plex Mono' }}
            axisLine={false} tickLine={false} width={52}
          />
          <Tooltip
            contentStyle={{ background: 'var(--card-2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11, fontFamily: 'IBM Plex Mono', color: 'var(--text-primary)' }}
            itemStyle={{ color: '#b5f23d' }}
            formatter={v => [`$${Number(v).toFixed(2)}`, 'cumulative']}
            labelStyle={{ color: 'var(--text-secondary)', marginBottom: 2 }}
            cursor={{ stroke: 'var(--border-hover)', strokeWidth: 1 }}
          />
          <Area
            type="monotone" dataKey="cost"
            stroke="#b5f23d" strokeWidth={1.5}
            fill="url(#costGrad)" dot={false} activeDot={{ r: 3, fill: '#b5f23d', strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

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
  const { instances, isLoading, refetch } = useInstances()

  const running = instances.filter(i => i.state === 'Running')
  const totalRam = running.reduce((s, i) => s + (i.memory?.total ?? 0), 0)

  return (
    <div className="page">
      {/* ── Header ── */}
      <div className="dashboard-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28, gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flexShrink: 0 }}>
          <h1 className="page-title">Dashboard</h1>
          <p className="mono" style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 7, letterSpacing: '-0.1px' }}>
            {new Date().toLocaleString('en', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        <div className="dashboard-header-actions" style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0, flexWrap: 'wrap' }}>
          <SearchBar />
          <button className="btn-ghost" onClick={() => refetch()} style={{ whiteSpace: 'nowrap' }}>
            <RefreshCcw size={13} /> Refresh
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
              {[...Array(3)].map((_, i) => <SkeletonCard key={i} />)}
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
        <ResourceChart instances={instances} />
        <CostEstimator instances={instances} />
        <ActivityFeed />
      </div>
    </div>
  )
}
