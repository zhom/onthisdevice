/**
 * A self-contained line diff.
 *
 * The core is Myers' O(ND) greedy algorithm with a full trace and backtrack.
 * Because O(ND) degrades badly when two large files share almost nothing, the
 * entry point first trims the common prefix/suffix and then splits the work on
 * "patience" anchors — lines that appear exactly once in both inputs — so each
 * Myers call only ever sees a small window.
 *
 * Nothing here touches the DOM, so it is safe to call from a worker later.
 */

export type EditOp = 'equal' | 'insert' | 'delete'

export interface Edit {
  op: EditOp
  aIndex: number
  bIndex: number
}

/* ─────────────────────────────── Myers core ────────────────────────────── */

/**
 * Greedy Myers with a bounded edit distance.
 * Returns `null` when the two sequences differ by more than `maxD` edits.
 */
function myersEdits(a: readonly string[], b: readonly string[], maxD: number): Edit[] | null {
  const n = a.length
  const m = b.length
  if (n === 0 && m === 0) return []

  const max = Math.min(maxD, n + m)
  const offset = max
  const v = new Int32Array(2 * max + 1)
  const trace: Int32Array[] = []

  for (let d = 0; d <= max; d++) {
    trace.push(v.slice(Math.max(0, offset - d), Math.min(v.length, offset + d + 1)))
    for (let k = -d; k <= d; k += 2) {
      let x: number
      if (k === -d || (k !== d && v[offset + k - 1] < v[offset + k + 1])) {
        x = v[offset + k + 1]
      } else {
        x = v[offset + k - 1] + 1
      }
      let y = x - k
      while (x < n && y < m && a[x] === b[y]) {
        x++
        y++
      }
      v[offset + k] = x
      if (x >= n && y >= m) return backtrack(trace, d, n, m)
    }
  }
  return null
}

/** Walks the recorded traces backwards, emitting edits in forward order. */
function backtrack(trace: Int32Array[], dEnd: number, n: number, m: number): Edit[] {
  const reversed: Edit[] = []
  let x = n
  let y = m

  for (let d = dEnd; d >= 0; d--) {
    const window = trace[d]
    // `window` holds V[-d..d]; index i corresponds to k = i - d.
    const at = (k: number): number => {
      const i = k + d
      return i >= 0 && i < window.length ? window[i] : 0
    }
    const k = x - y
    let prevK: number
    if (k === -d || (k !== d && at(k - 1) < at(k + 1))) prevK = k + 1
    else prevK = k - 1

    const prevX = at(prevK)
    const prevY = prevX - prevK

    while (x > prevX && y > prevY) {
      reversed.push({ op: 'equal', aIndex: x - 1, bIndex: y - 1 })
      x--
      y--
    }

    if (d > 0) {
      if (x === prevX) reversed.push({ op: 'insert', aIndex: prevX, bIndex: prevY })
      else reversed.push({ op: 'delete', aIndex: prevX, bIndex: prevY })
    }

    x = prevX
    y = prevY
  }

  reversed.reverse()
  return reversed
}

/* ──────────────────────────── patience anchors ─────────────────────────── */

/** Indices of lines that occur exactly once in `lines`. */
function uniquePositions(lines: readonly string[], from: number, to: number): Map<string, number> {
  const counts = new Map<string, number>()
  for (let i = from; i < to; i++) {
    counts.set(lines[i], (counts.get(lines[i]) ?? 0) + 1)
  }
  const unique = new Map<string, number>()
  for (let i = from; i < to; i++) {
    if (counts.get(lines[i]) === 1) unique.set(lines[i], i)
  }
  return unique
}

/** Longest increasing subsequence over the b-indices of matched anchors. */
function longestIncreasing(pairs: { a: number; b: number }[]): { a: number; b: number }[] {
  if (pairs.length === 0) return []
  const tails: number[] = []
  const tailIndex: number[] = []
  const prev = new Int32Array(pairs.length).fill(-1)

  for (let i = 0; i < pairs.length; i++) {
    const value = pairs[i].b
    let lo = 0
    let hi = tails.length
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (tails[mid] < value) lo = mid + 1
      else hi = mid
    }
    tails[lo] = value
    tailIndex[lo] = i
    prev[i] = lo > 0 ? tailIndex[lo - 1] : -1
  }

  const out: { a: number; b: number }[] = []
  let cursor = tailIndex[tails.length - 1]
  while (cursor >= 0) {
    out.push(pairs[cursor])
    cursor = prev[cursor]
  }
  out.reverse()
  return out
}

const MYERS_MAX_D = 900

function diffRange(
  a: readonly string[],
  b: readonly string[],
  aFrom: number,
  aTo: number,
  bFrom: number,
  bTo: number,
  out: Edit[],
  depth: number,
): void {
  // Trim matching head/tail so Myers only sees the churn.
  while (aFrom < aTo && bFrom < bTo && a[aFrom] === b[bFrom]) {
    out.push({ op: 'equal', aIndex: aFrom, bIndex: bFrom })
    aFrom++
    bFrom++
  }
  const tail: Edit[] = []
  while (aTo > aFrom && bTo > bFrom && a[aTo - 1] === b[bTo - 1]) {
    aTo--
    bTo--
    tail.push({ op: 'equal', aIndex: aTo, bIndex: bTo })
  }
  tail.reverse()

  const aLen = aTo - aFrom
  const bLen = bTo - bFrom

  const emitReplace = () => {
    for (let i = aFrom; i < aTo; i++) out.push({ op: 'delete', aIndex: i, bIndex: bFrom })
    for (let j = bFrom; j < bTo; j++) out.push({ op: 'insert', aIndex: aTo, bIndex: j })
  }

  if (aLen === 0 || bLen === 0) {
    emitReplace()
    for (const t of tail) out.push(t)
    return
  }

  if (aLen + bLen <= 2 * MYERS_MAX_D) {
    const edits = myersEdits(a.slice(aFrom, aTo), b.slice(bFrom, bTo), MYERS_MAX_D)
    if (edits) {
      for (const edit of edits) {
        out.push({
          op: edit.op,
          aIndex: edit.aIndex + aFrom,
          bIndex: edit.bIndex + bFrom,
        })
      }
      for (const t of tail) out.push(t)
      return
    }
  }

  if (depth < 12) {
    const uniqueA = uniquePositions(a, aFrom, aTo)
    const uniqueB = uniquePositions(b, bFrom, bTo)
    const pairs: { a: number; b: number }[] = []
    for (const [line, aIdx] of uniqueA) {
      const bIdx = uniqueB.get(line)
      if (bIdx !== undefined) pairs.push({ a: aIdx, b: bIdx })
    }
    pairs.sort((p, q) => p.a - q.a)
    const anchors = longestIncreasing(pairs)

    if (anchors.length > 0) {
      let ai = aFrom
      let bi = bFrom
      for (const anchor of anchors) {
        diffRange(a, b, ai, anchor.a, bi, anchor.b, out, depth + 1)
        out.push({ op: 'equal', aIndex: anchor.a, bIndex: anchor.b })
        ai = anchor.a + 1
        bi = anchor.b + 1
      }
      diffRange(a, b, ai, aTo, bi, bTo, out, depth + 1)
      for (const t of tail) out.push(t)
      return
    }
  }

  emitReplace()
  for (const t of tail) out.push(t)
}

/** Line-level edit script for two sequences of comparison keys. */
export function diffSequences(a: readonly string[], b: readonly string[]): Edit[] {
  const out: Edit[] = []
  diffRange(a, b, 0, a.length, 0, b.length, out, 0)
  return out
}

/* ─────────────────────────────── word diff ─────────────────────────────── */

export interface WordPart {
  text: string
  changed: boolean
}

/** Splits into words and the whitespace between them, so joins are lossless. */
export function tokenizeWords(line: string): string[] {
  return line.split(/(\s+)/).filter((t) => t !== '')
}

export function diffWords(
  aLine: string,
  bLine: string,
  ignoreCase: boolean,
): { a: WordPart[]; b: WordPart[] } {
  const aTokens = tokenizeWords(aLine)
  const bTokens = tokenizeWords(bLine)
  const key = (t: string) => (ignoreCase ? t.toLowerCase() : t)
  const edits = myersEdits(aTokens.map(key), bTokens.map(key), 2000)

  if (!edits) {
    return {
      a: aLine ? [{ text: aLine, changed: true }] : [],
      b: bLine ? [{ text: bLine, changed: true }] : [],
    }
  }

  const aParts: WordPart[] = []
  const bParts: WordPart[] = []
  const push = (parts: WordPart[], text: string, changed: boolean) => {
    const last = parts[parts.length - 1]
    if (last && last.changed === changed) last.text += text
    else parts.push({ text, changed })
  }

  for (const edit of edits) {
    if (edit.op === 'equal') {
      push(aParts, aTokens[edit.aIndex], false)
      push(bParts, bTokens[edit.bIndex], false)
    } else if (edit.op === 'delete') {
      push(aParts, aTokens[edit.aIndex], true)
    } else {
      push(bParts, bTokens[edit.bIndex], true)
    }
  }

  return { a: aParts, b: bParts }
}

/* ─────────────────────────────── public API ────────────────────────────── */

export interface DiffOptions {
  ignoreWhitespace: boolean
  ignoreCase: boolean
  /** Skip word-level highlighting (faster on very large diffs). */
  skipWordDiff?: boolean
}

export type RowType = 'equal' | 'add' | 'remove' | 'modify'

export interface DiffRow {
  type: RowType
  aNumber: number | null
  bNumber: number | null
  aText: string
  bText: string
  aParts: WordPart[] | null
  bParts: WordPart[] | null
}

export interface DiffSummary {
  added: number
  removed: number
  modified: number
  unchanged: number
  /** 0-100, share of lines that are identical after normalisation. */
  similarity: number
  aLines: number
  bLines: number
}

export interface DiffResult {
  rows: DiffRow[]
  summary: DiffSummary
  identical: boolean
}

function normalizeKey(line: string, options: DiffOptions): string {
  let key = line
  if (options.ignoreWhitespace) key = key.replace(/\s+/g, ' ').trim()
  if (options.ignoreCase) key = key.toLowerCase()
  return key
}

function splitInputLines(text: string): string[] {
  if (text === '') return []
  const lines = text.split(/\r\n|\r|\n/)
  // A single trailing newline is a terminator, not an empty final line.
  if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop()
  return lines
}

export function computeDiff(aText: string, bText: string, options: DiffOptions): DiffResult {
  const aLines = splitInputLines(aText)
  const bLines = splitInputLines(bText)
  const aKeys = aLines.map((l) => normalizeKey(l, options))
  const bKeys = bLines.map((l) => normalizeKey(l, options))

  const edits = diffSequences(aKeys, bKeys)

  // Group the edit script into runs so a delete-run followed by an insert-run
  // can be paired up into "modified" rows.
  const rows: DiffRow[] = []
  let added = 0
  let removed = 0
  let modified = 0
  let unchanged = 0

  let i = 0
  while (i < edits.length) {
    const edit = edits[i]
    if (edit.op === 'equal') {
      rows.push({
        type: 'equal',
        aNumber: edit.aIndex + 1,
        bNumber: edit.bIndex + 1,
        aText: aLines[edit.aIndex] ?? '',
        bText: bLines[edit.bIndex] ?? '',
        aParts: null,
        bParts: null,
      })
      unchanged++
      i++
      continue
    }

    const deletes: number[] = []
    const inserts: number[] = []
    while (i < edits.length && edits[i].op !== 'equal') {
      if (edits[i].op === 'delete') deletes.push(edits[i].aIndex)
      else inserts.push(edits[i].bIndex)
      i++
    }

    const paired = Math.min(deletes.length, inserts.length)
    for (let p = 0; p < paired; p++) {
      const aIdx = deletes[p]
      const bIdx = inserts[p]
      const aText2 = aLines[aIdx]
      const bText2 = bLines[bIdx]
      const parts =
        options.skipWordDiff === true
          ? null
          : diffWords(aText2, bText2, options.ignoreCase)
      rows.push({
        type: 'modify',
        aNumber: aIdx + 1,
        bNumber: bIdx + 1,
        aText: aText2,
        bText: bText2,
        aParts: parts ? parts.a : null,
        bParts: parts ? parts.b : null,
      })
      modified++
    }
    for (let p = paired; p < deletes.length; p++) {
      const aIdx = deletes[p]
      rows.push({
        type: 'remove',
        aNumber: aIdx + 1,
        bNumber: null,
        aText: aLines[aIdx],
        bText: '',
        aParts: null,
        bParts: null,
      })
      removed++
    }
    for (let p = paired; p < inserts.length; p++) {
      const bIdx = inserts[p]
      rows.push({
        type: 'add',
        aNumber: null,
        bNumber: bIdx + 1,
        aText: '',
        bText: bLines[bIdx],
        aParts: null,
        bParts: null,
      })
      added++
    }
  }

  const totalCompared = Math.max(aLines.length, bLines.length)
  const summary: DiffSummary = {
    added,
    removed,
    modified,
    unchanged,
    similarity: totalCompared === 0 ? 100 : (unchanged / totalCompared) * 100,
    aLines: aLines.length,
    bLines: bLines.length,
  }

  return { rows, summary, identical: added === 0 && removed === 0 && modified === 0 }
}

/** Renders the diff as a standard unified patch. */
export function toUnifiedPatch(
  result: DiffResult,
  aName = 'original',
  bName = 'changed',
  context = 3,
): string {
  const lines: string[] = [`--- ${aName}`, `+++ ${bName}`]
  const flat: { sign: ' ' | '-' | '+'; text: string; a: number | null; b: number | null }[] = []

  for (const row of result.rows) {
    if (row.type === 'equal') flat.push({ sign: ' ', text: row.aText, a: row.aNumber, b: row.bNumber })
    else if (row.type === 'remove') flat.push({ sign: '-', text: row.aText, a: row.aNumber, b: null })
    else if (row.type === 'add') flat.push({ sign: '+', text: row.bText, a: null, b: row.bNumber })
    else {
      flat.push({ sign: '-', text: row.aText, a: row.aNumber, b: null })
      flat.push({ sign: '+', text: row.bText, a: null, b: row.bNumber })
    }
  }

  const changedIndexes: number[] = []
  flat.forEach((line, i) => {
    if (line.sign !== ' ') changedIndexes.push(i)
  })

  // Group changed lines into hunks, merging any that are within 2×context.
  const hunks: { start: number; end: number }[] = []
  for (const i of changedIndexes) {
    const last = hunks[hunks.length - 1]
    if (last && i - last.end <= context * 2) {
      last.end = i + 1
    } else {
      hunks.push({ start: i, end: i + 1 })
    }
  }

  for (const hunk of hunks) {
    const start = Math.max(0, hunk.start - context)
    const end = Math.min(flat.length, hunk.end + context)
    const slice = flat.slice(start, end)
    const aStart = slice.find((l) => l.a !== null)?.a ?? 0
    const bStart = slice.find((l) => l.b !== null)?.b ?? 0
    const aCount = slice.filter((l) => l.sign !== '+').length
    const bCount = slice.filter((l) => l.sign !== '-').length
    lines.push(`@@ -${aStart},${aCount} +${bStart},${bCount} @@`)
    for (const l of slice) lines.push(`${l.sign}${l.text}`)
  }

  if (lines.length === 2) lines.push('(the two texts are identical)')
  return lines.join('\n')
}
