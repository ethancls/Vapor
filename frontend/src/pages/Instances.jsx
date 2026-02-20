import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { RefreshCw, Plus } from 'lucide-react'
import { sileo } from 'sileo'
import { useInstances } from '../hooks/useInstances'
import { api } from '../api/client'
import InstancesTable from '../components/InstancesTable'
import ConfirmModal from '../components/ConfirmModal'
import InstancesControls from '../components/instances/InstancesControls'
import InstancesBatchActions from '../components/instances/InstancesBatchActions'
import InstancesCardsView from '../components/instances/InstancesCardsView'
import { filterInstances } from '../components/instances/instancesUtils'

const COLS = ['Name', 'State', 'IPv4', 'Image', 'CPUs', 'Memory', 'Disk', 'Actions']

function SkeletonTable() {
  return (
    <div className="instances-table-shell" style={{ background: 'var(--card-1)', borderRadius: 'var(--r-card)', border: '1px solid var(--border)', overflowX: 'auto' }}>
      <table style={{ width: '100%', minWidth: 980, borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            <th style={{ padding: '12px 10px 12px 14px' }}><div className="skeleton" style={{ width: 18, height: 18, borderRadius: 5 }} /></th>
            {COLS.map(h => (
              <th key={h} style={{ padding: '12px 18px', textAlign: 'left' }}>
                <div className="skeleton" style={{ height: 10, width: h === 'Actions' ? 60 : h === 'State' ? 44 : h === 'CPUs' ? 28 : 70, borderRadius: 5 }} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[...Array(5)].map((_, i) => (
            <tr key={i} style={{ borderBottom: i < 4 ? '1px solid var(--border)' : 'none' }}>
              <td style={{ padding: '14px 10px 14px 14px' }}><div className="skeleton" style={{ height: 18, width: 18, borderRadius: 5 }} /></td>
              <td style={{ padding: '14px 18px' }}><div className="skeleton" style={{ height: 13, width: 120, borderRadius: 5 }} /></td>
              <td style={{ padding: '14px 18px' }}><div className="skeleton" style={{ height: 20, width: 68, borderRadius: 100 }} /></td>
              <td style={{ padding: '14px 18px' }}><div className="skeleton" style={{ height: 12, width: 100, borderRadius: 5 }} /></td>
              <td style={{ padding: '14px 18px' }}><div className="skeleton" style={{ height: 12, width: 110, borderRadius: 5 }} /></td>
              <td style={{ padding: '14px 18px' }}><div className="skeleton" style={{ height: 12, width: 24, borderRadius: 5 }} /></td>
              <td style={{ padding: '14px 18px' }}><div className="skeleton" style={{ height: 12, width: 60, borderRadius: 5 }} /></td>
              <td style={{ padding: '14px 18px' }}><div className="skeleton" style={{ height: 12, width: 60, borderRadius: 5 }} /></td>
              <td style={{ padding: '14px 18px' }}><div style={{ display: 'flex', gap: 5 }}>{[...Array(3)].map((_, j) => <div key={j} className="skeleton" style={{ width: 30, height: 30, borderRadius: 8 }} />)}</div></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function Instances({ onNewInstance }) {
  const { instances, isLoading, refetch } = useInstances()
  const qc = useQueryClient()

  const [stateFilter, setStateFilter] = useState('All')
  const [imageFilter, setImageFilter] = useState('All')
  const [query, setQuery] = useState('')
  const [viewMode, setViewMode] = useState(() => (
    typeof window !== 'undefined' && window.innerWidth <= 900 ? 'cards' : 'table'
  ))
  const [selectedNames, setSelectedNames] = useState(new Set())
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false)

  const counts = useMemo(() => ({
    All: instances.length,
    Running: instances.filter((i) => i.state === 'Running').length,
    Stopped: instances.filter((i) => i.state === 'Stopped').length,
    Suspended: instances.filter((i) => i.state === 'Suspended').length,
  }), [instances])

  const imageOptions = useMemo(() => {
    const values = [...new Set(instances.map((i) => i.image || '—'))].sort((a, b) => a.localeCompare(b))
    return [{ value: 'All', label: 'All images' }, ...values.map((v) => ({ value: v, label: v }))]
  }, [instances])

  const filteredInstances = useMemo(
    () => filterInstances(instances, { stateFilter, imageFilter, query }),
    [instances, stateFilter, imageFilter, query],
  )
  const usedCpus = useMemo(
    () => instances.filter((i) => i.state === 'Running').reduce((sum, i) => sum + Number(i.cpus || 0), 0),
    [instances],
  )
  const totalCpus = useMemo(() => instances.reduce((sum, i) => sum + Number(i.cpus || 0), 0), [instances])
  const usedRam = useMemo(() => instances.reduce((sum, i) => sum + Number(i.memory?.used || 0), 0), [instances])
  const totalRam = useMemo(() => instances.reduce((sum, i) => sum + Number(i.memory?.total || 0), 0), [instances])
  const usedDisk = useMemo(() => instances.reduce((sum, i) => sum + Number(i.disk?.used || 0), 0), [instances])
  const totalDisk = useMemo(() => instances.reduce((sum, i) => sum + Number(i.disk?.total || 0), 0), [instances])

  function fmtRatioBytes(used, total) {
    if (!total) return { used: '—', total: '—', unit: '' }
    if (total >= 1024 ** 3) {
      return {
        used: (used / (1024 ** 3)).toFixed(1),
        total: (total / (1024 ** 3)).toFixed(1),
        unit: 'GB',
      }
    }
    return {
      used: String(Math.round(used / (1024 ** 2))),
      total: String(Math.round(total / (1024 ** 2))),
      unit: 'MB',
    }
  }

  const ramRatio = fmtRatioBytes(usedRam, totalRam)
  const diskRatio = fmtRatioBytes(usedDisk, totalDisk)

  const selectedInstances = filteredInstances.filter((i) => selectedNames.has(i.name))

  function toggleSelect(name) {
    setSelectedNames((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  function toggleSelectAll(names, allSelected) {
    setSelectedNames((prev) => {
      const next = new Set(prev)
      if (allSelected) {
        names.forEach((name) => next.delete(name))
      } else {
        names.forEach((name) => next.add(name))
      }
      return next
    })
  }

  function clearSelection() {
    setSelectedNames(new Set())
  }

  async function runBatch(fn, successTitle) {
    if (!selectedInstances.length) return
    const names = selectedInstances.map((i) => i.name)
    const MIN = new Promise((r) => setTimeout(r, 500))
    const promise = Promise.all([
      Promise.all(names.map((name) => fn(name))),
      MIN,
    ]).then(() => {
      qc.invalidateQueries({ queryKey: ['instances'] })
      qc.invalidateQueries({ queryKey: ['stats'] })
      qc.invalidateQueries({ queryKey: ['activity'] })
    })

    sileo.promise(promise, {
      loading: { title: `Applying action to ${names.length} instance(s)…` },
      success: { title: successTitle },
      error: (e) => ({ title: e.message }),
    })

    try {
      await promise
      clearSelection()
    } catch (err) {
      void err
    }
  }

  const hasSelection = selectedInstances.length > 0

  return (
    <div className="page">
      <div className="instances-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 className="page-title">Instances</h1>
          <p className="mono" style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 7 }}>
            {isLoading ? <span className="skeleton" style={{ display: 'inline-block', width: 80, height: 12 }} /> : `${instances.length} instance${instances.length !== 1 ? 's' : ''} total`}
          </p>
        </div>
        <div className="instances-header-actions" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="btn-ghost" onClick={() => refetch()}>
            <RefreshCw size={13} /> Refresh
          </button>
          <button className="btn-accent" onClick={onNewInstance}>
            <Plus size={13} /> New Instance
          </button>
        </div>
      </div>

      {!isLoading && (
        <p className="mono instances-totals" style={{ marginBottom: 12, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
          <span>vCPUs </span>
          <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{usedCpus}</span>
          <span>/{totalCpus}</span>
          <span> · RAM </span>
          <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{ramRatio.used}</span>
          <span>/{ramRatio.total} {ramRatio.unit}</span>
          <span> · Disk </span>
          <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{diskRatio.used}</span>
          <span>/{diskRatio.total} {diskRatio.unit}</span>
        </p>
      )}

      {!isLoading && (
        <InstancesControls
          stateFilter={stateFilter}
          onStateFilterChange={setStateFilter}
          imageFilter={imageFilter}
          onImageFilterChange={setImageFilter}
          imageOptions={imageOptions}
          query={query}
          onQueryChange={setQuery}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          counts={counts}
        />
      )}

      {!isLoading && (
        <InstancesBatchActions
          selectedCount={selectedInstances.length}
          onStart={() => runBatch((name) => api.startInstance(name), `Started ${selectedInstances.length} instance(s)`)}
          onStop={() => runBatch((name) => api.stopInstance(name), `Stopped ${selectedInstances.length} instance(s)`)}
          onRestart={() => runBatch((name) => api.restartInstance(name), `Restarted ${selectedInstances.length} instance(s)`)}
          onSuspend={() => runBatch((name) => api.suspendInstance(name), `Suspended ${selectedInstances.length} instance(s)`)}
          onSnapshot={() => runBatch((name) => api.createSnapshot(name), `Created snapshots for ${selectedInstances.length} instance(s)`)}
          onDelete={() => setConfirmBulkDelete(true)}
          onClear={clearSelection}
        />
      )}

      {isLoading ? (
        <SkeletonTable />
      ) : viewMode === 'table' ? (
        <InstancesTable
          instances={filteredInstances}
          selectedNames={selectedNames}
          onToggleSelect={toggleSelect}
          onToggleSelectAll={toggleSelectAll}
          searchQuery={query}
        />
      ) : (
        <InstancesCardsView
          instances={filteredInstances}
          selectedNames={selectedNames}
          onToggleSelect={toggleSelect}
        />
      )}

      {confirmBulkDelete && (
        <ConfirmModal
          title={`Delete ${selectedInstances.length} instances`}
          description="Selected instances will be permanently deleted and purged."
          confirmLabel="Delete all"
          variant="confirm"
          onClose={() => setConfirmBulkDelete(false)}
          onConfirm={() => runBatch((name) => api.deleteInstance(name), `Deleted ${selectedInstances.length} instance(s)`)}
        />
      )}

      {!isLoading && hasSelection && viewMode === 'cards' && (
        <p className="mono" style={{ marginTop: 10, fontSize: 11.5, color: 'var(--text-secondary)' }}>
          Tip: selection persists between views. Switch to table for dense bulk operations.
        </p>
      )}
    </div>
  )
}
