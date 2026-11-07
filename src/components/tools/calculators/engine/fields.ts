/** Short builders for the common field kinds of the specs. */
import type { NumberField, Option, Raw, SelectField } from './types'

type Label = string | ((s: Raw) => string)

type More = Partial<Omit<NumberField, 'id' | 'label' | 'value'>>

/** A dollar amount, 0 or more. */
export const money = (id: string, label: Label, value: string, o: More = {}): NumberField => ({ id, label, value, unit: '$', min: 0, ...o })

/** A percentage from 0 to 100. */
export const percent = (id: string, label: Label, value: string, o: More = {}): NumberField => ({ id, label, value, unit: '%', min: 0, max: 100, ...o })

/** Any number with an optional unit. */
export const num = (id: string, label: Label, value: string, unit?: string, o: More = {}): NumberField => ({ id, label, value, unit, ...o })

/** A number that must be above zero. */
export const pos = (id: string, label: Label, value: string, unit?: string, o: More = {}): NumberField => ({ id, label, value, unit, above: 0, ...o })

/** Segmented buttons for 2 to 4 short options. */
export const choice = (id: string, label: Label, value: string, options: readonly Option[], o: Partial<SelectField> = {}): SelectField => ({ id, label, value, options, kind: 'choice', ...o })

/** A drop-down. */
export const select = (id: string, label: Label, value: string, options: readonly Option[], o: Partial<SelectField> = {}): SelectField => ({ id, label, value, options, kind: 'select', ...o })
