import { useEffect, useState, type CSSProperties } from 'react'
import { Toaster as SonnerToaster } from 'sonner'

/**
 * Sonner, wired to the site's class-based dark mode. Sonner's own `system`
 * theme reads `prefers-color-scheme`, which would disagree with an explicit
 * light/dark choice, so the `dark` class on <html> is mirrored instead.
 */
export default function Toaster() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light')

  useEffect(() => {
    const root = document.documentElement
    const sync = () => setTheme(root.classList.contains('dark') ? 'dark' : 'light')
    sync()
    const observer = new MutationObserver(sync)
    observer.observe(root, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  return (
    <SonnerToaster
      theme={theme}
      position="bottom-right"
      closeButton
      gap={10}
      toastOptions={{
        classNames: {
          toast: 'group rounded-lg border-0 bg-popover text-popover-foreground shadow-pop font-sans',
          title: 'font-[620]',
          description: 'text-muted-foreground',
          actionButton: 'bg-primary text-primary-foreground',
          cancelButton: 'bg-muted text-foreground',
          closeButton: 'border-0 bg-popover text-muted-foreground shadow-pop',
          icon: 'text-foreground',
        },
      }}
      style={
        {
          '--normal-bg': 'var(--popover)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'transparent',
          '--success-bg': 'var(--popover)',
          '--success-text': 'var(--foreground)',
          '--success-border': 'transparent',
          '--error-bg': 'var(--popover)',
          '--error-text': 'var(--foreground)',
          '--error-border': 'transparent',
          '--warning-bg': 'var(--popover)',
          '--warning-text': 'var(--foreground)',
          '--warning-border': 'transparent',
          '--info-bg': 'var(--popover)',
          '--info-text': 'var(--foreground)',
          '--info-border': 'transparent',
        } as CSSProperties
      }
    />
  )
}
