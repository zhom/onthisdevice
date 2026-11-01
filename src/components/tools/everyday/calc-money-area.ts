/**
 * Round-2 batch `calc-money` — room geometry for the square-footage family.
 *
 * Everything is normalised to feet and square feet internally; metric output is
 * converted at the point of display so the two systems never drift apart.
 */

export type LengthUnit = 'ft' | 'in' | 'm' | 'cm' | 'yd'

export const LENGTH_UNITS: { value: LengthUnit; label: string; perFoot: number }[] = [
  { value: 'ft', label: 'Feet', perFoot: 1 },
  { value: 'in', label: 'Inches', perFoot: 1 / 12 },
  { value: 'm', label: 'Metres', perFoot: 1 / 0.3048 },
  { value: 'cm', label: 'Centimetres', perFoot: 0.01 / 0.3048 },
  { value: 'yd', label: 'Yards', perFoot: 3 },
]

export const SQ_M_PER_SQ_FT = 0.3048 * 0.3048
export const SQ_FT_PER_SQ_YD = 9
export const CU_FT_PER_CU_YD = 27

/**
 * Parse a length. Plain numbers use the selected unit; feet-and-inches notation
 * ("12' 6", 12ft 6in, 12'6") is always read as feet and inches whatever the
 * unit selector says, because that is what the typist meant.
 */
export function parseLengthFeet(input: string, unit: LengthUnit): number {
  const text = input.trim().toLowerCase()
  if (!text) return 0

  const feetInches =
    /^(\d+(?:\.\d+)?)\s*(?:'|ft|feet|foot)\s*(?:(\d+(?:\.\d+)?)\s*(?:"|''|in|inch|inches)?)?$/.exec(
      text,
    )
  if (feetInches) {
    return Number(feetInches[1]) + (feetInches[2] ? Number(feetInches[2]) / 12 : 0)
  }

  const inchesOnly = /^(\d+(?:\.\d+)?)\s*(?:"|''|in|inch|inches)$/.exec(text)
  if (inchesOnly) return Number(inchesOnly[1]) / 12

  const metres = /^(\d+(?:\.\d+)?)\s*(?:m|metre|meter|metres|meters)$/.exec(text)
  if (metres) return Number(metres[1]) / 0.3048

  const cm = /^(\d+(?:\.\d+)?)\s*(?:cm|centimetre|centimeter)s?$/.exec(text)
  if (cm) return (Number(cm[1]) * 0.01) / 0.3048

  const cleaned = text.replace(/[^0-9.]/g, '')
  const value = Number(cleaned)
  if (!Number.isFinite(value)) return 0
  const perFoot = LENGTH_UNITS.find((u) => u.value === unit)?.perFoot ?? 1
  return value * perFoot
}

/** 12.75 ft → `12' 9"` */
export function formatFeetInches(feet: number): string {
  if (!Number.isFinite(feet)) return '–'
  const whole = Math.floor(feet)
  const inches = Math.round((feet - whole) * 12)
  if (inches === 12) return `${whole + 1}' 0"`
  return `${whole}' ${inches}"`
}

export type ShapeId =
  | 'rectangle'
  | 'square'
  | 'lshape'
  | 'triangle'
  | 'circle'
  | 'trapezoid'
  | 'room'
  | 'wall'
  | 'slab'
  | 'column'

export interface ShapeDef {
  id: ShapeId
  label: string
  /** Field labels, in order. An empty slot means the field is hidden. */
  fields: string[]
  /** Depth field label, for volume shapes. */
  depthField?: string
  /** Area in square feet from dimensions already converted to feet. */
  area: (dims: number[]) => number
  /** Human formula with the dimension letters. */
  formula: string
}

const [A, B, C, D] = [0, 1, 2, 3]

export const SHAPES: Record<ShapeId, ShapeDef> = {
  rectangle: {
    id: 'rectangle',
    label: 'Rectangle',
    fields: ['Length', 'Width'],
    area: (v) => (v[A] ?? 0) * (v[B] ?? 0),
    formula: 'length × width',
  },
  square: {
    id: 'square',
    label: 'Square',
    fields: ['Side'],
    area: (v) => (v[A] ?? 0) ** 2,
    formula: 'side²',
  },
  lshape: {
    id: 'lshape',
    label: 'L-shape',
    fields: ['Long side', 'Full width', 'Cut-out length', 'Cut-out width'],
    area: (v) => (v[A] ?? 0) * (v[B] ?? 0) - (v[C] ?? 0) * (v[D] ?? 0),
    formula: '(long × width) − (cut-out length × cut-out width)',
  },
  triangle: {
    id: 'triangle',
    label: 'Triangle',
    fields: ['Base', 'Height'],
    area: (v) => ((v[A] ?? 0) * (v[B] ?? 0)) / 2,
    formula: '(base × height) ÷ 2',
  },
  circle: {
    id: 'circle',
    label: 'Circle',
    fields: ['Diameter'],
    area: (v) => Math.PI * ((v[A] ?? 0) / 2) ** 2,
    formula: 'π × (diameter ÷ 2)²',
  },
  trapezoid: {
    id: 'trapezoid',
    label: 'Trapezoid',
    fields: ['Side A', 'Side B', 'Height'],
    area: (v) => (((v[A] ?? 0) + (v[B] ?? 0)) / 2) * (v[C] ?? 0),
    formula: '((a + b) ÷ 2) × height',
  },
  room: {
    id: 'room',
    label: 'Room (four walls)',
    fields: ['Length', 'Width', 'Wall height'],
    area: (v) => 2 * ((v[A] ?? 0) + (v[B] ?? 0)) * (v[C] ?? 0),
    formula: '2 × (length + width) × wall height',
  },
  wall: {
    id: 'wall',
    label: 'Single wall',
    fields: ['Width', 'Height'],
    area: (v) => (v[A] ?? 0) * (v[B] ?? 0),
    formula: 'width × height',
  },
  slab: {
    id: 'slab',
    label: 'Slab / footing',
    fields: ['Length', 'Width'],
    depthField: 'Thickness (in)',
    area: (v) => (v[A] ?? 0) * (v[B] ?? 0),
    formula: 'length × width × thickness',
  },
  column: {
    id: 'column',
    label: 'Round column / post hole',
    fields: ['Diameter'],
    depthField: 'Depth (in)',
    area: (v) => Math.PI * ((v[A] ?? 0) / 2) ** 2,
    formula: 'π × (diameter ÷ 2)² × depth',
  },
}

export const SHAPES_BY_VARIANT: Record<string, ShapeId[]> = {
  area: ['rectangle', 'square', 'lshape', 'triangle', 'circle', 'trapezoid'],
  flooring: ['rectangle', 'square', 'lshape', 'triangle', 'circle', 'trapezoid'],
  tile: ['rectangle', 'square', 'lshape', 'wall', 'triangle', 'circle'],
  paint: ['room', 'wall'],
  concrete: ['slab', 'column'],
}
