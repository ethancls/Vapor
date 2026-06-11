import { useQuery } from '@tanstack/react-query'
import ContainerDataTable from '../components/ContainerDataTable'
import { api } from '../api/client'
import { SkeletonTable } from '../components/Skeletons'
import BrandIcon from '../components/BrandIcon'

function volumeName(item) {
  const name = item.name || '-'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ 
        width: 28, height: 28, borderRadius: 6, background: 'var(--card-2)', 
        display: 'flex', alignItems: 'center', justifyContent: 'center', 
        border: '1px solid var(--border)', flexShrink: 0 
      }}>
        <BrandIcon name={name} type="volume" size={16} />
      </div>
      <span className="mono" style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>{name}</span>
    </div>
  )
}

export default function Volumes() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['volumes'],
    queryFn: () => api.getVolumes(),
    refetchInterval: 15000,
    retry: false,
  })
  const volumes = data?.volumes || []

  return (
    <div className="page">
      <div className="instances-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 className="page-title">Volumes</h1>
        </div>
      </div>

      {error && <p className="mono" style={{ color: 'var(--stopped)', marginBottom: 12 }}>{error.message}</p>}

      {isLoading ? (
        <SkeletonTable cols={[{ w: 180 }, { w: 100 }, { w: 80 }]} rows={5} />
      ) : (
        <ContainerDataTable
          items={volumes}
          empty="No volumes available"
          columns={[
            { key: 'name', label: 'Name', accent: false, render: volumeName },
            { key: 'driver', label: 'Driver' },
            { key: 'size', label: 'Size' },
          ]}
        />
      )}
    </div>
  )
}
