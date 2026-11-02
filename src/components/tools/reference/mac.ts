/** MAC address parsing and vendor lookup (pure, unit-tested in scripts/data/test.mjs). */

export interface Mac {
  /** Upper-case hex digits, 6 to 12 of them (a prefix or a full address). */
  hex: string
  /** I/G bit: the address is a group (multicast) address. */
  multicast: boolean
  /** U/L bit: the address is locally administered (random or set by software). */
  local: boolean
}

/** Accepts 00:1A:2B:3C:4D:5E, 00-1a-2b-..., 001A.2B3C.4D5E, 001a2b3c4d5e and prefixes (00:1A:2B). */
export function parseMac(text: string): Mac | null {
  const t = text.trim()
  if (!t) return null
  if (!/^[0-9a-fA-F:.\-\s]+$/.test(t)) return null
  const hex = t.replace(/[:.\-\s]/g, '').toUpperCase()
  if (hex.length < 6 || hex.length > 12) return null
  // Separated forms must use whole groups (1-2 digits per byte with ':' or '-', 4 with '.').
  if (/[:-]/.test(t) && !t.split(/[:-]/).every((g) => /^[0-9a-fA-F]{1,2}$/.test(g.trim()))) return null
  if (t.includes('.') && !t.split('.').every((g) => /^[0-9a-fA-F]{4}$/.test(g))) return null
  const full = /[:-]/.test(t)
    ? t
        .split(/[:-]/)
        .map((g) => g.trim().padStart(2, '0'))
        .join('')
        .toUpperCase()
    : hex
  const first = parseInt(full.slice(0, 2), 16)
  return { hex: full, multicast: (first & 1) === 1, local: (first & 2) === 2 }
}

/** Shard file name (first byte) and the prefixes to try, longest first. */
export function candidates(mac: Mac): { shard: string; prefixes: string[] } {
  const prefixes = [9, 7, 6].filter((n) => mac.hex.length >= n).map((n) => mac.hex.slice(0, n))
  return { shard: mac.hex.slice(0, 2), prefixes }
}

export function blockName(prefixLength: number): string {
  return prefixLength === 9 ? 'MA-S (36-bit)' : prefixLength === 7 ? 'MA-M (28-bit)' : 'MA-L (24-bit, OUI)'
}

export function formatMac(hex: string): string {
  return hex.match(/.{1,2}/g)?.join(':') ?? hex
}

export function macBits(hex: string): number[] {
  const out: number[] = []
  for (const ch of hex.padEnd(12, '0')) {
    const v = parseInt(ch, 16)
    for (let b = 3; b >= 0; b--) out.push((v >> b) & 1)
  }
  return out
}
