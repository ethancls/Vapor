import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

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

export default function CostEstimator({ instances }) {
  const running = instances.filter(i => i.state === 'Running')
  if (running.length === 0) return null

  const totalCpus   = running.reduce((s, i) => s + (i.cpus ?? 0), 0)
  const totalRamGb  = running.reduce((s, i) => s + ((i.memory?.total ?? 0) / (1024 ** 3)), 0)
  const totalDiskGb = running.reduce((s, i) => s + ((i.disk?.total ?? 0) / (1024 ** 3)), 0)

  const hourly = totalCpus * PRICE_VCPU_HR + totalRamGb * PRICE_GBRAM_HR + totalDiskGb * PRICE_GBDISK_HR

  const cpuCostHr  = totalCpus   * PRICE_VCPU_HR
  const ramCostHr  = totalRamGb  * PRICE_GBRAM_HR
  const diskCostHr = totalDiskGb * PRICE_GBDISK_HR

  const chartData = CHART_PTS.map(p => ({ t: p.t, cost: +(hourly * p.h).toFixed(4) }))

  const fmtY = v => v >= 1000 ? `$${(v/1000).toFixed(1)}k` : v >= 1 ? `$${v.toFixed(0)}` : `$${v.toFixed(2)}`

  return (
    <div className="card dashboard-cost-card">
      {/* Header */}
      <div className="dashboard-cost-header">
        <div className="dashboard-cost-header-main">
          <p className="section-title">Cost Estimator</p>
          <a
            href="https://aws.amazon.com/ec2/pricing/on-demand/"
            target="_blank" rel="noreferrer"
            className="dashboard-cost-link"
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)' }}
          >
            EC2 prices ↗
          </a>
        </div>
        <div className="dashboard-cost-summary">
          <p className="mono dashboard-cost-monthly">
            ${(hourly * 730).toFixed(4)}
          </p>
          <p className="dashboard-cost-monthly-meta">/month est.</p>
        </div>
      </div>

      {/* Breakdown legend */}
      <div className="dashboard-cost-breakdown">
        {[
          { label: `${totalCpus} vCPU`,                cost: cpuCostHr,  color: '#b5f23d' },
          { label: `${totalRamGb.toFixed(1)} GB RAM`,  cost: ramCostHr,  color: '#60a5fa' },
          { label: `${totalDiskGb.toFixed(0)} GB Disk`,cost: diskCostHr, color: '#a78bfa' },
        ].map(({ label, cost, color }) => (
          <div key={label} className="dashboard-cost-breakdown-item">
            <div className="dashboard-cost-breakdown-dot" style={{ background: color }} />
            <span className="mono dashboard-cost-breakdown-label">{label}</span>
            <span className="mono dashboard-cost-breakdown-price">${cost.toFixed(4)}/hr</span>
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
