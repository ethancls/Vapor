export default function InstancesCheckbox({ checked, onChange }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onChange() }}
      style={{
        width: 18,
        height: 18,
        borderRadius: 5,
        border: `1px solid ${checked ? 'var(--accent)' : 'var(--border-hover)'}`,
        background: checked ? 'var(--accent-dim)' : 'var(--card-2)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 0,
      }}
      aria-pressed={checked}
      aria-label={checked ? 'Unselect instance' : 'Select instance'}
    >
      <span style={{
        width: 8,
        height: 8,
        borderRadius: 2,
        background: checked ? 'var(--accent)' : 'transparent',
      }} />
    </button>
  )
}
