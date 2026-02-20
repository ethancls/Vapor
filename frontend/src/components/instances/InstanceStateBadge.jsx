export default function InstanceStateBadge({ state }) {
  const cls = state === 'Running' ? 'badge-running' : state === 'Stopped' ? 'badge-stopped' : 'badge-suspended'
  const dot = state === 'Running' ? 'var(--running)' : state === 'Stopped' ? 'var(--stopped)' : 'var(--suspended)'
  return (
    <span className={`badge ${cls}`}>
      <span className="badge-dot" style={{ background: dot }} />
      {state}
    </span>
  )
}
