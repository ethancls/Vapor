import { Search, X, Grid3X3, Table2 } from 'lucide-react'
import CustomSelect from '../CustomSelect'
import { STATE_FILTERS } from './instancesUtils'

export default function InstancesControls({
  stateFilter,
  onStateFilterChange,
  imageFilter,
  onImageFilterChange,
  imageOptions,
  query,
  onQueryChange,
  viewMode,
  onViewModeChange,
  counts,
}) {
  return (
    <div className="instances-controls" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
      <div className="instances-state-filters" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', flex: '1 1 320px' }}>
        {STATE_FILTERS.map((state) => (
          <button
            key={state}
            onClick={() => onStateFilterChange(state)}
            className={`filter-pill${stateFilter === state ? ' active' : ''}`}
          >
            {state}
            <span className="pill-count">{counts?.[state] ?? 0}</span>
          </button>
        ))}
      </div>

      <div className="instances-controls-right" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginLeft: 'auto', minWidth: 0 }}>
        <div className="instances-search-control" style={{
          display: 'flex', alignItems: 'center', gap: 7,
          background: 'var(--card-2)', border: '1px solid var(--border)',
          borderRadius: 'var(--r-sm)', padding: '0 10px', height: 36, width: 'clamp(150px, 22vw, 220px)',
        }}>
          <Search size={12} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
          <input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search..."
            style={{
              background: 'none', border: 'none', outline: 'none',
              color: 'var(--text-primary)', fontFamily: 'IBM Plex Mono', fontSize: 12,
              width: '100%',
            }}
          />
          {query && (
            <button
              onClick={() => onQueryChange('')}
              style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                color: 'var(--text-secondary)', display: 'flex', alignItems: 'center',
              }}
            >
              <X size={11} />
            </button>
          )}
        </div>

        <CustomSelect
          value={imageFilter}
          onChange={onImageFilterChange}
          options={imageOptions}
          searchable
          controlHeight={36}
          style={{ minWidth: 140, width: 'clamp(160px, 24vw, 240px)', flex: '0 1 auto' }}
        />

        <div className="instances-view-toggle" style={{
          display: 'flex',
          alignItems: 'center',
          border: '1px solid var(--border)',
          borderRadius: 'var(--r-sm)',
          overflow: 'hidden',
          height: 36,
        }}>
          <button
            className="btn-ghost"
            onClick={() => onViewModeChange('table')}
            style={{
              border: 'none',
              borderRadius: 0,
              height: '100%',
              background: viewMode === 'table' ? 'var(--accent-dim)' : 'transparent',
              color: viewMode === 'table' ? 'var(--accent)' : 'var(--text-secondary)',
              padding: '0 12px',
            }}
            title="Table view"
          >
            <Table2 size={13} />
          </button>
          <button
            className="btn-ghost"
            onClick={() => onViewModeChange('cards')}
            style={{
              border: 'none',
              borderRadius: 0,
              height: '100%',
              background: viewMode === 'cards' ? 'var(--accent-dim)' : 'transparent',
              color: viewMode === 'cards' ? 'var(--accent)' : 'var(--text-secondary)',
              padding: '0 12px',
            }}
            title="Card view"
          >
            <Grid3X3 size={13} />
          </button>
        </div>
      </div>
    </div>
  )
}
