import { useStats } from '../hooks/useStats'
import { ArrowUpRight } from 'lucide-react'

function fmt(bytes) {
  if (!bytes) return '0'
  const gb = bytes / (1024 ** 3)
  if (gb >= 1) return `${gb.toFixed(1)} GB`
  const mb = bytes / (1024 ** 2)
  if (mb >= 1) return `${mb.toFixed(0)} MB`
  return `${(bytes / 1024).toFixed(0)} KB`
}

export default function OverviewCard({ onNewInstance }) {
  const { data: stats, isLoading } = useStats()

  const items = [
    { label: 'Total VMs',  value: stats?.total       ?? '—' },
    { label: 'Running',    value: stats?.running      ?? '—' },
    { label: 'Stopped',    value: stats?.stopped      ?? '—' },
    { label: 'CPUs alloc', value: stats?.total_cpus   ?? '—' },
    { label: 'RAM used',   value: stats ? fmt(stats.total_ram_used)  : '—' },
    { label: 'Disk used',  value: stats ? fmt(stats.total_disk_used) : '—' },
  ]

  return (
    <div style={{
      background: 'var(--accent)',
      borderRadius: 'var(--r-card)',
      padding: 24,
      position: 'relative',
      overflow: 'hidden',
      minWidth: 0,
    }}>
      {/* Decorative blobs */}
      <div style={{
        position: 'absolute', top: -50, right: -50,
        width: 180, height: 180, borderRadius: '50%',
        background: 'rgba(0,0,0,0.07)', pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: -40, left: -30,
        width: 140, height: 140, borderRadius: '50%',
        background: 'rgba(0,0,0,0.05)', pointerEvents: 'none',
      }} />

      <div style={{ position: 'relative', zIndex: 1 }}>
        <p style={{
          fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
          textTransform: 'uppercase', color: 'rgba(0,0,0,0.45)', marginBottom: 4,
        }}>Overview</p>
        <h2 style={{
          fontFamily: 'Syne', fontWeight: 800, fontSize: 22,
          color: '#0a0a0a', marginBottom: 20, letterSpacing: '-0.3px', lineHeight: 1.1,
        }}>
          Infrastructure
        </h2>

        {/* Inner dark panel */}
        <div style={{
          background: 'rgba(0,0,0,0.82)',
          backdropFilter: 'blur(8px)',
          borderRadius: 13,
          padding: '16px 18px',
          marginBottom: 16,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '14px 20px',
        }}>
          {items.map(({ label, value }) => (
            <div key={label}>
              <p style={{ fontSize: 10.5, color: '#666', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 3 }}>{label}</p>
              <p className="mono" style={{ fontSize: 19, fontWeight: 600, color: 'var(--accent)', lineHeight: 1 }}>
                {isLoading ? '…' : value}
              </p>
            </div>
          ))}
        </div>

        <button onClick={onNewInstance} style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'rgba(0,0,0,0.82)', color: 'var(--accent)',
          border: 'none', borderRadius: 9, padding: '8px 14px',
          fontFamily: 'Syne', fontWeight: 700, fontSize: 12.5,
          cursor: 'pointer', marginLeft: 'auto',
          transition: 'background 0.15s',
        }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.92)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,0,0,0.82)'}
        >
          Launch <ArrowUpRight size={11} />
        </button>
      </div>
    </div>
  )
}
