import { createRoot } from 'react-dom/client'
import { DropOverlay } from './DropOverlay'

/** Loaded on the first file drag or paste (see runtime-client.ts); mounts the drop screen once. */
if (!document.getElementById('otd-drop')) {
  const host = document.createElement('div')
  host.id = 'otd-drop'
  document.body.appendChild(host)
  createRoot(host).render(<DropOverlay />)
}

export { dragLeave, dragOver, drop } from './drop-store'
