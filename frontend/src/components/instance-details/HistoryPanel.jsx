import { useMemo, useState } from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import CustomSelect from '../CustomSelect'

const METRICS = [
  { key: 'ram_used', label: 'RAM Used', unit: 'MB', transform: (v) => v ? Number((v / (1024 ** 2)).toFixed(1)) : 0 },
  { key: 'disk_used', label: 'Disk Used', unit: 'GB', transform: (v) => v ? Number((v / (1024 ** 3)).toFixed(2)) : 0 },
  { key: 'cpu', label: 'vCPUs', unit: 'vCPU', transform: (v) => Number(v || 0) },
]

function ChartTooltip({ active, payload, label, unit }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'var(--card-3)',
      border: '1px solid var(--border)',
      borderRadius: 10,
      padding: '10px 14px',
      fontSize: 12,
      fontFamily: 'IBM Plex Mono',
    }}>
      <p style={{ margin: 0, color: 'var(--text-secondary)', marginBottom: 4 }}>{label}</p>
      <p style={{ margin: 0, color: 'var(--accent)', fontWeight: 700 }}>
        {unit === 'vCPU' ? Number(payload[0].value).toFixed(0) : Number(payload[0].value).toFixed(unit === 'MB' ? 1 : 2)} {unit}
      </p>
    </div>
  )
}

export default function HistoryPanel({ history = [] }) {
  const [metricKey, setMetricKey] = useState(METRICS[0].key)
  const metric = METRICS.find((item) => item.key === metricKey) || METRICS[0]
  const metricOptions = METRICS.map((item) => ({ value: item.key, label: item.label }))

  const chartData = useMemo(() => history.map((point) => ({
    ts: new Date(point.ts).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    value: metric.transform(point[metric.key]),
  })), [history, metric])

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 10, flexWrap: 'wrap' }}>
        <p className="section-title">History</p>
        <CustomSelect
          value={metricKey}
          onChange={setMetricKey}
          options={metricOptions}
          style={{ minWidth: 150 }}
        />
      </div>
      {chartData.length === 0 ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 220, color: 'var(--text-secondary)', fontSize: 12 }}>
          No data yet — waiting for first poll
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={chartData} margin={{ top: 5, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="inst-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#b5f23d" stopOpacity={0.24} />
                <stop offset="95%" stopColor="#b5f23d" stopOpacity={0.01} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
            <XAxis dataKey="ts" tick={{ fill: '#444', fontSize: 10, fontFamily: 'IBM Plex Mono' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
            <YAxis tick={{ fill: '#444', fontSize: 10, fontFamily: 'IBM Plex Mono' }} tickLine={false} axisLine={false} />
            <Tooltip content={<ChartTooltip unit={metric.unit} />} />
            <Area type="monotone" dataKey="value" stroke="#b5f23d" strokeWidth={2} fill="url(#inst-grad)" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
