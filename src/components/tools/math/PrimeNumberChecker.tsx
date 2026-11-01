import { useMemo, useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { ProgressPanel } from '@/components/shared/ProgressPanel'
import { CopyButton } from '@/components/shared/CopyButton'
import { AnswerBanner, Field, StatGrid, StatTile, StepList, type Step } from './ui'
import { factorizationString, fmtGrouped, isPrimeBig, primeFactorize, superscript } from './math-core'

const MAX_FACTOR = 1e15
const MAX_SPAN = 5_000_000
const LIST_LIMIT = 5000

function parseInteger(raw: string): bigint | null {
  const cleaned = raw.replace(/[−–—]/g, '-').replace(/[\s,_]/g, '')
  if (!cleaned) return null
  if (!/^-?\d+$/.test(cleaned)) throw new Error(`"${raw.trim()}" is not a whole number. Primes are only defined for integers.`)
  return BigInt(cleaned)
}

function divisorsOf(n: number): number[] {
  const out: number[] = []
  for (let i = 1; i * i <= n; i++) {
    if (n % i === 0) {
      out.push(i)
      if (i !== n / i) out.push(n / i)
    }
    if (out.length > 4096) break
  }
  return out.sort((a, b) => a - b)
}

/* ─────────────────────────── primality check ──────────────────────────── */

function CheckPrime() {
  const [raw, setRaw] = useState('9973')

  const outcome = useMemo(() => {
    try {
      const n = parseInteger(raw)
      if (n === null) return null
      const prime = isPrimeBig(n)
      const small = n <= BigInt(MAX_FACTOR) && n >= -BigInt(MAX_FACTOR)
      const asNumber = small ? Number(n) : null
      const factors = asNumber !== null && asNumber > 1 ? primeFactorize(asNumber) : []
      const divisorCount = factors.reduce((a, f) => a * (f.e + 1), 1)
      const divisors = asNumber !== null && asNumber > 0 && divisorCount <= 4096 ? divisorsOf(asNumber) : []

      let prev: bigint | null = null
      let next: bigint | null = null
      for (let k = n - 1n; k >= 2n && n - k <= 100000n; k--) {
        if (isPrimeBig(k)) {
          prev = k
          break
        }
      }
      for (let k = n + 1n; k - n <= 100000n; k++) {
        if (isPrimeBig(k)) {
          next = k
          break
        }
      }

      const steps: Step[] = []
      if (n < 2n) {
        steps.push({
          label: 'A prime number must be greater than 1.',
          expr: `${n} is ${n < 0n ? 'negative' : n === 0n ? 'zero' : 'the unit 1'}, so it is not prime.`,
          note: n === 1n ? '1 has only one positive divisor, itself, while a prime needs exactly two.' : undefined,
        })
      } else if (prime) {
        steps.push({
          label: 'Test divisibility by every prime up to the square root.',
          expr: asNumber !== null ? `√${asNumber} ≈ ${Math.sqrt(asNumber).toFixed(4)}, and no prime at or below this divides ${n}` : `No small prime divides ${n}`,
          note: 'Any composite number must have a factor no larger than its square root, so the search can stop there.',
        })
        steps.push({
          label: 'Confirm with a deterministic Miller–Rabin test.',
          expr: `${n} passes every witness, so it is prime.`,
          note: 'The chosen witness set makes the test exact for all values below 3.3 × 10²⁴.',
        })
      } else {
        const firstFactor = factors[0]
        steps.push({
          label: 'Look for a divisor at or below the square root.',
          expr: firstFactor
            ? `${n} ÷ ${firstFactor.p} = ${Number(n) / firstFactor.p}, an exact division, so ${n} is composite.`
            : `${n} has a non-trivial divisor, so it is composite.`,
        })
        if (factors.length) {
          steps.push({
            label: 'Keep dividing by primes until nothing is left.',
            expr: `${n} = ${factorizationString(factors).replace(/\^(\d+)/g, (_m, d: string) => superscript(d))}`,
          })
          steps.push({
            label: 'Count the divisors from the exponents.',
            expr: `${factors.map((f) => `(${f.e} + 1)`).join(' × ')} = ${divisorCount} divisors`,
            note: 'Each prime power can appear from 0 up to its exponent, independently of the others.',
          })
        }
      }

      return { ok: true as const, n, prime, factors, divisorCount, divisors, prev, next, steps, small }
    } catch (err) {
      return { ok: false as const, message: err instanceof Error ? err.message : 'That is not a number I can test.' }
    }
  }, [raw])

  return (
    <div className="space-y-4">
      <ToolPanel title="Is it prime?" description="Enter any whole number. Big integers with dozens of digits are fine.">
        <Field label="Number" value={raw} onChange={setRaw} inputMode="numeric" placeholder="9973" />
        <div className="mt-3 flex flex-wrap gap-2">
          {['97', '561', '9973', '1000003', '2147483647'].map((n) => (
            <Button key={n} type="button" variant="outline" size="sm" className="font-mono" onClick={() => setRaw(n)}>
              {n}
            </Button>
          ))}
        </div>
      </ToolPanel>

      {outcome === null ? (
        <p className="rounded-xl bg-muted p-4 text-sm text-muted-foreground" role="status">
          Type a number to test it.
        </p>
      ) : !outcome.ok ? (
        <ErrorNote message={outcome.message} />
      ) : (
        <div className="space-y-4" role="status" aria-live="polite">
          <AnswerBanner
            label={`${outcome.n}`}
            value={outcome.prime ? 'Prime' : outcome.n < 2n ? 'Neither prime nor composite' : 'Composite'}
            sub={
              outcome.prime
                ? 'Its only positive divisors are 1 and itself.'
                : outcome.n < 2n
                  ? 'Primality is only defined for integers greater than 1.'
                  : `It factors as ${factorizationString(outcome.factors).replace(/\^(\d+)/g, (_m, d: string) => superscript(d))}.`
            }
          />

          <StatGrid>
            <StatTile
              label="Prime factorisation"
              value={outcome.small && outcome.n > 1n ? factorizationString(outcome.factors).replace(/\^(\d+)/g, (_m, d: string) => superscript(d)) : '–'}
              hint={outcome.small ? undefined : 'too large to factor by trial division'}
              tone="muted"
            />
            <StatTile label="Number of divisors" value={outcome.n > 1n && outcome.small ? String(outcome.divisorCount) : '–'} tone="muted" />
            <StatTile
              label="Distinct prime factors"
              value={outcome.small && outcome.n > 1n ? String(outcome.factors.length) : '–'}
              tone="muted"
            />
            <StatTile label="Previous prime" value={outcome.prev !== null ? String(outcome.prev) : 'none nearby'} tone="muted" />
            <StatTile label="Next prime" value={outcome.next !== null ? String(outcome.next) : 'none nearby'} tone="muted" />
            <StatTile
              label="Prime gap around it"
              value={outcome.prev !== null && outcome.next !== null ? String(outcome.next - outcome.prev) : '–'}
              hint={outcome.prime ? 'gap between the neighbours' : undefined}
              tone="muted"
            />
          </StatGrid>

          {outcome.divisors.length > 0 && (
            <div className="rounded-xl bg-card p-4">
              <div className="mb-2 flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-foreground">All {outcome.divisors.length} divisors</h3>
                <CopyButton value={outcome.divisors.join(', ')} label="Copy divisors" />
              </div>
              <p className="max-h-40 overflow-y-auto break-words font-mono text-sm text-muted-foreground">
                {outcome.divisors.join(', ')}
              </p>
            </div>
          )}

          <StepList steps={outcome.steps} />
        </div>
      )}
    </div>
  )
}

/* ────────────────────────── range sieve ───────────────────────────────── */

function simpleSieve(limit: number): number[] {
  const flags = new Uint8Array(limit + 1)
  const primes: number[] = []
  for (let i = 2; i <= limit; i++) {
    if (!flags[i]) {
      primes.push(i)
      for (let j = i * i; j <= limit; j += i) flags[j] = 1
    }
  }
  return primes
}

function PrimeRange() {
  const [loRaw, setLoRaw] = useState('1')
  const [hiRaw, setHiRaw] = useState('200')
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [output, setOutput] = useState<{ primes: number[]; count: number; lo: number; hi: number; twins: number; maxGap: { gap: number; at: number } } | null>(null)

  const run = async () => {
    setError(null)
    const lo = Math.max(2, Math.floor(Number(loRaw.replace(/[\s,_]/g, ''))))
    const hi = Math.floor(Number(hiRaw.replace(/[\s,_]/g, '')))
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) {
      setError('Both bounds have to be whole numbers.')
      return
    }
    if (hi < lo) {
      setError('The upper bound must be greater than or equal to the lower bound.')
      return
    }
    if (hi - lo > MAX_SPAN) {
      setError(`That range covers ${fmtGrouped(hi - lo)} numbers. Keep the span under ${fmtGrouped(MAX_SPAN)} so the page stays responsive.`)
      return
    }
    if (hi > Number.MAX_SAFE_INTEGER) {
      setError('The upper bound is too large for an exact sieve.')
      return
    }

    setRunning(true)
    setProgress(0)
    setOutput(null)
    const { nextFrame } = await import('@/lib/utils')
    try {
      const base = simpleSieve(Math.floor(Math.sqrt(hi)) + 1)
      const CHUNK = 250_000
      const found: number[] = []
      let count = 0
      let twins = 0
      let previous = -1
      let maxGap = { gap: 0, at: 0 }

      for (let start = lo; start <= hi; start += CHUNK) {
        const end = Math.min(hi, start + CHUNK - 1)
        const size = end - start + 1
        const composite = new Uint8Array(size)
        for (const p of base) {
          if (p * p > end) break
          const first = Math.max(p * p, Math.ceil(start / p) * p)
          for (let j = first; j <= end; j += p) composite[j - start] = 1
        }
        for (let i = 0; i < size; i++) {
          const value = start + i
          if (value < 2 || composite[i]) continue
          count++
          if (found.length < LIST_LIMIT) found.push(value)
          if (previous > 0) {
            const gap = value - previous
            if (gap === 2) twins++
            if (gap > maxGap.gap) maxGap = { gap, at: previous }
          }
          previous = value
        }
        setProgress(Math.round(((end - lo + 1) / (hi - lo + 1)) * 100))
        await nextFrame()
      }

      setOutput({ primes: found, count, lo, hi, twins, maxGap })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The sieve could not finish.')
    } finally {
      setRunning(false)
      setProgress(100)
    }
  }

  return (
    <div className="space-y-4">
      <ToolPanel
        title="Prime numbers in a range"
        description={`A segmented sieve of Eratosthenes. Spans of up to ${fmtGrouped(MAX_SPAN)} numbers are supported.`}
        footer={
          <Button type="button" onClick={run} disabled={running}>
            {running ? 'Sieving…' : 'Find the primes'}
          </Button>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="From" value={loRaw} onChange={setLoRaw} inputMode="numeric" placeholder="1" />
          <Field label="To" value={hiRaw} onChange={setHiRaw} inputMode="numeric" placeholder="200" />
        </div>
      </ToolPanel>

      {running && <ProgressPanel label="Sieving the range…" value={progress} />}
      {error && <ErrorNote message={error} onRetry={run} />}

      {output && !running && (
        <div className="space-y-4" role="status" aria-live="polite">
          <AnswerBanner
            label={`Primes between ${fmtGrouped(output.lo)} and ${fmtGrouped(output.hi)}`}
            value={fmtGrouped(output.count)}
            sub={`${fmtGrouped(output.twins)} twin-prime pair${output.twins === 1 ? '' : 's'} · largest gap ${output.maxGap.gap} after ${fmtGrouped(output.maxGap.at)}`}
            copy={false}
          />
          <StatGrid>
            <StatTile label="Primes found" value={fmtGrouped(output.count)} tone="muted" />
            <StatTile label="First prime" value={output.primes.length ? String(output.primes[0]) : '–'} tone="muted" />
            <StatTile
              label="Density"
              value={`${(((output.count / (output.hi - output.lo + 1)) * 100) || 0).toFixed(3)}%`}
              hint="share of the range that is prime"
              tone="muted"
            />
          </StatGrid>
          <div className="rounded-xl bg-card p-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-foreground">
                {output.primes.length < output.count ? `First ${fmtGrouped(output.primes.length)} primes` : 'The primes'}
              </h3>
              <CopyButton value={output.primes.join(', ')} label="Copy list" />
            </div>
            <p className="max-h-80 overflow-y-auto break-words font-mono text-sm text-muted-foreground">
              {output.primes.join(', ')}
            </p>
            {output.primes.length < output.count && (
              <p className="mt-2 text-xs text-muted-foreground">
                The list is capped at {fmtGrouped(LIST_LIMIT)} entries; the count above covers the whole range.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function PrimeNumberChecker() {
  return (
    <Tabs defaultValue="check">
      <TabsList className="grid h-auto w-full grid-cols-2 gap-1">
        <TabsTrigger value="check">Check a number</TabsTrigger>
        <TabsTrigger value="range">Primes in a range</TabsTrigger>
      </TabsList>
      <TabsContent value="check" className="mt-4">
        <CheckPrime />
      </TabsContent>
      <TabsContent value="range" className="mt-4">
        <PrimeRange />
      </TabsContent>
    </Tabs>
  )
}
