import { useEffect, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { authLogin, authOIDCConfig } from '../api/client'
import Tooltip from '../components/Tooltip'

export default function LoginPage({ onLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [oidcEnabled, setOIDCEnabled] = useState(false)
  const [localPasswordEnabled, setLocalPasswordEnabled] = useState(true)
  const [oidcLoading, setOIDCLoading] = useState(true)

  useEffect(() => {
    const oidcError = typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('auth_error') || ''
      : ''
    if (oidcError) {
      setError(oidcError)
      window.history.replaceState({}, '', window.location.pathname)
    }
    let cancelled = false
    authOIDCConfig()
      .then((cfg) => {
        if (!cancelled) {
          setOIDCEnabled(Boolean(cfg?.enabled))
          setLocalPasswordEnabled(cfg?.local_password_enabled !== false)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setOIDCEnabled(false)
          setLocalPasswordEnabled(true)
        }
      })
      .finally(() => {
        if (!cancelled) setOIDCLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!localPasswordEnabled) return
    setError('')
    setLoading(true)
    try {
      await authLogin(username, password)
      onLogin()
    } catch (err) {
      setError(err?.message || 'Connection failed — is the server running?')
    } finally {
      setLoading(false)
    }
  }

  function handleOIDCLogin() {
    if (typeof window !== 'undefined') {
      window.location.assign('/auth/oidc/start')
    }
  }

  return (
    <div className="login-page">
      <div style={{
        width: 'min(360px, calc(100vw - 32px))',
        display: 'flex', flexDirection: 'column', gap: 24,
        position: 'relative',
        zIndex: 1,
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <img src="/vapor.png" width={52} height={52} alt="Vapor" />
          <p style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 24, color: 'var(--text-primary)', margin: 0 }}>
            Vapor
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {localPasswordEnabled ? (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label htmlFor="login-username" style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Username
                </label>
                <input
                  id="login-username"
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  autoComplete="username"
                  autoFocus
                  required
                  style={{
                    background: 'var(--card-2)', border: '1px solid var(--border)',
                    borderRadius: 10, padding: '10px 14px',
                    color: 'var(--text-primary)', fontSize: 14,
                    outline: 'none', fontFamily: 'inherit',
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label htmlFor="login-password" style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Password
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                    style={{
                      width: '100%',
                      background: 'var(--card-2)', border: '1px solid var(--border)',
                      borderRadius: 10, padding: '10px 38px 10px 14px',
                      color: 'var(--text-primary)', fontSize: 14,
                      outline: 'none', fontFamily: 'inherit',
                    }}
                  />
                  <Tooltip
                    label={showPassword ? 'Hide password' : 'Show password'}
                    style={{
                      position: 'absolute',
                      right: 10,
                      top: '50%',
                      transform: 'translateY(-50%)',
                    }}
                  >
                    <button
                      type="button"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      onClick={() => setShowPassword((v) => !v)}
                      style={{
                        border: 'none',
                        background: 'none',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                        padding: 0,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </Tooltip>
                </div>
              </div>
            </>
          ) : (
            <p className="mono" style={{ fontSize: 12.5, color: 'var(--text-secondary)', margin: 0, textAlign: 'center' }}>
              Password login is disabled.
            </p>
          )}

          {error && (
            <p style={{ fontSize: 13, color: '#ff4444', margin: 0, textAlign: 'center' }}>{error}</p>
          )}

          {localPasswordEnabled && (
            <button
              type="submit"
              disabled={loading}
              className="btn-accent"
              style={{ justifyContent: 'center', marginTop: 4, opacity: loading ? 0.7 : 1 }}
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          )}

          {!oidcLoading && oidcEnabled && (
            <button
              type="button"
              className="btn-ghost"
              style={{ justifyContent: 'center', gap: 8 }}
              onClick={handleOIDCLogin}
            >
              <img src="/images/openid.png" alt="" aria-hidden="true" style={{ width: 16, height: 16, objectFit: 'contain' }} />
              Sign in with OIDC
            </button>
          )}
        </form>
      </div>
    </div>
  )
}
