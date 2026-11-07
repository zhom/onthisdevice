/** Structural JSON diff: every added, removed and changed value with its path, plus an RFC 6902 JSON Patch. */

export interface Change {
  kind: 'added' | 'removed' | 'changed'
  path: string
  pointer: string
  before?: unknown
  after?: unknown
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const seg = (k: string | number) => (typeof k === 'number' ? `[${k}]` : /^[A-Za-z_$][\w$]*$/.test(k) ? `.${k}` : `[${JSON.stringify(k)}]`)
const ptr = (k: string | number) => `/${String(k).replace(/~/g, '~0').replace(/\//g, '~1')}`

export function diffJson(a: unknown, b: unknown, path = '$', pointer = ''): Change[] {
  if (Array.isArray(a) && Array.isArray(b)) {
    const out: Change[] = []
    const n = Math.max(a.length, b.length)
    for (let i = 0; i < n; i++) {
      if (i >= b.length) out.push({ kind: 'removed', path: path + seg(i), pointer: pointer + ptr(i), before: a[i] })
      else if (i >= a.length) out.push({ kind: 'added', path: path + seg(i), pointer: pointer + ptr(i), after: b[i] })
      else out.push(...diffJson(a[i], b[i], path + seg(i), pointer + ptr(i)))
    }
    return out
  }
  if (isObj(a) && isObj(b)) {
    const out: Change[] = []
    for (const k of Object.keys(a)) {
      if (!Object.hasOwn(b, k)) out.push({ kind: 'removed', path: path + seg(k), pointer: pointer + ptr(k), before: a[k] })
      else out.push(...diffJson(a[k], b[k], path + seg(k), pointer + ptr(k)))
    }
    for (const k of Object.keys(b)) if (!Object.hasOwn(a, k)) out.push({ kind: 'added', path: path + seg(k), pointer: pointer + ptr(k), after: b[k] })
    return out
  }
  return JSON.stringify(a) === JSON.stringify(b) ? [] : [{ kind: 'changed', path, pointer, before: a, after: b }]
}

/** A JSON Patch that turns the first document into the second. Array removals run from the end so indexes stay valid. */
export function toPatch(changes: Change[]): unknown[] {
  const removes = changes.filter((c) => c.kind === 'removed').reverse()
  return [
    ...changes.filter((c) => c.kind === 'changed').map((c) => ({ op: 'replace', path: c.pointer, value: c.after })),
    ...removes.map((c) => ({ op: 'remove', path: c.pointer })),
    ...changes.filter((c) => c.kind === 'added').map((c) => ({ op: 'add', path: c.pointer, value: c.after })),
  ]
}

export const short = (v: unknown) => {
  const s = JSON.stringify(v)
  return s === undefined ? 'undefined' : s.length > 80 ? `${s.slice(0, 77)}...` : s
}
