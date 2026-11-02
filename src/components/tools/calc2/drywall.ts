/** Drywall sheets and finishing materials for a room. Pure; the tests import it. Areas in ft². */

export const DOOR_FT2 = 21 // 3 × 7 ft
export const WINDOW_FT2 = 15 // 3 × 5 ft

export interface Sheet {
  value: string
  label: string
  /** Width and length in ft. */
  w: number
  l: number
}

export const SHEETS: Sheet[] = [
  { value: '4x8', label: '4 × 8 ft', w: 4, l: 8 },
  { value: '4x10', label: '4 × 10 ft', w: 4, l: 10 },
  { value: '4x12', label: '4 × 12 ft', w: 4, l: 12 },
  { value: '1200x2400', label: '1200 × 2400 mm', w: 1.2 / 0.3048, l: 2.4 / 0.3048 },
  { value: '1200x2700', label: '1200 × 2700 mm', w: 1.2 / 0.3048, l: 2.7 / 0.3048 },
]

export interface DrywallIn {
  /** Room length, width and wall height in ft. */
  length: number
  width: number
  height: number
  ceiling: boolean
  doors: number
  windows: number
  /** Sheet area in ft². */
  sheetArea: number
  /** Waste allowance in percent. */
  waste: number
}

export interface DrywallOut {
  walls: number
  ceiling: number
  openings: number
  /** Board area after openings, ft². */
  net: number
  sheets: number
  /** Drywall screws, about 1 per ft² of board. */
  screws: number
  /** Ready-mixed joint compound, about 9.4 US gal (138 lb) per 1,000 ft². */
  compoundGal: number
  /** 4.5 gal pails, rounded up. */
  pails: number
  /** Paper joint tape, about 370 ft per 1,000 ft². */
  tapeFt: number
  /** 250 ft rolls, rounded up. */
  tapeRolls: number
}

export function drywall(i: DrywallIn): DrywallOut {
  const walls = 2 * (i.length + i.width) * i.height
  const ceiling = i.ceiling ? i.length * i.width : 0
  const openings = Math.min(walls, i.doors * DOOR_FT2 + i.windows * WINDOW_FT2)
  const net = walls + ceiling - openings
  const sheets = Math.ceil((net * (1 + i.waste / 100)) / i.sheetArea - 1e-9)
  const board = sheets * i.sheetArea
  const compoundGal = (net * 9.4) / 1000
  const tapeFt = (net * 370) / 1000
  return {
    walls,
    ceiling,
    openings,
    net,
    sheets,
    screws: Math.ceil(board),
    compoundGal,
    pails: Math.ceil(compoundGal / 4.5 - 1e-9),
    tapeFt,
    tapeRolls: Math.ceil(tapeFt / 250 - 1e-9),
  }
}
