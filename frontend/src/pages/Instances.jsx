import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { sileo } from 'sileo'
import { useInstances } from '../hooks/useInstances'
import { api } from '../api/client'
import InstancesTable from '../components/InstancesTable'
import ConfirmModal from '../components/ConfirmModal'
import InstancesControls from '../components/instances/InstancesControls'
import InstancesBatchActions from '../components/instances/InstancesBatchActions'
import InstancesCardsView from '../components/instances/InstancesCardsView'
import { filterInstances, randomSnapshotName } from '../components/instances/instancesUtils'

const COLS = ['Name', 'State', 'IPv4', 'Image', 'CPUs', 'RAM', 'Disk', 'Usage', 'Actions']

function SkeletonTable() {
  return (
    <div className="instances-table-shell" style={{ background: 'var(--card-1)', borderRadius: 'var(--r-card)', border: '1px solid var(--border)', overflowX: 'auto' }}>
      <table style={{ width: '100%', minWidth: 1120, borderCollapse: 'collapse' }}>
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
          {['s0','s1','s2','s3','s4'].map((k, idx) => (
            <tr key={k} style={{ borderBottom: idx < 4 ? '1px solid var(--border)' : 'none' }}>
              <td style={{ padding: '14px 10px 14px 14px' }}><div className="skeleton" style={{ height: 18, width: 18, borderRadius: 5 }} /></td>
              <td style={{ padding: '14px 18px' }}><div className="skeleton" style={{ height: 13, width: 120, borderRadius: 5 }} /></td>
              <td style={{ padding: '14px 18px' }}><div className="skeleton" style={{ height: 20, width: 68, borderRadius: 100 }} /></td>
              <td style={{ padding: '14px 18px' }}><div className="skeleton" style={{ height: 12, width: 100, borderRadius: 5 }} /></td>
              <td style={{ padding: '14px 18px' }}><div className="skeleton" style={{ height: 12, width: 110, borderRadius: 5 }} /></td>
              <td style={{ padding: '14px 18px' }}><div className="skeleton" style={{ height: 12, width: 24, borderRadius: 5 }} /></td>
              <td style={{ padding: '14px 18px' }}><div className="skeleton" style={{ height: 12, width: 60, borderRadius: 5 }} /></td>
              <td style={{ padding: '14px 18px' }}><div className="skeleton" style={{ height: 12, width: 60, borderRadius: 5 }} /></td>
              <td style={{ padding: '14px 18px' }}><div className="skeleton" style={{ height: 12, width: 100, borderRadius: 5 }} /></td>
              <td style={{ padding: '14px 18px' }}><div style={{ display: 'flex', gap: 5 }}>{[...Array(3)].map((_, j) => <div key={j} className="skeleton" style={{ width: 30, height: 30, borderRadius: 8 }} />)}</div></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function Instances({ onNewInstance }) {
  const { instances, isLoading } = useInstances()
  const qc = useQueryClient()

  const [stateFilter, setStateFilter] = useState('All')
  const [imageFilter, setImageFilter] = useState('All')
  const [query, setQuery] = useState('')
  const [viewMode, setViewMode] = useState('table')
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
  const selectedInstances = filteredInstances.filter((i) => selectedNames.has(i.name))
  const bulkActionsEnabled = useMemo(() => {
    if (!selectedInstances.length) {
      return {
        start: false,
        stop: false,
        restart: false,
        suspend: false,
        snapshot: false,
        delete: false,
      }
    }
    const every = (predicate) => selectedInstances.every(predicate)
    return {
      // Intersection of available actions for all selected instances
      start: every((i) => i.state === 'Stopped' || i.state === 'Suspended'),
      stop: every((i) => i.state === 'Running'),
      restart: every((i) => i.state === 'Running'),
      suspend: every((i) => i.state === 'Running'),
      snapshot: every((i) => i.state === 'Stopped'),
      delete: true,
    }
  }, [selectedInstances])

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

  return (
    <div className="page">
      <div className="instances-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 className="page-title">Instances</h1>
        </div>
        <div className="instances-header-actions" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="btn-accent" onClick={onNewInstance}>
            <Plus size={13} /> New Instance
          </button>
        </div>
      </div>

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
          onSnapshot={() => runBatch((name) => api.createSnapshot(name, randomSnapshotName(name)), `Created snapshots for ${selectedInstances.length} instance(s)`)}
          onDelete={() => setConfirmBulkDelete(true)}
          onClear={clearSelection}
          actionsEnabled={bulkActionsEnabled}
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
    </div>
  )
}
