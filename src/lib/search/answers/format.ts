/** Rounds to `sig` significant digits; never returns -0. */
function round(n: number, sig: number): number {
  const r = Number(n.toPrecision(sig))
  return r === 0 ? 0 : r
}

/** Plain digits for the clipboard: "1234.5", "1e-7". */
export function plain(n: number, sig = 12): string {
  return String(round(n, sig))
}

/** Adds thousands separators to a plain number string: "1234567.5" -> "1,234,567.5". */
export function group(s: string): string {
  if (s.includes('e')) return s
  const dot = s.indexOf('.')
  const int = dot < 0 ? s : s.slice(0, dot)
  return int.replace(/\B(?=(\d{3})+$)/g, ',') + (dot < 0 ? '' : s.slice(dot))
}

/** Display form: "1,234.5". */
export function grouped(n: number, sig = 12): string {
  return group(plain(n, sig))
}

/** "1 day", "56 days". */
export function count(n: number, word: string): string {
  return `${group(String(n))} ${word}${n === 1 ? '' : 's'}`
}
