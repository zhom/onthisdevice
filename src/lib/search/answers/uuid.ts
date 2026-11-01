import type { Answer } from './types'

const PATTERN = /^(?:(?:generate|new|random|create|make|get)(?: an?)? )?(?:random )?(?:uuid|guid)(?: ?v?4)?(?: generator)?$/

function randomUuid(): string {
  const c = globalThis.crypto
  if (typeof c.randomUUID === 'function') return c.randomUUID()
  const b = c.getRandomValues(new Uint8Array(16))
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

/** "uuid", "guid", "uuid v4", "generate uuid": a new random v4 UUID. */
export function uuidAnswer(s: string): Answer | null {
  if (!PATTERN.test(s)) return null
  const id = randomUuid()
  return { kind: 'uuid', value: id, label: 'Random UUID v4', copy: id, slug: 'uuid-generator' }
}
