import { cn } from '@/lib/utils'

export interface AnimatedNumberProps {
  value: number
  /** Turns the number into text, e.g. a currency formatter. */
  format?: (n: number) => string
  className?: string
}

const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']

/**
 * The main result with rolling digits: each digit is a strip of 0-9 that
 * slides to its new place (CSS transform transition, so a new value
 * interrupts cleanly). Columns are keyed from the right, so the ones digit
 * keeps its place when the number grows. Screen readers get the plain text.
 */
export function AnimatedNumber({ value, format = (n) => n.toLocaleString(), className }: AnimatedNumberProps) {
  const text = Number.isFinite(value) ? format(value) : '–'
  const chars = Array.from(text)
  const len = chars.length
  return (
    <span className={cn('relative inline-flex tabular-nums', className)} style={{ lineHeight: 1.15 }}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true" className="inline-flex">
        {chars.map((ch, i) => {
          const key = len - i
          const d = DIGITS.indexOf(ch)
          if (d < 0) {
            return (
              <span key={`c${key}`} className="inline-block whitespace-pre">
                {ch}
              </span>
            )
          }
          return (
            <span key={`d${key}`} className="relative inline-block overflow-hidden" style={{ height: '1.15em' }}>
              <span
                className="flex flex-col"
                style={{
                  transform: `translateY(${-d * 10}%)`,
                  transition: 'transform 380ms var(--ease-out)',
                  transitionDelay: `${Math.min(6, len - i - 1) * 18}ms`,
                }}
              >
                {DIGITS.map((g) => (
                  <span key={g} className="block text-center" style={{ height: '1.15em' }}>
                    {g}
                  </span>
                ))}
              </span>
            </span>
          )
        })}
      </span>
    </span>
  )
}
