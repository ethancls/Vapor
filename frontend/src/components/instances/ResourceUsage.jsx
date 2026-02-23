import Tooltip from '../Tooltip'

function clampPct(used, total) {
  if (!total) return null
  const pct = (used / total) * 100
  return Math.max(0, Math.min(100, pct))
}

function fmtPct(pct) {
  if (pct == null) return '—'
  const clamped = Math.max(0, Math.min(100, pct))
  return `${clamped.toFixed(1)}%`
}

function usageColor(pct) {
  if (pct == null) return 'var(--text-secondary)'
  if (pct >= 90) return 'var(--stopped)'
  if (pct >= 75) return 'var(--suspended)'
  return 'var(--accent)'
}

function formatBytes(bytes, { compact = false, zeroAsDash = false } = {}) {
  if (bytes == null || Number.isNaN(Number(bytes))) return '—'
  const n = Number(bytes)
  if (n <= 0) return zeroAsDash ? '—' : (compact ? '0M' : '0 MB')
  const gb = n / (1024 ** 3)
  if (gb >= 1) return compact ? `${gb.toFixed(1)}G` : `${gb.toFixed(1)} GB`
  const mb = n / (1024 ** 2)
  return compact ? `${mb.toFixed(0)}M` : `${mb.toFixed(0)} MB`
}

function UsageDonut({ pct, color, compact, sizeOverride = null, strokeOverride = null }) {
  const size = sizeOverride ?? (compact ? 18 : 20)
  const stroke = strokeOverride ?? (compact ? 2.6 : 2.8)
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const progress = ((pct ?? 0) / 100) * circumference

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ flexShrink: 0, transform: 'rotate(-90deg)' }}
      aria-hidden="true"
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--card-3)"
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${progress} ${circumference - progress}`}
      />
    </svg>
  )
}

export default function ResourceUsage({
  used = 0,
  total = 0,
  compact = false,
  mode = 'detail',
  label = '',
  showTooltip = false,
  showPercent = false,
  donutSize = null,
  donutStroke = null,
}) {
  const safeUsed = Number(used) || 0
  const safeTotal = Number(total) || 0
  const pct = clampPct(safeUsed, safeTotal)
  const pctLabel = fmtPct(pct)
  const isZeroUsage = safeUsed <= 0
  const color = isZeroUsage ? 'var(--text-muted)' : usageColor(pct)
  const usedLabel = formatBytes(safeUsed, { compact })
  const totalLabel = formatBytes(safeTotal, { compact, zeroAsDash: true })
  const hasData = safeUsed > 0 || safeTotal > 0
  const segmentWidth = compact ? '6ch' : '9.5ch'
  const tooltipLabel = `${label ? `${label}: ` : ''}${formatBytes(safeUsed, { compact: true })} / ${formatBytes(safeTotal, { compact: true, zeroAsDash: true })}${pct != null ? ` (${pctLabel})` : ''}`

  if (!hasData) {
    return <span className="mono" style={{ fontSize: compact ? 11.5 : 12, color: 'var(--text-muted)', lineHeight: 1 }}>—</span>
  }

  if (mode === 'percent') {
    const pctWidth = compact ? '6ch' : '7ch'
    const labelWidth = compact ? '3.2ch' : '4ch'
    const labelColor = 'var(--text-secondary)'
    const content = (
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: compact ? 7 : 8,
          minWidth: 0,
          fontVariantNumeric: 'tabular-nums',
          fontFeatureSettings: '"tnum" 1',
        }}
      >
        {label && (
          <span
            className="mono"
            style={{
              width: labelWidth,
              textAlign: 'right',
              fontSize: compact ? 10.2 : 10.7,
              fontWeight: 600,
              color: labelColor,
              letterSpacing: '0.03em',
            }}
          >
            {label}
          </span>
        )}
        <UsageDonut
          pct={pct}
          color={color}
          compact={compact}
          sizeOverride={donutSize}
          strokeOverride={donutStroke}
        />
        <span
          className="mono"
          style={{
            width: pctWidth,
            textAlign: 'left',
            color,
            fontWeight: 700,
            fontSize: compact ? 10.8 : 11.8,
            lineHeight: 1,
          }}
        >
          {pctLabel}
        </span>
      </div>
    )
    return showTooltip ? <Tooltip label={tooltipLabel}>{content}</Tooltip> : content
  }

  return (
    <div style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: compact ? 6 : 7 }}>
      <UsageDonut
        pct={pct}
        color={color}
        compact={compact}
        sizeOverride={donutSize}
        strokeOverride={donutStroke}
      />

      <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: showPercent ? 3 : 0 }}>
        <div
          className="mono"
          style={{
            minWidth: 0,
            display: 'grid',
            gridTemplateColumns: `${segmentWidth} 1ch ${segmentWidth}`,
            alignItems: 'center',
            lineHeight: 1,
            whiteSpace: 'nowrap',
            fontVariantNumeric: 'tabular-nums',
            fontFeatureSettings: '"tnum" 1',
          }}
        >
          <span style={{ color: 'var(--accent)', fontWeight: 700, fontSize: compact ? 10.8 : 11.8, textAlign: 'right' }}>
            {usedLabel}
          </span>
          <span style={{ color: 'var(--text-secondary)', fontSize: compact ? 10.5 : 11.2, textAlign: 'center' }}>
            /
          </span>
          <span style={{ color: 'var(--text-primary)', fontSize: compact ? 10.8 : 11.8, textAlign: 'left' }}>
            {totalLabel}
          </span>
        </div>
        {showPercent && (
          <span className="mono" style={{ color, fontWeight: 700, fontSize: compact ? 10.2 : 10.8, lineHeight: 1 }}>
            {pctLabel}
          </span>
        )}
      </div>
    </div>
  )
}
