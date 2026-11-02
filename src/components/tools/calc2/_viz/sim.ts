/**
 * Time scales for simulations. A motion plays at true speed when it fits on
 * screen in a few seconds; otherwise it plays slower or faster by a round
 * factor, and the page says which. Pure: the tests import this file.
 */

export interface TimeScale {
  /** Simulated seconds per real second. 1 is true speed. */
  factor: number
  /** "Real time", "Slowed 4×", "Sped up 20×", "1 s = 1 day". */
  label: string
}

const STEPS = [1, 2, 4, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 1e4, 2e4, 5e4, 1e5, 2e5, 5e5, 1e6, 1e7, 1e8, 1e9, 1e10]

/**
 * Pick a factor so that `duration` simulated seconds play in about `lo` to
 * `hi` real seconds. True speed wins whenever it fits.
 */
export function timeScale(duration: number, lo = 1.2, hi = 8): TimeScale {
  if (!Number.isFinite(duration) || duration <= 0) return { factor: 1, label: 'Real time' }
  if (duration >= lo && duration <= hi) return { factor: 1, label: 'Real time' }
  if (duration < lo) {
    for (const s of STEPS) if (duration * s >= lo) return { factor: 1 / s, label: s === 1 ? 'Real time' : `Slowed ${s}×` }
    return { factor: 1 / 1e10, label: 'Slowed' }
  }
  for (const s of STEPS) if (duration / s <= hi) return { factor: s, label: spedLabel(s) }
  return { factor: 1e10, label: spedLabel(1e10) }
}

function spedLabel(s: number): string {
  if (s === 1) return 'Real time'
  const unit = [
    [31557600, 'year'],
    [86400, 'day'],
    [3600, 'hour'],
    [60, 'minute'],
  ] as const
  for (const [sec, name] of unit) {
    if (s >= sec) {
      const n = Math.round((s / sec) * 10) / 10
      return `1 s shows ${n} ${name}${n === 1 ? '' : 's'}`
    }
  }
  return `Sped up ${s.toLocaleString('en-US')}×`
}

/** Standard gravity in m/s². */
export const G0 = 9.80665
