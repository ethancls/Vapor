import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Clipboard, ExternalLink, Play, Terminal, TriangleAlert } from 'lucide-react'
import { sileo } from 'sileo'
import { api } from '../api/client'
import Modal from './Modal'
import ResourceActionButton from './ResourceActionButton'

function copyCommand(command) {
  navigator.clipboard?.writeText(command)
  sileo.success({ title: 'Copied command' })
}

function CommandRow({ command, label }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '10px 12px',
      background: 'var(--card-2)',
      border: '1px solid var(--border)',
      borderRadius: 10,
    }}>
      <Terminal size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <p className="section-label" style={{ margin: '0 0 4px' }}>{label}</p>
        <code className="mono" style={{ color: 'var(--text-primary)', fontSize: 12, overflowWrap: 'anywhere' }}>{command}</code>
      </div>
      <ResourceActionButton icon={<Clipboard size={14} />} label="Copy command" color="var(--accent)" onClick={() => copyCommand(command)} />
    </div>
  )
}

export default function ContainerSystemNotice() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['container-system'],
    queryFn: () => api.getContainerSystem(),
    staleTime: 10000,
    refetchInterval: 15000,
    retry: false,
  })

  if (isLoading) return null
  const system = data?.system
  if (!system || system.running) return null

  async function startSystem() {
    const promise = api.ensureContainerSystem().then(() => {
      qc.invalidateQueries({ queryKey: ['container-system'] })
      qc.invalidateQueries({ queryKey: ['containers'] })
      qc.invalidateQueries({ queryKey: ['instances'] })
    })
    sileo.promise(promise, {
      loading: { title: 'Starting Apple Container system...' },
      success: { title: 'Apple Container system started' },
      error: (err) => ({ title: err.message }),
    })
    await promise
  }

  return (
    <Modal
      title={system.installed ? 'Start Apple Container' : 'Install Apple Container'}
      size="xl"
      onClose={() => {}}
      closeOnEsc={false}
      closeOnOverlay={false}
      showClose={false}
    >
      <div style={{ display: 'grid', gap: 18 }}>
        <div style={{
          display: 'flex',
          gap: 12,
          alignItems: 'flex-start',
          padding: 16,
          background: 'linear-gradient(135deg, rgba(64,73,235,0.16), rgba(228,64,200,0.14))',
          border: '1px solid var(--accent-border)',
          borderRadius: 12,
        }}>
          <TriangleAlert size={22} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 1 }} />
          <div>
            <p style={{ margin: 0, color: 'var(--text-primary)', fontWeight: 800 }}>
              Eve needs Apple Container to manage containers and machines.
            </p>
            <p className="mono" style={{ margin: '8px 0 0', color: 'var(--text-secondary)', fontSize: 12, lineHeight: 1.55 }}>
              {system.installed
                ? (system.error || 'The CLI is installed, but the local container services are not running.')
                : 'The `container` CLI was not found in PATH. Installation uses Apple’s package installer and may ask for an administrator password.'}
            </p>
          </div>
        </div>

        {!system.installed ? (
          <>
            <div style={{ display: 'grid', gap: 10 }}>
              <CommandRow label="Install with Homebrew" command="brew install container" />
              <CommandRow label="Or open official releases" command="open https://github.com/apple/container/releases" />
              <CommandRow label="After installing, start services" command="container system start" />
              <CommandRow label="Verify status" command="container system status" />
            </div>
            <a
              className="btn-accent"
              href="https://github.com/apple/container/releases"
              target="_blank"
              rel="noreferrer"
              style={{ justifySelf: 'start', textDecoration: 'none' }}
            >
              <ExternalLink size={14} /> Open Apple Container releases
            </a>
          </>
        ) : (
          <>
            <div style={{ display: 'grid', gap: 10 }}>
              <CommandRow label="Start services" command="container system start" />
              <CommandRow label="Verify status" command="container system status" />
              <CommandRow label="Show version" command="container system version" />
              <CommandRow label="Fix Homebrew plugin path" command={'mkdir -p /opt/homebrew/libexec/container && ln -sfn /opt/homebrew/opt/container/libexec/container-plugins /opt/homebrew/libexec/container/plugins'} />
              <CommandRow label="Pin Homebrew install root" command={'mkdir -p "$HOME/Library/Application Support/com.apple.container/config" && printf \'install-root = "/opt/homebrew"\\n\' > "$HOME/Library/Application Support/com.apple.container/config/config.toml"'} />
              <CommandRow label="Full uninstall with data removal" command="/usr/local/bin/uninstall-container.sh -d" />
              <CommandRow label="Reinstall with Homebrew" command="brew reinstall container" />
            </div>
            <button className="btn-accent" type="button" onClick={startSystem} style={{ justifySelf: 'start' }}>
              <Play size={14} /> Start from Eve
            </button>
          </>
        )}
      </div>
    </Modal>
  )
}
