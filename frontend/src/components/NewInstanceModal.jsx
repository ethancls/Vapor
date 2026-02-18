import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Minus, ChevronDown, ChevronUp, Wifi, HardDrive, Cpu, Clock, FileCode, Network } from 'lucide-react'
import Modal from './Modal'
import CustomSelect from './CustomSelect'
import { useToast } from './Toast'

const IMAGES = [
  { value: '24.04', label: 'Ubuntu 24.04 LTS', tag: 'latest' },
  { value: '22.04', label: 'Ubuntu 22.04 LTS', tag: 'lts' },
  { value: '20.04', label: 'Ubuntu 20.04 LTS' },
  { value: '23.10', label: 'Ubuntu 23.10' },
  { value: 'debian', label: 'Debian' },
  { value: 'custom', label: 'Custom image…' },
]

function fmtMem(mb) {
  if (mb >= 1024) return `${(mb / 1024).toFixed(mb % 1024 === 0 ? 0 : 1)} GB`
  return `${mb} MB`
}

function Section({ icon: Icon, title, open, onToggle, children }) {
  return (
    <div style={{ borderTop: '1px solid var(--border)', marginTop: 18, paddingTop: 18 }}>
      <button
        type="button"
        onClick={onToggle}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none',
          padding: 0, cursor: 'pointer', color: 'var(--text-secondary)', width: '100%',
          marginBottom: open ? 16 : 0,
        }}
      >
        <Icon size={14} style={{ color: 'var(--text-muted)' }} />
        <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-secondary)', flex: 1, textAlign: 'left' }}>{title}</span>
        {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
      </button>
      {open && children}
    </div>
  )
}

function RangeRow({ label, value, min, max, step, onChange, display }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <label className="input-label" style={{ margin: 0 }}>{label}</label>
        <span className="mono" style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>{display}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: 'var(--accent)', cursor: 'pointer' }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: 'var(--text-muted)', marginTop: 2 }}>
        <span className="mono">{min}</span><span className="mono">{max}</span>
      </div>
    </div>
  )
}

export default function NewInstanceModal({ onClose }) {
  const qc = useQueryClient()
  const toast = useToast()

  const [form, setForm] = useState({
    name: '', image: '24.04', customImage: '',
    cpus: 2, memory: 2048, disk: 20,
    timeout: 300,
    networks: [],
    bridged: false,
    cloudInit: '',
    mounts: [],
  })
  const [sections, setSections] = useState({ resources: true, network: false, advanced: false })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const toggleSection = (k) => setSections(s => ({ ...s, [k]: !s[k] }))

  const { data: networksData } = useQuery({
    queryKey: ['networks'],
    queryFn: () => fetch('/api/networks').then(r => r.json()),
    staleTime: 60000,
  })
  const availableNetworks = networksData?.networks ?? []

  function toggleNetwork(name) {
    set('networks', form.networks.includes(name)
      ? form.networks.filter(n => n !== name)
      : [...form.networks, name])
  }

  function addMount() { set('mounts', [...form.mounts, { host: '', guest: '' }]) }
  function removeMount(i) { set('mounts', form.mounts.filter((_, idx) => idx !== i)) }
  function updateMount(i, k, v) {
    set('mounts', form.mounts.map((m, idx) => idx === i ? { ...m, [k]: v } : m))
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
    try {
      const image = form.image === 'custom' ? form.customImage.trim() : form.image
      const payload = {
        name, image,
        cpus: form.cpus,
        memory: `${form.memory}M`,
        disk: `${form.disk}G`,
        timeout: form.timeout,
        networks: form.networks,
        bridged: form.bridged,
        cloud_init: form.cloudInit.trim() || null,
        mounts: form.mounts.filter(m => m.host.trim()),
      }
      const res = await fetch('/api/instances/launch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).then(r => r.json())

      if (res.status === 'success') {
        setSuccess(true)
        qc.invalidateQueries({ queryKey: ['instances'] })
        qc.invalidateQueries({ queryKey: ['stats'] })
        qc.invalidateQueries({ queryKey: ['activity'] })
        toast(`Launched ${name}`, 'success')
        setTimeout(onClose, 1400)
      } else {
        setError(res.error || 'Launch failed')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <Modal title="Launching…" onClose={onClose} size="sm">
        <div style={{ textAlign: 'center', padding: '28px 0' }}>
          <div style={{
            width: 54, height: 54, borderRadius: 14, background: 'var(--accent-dim)',
            border: '1px solid var(--accent-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px',
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 00-2.91-.09z"/>
              <path d="M12 15l-3-3a22 22 0 012-3.95A12.88 12.88 0 0122 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 01-4 2z"/>
            </svg>
          </div>
          <p style={{ fontWeight: 700, fontSize: 15, color: 'var(--accent)', marginBottom: 4 }}>Launching {form.name}</p>
          <p className="mono" style={{ fontSize: 12, color: 'var(--text-muted)' }}>This may take a minute…</p>
        </div>
      </Modal>
    )
  }

  return (
    <Modal title="New Instance" size="lg" onClose={onClose}
      footer={
        <>
          <button type="button" className="btn-ghost" onClick={onClose} disabled={loading}>Cancel</button>
          <button type="submit" form="launch-form" className="btn-accent" disabled={loading}>
            {loading ? 'Launching…' : 'Launch Instance'}
          </button>
        </>
      }
    >
      <form id="launch-form" onSubmit={handleSubmit}>
        {/* Name + Image */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div>
            <label className="input-label">Instance Name *</label>
            <input className="input" value={form.name} autoFocus placeholder="my-vm"
              onChange={e => set('name', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} />
          </div>
          <div>
            <label className="input-label">Image</label>
            <CustomSelect
              value={form.image}
              onChange={v => set('image', v)}
              options={IMAGES.map(i => ({ value: i.value, label: i.label, tag: i.tag }))}
            />
          </div>
        </div>

        {form.image === 'custom' && (
          <div style={{ marginTop: 14 }}>
            <label className="input-label">Custom Image / URL</label>
            <input className="input" value={form.customImage}
              onChange={e => set('customImage', e.target.value)} placeholder="e.g. 22.04 or https://..." />
          </div>
        )}

        {/* Resources */}
        <Section icon={Cpu} title="Resources" open={sections.resources} onToggle={() => toggleSection('resources')}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <RangeRow label="CPUs" value={form.cpus} min={1} max={16} step={1}
              onChange={v => set('cpus', v)} display={`${form.cpus} vCPU${form.cpus > 1 ? 's' : ''}`} />
            <RangeRow label="Memory" value={form.memory} min={512} max={32768} step={512}
              onChange={v => set('memory', v)} display={fmtMem(form.memory)} />
            <RangeRow label="Disk" value={form.disk} min={5} max={200} step={5}
              onChange={v => set('disk', v)} display={`${form.disk} GB`} />
          </div>
        </Section>

        {/* Network */}
        <Section icon={Network} title="Networking" open={sections.network} onToggle={() => toggleSection('network')}>
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
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>Use the default bridged interface</p>
            </div>
          </label>

          {availableNetworks.length > 0 && (
            <>
              <label className="input-label" style={{ marginBottom: 8 }}>Additional Networks</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 150, overflowY: 'auto' }}>
                {availableNetworks.map(n => (
                  <label key={n.name} style={{
                    display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer',
                    padding: '8px 11px', borderRadius: 9, border: '1px solid',
                    background: form.networks.includes(n.name) ? 'var(--accent-dim)' : 'var(--card-2)',
                    borderColor: form.networks.includes(n.name) ? 'var(--accent-border)' : 'var(--border)',
                  }}>
                    <input type="checkbox" checked={form.networks.includes(n.name)}
                      onChange={() => toggleNetwork(n.name)}
                      style={{ accentColor: 'var(--accent)', width: 13, height: 13 }} />
                    <Wifi size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                    <span className="mono" style={{ fontSize: 12, fontWeight: 600 }}>{n.name}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{n.type}</span>
                    {n.description && (
                      <span style={{ fontSize: 10.5, color: 'var(--text-muted)', marginLeft: 'auto', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {n.description}
                      </span>
                    )}
                  </label>
                ))}
              </div>
            </>
          )}
        </Section>

        {/* Advanced */}
        <Section icon={HardDrive} title="Advanced" open={sections.advanced} onToggle={() => toggleSection('advanced')}>
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
            <textarea className="input" value={form.cloudInit}
              onChange={e => set('cloudInit', e.target.value)}
              placeholder={'#cloud-config\npackages:\n  - git\n  - curl'}
              rows={5}
              style={{ resize: 'vertical', fontSize: 12 }} />
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <label className="input-label" style={{ margin: 0 }}>Mount Directories</label>
              <button type="button" className="btn-ghost" style={{ padding: '4px 10px', fontSize: 11 }} onClick={addMount}>
                <Plus size={11} /> Add
              </button>
            </div>
            {form.mounts.length === 0 && (
              <p className="mono" style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>No mounts configured</p>
            )}
            {form.mounts.map((m, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                <input className="input" placeholder="/host/path" value={m.host}
                  onChange={e => updateMount(i, 'host', e.target.value)} />
                <input className="input" placeholder="/guest/path (opt)" value={m.guest}
                  onChange={e => updateMount(i, 'guest', e.target.value)} />
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

        {error && (
          <p className="mono" style={{ marginTop: 14, fontSize: 12, color: 'var(--stopped)', lineHeight: 1.5 }}>{error}</p>
        )}
      </form>
    </Modal>
  )
}
