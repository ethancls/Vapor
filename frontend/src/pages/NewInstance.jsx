import { useMemo, useState, useCallback, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Rocket, Plus, Minus,
  Wifi, Clock, FileCode,
  Bookmark, Trash2, Check, Dices,
  Folder, File, ChevronRight, X, Home, ExternalLink,
} from 'lucide-react'
import CustomSelect from '../components/CustomSelect'
import Tooltip from '../components/Tooltip'
import Modal from '../components/Modal'
import YamlEditor from '../components/YamlEditor'
import IOSToggle from '../components/IOSToggle'
import { sileo } from 'sileo'
import { api } from '../api/client'

/* ── Pricing — AWS EC2 on-demand us-east-1 Linux ~2025-2026 ── */
const PRICE_VCPU_HR = 0.0208  // t3 family
const PRICE_GBRAM_HR = 0.0052  // t3 family
const PRICE_GBDISK_HR = 0.00011 // EBS gp3 ($0.08/GB-mo ÷ 730)

/* ── Random name generator ── */
const ADJECTIVES = ['happy', 'calm', 'bold', 'bright', 'crisp', 'fancy', 'golden', 'kind', 'lush', 'mild', 'neat', 'proud', 'quick', 'sharp', 'sleek', 'smart', 'smooth', 'sonic', 'sunny', 'swift', 'vivid', 'warm', 'witty', 'brave', 'cool', 'deep', 'gentle', 'grand', 'jolly', 'keen', 'noble', 'plain', 'rapid', 'rich', 'serene', 'tender', 'wild', 'wise', 'zesty', 'fresh', 'clever']
const NOUNS = ['shark', 'flower', 'tiger', 'panda', 'eagle', 'wolf', 'fox', 'lion', 'otter', 'robin', 'crane', 'raven', 'cobra', 'gecko', 'koala', 'lemur', 'moose', 'zebra', 'ferret', 'jaguar', 'narwhal', 'osprey', 'parrot', 'rabbit', 'salmon', 'toucan', 'walrus', 'dingo', 'marten', 'quail', 'lynx', 'bison', 'finch', 'heron', 'viper']
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
  if (!catalog || typeof catalog !== 'object') return { imageOptions: [], blueprintOptions: [] }
  const rawImages = safeEntries(catalog.images)
  const rawBlueprints = safeEntries(catalog['blueprints (deprecated)'] || catalog.blueprints)
  const latestName = latestStableImageName(rawImages)
  const imageOptions = rawImages.map(([name, meta]) => ({
    value: name, label: name, group: imageGroupFromKey(name, meta),
    description: imageDescription(meta), tag: imageTag(name, meta, latestName),
  })).sort((a, b) => a.value.localeCompare(b.value))
  const blueprintOptions = rawBlueprints.map(([name, meta]) => ({
    value: name, label: name, group: 'Blueprints',
    description: imageDescription(meta), tag: 'deprecated',
    tagColor: 'var(--stopped)', tagBg: 'rgba(255,68,68,0.08)', tagBorderColor: 'rgba(255,68,68,0.25)',
  })).sort((a, b) => a.value.localeCompare(b.value))
  return { imageOptions, blueprintOptions }
}

/* ── Formatters ── */
function fmtBytes(b) {
  if (b >= 1073741824) return `${(b / 1073741824).toFixed(1)} GB`
  if (b >= 1048576) return `${(b / 1048576).toFixed(0)} MB`
  return `${Math.round(b / 1024)} KB`
}
function fmtMem(mb) {
  if (mb >= 1024) return `${(mb / 1024).toFixed(mb % 1024 === 0 ? 0 : 1)} GB`
  return `${mb} MB`
}
function fmtCost(usd) {
  return `$${usd.toFixed(4)}`
}

/* ── Cloud-init presets (official Multipass / Canonical YAMLs) ── */
const DOCKER_GPG_KEY = `-----BEGIN PGP PUBLIC KEY BLOCK-----

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
YT90qFF93M3v01BbxP+EIY2/9tiIPbrd
=0YYh
-----END PGP PUBLIC KEY BLOCK-----`

const CLOUD_INIT_PRESETS = [
  {
    id: 'docker', label: 'Docker', imgSrc: '/images/docker.svg',
    minReqs: { cpus: 2, memoryMb: 4096, diskGb: 20, hint: '2 vCPUs · 4 GB RAM · 20 GB disk' },
    yaml: `apt:
  sources:
    docker:
      source: |
        deb https://download.docker.com/linux/ubuntu $RELEASE stable
      key: |
        ${DOCKER_GPG_KEY.split('\n').join('\n        ')}

packages:
- binfmt-support
- docker-ce
- docker-ce-cli
- docker-compose
- containerd.io
- jq
- qemu-user-static
- skopeo

snap:
  commands:
  - snap install yq

runcmd:
- adduser ubuntu docker
- |
  sysctl vm.swappiness=0
  echo "vm.swappiness = 0" | tee -a /etc/sysctl.conf
- |
  systemctl disable man-db.timer man-db.service --now
  systemctl disable apt-daily.service apt-daily.timer --now
  systemctl disable apt-daily-upgrade.service apt-daily-upgrade.timer --now
  systemctl disable unattended-upgrades.service --now
- |
  docker run -d -p 9000:9000 --name=portainer --restart=always \\
    -v /var/run/docker.sock:/var/run/docker.sock \\
    -v portainer_data:/data portainer/portainer-ce
- apt-get autoremove -y

final_message: "The system is finally up, after $UPTIME seconds"`,
  },
  {
    id: 'jellyfin', label: 'Jellyfin', imgSrc: '/images/jellyfin.png',
    minReqs: { cpus: 2, memoryMb: 4096, diskGb: 20, hint: '2 vCPU · 4 GB RAM · 20 GB disk' },
    yaml: `package_update: true
package_upgrade: true

packages:
- apt-transport-https

runcmd:
- sudo apt install curl gnupg -y
- sudo add-apt-repository universe
- sudo mkdir -p /etc/apt/keyrings
- curl -fsSL https://repo.jellyfin.org/$(awk -F'=' '/^ID=/{ print $NF }' /etc/os-release)/jellyfin_team.gpg.key | sudo gpg --dearmor -o /etc/apt/keyrings/jellyfin.gpg
- |
  cat <<EOF | sudo tee /etc/apt/sources.list.d/jellyfin.sources
  Types: deb
  URIs: https://repo.jellyfin.org/$(awk -F'=' '/^ID=/{ print $NF }' /etc/os-release)
  Suites: $(awk -F'=' '/^VERSION_CODENAME=/{ print $NF }' /etc/os-release)
  Components: main
  Architectures: $(dpkg --print-architecture)
  Signed-By: /etc/apt/keyrings/jellyfin.gpg
  EOF
- sudo apt update -y
- sudo apt install jellyfin -y

final_message: "The system is finally up, after $UPTIME seconds"`,
  },
  {
    id: 'minikube', label: 'Minikube', imgSrc: '/images/minikube.png',
    minReqs: { cpus: 4, memoryMb: 8192, diskGb: 30, hint: '4 vCPU · 8 GB RAM · 30 GB disk' },
    yaml: `apt:
  sources:
    docker:
      source: |
        deb https://download.docker.com/linux/ubuntu $RELEASE stable
      key: |
        ${DOCKER_GPG_KEY.split('\n').join('\n        ')}

packages:
- dpkg-dev
- docker-ce
- docker-ce-cli
- containerd.io

snap:
  commands:
  - snap install kubectl --classic

runcmd:
- adduser ubuntu docker
- wget https://storage.googleapis.com/minikube/releases/latest/minikube_latest_$(dpkg-architecture -q DEB_HOST_ARCH).deb
- apt-get install --yes --no-install-recommends ./minikube_latest_$(dpkg-architecture -q DEB_HOST_ARCH).deb
- sudo -u ubuntu minikube start --driver=docker`,
  },
]

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
function TemplateStepperField({ label, value, min, max, step, onChange }) {
  const clamp = (n) => Math.max(min, Math.min(max, n))

  return (
    <div>
      <label className="input-label">{label}</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          type="button"
          className="btn-ghost"
          style={{ width: 32, height: 32, padding: 0, justifyContent: 'center' }}
          onClick={() => onChange(clamp(value - step))}
          disabled={value <= min}
          aria-label={`Decrease ${label}`}
        >
          <Minus size={12} />
        </button>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          className="input mono"
          value={String(value)}
          onChange={(e) => {
            const digits = e.target.value.replace(/[^\d]/g, '')
            if (!digits) {
              onChange(min)
              return
            }
            onChange(clamp(Number(digits)))
          }}
          onBlur={(e) => {
            const n = Number(e.target.value)
            onChange(clamp(Number.isFinite(n) ? n : min))
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowUp' || e.key === 'ArrowDown') e.preventDefault()
          }}
          style={{ textAlign: 'center', minWidth: 86, paddingInline: 8, lineHeight: 1 }}
        />
        <button
          type="button"
          className="btn-ghost"
          style={{ width: 32, height: 32, padding: 0, justifyContent: 'center' }}
          onClick={() => onChange(clamp(value + step))}
          disabled={value >= max}
          aria-label={`Increase ${label}`}
        >
          <Plus size={12} />
        </button>
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
          <span style={{ fontSize: 9, background: 'var(--accent-fill)', color: '#0a0a0a', borderRadius: 4, padding: '2px 5px', fontWeight: 800, lineHeight: 1, flexShrink: 0 }}>
            popular
          </span>
        )}
      </div>
      <p className="mono" style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
        {tpl.cpus} vCPU · {fmtMem(tpl.memory_mb)}<br />{tpl.disk_gb} GB disk
      </p>
      {!tpl.is_builtin && onDelete && (
        <Tooltip
          label="Delete template"
          style={{ position: 'absolute', top: 6, right: 6 }}
        >
          <button
            type="button"
            aria-label="Delete template"
            onClick={e => { e.stopPropagation(); onDelete(tpl.id) }}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-muted)', padding: 3, display: 'flex', borderRadius: 4,
              transition: 'color 0.13s',
            }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--stopped)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
          >
            <Trash2 size={11} />
          </button>
        </Tooltip>
      )}
    </button>
  )
}

/* ── Tab bar ── */
function TabBar({ tab, onChange, networkBadge, advancedBadge }) {
  const tabs = [
    { value: 'basics', label: 'Basics', badge: null },
    { value: 'resources', label: 'Templates', badge: null },
    { value: 'networking', label: 'Networking', badge: networkBadge || null },
    { value: 'advanced', label: 'Advanced', badge: advancedBadge || null },
  ]
  return (
    <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 24, gap: 0 }}>
      {tabs.map(t => {
        const isActive = tab === t.value
        return (
          <button
            key={t.value}
            type="button"
            onClick={() => onChange(t.value)}
            style={{
              background: 'none', border: 'none',
              borderBottom: isActive ? '2px solid var(--accent)' : '2px solid transparent',
              marginBottom: -1,
              padding: '8px 16px',
              cursor: 'pointer',
              fontSize: 13, fontWeight: isActive ? 700 : 500,
              color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
              lineHeight: 1,
              transition: 'color 0.13s, border-color 0.13s',
              display: 'flex', alignItems: 'center', gap: 7,
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={e => { if (!isActive) e.currentTarget.style.color = 'var(--text-primary)' }}
            onMouseLeave={e => { if (!isActive) e.currentTarget.style.color = 'var(--text-secondary)' }}
          >
            {t.label}
            {t.badge != null && t.badge > 0 && (
              <span style={{
                fontSize: 10, fontWeight: 700, fontFamily: 'IBM Plex Mono',
                background: isActive ? 'var(--accent-dim)' : 'rgba(255,255,255,0.06)',
                color: isActive ? 'var(--accent)' : 'var(--text-muted)',
                border: `1px solid ${isActive ? 'var(--accent-border)' : 'var(--border)'}`,
                borderRadius: 100, padding: '1px 6px', lineHeight: 1.6,
              }}>{t.badge}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}

/* ── Preview panel ── */
function PreviewPanel({ form, activeTemplate }) {
  const ramGb = form.memory / 1024
  const diskGb = form.disk
  const hourly = form.cpus * PRICE_VCPU_HR + ramGb * PRICE_GBRAM_HR + diskGb * PRICE_GBDISK_HR
  const monthly = hourly * 730

  const rawCustom = form.customImage.trim()
  const displayImage = form.image === 'custom' ? (rawCustom || 'custom') : form.image
  const isCustomUrl = form.image === 'custom' && /^https?:\/\//.test(rawCustom)
  const isCustomFile = form.image === 'custom' && !isCustomUrl && rawCustom.startsWith('/')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, position: 'sticky', top: 30 }}>
      {/* VM card preview */}
      <div className="card" style={{ padding: 20 }}>
        <p className="section-label" style={{ marginBottom: 14 }}>Preview</p>

        <div style={{ marginBottom: 16 }}>
          <p className="mono" style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', lineHeight: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 4 }}>
            {form.name.trim() || <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>my-instance</span>}
          </p>
          {isCustomUrl ? (
            <a
              href={rawCustom} target="_blank" rel="noreferrer"
              className="mono"
              style={{
                fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1,
                textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4,
                overflow: 'hidden', transition: 'color 0.13s',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent)' }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)' }}
            >
              <ExternalLink size={10} style={{ flexShrink: 0 }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {rawCustom.split('/').pop() || rawCustom}
              </span>
            </a>
          ) : isCustomFile ? (
            <p className="mono" style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1, display: 'flex', alignItems: 'center', gap: 4, overflow: 'hidden' }}>
              <File size={10} style={{ flexShrink: 0 }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rawCustom.split('/').pop() || rawCustom}</span>
            </p>
          ) : (
            <p className="mono" style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1 }}>{displayImage}</p>
          )}
        </div>

        {activeTemplate && (
          <div style={{ marginBottom: 14, padding: '6px 10px', borderRadius: 8, background: 'var(--accent-dim)', border: '1px solid var(--accent-border)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Bookmark size={10} style={{ color: 'var(--accent)' }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)' }}>{activeTemplate.name}</span>
          </div>
        )}

        <div style={{ display: 'flex', borderTop: '1px solid var(--border)', paddingTop: 14, marginTop: 4 }}>
          {[
            { label: 'vCPU', value: `${form.cpus}` },
            { label: 'RAM', value: fmtMem(form.memory) },
            { label: 'Disk', value: `${form.disk} GB` },
          ].map(({ label, value }, i) => (
            <div key={label} style={{
              flex: 1, textAlign: 'center',
              borderLeft: i > 0 ? '1px solid var(--border)' : 'none',
              padding: '0 6px',
            }}>
              <p className="mono" style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1, marginBottom: 5 }}>
                {value}
              </p>
              <p style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</p>
            </div>
          ))}
        </div>

        {form.bridged && (
          <div style={{ marginTop: 12, padding: '7px 10px', borderRadius: 8, background: 'var(--card-3)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Wifi size={11} style={{ color: 'var(--text-secondary)' }} />
            <span className="mono" style={{ fontSize: 11, color: 'var(--text-secondary)' }}>LAN access</span>
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

/* ── File browser modal ── */
function FileBrowserModal({ onSelect, onClose, mode = 'file' }) {
  const [path, setPath] = useState(null)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  const browse = useCallback(async (p) => {
    setLoading(true)
    setErr('')
    try {
      const res = await api.fsBrowse(p)
      setData(res)
      setPath(res.path)
    } catch (e) {
      setErr(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { browse(null) }, [browse])

  function fmtSize(bytes) {
    if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`
    if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(0)} MB`
    return `${Math.round(bytes / 1024)} KB`
  }

  const segments = path ? path.split('/').filter(Boolean) : []

  return (
    <Modal
      title={mode === 'dir' ? 'Select directory' : 'Select image file'}
      size="md"
      onClose={onClose}
      footer={mode === 'dir' ? (
        <button className="btn-accent" onClick={() => path && onSelect(path)} disabled={!path}>
          <Folder size={12} /> Use this folder
        </button>
      ) : (
        <span className="mono" style={{ fontSize: 10.5, color: 'var(--text-muted)', marginRight: 'auto' }}>
          Supported: <span style={{ color: 'var(--accent)' }}>.img .qcow2</span>
          <span style={{ opacity: 0.5 }}> · others shown but not supported</span>
        </span>
      )}
    >
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginBottom: 12, flexWrap: 'wrap', minHeight: 28 }}>
        <button type="button" onClick={() => browse('/')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', padding: '2px 5px', borderRadius: 4, transition: 'color 0.13s' }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-secondary)'}>
          <Home size={12} />
        </button>
        {segments.map((seg, i) => {
          const segPath = '/' + segments.slice(0, i + 1).join('/')
          return (
            <span key={segPath} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <ChevronRight size={10} style={{ color: 'var(--text-muted)' }} />
              <button type="button" onClick={() => browse(segPath)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer', padding: '2px 5px', borderRadius: 4,
                  fontFamily: 'IBM Plex Mono', fontSize: 11, transition: 'color 0.13s',
                  color: i === segments.length - 1 ? 'var(--text-primary)' : 'var(--text-secondary)',
                  fontWeight: i === segments.length - 1 ? 700 : 400,
                }}>
                {seg}
              </button>
            </span>
          )
        })}
      </div>

      {/* Entries */}
      <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ maxHeight: 340, overflowY: 'auto' }}>
          {loading && (
            <p className="mono" style={{ padding: '20px 16px', fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center', margin: 0 }}>Loading…</p>
          )}
          {err && (
            <p className="mono" style={{ padding: '16px', fontSize: 12, color: 'var(--stopped)', margin: 0 }}>{err}</p>
          )}
          {!loading && data && (
            <>
              {data.parent && (
                <button type="button" onClick={() => browse(data.parent)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                    background: 'none', border: 'none', borderBottom: '1px solid var(--border)',
                    cursor: 'pointer', padding: '8px 14px', transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                  <Folder size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  <span className="mono" style={{ fontSize: 12, color: 'var(--text-muted)' }}>..</span>
                </button>
              )}
              {data.entries.length === 0 && (
                <p className="mono" style={{ padding: '16px', fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>No image files found here</p>
              )}
              {data.entries.map((entry, idx) => (
                <button key={entry.path} type="button"
                  onClick={() => { if (entry.is_dir) browse(entry.path); else if (mode === 'file' && entry.supported) onSelect(entry.path) }}
                  disabled={mode === 'dir' ? !entry.is_dir : (!entry.is_dir && !entry.supported)}
                  title={mode === 'file' && !entry.is_dir && !entry.supported ? 'Not supported — only .img and .qcow2' : undefined}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                    background: 'none', border: 'none',
                    borderBottom: idx < data.entries.length - 1 ? '1px solid var(--border)' : 'none',
                    cursor: entry.is_dir || (mode === 'file' && entry.supported) ? 'pointer' : 'not-allowed',
                    padding: '8px 14px', transition: 'background 0.1s',
                    opacity: mode === 'dir' ? (entry.is_dir ? 1 : 0.25) : (!entry.is_dir && !entry.supported ? 0.35 : 1),
                  }}
                  onMouseEnter={e => { if (entry.is_dir || (mode === 'file' && entry.supported)) e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
                  onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                  {entry.is_dir
                    ? <Folder size={13} style={{ color: '#facc15', flexShrink: 0 }} />
                    : <File size={13} style={{ color: mode === 'file' && entry.supported ? 'var(--accent)' : 'var(--text-muted)', flexShrink: 0 }} />}
                  <span className="mono" style={{ fontSize: 12, color: entry.is_dir || (mode === 'file' && entry.supported) ? 'var(--text-primary)' : 'var(--text-muted)', flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {entry.name}
                  </span>
                  {!entry.is_dir && entry.size > 0 && (
                    <span className="mono" style={{ fontSize: 10.5, color: 'var(--text-muted)', flexShrink: 0 }}>{fmtSize(entry.size)}</span>
                  )}
                  {entry.is_dir && <ChevronRight size={11} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />}
                </button>
              ))}
            </>
          )}
        </div>
      </div>
    </Modal>
  )
}

/* ── Launch modal ── */
const LAUNCH_HINTS = [
  { after: 0,   text: 'This may take a minute…' },
  { after: 10,  text: 'Pulling image from catalog…' },
  { after: 28,  text: 'Setting up the VM…' },
  { after: 55,  text: 'Almost there…' },
  { after: 90,  text: 'Taking longer than usual…' },
  { after: 140, text: 'Still working, please wait…' },
  { after: 210, text: 'Hang tight, this is a big one…' },
]
function getLaunchHint(s) {
  let hint = LAUNCH_HINTS[0].text
  for (const h of LAUNCH_HINTS) { if (s >= h.after) hint = h.text; else break }
  return hint
}
function fmtElapsed(s) {
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`
}

function LaunchModal({ payload, onClose }) {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [phase, setPhase] = useState('launching') // 'launching' | 'success' | 'error'
  const [errorMsg, setErrorMsg] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const overlayRef = useRef(null)

  useEffect(() => {
    if (phase !== 'launching') return
    const id = setInterval(() => setElapsed(s => s + 1), 1000)
    return () => clearInterval(id)
  }, [phase])

  useEffect(() => {
    let cancelled = false
    api.launchInstance(payload)
      .then(res => {
        if (cancelled) return
        if (res.status !== 'success') throw new Error(res.error || 'Launch failed')
        qc.invalidateQueries({ queryKey: ['instances'] })
        qc.invalidateQueries({ queryKey: ['stats'] })
        qc.invalidateQueries({ queryKey: ['activity'] })
        setPhase('success')
      })
      .catch(err => {
        if (cancelled) return
        setErrorMsg(err.message)
        setPhase('error')
      })
    return () => { cancelled = true }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const canClose = phase !== 'launching'

  useEffect(() => {
    if (!canClose) return
    const fn = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [canClose, onClose])

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  return (
    <div
      ref={overlayRef}
      role="presentation"
      onClick={canClose ? e => { if (e.target === overlayRef.current) onClose() } : undefined}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.72)',
        backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
    >
      <style>{`
        @keyframes launch-spin { to { transform: rotate(360deg); } }
        @keyframes launch-modal-in {
          from { opacity:0; transform:scale(0.96) translateY(8px); }
          to   { opacity:1; transform:scale(1) translateY(0); }
        }
        @keyframes launch-hint-in {
          from { opacity:0; transform:translateY(5px); }
          to   { opacity:1; transform:translateY(0); }
        }
      `}</style>
      <div style={{
        background: 'var(--card-1)', border: '1px solid var(--border)',
        borderRadius: 20, width: '100%', maxWidth: 420,
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 64px rgba(0,0,0,0.7)',
        animation: 'launch-modal-in 0.18s cubic-bezier(0.4,0,0.2,1)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px 0' }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, letterSpacing: '-0.3px', lineHeight: 1 }}>
            {phase === 'launching' ? 'Launching…' : phase === 'success' ? 'Instance launched!' : 'Launch failed'}
          </h2>
          {canClose && (
            <button
              onClick={onClose}
              style={{
                background: 'var(--card-2)', border: '1px solid var(--border)',
                borderRadius: 8, padding: '5px 6px', cursor: 'pointer',
                color: 'var(--text-secondary)', display: 'flex', alignItems: 'center',
                transition: 'color 0.15s, border-color 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.borderColor = 'var(--border-hover)' }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'var(--border)' }}
            >
              <X size={15} />
            </button>
          )}
        </div>

        <div style={{ height: 1, background: 'var(--border)', margin: '18px 0 0' }} />

        {/* Body */}
        <div style={{ padding: '36px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, textAlign: 'center' }}>
          {phase === 'launching' && (
            <>
              <div style={{
                width: 52, height: 52, borderRadius: '50%',
                border: '3px solid var(--border)',
                borderTopColor: 'var(--accent)',
                animation: 'launch-spin 0.75s linear infinite',
                flexShrink: 0,
              }} />
              <div>
                <p className="mono" style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>{payload.name}</p>
                <p
                  key={getLaunchHint(elapsed)}
                  style={{ fontSize: 13, color: 'var(--text-secondary)', animation: 'launch-hint-in 0.35s ease', margin: 0 }}
                >
                  {getLaunchHint(elapsed)}
                </p>
                {elapsed >= 5 && (
                  <p className="mono" style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                    {fmtElapsed(elapsed)} elapsed
                  </p>
                )}
              </div>
            </>
          )}
          {phase === 'success' && (
            <>
              <div style={{
                width: 52, height: 52, borderRadius: '50%',
                background: 'rgba(181,242,61,0.1)',
                border: '2px solid var(--running)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Check size={24} style={{ color: 'var(--running)' }} />
              </div>
              <div>
                <p className="mono" style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 5 }}>{payload.name}</p>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>is up and running</p>
              </div>
            </>
          )}
          {phase === 'error' && (
            <>
              <div style={{
                width: 52, height: 52, borderRadius: '50%',
                background: 'rgba(240,71,71,0.1)',
                border: '2px solid var(--stopped)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <X size={24} style={{ color: 'var(--stopped)' }} />
              </div>
              {errorMsg.includes('local.bridged-network') ? (
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--stopped)', marginBottom: 6 }}>
                    Bridged network not configured
                  </p>
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    Select a network interface in Settings first, then try again.
                  </p>
                </div>
              ) : (
                <p className="mono" style={{
                  fontSize: 12, color: 'var(--stopped)',
                  background: 'rgba(240,71,71,0.07)', border: '1px solid rgba(240,71,71,0.2)',
                  borderRadius: 10, padding: '10px 14px', margin: 0,
                  lineHeight: 1.6, textAlign: 'left', maxWidth: '100%', wordBreak: 'break-word',
                }}>
                  {errorMsg}
                </p>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {(phase === 'success' || phase === 'error') && (
          <>
            <div style={{ height: 1, background: 'var(--border)' }} />
            <div style={{ padding: '16px 24px', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              {phase === 'success' ? (
                <>
                  <button className="btn-ghost" onClick={() => navigate('/instances')}>Go to Instances</button>
                  <button className="btn-accent" onClick={() => navigate(`/instances/${payload.name}`)}>
                    <Rocket size={13} /> View Details
                  </button>
                </>
              ) : errorMsg.includes('local.bridged-network') ? (
                <>
                  <button className="btn-ghost" onClick={onClose}>Cancel</button>
                  <button className="btn-accent" onClick={() => { onClose(); navigate('/settings') }}>
                    Go to Settings
                  </button>
                </>
              ) : (
                <button className="btn-ghost" onClick={onClose}>Cancel</button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/* ── Main page ── */
export default function NewInstance() {
  const navigate = useNavigate()

  const [form, setForm] = useState({
    name: '', image: '24.04', customImage: '',
    cpus: 2, memory: 2048, disk: 20,
    timeout: 300, networks: [], bridged: false, cloudInit: '', mounts: [],
  })
  const [tab, setTab] = useState('basics')
  const [showDeprecated, setShowDeprecated] = useState(false)
  const [showFileBrowser, setShowFileBrowser] = useState(false)
  const [confirmPreset, setConfirmPreset] = useState(null)
  const [urlCheck, setUrlCheck] = useState(null)
  const urlCheckTimer = useRef(null)
  const [showMountBrowser, setShowMountBrowser] = useState(null)
  const [launchPayload, setLaunchPayload] = useState(null)
  const [error, setError] = useState('')
  const [activeTemplateId, setActiveTemplateId] = useState(null)
  const [showCreateTemplate, setShowCreateTemplate] = useState(false)
  const [newTemplate, setNewTemplate] = useState({
    name: '',
    description: '',
    cpus: 2,
    memory_mb: 2048,
    disk_gb: 20,
    image: '24.04',
    custom_image: '',
  })

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const PRESET_TOAST_ID = 'cloud-init-resources'
  const presetWarnActive = useRef(false)

  useEffect(() => {
    const activePreset = CLOUD_INIT_PRESETS.find(p => form.cloudInit.trim() === p.yaml.trim())
    if (!activePreset?.minReqs) {
      if (presetWarnActive.current) {
        sileo.warning({ id: PRESET_TOAST_ID, title: 'Requirements met', duration: 50 })
        presetWarnActive.current = false
      }
      return
    }
    const { cpus: mc, memoryMb: mm, diskGb: md, hint } = activePreset.minReqs
    const lacking = []
    if (form.cpus < mc) lacking.push(`${mc} vCPU (now ${form.cpus})`)
    if (form.memory < mm) lacking.push(`${fmtMem(mm)} RAM (now ${fmtMem(form.memory)})`)
    if (form.disk < md) lacking.push(`${md} GB disk (now ${form.disk} GB)`)
    if (lacking.length) {
      sileo.warning({ id: PRESET_TOAST_ID, title: `${activePreset.label} needs ${hint}`, description: lacking.join(' · '), duration: null })
      presetWarnActive.current = true
    } else if (presetWarnActive.current) {
      sileo.success({ id: PRESET_TOAST_ID, title: `${activePreset.label} — requirements met`, duration: 2500 })
      presetWarnActive.current = false
    }
  }, [form.cpus, form.memory, form.disk, form.cloudInit])

  useEffect(() => () => {
    if (presetWarnActive.current) sileo.warning({ id: PRESET_TOAST_ID, title: '', duration: 50 })
  }, [])

  const { data: hostInfo } = useQuery({ queryKey: ['host-info'], queryFn: () => api.getHostInfo(), staleTime: Infinity, retry: false })
  const { data: networksData } = useQuery({ queryKey: ['networks'], queryFn: () => api.getNetworks(), staleTime: 60000 })
  const { data: imagesData, isLoading: imagesLoading, error: imagesError } = useQuery({ queryKey: ['images-catalog'], queryFn: () => api.getImages(), staleTime: 5 * 60 * 1000 })
  const { data: templatesData, refetch: refetchTemplates } = useQuery({ queryKey: ['templates'], queryFn: () => api.getTemplates(), staleTime: 30000 })

  const availableNetworks = networksData?.networks ?? []
  const imageOptions = useMemo(() => {
    const { imageOptions: imgs, blueprintOptions: bps } = normalizeImageOptions(imagesData)
    const combined = showDeprecated ? [...imgs, ...bps] : imgs
    const all = [...combined, { value: 'custom', label: 'Custom image…', group: 'Custom' }]
    return combined.length ? all : FALLBACK_IMAGE_OPTIONS
  }, [imagesData, showDeprecated])
  const templates = useMemo(() => sortTemplates(templatesData?.templates ?? []), [templatesData])
  const quickTemplates = useMemo(() => templates.filter(t => t.is_builtin), [templates])
  const personalTemplates = useMemo(() => templates.filter(t => !t.is_builtin), [templates])
  const activeTemplate = templates.find(t => t.id === activeTemplateId) ?? null

  function addMount() { set('mounts', [...form.mounts, { host: '', guest: '' }]) }
  function removeMount(i) { set('mounts', form.mounts.filter((_, idx) => idx !== i)) }
  function updateMount(i, k, v) { set('mounts', form.mounts.map((m, idx) => idx === i ? { ...m, [k]: v } : m)) }

  function applyTemplate(tpl) {
    setActiveTemplateId(tpl.id)
    set('cpus', tpl.cpus)
    set('memory', tpl.memory_mb)
    set('disk', tpl.disk_gb)
    if (tpl.image) {
      const knownImage = imageOptions.some(option => option.value === tpl.image)
      if (knownImage) {
        set('image', tpl.image)
        set('customImage', '')
      } else {
        set('image', 'custom')
        set('customImage', tpl.image)
      }
    }
  }

  async function handleDeleteTemplate(id) {
    const promise = api.deleteTemplate(id).then(() => { refetchTemplates(); if (activeTemplateId === id) setActiveTemplateId(null) })
    sileo.promise(promise, { loading: { title: 'Deleting…' }, success: { title: 'Template deleted' }, error: (e) => ({ title: e.message }) })
    await promise.catch(() => { })
  }

  async function handleSaveTemplate(e) {
    e.preventDefault()
    const name = newTemplate.name.trim()
    if (!name) return
    const image = newTemplate.image === 'custom'
      ? (newTemplate.custom_image.trim() || '24.04')
      : newTemplate.image
    const promise = api.createTemplate({
      name,
      description: newTemplate.description.trim(),
      cpus: Number(newTemplate.cpus) || 1,
      memory_mb: Number(newTemplate.memory_mb) || 1024,
      disk_gb: Number(newTemplate.disk_gb) || 10,
      image,
    }).then(() => refetchTemplates())
    sileo.promise(promise, { loading: { title: 'Saving…' }, success: { title: `Template "${name}" saved` }, error: (e) => ({ title: e.message }) })
    try {
      await promise
      setShowCreateTemplate(false)
      setNewTemplate({
        name: '',
        description: '',
        cpus: Math.max(1, form.cpus),
        memory_mb: Math.max(512, form.memory),
        disk_gb: Math.max(5, form.disk),
        image: form.image === 'custom' ? 'custom' : form.image,
        custom_image: form.image === 'custom' ? form.customImage : '',
      })
    } catch (err) {
      void err
    }
  }

  function handleSubmit(e) {
    e?.preventDefault()
    const name = form.name.trim()
    if (!name) { setError('Instance name is required'); return }
    if (!/^[a-z0-9][a-z0-9-]*$/.test(name)) {
      setError('Name must start with a letter/digit and only contain lowercase letters, digits, hyphens')
      return
    }
    setError('')
    const image = form.image === 'custom' ? form.customImage.trim() : form.image
    setLaunchPayload({
      name, image, cpus: form.cpus,
      memory: `${form.memory}M`, disk: `${form.disk}G`,
      timeout: form.timeout, networks: form.networks,
      bridged: form.bridged, cloud_init: form.cloudInit.trim() || null,
      mounts: form.mounts.filter(m => m.host.trim()),
    })
  }

  const maxCpus = hostInfo?.cpus ?? 16
  const maxRamMb = hostInfo?.memory_mb ?? 16384
  const maxDiskGb = hostInfo?.disk_free_gb ?? 500
  const maxRamStep = Math.floor(maxRamMb / 512) * 512

  return (
    <div className="page">
      {/* ── Header ── */}
      <div className="new-instance-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32, gap: 14, flexWrap: 'wrap' }}>
        <h1 className="page-title">New Instance</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-ghost" onClick={() => navigate(-1)}>Cancel</button>
          <button className="btn-accent" onClick={handleSubmit} disabled={!form.name.trim()}>
            <Rocket size={13} /> Launch Instance
          </button>
        </div>
      </div>

      {error && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '11px 16px', borderRadius: 12, marginBottom: 20,
          background: 'rgba(240,71,71,0.08)', border: '1px solid rgba(240,71,71,0.22)',
        }}>
          <X size={14} style={{ color: 'var(--stopped)', flexShrink: 0 }} />
          <p className="mono" style={{ fontSize: 12, color: 'var(--stopped)', margin: 0, lineHeight: 1.5 }}>{error}</p>
          <button
            type="button"
            onClick={() => setError('')}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--stopped)', padding: 2, display: 'flex', opacity: 0.6 }}
            onMouseEnter={e => e.currentTarget.style.opacity = '1'}
            onMouseLeave={e => e.currentTarget.style.opacity = '0.6'}
          ><X size={12} /></button>
        </div>
      )}

      {/* ── Tabs ── */}
      <TabBar
        tab={tab}
        onChange={setTab}
        networkBadge={form.networks.length + (form.bridged ? 1 : 0)}
        advancedBadge={(form.cloudInit.trim() ? 1 : 0) + form.mounts.filter(m => m.host.trim()).length}
      />

      {/* ── Two-column layout ── */}
      <div className="new-instance-layout" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(280px, 320px)', gap: 24, alignItems: 'start' }}>

        {/* ── Left: Form ── */}
        <div>
          <form onSubmit={handleSubmit}>

            {/* ── BASICS ── */}
            {tab === 'basics' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                <div className="new-instance-primary-fields" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 18 }}>
                  <div>
                    <label className="input-label" htmlFor="new-instance-name">Instance Name *</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        id="new-instance-name"
                        className="input"
                        value={form.name}
                        placeholder="my-instance"
                        onChange={e => set('name', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                        style={{ paddingRight: 36, height: 37 }}
                      />
                      <Tooltip label="Generate" style={{ position: 'absolute', right: 7, top: '50%', transform: 'translateY(-50%)' }}>
                        <button
                          type="button"
                          aria-label="Generate"
                          onClick={() => set('name', randomName())}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 5, display: 'flex', color: 'var(--text-muted)', transition: 'color 0.13s' }}
                          onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent)' }}
                          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)' }}
                        >
                          <Dices size={14} />
                        </button>
                      </Tooltip>
                    </div>
                  </div>
                  <div>
                    <label className="input-label" htmlFor="ni-image">Image</label>
                    <CustomSelect
                      id="ni-image"
                      value={form.image}
                      onChange={v => set('image', v)}
                      options={imageOptions}
                      searchable
                      controlHeight={37}
                    />
                    <div style={{ marginTop: 5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      {imagesLoading && <p className="mono" style={{ fontSize: 10.5, color: 'var(--text-secondary)', margin: 0 }}>Loading images…</p>}
                      {imagesError && <p className="mono" style={{ fontSize: 10.5, color: 'var(--text-secondary)', margin: 0 }}>Fallback list in use</p>}
                      {!imagesLoading && !imagesError && <span />}
                      <button
                        type="button"
                        onClick={() => setShowDeprecated(v => !v)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 12, color: 'var(--text-muted)', fontFamily: 'Syne', transition: 'color 0.13s' }}
                        onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-secondary)' }}
                        onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)' }}
                      >
                        {showDeprecated ? 'Hide deprecated' : 'Show deprecated items'}
                      </button>
                    </div>
                    {form.image === 'custom' && (
                      <div style={{ marginTop: 10, position: 'relative' }}>
                        <input
                          className="input"
                          value={form.customImage}
                          onChange={e => {
                            const v = e.target.value
                            set('customImage', v)
                            clearTimeout(urlCheckTimer.current)
                            if (/^https?:\/\/.{4}/.test(v)) {
                              setUrlCheck('checking')
                              urlCheckTimer.current = setTimeout(async () => {
                                try {
                                  const res = await api.fsCheckURL(v)
                                  setUrlCheck(res)
                                } catch {
                                  setUrlCheck({ ok: false, error: 'Request failed' })
                                }
                              }, 700)
                            } else {
                              setUrlCheck(null)
                            }
                          }}
                          placeholder="/path/to/image.img or https://…"
                          style={{ paddingRight: urlCheck ? 58 : 36 }}
                        />
                        {urlCheck && (
                          <span style={{ position: 'absolute', right: 34, top: '50%', transform: 'translateY(-50%)', display: 'flex' }}>
                            {urlCheck === 'checking'
                              ? <span className="mono" style={{ fontSize: 10, color: 'var(--text-muted)' }}>…</span>
                              : urlCheck.ok
                                ? <Check size={13} style={{ color: 'var(--running)' }} />
                                : <X size={13} style={{ color: 'var(--stopped)' }} />}
                          </span>
                        )}
                        <Tooltip label="Browse files" style={{ position: 'absolute', right: 7, top: '50%', transform: 'translateY(-50%)' }}>
                          <button
                            type="button"
                            aria-label="Browse files"
                            onClick={() => setShowFileBrowser(true)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 5, display: 'flex', color: 'var(--text-muted)', transition: 'color 0.13s' }}
                            onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent)' }}
                            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)' }}
                          >
                            <Folder size={14} />
                          </button>
                        </Tooltip>
                        {urlCheck && urlCheck !== 'checking' && (
                          <p className="mono" style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, fontSize: 10.5, margin: 0, lineHeight: 1.4, color: urlCheck.ok ? 'var(--running)' : 'var(--stopped)' }}>
                            {urlCheck.ok
                              ? [
                                  `HTTP ${urlCheck.status}`,
                                  urlCheck.content_length > 0 && fmtBytes(urlCheck.content_length),
                                  urlCheck.content_type && urlCheck.content_type.split(';')[0],
                                ].filter(Boolean).join(' · ')
                              : (urlCheck.error || `HTTP ${urlCheck.status}`)}
                            {urlCheck.ok && urlCheck.supported === false && (
                              <span style={{ color: 'var(--suspended)', marginLeft: 6 }}>— not a .img or .qcow2, may not work</span>
                            )}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

              </div>
            )}

            {/* ── RESOURCES ── */}
            {tab === 'resources' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div>
                  <p className="section-label" style={{ marginBottom: 10 }}>Quick templates</p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8 }}>
                    {quickTemplates.map(tpl => (
                      <TemplateCard
                        key={tpl.id}
                        tpl={tpl}
                        active={activeTemplateId === tpl.id}
                        onSelect={applyTemplate}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <p className="section-label" style={{ marginBottom: 10 }}>Personal templates</p>
                  {personalTemplates.length > 0 ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8 }}>
                      {personalTemplates.map(tpl => (
                        <TemplateCard
                          key={tpl.id}
                          tpl={tpl}
                          active={activeTemplateId === tpl.id}
                          onSelect={applyTemplate}
                          onDelete={handleDeleteTemplate}
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="mono" style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>
                      No personal templates yet.
                    </p>
                  )}
                </div>

                <div style={{ borderTop: '1px solid var(--border)', marginTop: 6, paddingTop: 16 }}>
                  {!showCreateTemplate ? (
                    <button
                      type="button"
                      onClick={() => {
                        setNewTemplate({
                          name: '',
                          description: '',
                          cpus: Math.max(1, form.cpus),
                          memory_mb: Math.max(512, form.memory),
                          disk_gb: Math.max(5, form.disk),
                          image: form.image === 'custom' ? 'custom' : form.image,
                          custom_image: form.image === 'custom' ? form.customImage : '',
                        })
                        setShowCreateTemplate(true)
                      }}
                      className="btn-ghost"
                    >
                      <Bookmark size={12} /> Create personal template
                    </button>
                  ) : (
                    <div>
                      <p className="input-label" style={{ marginBottom: 10 }}>Create personal template</p>
                      <div className="new-instance-template-fields" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10, marginBottom: 10 }}>
                        <input
                          className="input"
                          autoFocus
                          value={newTemplate.name}
                          onChange={e => setNewTemplate(t => ({ ...t, name: e.target.value }))}
                          placeholder="Template name"
                        />
                        <input
                          className="input"
                          value={newTemplate.description}
                          onChange={e => setNewTemplate(t => ({ ...t, description: e.target.value }))}
                          placeholder="Description (optional)"
                        />
                        <div>
                          <label className="input-label" htmlFor="tpl-image">Image</label>
                          <CustomSelect
                            id="tpl-image"
                            value={newTemplate.image}
                            onChange={v => setNewTemplate(t => ({
                              ...t,
                              image: v,
                              custom_image: v === 'custom' ? t.custom_image : '',
                            }))}
                            options={imageOptions}
                            searchable
                            controlHeight={37}
                          />
                        </div>
                        {newTemplate.image === 'custom' ? (
                          <div>
                            <label className="input-label" htmlFor="template-custom-image">Custom image path / URL</label>
                            <input
                              id="template-custom-image"
                              className="input"
                              value={newTemplate.custom_image}
                              onChange={e => setNewTemplate(t => ({ ...t, custom_image: e.target.value }))}
                              placeholder="/path/to/image.img or https://…"
                            />
                          </div>
                        ) : (
                          <div />
                        )}
                        <TemplateStepperField
                          label="CPUs"
                          value={newTemplate.cpus}
                          min={1}
                          max={maxCpus}
                          step={1}
                          onChange={(cpus) => setNewTemplate(t => ({ ...t, cpus }))}
                        />
                        <TemplateStepperField
                          label="RAM (MB)"
                          value={newTemplate.memory_mb}
                          min={512}
                          max={maxRamStep}
                          step={512}
                          onChange={(memory_mb) => setNewTemplate(t => ({ ...t, memory_mb }))}
                        />
                        <TemplateStepperField
                          label="Disk (GB)"
                          value={newTemplate.disk_gb}
                          min={5}
                          max={maxDiskGb}
                          step={5}
                          onChange={(disk_gb) => setNewTemplate(t => ({ ...t, disk_gb }))}
                        />
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button type="button" className="btn-ghost" onClick={() => setShowCreateTemplate(false)}>Cancel</button>
                        <button type="button" className="btn-accent" onClick={handleSaveTemplate} disabled={!newTemplate.name.trim()}>
                          <Bookmark size={12} /> Save template
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── NETWORKING ── */}
            {tab === 'networking' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, lineHeight: 1, marginBottom: 4 }}>LAN access</p>
                    <p style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1, margin: 0 }}>Bridge instance to host network</p>
                  </div>
                  <IOSToggle checked={form.bridged} onChange={v => set('bridged', v)} />
                </div>

                {availableNetworks.length > 0 ? (
                  <div>
                    <label className="input-label" style={{ marginBottom: 8, display: 'block' }}>
                      Additional Networks
                      {form.networks.length > 0 && (
                        <span className="mono" style={{ marginLeft: 7, fontSize: 10, color: 'var(--accent)', fontWeight: 700 }}>
                          {form.networks.length} selected
                        </span>
                      )}
                    </label>
                    <CustomSelect
                      multi
                      value={form.networks}
                      onChange={v => set('networks', v)}
                      options={availableNetworks.map(n => ({
                        value: n.name,
                        label: n.name,
                        ...(n.type ? { tag: n.type } : {}),
                      }))}
                      searchable={availableNetworks.length >= 5}
                      placeholder="Select networks…"
                    />
                  </div>
                ) : (
                  <p className="mono" style={{ fontSize: 12, color: 'var(--text-muted)' }}>No additional networks available</p>
                )}
              </div>
            )}

            {/* ── ADVANCED ── */}
            {tab === 'advanced' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div>
                  <label className="input-label" htmlFor="new-instance-timeout" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Clock size={11} /> Launch Timeout (seconds)
                  </label>
                  <input id="new-instance-timeout" type="number" className="input" value={form.timeout} min={60} max={3600}
                    onChange={e => set('timeout', Number(e.target.value))} style={{ maxWidth: 200 }} />
                </div>

                <div>
                  <p className="input-label" style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 10 }}>
                    <FileCode size={11} /> Cloud-init config (YAML)
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                    {CLOUD_INIT_PRESETS.map(({ id, label, imgSrc, yaml }) => {
                      const selected = form.cloudInit.trim() === yaml.trim()
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => {
                            if (form.cloudInit.trim() && !selected) { setConfirmPreset({ label, yaml }); return }
                            set('cloudInit', selected ? '' : yaml)
                          }}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 10,
                            padding: '10px 18px', borderRadius: 'var(--r-sm)', cursor: 'pointer',
                            background: selected ? 'var(--accent-dim)' : 'var(--card-2)',
                            border: `1px solid ${selected ? 'var(--accent-border)' : 'var(--border)'}`,
                            color: selected ? 'var(--accent)' : 'var(--text-secondary)',
                            fontSize: 13.5, fontFamily: 'Syne', fontWeight: 600,
                            transition: 'border-color 0.13s, color 0.13s, background 0.13s',
                          }}
                          onMouseEnter={e => { if (!selected) { e.currentTarget.style.borderColor = 'var(--border-hover)'; e.currentTarget.style.color = 'var(--text-primary)' } }}
                          onMouseLeave={e => { if (!selected) { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)' } }}
                        >
                          <img src={imgSrc} alt="" aria-hidden="true" style={{ width: 20, height: 20, objectFit: 'contain', flexShrink: 0 }} />
                          {label}
                        </button>
                      )
                    })}
                  </div>
                  <YamlEditor value={form.cloudInit} onChange={v => set('cloudInit', v)} minHeight={280} />
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <p className="input-label" style={{ margin: 0 }}>Mount Directories</p>
                    <button type="button" className="btn-ghost" style={{ padding: '4px 10px', fontSize: 11 }} onClick={addMount}>
                      <Plus size={11} /> Add
                    </button>
                  </div>
                  {form.mounts.length === 0 && (
                    <p className="mono" style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>No mounts configured</p>
                  )}
                  {form.mounts.map((m, i) => (
                    <div key={m.host || `mount-${i}`} className="new-instance-mount-row" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr) auto', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                      <div style={{ position: 'relative' }}>
                        <input className="input" placeholder="/host/path" value={m.host} onChange={e => updateMount(i, 'host', e.target.value)} style={{ paddingRight: 34 }} />
                        <Tooltip label="Browse directories" style={{ position: 'absolute', right: 7, top: '50%', transform: 'translateY(-50%)' }}>
                          <button
                            type="button"
                            aria-label="Browse directories"
                            onClick={() => setShowMountBrowser(i)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 5, display: 'flex', color: 'var(--text-muted)', transition: 'color 0.13s' }}
                            onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent)' }}
                            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)' }}
                          >
                            <Folder size={14} />
                          </button>
                        </Tooltip>
                      </div>
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
              </div>
            )}

          </form>
        </div>

        {/* ── Right: Preview ── */}
        <PreviewPanel form={form} activeTemplate={activeTemplate} />
      </div>

      {showFileBrowser && (
        <FileBrowserModal
          onSelect={p => { set('customImage', p); setShowFileBrowser(false) }}
          onClose={() => setShowFileBrowser(false)}
        />
      )}

      {showMountBrowser !== null && (
        <FileBrowserModal
          mode="dir"
          onSelect={p => { updateMount(showMountBrowser, 'host', p); setShowMountBrowser(null) }}
          onClose={() => setShowMountBrowser(null)}
        />
      )}

      {confirmPreset && (
        <Modal
          title="Replace cloud-init config?"
          size="sm"
          onClose={() => setConfirmPreset(null)}
          footer={
            <>
              <button className="btn-ghost" onClick={() => setConfirmPreset(null)}>Cancel</button>
              <button className="btn-accent" onClick={() => { set('cloudInit', confirmPreset.yaml); setConfirmPreset(null) }}>
                Replace
              </button>
            </>
          }
        >
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
            Replace the current cloud-init config with the <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>"{confirmPreset.label}"</span> preset?
          </p>
        </Modal>
      )}

      {launchPayload && (
        <LaunchModal payload={launchPayload} onClose={() => setLaunchPayload(null)} />
      )}
    </div>
  )
}
