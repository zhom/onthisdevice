/** Wallpaper strips and rolls for a room. Pure; the tests import it. Lengths in m. */

export interface Roll {
  value: string
  label: string
  /** Width and length in m. */
  width: number
  length: number
}

const IN = 0.0254
const FT = 0.3048

export const ROLLS: Roll[] = [
  { value: 'us27', label: 'US double roll, 27 in × 33 ft', width: 27 * IN, length: 33 * FT },
  { value: 'us205', label: 'US double roll, 20.5 in × 33 ft', width: 20.5 * IN, length: 33 * FT },
  { value: 'euro', label: 'Euro roll, 0.53 × 10.05 m', width: 0.53, length: 10.05 },
  { value: 'wide', label: 'Wide roll, 0.70 × 10.05 m', width: 0.7, length: 10.05 },
]

export interface WallpaperIn {
  /** Total width of the walls to paper (the room perimeter). */
  perimeter: number
  height: number
  /** Vertical pattern repeat; 0 for none. */
  repeat: number
  /** Extra length per strip for trimming top and bottom. */
  trim: number
  rollWidth: number
  rollLength: number
  /** Door count and the wall width each door saves. */
  doors: number
  doorWidth: number
}

export interface WallpaperOut {
  /** Length cut for each strip: height + trim, rounded up to whole repeats. */
  drop: number
  strips: number
  perRoll: number
  rolls: number
  /** Paper left at the end of each roll. */
  offcut: number
}

export function wallpaper(i: WallpaperIn): WallpaperOut {
  const width = Math.max(0, i.perimeter - i.doors * i.doorWidth)
  const strips = Math.ceil(width / i.rollWidth - 1e-9)
  const need = i.height + i.trim
  const drop = i.repeat > 0 ? Math.ceil(need / i.repeat - 1e-9) * i.repeat : need
  const perRoll = Math.floor(i.rollLength / drop + 1e-9)
  const rolls = perRoll > 0 ? Math.ceil(strips / perRoll - 1e-9) : Number.POSITIVE_INFINITY
  return { drop, strips, perRoll, rolls, offcut: perRoll > 0 ? i.rollLength - perRoll * drop : i.rollLength }
}
