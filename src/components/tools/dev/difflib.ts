/** Line-oriented Myers diff, plus unified-patch generation. */

export type OpType = 'equal' | 'insert' | 'delete'

export interface DiffOp {
  type: OpType
  /** 0-based index into the original lines, or -1 for an insertion. */
  aIndex: number
  /** 0-based index into the modified lines, or -1 for a deletion. */
  bIndex: number
}

export interface NormaliseOptions {
  ignoreLeadingWhitespace: boolean
  ignoreTrailingWhitespace: boolean
  collapseWhitespace: boolean
  ignoreCase: boolean
}

export function normaliseLine(line: string, options: NormaliseOptions): string {
  let value = line
  if (options.ignoreLeadingWhitespace) value = value.replace(/^[ \t]+/, '')
  if (options.ignoreTrailingWhitespace) value = value.replace(/[ \t]+$/, '')
  if (options.collapseWhitespace) value = value.replace(/[ \t]+/g, ' ')
  if (options.ignoreCase) value = value.toLowerCase()
  return value
}

/**
 * Classic O(ND) Myers diff with a recorded trace. Fast and exact for the
 * file sizes people paste into a browser (tens of thousands of lines).
 */
export function diffLines(a: string[], b: string[]): DiffOp[] {
  const n = a.length
  const m = b.length
  if (n === 0 && m === 0) return []

  const max = n + m
  const offset = max + 1
  const v = new Int32Array(2 * max + 3)
  const trace: Int32Array[] = []

  let dFinal = -1
  for (let d = 0; d <= max; d++) {
    trace.push(Int32Array.from(v))
    for (let k = -d; k <= d; k += 2) {
      let x: number
      if (k === -d || (k !== d && v[offset + k - 1] < v[offset + k + 1])) {
        x = v[offset + k + 1]
      } else {
        x = v[offset + k - 1] + 1
      }
      let y = x - k
      while (x < n && y < m && a[x] === b[y]) {
        x += 1
        y += 1
      }
      v[offset + k] = x
      if (x >= n && y >= m) {
        dFinal = d
        break
      }
    }
    if (dFinal >= 0) break
  }

  const ops: DiffOp[] = []
  let x = n
  let y = m

  for (let d = dFinal; d > 0; d--) {
    const vPrev = trace[d]
    const k = x - y
    let prevK: number
    if (k === -d || (k !== d && vPrev[offset + k - 1] < vPrev[offset + k + 1])) {
      prevK = k + 1
    } else {
      prevK = k - 1
    }
    const prevX = vPrev[offset + prevK]
    const prevY = prevX - prevK

    while (x > prevX && y > prevY) {
      x -= 1
      y -= 1
      ops.push({ type: 'equal', aIndex: x, bIndex: y })
    }
    if (x === prevX) {
      y -= 1
      ops.push({ type: 'insert', aIndex: -1, bIndex: y })
    } else {
      x -= 1
      ops.push({ type: 'delete', aIndex: x, bIndex: -1 })
    }
  }

  while (x > 0 && y > 0) {
    x -= 1
    y -= 1
    ops.push({ type: 'equal', aIndex: x, bIndex: y })
  }

  ops.reverse()
  return ops
}

export interface DiffStats {
  additions: number
  deletions: number
  unchanged: number
  similarity: number
}

export function statsOf(ops: DiffOp[]): DiffStats {
  let additions = 0
  let deletions = 0
  let unchanged = 0
  for (const op of ops) {
    if (op.type === 'insert') additions += 1
    else if (op.type === 'delete') deletions += 1
    else unchanged += 1
  }
  const total = additions + deletions + unchanged
  return {
    additions,
    deletions,
    unchanged,
    similarity: total === 0 ? 100 : (unchanged / total) * 100,
  }
}

/* ------------------------------------------------------------------ */
/* Split view rows                                                     */
/* ------------------------------------------------------------------ */

export interface SplitRow {
  left: { number: number; text: string } | null
  right: { number: number; text: string } | null
  type: 'equal' | 'replace' | 'insert' | 'delete'
}

export function toSplitRows(ops: DiffOp[], a: string[], b: string[]): SplitRow[] {
  const rows: SplitRow[] = []
  let pendingDeletes: DiffOp[] = []
  let pendingInserts: DiffOp[] = []

  const flush = () => {
    const count = Math.max(pendingDeletes.length, pendingInserts.length)
    for (let i = 0; i < count; i++) {
      const del = pendingDeletes[i]
      const ins = pendingInserts[i]
      rows.push({
        left: del ? { number: del.aIndex + 1, text: a[del.aIndex] } : null,
        right: ins ? { number: ins.bIndex + 1, text: b[ins.bIndex] } : null,
        type: del && ins ? 'replace' : del ? 'delete' : 'insert',
      })
    }
    pendingDeletes = []
    pendingInserts = []
  }

  for (const op of ops) {
    if (op.type === 'delete') pendingDeletes.push(op)
    else if (op.type === 'insert') pendingInserts.push(op)
    else {
      flush()
      rows.push({
        left: { number: op.aIndex + 1, text: a[op.aIndex] },
        right: { number: op.bIndex + 1, text: b[op.bIndex] },
        type: 'equal',
      })
    }
  }
  flush()
  return rows
}

/* ------------------------------------------------------------------ */
/* Unified patch                                                       */
/* ------------------------------------------------------------------ */

export interface UnifiedLine {
  type: OpType
  aNumber: number | null
  bNumber: number | null
  text: string
}

export interface Hunk {
  aStart: number
  aCount: number
  bStart: number
  bCount: number
  lines: UnifiedLine[]
}

export function toHunks(ops: DiffOp[], a: string[], b: string[], context: number): Hunk[] {
  const changed: number[] = []
  ops.forEach((op, index) => {
    if (op.type !== 'equal') changed.push(index)
  })
  if (changed.length === 0) return []

  const ranges: [number, number][] = []
  for (const index of changed) {
    const start = Math.max(0, index - context)
    const end = Math.min(ops.length - 1, index + context)
    const last = ranges[ranges.length - 1]
    if (last && start <= last[1] + 1) last[1] = Math.max(last[1], end)
    else ranges.push([start, end])
  }

  return ranges.map(([start, end]) => {
    const lines: UnifiedLine[] = []
    let aStart = 0
    let bStart = 0
    let aCount = 0
    let bCount = 0
    let seenA = false
    let seenB = false

    for (let i = start; i <= end; i++) {
      const op = ops[i]
      if (op.type === 'delete' || op.type === 'equal') {
        if (!seenA) {
          aStart = op.aIndex + 1
          seenA = true
        }
        aCount += 1
      }
      if (op.type === 'insert' || op.type === 'equal') {
        if (!seenB) {
          bStart = op.bIndex + 1
          seenB = true
        }
        bCount += 1
      }
      lines.push({
        type: op.type,
        aNumber: op.aIndex >= 0 ? op.aIndex + 1 : null,
        bNumber: op.bIndex >= 0 ? op.bIndex + 1 : null,
        text: op.type === 'insert' ? b[op.bIndex] : a[op.aIndex],
      })
    }

    return {
      aStart: aCount === 0 ? 0 : aStart,
      aCount,
      bStart: bCount === 0 ? 0 : bStart,
      bCount,
      lines,
    }
  })
}

export function toUnifiedPatch(
  hunks: Hunk[],
  oldName: string,
  newName: string,
): string {
  if (hunks.length === 0) return ''
  const out: string[] = [`--- a/${oldName}`, `+++ b/${newName}`]
  for (const hunk of hunks) {
    out.push(`@@ -${hunk.aStart},${hunk.aCount} +${hunk.bStart},${hunk.bCount} @@`)
    for (const line of hunk.lines) {
      const prefix = line.type === 'insert' ? '+' : line.type === 'delete' ? '-' : ' '
      out.push(`${prefix}${line.text}`)
    }
  }
  return `${out.join('\n')}\n`
}
