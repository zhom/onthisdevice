import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { AnswerBanner, ScrollTable, StatGrid, StatTile, StepList, tdClass, thClass, type Step } from './ui'
import { factorizationString, fmtGrouped, gcdBig, lcmBig, primeFactorize, superscript, type PrimePower } from './math-core'

const MAX_FACTOR = 10n ** 15n

function parseIntegers(raw: string): bigint[] {
  const tokens = raw
    .replace(/[−–—]/g, '-')
    .split(/[\s,;|]+/)
    .map((t) => t.trim())
    .filter(Boolean)
  const out: bigint[] = []
  for (const t of tokens) {
    const cleaned = t.replace(/_/g, '')
    if (!/^-?\d+$/.test(cleaned)) {
      throw new Error(`"${t}" is not a whole number. GCD and LCM are defined for integers only.`)
    }
    const value = BigInt(cleaned)
    out.push(value < 0n ? -value : value)
  }
  return out
}

interface EuclidRow {
  a: bigint
  b: bigint
  q: bigint
  r: bigint
}

function euclid(a: bigint, b: bigint): EuclidRow[] {
  const rows: EuclidRow[] = []
  let x = a
  let y = b
  let guard = 0
  while (y !== 0n && guard++ < 400) {
    const q = x / y
    const r = x % y
    rows.push({ a: x, b: y, q, r })
    x = y
    y = r
  }
  return rows
}

function pretty(factors: PrimePower[]): string {
  return factorizationString(factors).replace(/\^(\d+)/g, (_m, d: string) => superscript(d))
}

export default function GcdLcmCalculator() {
  const [raw, setRaw] = useState('48, 180, 210')

  const outcome = useMemo(() => {
    if (!raw.trim()) return null
    try {
      const values = parseIntegers(raw)
      if (values.length < 2) throw new Error('Enter at least two numbers, separated by commas or spaces.')
      if (values.every((v) => v === 0n)) throw new Error('At least one number has to be non-zero.')

      const gcd = values.reduce((a, b) => gcdBig(a, b))
      const hasZero = values.some((v) => v === 0n)
      let lcm = values[0]
      if (!hasZero) {
        for (let i = 1; i < values.length; i++) lcm = lcmBig(lcm, values[i])
      } else {
        lcm = 0n
      }
      const lcmOverflow = hasZero

      const steps: Step[] = []
      const pairRows = euclid(values[0], values[1])
      steps.push({
        label: 'Run the Euclidean algorithm on the first two numbers.',
        expr: pairRows.map((r) => `${r.a} = ${r.q} × ${r.b} + ${r.r}`).join('\n'),
        note: `The last non-zero remainder is the GCD of ${values[0]} and ${values[1]}: ${gcdBig(values[0], values[1])}.`,
      })

      if (values.length > 2) {
        let running = gcdBig(values[0], values[1])
        const lines: string[] = []
        for (let i = 2; i < values.length; i++) {
          const nextGcd = gcdBig(running, values[i])
          lines.push(`GCD(${running}, ${values[i]}) = ${nextGcd}`)
          running = nextGcd
        }
        steps.push({
          label: 'Fold the running GCD against each remaining number.',
          expr: lines.join('\n'),
          note: 'GCD is associative, so taking them two at a time gives the GCD of the whole list.',
        })
      }

      const factorable = values.every((v) => v > 0n && v <= MAX_FACTOR)
      const factorLists = factorable ? values.map((v) => primeFactorize(Number(v))) : []
      if (factorable) {
        steps.push({
          label: 'Cross-check with prime factorisation.',
          expr: values.map((v, i) => `${v} = ${pretty(factorLists[i])}`).join('\n'),
        })
        const primes = [...new Set(factorLists.flat().map((f) => f.p))].sort((a, b) => a - b)
        const minExp = primes
          .map((p) => {
            const exps = factorLists.map((list) => list.find((f) => f.p === p)?.e ?? 0)
            return { p, e: Math.min(...exps) }
          })
          .filter((x) => x.e > 0)
        const maxExp = primes.map((p) => {
          const exps = factorLists.map((list) => list.find((f) => f.p === p)?.e ?? 0)
          return { p, e: Math.max(...exps) }
        })
        steps.push({
          label: 'GCD takes the lowest power of every prime that appears in all of them.',
          expr: minExp.length ? `GCD = ${pretty(minExp)} = ${gcd}` : `No prime is shared by every number, so GCD = 1`,
        })
        steps.push({
          label: 'LCM takes the highest power of every prime that appears anywhere.',
          expr: `LCM = ${pretty(maxExp)} = ${lcmOverflow ? '0 (one of the numbers is zero)' : lcm}`,
        })
      }

      steps.push({
        label: 'Check the identity that links the two for a pair.',
        expr: `GCD(${values[0]}, ${values[1]}) × LCM(${values[0]}, ${values[1]}) = ${gcdBig(values[0], values[1])} × ${lcmBig(values[0], values[1])} = ${gcdBig(values[0], values[1]) * lcmBig(values[0], values[1])} = ${values[0]} × ${values[1]}`,
        note: 'This identity holds only for two numbers at a time. It does not extend to three or more.',
      })

      return {
        ok: true as const,
        values,
        gcd,
        lcm: lcmOverflow ? 0n : lcm,
        lcmOverflow,
        pairRows,
        factorable,
        factorLists,
        steps,
      }
    } catch (err) {
      return { ok: false as const, message: err instanceof Error ? err.message : 'Those numbers could not be read.' }
    }
  }, [raw])

  return (
    <div className="space-y-5">
      <ToolPanel
        title="Numbers"
        description="Two or more whole numbers, separated by commas, spaces or newlines. Negative signs are ignored, because GCD and LCM use magnitudes."
        footer={
          <div className="flex flex-wrap gap-2">
            {['48, 180', '48, 180, 210', '12, 18, 24, 30', '1071, 462'].map((s) => (
              <Button key={s} type="button" variant="outline" size="sm" className="font-mono" onClick={() => setRaw(s)}>
                {s}
              </Button>
            ))}
          </div>
        }
      >
        <div className="space-y-1.5">
          <Label htmlFor="gcd-input">Whole numbers</Label>
          <Textarea
            id="gcd-input"
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            rows={3}
            spellCheck={false}
            className="font-mono text-sm"
            placeholder="48, 180, 210"
          />
        </div>
      </ToolPanel>

      {outcome === null ? (
        <p className="rounded-xl bg-muted p-4 text-sm text-muted-foreground" role="status">
          Enter at least two numbers to get their GCD and LCM with full working.
        </p>
      ) : !outcome.ok ? (
        <ErrorNote message={outcome.message} />
      ) : (
        <div className="space-y-5" role="status" aria-live="polite">
          <div className="grid gap-4 sm:grid-cols-2">
            <AnswerBanner label="Greatest common divisor (GCD)" value={String(outcome.gcd)} sub="Also called the GCF or HCF." />
            <AnswerBanner
              label="Least common multiple (LCM)"
              value={outcome.lcmOverflow ? '0' : String(outcome.lcm)}
              sub={outcome.lcmOverflow ? 'One of the numbers is zero, so the only common multiple is zero.' : 'The smallest number every input divides into.'}
            />
          </div>

          <StatGrid>
            <StatTile label="Numbers" value={outcome.values.join(', ')} tone="muted" />
            <StatTile
              label="Coprime?"
              value={outcome.gcd === 1n ? 'Yes, GCD is 1' : 'No'}
              hint={outcome.gcd === 1n ? 'they share no prime factor' : `they share the factor ${outcome.gcd}`}
              tone="muted"
            />
            <StatTile
              label="Reduced ratio"
              value={outcome.gcd === 0n ? '–' : outcome.values.map((v) => String(v / outcome.gcd)).join(' : ')}
              hint="each number divided by the GCD"
              tone="muted"
            />
          </StatGrid>

          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">
              Euclidean algorithm for {String(outcome.values[0])} and {String(outcome.values[1])}
            </h3>
            <ScrollTable caption="Each division step of the Euclidean algorithm">
              <thead>
                <tr>
                  <th className={thClass} scope="col">Step</th>
                  <th className={thClass} scope="col">a</th>
                  <th className={thClass} scope="col">b</th>
                  <th className={thClass} scope="col">a ÷ b</th>
                  <th className={thClass} scope="col">Remainder</th>
                </tr>
              </thead>
              <tbody>
                {outcome.pairRows.map((r, i) => (
                  <tr key={i}>
                    <td className={tdClass}>{i + 1}</td>
                    <td className={tdClass}>{String(r.a)}</td>
                    <td className={tdClass}>{String(r.b)}</td>
                    <td className={tdClass}>{String(r.q)}</td>
                    <td className={tdClass}>{String(r.r)}</td>
                  </tr>
                ))}
              </tbody>
            </ScrollTable>
            <p className="text-xs text-muted-foreground">
              The algorithm stops when the remainder reaches zero; the divisor at that point is the GCD.
            </p>
          </section>

          {outcome.factorable && (
            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-foreground">Prime factorisations</h3>
              <ScrollTable caption="Prime factorisation of each input">
                <thead>
                  <tr>
                    <th className={thClass} scope="col">Number</th>
                    <th className={thClass} scope="col">Prime factorisation</th>
                    <th className={thClass} scope="col">Divisors</th>
                  </tr>
                </thead>
                <tbody>
                  {outcome.values.map((v, i) => (
                    <tr key={String(v) + i}>
                      <td className={tdClass}>{fmtGrouped(Number(v))}</td>
                      <td className={tdClass}>{pretty(outcome.factorLists[i])}</td>
                      <td className={tdClass}>{outcome.factorLists[i].reduce((a, f) => a * (f.e + 1), 1)}</td>
                    </tr>
                  ))}
                </tbody>
              </ScrollTable>
            </section>
          )}

          <StepList steps={outcome.steps} />
        </div>
      )}
    </div>
  )
}
