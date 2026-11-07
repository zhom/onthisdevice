/**
 * A calculator is data: its inputs, a pure `compute` and the chart it draws. One React engine
 * (Calculator.tsx) renders every spec, and scripts/calculators-test.mjs runs `compute` in Node,
 * so spec modules import only types and pure helpers here.
 */
import type { BarListProps, DonutProps, GaugeProps, LineChartProps, SplitProps, StackedBarsProps, TimelineProps } from '@/components/viz'

/** Raw text of each select, choice, date and text field, keyed by field id. */
export type Raw = Record<string, string>

interface FieldBase {
  id: string
  label: string | ((s: Raw) => string)
  hint?: string
  /** Shown only when this returns true. Hidden fields are not validated. */
  when?: (s: Raw) => boolean
  /** Takes half the row from 360 px up, so two fields sit side by side. */
  half?: boolean
}

export interface NumberField extends FieldBase {
  kind?: 'num'
  value: string
  unit?: string | ((s: Raw) => string)
  /** Inclusive limits. */
  min?: number
  max?: number
  /** Must be strictly above this value (0 for "above zero"). */
  above?: number
  int?: boolean
  /** Empty is allowed and reads as NaN. */
  optional?: boolean
  /** [min, max, step] for a slider under the field. */
  slider?: [number, number, number]
}

export type Option = readonly [value: string, label: string]

export interface SelectField extends FieldBase {
  kind: 'select' | 'choice'
  value: string
  options: readonly Option[]
}

export interface DateField extends FieldBase {
  kind: 'date'
  /** ISO date. */
  value: string
}

export interface TextField extends FieldBase {
  kind: 'text'
  value: string
  rows?: number
  placeholder?: string
}

export type Field = NumberField | SelectField | DateField | TextField

export interface Ctx {
  /** Number fields. A hidden or empty optional field is NaN. */
  n: Record<string, number>
  /** Every other field, as typed. */
  s: Raw
  /** Local midnight today. */
  today: Date
}

export type Fmt = (n: number) => string

export interface Main {
  label: string
  /** A number rolls with `format`; a string shows as is. */
  value: number | string
  format?: Fmt
  unit?: string
  /** One line under the main value. */
  sub?: string
}

export interface StatOut {
  label: string
  value: number | string
  format?: Fmt
  unit?: string
}

/** A drawing in math coordinates (y up), scaled to fit with equal axes and tweened. */
export interface ShapePath {
  pts: [number, number][]
  closed?: boolean
  fill?: 'ink' | 'grey' | 'hatch' | 'light' | 'none'
  line?: 'solid' | 'dash' | 'grey' | 'none'
  width?: number
}
export interface ShapeLabel {
  at: [number, number]
  text: string
  anchor?: 'start' | 'middle' | 'end'
  /** Pixel offset after scaling. */
  dx?: number
  dy?: number
  strong?: boolean
}
export interface ShapeProps {
  paths: ShapePath[]
  labels?: ShapeLabel[]
  dots?: [number, number][]
  summary: string
  ariaLabel?: string
  /** Drawing height in px. Default 240. */
  height?: number
}

export type Chart =
  | ({ kind: 'gauge' } & GaugeProps)
  | ({ kind: 'bars' } & BarListProps)
  | ({ kind: 'donut' } & DonutProps)
  | ({ kind: 'split' } & SplitProps)
  | ({ kind: 'line' } & LineChartProps)
  | ({ kind: 'stacked' } & StackedBarsProps)
  | ({ kind: 'timeline' } & TimelineProps)
  | ({ kind: 'shape' } & ShapeProps)

export interface Csv {
  filename: string
  columns: string[]
  rows: (string | number)[][]
}

export interface Out {
  main: Main
  stats?: StatOut[]
  /** The formula with the visitor's numbers, one step per line. */
  working: string[]
  /** Caption under the working: what each symbol means. */
  note?: string
  chart: Chart
  /** A table the visitor can download. */
  csv?: Csv
}

export interface Spec {
  inputs: Field[]
  compute: (x: Ctx) => Out
  /** The result depends on today's date, so it renders after hydration. */
  usesToday?: boolean
}

/** A message for inputs that cannot give a result. The engine shows it in place of the result. */
export class CalcError extends Error {}

export function fail(message: string): never {
  throw new CalcError(message)
}
