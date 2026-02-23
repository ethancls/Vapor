import { createContext, useContext, useEffect, useState } from 'react'

const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('vapor-theme') || 'dark' } catch { return 'dark' }
  })

  useEffect(() => {
    function apply(t) {
      const resolved = t === 'system'
        ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
        : t
      document.documentElement.setAttribute('data-theme', resolved)
      document.documentElement.style.colorScheme = resolved

      let themeColorMeta = document.querySelector('meta[name="theme-color"]')
      if (!themeColorMeta) {
        themeColorMeta = document.createElement('meta')
        themeColorMeta.setAttribute('name', 'theme-color')
        document.head.appendChild(themeColorMeta)
      }
      themeColorMeta.setAttribute('content', resolved === 'dark' ? '#0a0a0a' : '#f7f8fb')
    }
    apply(theme)
    try { localStorage.setItem('vapor-theme', theme) } catch {}

    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      const fn = () => apply('system')
      mq.addEventListener('change', fn)
      return () => mq.removeEventListener('change', fn)
    }
  }, [theme])

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
