/**
 * units-life batch — per-page configuration for the shared PairConverter.
 *
 * One entry per URL. The Astro page passes only the string key, so this table
 * is what makes each pair page different: units, default value, extra
 * readouts, the reference table, and the formula wording.
 */

import type { UnitId } from './units-life-engine'

export type ExtraReadout =
  | { kind: 'fraction'; unit: UnitId; denominator: number; label: string; hint?: string }
  | { kind: 'composite'; major: UnitId; minor: UnitId; decimals: number; label: string; hint?: string }
  | { kind: 'unit'; unit: UnitId; label: string; hint?: string }

export type FormulaOp =
  | { kind: 'multiply'; operand: string }
  | { kind: 'divide'; operand: string }
  | { kind: 'affine'; expression: string; steps: (input: string) => string[] }

export interface PairSpec {
  key: string
  from: UnitId
  to: UnitId
  /** Field label for the source input. */
  fromLabel: string
  /** Field label for the result input. */
  toLabel: string
  /** Placeholder / example for the source input. */
  placeholder: string
  /** Short hint under the source input describing accepted formats. */
  inputHint: string
  defaultInput: string
  /** Slug of the page that runs the same conversion the other way. */
  reverseSlug?: string
  reverseLabel?: string
  extras: ExtraReadout[]
  formula: FormulaOp
  /** Values (in the source unit) used to build the reference table. */
  tableValues: number[]
  tableTitle: string
  tableCaption: string
  /** Optional slider, in source-unit values. */
  slider?: { min: number; max: number; step: number; marks: number[] }
  /** Optional interpretation band list keyed on the source unit value. */
  bands?: { max: number; label: string; note: string; tone: 'info' | 'ok' | 'warn' | 'bad' }[]
  bandsTitle?: string
  /** Default rounding for the result field. */
  defaultPrecision: number | 'auto'
}

const INCH_FRACTION_HINT = 'Snapped to the nearest sixteenth, the smallest mark on most tape measures.'

export const PAIR_SPECS: Record<string, PairSpec> = {
  /* ---------------- length: metric ↔ inch ---------------- */

  'cm-to-inches': {
    key: 'cm-to-inches',
    from: 'cm',
    to: 'in',
    fromLabel: 'Centimetres',
    toLabel: 'Inches',
    placeholder: '30',
    inputHint: 'Decimals are fine. You can also paste “30 cm” or a whole column of values in Batch mode.',
    defaultInput: '30',
    reverseSlug: 'inches-to-cm',
    reverseLabel: 'Inches to cm',
    extras: [
      { kind: 'fraction', unit: 'in', denominator: 16, label: 'Nearest 1/16 in', hint: INCH_FRACTION_HINT },
      { kind: 'composite', major: 'ft', minor: 'in', decimals: 1, label: 'Feet and inches', hint: 'How a height would be read out loud.' },
      { kind: 'unit', unit: 'mm', label: 'Millimetres', hint: 'The same length on a metric rule.' },
    ],
    formula: { kind: 'divide', operand: '2.54' },
    tableValues: [1, 2, 3, 5, 10, 15, 20, 25, 30, 40, 50, 60, 75, 90, 100, 120, 150, 180, 200],
    tableTitle: 'Centimetres to inches: quick reference',
    tableCaption: 'Exact values, then the nearest tape-measure fraction.',
    defaultPrecision: 4,
  },

  'inches-to-cm': {
    key: 'inches-to-cm',
    from: 'in',
    to: 'cm',
    fromLabel: 'Inches',
    toLabel: 'Centimetres',
    placeholder: `5 1/2`,
    inputHint: `Accepts 5.5, 5 1/2, 5½ and 5'6". Type it the way it is written on your plan or tape.`,
    defaultInput: '12',
    reverseSlug: 'cm-to-inches',
    reverseLabel: 'CM to inches',
    extras: [
      { kind: 'unit', unit: 'mm', label: 'Millimetres', hint: 'What CAD, laser cutters and CNC files usually want.' },
      { kind: 'unit', unit: 'm', label: 'Metres', hint: 'Useful once you are past a couple of hundred centimetres.' },
      { kind: 'composite', major: 'ft', minor: 'in', decimals: 2, label: 'Feet and inches', hint: 'Your input restated in feet.' },
    ],
    formula: { kind: 'multiply', operand: '2.54' },
    tableValues: [0.25, 0.5, 1, 2, 3, 4, 5, 6, 8, 10, 12, 18, 24, 30, 36, 48, 60, 72],
    tableTitle: 'Inches to centimetres: quick reference',
    tableCaption: 'Every value is exact: the inch is defined as exactly 2.54 cm.',
    defaultPrecision: 2,
  },

  'mm-to-inches': {
    key: 'mm-to-inches',
    from: 'mm',
    to: 'in',
    fromLabel: 'Millimetres',
    toLabel: 'Inches',
    placeholder: '25.4',
    inputHint: 'Drill sizes, sheet thicknesses and bolt diameters all work here.',
    defaultInput: '25.4',
    reverseSlug: 'inches-to-mm',
    reverseLabel: 'Inches to mm',
    extras: [
      { kind: 'fraction', unit: 'in', denominator: 64, label: 'Nearest 1/64 in', hint: 'Machinist resolution: 0.4 mm per step.' },
      { kind: 'fraction', unit: 'in', denominator: 32, label: 'Nearest 1/32 in', hint: 'Common for timber and sheet goods.' },
      { kind: 'fraction', unit: 'in', denominator: 16, label: 'Nearest 1/16 in', hint: INCH_FRACTION_HINT },
    ],
    formula: { kind: 'divide', operand: '25.4' },
    tableValues: [1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 16, 19, 20, 25, 25.4, 30, 40, 50, 100],
    tableTitle: 'Millimetres to inches: shop reference',
    tableCaption: 'Print this: decimal inches next to the fraction you will actually cut to.',
    defaultPrecision: 4,
  },

  'inches-to-mm': {
    key: 'inches-to-mm',
    from: 'in',
    to: 'mm',
    fromLabel: 'Inches',
    toLabel: 'Millimetres',
    placeholder: '3/8',
    inputHint: 'Fractions welcome: 3/8, 1 1/4, 0.375. Imperial drawings usually give you fractions.',
    defaultInput: '3/8',
    reverseSlug: 'mm-to-inches',
    reverseLabel: 'MM to inches',
    extras: [
      { kind: 'unit', unit: 'cm', label: 'Centimetres', hint: 'Same number, decimal point moved one place.' },
      { kind: 'unit', unit: 'm', label: 'Metres', hint: 'For long runs on a metric drawing.' },
      { kind: 'fraction', unit: 'in', denominator: 64, label: 'Input as a fraction', hint: 'What you typed, snapped to 1/64 in.' },
    ],
    formula: { kind: 'multiply', operand: '25.4' },
    tableValues: [0.0625, 0.125, 0.1875, 0.25, 0.3125, 0.375, 0.5, 0.625, 0.75, 0.875, 1, 1.5, 2, 3, 4, 6, 12],
    tableTitle: 'Fractional inches to millimetres',
    tableCaption: 'The sixteenths ladder, converted exactly.',
    defaultPrecision: 3,
  },

  /* ---------------- length: metre ↔ foot ---------------- */

  'meters-to-feet': {
    key: 'meters-to-feet',
    from: 'm',
    to: 'ft',
    fromLabel: 'Metres',
    toLabel: 'Feet (decimal)',
    placeholder: '1.75',
    inputHint: 'Heights, room dimensions, ceiling drops: anything in metres.',
    defaultInput: '1.75',
    reverseSlug: 'feet-to-meters',
    reverseLabel: 'Feet to metres',
    extras: [
      { kind: 'composite', major: 'ft', minor: 'in', decimals: 1, label: 'Feet and inches', hint: 'The form most people want: 1.75 m is 5 ft 8.9 in (5.74 ft as a decimal).' },
      { kind: 'fraction', unit: 'in', denominator: 16, label: 'Total inches (fraction)', hint: 'The whole length expressed in inches.' },
      { kind: 'unit', unit: 'yd', label: 'Yards', hint: 'Three feet to the yard.' },
    ],
    formula: { kind: 'divide', operand: '0.3048' },
    tableValues: [1, 1.5, 1.6, 1.65, 1.7, 1.75, 1.8, 1.85, 1.9, 2, 2.4, 3, 5, 10, 20, 50, 100],
    tableTitle: 'Metres to feet and inches',
    tableCaption: 'Decimal feet in one column, the spoken feet-and-inches form in the next.',
    defaultPrecision: 4,
  },

  'feet-to-meters': {
    key: 'feet-to-meters',
    from: 'ft',
    to: 'm',
    fromLabel: 'Feet',
    toLabel: 'Metres',
    placeholder: `5'10"`,
    inputHint: `Type 5'10", 5 ft 10 in, or plain decimal feet like 5.833.`,
    defaultInput: `5'10"`,
    reverseSlug: 'meters-to-feet',
    reverseLabel: 'Metres to feet',
    extras: [
      { kind: 'unit', unit: 'cm', label: 'Centimetres', hint: 'The unit most passport and gym forms ask for.' },
      { kind: 'unit', unit: 'mm', label: 'Millimetres', hint: 'For anyone working to a metric drawing.' },
      { kind: 'composite', major: 'ft', minor: 'in', decimals: 2, label: 'Your input, tidied', hint: 'What we read your entry as.' },
    ],
    formula: { kind: 'multiply', operand: '0.3048' },
    tableValues: [1, 2, 3, 4, 5, 5.5, 6, 7, 8, 9, 10, 12, 15, 20, 25, 50, 100],
    tableTitle: 'Feet to metres: quick reference',
    tableCaption: 'One foot is exactly 0.3048 m, so every row here is exact.',
    defaultPrecision: 4,
  },

  'yards-to-meters': {
    key: 'yards-to-meters',
    from: 'yd',
    to: 'm',
    fromLabel: 'Yards',
    toLabel: 'Metres',
    placeholder: '100',
    inputHint: 'Fabric lengths, sports fields, garden turf: yards in, metres out.',
    defaultInput: '100',
    extras: [
      { kind: 'unit', unit: 'cm', label: 'Centimetres', hint: 'Fabric shops usually cut to the centimetre.' },
      { kind: 'unit', unit: 'ft', label: 'Feet', hint: 'Exactly three feet per yard.' },
      { kind: 'unit', unit: 'in', label: 'Inches', hint: 'Exactly 36 inches per yard.' },
    ],
    formula: { kind: 'multiply', operand: '0.9144' },
    tableValues: [1, 2, 3, 5, 10, 18, 25, 40, 50, 60, 75, 100, 110, 120, 200, 440, 880, 1760],
    tableTitle: 'Yards to metres: quick reference',
    tableCaption: 'A yard is exactly 0.9144 m, which is why 100 yd is 91.44 m and not 91.5.',
    defaultPrecision: 4,
  },

  /* ---------------- length: road distance ---------------- */

  'miles-to-km': {
    key: 'miles-to-km',
    from: 'mi',
    to: 'km',
    fromLabel: 'Miles',
    toLabel: 'Kilometres',
    placeholder: '26.2',
    inputHint: 'Road distances, run splits, odometer readings.',
    defaultInput: '26.2',
    reverseSlug: 'km-to-miles',
    reverseLabel: 'KM to miles',
    extras: [
      { kind: 'unit', unit: 'm', label: 'Metres', hint: 'Useful for track distances.' },
      { kind: 'unit', unit: 'yd', label: 'Yards', hint: '1,760 yards to the mile.' },
      { kind: 'unit', unit: 'ft', label: 'Feet', hint: '5,280 feet to the mile.' },
    ],
    formula: { kind: 'multiply', operand: '1.609344' },
    tableValues: [1, 2, 3, 3.1, 5, 6.2, 10, 13.1, 15, 20, 26.2, 30, 50, 60, 70, 100],
    tableTitle: 'Miles to kilometres: quick reference',
    tableCaption: 'Race distances included: 3.1 mi is the 5K, 13.1 mi the half, 26.2 mi the marathon.',
    defaultPrecision: 3,
  },

  'km-to-miles': {
    key: 'km-to-miles',
    from: 'km',
    to: 'mi',
    fromLabel: 'Kilometres',
    toLabel: 'Miles',
    placeholder: '5',
    inputHint: 'Works for speeds too: 100 km/h into mph is the same arithmetic.',
    defaultInput: '5',
    reverseSlug: 'miles-to-km',
    reverseLabel: 'Miles to km',
    extras: [
      { kind: 'unit', unit: 'm', label: 'Metres', hint: 'One thousand to the kilometre.' },
      { kind: 'unit', unit: 'ft', label: 'Feet', hint: 'For elevation profiles quoted in feet.' },
      { kind: 'unit', unit: 'yd', label: 'Yards', hint: 'Handy on a running track.' },
    ],
    formula: { kind: 'divide', operand: '1.609344' },
    tableValues: [1, 2, 3, 5, 8, 10, 15, 20, 21.0975, 25, 30, 42.195, 50, 80, 100, 120, 130],
    tableTitle: 'Kilometres to miles: quick reference',
    tableCaption: 'Includes the exact half-marathon (21.0975 km) and marathon (42.195 km) distances.',
    defaultPrecision: 4,
  },

  /* ---------------- mass ---------------- */

  'kg-to-lbs': {
    key: 'kg-to-lbs',
    from: 'kg',
    to: 'lb',
    fromLabel: 'Kilograms',
    toLabel: 'Pounds',
    placeholder: '70',
    inputHint: 'Body weight, luggage, parcels. Paste a whole column in Batch mode.',
    defaultInput: '70',
    reverseSlug: 'lbs-to-kg',
    reverseLabel: 'LBS to KG',
    extras: [
      { kind: 'composite', major: 'st', minor: 'lb', decimals: 1, label: 'Stone and pounds', hint: 'How weight is normally said in the UK and Ireland.' },
      { kind: 'composite', major: 'lb', minor: 'oz', decimals: 1, label: 'Pounds and ounces', hint: 'For parcels and small items.' },
      { kind: 'unit', unit: 'g', label: 'Grams', hint: 'The same mass on a kitchen scale.' },
    ],
    formula: { kind: 'divide', operand: '0.45359237' },
    tableValues: [1, 5, 10, 20, 30, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 100, 120],
    tableTitle: 'Kilograms to pounds: quick reference',
    tableCaption: 'Also shown in stone and pounds, because that is what UK scales read.',
    defaultPrecision: 2,
  },

  'lbs-to-kg': {
    key: 'lbs-to-kg',
    from: 'lb',
    to: 'kg',
    fromLabel: 'Pounds',
    toLabel: 'Kilograms',
    placeholder: '150',
    inputHint: 'Accepts plain pounds, or a stone-and-pound entry like “11 st 4 lb”.',
    defaultInput: '150',
    reverseSlug: 'kg-to-lbs',
    reverseLabel: 'KG to LBS',
    extras: [
      { kind: 'unit', unit: 'g', label: 'Grams', hint: 'For recipes and postage scales.' },
      { kind: 'composite', major: 'st', minor: 'lb', decimals: 1, label: 'Stone and pounds', hint: 'Your input restated the British way.' },
      { kind: 'unit', unit: 'oz', label: 'Ounces', hint: 'Sixteen ounces to the pound.' },
    ],
    formula: { kind: 'multiply', operand: '0.45359237' },
    tableValues: [1, 10, 20, 50, 100, 110, 120, 130, 140, 150, 160, 170, 180, 200, 220, 250, 300],
    tableTitle: 'Pounds to kilograms: quick reference',
    tableCaption: 'The pound is defined as exactly 0.45359237 kg, so nothing here is approximate.',
    defaultPrecision: 3,
  },

  'kg-to-stone': {
    key: 'kg-to-stone',
    from: 'kg',
    to: 'st',
    fromLabel: 'Kilograms',
    toLabel: 'Stone (decimal)',
    placeholder: '75',
    inputHint: 'Decimal stone is the raw answer; the stone-and-pounds readout below is the useful one.',
    defaultInput: '75',
    extras: [
      { kind: 'composite', major: 'st', minor: 'lb', decimals: 1, label: 'Stone and pounds', hint: 'The form a UK bathroom scale or GP surgery uses.' },
      { kind: 'unit', unit: 'lb', label: 'Pounds', hint: 'Fourteen pounds to the stone.' },
      { kind: 'unit', unit: 'g', label: 'Grams', hint: 'For completeness.' },
    ],
    formula: { kind: 'divide', operand: '6.35029318' },
    tableValues: [40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100, 110, 120, 130],
    tableTitle: 'Kilograms to stone and pounds',
    tableCaption: 'Decimal stone alongside the stone-and-pounds reading.',
    defaultPrecision: 3,
  },

  'stone-to-pounds': {
    key: 'stone-to-pounds',
    from: 'st',
    to: 'lb',
    fromLabel: 'Stone',
    toLabel: 'Pounds',
    placeholder: '11 st 4 lb',
    inputHint: 'Type “11 st 4 lb”, “11.5” or “11”. All three work.',
    defaultInput: '11 st 4 lb',
    extras: [
      { kind: 'unit', unit: 'kg', label: 'Kilograms', hint: 'The metric equivalent.' },
      { kind: 'composite', major: 'st', minor: 'lb', decimals: 1, label: 'Your input, tidied', hint: 'What we read your entry as.' },
      { kind: 'unit', unit: 'g', label: 'Grams', hint: 'Rarely needed, occasionally asked for.' },
    ],
    formula: { kind: 'multiply', operand: '14' },
    tableValues: [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 20, 22, 25],
    tableTitle: 'Stone to pounds and kilograms',
    tableCaption: 'A stone is exactly 14 pounds, so the conversion is always a whole number.',
    defaultPrecision: 1,
  },

  'grams-to-ounces': {
    key: 'grams-to-ounces',
    from: 'g',
    to: 'oz',
    fromLabel: 'Grams',
    toLabel: 'Ounces (avoirdupois)',
    placeholder: '250',
    inputHint: 'Kitchen scales, postage, jewellery. These are weight ounces, not fluid ounces.',
    defaultInput: '250',
    reverseSlug: 'ounces-to-grams',
    reverseLabel: 'Ounces to grams',
    extras: [
      { kind: 'composite', major: 'lb', minor: 'oz', decimals: 2, label: 'Pounds and ounces', hint: 'How a postage counter reads it.' },
      { kind: 'unit', unit: 'lb', label: 'Pounds (decimal)', hint: 'For shipping calculators that want a decimal.' },
      { kind: 'unit', unit: 'kg', label: 'Kilograms', hint: 'Divide by a thousand.' },
    ],
    formula: { kind: 'divide', operand: '28.349523125' },
    tableValues: [1, 5, 10, 25, 50, 75, 100, 113, 125, 150, 200, 225, 250, 340, 450, 500, 750, 1000],
    tableTitle: 'Grams to ounces: kitchen reference',
    tableCaption: 'Includes the awkward ones: 113 g is a stick of butter, 450 g is about a pound.',
    defaultPrecision: 3,
  },

  'ounces-to-grams': {
    key: 'ounces-to-grams',
    from: 'oz',
    to: 'g',
    fromLabel: 'Ounces (avoirdupois)',
    toLabel: 'Grams',
    placeholder: '8',
    inputHint: 'Fractions work: 1/2, 3/4, 1 1/2. Weight ounces only (see the note on fluid ounces below).',
    defaultInput: '8',
    reverseSlug: 'grams-to-ounces',
    reverseLabel: 'Grams to ounces',
    extras: [
      { kind: 'unit', unit: 'kg', label: 'Kilograms', hint: 'For anything over a kilo.' },
      { kind: 'unit', unit: 'lb', label: 'Pounds', hint: 'Sixteen ounces to the pound.' },
      { kind: 'composite', major: 'lb', minor: 'oz', decimals: 2, label: 'Pounds and ounces', hint: 'Your input restated.' },
    ],
    formula: { kind: 'multiply', operand: '28.349523125' },
    tableValues: [0.25, 0.5, 0.75, 1, 2, 3, 4, 5, 6, 8, 10, 12, 14, 16, 20, 24, 32],
    tableTitle: 'Ounces to grams: kitchen reference',
    tableCaption: 'Four ounces is a quarter pound; sixteen is a full pound (453.59 g).',
    defaultPrecision: 2,
  },

  'kg-to-pounds-and-ounces': {
    key: 'kg-to-pounds-and-ounces',
    from: 'kg',
    to: 'lb',
    fromLabel: 'Kilograms',
    toLabel: 'Pounds (decimal)',
    placeholder: '3.4',
    inputHint: 'Newborn weights, parcels, luggage. Grams work too: type 3400 g.',
    defaultInput: '3.4',
    extras: [
      { kind: 'composite', major: 'lb', minor: 'oz', decimals: 1, label: 'Pounds and ounces', hint: 'The main answer: how birth weights and parcels are quoted.' },
      { kind: 'unit', unit: 'oz', label: 'Total ounces', hint: 'The whole mass expressed in ounces.' },
      { kind: 'unit', unit: 'g', label: 'Grams', hint: 'What the hospital scale printed.' },
    ],
    formula: { kind: 'divide', operand: '0.45359237' },
    tableValues: [2, 2.5, 2.8, 3, 3.2, 3.4, 3.6, 3.8, 4, 4.5, 5, 10, 15, 20, 23],
    tableTitle: 'Kilograms to pounds and ounces',
    tableCaption: 'Centred on the birth-weight range, then extended to luggage allowances.',
    defaultPrecision: 4,
  },

  /* ---------------- temperature ---------------- */

  'celsius-to-fahrenheit': {
    key: 'celsius-to-fahrenheit',
    from: 'c',
    to: 'f',
    fromLabel: 'Celsius',
    toLabel: 'Fahrenheit',
    placeholder: '20',
    inputHint: 'Negative values are fine. Drag the slider for a feel of the scale.',
    defaultInput: '20',
    reverseSlug: 'fahrenheit-to-celsius',
    reverseLabel: 'Fahrenheit to Celsius',
    extras: [{ kind: 'unit', unit: 'k', label: 'Kelvin', hint: 'The SI absolute scale: Celsius plus 273.15.' }],
    formula: {
      kind: 'affine',
      expression: '°F = (°C × 9/5) + 32',
      steps: (input) => [`°F = (${input} × 9/5) + 32`, `°F = ${input} × 1.8 + 32`],
    },
    tableValues: [-40, -20, -10, 0, 4, 10, 16, 20, 25, 30, 35, 37, 38, 40, 60, 100, 180, 200, 220],
    tableTitle: 'Celsius to Fahrenheit: reference points',
    tableCaption: 'Freezing, body temperature, fever thresholds and oven ranges in one table.',
    slider: { min: -40, max: 250, step: 1, marks: [-40, 0, 37, 100, 180, 250] },
    defaultPrecision: 2,
  },

  'fahrenheit-to-celsius': {
    key: 'fahrenheit-to-celsius',
    from: 'f',
    to: 'c',
    fromLabel: 'Fahrenheit',
    toLabel: 'Celsius',
    placeholder: '98.6',
    inputHint: 'Thermostats, weather forecasts, US recipes and thermometers.',
    defaultInput: '98.6',
    reverseSlug: 'celsius-to-fahrenheit',
    reverseLabel: 'Celsius to Fahrenheit',
    extras: [{ kind: 'unit', unit: 'k', label: 'Kelvin', hint: 'Absolute temperature, for the physics homework.' }],
    formula: {
      kind: 'affine',
      expression: '°C = (°F − 32) × 5/9',
      steps: (input) => [`°C = (${input} − 32) × 5/9`, `°C = (${input} − 32) ÷ 1.8`],
    },
    tableValues: [-40, 0, 20, 32, 40, 50, 60, 68, 72, 80, 90, 98.6, 100.4, 104, 212, 350, 400, 425],
    tableTitle: 'Fahrenheit to Celsius: reference points',
    tableCaption: 'Weather, thermostat settings, fever readings and US oven dials.',
    slider: { min: -40, max: 480, step: 1, marks: [-40, 32, 98.6, 212, 350, 480] },
    defaultPrecision: 2,
  },

  'celsius-to-kelvin': {
    key: 'celsius-to-kelvin',
    from: 'c',
    to: 'k',
    fromLabel: 'Celsius',
    toLabel: 'Kelvin',
    placeholder: '25',
    inputHint: 'The offset is exactly 273.15. There is no multiplication.',
    defaultInput: '25',
    extras: [{ kind: 'unit', unit: 'f', label: 'Fahrenheit', hint: 'The third scale, for completeness.' }],
    formula: {
      kind: 'affine',
      expression: 'K = °C + 273.15',
      steps: (input) => [`K = ${input} + 273.15`],
    },
    tableValues: [-273.15, -200, -100, -40, 0, 10, 20, 25, 37, 100, 200, 500, 1000],
    tableTitle: 'Celsius to Kelvin: reference points',
    tableCaption: 'Absolute zero is −273.15 °C, which is 0 K exactly.',
    slider: { min: -273.15, max: 1000, step: 0.05, marks: [-273.15, 0, 25, 100, 500, 1000] },
    defaultPrecision: 2,
  },

  'fever-temperature-converter': {
    key: 'fever-temperature-converter',
    from: 'c',
    to: 'f',
    fromLabel: 'Celsius',
    toLabel: 'Fahrenheit',
    placeholder: '38.2',
    inputHint: 'Type the reading exactly as your thermometer shows it.',
    defaultInput: '38.2',
    extras: [{ kind: 'unit', unit: 'k', label: 'Kelvin', hint: 'Included only because the arithmetic is free.' }],
    formula: {
      kind: 'affine',
      expression: '°F = (°C × 9/5) + 32',
      steps: (input) => [`°F = (${input} × 9/5) + 32`, `°F = ${input} × 1.8 + 32`],
    },
    tableValues: [35, 35.5, 36, 36.5, 36.8, 37, 37.2, 37.5, 37.8, 38, 38.5, 39, 39.5, 40, 40.5, 41, 42],
    tableTitle: 'Fever thresholds in both scales',
    tableCaption:
      'Thresholds vary by measurement site; these are the widely used oral/tympanic figures.',
    slider: { min: 34, max: 42, step: 0.1, marks: [34, 36, 37, 38, 40, 42] },
    bandsTitle: 'What this reading is usually called',
    bands: [
      { max: 35, label: 'Hypothermia range', note: 'Below 35 °C (95 °F) is classed as hypothermia and is a medical emergency.', tone: 'bad' },
      { max: 36.5, label: 'Low-normal', note: 'Normal body temperature dips in the early hours and after rest.', tone: 'info' },
      { max: 37.5, label: 'Normal', note: 'A healthy adult sits roughly between 36.5 °C and 37.5 °C (97.7–99.5 °F) across the day.', tone: 'ok' },
      { max: 38, label: 'Elevated / low-grade', note: 'Above normal but under the usual fever threshold. Often called a low-grade temperature.', tone: 'warn' },
      { max: 39, label: 'Fever', note: '38 °C (100.4 °F) is the threshold most health services use to define a fever.', tone: 'warn' },
      { max: 40, label: 'High fever', note: 'From 39 °C (102.2 °F). Worth medical advice, especially for infants and older adults.', tone: 'bad' },
      { max: Infinity, label: 'Very high fever', note: '40 °C (104 °F) and above needs urgent medical assessment.', tone: 'bad' },
    ],
    defaultPrecision: 1,
  },
}

export function getPairSpec(key: string): PairSpec {
  const spec = PAIR_SPECS[key]
  if (!spec) throw new Error(`Unknown pair spec: ${key}`)
  return spec
}
