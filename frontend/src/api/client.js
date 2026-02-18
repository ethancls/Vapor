const BASE = '/api'

async function request(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } }
  if (body !== undefined) opts.body = JSON.stringify(body)
  const res = await fetch(`${BASE}${path}`, opts)
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}`)
  return res.json()
}

export const api = {
  getInstances: () => request('GET', '/instances'),
  getInstance: (name) => request('GET', `/instances/${name}`),
  startInstance: (name) => request('POST', `/instances/${name}/start`),
  stopInstance: (name) => request('POST', `/instances/${name}/stop`),
  suspendInstance: (name) => request('POST', `/instances/${name}/suspend`),
  deleteInstance: (name) => request('DELETE', `/instances/${name}`),
  launchInstance: (body) => request('POST', '/instances/launch', body),
  getSnapshots: (name) => request('GET', `/instances/${name}/snapshots`),
  createSnapshot: (name, snapName) => request('POST', `/instances/${name}/snapshot`, { name: snapName }),
  getHistory: (name) => request('GET', `/instances/${name}/history`),
  getActivity: (limit = 100) => request('GET', `/activity?limit=${limit}`),
  getStats: () => request('GET', '/stats'),
}
