import { useState, useRef, useEffect } from 'react'
import { Trash2 } from 'lucide-react'
import { api } from '../../api/client'

const WELCOME = `Vapor Shell  —  multipass exec\nEach command runs with the tracked working directory.\nUse ↑ / ↓ to navigate history.\n`

export default function ShellPanel({ name, isRunning }) {
  const [lines, setLines]         = useState([{ type: 'info', text: WELCOME }])
  const [input, setInput]         = useState('')
  const [busy, setBusy]           = useState(false)
  const [cwd, setCwd]             = useState('/home/ubuntu')
  const [cmdHistory, setCmdHistory] = useState([])
  const [histIdx, setHistIdx]     = useState(-1)
  const bottomRef = useRef(null)
  const inputRef  = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [lines])

  function push(...newLines) {
    setLines(prev => [...prev, ...newLines])
  }

  async function submit(e) {
    e?.preventDefault()
    const cmd = input.trim()
    if (!cmd || busy) return
    setInput('')
    setHistIdx(-1)
    setCmdHistory(prev => [cmd, ...prev.slice(0, 99)])
    push({ type: 'prompt', text: cmd, cwd })
    setBusy(true)
    try {
      // Wrap to capture new cwd after command
      const wrapped = `${cmd}; __vc_ec=$?; printf '\\n__VAPOR_CWD:%s\\n' "$(pwd)"; exit $__vc_ec`
      const res = await api.execInstance(name, ['/bin/bash', '-c', wrapped], { working_directory: cwd })
      let stdout = res.stdout || ''
      const cwdMatch = stdout.match(/__VAPOR_CWD:(.+?)(?:\r?\n|$)/)
      if (cwdMatch) {
        setCwd(cwdMatch[1].trim())
        stdout = stdout.replace(/\n?__VAPOR_CWD:.*(?:\r?\n|$)/, '')
      }
      if (stdout.trim())      push({ type: 'stdout',   text: stdout })
      if (res.stderr?.trim()) push({ type: 'stderr',   text: res.stderr })
      if (res.exit_code !== 0) push({ type: 'exitcode', text: res.exit_code })
    } catch (err) {
      push({ type: 'error', text: err.message })
    } finally {
      setBusy(false)
      inputRef.current?.focus()
    }
  }

  function onKeyDown(e) {
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      const next = histIdx + 1
      if (next < cmdHistory.length) { setHistIdx(next); setInput(cmdHistory[next]) }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      const next = histIdx - 1
      if (next < 0) { setHistIdx(-1); setInput('') }
      else { setHistIdx(next); setInput(cmdHistory[next]) }
    }
  }

  if (!isRunning) {
    return (
      <div style={{
        background: 'var(--card-1)', border: '1px solid var(--border)',
        borderRadius: 14, padding: '40px 24px', textAlign: 'center',
      }}>
        <p className="mono" style={{ fontSize: 13, color: 'var(--stopped)', marginBottom: 8 }}>
          Instance is not running
        </p>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          Start the instance to access its shell.
        </p>
      </div>
    )
  }

  const shortCwd = cwd.replace('/home/ubuntu', '~')
  const prompt   = `ubuntu@${name}:${shortCwd}$`

  return (
    <div style={{ background: '#0c0c0c', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>

      {/* ── Title bar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: '#141414',
      }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <div style={{ width: 11, height: 11, borderRadius: '50%', background: '#ff5f57' }} />
          <div style={{ width: 11, height: 11, borderRadius: '50%', background: '#febc2e' }} />
          <div style={{ width: 11, height: 11, borderRadius: '50%', background: '#28c840' }} />
        </div>
        <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          {name} — bash
        </span>
        <button
          onClick={() => { setLines([{ type: 'info', text: WELCOME }]); setCwd('/home/ubuntu') }}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', padding: '2px 6px', borderRadius: 5,
            display: 'flex', alignItems: 'center', gap: 5,
            fontSize: 11, fontFamily: 'Syne', transition: 'color 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-secondary)' }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)' }}
        >
          <Trash2 size={11} /> Clear
        </button>
      </div>

      {/* ── Output ── */}
      <div
        onClick={() => inputRef.current?.focus()}
        className="no-scrollbar"
        style={{
          height: 440, overflowY: 'auto',
          padding: '14px 18px', cursor: 'text',
          fontFamily: 'IBM Plex Mono', fontSize: 13, lineHeight: 1.7,
        }}
      >
        {lines.map((line, i) => {
          if (line.type === 'info') return (
            <pre key={i} style={{ margin: 0, color: '#4a4a4a', fontSize: 11.5, whiteSpace: 'pre-wrap' }}>
              {line.text}
            </pre>
          )
          if (line.type === 'prompt') return (
            <div key={i} style={{ marginTop: i > 0 ? 4 : 0 }}>
              <span style={{ color: '#b5f23d', userSelect: 'none' }}>
                ubuntu@{name}:{line.cwd.replace('/home/ubuntu', '~')}${' '}
              </span>
              <span style={{ color: '#efefef' }}>{line.text}</span>
            </div>
          )
          if (line.type === 'stdout') return (
            <pre key={i} style={{ margin: 0, color: '#d4d4d4', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
              {line.text}
            </pre>
          )
          if (line.type === 'stderr') return (
            <pre key={i} style={{ margin: 0, color: '#ff9f0a', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
              {line.text}
            </pre>
          )
          if (line.type === 'exitcode') return (
            <div key={i} style={{ fontSize: 11, color: '#f04747', opacity: 0.75 }}>
              [exit {line.text}]
            </div>
          )
          if (line.type === 'error') return (
            <div key={i} style={{ color: '#f04747' }}>error: {line.text}</div>
          )
          return null
        })}
        {busy && <span style={{ color: '#4a4a4a', fontSize: 11 }}>running…</span>}
        <div ref={bottomRef} />
      </div>

      {/* ── Input ── */}
      <form
        onSubmit={submit}
        style={{
          display: 'flex', alignItems: 'center',
          padding: '9px 18px', gap: 0,
          borderTop: '1px solid rgba(255,255,255,0.06)',
          background: '#0e0e0e',
        }}
      >
        <span style={{
          fontFamily: 'IBM Plex Mono', fontSize: 13,
          color: '#b5f23d', whiteSpace: 'nowrap', userSelect: 'none', marginRight: 8,
        }}>
          {prompt}&nbsp;
        </span>
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={busy}
          autoFocus
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          style={{
            flex: 1, background: 'none', border: 'none', outline: 'none',
            fontFamily: 'IBM Plex Mono', fontSize: 13,
            color: '#efefef', caretColor: '#b5f23d',
          }}
        />
      </form>
    </div>
  )
}
