import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { api } from '../api/client'

function fmt(bytes) {
  if (!bytes) return '0'
  return `${(bytes / (1024 ** 2)).toFixed(0)} MB`
}

const METRICS = [
  { key: 'ram_used', label: 'RAM Used', unit: 'MB', transform: v => v ? (v / (1024 ** 2)).toFixed(1) : 0 },
  { key: 'disk_used', label: 'Disk Used', unit: 'GB', transform: v => v ? (v / (1024 ** 3)).toFixed(2) : 0 },
]

function CustomTooltip({ active, payload, label, unit }) {
  if (!active || !payload?.length) return null
  const val = payload[0]?.value
  const prev = payload[0]?.payload?.prev
  const delta = prev != null ? (val - prev).toFixed(2) : null
  return (
    <div style={{
      background: 'var(--card-3)', border: '1px solid var(--border)',
      borderRadius: 10, padding: '10px 14px', fontSize: 12, fontFamily: 'IBM Plex Mono',
    }}>
      <p style={{ margin: 0, color: 'var(--text-secondary)', marginBottom: 4 }}>{label}</p>
      <p style={{ margin: 0, color: 'var(--accent)', fontWeight: 600 }}>{val} {unit}</p>
      {delta != null && (
        <p style={{ margin: 0, color: delta > 0 ? 'var(--stopped)' : 'var(--running)', marginTop: 2 }}>
          {delta > 0 ? '+' : ''}{delta} {unit}
        </p>
      )}
    </div>
  )
}

export default function ResourceChart({ instances = [] }) {
  const [selectedVm, setSelectedVm] = useState(instances[0]?.name ?? '')
  const [metricIdx, setMetricIdx] = useState(0)
  const metric = METRICS[metricIdx]

  const vmName = selectedVm || instances[0]?.name
  const { data } = useQuery({
    queryKey: ['history', vmName],
    queryFn: () => api.getHistory(vmName),
    enabled: !!vmName,
    refetchInterval: 6000,
  })

  const raw = data?.history ?? []
  const chartData = raw.map((p, i) => ({
    ts: new Date(p.ts).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    value: parseFloat(metric.transform(p[metric.key])),
    prev: i > 0 ? parseFloat(metric.transform(raw[i - 1][metric.key])) : null,
  }))

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, gap: 10, flexWrap: 'wrap' }}>
        <p className="section-title">Resource History</p>
        <div style={{ display: 'flex', gap: 8 }}>
          <select
            value={vmName}
            onChange={e => setSelectedVm(e.target.value)}
            style={{
              background: 'var(--card-2)', color: 'var(--text-secondary)',
              border: '1px solid var(--border)', borderRadius: 8,
              padding: '5px 10px', fontSize: 12, fontFamily: 'IBM Plex Mono',
              cursor: 'pointer', outline: 'none',
            }}
          >
            {instances.map(i => <option key={i.name} value={i.name}>{i.name}</option>)}
          </select>
          <select
            value={metricIdx}
            onChange={e => setMetricIdx(Number(e.target.value))}
            style={{
              background: 'var(--card-2)', color: 'var(--text-secondary)',
              border: '1px solid var(--border)', borderRadius: 8,
              padding: '5px 10px', fontSize: 12, fontFamily: 'IBM Plex Mono',
              cursor: 'pointer', outline: 'none',
            }}
          >
            {METRICS.map((m, i) => <option key={m.key} value={i}>{m.label}</option>)}
          </select>
        </div>
      </div>

      {chartData.length === 0 ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: 'var(--text-muted)', fontSize: 12, fontFamily: 'IBM Plex Mono' }}>
          No data yet — waiting for first poll
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#b5f23d" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#b5f23d" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
            <XAxis dataKey="ts" tick={{ fill: '#444', fontSize: 10, fontFamily: 'IBM Plex Mono' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
            <YAxis tick={{ fill: '#444', fontSize: 10, fontFamily: 'IBM Plex Mono' }} tickLine={false} axisLine={false} />
            <Tooltip content={<CustomTooltip unit={metric.unit} />} />
            <Area type="monotone" dataKey="value" stroke="#b5f23d" strokeWidth={2} fill="url(#grad)" dot={false} activeDot={{ r: 4, fill: '#b5f23d' }} />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
