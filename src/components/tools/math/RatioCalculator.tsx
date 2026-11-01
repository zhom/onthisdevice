import { useMemo, useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { AnswerBanner, Field, ScrollTable, StatGrid, StatTile, StepList, tdClass, thClass, type Step } from './ui'
import { fmtGrouped, fmtNum, gcdBig, parseNum } from './math-core'

interface RatioParse {
  terms: number[]
  decimals: number
}

function parseRatio(text: string): RatioParse {
  const cleaned = text.replace(/[−–—]/g, '-').trim()
  if (!cleaned) throw new Error('Enter a ratio such as 16:9 or 3:5:8.')
  const parts = cleaned.split(/\s*[:/to]+\s*/i).filter(Boolean)
  if (parts.length < 2) throw new Error('A ratio needs at least two terms. Separate them with a colon, like 16:9.')
  const terms: number[] = []
  let decimals = 0
  for (const p of parts) {
    const n = parseNum(p)
    if (n === null) throw new Error(`"${p}" isn't a number. Use digits separated by colons, like 16:9.`)
    if (n < 0) throw new Error('Ratio terms must be zero or positive.')
    terms.push(n)
    const dot = p.indexOf('.')
    if (dot >= 0) decimals = Math.max(decimals, p.length - dot - 1)
  }
  if (terms.every((t) => t === 0)) throw new Error('At least one term has to be greater than zero.')
  return { terms, decimals }
}

function simplifyTerms(parse: RatioParse): { integers: bigint[]; divisor: bigint; simplified: bigint[]; scale: number } {
  const scale = 10 ** parse.decimals
  const integers = parse.terms.map((t) => BigInt(Math.round(t * scale)))
  let divisor = integers.reduce((a, b) => gcdBig(a, b), 0n)
  if (divisor === 0n) divisor = 1n
  return { integers, divisor, simplified: integers.map((n) => n / divisor), scale }
}

/* ─────────────────────────── proportion solver ────────────────────────── */

function ProportionSolver() {
  const [a, setA] = useState('3')
  const [b, setB] = useState('4')
  const [c, setC] = useState('9')
  const [d, setD] = useState('')

  const outcome = useMemo(() => {
    const raw = [a, b, c, d]
    const nums = raw.map(parseNum)
    const blanks = nums.map((n, i) => (n === null && raw[i].trim() === '' ? i : -1)).filter((i) => i >= 0)
    const unreadable = raw.some((r, i) => r.trim() !== '' && nums[i] === null)
    if (unreadable) return { ok: false as const, message: 'One of the boxes has something that is not a number in it.' }
    if (blanks.length === 0) {
      const [na, nb, nc, nd] = nums as number[]
      const lhs = na * nd
      const rhs = nb * nc
      return {
        ok: true as const,
        solvedFor: null,
        value: 0,
        nums: nums as number[],
        steps: [
          {
            label: 'All four terms are filled in, so this checks whether the proportion holds.',
            expr: `${fmtNum(na)} × ${fmtNum(nd)} = ${fmtNum(lhs)}   and   ${fmtNum(nb)} × ${fmtNum(nc)} = ${fmtNum(rhs)}`,
          },
          {
            label: Math.abs(lhs - rhs) < 1e-9 ? 'The cross products match, so the two ratios are equivalent.' : 'The cross products differ, so these are not equivalent ratios.',
            expr: `${fmtNum(lhs)} ${Math.abs(lhs - rhs) < 1e-9 ? '=' : '≠'} ${fmtNum(rhs)}`,
          },
        ] as Step[],
        equal: Math.abs(lhs - rhs) < 1e-9,
      }
    }
    if (blanks.length > 1) {
      return { ok: false as const, message: 'Leave exactly one box empty. The calculator solves for that term.' }
    }
    const idx = blanks[0]
    const [na, nb, nc, nd] = nums
    const letters = ['A', 'B', 'C', 'D']
    let value: number
    let steps: Step[]
    const cross = 'A × D = B × C'
    if (idx === 3) {
      if (na === 0) return { ok: false as const, message: 'A is 0, so D cannot be determined (division by zero).' }
      value = (nb! * nc!) / na!
      steps = [
        { label: 'Cross-multiply the proportion.', expr: `${cross}  →  ${fmtNum(na!)} × D = ${fmtNum(nb!)} × ${fmtNum(nc!)}` },
        { label: 'Work out the right-hand side.', expr: `${fmtNum(na!)} × D = ${fmtNum(nb! * nc!)}` },
        { label: 'Divide both sides by A to isolate D.', expr: `D = ${fmtNum(nb! * nc!)} ÷ ${fmtNum(na!)} = ${fmtNum(value, 10)}` },
      ]
    } else if (idx === 2) {
      if (nb === 0) return { ok: false as const, message: 'B is 0, so C cannot be determined (division by zero).' }
      value = (na! * nd!) / nb!
      steps = [
        { label: 'Cross-multiply the proportion.', expr: `${cross}  →  ${fmtNum(na!)} × ${fmtNum(nd!)} = ${fmtNum(nb!)} × C` },
        { label: 'Work out the left-hand side.', expr: `${fmtNum(na! * nd!)} = ${fmtNum(nb!)} × C` },
        { label: 'Divide both sides by B to isolate C.', expr: `C = ${fmtNum(na! * nd!)} ÷ ${fmtNum(nb!)} = ${fmtNum(value, 10)}` },
      ]
    } else if (idx === 1) {
      if (nc === 0) return { ok: false as const, message: 'C is 0, so B cannot be determined (division by zero).' }
      value = (na! * nd!) / nc!
      steps = [
        { label: 'Cross-multiply the proportion.', expr: `${cross}  →  ${fmtNum(na!)} × ${fmtNum(nd!)} = B × ${fmtNum(nc!)}` },
        { label: 'Work out the left-hand side.', expr: `${fmtNum(na! * nd!)} = B × ${fmtNum(nc!)}` },
        { label: 'Divide both sides by C to isolate B.', expr: `B = ${fmtNum(na! * nd!)} ÷ ${fmtNum(nc!)} = ${fmtNum(value, 10)}` },
      ]
    } else {
      if (nd === 0) return { ok: false as const, message: 'D is 0, so A cannot be determined (division by zero).' }
      value = (nb! * nc!) / nd!
      steps = [
        { label: 'Cross-multiply the proportion.', expr: `${cross}  →  A × ${fmtNum(nd!)} = ${fmtNum(nb!)} × ${fmtNum(nc!)}` },
        { label: 'Work out the right-hand side.', expr: `A × ${fmtNum(nd!)} = ${fmtNum(nb! * nc!)}` },
        { label: 'Divide both sides by D to isolate A.', expr: `A = ${fmtNum(nb! * nc!)} ÷ ${fmtNum(nd!)} = ${fmtNum(value, 10)}` },
      ]
    }
    const filled = [...(nums as (number | null)[])]
    filled[idx] = value
    steps.push({
      label: 'Check the completed proportion.',
      expr: `${fmtNum(filled[0]!)} : ${fmtNum(filled[1]!)} = ${fmtNum(filled[2]!)} : ${fmtNum(filled[3]!)}`,
      note: `Both ratios reduce to the same value: ${fmtNum(filled[0]! / filled[1]!, 8)}`,
    })
    return { ok: true as const, solvedFor: letters[idx], value, nums: filled as number[], steps, equal: true }
  }, [a, b, c, d])

  return (
    <div className="space-y-4">
      <ToolPanel title="Solve A : B = C : D" description="Leave one box empty and it is filled in by cross-multiplication.">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="A" value={a} onChange={setA} placeholder="3" />
          <Field label="B" value={b} onChange={setB} placeholder="4" />
          <Field label="C" value={c} onChange={setC} placeholder="9" />
          <Field label="D" value={d} onChange={setD} placeholder="leave empty to solve" />
        </div>
        <p className="mt-3 font-mono text-sm text-muted-foreground">
          {a || 'A'} : {b || 'B'} = {c || 'C'} : {d || 'D'}
        </p>
      </ToolPanel>

      {!outcome.ok ? (
        <ErrorNote message={outcome.message} />
      ) : (
        <div className="space-y-4" role="status" aria-live="polite">
          <AnswerBanner
            label={outcome.solvedFor ? `Missing term ${outcome.solvedFor}` : 'Equivalence check'}
            value={outcome.solvedFor ? fmtGrouped(outcome.value, 10) : outcome.equal ? 'Equivalent ratios' : 'Not equivalent'}
            sub={`${fmtNum(outcome.nums[0])} : ${fmtNum(outcome.nums[1])} = ${fmtNum(outcome.nums[2])} : ${fmtNum(outcome.nums[3])}`}
          />
          <StepList steps={outcome.steps} />
        </div>
      )}
    </div>
  )
}

/* ───────────────────────────── simplify mode ──────────────────────────── */

function SimplifyRatio() {
  const [input, setInput] = useState('1920:1080')

  const outcome = useMemo(() => {
    try {
      const parse = parseRatio(input)
      const { integers, divisor, simplified, scale } = simplifyTerms(parse)
      const steps: Step[] = []
      if (parse.decimals > 0) {
        steps.push({
          label: `Clear the decimals by multiplying every term by 10^${parse.decimals}.`,
          expr: `${parse.terms.map((t) => fmtNum(t)).join(' : ')}  ×${scale}→  ${integers.join(' : ')}`,
        })
      }
      steps.push({
        label: 'Find the greatest common divisor of all the terms.',
        expr: `GCD(${integers.join(', ')}) = ${divisor}`,
        note: 'The GCD of a list is found by taking the GCD of the running result with each next term.',
      })
      steps.push({
        label: divisor > 1n ? 'Divide every term by that GCD.' : 'The GCD is 1, so the ratio is already in lowest terms.',
        expr: `${integers.join(' : ')} ÷ ${divisor} = ${simplified.join(' : ')}`,
      })
      const first = Number(simplified[0])
      const normalised = first === 0 ? null : simplified.map((n) => Number(n) / first)
      if (normalised) {
        steps.push({
          label: 'Normalise to "1 : n" by dividing through by the first term.',
          expr: normalised.map((n) => fmtNum(n, 6)).join(' : '),
        })
      }
      const total = parse.terms.reduce((x, y) => x + y, 0)
      return { ok: true as const, parse, integers, divisor, simplified, steps, normalised, total }
    } catch (err) {
      return { ok: false as const, message: err instanceof Error ? err.message : 'Could not read that ratio.' }
    }
  }, [input])

  return (
    <div className="space-y-4">
      <ToolPanel title="Simplify a ratio" description="Any number of terms, decimals allowed. 1920:1080, 2.5:1.5, 4:6:10 all work.">
        <Field label="Ratio" value={input} onChange={setInput} inputMode="text" placeholder="1920:1080" hint="Separate terms with colons." />
      </ToolPanel>
      {!outcome.ok ? (
        <ErrorNote message={outcome.message} />
      ) : (
        <div className="space-y-4" role="status" aria-live="polite">
          <AnswerBanner label="Simplified ratio" value={outcome.simplified.join(' : ')} sub={`Divided through by ${outcome.divisor}.`} />
          <StatGrid>
            <StatTile label="Lowest terms" value={outcome.simplified.join(' : ')} tone="muted" />
            <StatTile
              label="Normalised"
              value={outcome.normalised ? outcome.normalised.map((n) => fmtNum(n, 4)).join(' : ') : '–'}
              hint="first term scaled to 1"
              tone="muted"
            />
            <StatTile
              label="As percentages of the total"
              value={outcome.parse.terms.map((t) => `${fmtNum((t / outcome.total) * 100, 2)}%`).join(' · ')}
              tone="muted"
            />
          </StatGrid>
          <StepList steps={outcome.steps} />
        </div>
      )}
    </div>
  )
}

/* ────────────────────────────── scale mode ────────────────────────────── */

function ScaleRatio() {
  const [input, setInput] = useState('16:9')
  const [known, setKnown] = useState('1440')
  const [position, setPosition] = useState('1')

  const outcome = useMemo(() => {
    try {
      const parse = parseRatio(input)
      const value = parseNum(known)
      const pos = Math.trunc(Number(position))
      if (value === null) return null
      if (!Number.isInteger(pos) || pos < 1 || pos > parse.terms.length) {
        return { ok: false as const, message: `Choose which term you know. This ratio has ${parse.terms.length} terms.` }
      }
      const base = parse.terms[pos - 1]
      if (base === 0) return { ok: false as const, message: 'That term is 0, so it cannot be scaled to a new value.' }
      const factor = value / base
      const scaled = parse.terms.map((t) => t * factor)
      const steps: Step[] = [
        {
          label: `Find the scale factor from the term you know (term ${pos}).`,
          expr: `${fmtNum(value)} ÷ ${fmtNum(base)} = ${fmtNum(factor, 10)}`,
        },
        {
          label: 'Multiply every term by that same factor.',
          expr: parse.terms.map((t, i) => `${fmtNum(t)} × ${fmtNum(factor, 6)} = ${fmtNum(scaled[i], 6)}`).join('\n'),
          note: 'Scaling every term by the same factor keeps the ratio equivalent.',
        },
        {
          label: 'Scaled ratio.',
          expr: scaled.map((t) => fmtNum(t, 6)).join(' : '),
        },
      ]
      return { ok: true as const, parse, factor, scaled, steps }
    } catch (err) {
      return { ok: false as const, message: err instanceof Error ? err.message : 'Could not read that ratio.' }
    }
  }, [input, known, position])

  return (
    <div className="space-y-4">
      <ToolPanel title="Scale a ratio" description="Know one side of an equivalent ratio? Get all the others.">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Ratio" value={input} onChange={setInput} inputMode="text" placeholder="16:9" />
          <Field label="Which term do you know?" value={position} onChange={setPosition} inputMode="numeric" placeholder="1" hint="1 = first term" />
          <Field label="Its new value" value={known} onChange={setKnown} placeholder="1440" />
        </div>
      </ToolPanel>
      {outcome === null ? (
        <p className="rounded-xl bg-muted p-4 text-sm text-muted-foreground" role="status">
          Enter the known value to scale the whole ratio.
        </p>
      ) : !outcome.ok ? (
        <ErrorNote message={outcome.message} />
      ) : (
        <div className="space-y-4" role="status" aria-live="polite">
          <AnswerBanner label="Scaled ratio" value={outcome.scaled.map((t) => fmtNum(t, 6)).join(' : ')} sub={`Scale factor × ${fmtNum(outcome.factor, 8)}`} />
          <StepList steps={outcome.steps} />
        </div>
      )}
    </div>
  )
}

/* ────────────────────────────── split mode ────────────────────────────── */

function SplitByRatio() {
  const [input, setInput] = useState('2:3:5')
  const [amount, setAmount] = useState('1200')
  const [dp, setDp] = useState('2')

  const outcome = useMemo(() => {
    try {
      const parse = parseRatio(input)
      const total = parseNum(amount)
      if (total === null) return null
      const shares = parse.terms.reduce((a, b) => a + b, 0)
      if (shares === 0) return { ok: false as const, message: 'The ratio terms add up to zero, so there is nothing to divide by.' }
      const places = Math.max(0, Math.min(8, Math.trunc(Number(dp) || 0)))
      const exact = parse.terms.map((t) => (t / shares) * total)
      const rounded = exact.map((v) => Number(v.toFixed(places)))
      const roundedSum = rounded.reduce((a, b) => a + b, 0)
      const drift = total - roundedSum
      const steps: Step[] = [
        {
          label: 'Add the ratio terms to get the total number of shares.',
          expr: `${parse.terms.map((t) => fmtNum(t)).join(' + ')} = ${fmtNum(shares)}`,
        },
        {
          label: 'Divide the amount by the number of shares to get one share.',
          expr: `${fmtNum(total)} ÷ ${fmtNum(shares)} = ${fmtNum(total / shares, 10)} per share`,
        },
        {
          label: 'Multiply one share by each term.',
          expr: parse.terms
            .map((t, i) => `${fmtNum(t)} × ${fmtNum(total / shares, 6)} = ${fmtNum(exact[i], 6)}`)
            .join('\n'),
        },
      ]
      if (Math.abs(drift) > 10 ** -(places + 3)) {
        steps.push({
          label: 'Rounding leaves a small remainder. Add it to one part so the split still adds up.',
          expr: `${fmtNum(total)} − ${fmtNum(roundedSum, places + 2)} = ${fmtNum(drift, places + 2)}`,
        })
      }
      return { ok: true as const, parse, shares, exact, rounded, total, drift, places }
    } catch (err) {
      return { ok: false as const, message: err instanceof Error ? err.message : 'Could not read that ratio.' }
    }
  }, [input, amount, dp])

  return (
    <div className="space-y-4">
      <ToolPanel title="Split a total by a ratio" description="Share out money, ingredients or workload in proportion.">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Ratio" value={input} onChange={setInput} inputMode="text" placeholder="2:3:5" />
          <Field label="Total amount" value={amount} onChange={setAmount} placeholder="1200" />
          <Field label="Decimal places" value={dp} onChange={setDp} inputMode="numeric" placeholder="2" />
        </div>
      </ToolPanel>
      {outcome === null ? (
        <p className="rounded-xl bg-muted p-4 text-sm text-muted-foreground" role="status">
          Enter a total to split it in proportion.
        </p>
      ) : !outcome.ok ? (
        <ErrorNote message={outcome.message} />
      ) : (
        <div className="space-y-4" role="status" aria-live="polite">
          <AnswerBanner
            label={`${fmtGrouped(outcome.total)} split ${outcome.parse.terms.map((t) => fmtNum(t)).join(':')}`}
            value={outcome.rounded.map((v) => fmtGrouped(v, outcome.places)).join(' · ')}
            sub={`${fmtNum(outcome.shares)} shares in total, each worth ${fmtGrouped(outcome.total / outcome.shares, 6)}.`}
          />
          <ScrollTable caption="Each part of the split">
            <thead>
              <tr>
                <th className={thClass} scope="col">Part</th>
                <th className={thClass} scope="col">Shares</th>
                <th className={thClass} scope="col">Exact</th>
                <th className={thClass} scope="col">Rounded</th>
                <th className={thClass} scope="col">% of total</th>
              </tr>
            </thead>
            <tbody>
              {outcome.parse.terms.map((t, i) => (
                <tr key={i}>
                  <td className={tdClass}>#{i + 1}</td>
                  <td className={tdClass}>{fmtNum(t)}</td>
                  <td className={tdClass}>{fmtNum(outcome.exact[i], 8)}</td>
                  <td className={tdClass}>{fmtGrouped(outcome.rounded[i], outcome.places)}</td>
                  <td className={tdClass}>{fmtNum((t / outcome.shares) * 100, 3)}%</td>
                </tr>
              ))}
            </tbody>
          </ScrollTable>
          <StepList
            steps={[
              {
                label: 'Add the ratio terms to get the total number of shares.',
                expr: `${outcome.parse.terms.map((t) => fmtNum(t)).join(' + ')} = ${fmtNum(outcome.shares)}`,
              },
              {
                label: 'One share is the amount divided by the share count.',
                expr: `${fmtNum(outcome.total)} ÷ ${fmtNum(outcome.shares)} = ${fmtNum(outcome.total / outcome.shares, 10)}`,
              },
              {
                label: 'Each part is its term multiplied by one share.',
                expr: outcome.parse.terms
                  .map((t, i) => `#${i + 1}: ${fmtNum(t)} × ${fmtNum(outcome.total / outcome.shares, 6)} = ${fmtNum(outcome.exact[i], 6)}`)
                  .join('\n'),
              },
              {
                label: 'Check the parts add back up to the total.',
                expr: `${outcome.exact.map((v) => fmtNum(v, 4)).join(' + ')} = ${fmtNum(outcome.total, 6)}`,
              },
            ]}
          />
        </div>
      )}
    </div>
  )
}

export default function RatioCalculator() {
  return (
    <Tabs defaultValue="proportion">
      <TabsList className="grid h-auto w-full grid-cols-2 gap-1 lg:grid-cols-4">
        <TabsTrigger value="proportion" className="text-xs sm:text-sm">Solve A:B = C:D</TabsTrigger>
        <TabsTrigger value="simplify" className="text-xs sm:text-sm">Simplify</TabsTrigger>
        <TabsTrigger value="scale" className="text-xs sm:text-sm">Scale</TabsTrigger>
        <TabsTrigger value="split" className="text-xs sm:text-sm">Split a total</TabsTrigger>
      </TabsList>
      <TabsContent value="proportion" className="mt-4">
        <ProportionSolver />
      </TabsContent>
      <TabsContent value="simplify" className="mt-4">
        <SimplifyRatio />
      </TabsContent>
      <TabsContent value="scale" className="mt-4">
        <ScaleRatio />
      </TabsContent>
      <TabsContent value="split" className="mt-4">
        <SplitByRatio />
      </TabsContent>
    </Tabs>
  )
}
