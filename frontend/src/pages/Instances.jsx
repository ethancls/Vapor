import { useInstances } from '../hooks/useInstances'
import InstancesTable from '../components/InstancesTable'
import SearchBar from '../components/SearchBar'
import { RefreshCw, Plus } from 'lucide-react'

export default function Instances({ onNewInstance }) {
  const { instances, isLoading, refetch } = useInstances()

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 className="page-title">Instances</h1>
          <p className="mono" style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 6 }}>
            {instances.length} instance{instances.length !== 1 ? 's' : ''} total
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <SearchBar />
          <button className="btn-ghost" onClick={() => refetch()}>
            <RefreshCw size={13} /> Refresh
          </button>
          <button className="btn-accent" onClick={onNewInstance}>
            <Plus size={13} /> New Instance
          </button>
        </div>
      </div>

      {isLoading ? (
        <p className="mono" style={{ color: 'var(--text-muted)', fontSize: 12, padding: '40px 0', textAlign: 'center' }}>
          Loading instances…
        </p>
      ) : (
        <InstancesTable instances={instances} />
      )}
    </div>
  )
}
