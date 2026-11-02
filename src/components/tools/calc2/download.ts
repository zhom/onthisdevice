/** Download and upload time from a size and a speed. Pure; the tests import it. */

/** Bytes per unit. KB, MB, GB, TB are decimal (1000); KiB, MiB, GiB, TiB binary (1024). */
export const SIZE = { KB: 1e3, MB: 1e6, GB: 1e9, TB: 1e12, KiB: 1024, MiB: 1024 ** 2, GiB: 1024 ** 3, TiB: 1024 ** 4 } as const
export type SizeUnit = keyof typeof SIZE

/** Bits per second per unit. */
export const SPEED = { 'kbit/s': 1e3, 'Mbit/s': 1e6, 'Gbit/s': 1e9, 'kB/s': 8e3, 'MB/s': 8e6, 'GB/s': 8e9 } as const
export type SpeedUnit = keyof typeof SPEED

/**
 * Seconds to move `bytes` at `bitsPerSecond`, with `overhead` (0..1) of the
 * line taken by protocol headers and retransmits.
 */
export function transferTime(bytes: number, bitsPerSecond: number, overhead = 0): number {
  return (bytes * 8) / (bitsPerSecond * (1 - overhead))
}
