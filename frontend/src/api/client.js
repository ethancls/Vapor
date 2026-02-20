const BASE = '/api'

async function request(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } }
  if (body !== undefined) opts.body = JSON.stringify(body)
  const res = await fetch(`${BASE}${path}`, opts)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const detail = data?.detail || data?.error || `${method} ${path} → ${res.status}`
    throw new Error(detail)
  }
  return data
}

function instanceAction(name, action, payload = {}) {
  return request('POST', `/instances/${name}/actions/${action}`, payload)
}

export const api = {
  getInstances: () => request('GET', '/instances'),
  getInstance: (name) => request('GET', `/instances/${name}`),
  generateSshPassword: (name, body = {}) => request('POST', `/instances/${name}/ssh-password`, body),
  getSshPasswordStatus: (name, username = 'ubuntu') => request('GET', `/instances/${name}/ssh-password/status?username=${encodeURIComponent(username)}`),
  disableSshPassword: (name, body = {}) => request('POST', `/instances/${name}/ssh-password/disable`, body),
  getInstanceUpdates: (name) => request('GET', `/instances/${name}/updates`),
  runInstanceUpdates: (name, body = {}) => request('POST', `/instances/${name}/updates/run`, body),
  getUpdates: () => request('GET', '/updates'),
  startInstance: (name) => instanceAction(name, 'start'),
  stopInstance: (name) => instanceAction(name, 'stop'),
  suspendInstance: (name) => instanceAction(name, 'suspend'),
  restartInstance: (name) => instanceAction(name, 'restart'),
  recoverInstance: (name) => instanceAction(name, 'recover'),
  deleteInstance: (name, purge = true) => instanceAction(name, 'delete', { purge }),
  cloneInstance: (name, newName) => request('POST', `/instances/${name}/clone`, newName ? { name: newName } : {}),
  launchInstance: (body) => request('POST', '/instances', body),
  getSnapshots: (name) => request('GET', `/instances/${name}/snapshots`),
  createSnapshot: (name, snapName, comment) => request('POST', `/instances/${name}/snapshots`, { name: snapName, comment }),
  getAllSnapshots: () => request('GET', '/snapshots'),
  restoreSnapshot: (instance, snapshot, destructive = false) => request('POST', `/snapshots/${instance}/${snapshot}/restore`, { destructive }),
  deleteSnapshot: (instance, snapshot) => request('DELETE', `/snapshots/${instance}/${snapshot}`),
  getHistory: (name) => request('GET', `/instances/${name}/history`),
  getActivity: (limit = 100) => request('GET', `/activity?limit=${limit}`),
  getStats: () => request('GET', '/stats'),
  getNetworks: () => request('GET', '/networks'),
  getImages: (q = '') => request('GET', `/images${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  getSettings: () => request('GET', '/settings'),
  setSetting: (key, value) => request('PUT', `/settings/${encodeURIComponent(key)}`, { value }),
  getAliases: () => request('GET', '/aliases'),
  createAlias: (definition, name = '', noMapWorkingDirectory = false) => request('POST', '/aliases', {
    definition,
    name: name || null,
    no_map_working_directory: Boolean(noMapWorkingDirectory),
  }),
  deleteAlias: (name) => request('DELETE', `/aliases/${encodeURIComponent(name)}`),
  preferAlias: (name) => request('POST', '/aliases/prefer', { name }),
  execInstance: (name, command, opts = {}) => request('POST', `/instances/${name}/exec`, { command, ...opts }),
  getVersion: () => request('GET', '/system/version'),
  getHostInfo: () => request('GET', '/system/host'),
  getTemplates: () => request('GET', '/templates'),
  createTemplate: (body) => request('POST', '/templates', body),
  deleteTemplate: (id) => request('DELETE', `/templates/${encodeURIComponent(id)}`),
}
