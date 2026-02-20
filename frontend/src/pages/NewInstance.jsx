import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Rocket, Cpu, HardDrive, Plus, Minus,
  ChevronDown, ChevronUp, Wifi, Clock, FileCode, Network,
  Bookmark, Trash2, Check, MemoryStick, Dices, Search,
} from 'lucide-react'
import CustomSelect from '../components/CustomSelect'
import { sileo } from 'sileo'
import { api } from '../api/client'

/* ── Pricing — AWS EC2 on-demand us-east-1 Linux ~2025-2026 ── */
const PRICE_VCPU_HR   = 0.0208  // t3 family
const PRICE_GBRAM_HR  = 0.0052  // t3 family
const PRICE_GBDISK_HR = 0.00011 // EBS gp3 ($0.08/GB-mo ÷ 730)

/* ── Random name generator ── */
const ADJECTIVES = ['happy', 'calm', 'bold', 'bright', 'crisp', 'fancy', 'golden', 'kind', 'lush', 'mild', 'neat', 'proud', 'quick', 'sharp', 'sleek', 'smart', 'smooth', 'sonic', 'sunny', 'swift', 'vivid', 'warm', 'witty', 'brave', 'cool', 'deep', 'gentle', 'grand', 'jolly', 'keen', 'noble', 'plain', 'rapid', 'rich', 'serene', 'tender', 'wild', 'wise', 'zesty', 'fresh', 'clever']
const NOUNS      = ['shark', 'flower', 'tiger', 'panda', 'eagle', 'wolf', 'fox', 'lion', 'otter', 'robin', 'crane', 'raven', 'cobra', 'gecko', 'koala', 'lemur', 'moose', 'zebra', 'ferret', 'jaguar', 'narwhal', 'osprey', 'parrot', 'rabbit', 'salmon', 'toucan', 'walrus', 'dingo', 'marten', 'quail', 'lynx', 'bison', 'finch', 'heron', 'viper']
function randomName() {
  return `${ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]}-${NOUNS[Math.floor(Math.random() * NOUNS.length)]}`
}

/* ── Image helpers ── */
const FALLBACK_IMAGE_OPTIONS = [
  { value: '25.10', label: '25.10', group: 'Images', description: 'Ubuntu 25.10', tag: 'latest' },
  { value: '24.04', label: '24.04', group: 'Images', description: 'Ubuntu 24.04 LTS', tag: 'lts' },
  { value: '22.04', label: '22.04', group: 'Images', description: 'Ubuntu 22.04 LTS', tag: 'lts' },
  { value: 'custom', label: 'Custom image…', group: 'Custom' },
]

function safeEntries(input) {
  if (!input) return []
  if (Array.isArray(input)) return input.map((item, idx) => [String(item?.name || item?.image || item?.alias || item?.id || `item-${idx}`), item]).filter(([key]) => key)
  if (typeof input === 'object') return Object.entries(input)
  return []
}

function imageGroupFromKey(name, meta = {}) {
  if (meta.remote === 'appliance' || name.startsWith('appliance:')) return 'Appliances'
  if (meta.remote === 'daily' || name.startsWith('daily:')) return 'Daily'
  if (name === 'core' || name.startsWith('core')) return 'Ubuntu Core'
  return 'Images'
}

function parseVersionName(name) {
  const match = /^(\d+)\.(\d+)$/.exec(String(name))
  if (!match) return null
  return { major: Number(match[1]), minor: Number(match[2]) }
}

function latestStableImageName(rawImages) {
  let latest = null
  for (const [name, meta] of rawImages) {
    if (meta?.remote) continue
    const version = parseVersionName(name)
    if (!version) continue
    if (!latest || version.major > latest.version.major || (version.major === latest.version.major && version.minor > latest.version.minor)) {
      latest = { name, version }
    }
  }
  return latest?.name || null
}

function imageTag(name, meta = {}, latestName = null) {
  const aliases = Array.isArray(meta.aliases) ? meta.aliases : []
  const release = String(meta.release || '')
  if (latestName && name === latestName) return 'latest'
  if (/\blts\b/i.test(release) || aliases.includes('lts')) return 'lts'
  if (meta.remote === 'daily' || name.startsWith('daily:')) return 'daily'
  if (meta.remote === 'appliance' || name.startsWith('appliance:')) return 'app'
  return undefined
}

function imageDescription(meta = {}) {
  return [meta.os, meta.release].filter(Boolean).join(' ').trim()
}

function normalizeImageOptions(payload) {
  const catalog = payload && typeof payload === 'object' && payload.images ? payload.images : payload
  if (!catalog || typeof catalog !== 'object') return []
  const rawImages = safeEntries(catalog.images)
  const rawBlueprints = safeEntries(catalog['blueprints (deprecated)'] || catalog.blueprints)
  const latestName = latestStableImageName(rawImages)
  const imageOptions = rawImages.map(([name, meta]) => ({
    value: name, label: name, group: imageGroupFromKey(name, meta),
    description: imageDescription(meta), tag: imageTag(name, meta, latestName),
  })).sort((a, b) => a.value.localeCompare(b.value))
  const blueprintOptions = rawBlueprints.map(([name, meta]) => ({
    value: name, label: name, group: 'Blueprints (deprecated)',
    description: imageDescription(meta), tag: 'legacy',
  })).sort((a, b) => a.value.localeCompare(b.value))
  return [...imageOptions, ...blueprintOptions, { value: 'custom', label: 'Custom image…', group: 'Custom' }]
}

/* ── Formatters ── */
function fmtMem(mb) {
  if (mb >= 1024) return `${(mb / 1024).toFixed(mb % 1024 === 0 ? 0 : 1)} GB`
  return `${mb} MB`
}
function fmtCost(usd) {
  return `$${usd.toFixed(4)}`
}

/* ── Template helpers ── */
const TIER_ORDER = ['nano', 'micro', 'small', 'medium', 'large', 'xlarge', '2xlarge']

function sortTemplates(templates) {
  return [...templates].sort((a, b) => {
    const ai = TIER_ORDER.indexOf(a.tier), bi = TIER_ORDER.indexOf(b.tier)
    if (ai !== -1 && bi !== -1) return ai - bi
    if (ai !== -1) return -1
    if (bi !== -1) return 1
    return a.name.localeCompare(b.name)
  })
}

/* ── Sub-components ── */
function Section({ icon: Icon, title, open, onToggle, children, badge }) {
  return (
    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 20, marginTop: 20 }}>
      <button
        type="button"
        onClick={onToggle}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'none', border: 'none', padding: 0, cursor: 'pointer',
          color: 'var(--text-secondary)', width: '100%', marginBottom: open ? 18 : 0,
        }}
      >
        <Icon size={14} />
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', flex: 1, textAlign: 'left' }}>{title}</span>
        {badge != null && (
          <span style={{
            fontSize: 10, fontWeight: 700, fontFamily: 'IBM Plex Mono',
            background: 'var(--accent-dim)', color: 'var(--accent)',
            border: '1px solid var(--accent-border)',
            borderRadius: 100, padding: '1px 7px', lineHeight: 1.6,
          }}>{badge}</span>
        )}
        {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
      </button>
      {open && children}
    </div>
  )
}

function RangeRow({ label, value, min, max, step, onChange, display, hostMax }) {
  const pct = ((value - min) / (max - min)) * 100
  const overHalf = pct > 75
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <label className="input-label" style={{ margin: 0 }}>{label}</label>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          {hostMax != null && (
            <span className="mono" style={{ fontSize: 10, color: overHalf ? 'var(--suspended)' : 'var(--text-muted)' }}>
              {hostMax}
            </span>
          )}
          <span className="mono" style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 700 }}>{display}</span>
        </div>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: 'var(--accent)', cursor: 'pointer' }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: 'var(--text-muted)', marginTop: 4 }}>
        <span className="mono">{min}</span><span className="mono">{max}</span>
      </div>
    </div>
  )
}

function TemplateCard({ tpl, active, onSelect, onDelete }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(tpl)}
      style={{
        padding: '12px 14px', borderRadius: 12,
        border: `1px solid ${active ? 'var(--accent-border)' : 'var(--border)'}`,
        background: active ? 'var(--accent-dim)' : 'var(--card-2)',
        cursor: 'pointer', textAlign: 'left',
        transition: 'border-color 0.13s, background 0.13s',
        position: 'relative',
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.borderColor = 'var(--border-hover)' }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.borderColor = active ? 'var(--accent-border)' : 'var(--border)' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: active ? 'var(--accent)' : 'var(--text-primary)', lineHeight: 1, margin: 0 }}>
          {tpl.name}
        </p>
        {tpl.tier === 'medium' && tpl.is_builtin && (
          <span style={{ fontSize: 9, background: 'var(--accent)', color: '#0a0a0a', borderRadius: 4, padding: '2px 5px', fontWeight: 800, lineHeight: 1, flexShrink: 0 }}>
            popular
          </span>
        )}
      </div>
      <p className="mono" style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
        {tpl.cpus} vCPU · {fmtMem(tpl.memory_mb)}<br />{tpl.disk_gb} GB disk
      </p>
      {!tpl.is_builtin && onDelete && (
        <button
          type="button"
          onClick={e => { e.stopPropagation(); onDelete(tpl.id) }}
          title="Delete template"
          style={{
            position: 'absolute', top: 6, right: 6,
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', padding: 3, display: 'flex', borderRadius: 4,
            transition: 'color 0.13s',
          }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--stopped)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
        >
          <Trash2 size={11} />
        </button>
      )}
    </button>
  )
}

/* ── Preview panel ── */
function PreviewPanel({ form, activeTemplate }) {
  const ramGb  = form.memory / 1024
  const diskGb = form.disk
  const hourly = form.cpus * PRICE_VCPU_HR + ramGb * PRICE_GBRAM_HR + diskGb * PRICE_GBDISK_HR
  const monthly = hourly * 730

  const displayImage = form.image === 'custom' ? (form.customImage.trim() || 'custom') : form.image

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, position: 'sticky', top: 30 }}>
      {/* VM card preview */}
      <div className="card" style={{ padding: 20 }}>
        <p className="section-label" style={{ marginBottom: 14 }}>Preview</p>

        <div style={{ marginBottom: 16 }}>
          <p className="mono" style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', lineHeight: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 4 }}>
            {form.name.trim() || <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>my-instance</span>}
          </p>
          <p className="mono" style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1 }}>{displayImage}</p>
        </div>

        {activeTemplate && (
          <div style={{ marginBottom: 14, padding: '6px 10px', borderRadius: 8, background: 'var(--accent-dim)', border: '1px solid var(--accent-border)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Bookmark size={10} style={{ color: 'var(--accent)' }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)' }}>{activeTemplate.name}</span>
          </div>
        )}

        <div className="preview-resources-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
          {[
            { Icon: Cpu, label: 'CPU', value: `${form.cpus} vCPU` },
            { Icon: MemoryStick, label: 'RAM', value: fmtMem(form.memory) },
            { Icon: HardDrive, label: 'Disk', value: `${form.disk} GB` },
          ].map(({ Icon, label, value }) => (
            <div key={label} style={{ background: 'var(--card-3)', borderRadius: 9, padding: '10px', border: '1px solid var(--border)' }}>
              <Icon size={12} style={{ color: 'var(--text-secondary)', marginBottom: 6 }} />
              <p className="mono" style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>{value}</p>
              <p style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 3 }}>{label}</p>
            </div>
          ))}
        </div>

        {form.bridged && (
          <div style={{ marginTop: 12, padding: '7px 10px', borderRadius: 8, background: 'var(--card-3)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Wifi size={11} style={{ color: 'var(--text-secondary)' }} />
            <span className="mono" style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Bridged network</span>
          </div>
        )}
      </div>

      {/* Cost estimate */}
      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Cost estimate</p>
            <a
              href="https://aws.amazon.com/ec2/pricing/on-demand/"
              target="_blank" rel="noreferrer"
              style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary)', textDecoration: 'none', transition: 'color 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)' }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)' }}
            >
              EC2 prices ↗
            </a>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p className="mono" style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>{fmtCost(monthly)}</p>
            <p style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>/month est.</p>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {[
            { label: `${form.cpus} vCPU`, val: `${fmtCost(form.cpus * PRICE_VCPU_HR)}/hr`, color: '#b5f23d' },
            { label: `${fmtMem(form.memory)} RAM`, val: `${fmtCost(ramGb * PRICE_GBRAM_HR)}/hr`, color: '#60a5fa' },
            { label: `${form.disk} GB Disk`, val: `${fmtCost(diskGb * PRICE_GBDISK_HR)}/hr`, color: '#a78bfa' },
          ].map(({ label, val, color }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <div style={{ width: 7, height: 7, borderRadius: 2, background: color, flexShrink: 0 }} />
              <span className="mono" style={{ fontSize: 11, color: 'var(--text-primary)', flex: 1 }}>{label}</span>
              <span className="mono" style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{val}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ── Main page ── */
export default function NewInstance() {
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [form, setForm] = useState({
    name: '', image: '24.04', customImage: '',
    cpus: 2, memory: 2048, disk: 20,
    timeout: 300, networks: [], bridged: false, cloudInit: '', mounts: [],
  })
  const [sections, setSections]     = useState({ network: false, advanced: false })
  const [networkSearch, setNetworkSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [activeTemplateId, setActiveTemplateId] = useState(null)
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [saveTemplateName, setSaveTemplateName] = useState('')
  const [saveTemplateDesc, setSaveTemplateDesc] = useState('')
  const [savedTemplate, setSavedTemplate] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const toggleSection = (k) => setSections(s => ({ ...s, [k]: !s[k] }))

  const { data: hostInfo } = useQuery({ queryKey: ['host-info'], queryFn: () => api.getHostInfo(), staleTime: Infinity, retry: false })
  const { data: networksData } = useQuery({ queryKey: ['networks'], queryFn: () => api.getNetworks(), staleTime: 60000 })
  const { data: imagesData, isLoading: imagesLoading, error: imagesError } = useQuery({ queryKey: ['images-catalog'], queryFn: () => api.getImages(), staleTime: 5 * 60 * 1000 })
  const { data: templatesData, refetch: refetchTemplates } = useQuery({ queryKey: ['templates'], queryFn: () => api.getTemplates(), staleTime: 30000 })

  const availableNetworks = networksData?.networks ?? []
  const imageOptions = useMemo(() => {
    const opts = normalizeImageOptions(imagesData)
    return opts.length ? opts : FALLBACK_IMAGE_OPTIONS
  }, [imagesData])
  const templates = useMemo(() => sortTemplates(templatesData?.templates ?? []), [templatesData])
  const activeTemplate = templates.find(t => t.id === activeTemplateId) ?? null

  function toggleNetwork(name) {
    set('networks', form.networks.includes(name) ? form.networks.filter(n => n !== name) : [...form.networks, name])
  }

  function addMount() { set('mounts', [...form.mounts, { host: '', guest: '' }]) }
  function removeMount(i) { set('mounts', form.mounts.filter((_, idx) => idx !== i)) }
  function updateMount(i, k, v) { set('mounts', form.mounts.map((m, idx) => idx === i ? { ...m, [k]: v } : m)) }

  function applyTemplate(tpl) {
    setActiveTemplateId(tpl.id)
    set('cpus', tpl.cpus)
    set('memory', tpl.memory_mb)
    set('disk', tpl.disk_gb)
    if (tpl.image && tpl.image !== 'custom') set('image', tpl.image)
  }

  async function handleDeleteTemplate(id) {
    const promise = api.deleteTemplate(id).then(() => { refetchTemplates(); if (activeTemplateId === id) setActiveTemplateId(null) })
    sileo.promise(promise, { loading: { title: 'Deleting…' }, success: { title: 'Template deleted' }, error: (e) => ({ title: e.message }) })
    await promise.catch(() => {})
  }

  async function handleSaveTemplate(e) {
    e.preventDefault()
    const name = saveTemplateName.trim()
    if (!name) return
    const promise = api.createTemplate({
      name,
      description: saveTemplateDesc.trim(),
      cpus: form.cpus,
      memory_mb: form.memory,
      disk_gb: form.disk,
      image: form.image === 'custom' ? (form.customImage.trim() || '24.04') : form.image,
    }).then(() => refetchTemplates())
    sileo.promise(promise, { loading: { title: 'Saving…' }, success: { title: `Template "${name}" saved` }, error: (e) => ({ title: e.message }) })
    try {
      await promise
      setSavedTemplate(true)
      setSavingTemplate(false)
      setSaveTemplateName('')
      setSaveTemplateDesc('')
      setTimeout(() => setSavedTemplate(false), 2000)
    } catch {}
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const name = form.name.trim()
    if (!name) { setError('Instance name is required'); return }
    if (!/^[a-z0-9][a-z0-9-]*$/.test(name)) {
      setError('Name must start with a letter/digit and only contain lowercase letters, digits, hyphens')
      return
    }
    setLoading(true)
    setError('')
    const image = form.image === 'custom' ? form.customImage.trim() : form.image
    const payload = {
      name, image, cpus: form.cpus,
      memory: `${form.memory}M`, disk: `${form.disk}G`,
      timeout: form.timeout, networks: form.networks,
      bridged: form.bridged, cloud_init: form.cloudInit.trim() || null,
      mounts: form.mounts.filter(m => m.host.trim()),
    }
    const promise = api.launchInstance(payload).then(res => {
      if (res.status !== 'success') throw new Error(res.error || 'Launch failed')
      qc.invalidateQueries({ queryKey: ['instances'] })
      qc.invalidateQueries({ queryKey: ['stats'] })
      qc.invalidateQueries({ queryKey: ['activity'] })
      return res
    })
    sileo.promise(promise, {
      loading: { title: `Launching ${name}…` },
      success: { title: `Launched ${name}` },
      error: (e) => ({ title: e.message }),
    })
    try {
      await promise
      navigate('/instances')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page">
      {/* ── Header ── */}
      <div className="new-instance-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32, gap: 14, flexWrap: 'wrap' }}>
        <div>
          <h1 className="page-title">New Instance</h1>
          <p className="mono" style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 5 }}>
            Configure and launch a new Multipass VM
          </p>
        </div>
        <div className="new-instance-header-actions" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn-ghost" onClick={() => navigate(-1)} disabled={loading}>Cancel</button>
          <button
            className="btn-accent"
            onClick={handleSubmit}
            disabled={loading || !form.name.trim()}
          >
            <Rocket size={13} />
            {loading ? 'Launching…' : 'Launch Instance'}
          </button>
        </div>
      </div>

      {/* ── Two-column layout ── */}
      <div className="new-instance-layout" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(280px, 320px)', gap: 24, alignItems: 'start' }}>

        {/* ── Left: Form ── */}
        <div>
          {/* Template picker */}
          {templates.length > 0 && (
            <div className="card" style={{ padding: 22, marginBottom: 20 }}>
              <p className="section-label" style={{ marginBottom: 14 }}>Quick templates</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
                {templates.map(tpl => (
                  <TemplateCard
                    key={tpl.id}
                    tpl={tpl}
                    active={activeTemplateId === tpl.id}
                    onSelect={applyTemplate}
                    onDelete={handleDeleteTemplate}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Main form card */}
          <div className="card" style={{ padding: 26 }}>
            <form id="launch-form" onSubmit={handleSubmit}>
              {/* Name + Image */}
              <div className="new-instance-primary-fields" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 18, marginBottom: 22 }}>
                <div>
                  <label className="input-label">Instance Name *</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      className="input"
                      value={form.name}
                      autoFocus
                      placeholder="my-vm"
                      onChange={e => set('name', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                      style={{ paddingRight: 36 }}
                    />
                    <button
                      type="button"
                      title="Generate random name"
                      onClick={() => set('name', randomName())}
                      style={{
                        position: 'absolute', right: 7, top: '50%', transform: 'translateY(-50%)',
                        background: 'none', border: 'none', cursor: 'pointer', padding: 4,
                        borderRadius: 5, display: 'flex', color: 'var(--text-muted)',
                        transition: 'color 0.13s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent)' }}
                      onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)' }}
                    >
                      <Dices size={14} />
                    </button>
                  </div>
                </div>
                <div>
                  <label className="input-label">Image</label>
                  <CustomSelect
                    value={form.image}
                    onChange={v => set('image', v)}
                    options={imageOptions}
                    searchable
                  />
                  {imagesLoading && <p className="mono" style={{ marginTop: 5, fontSize: 10.5, color: 'var(--text-secondary)' }}>Loading images…</p>}
                  {imagesError && <p className="mono" style={{ marginTop: 5, fontSize: 10.5, color: 'var(--text-secondary)' }}>Fallback list in use</p>}
                </div>
              </div>

              {form.image === 'custom' && (
                <div style={{ marginBottom: 22 }}>
                  <label className="input-label">Custom Image / URL</label>
                  <input className="input" value={form.customImage} onChange={e => set('customImage', e.target.value)} placeholder="e.g. 22.04 or https://..." />
                </div>
              )}

              {/* Resources — always expanded on full page */}
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                  <Cpu size={14} style={{ color: 'var(--text-secondary)' }} />
                  <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Resources</p>
                </div>
                {(() => {
                  const maxCpus   = hostInfo?.cpus      ?? 16
                  const maxRamMb  = hostInfo?.memory_mb  ?? 32768
                  const maxDiskGb = hostInfo?.disk_free_gb ? Math.max(hostInfo.disk_free_gb, 20) : 200
                  // Round maxRamMb down to nearest 512
                  const maxRamStep = Math.floor(maxRamMb / 512) * 512
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                      <RangeRow label="CPUs" value={form.cpus} min={1} max={maxCpus} step={1}
                        onChange={v => { set('cpus', v); setActiveTemplateId(null) }}
                        display={`${form.cpus} vCPU${form.cpus > 1 ? 's' : ''}`}
                        hostMax={hostInfo ? `${hostInfo.cpus} vCPU` : null} />
                      <RangeRow label="Memory" value={Math.min(form.memory, maxRamStep)} min={512} max={maxRamStep} step={512}
                        onChange={v => { set('memory', v); setActiveTemplateId(null) }}
                        display={fmtMem(form.memory)}
                        hostMax={hostInfo ? fmtMem(hostInfo.memory_mb) : null} />
                      <RangeRow label="Disk" value={Math.min(form.disk, maxDiskGb)} min={5} max={maxDiskGb} step={5}
                        onChange={v => { set('disk', v); setActiveTemplateId(null) }}
                        display={`${form.disk} GB`}
                        hostMax={hostInfo ? `${hostInfo.disk_free_gb} GB free` : null} />

                    </div>
                  )
                })()}
              </div>

              {/* Networking */}
              <Section
                icon={Network} title="Networking"
                open={sections.network} onToggle={() => toggleSection('network')}
                badge={form.networks.length + (form.bridged ? 1 : 0) || null}
              >
                <label style={{
                  display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
                  padding: '10px 12px', borderRadius: 10, border: '1px solid',
                  background: form.bridged ? 'var(--accent-dim)' : 'var(--card-2)',
                  borderColor: form.bridged ? 'var(--accent-border)' : 'var(--border)', marginBottom: 12,
                }}>
                  <input type="checkbox" checked={form.bridged} onChange={e => set('bridged', e.target.checked)}
                    style={{ accentColor: 'var(--accent)', width: 14, height: 14 }} />
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, lineHeight: 1 }}>Bridged network</p>
                    <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 3 }}>Use the default bridged interface</p>
                  </div>
                </label>

                {availableNetworks.length > 0 && (() => {
                  const q = networkSearch.trim().toLowerCase()
                  const filtered = q
                    ? availableNetworks.filter(n =>
                        n.name?.toLowerCase().includes(q) || n.type?.toLowerCase().includes(q))
                    : availableNetworks
                  return (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <label className="input-label" style={{ margin: 0 }}>
                          Additional Networks
                          {form.networks.length > 0 && (
                            <span className="mono" style={{ marginLeft: 7, fontSize: 10, color: 'var(--accent)', fontWeight: 700 }}>
                              {form.networks.length} selected
                            </span>
                          )}
                        </label>
                        {form.networks.length > 0 && (
                          <button type="button" onClick={() => set('networks', [])}
                            style={{ fontSize: 10.5, fontFamily: 'Syne', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, transition: 'color 0.13s' }}
                            onMouseEnter={e => { e.currentTarget.style.color = 'var(--stopped)' }}
                            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)' }}
                          >
                            Clear all
                          </button>
                        )}
                      </div>

                      {availableNetworks.length >= 5 && (
                        <div style={{ position: 'relative', marginBottom: 8 }}>
                          <Search size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                          <input
                            className="input"
                            value={networkSearch}
                            onChange={e => setNetworkSearch(e.target.value)}
                            placeholder="Search networks…"
                            style={{ paddingLeft: 30, fontSize: 12 }}
                          />
                        </div>
                      )}

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 200, overflowY: 'auto' }} className="no-scrollbar">
                        {filtered.length === 0 ? (
                          <p className="mono" style={{ fontSize: 11.5, color: 'var(--text-secondary)', padding: '6px 0' }}>
                            No networks match "{networkSearch}"
                          </p>
                        ) : filtered.map(n => (
                          <label key={n.name} style={{
                            display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer',
                            padding: '8px 11px', borderRadius: 9, border: '1px solid',
                            background: form.networks.includes(n.name) ? 'var(--accent-dim)' : 'var(--card-2)',
                            borderColor: form.networks.includes(n.name) ? 'var(--accent-border)' : 'var(--border)',
                          }}>
                            <input type="checkbox" checked={form.networks.includes(n.name)} onChange={() => toggleNetwork(n.name)}
                              style={{ accentColor: 'var(--accent)', width: 13, height: 13 }} />
                            <Wifi size={12} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
                            <span className="mono" style={{ fontSize: 12, fontWeight: 600, flex: 1 }}>{n.name}</span>
                            {n.type && (
                              <span style={{
                                fontSize: 10, fontFamily: 'IBM Plex Mono', color: 'var(--text-muted)',
                                background: 'var(--card-3)', borderRadius: 4, padding: '2px 6px', border: '1px solid var(--border)',
                              }}>{n.type}</span>
                            )}
                          </label>
                        ))}
                      </div>
                    </>
                  )
                })()}
              </Section>

              {/* Advanced */}
              <Section icon={HardDrive} title="Advanced" open={sections.advanced} onToggle={() => toggleSection('advanced')}
                badge={(form.cloudInit.trim() ? 1 : 0) + form.mounts.filter(m => m.host.trim()).length || null}
              >
                <div style={{ marginBottom: 16 }}>
                  <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Clock size={11} /> Launch Timeout (seconds)
                  </label>
                  <input type="number" className="input" value={form.timeout} min={60} max={3600}
                    onChange={e => set('timeout', Number(e.target.value))} />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <FileCode size={11} /> Cloud-init config (YAML)
                  </label>
                  <textarea className="input" value={form.cloudInit} onChange={e => set('cloudInit', e.target.value)}
                    placeholder={'#cloud-config\npackages:\n  - git\n  - curl'}
                    rows={5} style={{ resize: 'vertical', fontSize: 12 }} />
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <label className="input-label" style={{ margin: 0 }}>Mount Directories</label>
                    <button type="button" className="btn-ghost" style={{ padding: '4px 10px', fontSize: 11 }} onClick={addMount}>
                      <Plus size={11} /> Add
                    </button>
                  </div>
                  {form.mounts.length === 0 && (
                    <p className="mono" style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>No mounts configured</p>
                  )}
                  {form.mounts.map((m, i) => (
                    <div key={i} className="new-instance-mount-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr)) auto', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                      <input className="input" placeholder="/host/path" value={m.host} onChange={e => updateMount(i, 'host', e.target.value)} />
                      <input className="input" placeholder="/guest/path (opt)" value={m.guest} onChange={e => updateMount(i, 'guest', e.target.value)} />
                      <button type="button" onClick={() => removeMount(i)} style={{
                        background: 'none', border: '1px solid var(--border)', borderRadius: 8,
                        padding: '9px', cursor: 'pointer', color: 'var(--stopped)', display: 'flex',
                        transition: 'border-color 0.13s',
                      }}
                        onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(240,71,71,0.4)'}
                        onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                      >
                        <Minus size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              </Section>

              {/* Save as template */}
              <div style={{ borderTop: '1px solid var(--border)', marginTop: 20, paddingTop: 16 }}>
                {!savingTemplate ? (
                  <button
                    type="button"
                    onClick={() => setSavingTemplate(true)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: savedTemplate ? 'var(--running)' : 'var(--text-secondary)',
                      fontSize: 12.5, fontFamily: 'Syne', fontWeight: 600, padding: 0,
                      transition: 'color 0.13s',
                    }}
                    onMouseEnter={e => { if (!savedTemplate) e.currentTarget.style.color = 'var(--text-primary)' }}
                    onMouseLeave={e => { if (!savedTemplate) e.currentTarget.style.color = savedTemplate ? 'var(--running)' : 'var(--text-secondary)' }}
                  >
                    {savedTemplate ? <Check size={13} /> : <Bookmark size={13} />}
                    {savedTemplate ? 'Template saved!' : 'Save current config as template…'}
                  </button>
                ) : (
                  <div>
                    <p className="input-label" style={{ marginBottom: 10 }}>Save as template</p>
                    <div className="new-instance-template-fields" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10, marginBottom: 10 }}>
                      <input className="input" autoFocus value={saveTemplateName}
                        onChange={e => setSaveTemplateName(e.target.value)} placeholder="Template name" />
                      <input className="input" value={saveTemplateDesc}
                        onChange={e => setSaveTemplateDesc(e.target.value)} placeholder="Description (optional)" />
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button type="button" className="btn-ghost" style={{ height: 36 }} onClick={() => setSavingTemplate(false)}>Cancel</button>
                      <button type="button" className="btn-accent" style={{ height: 36 }} onClick={handleSaveTemplate} disabled={!saveTemplateName.trim()}>
                        <Bookmark size={12} /> Save template
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {error && (
                <p className="mono" style={{ marginTop: 16, fontSize: 12, color: 'var(--stopped)', lineHeight: 1.5 }}>{error}</p>
              )}
            </form>
          </div>
        </div>

        {/* ── Right: Preview ── */}
        <PreviewPanel form={form} activeTemplate={activeTemplate} />
      </div>
    </div>
  )
}
