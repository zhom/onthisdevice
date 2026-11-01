import * as React from 'react'
import { Toaster as Sonner } from 'sonner'

type ToasterProps = React.ComponentProps<typeof Sonner>

/**
 * Reads the active theme straight off `<html class="dark">` — this project has
 * no next-themes provider — and keeps it in sync if the class is toggled.
 */
function useDocumentTheme(): 'light' | 'dark' {
  const [theme, setTheme] = React.useState<'light' | 'dark'>('light')

  React.useEffect(() => {
    const root = document.documentElement
    const read = () => setTheme(root.classList.contains('dark') ? 'dark' : 'light')

    read()

    const observer = new MutationObserver(read)
    observer.observe(root, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  return theme
}

function Toaster({ ...props }: ToasterProps) {
  const theme = useDocumentTheme()

  return (
    <Sonner
      theme={theme}
      className="toaster group"
      position="bottom-right"
      richColors={false}
      closeButton
      toastOptions={{
        // Sonner injects its own CSS outside the Tailwind layers, so the
        // properties it sets (shadow, radius, button fills) need "!" to win.
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-popover group-[.toaster]:text-popover-foreground group-[.toaster]:border-0! group-[.toaster]:shadow-pop! group-[.toaster]:rounded-lg!',
          description: 'group-[.toast]:text-muted-foreground',
          actionButton:
            'group-[.toast]:bg-primary! group-[.toast]:text-primary-foreground! group-[.toast]:rounded-md!',
          cancelButton:
            'group-[.toast]:bg-muted! dark:group-[.toast]:bg-background! group-[.toast]:text-foreground! group-[.toast]:rounded-md!',
          closeButton:
            'group-[.toast]:bg-popover! group-[.toast]:text-muted-foreground! hover:group-[.toast]:text-foreground! group-[.toast]:border-0! group-[.toast]:shadow-pop!',
          // Status is ink. Sonner's own icon shows the type.
          error: 'group-[.toaster]:text-foreground',
          success: 'group-[.toaster]:text-foreground',
          warning: 'group-[.toaster]:text-foreground',
        },
      }}
      style={
        {
          '--border-radius': 'calc(var(--radius) + 2px)',
          '--normal-bg': 'var(--popover)',
          '--normal-text': 'var(--foreground)',
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
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
