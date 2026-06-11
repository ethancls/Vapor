import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, Boxes, Play, Plus } from 'lucide-react'
import { sileo } from 'sileo'
import { api } from '../api/client'
import BrandIcon from '../components/BrandIcon'
import CustomSelect from '../components/CustomSelect'
import DetailsTabs from '../components/instance-details/DetailsTabs'
import IOSToggle from '../components/IOSToggle'

const TYPE_TABS = [
  { value: 'machine', label: 'Apple Container Machine' },
  { value: 'container', label: 'Apple Container' },
]

const IMAGE_PRESETS = [
  { label: 'Alpine', value: 'alpine:latest' },
  { label: 'Ubuntu', value: 'ubuntu:latest' },
  { label: 'Fedora', value: 'fedora:latest' },
  { label: 'Debian', value: 'debian:latest' },
  { label: 'Nginx', value: 'nginx:latest' },
  { label: 'Traefik', value: 'traefik:latest' },
]

function randomName(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`
}

function lines(value) {
  return String(value || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

function words(value) {
  return String(value || '').trim().split(/\s+/).filter(Boolean)
}

function putOption(options, key, value) {
  if (value === '' || value == null || value === false) return
  options[key] = value
}

function Field({ label, children }) {
  return (
    <label style={{ display: 'grid', gap: 6 }}>
      <span className="input-label">{label}</span>
      {children}
    </label>
  )
}

function Preview({ type, image, name, options, args }) {
  const command = [
    'container',
    type === 'machine' ? 'machine create' : options.mode === 'create' ? 'create' : 'run',
    Object.entries(options.flags || {}).flatMap(([key, value]) => {
      if (value === true) return [key]
      if (Array.isArray(value)) return value.flatMap((item) => [key, item])
      return [key, value]
    }).join(' '),
    image,
    ...args,
  ].filter(Boolean).join(' ')

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 14, background: 'var(--card-1)' }}>
      <p className="section-label" style={{ margin: '0 0 8px' }}>Preview</p>
      <pre className="mono" style={{ whiteSpace: 'pre-wrap', margin: 0, color: 'var(--text-secondary)', fontSize: 12, lineHeight: 1.5 }}>{command}</pre>
      <div style={{ display: 'grid', gap: 7, marginTop: 14, fontSize: 12.5, color: 'var(--text-secondary)' }}>
        <span>Name: <strong className="mono" style={{ color: 'var(--text-primary)' }}>{name || 'auto'}</strong></span>
        <span>Image: <strong className="mono" style={{ color: 'var(--text-primary)' }}>{image || 'required'}</strong></span>
      </div>
    </div>
  )
}

export default function NewInstance() {
  const navigate = useNavigate()
  const [type, setType] = useState('machine')
  const [machine, setMachine] = useState({
    image: 'alpine:latest',
    name: randomName('machine'),
    cpus: '',
    memory: '',
    platform: '',
    arch: '',
    os: 'linux',
    homeMount: 'rw',
    setDefault: false,
    noBoot: false,
  })
  const [container, setContainer] = useState({
    mode: 'run',
    image: 'alpine:latest',
    name: randomName('container'),
    cpus: '',
    memory: '',
    command: '',
    env: '',
    workdir: '',
    user: '',
    detach: true,
    tty: false,
    interactive: false,
    ports: '',
    volumes: '',
    mounts: '',
    network: 'default',
    platform: '',
    arch: '',
    os: 'linux',
    rosetta: false,
    ssh: false,
    init: false,
    readOnly: false,
    remove: false,
  })
  const [submitting, setSubmitting] = useState(false)

  const current = type === 'machine' ? machine : container
  const setCurrent = (key, value) => {
    if (type === 'machine') setMachine((prev) => ({ ...prev, [key]: value }))
    else setContainer((prev) => ({ ...prev, [key]: value }))
  }

  const built = useMemo(() => {
    const flags = {}
    if (type === 'machine') {
      putOption(flags, '--name', machine.name)
      putOption(flags, '--cpus', machine.cpus)
      putOption(flags, '--memory', machine.memory)
      putOption(flags, '--platform', machine.platform)
      putOption(flags, '--arch', machine.arch)
      putOption(flags, '--os', machine.os)
      putOption(flags, '--home-mount', machine.homeMount)
      putOption(flags, '--set-default', machine.setDefault)
      putOption(flags, '--no-boot', machine.noBoot)
      return { flags, args: [] }
    }
    putOption(flags, '--name', container.name)
    putOption(flags, '--cpus', container.cpus)
    putOption(flags, '--memory', container.memory)
    putOption(flags, '--env', lines(container.env))
    putOption(flags, '--workdir', container.workdir)
    putOption(flags, '--user', container.user)
    putOption(flags, '--detach', container.detach)
    putOption(flags, '--tty', container.tty)
    putOption(flags, '--interactive', container.interactive)
    putOption(flags, '--publish', lines(container.ports))
    putOption(flags, '--volume', lines(container.volumes))
    putOption(flags, '--mount', lines(container.mounts))
    putOption(flags, '--network', lines(container.network))
    putOption(flags, '--platform', container.platform)
    putOption(flags, '--arch', container.arch)
    putOption(flags, '--os', container.os)
    putOption(flags, '--rosetta', container.rosetta)
    putOption(flags, '--ssh', container.ssh)
    putOption(flags, '--init', container.init)
    putOption(flags, '--read-only', container.readOnly)
    putOption(flags, '--remove', container.remove)
    return { flags, args: words(container.command), mode: container.mode }
  }, [container, machine, type])

  async function submit() {
    if (!current.image.trim()) {
      sileo.error({ title: 'Image is required' })
      return
    }
    setSubmitting(true)
    try {
      if (type === 'machine') {
        await api.createMachine({ image: machine.image.trim(), name: machine.name.trim(), options: built.flags })
        sileo.success({ title: `Created ${machine.name}` })
        navigate(`/instances/${encodeURIComponent(machine.name)}`)
      } else {
        await api.createContainer({
          mode: container.mode,
          image: container.image.trim(),
          name: container.name.trim(),
          args: built.args,
          options: built.flags,
        })
        sileo.success({ title: `${container.mode === 'create' ? 'Created' : 'Started'} ${container.name}` })
        navigate(`/containers/${encodeURIComponent(container.name)}`)
      }
    } catch (err) {
      sileo.error({ title: err.message })
    } finally {
      setSubmitting(false)
    }
  }

  const Icon = type === 'machine' ? Boxes : Box

  return (
    <div className="page">
      <div className="instances-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, gap: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card-1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon size={18} color="var(--accent)" />
          </div>
          <div>
            <h1 className="page-title">New</h1>
            <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: 13 }}>Create an Apple Container Machine or Apple Container.</p>
          </div>
        </div>
        <button className="btn-accent" type="button" onClick={submit} disabled={submitting}>
          {submitting ? 'Creating...' : <><Plus size={14} /> Create</>}
        </button>
      </div>

      <div style={{ maxWidth: 1120, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: 18, alignItems: 'start' }}>
        <div style={{ display: 'grid', gap: 16 }}>
          <DetailsTabs tabs={TYPE_TABS} value={type} onChange={setType} />

          <section style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 16, background: 'var(--card-1)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Image">
                <div style={{ display: 'flex', gap: 8 }}>
                  <input className="input mono" value={current.image} onChange={(e) => setCurrent('image', e.target.value)} placeholder="alpine:latest" />
                  <CustomSelect value={current.image} onChange={(value) => setCurrent('image', value)} options={IMAGE_PRESETS} controlHeight={38} style={{ width: 150 }} />
                </div>
              </Field>
              <Field label="Name">
                <input className="input mono" value={current.name} onChange={(e) => setCurrent('name', e.target.value)} />
              </Field>
              <Field label="CPUs">
                <input className="input mono" value={current.cpus} onChange={(e) => setCurrent('cpus', e.target.value)} placeholder="default" />
              </Field>
              <Field label="Memory">
                <input className="input mono" value={current.memory} onChange={(e) => setCurrent('memory', e.target.value)} placeholder={type === 'machine' ? '8G' : '1G'} />
              </Field>
              <Field label="Platform">
                <input className="input mono" value={current.platform} onChange={(e) => setCurrent('platform', e.target.value)} placeholder="linux/arm64" />
              </Field>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <Field label="Arch">
                  <input className="input mono" value={current.arch} onChange={(e) => setCurrent('arch', e.target.value)} placeholder="arm64" />
                </Field>
                <Field label="OS">
                  <input className="input mono" value={current.os} onChange={(e) => setCurrent('os', e.target.value)} placeholder="linux" />
                </Field>
              </div>
            </div>
          </section>

          {type === 'machine' ? (
            <section style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 16, background: 'var(--card-1)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                <Field label="Home mount">
                  <CustomSelect
                    value={machine.homeMount}
                    onChange={(value) => setMachine((prev) => ({ ...prev, homeMount: value }))}
                    options={[
                      { value: 'rw', label: 'Read-write' },
                      { value: 'ro', label: 'Read-only' },
                      { value: 'none', label: 'None' },
                    ]}
                    controlHeight={38}
                  />
                </Field>
                <Toggle label="Set default" checked={machine.setDefault} onChange={(value) => setMachine((prev) => ({ ...prev, setDefault: value }))} />
                <Toggle label="Do not boot" checked={machine.noBoot} onChange={(value) => setMachine((prev) => ({ ...prev, noBoot: value }))} />
              </div>
            </section>
          ) : (
            <section style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 16, background: 'var(--card-1)', display: 'grid', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr 1fr', gap: 12 }}>
                <Field label="Mode">
                  <CustomSelect
                    value={container.mode}
                    onChange={(value) => setContainer((prev) => ({ ...prev, mode: value }))}
                    options={[
                      { value: 'run', label: 'Run now' },
                      { value: 'create', label: 'Create only' },
                    ]}
                    controlHeight={38}
                  />
                </Field>
                <Field label="Command / args">
                  <input className="input mono" value={container.command} onChange={(e) => setContainer((prev) => ({ ...prev, command: e.target.value }))} placeholder="/bin/sh" />
                </Field>
                <Field label="Network">
                  <input className="input mono" value={container.network} onChange={(e) => setContainer((prev) => ({ ...prev, network: e.target.value }))} placeholder="default" />
                </Field>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Environment (one KEY=value per line)">
                  <textarea className="input mono" value={container.env} onChange={(e) => setContainer((prev) => ({ ...prev, env: e.target.value }))} rows={4} />
                </Field>
                <Field label="Ports (one publish spec per line)">
                  <textarea className="input mono" value={container.ports} onChange={(e) => setContainer((prev) => ({ ...prev, ports: e.target.value }))} rows={4} placeholder="8080:80/tcp" />
                </Field>
                <Field label="Volumes (one bind spec per line)">
                  <textarea className="input mono" value={container.volumes} onChange={(e) => setContainer((prev) => ({ ...prev, volumes: e.target.value }))} rows={4} placeholder="/host:/container" />
                </Field>
                <Field label="Mounts (one type=... spec per line)">
                  <textarea className="input mono" value={container.mounts} onChange={(e) => setContainer((prev) => ({ ...prev, mounts: e.target.value }))} rows={4} />
                </Field>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Workdir">
                  <input className="input mono" value={container.workdir} onChange={(e) => setContainer((prev) => ({ ...prev, workdir: e.target.value }))} placeholder="/" />
                </Field>
                <Field label="User">
                  <input className="input mono" value={container.user} onChange={(e) => setContainer((prev) => ({ ...prev, user: e.target.value }))} placeholder="name|uid[:gid]" />
                </Field>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
                {[
                  ['detach', 'Detach'],
                  ['tty', 'TTY'],
                  ['interactive', 'Interactive'],
                  ['rosetta', 'Rosetta'],
                  ['ssh', 'SSH agent'],
                  ['init', 'Init'],
                  ['readOnly', 'Read-only root'],
                  ['remove', 'Remove on exit'],
                ].map(([key, label]) => (
                  <Toggle key={key} label={label} checked={container[key]} onChange={(value) => setContainer((prev) => ({ ...prev, [key]: value }))} />
                ))}
              </div>
            </section>
          )}
        </div>

        <div style={{ display: 'grid', gap: 12, position: 'sticky', top: 18 }}>
          <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 14, background: 'var(--card-1)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <BrandIcon name={current.image} type="image" size={22} />
            <div>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: 'var(--text-primary)' }}>{type === 'machine' ? 'Apple Container Machine' : 'Apple Container'}</p>
              <p className="mono" style={{ margin: '3px 0 0', fontSize: 11.5, color: 'var(--text-muted)' }}>{current.image}</p>
            </div>
          </div>
          <Preview type={type} image={current.image} name={current.name} options={{ ...built, mode: container.mode }} args={built.args} />
          <button className="btn-accent" type="button" onClick={submit} disabled={submitting} style={{ justifyContent: 'center' }}>
            {submitting ? 'Creating...' : <><Play size={14} /> Create {type === 'machine' ? 'Machine' : 'Container'}</>}
          </button>
        </div>
      </div>
    </div>
  )
}

function Toggle({ label, checked, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', minHeight: 38 }}>
      <span style={{ fontSize: 12.5, color: 'var(--text-secondary)', fontWeight: 700 }}>{label}</span>
      <IOSToggle checked={checked} onChange={onChange} />
    </div>
  )
}
