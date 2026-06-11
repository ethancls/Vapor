import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Download, Search, X, Trash2, Layers } from 'lucide-react'
import { sileo } from 'sileo'
import { api } from '../api/client'
import ContainerDataTable from '../components/ContainerDataTable'
import CustomSelect from '../components/CustomSelect'
import ConfirmModal from '../components/ConfirmModal'
import BrandIcon from '../components/BrandIcon'
import { SkeletonTable } from '../components/Skeletons'

const EMPTY_IMAGES = []
const EMPTY_RESULTS = []

function imageName(item) {
  const name = item.name || '-'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ 
        width: 28, height: 28, borderRadius: 6, background: 'var(--card-2)', 
        display: 'flex', alignItems: 'center', justifyContent: 'center', 
        border: '1px solid var(--border)', flexShrink: 0 
      }}>
        <BrandIcon name={name} type="image" size={16} />
      </div>
      <span className="mono" style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>{name}</span>
    </div>
  )
}


function imageTag(item) {
  return item.tag || '-'
}

function imageSize(item) {
  return item.size || '-'
}

export default function Images() {
  const qc = useQueryClient()
  const [query, setQuery] = useState('')
  const [provider, setProvider] = useState('dockerhub')
  const [registryQuery, setRegistryQuery] = useState('ubuntu')
  const [deleteImage, setDeleteImage] = useState(null)

  const localImagesQuery = useQuery({
    queryKey: ['images-local'],
    queryFn: () => api.getLocalImages(),
    refetchInterval: 15000,
    retry: false,
  })

  const registryQueryResult = useQuery({
    queryKey: ['registry-search', provider, registryQuery],
    queryFn: () => api.searchRegistry(provider, registryQuery),
    enabled: Boolean(registryQuery.trim()),
    staleTime: 60000,
    retry: false,
  })

  const localImages = localImagesQuery.data?.images || EMPTY_IMAGES
  const filteredLocal = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return localImages
    const match = (item) => {
      const n = (item.name || '').toLowerCase()
      const t = (item.tag || '').toLowerCase()
      return n.includes(q) || t.includes(q)
    }
    return localImages.filter(match)
  }, [localImages, query])

  async function pull(image) {
    const promise = api.imageAction({ action: 'pull', image }).then(() => qc.invalidateQueries({ queryKey: ['images-local'] }))
    sileo.promise(promise, {
      loading: { title: `Pulling ${image}` },
      success: { title: `Pulled ${image}` },
      error: (e) => ({ title: e.message }),
    })
    await promise
  }

  async function removeImage(image) {
    const promise = api.imageAction({ action: 'delete', image }).then(() => qc.invalidateQueries({ queryKey: ['images-local'] }))
    sileo.promise(promise, {
      loading: { title: `Deleting ${image}` },
      success: { title: `Deleted ${image}` },
      error: (e) => ({ title: e.message }),
    })
    await promise
  }

  return (
    <div className="page">
      <div className="instances-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 className="page-title">Images</h1>
        </div>
      </div>

      <section style={{ marginBottom: 40 }}>
        <div className="instances-controls" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
          <div className="instances-state-filters" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', flex: '1 1 280px' }}>
            <button className="filter-pill active" type="button">Local <span className="pill-count">{localImages.length}</span></button>
          </div>
          <div className="instances-search-control" style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', padding: '0 10px', height: 36, minWidth: 260, background: 'var(--card-1)' }}>
            <Search size={14} color="var(--text-muted)" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search local images..." style={{ flex: 1, minWidth: 0, background: 'transparent', border: 0, outline: 0, color: 'var(--text-primary)', fontSize: 13 }} />
            {query && <button type="button" onClick={() => setQuery('')} style={{ background: 'none', border: 0, color: 'var(--text-muted)', cursor: 'pointer' }}><X size={14} /></button>}
          </div>
        </div>

        {localImagesQuery.isLoading ? (
          <SkeletonTable cols={[{ w: 180 }, { w: 120 }, { w: 80 }]} rows={3} />
        ) : (
          <ContainerDataTable
            items={filteredLocal}
            empty="No local images"
            columns={[
              { key: 'name', label: 'Image', accent: false, render: imageName },
              { key: 'tag', label: 'Tag / Digest', render: imageTag },
              { key: 'size', label: 'Size', render: imageSize },
            ]}
            renderActions={(item) => {
              const name = item.name
              return (
                <div style={{ display: 'inline-flex', gap: 5 }}>
                  <button className="icon-btn danger" title="Delete image" onClick={() => setDeleteImage(name)}><Trash2 size={14} /></button>
                </div>
              )
            }}
          />
        )}

      </section>

      <section>
        <div className="instances-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
             <Layers size={18} color="var(--text-secondary)" />
             <p className="section-title" style={{ margin: 0 }}>Registry Search</p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <CustomSelect
              value={provider}
              onChange={setProvider}
              options={[
                { value: 'dockerhub', label: 'Docker Hub' },
                { value: 'ghcr', label: 'GHCR' },
              ]}
              controlHeight={38}
              style={{ width: 150 }}
            />
            <input className="input" value={registryQuery} onChange={(e) => setRegistryQuery(e.target.value)} placeholder={provider === 'ghcr' ? 'owner/image' : 'Search images'} style={{ width: 260 }} />
          </div>
        </div>
        {registryQueryResult.error && <p className="mono" style={{ color: 'var(--stopped)', marginBottom: 12 }}>{registryQueryResult.error.message}</p>}
        <ContainerDataTable
          items={registryQueryResult.data?.results || EMPTY_RESULTS}
          empty={registryQuery.trim() ? 'No registry images' : 'Search Docker Hub or GHCR'}
          columns={[
            { key: 'name', label: 'Name', accent: true, render: (item) => item.image || item.repo_name || item.name },
            { key: 'short_description', label: 'Description', render: (item) => item.short_description || item.description || '-' },
            { key: 'star_count', label: 'Stars' },
            { key: 'pull_count', label: 'Pulls' },
          ]}
          renderActions={(item) => {
            const ref = item.image || item.repo_name || item.name
            return <button className="icon-btn" title="Pull image" onClick={() => pull(ref)}><Download size={14} /></button>
          }}
        />
      </section>

      {deleteImage && (
        <ConfirmModal
          title={`Delete Image`}
          description={`Are you sure you want to delete ${deleteImage}? This will permanently remove the local image.`}
          confirmLabel="Delete"
          variant="confirm"
          onClose={() => setDeleteImage(null)}
          onConfirm={() => removeImage(deleteImage).finally(() => setDeleteImage(null))}
        />
      )}
    </div>
  )
}

