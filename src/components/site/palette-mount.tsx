import { createRoot } from 'react-dom/client'
import CommandPalette from './CommandPalette.tsx'

/** Mounts the search screen the first time someone asks for it. */
export function mount(): void {
  if (document.getElementById('otd-palette')) return
  const host = document.createElement('div')
  host.id = 'otd-palette'
  document.body.appendChild(host)
  createRoot(host).render(<CommandPalette />)
}
