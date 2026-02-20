import InstanceStateBadge from '../instances/InstanceStateBadge'

function fmt(bytes) {
  if (!bytes) return '—'
  const gb = bytes / (1024 ** 3)
  if (gb >= 1) return `${gb.toFixed(1)} GB`
  return `${(bytes / (1024 ** 2)).toFixed(0)} MB`
}

function Stat({ label, value, accent = false }) {
  return (
    <div style={{
      background: 'var(--card-1)',
      border: '1px solid var(--border)',
      borderRadius: 10,
      padding: '10px 12px',
      minWidth: 150,
      flex: '1 1 150px',
    }}>
      <p className="section-label" style={{ marginBottom: 6 }}>{label}</p>
      <p className="mono" style={{ fontSize: 13, lineHeight: 1, color: accent ? 'var(--accent)' : 'var(--text-primary)', fontWeight: 700 }}>
        {value}
      </p>
    </div>
  )
}

export default function OverviewPanel({ instance }) {
  const ips = instance?.ipv4 || []
  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <div>
          <p className="mono" style={{ fontSize: 17, fontWeight: 700, lineHeight: 1, marginBottom: 7 }}>{instance?.name || '—'}</p>
          <InstanceStateBadge state={instance?.state || 'Unknown'} />
        </div>
        <p className="mono" style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
          {instance?.image || '—'}
        </p>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <Stat label="vCPUs" value={instance?.cpus ?? '—'} />
        <Stat label="RAM Used / Total" value={`${fmt(instance?.memory?.used)} / ${fmt(instance?.memory?.total)}`} accent />
        <Stat label="Disk Used / Total" value={`${fmt(instance?.disk?.used)} / ${fmt(instance?.disk?.total)}`} accent />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <p className="section-label">IP Addresses</p>
        {ips.length ? ips.map((ip) => (
          <p key={ip} className="mono" style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1 }}>
            {ip}
          </p>
        )) : (
          <p className="mono" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>No IPv4 address</p>
        )}
      </div>
    </div>
  )
}
