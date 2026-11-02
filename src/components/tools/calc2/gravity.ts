/** Surface gravity of a few worlds, m/s², for the motion calculators. */
export type World = 'earth' | 'moon' | 'mars' | 'jupiter'

export const WORLDS: { value: World; label: string; g: number }[] = [
  { value: 'earth', label: 'Earth, 9.807 m/s²', g: 9.80665 },
  { value: 'moon', label: 'Moon, 1.62 m/s²', g: 1.62 },
  { value: 'mars', label: 'Mars, 3.71 m/s²', g: 3.71 },
  { value: 'jupiter', label: 'Jupiter, 24.79 m/s²', g: 24.79 },
]

export function gravityOf(w: World): number {
  return WORLDS.find((x) => x.value === w)?.g ?? 9.80665
}
