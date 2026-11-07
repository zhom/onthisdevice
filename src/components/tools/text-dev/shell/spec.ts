/**
 * What one tool of a family is: an optional main text input, options, modes, and a run function
 * that turns them into a Result. ToolShell renders any Spec, so a tool is data plus an engine.
 */

export type Value = string | number | boolean
export type Values = Record<string, Value>

interface FieldBase {
  id: string
  label: string
  hint?: string
  /** Show the field only in these modes. */
  modes?: readonly string[]
}

export interface TextField extends FieldBase {
  kind: 'text'
  default: string
  placeholder?: string
  mono?: boolean
}

export interface AreaField extends FieldBase {
  kind: 'area'
  default: string
  placeholder?: string
  rows?: number
  mono?: boolean
}

export interface NumberField extends FieldBase {
  kind: 'number'
  default: number
  min: number
  max: number
  step?: number
}

export interface Choice {
  value: string
  label: string
}

export interface ChoiceField extends FieldBase {
  kind: 'choice'
  default: string
  choices: readonly Choice[]
}

export interface ToggleField extends FieldBase {
  kind: 'toggle'
  default: boolean
}

/** Several checkboxes. The value is the checked values joined with commas. */
export interface ChecksField extends FieldBase {
  kind: 'checks'
  default: string
  choices: readonly Choice[]
}

export interface ColorField extends FieldBase {
  kind: 'color'
  default: string
}

export type Field = TextField | AreaField | NumberField | ChoiceField | ToggleField | ChecksField | ColorField

export interface Row {
  label: string
  value: string
}

export interface Stat {
  label: string
  value: string | number
  hint?: string
}

export interface Block {
  label: string
  text: string
  filename: string
}

export interface Verdict {
  ok: boolean
  title: string
  detail?: string
}

export interface DataTable {
  head: readonly string[]
  rows: readonly (readonly (string | number)[])[]
}

export interface Bar {
  label: string
  value: number
}

export interface Result {
  /** The main output: copied and downloaded. */
  text?: string
  verdict?: Verdict
  stats?: readonly Stat[]
  rows?: readonly Row[]
  table?: DataTable
  bars?: { items: readonly Bar[]; summary: string }
  blocks?: readonly Block[]
  /** One short line under the output. */
  note?: string
}

export type Run = (input: string, values: Values) => Result | string | Promise<Result | string>

export interface Mode {
  id: string
  label: string
  run: Run
  inputLabel?: string
  sample?: string
  outputLabel?: string
  filename?: string
  /** Button label in this mode, for tools with an action. */
  action?: string
}

export interface InputSpec {
  label: string
  sample: string
  placeholder?: string
  mono?: boolean
  rows?: number
  hint?: string
}

export interface OutputSpec {
  label: string
  filename: string
  rows?: number
  mono?: boolean
  /** Shown before there is a result. */
  empty?: string
}

interface SpecBase {
  /** The main text input. Without it the tool is a form. */
  input?: InputSpec
  fields?: readonly Field[]
  output?: OutputSpec
  /** Button label. With an action the tool runs on click, and once on load. */
  action?: string
  /** Adds "Use as input", which moves the output to the input and switches between two modes. */
  swap?: boolean
}

export type Spec = SpecBase & ({ modes: readonly Mode[]; run?: undefined } | { run: Run; modes?: undefined })

export type Specs = Record<string, Spec>

export const str = (v: Values, key: string): string => {
  const x = v[key]
  return typeof x === 'string' ? x : x === undefined ? '' : String(x)
}

export const num = (v: Values, key: string): number => {
  const x = v[key]
  return typeof x === 'number' ? x : Number(x ?? 0)
}

export const bool = (v: Values, key: string): boolean => v[key] === true

export const list = (v: Values, key: string): string[] =>
  str(v, key)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

export function defaults(fields: readonly Field[] = []): Values {
  const out: Values = {}
  for (const f of fields) out[f.id] = f.default
  return out
}

/** A choice value narrowed to the allowed set; anything else gives the first allowed value. */
export function pick<T extends string>(v: Values, key: string, allowed: readonly T[]): T {
  const x = str(v, key)
  return (allowed as readonly string[]).includes(x) ? (x as T) : allowed[0]
}
