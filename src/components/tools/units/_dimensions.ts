import type { Dimension, DimensionId, UnitDef } from './_engine'

/**
 * Unit tables. Factors are exact conversion factors wherever the unit is
 * defined by international agreement (the inch has been exactly 25.4 mm since
 * 1959, the pound exactly 0.45359237 kg, the calorie exactly 4.184 J, and so
 * on). Where a unit is a measurement rather than a definition — the speed of
 * sound, ingredient densities — the note says so.
 */

/* ───────────────────────────── length ───────────────────────────── */

const length: Dimension = {
  id: 'length',
  name: 'Length',
  base: 'm',
  chartValues: [1, 2, 3, 5, 10, 15, 20, 25, 50, 100, 500, 1000],
  units: [
    { id: 'm', name: 'Metre', symbol: 'm', group: 'Metric', factor: 1, note: 'SI base unit of length.' },
    { id: 'km', name: 'Kilometre', symbol: 'km', group: 'Metric', factor: 1000 },
    { id: 'cm', name: 'Centimetre', symbol: 'cm', group: 'Metric', factor: 0.01 },
    { id: 'mm', name: 'Millimetre', symbol: 'mm', group: 'Metric', factor: 0.001 },
    { id: 'um', name: 'Micrometre (micron)', symbol: 'µm', group: 'Metric', factor: 1e-6 },
    { id: 'nm', name: 'Nanometre', symbol: 'nm', group: 'Metric', factor: 1e-9 },
    { id: 'mi', name: 'Mile', symbol: 'mi', group: 'Imperial / US', factor: 1609.344, note: 'Exactly 1,760 yards.' },
    { id: 'yd', name: 'Yard', symbol: 'yd', group: 'Imperial / US', factor: 0.9144, note: 'Exactly 3 feet.' },
    { id: 'ft', name: 'Foot', symbol: 'ft', group: 'Imperial / US', factor: 0.3048, note: 'Exactly 12 inches.' },
    { id: 'in', name: 'Inch', symbol: 'in', group: 'Imperial / US', factor: 0.0254, note: 'Exactly 25.4 mm since 1959.' },
    { id: 'nmi', name: 'Nautical mile', symbol: 'nmi', group: 'Nautical & astronomical', factor: 1852, note: 'One minute of latitude, exactly 1,852 m.' },
    { id: 'au', name: 'Astronomical unit', symbol: 'au', group: 'Nautical & astronomical', factor: 149597870700, note: 'Earth–Sun distance, exact by definition.' },
    { id: 'ly', name: 'Light-year', symbol: 'ly', group: 'Nautical & astronomical', factor: 9460730472580800, note: 'Distance light travels in a Julian year.' },
  ],
  common: [
    { from: 'cm', to: 'in' },
    { from: 'in', to: 'cm' },
    { from: 'm', to: 'ft' },
    { from: 'ft', to: 'm' },
    { from: 'km', to: 'mi' },
    { from: 'mi', to: 'km' },
    { from: 'mm', to: 'in' },
    { from: 'm', to: 'yd' },
    { from: 'yd', to: 'm' },
    { from: 'ft', to: 'in' },
    { from: 'km', to: 'nmi' },
    { from: 'in', to: 'mm' },
  ],
}

/* ───────────────────────────── weight / mass ───────────────────────────── */

const weight: Dimension = {
  id: 'weight',
  name: 'Weight',
  base: 'kg',
  chartValues: [1, 2, 3, 5, 10, 15, 20, 25, 50, 75, 100, 200],
  units: [
    { id: 'kg', name: 'Kilogram', symbol: 'kg', group: 'Metric', factor: 1, note: 'SI base unit of mass.' },
    { id: 'g', name: 'Gram', symbol: 'g', group: 'Metric', factor: 0.001 },
    { id: 'mg', name: 'Milligram', symbol: 'mg', group: 'Metric', factor: 1e-6 },
    { id: 'ug', name: 'Microgram', symbol: 'µg', group: 'Metric', factor: 1e-9 },
    { id: 't', name: 'Tonne (metric ton)', symbol: 't', group: 'Metric', factor: 1000, note: 'Exactly 1,000 kg.' },
    { id: 'lb', name: 'Pound', symbol: 'lb', group: 'Imperial / US', factor: 0.45359237, note: 'Exactly 0.45359237 kg since 1959.' },
    { id: 'oz', name: 'Ounce', symbol: 'oz', group: 'Imperial / US', factor: 0.028349523125, note: 'One sixteenth of a pound.' },
    { id: 'st', name: 'Stone', symbol: 'st', group: 'Imperial / US', factor: 6.35029318, note: 'Exactly 14 pounds. Used for UK body weight.' },
    { id: 'ton-us', name: 'Short ton (US)', symbol: 'ton (US)', group: 'Imperial / US', factor: 907.18474, note: '2,000 pounds.' },
    { id: 'ton-uk', name: 'Long ton (UK)', symbol: 'ton (UK)', group: 'Imperial / US', factor: 1016.0469088, note: '2,240 pounds.' },
    { id: 'ozt', name: 'Troy ounce', symbol: 'oz t', group: 'Precious metal', factor: 0.0311034768, note: 'Used for gold and silver.' },
    { id: 'ct', name: 'Carat', symbol: 'ct', group: 'Precious metal', factor: 0.0002, note: 'Exactly 200 mg. Used for gemstones.' },
  ],
  common: [
    { from: 'kg', to: 'lb' },
    { from: 'lb', to: 'kg' },
    { from: 'g', to: 'oz' },
    { from: 'oz', to: 'g' },
    { from: 'kg', to: 'st' },
    { from: 'st', to: 'kg' },
    { from: 'lb', to: 'oz' },
    { from: 'g', to: 'lb' },
    { from: 't', to: 'ton-us' },
    { from: 'mg', to: 'g' },
    { from: 'kg', to: 'g' },
    { from: 'ozt', to: 'g' },
  ],
}

/* ───────────────────────────── temperature ───────────────────────────── */

const temperature: Dimension = {
  id: 'temperature',
  name: 'Temperature',
  base: 'k',
  minBase: 0,
  minBaseMessage:
    'That is below absolute zero (−273.15 °C / −459.67 °F / 0 K). Nothing can be colder than that.',
  chartValues: [-40, -20, -10, 0, 5, 10, 15, 20, 25, 30, 37, 40, 50, 100],
  units: [
    {
      id: 'c',
      name: 'Celsius',
      symbol: '°C',
      group: 'Everyday',
      factor: 1,
      offset: 273.15,
      note: 'Water freezes at 0 °C and boils at 100 °C at sea level.',
    },
    {
      id: 'f',
      name: 'Fahrenheit',
      symbol: '°F',
      group: 'Everyday',
      factor: 5 / 9,
      offset: 273.15 - 32 * (5 / 9),
      note: 'Water freezes at 32 °F and boils at 212 °F.',
    },
    {
      id: 'k',
      name: 'Kelvin',
      symbol: 'K',
      group: 'Absolute',
      factor: 1,
      note: 'SI base unit. Starts at absolute zero; no degree sign.',
    },
    {
      id: 'r',
      name: 'Rankine',
      symbol: '°R',
      group: 'Absolute',
      factor: 5 / 9,
      note: 'Absolute scale with Fahrenheit-sized degrees.',
    },
    {
      id: 're',
      name: 'Réaumur',
      symbol: '°Ré',
      group: 'Historical',
      factor: 1.25,
      offset: 273.15,
      note: 'Water freezes at 0 °Ré and boils at 80 °Ré. Still seen in some cheese and syrup recipes.',
    },
  ],
  common: [
    { from: 'c', to: 'f' },
    { from: 'f', to: 'c' },
    { from: 'c', to: 'k' },
    { from: 'k', to: 'c' },
    { from: 'f', to: 'k' },
    { from: 'k', to: 'f' },
    { from: 'c', to: 'r' },
    { from: 'f', to: 'r' },
    { from: 'c', to: 're' },
    { from: 're', to: 'c' },
  ],
}

/* ───────────────────────────── volume ───────────────────────────── */

const volume: Dimension = {
  id: 'volume',
  name: 'Volume',
  base: 'l',
  chartValues: [0.5, 1, 2, 3, 5, 10, 20, 25, 50, 100, 250, 1000],
  units: [
    { id: 'l', name: 'Litre', symbol: 'L', group: 'Metric', factor: 1, note: 'Exactly one cubic decimetre.' },
    { id: 'ml', name: 'Millilitre', symbol: 'mL', group: 'Metric', factor: 0.001, note: 'Same volume as a cubic centimetre.' },
    { id: 'm3', name: 'Cubic metre', symbol: 'm³', group: 'Metric', factor: 1000 },
    { id: 'cm3', name: 'Cubic centimetre', symbol: 'cm³', group: 'Metric', factor: 0.001, note: 'Also written cc.' },
    { id: 'gal-us', name: 'Gallon (US liquid)', symbol: 'gal (US)', group: 'US customary', factor: 3.785411784, note: '231 cubic inches exactly.' },
    { id: 'qt-us', name: 'Quart (US)', symbol: 'qt (US)', group: 'US customary', factor: 0.946352946 },
    { id: 'pt-us', name: 'Pint (US)', symbol: 'pt (US)', group: 'US customary', factor: 0.473176473 },
    { id: 'cup-us', name: 'Cup (US customary)', symbol: 'cup (US)', group: 'US customary', factor: 0.2365882365, note: '8 US fluid ounces.' },
    { id: 'cup-us-legal', name: 'Cup (US legal)', symbol: 'cup (legal)', group: 'US customary', factor: 0.24, note: '240 mL, used on US nutrition labels.' },
    { id: 'floz-us', name: 'Fluid ounce (US)', symbol: 'fl oz (US)', group: 'US customary', factor: 0.0295735295625 },
    { id: 'tbsp', name: 'Tablespoon (US)', symbol: 'tbsp', group: 'US customary', factor: 0.01478676478125, note: '½ US fl oz.' },
    { id: 'tsp', name: 'Teaspoon (US)', symbol: 'tsp', group: 'US customary', factor: 0.00492892159375, note: 'One third of a tablespoon.' },
    { id: 'gal-uk', name: 'Gallon (imperial)', symbol: 'gal (UK)', group: 'Imperial (UK)', factor: 4.54609, note: 'Exactly 4.54609 L.' },
    { id: 'qt-uk', name: 'Quart (imperial)', symbol: 'qt (UK)', group: 'Imperial (UK)', factor: 1.1365225 },
    { id: 'pt-uk', name: 'Pint (imperial)', symbol: 'pt (UK)', group: 'Imperial (UK)', factor: 0.56826125, note: 'The British pub pint.' },
    { id: 'floz-uk', name: 'Fluid ounce (imperial)', symbol: 'fl oz (UK)', group: 'Imperial (UK)', factor: 0.0284130625 },
    { id: 'cup-metric', name: 'Cup (metric)', symbol: 'cup (metric)', group: 'Metric kitchen', factor: 0.25, note: 'Exactly 250 mL. Used in the UK, Australia and NZ.' },
    { id: 'bbl', name: 'Barrel (oil)', symbol: 'bbl', group: 'Bulk', factor: 158.987294928, note: '42 US gallons.' },
  ],
  common: [
    { from: 'l', to: 'gal-us' },
    { from: 'gal-us', to: 'l' },
    { from: 'ml', to: 'floz-us' },
    { from: 'floz-us', to: 'ml' },
    { from: 'cup-us', to: 'ml' },
    { from: 'l', to: 'ml' },
    { from: 'm3', to: 'l' },
    { from: 'gal-uk', to: 'l' },
    { from: 'pt-uk', to: 'ml' },
    { from: 'tbsp', to: 'ml' },
    { from: 'tsp', to: 'ml' },
    { from: 'bbl', to: 'l' },
  ],
}

/* ───────────────────────────── area ───────────────────────────── */

const area: Dimension = {
  id: 'area',
  name: 'Area',
  base: 'm2',
  chartValues: [1, 2, 5, 10, 20, 25, 50, 100, 250, 500, 1000, 10000],
  units: [
    { id: 'm2', name: 'Square metre', symbol: 'm²', group: 'Metric', factor: 1 },
    { id: 'km2', name: 'Square kilometre', symbol: 'km²', group: 'Metric', factor: 1e6 },
    { id: 'cm2', name: 'Square centimetre', symbol: 'cm²', group: 'Metric', factor: 1e-4 },
    { id: 'mm2', name: 'Square millimetre', symbol: 'mm²', group: 'Metric', factor: 1e-6 },
    { id: 'ha', name: 'Hectare', symbol: 'ha', group: 'Land', factor: 10000, note: 'A square 100 m on each side.' },
    { id: 'acre', name: 'Acre', symbol: 'ac', group: 'Land', factor: 4046.8564224, note: '43,560 square feet; 640 acres make a square mile.' },
    { id: 'ft2', name: 'Square foot', symbol: 'ft²', group: 'Imperial / US', factor: 0.09290304 },
    { id: 'in2', name: 'Square inch', symbol: 'in²', group: 'Imperial / US', factor: 0.00064516 },
    { id: 'yd2', name: 'Square yard', symbol: 'yd²', group: 'Imperial / US', factor: 0.83612736 },
    { id: 'mi2', name: 'Square mile', symbol: 'mi²', group: 'Imperial / US', factor: 2589988.110336 },
  ],
  common: [
    { from: 'm2', to: 'ft2' },
    { from: 'ft2', to: 'm2' },
    { from: 'acre', to: 'ha' },
    { from: 'ha', to: 'acre' },
    { from: 'acre', to: 'ft2' },
    { from: 'm2', to: 'yd2' },
    { from: 'km2', to: 'mi2' },
    { from: 'mi2', to: 'km2' },
    { from: 'cm2', to: 'in2' },
    { from: 'ha', to: 'm2' },
    { from: 'acre', to: 'm2' },
    { from: 'yd2', to: 'ft2' },
  ],
}

/* ───────────────────────────── speed ───────────────────────────── */

const speed: Dimension = {
  id: 'speed',
  name: 'Speed',
  base: 'mps',
  chartValues: [1, 5, 10, 20, 30, 40, 50, 60, 70, 80, 100, 120],
  units: [
    { id: 'mps', name: 'Metre per second', symbol: 'm/s', group: 'Metric', factor: 1, note: 'The SI unit of speed.' },
    { id: 'kmh', name: 'Kilometre per hour', symbol: 'km/h', group: 'Metric', factor: 1 / 3.6, note: 'Exactly 1000⁄3600 m/s.' },
    { id: 'mph', name: 'Mile per hour', symbol: 'mph', group: 'Imperial / US', factor: 0.44704, note: 'Exactly 0.44704 m/s.' },
    { id: 'fps', name: 'Foot per second', symbol: 'ft/s', group: 'Imperial / US', factor: 0.3048 },
    { id: 'kn', name: 'Knot', symbol: 'kn', group: 'Nautical & aviation', factor: 1852 / 3600, note: 'One nautical mile per hour.' },
    {
      id: 'mach',
      name: 'Mach (sea level)',
      symbol: 'Mach',
      group: 'Nautical & aviation',
      factor: 340.29,
      note: 'Speed of sound in dry air at 15 °C, sea level. It falls to about 295 m/s at cruise altitude, so Mach is not a fixed speed.',
    },
    { id: 'c', name: 'Speed of light', symbol: 'c', group: 'Physics', factor: 299792458, note: 'Exact by definition.' },
  ],
  common: [
    { from: 'kmh', to: 'mph' },
    { from: 'mph', to: 'kmh' },
    { from: 'mps', to: 'kmh' },
    { from: 'kmh', to: 'mps' },
    { from: 'mps', to: 'mph' },
    { from: 'kn', to: 'kmh' },
    { from: 'kn', to: 'mph' },
    { from: 'kmh', to: 'kn' },
    { from: 'mph', to: 'fps' },
    { from: 'mach', to: 'kmh' },
    { from: 'mps', to: 'fps' },
    { from: 'mph', to: 'kn' },
  ],
}

/* ───────────────────────────── time ───────────────────────────── */

const time: Dimension = {
  id: 'time',
  name: 'Time',
  base: 's',
  chartValues: [1, 2, 5, 10, 15, 30, 45, 60, 90, 120, 365, 1000],
  units: [
    { id: 'ns', name: 'Nanosecond', symbol: 'ns', group: 'Sub-second', factor: 1e-9 },
    { id: 'us', name: 'Microsecond', symbol: 'µs', group: 'Sub-second', factor: 1e-6 },
    { id: 'ms', name: 'Millisecond', symbol: 'ms', group: 'Sub-second', factor: 1e-3 },
    { id: 's', name: 'Second', symbol: 's', group: 'Common', factor: 1, note: 'SI base unit of time.' },
    { id: 'min', name: 'Minute', symbol: 'min', group: 'Common', factor: 60 },
    { id: 'h', name: 'Hour', symbol: 'h', group: 'Common', factor: 3600 },
    { id: 'day', name: 'Day', symbol: 'd', group: 'Common', factor: 86400, note: '24 hours exactly (ignoring leap seconds).' },
    { id: 'week', name: 'Week', symbol: 'wk', group: 'Common', factor: 604800 },
    {
      id: 'month',
      name: 'Month (average)',
      symbol: 'mo',
      group: 'Calendar',
      factor: 2629746,
      note: 'One twelfth of a Gregorian year: 30.436875 days. Real months are 28–31 days.',
    },
    {
      id: 'year',
      name: 'Year (Gregorian)',
      symbol: 'yr',
      group: 'Calendar',
      factor: 31556952,
      note: '365.2425 days, the long-run average once leap years are counted.',
    },
    { id: 'decade', name: 'Decade', symbol: 'dec', group: 'Calendar', factor: 315569520 },
    { id: 'century', name: 'Century', symbol: 'cent', group: 'Calendar', factor: 3155695200 },
  ],
  common: [
    { from: 'min', to: 's' },
    { from: 'h', to: 'min' },
    { from: 'day', to: 'h' },
    { from: 'week', to: 'day' },
    { from: 'year', to: 'day' },
    { from: 's', to: 'ms' },
    { from: 'ms', to: 's' },
    { from: 'h', to: 's' },
    { from: 'day', to: 'min' },
    { from: 'month', to: 'week' },
    { from: 'year', to: 'h' },
    { from: 'decade', to: 'year' },
  ],
}

/* ───────────────────────────── digital storage ───────────────────────────── */

const KI = 1024
const dataUnit = (
  id: string,
  name: string,
  symbol: string,
  decimalBytes: number,
  binaryBytes: number,
  note: string,
): UnitDef => ({
  id,
  name,
  symbol,
  group: 'Ambiguous prefix',
  factor: decimalBytes * 8,
  factorByMode: { decimal: decimalBytes * 8, binary: binaryBytes * 8 },
  note,
  noteByMode: {
    decimal: `${note} Counting decimally: ${symbol} = ${decimalBytes.toLocaleString('en-US')} bytes.`,
    binary: `${note} Counting in powers of two: ${symbol} = ${binaryBytes.toLocaleString('en-US')} bytes.`,
  },
})

const data: Dimension = {
  id: 'data',
  name: 'Digital storage',
  base: 'bit',
  minBase: 0,
  minBaseMessage: 'A negative amount of data does not exist. Enter zero or more.',
  chartValues: [1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048],
  modes: {
    label: 'Interpret KB, MB, GB, TB as',
    help:
      'Storage manufacturers and macOS count 1 kB = 1,000 bytes. Windows, RAM sizes and most download managers count 1 KB = 1,024 bytes. Switch between the two and every KB/MB/GB/TB row below changes with it. KiB, MiB and GiB are always 1,024-based, which is why they were invented.',
    options: [
      {
        id: 'decimal',
        label: '1,000 (decimal, SI)',
        note: 'Used by drive manufacturers, macOS, iOS, most network tools and the SI standard.',
      },
      {
        id: 'binary',
        label: '1,024 (binary, JEDEC)',
        note: 'Used by Windows Explorer, RAM capacities, and most older software.',
      },
    ],
  },
  units: [
    { id: 'bit', name: 'Bit', symbol: 'bit', group: 'Base', factor: 1, note: 'A single 0 or 1.' },
    { id: 'nibble', name: 'Nibble', symbol: 'nibble', group: 'Base', factor: 4, note: 'Four bits, one hexadecimal digit.' },
    { id: 'byte', name: 'Byte', symbol: 'B', group: 'Base', factor: 8, note: 'Eight bits. One ASCII character.' },
    dataUnit('kb', 'Kilobyte', 'KB', 1000, KI, 'The first ambiguous prefix.'),
    dataUnit('mb', 'Megabyte', 'MB', 1000 ** 2, KI ** 2, 'A minute of MP3 audio is roughly 1 MB.'),
    dataUnit('gb', 'Gigabyte', 'GB', 1000 ** 3, KI ** 3, 'The unit on most phone and drive labels.'),
    dataUnit('tb', 'Terabyte', 'TB', 1000 ** 4, KI ** 4, 'A “1 TB” drive shows as 931 GiB in Windows.'),
    dataUnit('pb', 'Petabyte', 'PB', 1000 ** 5, KI ** 5, 'Data-centre scale.'),
    { id: 'kib', name: 'Kibibyte', symbol: 'KiB', group: 'Binary (IEC, always 1024)', factor: 8 * KI, note: 'Always exactly 1,024 bytes.' },
    { id: 'mib', name: 'Mebibyte', symbol: 'MiB', group: 'Binary (IEC, always 1024)', factor: 8 * KI ** 2, note: 'Exactly 1,048,576 bytes.' },
    { id: 'gib', name: 'Gibibyte', symbol: 'GiB', group: 'Binary (IEC, always 1024)', factor: 8 * KI ** 3, note: 'Exactly 1,073,741,824 bytes.' },
    { id: 'tib', name: 'Tebibyte', symbol: 'TiB', group: 'Binary (IEC, always 1024)', factor: 8 * KI ** 4, note: 'Exactly 1,099,511,627,776 bytes.' },
    { id: 'pib', name: 'Pebibyte', symbol: 'PiB', group: 'Binary (IEC, always 1024)', factor: 8 * KI ** 5 },
  ],
  common: [
    { from: 'gb', to: 'mb' },
    { from: 'mb', to: 'kb' },
    { from: 'tb', to: 'gb' },
    { from: 'gb', to: 'gib' },
    { from: 'tb', to: 'tib' },
    { from: 'mb', to: 'byte' },
    { from: 'gb', to: 'byte' },
    { from: 'byte', to: 'bit' },
    { from: 'mib', to: 'mb' },
    { from: 'gib', to: 'gb' },
    { from: 'kb', to: 'byte' },
    { from: 'pb', to: 'tb' },
  ],
}

/* ───────────────────────────── pressure ───────────────────────────── */

const pressure: Dimension = {
  id: 'pressure',
  name: 'Pressure',
  base: 'pa',
  chartValues: [1, 2, 5, 10, 20, 30, 32, 35, 40, 50, 100, 1000],
  units: [
    { id: 'pa', name: 'Pascal', symbol: 'Pa', group: 'SI', factor: 1, note: 'One newton per square metre.' },
    { id: 'hpa', name: 'Hectopascal', symbol: 'hPa', group: 'SI', factor: 100, note: 'The weather-forecast unit; identical to the millibar.' },
    { id: 'kpa', name: 'Kilopascal', symbol: 'kPa', group: 'SI', factor: 1000 },
    { id: 'mpa', name: 'Megapascal', symbol: 'MPa', group: 'SI', factor: 1e6, note: 'Also written N/mm² in engineering.' },
    { id: 'bar', name: 'Bar', symbol: 'bar', group: 'Metric practical', factor: 100000, note: 'Exactly 100 kPa, close to one atmosphere.' },
    { id: 'mbar', name: 'Millibar', symbol: 'mbar', group: 'Metric practical', factor: 100 },
    { id: 'psi', name: 'Pound per square inch', symbol: 'psi', group: 'Imperial / US', factor: 6894.757293168361, note: 'Tyre pressure in the US and UK.' },
    { id: 'atm', name: 'Standard atmosphere', symbol: 'atm', group: 'Reference', factor: 101325, note: 'Exactly 101,325 Pa by definition.' },
    { id: 'torr', name: 'Torr', symbol: 'Torr', group: 'Reference', factor: 101325 / 760, note: 'Exactly 1⁄760 atm. Used in vacuum work.' },
    { id: 'mmhg', name: 'Millimetre of mercury', symbol: 'mmHg', group: 'Reference', factor: 133.322387415, note: 'Blood pressure. Within 0.000015 % of a torr.' },
    { id: 'inhg', name: 'Inch of mercury', symbol: 'inHg', group: 'Reference', factor: 3386.388640341, note: 'US altimeter and barometer setting.' },
    { id: 'mh2o', name: 'Metre of water', symbol: 'mH₂O', group: 'Reference', factor: 9806.65, note: 'Pump head and hydrostatic pressure.' },
  ],
  common: [
    { from: 'bar', to: 'psi' },
    { from: 'psi', to: 'bar' },
    { from: 'kpa', to: 'psi' },
    { from: 'psi', to: 'kpa' },
    { from: 'bar', to: 'kpa' },
    { from: 'atm', to: 'psi' },
    { from: 'mmhg', to: 'kpa' },
    { from: 'hpa', to: 'inhg' },
    { from: 'mpa', to: 'psi' },
    { from: 'atm', to: 'bar' },
    { from: 'torr', to: 'pa' },
    { from: 'psi', to: 'atm' },
  ],
}

/* ───────────────────────────── energy ───────────────────────────── */

const energy: Dimension = {
  id: 'energy',
  name: 'Energy',
  base: 'j',
  chartValues: [1, 2, 5, 10, 20, 50, 100, 250, 500, 1000, 2000, 5000],
  units: [
    { id: 'j', name: 'Joule', symbol: 'J', group: 'SI', factor: 1, note: 'One watt for one second.' },
    { id: 'kj', name: 'Kilojoule', symbol: 'kJ', group: 'SI', factor: 1000, note: 'Food energy outside the US.' },
    { id: 'mj', name: 'Megajoule', symbol: 'MJ', group: 'SI', factor: 1e6 },
    { id: 'cal', name: 'Calorie (small)', symbol: 'cal', group: 'Nutrition & heat', factor: 4.184, note: 'Thermochemical calorie, exactly 4.184 J.' },
    {
      id: 'kcal',
      name: 'Kilocalorie (food Calorie)',
      symbol: 'kcal',
      group: 'Nutrition & heat',
      factor: 4184,
      note: 'The “Calorie” on a nutrition label is this one: 1,000 small calories.',
    },
    { id: 'wh', name: 'Watt-hour', symbol: 'Wh', group: 'Electrical', factor: 3600 },
    { id: 'kwh', name: 'Kilowatt-hour', symbol: 'kWh', group: 'Electrical', factor: 3.6e6, note: 'The unit on your electricity bill.' },
    { id: 'btu', name: 'British thermal unit', symbol: 'BTU', group: 'Nutrition & heat', factor: 1055.05585262, note: 'IT definition. Heating and air-conditioning ratings.' },
    { id: 'therm', name: 'Therm (US)', symbol: 'thm', group: 'Nutrition & heat', factor: 105480400, note: 'The US gas-bill unit: 100,000 BTU measured at 59 °F, or 99,976 IT BTU.' },
    { id: 'ftlb', name: 'Foot-pound', symbol: 'ft·lb', group: 'Mechanical', factor: 1.3558179483314004, note: 'Also the imperial unit of torque.' },
    { id: 'nm', name: 'Newton-metre', symbol: 'N·m', group: 'Mechanical', factor: 1, note: 'Dimensionally identical to the joule.' },
    { id: 'ev', name: 'Electronvolt', symbol: 'eV', group: 'Atomic', factor: 1.602176634e-19, note: 'Exact since the 2019 SI redefinition.' },
  ],
  common: [
    { from: 'kcal', to: 'kj' },
    { from: 'kj', to: 'kcal' },
    { from: 'kwh', to: 'j' },
    { from: 'kwh', to: 'btu' },
    { from: 'btu', to: 'kwh' },
    { from: 'j', to: 'cal' },
    { from: 'cal', to: 'j' },
    { from: 'wh', to: 'j' },
    { from: 'therm', to: 'kwh' },
    { from: 'ftlb', to: 'j' },
    { from: 'ev', to: 'j' },
    { from: 'kj', to: 'j' },
  ],
}

/* ───────────────────────────── power ───────────────────────────── */

const power: Dimension = {
  id: 'power',
  name: 'Power',
  base: 'w',
  chartValues: [1, 5, 10, 25, 50, 75, 100, 150, 200, 250, 500, 1000],
  units: [
    { id: 'w', name: 'Watt', symbol: 'W', group: 'SI', factor: 1, note: 'One joule per second.' },
    { id: 'mw-milli', name: 'Milliwatt', symbol: 'mW', group: 'SI', factor: 0.001 },
    { id: 'kw', name: 'Kilowatt', symbol: 'kW', group: 'SI', factor: 1000, note: 'EV motors and appliance ratings.' },
    { id: 'mw', name: 'Megawatt', symbol: 'MW', group: 'SI', factor: 1e6, note: 'Power-station scale.' },
    { id: 'gw', name: 'Gigawatt', symbol: 'GW', group: 'SI', factor: 1e9 },
    {
      id: 'hp',
      name: 'Horsepower (mechanical)',
      symbol: 'hp',
      group: 'Horsepower',
      factor: 745.6998715822702,
      note: '550 foot-pounds per second. The US/UK car figure.',
    },
    {
      id: 'ps',
      name: 'Horsepower (metric, PS)',
      symbol: 'PS',
      group: 'Horsepower',
      factor: 735.49875,
      note: '75 kgf·m/s. The European car figure, also written CV, pk or ch.',
    },
    {
      id: 'hp-e',
      name: 'Horsepower (electrical)',
      symbol: 'hp (E)',
      group: 'Horsepower',
      factor: 746,
      note: 'Exactly 746 W. Used on US electric motor nameplates.',
    },
    { id: 'btuh', name: 'BTU per hour', symbol: 'BTU/h', group: 'Thermal', factor: 1055.05585262 / 3600, note: 'Air-conditioner and boiler ratings.' },
    { id: 'ton-r', name: 'Ton of refrigeration', symbol: 'TR', group: 'Thermal', factor: 3516.8528420667, note: '12,000 BTU/h. Used for chiller capacity.' },
    { id: 'ftlbs', name: 'Foot-pound per second', symbol: 'ft·lb/s', group: 'Mechanical', factor: 1.3558179483314004 },
  ],
  common: [
    { from: 'kw', to: 'hp' },
    { from: 'hp', to: 'kw' },
    { from: 'kw', to: 'ps' },
    { from: 'ps', to: 'kw' },
    { from: 'hp', to: 'ps' },
    { from: 'w', to: 'hp' },
    { from: 'kw', to: 'btuh' },
    { from: 'btuh', to: 'kw' },
    { from: 'mw', to: 'kw' },
    { from: 'hp', to: 'w' },
    { from: 'ton-r', to: 'kw' },
    { from: 'w', to: 'btuh' },
  ],
}

/* ───────────────────────────── cooking ───────────────────────────── */

/** One US cup in millilitres — the reference volume for the weights below. */
const CUP_ML = 236.5882365

interface Ingredient {
  id: string
  label: string
  /** Grams per millilitre. */
  density: number
  note: string
}

/**
 * Densities behind the weight⇄volume mode. Each one is the published
 * "1 US cup weighs N grams" figure divided by the cup, so converting a cup
 * back to grams returns exactly the number bakers already know.
 */
export const INGREDIENTS: Ingredient[] = [
  { id: 'water', label: 'Water', density: 1, note: 'The reference: 1 mL of water weighs exactly 1 g.' },
  { id: 'flour', label: 'Flour (all-purpose, spooned)', density: 125 / CUP_ML, note: 'Spooned into the cup and levelled. Scooping straight from the bag packs in up to 145 g, which is why weighing flour is worth it.' },
  { id: 'flour-bread', label: 'Bread flour', density: 128 / CUP_ML, note: 'Slightly heavier than all-purpose flour.' },
  { id: 'sugar', label: 'Sugar (granulated white)', density: 200 / CUP_ML, note: 'Standard granulated or caster sugar.' },
  { id: 'sugar-brown', label: 'Brown sugar (packed)', density: 220 / CUP_ML, note: 'Firmly packed into the cup, as recipes assume.' },
  { id: 'sugar-powdered', label: 'Powdered / icing sugar', density: 120 / CUP_ML, note: 'Unsifted; sifting drops it to about 100 g per cup.' },
  { id: 'butter', label: 'Butter', density: 227 / CUP_ML, note: 'A US stick is ¼ lb = ½ cup = 113 g.' },
  { id: 'milk', label: 'Milk (whole)', density: 1.03, note: 'Skimmed milk is a fraction denser; cream is lighter.' },
  { id: 'oil', label: 'Vegetable oil', density: 0.918, note: 'Oil is lighter than water, so it floats.' },
  { id: 'honey', label: 'Honey', density: 340 / CUP_ML, note: 'Close enough for golden syrup, maple syrup and molasses too.' },
  { id: 'rice', label: 'Rice (white, uncooked)', density: 185 / CUP_ML, note: 'Long-grain, unrinsed.' },
  { id: 'oats', label: 'Oats (rolled)', density: 90 / CUP_ML, note: 'Old-fashioned rolled oats, loosely filled.' },
  { id: 'cocoa', label: 'Cocoa powder', density: 85 / CUP_ML, note: 'Unsweetened, spooned and levelled.' },
  { id: 'salt', label: 'Salt (fine table)', density: 288 / CUP_ML, note: 'Kosher and flaky salts are far lighter by volume, up to half as much per spoon.' },
]

const massUnit = (id: string, name: string, symbol: string, grams: number, note?: string): UnitDef => ({
  id,
  name,
  symbol,
  group: 'Weight',
  factor: grams, // mL, using water's density as the fallback
  factorByMode: Object.fromEntries(INGREDIENTS.map((i) => [i.id, grams / i.density])),
  ...(note ? { note } : {}),
})

const cooking: Dimension = {
  id: 'cooking',
  name: 'Cooking measurement',
  base: 'ml',
  minBase: 0,
  minBaseMessage: 'Recipes do not use negative quantities. Enter zero or more.',
  chartValues: [0.25, 0.5, 0.75, 1, 1.5, 2, 2.5, 3, 4, 6, 8, 10],
  modes: {
    label: 'Ingredient',
    help:
      'Volume-to-volume conversions (cups to tablespoons, mL to fl oz) are the same for everything. Converting a volume into a weight is not: a cup of flour and a cup of honey differ by almost three times. Pick the ingredient and every weight row below uses its real density.',
    options: INGREDIENTS.map((i) => ({
      id: i.id,
      label: i.label,
      note: `${i.note} 1 US cup ≈ ${Math.round(i.density * CUP_ML)} g (density ${Number(i.density.toFixed(4))} g/mL).`,
    })),
  },
  units: [
    { id: 'cup-us', name: 'Cup (US)', symbol: 'cup', group: 'Volume', factor: 236.5882365, note: '8 US fl oz = 16 tbsp.' },
    { id: 'cup-metric', name: 'Cup (metric, 250 mL)', symbol: 'cup (metric)', group: 'Volume', factor: 250, note: 'UK, Australia and New Zealand recipes.' },
    { id: 'tbsp', name: 'Tablespoon (US)', symbol: 'tbsp', group: 'Volume', factor: 14.78676478125, note: '3 teaspoons.' },
    { id: 'tbsp-metric', name: 'Tablespoon (metric, 15 mL)', symbol: 'tbsp (15 mL)', group: 'Volume', factor: 15, note: 'UK and EU. Australia uses 20 mL.' },
    { id: 'tbsp-au', name: 'Tablespoon (Australian, 20 mL)', symbol: 'tbsp (AU)', group: 'Volume', factor: 20, note: '4 Australian teaspoons.' },
    { id: 'tsp', name: 'Teaspoon (US)', symbol: 'tsp', group: 'Volume', factor: 4.92892159375 },
    { id: 'tsp-metric', name: 'Teaspoon (metric, 5 mL)', symbol: 'tsp (5 mL)', group: 'Volume', factor: 5 },
    { id: 'floz-us', name: 'Fluid ounce (US)', symbol: 'fl oz', group: 'Volume', factor: 29.5735295625 },
    { id: 'floz-uk', name: 'Fluid ounce (imperial)', symbol: 'fl oz (UK)', group: 'Volume', factor: 28.4130625 },
    { id: 'ml', name: 'Millilitre', symbol: 'mL', group: 'Volume', factor: 1 },
    { id: 'l', name: 'Litre', symbol: 'L', group: 'Volume', factor: 1000 },
    { id: 'pt-us', name: 'Pint (US)', symbol: 'pt', group: 'Volume', factor: 473.176473 },
    { id: 'qt-us', name: 'Quart (US)', symbol: 'qt', group: 'Volume', factor: 946.352946 },
    massUnit('g', 'Gram', 'g', 1),
    massUnit('kg', 'Kilogram', 'kg', 1000),
    massUnit('oz', 'Ounce', 'oz', 28.349523125, 'Weight ounce. A fluid ounce is a different unit.'),
    massUnit('lb', 'Pound', 'lb', 453.59237),
    massUnit('stick', 'Stick of butter', 'stick', 113.4, 'A US stick is ¼ lb = ½ cup.'),
  ],
  common: [
    { from: 'cup-us', to: 'g' },
    { from: 'g', to: 'cup-us' },
    { from: 'cup-us', to: 'ml' },
    { from: 'tbsp', to: 'ml' },
    { from: 'tsp', to: 'ml' },
    { from: 'cup-us', to: 'tbsp' },
    { from: 'oz', to: 'g' },
    { from: 'floz-us', to: 'ml' },
    { from: 'cup-us', to: 'oz' },
    { from: 'lb', to: 'cup-us' },
    { from: 'ml', to: 'g' },
    { from: 'stick', to: 'g' },
  ],
}

/* ───────────────────────────── fuel economy ───────────────────────────── */

const fuel: Dimension = {
  id: 'fuel',
  name: 'Fuel economy',
  base: 'l100km',
  minBase: 0,
  minBaseMessage: 'Fuel economy cannot be negative. Enter a value above zero.',
  chartValues: [5, 6, 7, 8, 10, 12, 15, 20, 25, 30, 40, 50],
  units: [
    {
      id: 'l100km',
      name: 'Litres per 100 km',
      symbol: 'L/100 km',
      group: 'Consumption (lower is better)',
      factor: 1,
      note: 'Europe, Canada, Australia, China. A consumption figure: it goes down as the car gets more efficient.',
    },
    {
      id: 'l100mi',
      name: 'Litres per 100 miles',
      symbol: 'L/100 mi',
      group: 'Consumption (lower is better)',
      factor: 1 / 1.609344,
      note: 'Occasionally used in the UK.',
    },
    {
      id: 'mpg-us',
      name: 'Miles per gallon (US)',
      symbol: 'mpg (US)',
      group: 'Economy (higher is better)',
      factor: 235.2145833333333,
      reciprocal: true,
      note: 'The US gallon is 3.785411784 L, so US mpg reads about 17 % lower than the same car’s UK mpg.',
    },
    {
      id: 'mpg-uk',
      name: 'Miles per gallon (imperial/UK)',
      symbol: 'mpg (UK)',
      group: 'Economy (higher is better)',
      factor: 282.4809362796697,
      reciprocal: true,
      note: 'The imperial gallon is 4.54609 L, 20 % bigger than the US gallon.',
    },
    {
      id: 'kml',
      name: 'Kilometres per litre',
      symbol: 'km/L',
      group: 'Economy (higher is better)',
      factor: 100,
      reciprocal: true,
      note: 'Japan, India, Brazil and much of Asia.',
    },
    {
      id: 'mil',
      name: 'Miles per litre',
      symbol: 'mi/L',
      group: 'Economy (higher is better)',
      factor: 100 / 1.609344,
      reciprocal: true,
    },
    {
      id: 'kwh100km',
      name: 'kWh per 100 km (EV equivalent)',
      symbol: 'kWh/100 km',
      group: 'Electric',
      factor: 1 / 8.9,
      note: 'Using the US EPA figure that 1 US gallon of petrol ≈ 33.7 kWh, so 1 L ≈ 8.9 kWh. An energy-equivalence figure, not a measurement of the same fuel.',
    },
  ],
  common: [
    { from: 'mpg-us', to: 'l100km' },
    { from: 'l100km', to: 'mpg-us' },
    { from: 'mpg-uk', to: 'l100km' },
    { from: 'l100km', to: 'mpg-uk' },
    { from: 'mpg-us', to: 'mpg-uk' },
    { from: 'mpg-uk', to: 'mpg-us' },
    { from: 'kml', to: 'l100km' },
    { from: 'l100km', to: 'kml' },
    { from: 'mpg-us', to: 'kml' },
    { from: 'kml', to: 'mpg-us' },
    { from: 'mpg-uk', to: 'kml' },
    { from: 'l100km', to: 'kwh100km' },
  ],
}

/* ───────────────────────────── angle ───────────────────────────── */

const angle: Dimension = {
  id: 'angle',
  name: 'Angle',
  base: 'deg',
  chartValues: [1, 5, 10, 15, 30, 45, 60, 90, 120, 180, 270, 360],
  units: [
    { id: 'deg', name: 'Degree', symbol: '°', group: 'Common', factor: 1, note: 'A full turn is 360°.' },
    { id: 'rad', name: 'Radian', symbol: 'rad', group: 'Common', factor: 180 / Math.PI, note: 'The SI unit: a full turn is 2π ≈ 6.283185307 rad.' },
    { id: 'grad', name: 'Gradian (gon)', symbol: 'gon', group: 'Common', factor: 0.9, note: 'A right angle is 100 gon. Used in surveying.' },
    { id: 'turn', name: 'Turn (revolution)', symbol: 'turn', group: 'Common', factor: 360 },
    { id: 'arcmin', name: 'Arcminute', symbol: '′', group: 'Sub-degree', factor: 1 / 60, note: 'One sixtieth of a degree.' },
    { id: 'arcsec', name: 'Arcsecond', symbol: '″', group: 'Sub-degree', factor: 1 / 3600, note: 'One sixtieth of an arcminute.' },
    { id: 'mrad', name: 'Milliradian', symbol: 'mrad', group: 'Sub-degree', factor: 0.18 / Math.PI, note: 'Rifle scopes and optics. 1 mrad ≈ 10 cm at 100 m.' },
    { id: 'mil-nato', name: 'NATO mil', symbol: 'mil', group: 'Sub-degree', factor: 360 / 6400, note: 'Artillery: 6,400 mils in a full turn.' },
  ],
  common: [
    { from: 'deg', to: 'rad' },
    { from: 'rad', to: 'deg' },
    { from: 'deg', to: 'grad' },
    { from: 'grad', to: 'deg' },
    { from: 'deg', to: 'arcmin' },
    { from: 'deg', to: 'arcsec' },
    { from: 'turn', to: 'deg' },
    { from: 'deg', to: 'turn' },
    { from: 'rad', to: 'grad' },
    { from: 'arcmin', to: 'deg' },
    { from: 'mrad', to: 'deg' },
    { from: 'mil-nato', to: 'deg' },
  ],
}

export const DIMENSIONS: Record<DimensionId, Dimension> = {
  length,
  weight,
  temperature,
  volume,
  area,
  speed,
  time,
  data,
  pressure,
  energy,
  power,
  cooking,
  fuel,
  angle,
}

export function getDimension(id: DimensionId): Dimension {
  return DIMENSIONS[id]
}
