/** Exact permutations and combinations with BigInt. Pure; the tests import it. */

export type CountKind = 'nPr' | 'nCr' | 'repPerm' | 'repComb'

export function factorial(n: number): bigint {
  return range(2, n)
}

/** Product of the whole numbers lo..hi, split in halves so the big multiplications stay balanced. */
function range(lo: number, hi: number): bigint {
  if (lo > hi) return 1n
  if (hi - lo < 16) {
    let p = 1n
    for (let i = lo; i <= hi; i++) p *= BigInt(i)
    return p
  }
  const mid = Math.floor((lo + hi) / 2)
  return range(lo, mid) * range(mid + 1, hi)
}

/** n! ÷ (n − r)!: ordered selections without repetition. */
export function nPr(n: number, r: number): bigint {
  if (r > n) return 0n
  return range(n - r + 1, n)
}

/** n! ÷ (r! (n − r)!): unordered selections without repetition. */
export function nCr(n: number, r: number): bigint {
  if (r > n) return 0n
  const k = Math.min(r, n - r)
  return range(n - k + 1, n) / range(1, k)
}

/** Count for each kind. Repetition: nʳ ordered, C(n + r − 1, r) unordered. */
export function count(kind: CountKind, n: number, r: number): bigint {
  switch (kind) {
    case 'nPr':
      return nPr(n, r)
    case 'nCr':
      return nCr(n, r)
    case 'repPerm':
      return BigInt(n) ** BigInt(r)
    case 'repComb':
      return n === 0 ? (r === 0 ? 1n : 0n) : nCr(n + r - 1, r)
  }
}

/** "2,598,960"; very long values keep every digit. */
export function groupBig(v: bigint): string {
  const s = v.toString()
  const head = s.length % 3 || 3
  const parts = [s.slice(0, head)]
  for (let i = head; i < s.length; i += 3) parts.push(s.slice(i, i + 3))
  return parts.join(',')
}

/** Mantissa and exponent of a BigInt for "1.234 × 10⁵⁶". */
export function bigSci(v: bigint, sig = 4): { mant: string; exp: number } {
  const s = v.toString()
  if (s.length <= sig) return { mant: s, exp: 0 }
  const head = s.slice(0, sig + 1)
  const rounded = Math.round(Number(head) / 10)
  let digits = String(rounded)
  let exp = s.length - 1
  if (digits.length > sig) {
    digits = digits.slice(0, sig)
    exp += 1
  }
  const mant = `${digits[0]}.${digits.slice(1)}`.replace(/\.?0+$/, '')
  return { mant, exp }
}

/**
 * List the first `limit` arrangements of r items from n labelled items, for
 * the animation. Items are 0-based indexes.
 */
export function arrangements(kind: CountKind, n: number, r: number, limit = 400): number[][] {
  const out: number[][] = []
  const cur: number[] = []
  const used = new Array<boolean>(n).fill(false)
  const ordered = kind === 'nPr' || kind === 'repPerm'
  const rep = kind === 'repPerm' || kind === 'repComb'
  const rec = (start: number) => {
    if (out.length >= limit) return
    if (cur.length === r) {
      out.push(cur.slice())
      return
    }
    for (let i = ordered ? 0 : start; i < n; i++) {
      if (!rep && used[i]) continue
      cur.push(i)
      used[i] = true
      rec(rep ? i : i + 1)
      used[i] = false
      cur.pop()
      if (out.length >= limit) return
    }
  }
  if (r >= 0 && r <= n + (rep ? 1000 : 0)) rec(0)
  return out
}
