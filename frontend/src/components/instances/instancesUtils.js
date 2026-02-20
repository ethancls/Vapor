export const STATE_FILTERS = ['All', 'Running', 'Stopped', 'Suspended']

export function fmtResource(bytes) {
  if (!bytes) return '—'
  const gb = bytes / (1024 ** 3)
  if (gb >= 1) return `${gb.toFixed(1)} GB`
  return `${(bytes / (1024 ** 2)).toFixed(0)} MB`
}

export function sortValue(inst, key) {
  if (key === 'name') return inst.name ?? ''
  if (key === 'state') return inst.state ?? ''
  if (key === 'ipv4') return inst.ipv4?.[0] ?? ''
  if (key === 'image') return inst.image ?? ''
  if (key === 'cpus') return inst.cpus ?? 0
  if (key === 'memory') return inst.memory?.total ?? 0
  if (key === 'disk') return inst.disk?.total ?? 0
  return ''
}

export function matchInstance(inst, query) {
  if (!query.trim()) return true
  const low = query.toLowerCase()
  return (
    inst.name?.toLowerCase().includes(low) ||
    inst.state?.toLowerCase().includes(low) ||
    (inst.ipv4 || []).some(ip => ip.toLowerCase().includes(low)) ||
    (inst.image || '').toLowerCase().includes(low) ||
    String(inst.cpus ?? '').includes(low)
  )
}

export function filterInstances(instances, { stateFilter = 'All', imageFilter = 'All', query = '' }) {
  return instances
    .filter((item) => stateFilter === 'All' || item.state === stateFilter)
    .filter((item) => imageFilter === 'All' || (item.image || '—') === imageFilter)
    .filter((item) => matchInstance(item, query))
}
