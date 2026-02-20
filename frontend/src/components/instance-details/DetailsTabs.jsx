export default function DetailsTabs({ tabs = [], value, onChange }) {
  return (
    <div style={{
      display: 'flex',
      gap: 6,
      flexWrap: 'wrap',
      padding: 6,
      border: '1px solid var(--border)',
      borderRadius: 12,
      background: 'var(--card-1)',
      marginBottom: 14,
    }}>
      {tabs.map((tab) => (
        <button
          key={tab.value}
          onClick={() => onChange(tab.value)}
          className="btn-ghost"
          style={{
            height: 32,
            padding: '0 12px',
            borderColor: value === tab.value ? 'var(--accent-border)' : 'var(--border)',
            background: value === tab.value ? 'var(--accent-dim)' : 'transparent',
            color: value === tab.value ? 'var(--accent)' : 'var(--text-secondary)',
          }}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
