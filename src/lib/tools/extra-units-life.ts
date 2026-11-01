import type { Tool } from './types'

/**
 * Round-2 batch `units-life`: exact-ratio pair converters, kitchen measures,
 * sizing charts and cycle dates.
 *
 * Every entry here is one URL. Sibling pages share a component but never share
 * copy — description, FAQs and on-page explainer are written per slug.
 */

const UPDATED = '2026-11-01'

export const tools: Tool[] = [
  /* ================= length: metric ↔ inch ================= */
  {
    slug: 'cm-to-inches',
    title: 'CM to Inches',
    h1: 'Convert centimetres to inches',
    description:
      'Convert cm to inches with exact 2.54 arithmetic, tape-measure fractions down to 1/16, a feet-and-inches readout and column batch mode.',
    keywords: ['centimeters to inches', 'cm to in', 'cm in inches', 'convert cm to inches'],
    category: 'units',
    icon: 'Ruler',
    popular: true,
    faqs: [
      {
        q: 'How many inches is 1 cm?',
        a: 'One centimetre is 0.3937007874 inches, because an inch is defined as exactly 2.54 cm. Ten centimetres is 3.937 in, and 100 cm is 39.37 in.',
      },
      {
        q: 'Why does the answer show a fraction as well as a decimal?',
        a: 'Tape measures do not show decimal inches. The fraction column rounds the answer to the nearest sixteenth, the smallest mark on a standard imperial tape, so you can cut to it.',
      },
      {
        q: 'Is 2.54 an approximation?',
        a: 'No. Since the 1959 international yard and pound agreement, the inch is exactly 25.4 mm. Each conversion on this page is exact to the number of decimals you ask for, because the arithmetic uses arbitrary-precision decimals and no binary floating point.',
      },
      {
        q: 'Can I convert a whole spreadsheet column?',
        a: 'Yes. Open the Batch tab and paste the column. Blank lines stay, so the result pastes back into the same rows. A value the tool cannot read gives a blank line, and the tool does not guess.',
      },
      {
        q: 'Does anything I type get uploaded?',
        a: 'No. The conversion table and the arithmetic are in the page, and no server receives your input. The page works with Wi-Fi off.',
      },
    ],
    related: ['inches-to-cm', 'mm-to-inches', 'meters-to-feet', 'feet-to-meters', 'length-converter'],
    updated: UPDATED,
  },
  {
    slug: 'inches-to-cm',
    title: 'Inches to CM',
    h1: 'Convert inches to centimetres',
    description:
      'Convert inches to cm exactly. Accepts entries such as 5 1/2, 5½ and 5\'6", shows mm and metres too, and converts a pasted column.',
    keywords: ['in to cm', 'inches to centimeters', 'convert inches to cm', 'inch cm'],
    category: 'units',
    icon: 'Ruler',
    faqs: [
      {
        q: 'How do I enter a fractional inch?',
        a: 'Type it the way the drawing prints it. 5 1/2, 5½, 11/16 and 0.6875 are all accepted, as is a full feet-and-inches entry such as 5\'6" or 5 ft 6 in.',
      },
      {
        q: 'What is 1 inch in cm?',
        a: 'Exactly 2.54 cm, by definition. That also makes 1 inch exactly 25.4 mm and 12 inches exactly 30.48 cm.',
      },
      {
        q: 'Should I use cm or mm for a workshop drawing?',
        a: 'Millimetres, almost always. Engineering and joinery drawings in Europe use whole millimetres to avoid decimal points, so the tool shows the mm figure next to the centimetre result.',
      },
      {
        q: 'How precise is the result?',
        a: 'Up to eight decimal places, as you choose. The ratio is exact, so the extra decimals are correct digits.',
      },
    ],
    related: ['cm-to-inches', 'inches-to-mm', 'feet-to-meters', 'yards-to-meters', 'length-converter'],
    updated: UPDATED,
  },
  {
    slug: 'mm-to-inches',
    title: 'MM to Inches',
    h1: 'Convert millimetres to inches',
    description:
      'Convert mm to inches for the workshop: decimal inches plus the nearest 1/64, 1/32 and 1/16 fraction, and a printable mm-to-fraction chart.',
    keywords: ['millimeters to inches', 'mm to in', 'mm to fraction', 'mm inch chart'],
    category: 'units',
    icon: 'Ruler',
    faqs: [
      {
        q: 'What is 1 mm in inches?',
        a: '0.0393700787 inches, which is about 2.5 sixty-fourths (1/64 in is 0.396875 mm).',
      },
      {
        q: 'Why show three different fractions?',
        a: 'Different work needs different resolution. A machinist works to 1/64 in, sheet goods and joinery to 1/32 in, and a builder\'s tape to 1/16 in. Pick the one your tools can measure.',
      },
      {
        q: 'Which metric drill size matches a 1/4 inch bit?',
        a: '1/4 in is exactly 6.35 mm, so a 6.5 mm bit is the usual metric substitute and a 6 mm bit is slightly undersized. The chart on this page lists the common equivalents.',
      },
      {
        q: 'Is a millimetre the same as a "mil"?',
        a: 'No, and the mistake is expensive. A mil in US manufacturing is one thousandth of an inch (0.0254 mm). A millimetre is about 39.4 mils.',
      },
    ],
    related: ['inches-to-mm', 'cm-to-inches', 'inches-to-cm', 'meters-to-feet', 'length-converter'],
    updated: UPDATED,
  },
  {
    slug: 'inches-to-mm',
    title: 'Inches to MM',
    h1: 'Convert inches to millimetres',
    description:
      'Convert inches to mm exactly from fractions or decimals such as 3/8, 1 1/4 and 0.375, with a sixteenths-to-mm reference table.',
    keywords: ['in to mm', 'inch to millimeter', 'fraction to mm', 'convert inches to mm'],
    category: 'units',
    icon: 'Ruler',
    faqs: [
      {
        q: 'What is 1 inch in mm?',
        a: 'Exactly 25.4 mm. Multiply by 25.4. There is no rounding at any stage.',
      },
      {
        q: 'Can I type 3/8 rather than 0.375?',
        a: 'Yes. The tool reads fractions, mixed numbers and unicode fractions, because imperial drawings and hardware use fractions.',
      },
      {
        q: 'What thread size matches a 1/2 inch pipe?',
        a: 'No dimension of a nominal 1/2 in pipe is 12.7 mm. Nominal pipe sizes are trade names. Convert the measured outside diameter, and compare it with the standard your fittings use.',
      },
      {
        q: 'Why are my two converted numbers 0.1 mm apart?',
        a: 'Usually one of them was rounded to two decimal places at an earlier step. Increase the precision setting here to see where the difference started.',
      },
    ],
    related: ['mm-to-inches', 'inches-to-cm', 'cm-to-inches', 'feet-to-meters', 'length-converter'],
    updated: UPDATED,
  },

  /* ================= length: metre ↔ foot ================= */
  {
    slug: 'meters-to-feet',
    title: 'Meters to Feet',
    h1: 'Convert metres to feet and inches',
    description:
      'Convert meters to feet with a feet-and-inches answer: 1.75 m is 5 ft 8.9 in. Also shows decimal feet and a height reference table.',
    keywords: ['m to ft', 'metres to feet', 'meters to feet and inches', 'height in feet'],
    category: 'units',
    icon: 'Ruler',
    faqs: [
      {
        q: 'What is 1.75 m in feet and inches?',
        a: '5 ft 8.9 in. In decimal feet it is 5.7415 ft, the number most converters give. A height of 0.74 of a foot is hard to read aloud, so the tool shows feet and inches.',
      },
      {
        q: 'How many feet is a metre?',
        a: '3.280839895 feet, because a foot is defined as exactly 0.3048 m. Three metres is slightly under 10 feet (9.84 ft).',
      },
      {
        q: 'Why is my height 5 ft 9 in on one site and 5 ft 8.9 in here?',
        a: 'Rounding. 1.75 m is 68.898 inches, and some converters round to the nearest whole inch. Use the precision control to get the whole-inch answer.',
      },
      {
        q: 'Is a US survey foot different?',
        a: 'It was, very slightly: 1200/3937 m against 0.3048 m, a difference of about 2 parts per million. The US retired the survey foot at the end of 2022. Use the international foot unless you read old land records.',
      },
    ],
    related: ['feet-to-meters', 'yards-to-meters', 'cm-to-inches', 'inches-to-cm', 'length-converter'],
    updated: UPDATED,
  },
  {
    slug: 'feet-to-meters',
    title: 'Feet to Meters',
    h1: 'Convert feet to metres',
    description:
      'Convert feet to meters (metres) from feet-and-inches input such as 5\'10" or 5 ft 10 in, and get the result in m, cm and mm together.',
    keywords: ['ft to m', 'feet to metres', 'feet and inches to meters', 'convert feet to m'],
    category: 'units',
    icon: 'Ruler',
    faqs: [
      {
        q: 'How many metres is 6 feet?',
        a: '1.8288 m exactly, since a foot is defined as exactly 0.3048 m. Six foot two is 1.8796 m.',
      },
      {
        q: 'Can I type feet and inches together?',
        a: 'Yes. The tool reads 5\'10", 5 ft 10 in and 5ft10, and shows how it read your entry.',
      },
      {
        q: 'Which figure do visa and passport forms want?',
        a: 'Usually whole centimetres, which the tool shows next to the metre result. Round to the nearest centimetre. If you convert an inch value that is already rounded, you can lose about a centimetre of accuracy.',
      },
      {
        q: 'What about square feet to square metres?',
        a: 'That is a different conversion: divide by 10.7639, because the ratio squares. This page handles linear length only.',
      },
    ],
    related: ['meters-to-feet', 'yards-to-meters', 'inches-to-cm', 'cm-to-inches', 'length-converter'],
    updated: UPDATED,
  },
  {
    slug: 'yards-to-meters',
    title: 'Yards to Meters',
    h1: 'Convert yards to metres',
    description:
      'Convert yards to meters for fabric, turf and sports fields with the exact 0.9144 factor. Also shows feet, inches and centimetres.',
    keywords: ['yd to m', 'yards to metres', 'fabric yards to meters', 'convert yards'],
    category: 'units',
    icon: 'Ruler',
    faqs: [
      {
        q: 'How many metres in a yard?',
        a: 'Exactly 0.9144 m. This is a definition: in 1959 the yard was redefined in terms of the metre.',
      },
      {
        q: 'Is a yard nearly a metre?',
        a: 'Close, but the difference matters for fabric. A metre is about 3.4 inches longer than a yard, so 5 metres of fabric is 43 cm more than 5 yards.',
      },
      {
        q: 'How long is a 100 yard football field in metres?',
        a: '91.44 m between the goal lines, plus two 10-yard (9.144 m) end zones, giving 109.73 m overall.',
      },
      {
        q: 'What about cubic yards for concrete?',
        a: 'A cubic yard is 0.764555 m³ (the ratio cubed). This page converts length only.',
      },
    ],
    related: ['meters-to-feet', 'feet-to-meters', 'miles-to-km', 'cm-to-inches', 'length-converter'],
    updated: UPDATED,
  },

  /* ================= length: road distance ================= */
  {
    slug: 'miles-to-km',
    title: 'Miles to KM',
    h1: 'Convert miles to kilometres',
    description:
      'Convert miles to km with the exact 1.609344 factor. The table includes race distances, and each result also shows metres, yards and feet.',
    keywords: ['mi to km', 'miles to kilometers', 'convert miles', 'marathon in km'],
    category: 'units',
    icon: 'Route',
    faqs: [
      {
        q: 'How many kilometres is a mile?',
        a: 'Exactly 1.609344 km. The land mile is defined as 5,280 feet, and the foot as 0.3048 m, so the conversion is exact.',
      },
      {
        q: 'How long is a marathon in kilometres?',
        a: '42.195 km. The common figure of 26.2 miles is rounded. The distance was fixed in metres, at 42,195 m, in 1921.',
      },
      {
        q: 'Does this work for mph to km/h?',
        a: 'Yes, the ratio is the same: 60 mph is 96.56 km/h and 70 mph is 112.65 km/h. Convert the number and read the answer in the other unit per hour.',
      },
      {
        q: 'What about nautical miles?',
        a: 'A nautical mile is exactly 1.852 km, about 15% longer than a land mile. This page uses the statute (land) mile.',
      },
    ],
    related: ['km-to-miles', 'meters-to-feet', 'yards-to-meters', 'feet-to-meters', 'length-converter'],
    updated: UPDATED,
  },
  {
    slug: 'km-to-miles',
    title: 'KM to Miles',
    h1: 'Convert kilometres to miles',
    description:
      'Convert km to miles exactly. The table includes the half-marathon (21.0975 km) and marathon distances, with metres, feet and yards for each value.',
    keywords: ['km to mi', 'kilometers to miles', 'convert km', '5k in miles'],
    category: 'units',
    icon: 'Route',
    faqs: [
      {
        q: 'How many miles is 5 km?',
        a: '3.10686 miles, usually written as 3.1. A 10K is 6.21 miles and a half marathon (21.0975 km) is 13.109 miles.',
      },
      {
        q: 'Is the "multiply by 0.6" trick good enough?',
        a: 'For a rough figure, yes: 0.6 is within 3.5% of the true 0.621371. Over a marathon the error is nearly a mile, so use the real figure when it matters.',
      },
      {
        q: 'How do I convert a pace rather than a distance?',
        a: 'Pace is time per distance, so to get minutes per mile, multiply minutes per kilometre by 1.609344. A 5:00/km pace is 8:03/mile.',
      },
      {
        q: 'Why does my car show a different conversion?',
        a: 'Speedometers may legally over-read but must never under-read, so the displayed speed is typically 1–3% above the true speed in either unit. The arithmetic here is exact.',
      },
    ],
    related: ['miles-to-km', 'meters-to-feet', 'yards-to-meters', 'cm-to-inches', 'length-converter'],
    updated: UPDATED,
  },

  /* ================= mass ================= */
  {
    slug: 'kg-to-lbs',
    title: 'KG to LBS',
    h1: 'Convert kilograms to pounds',
    description:
      'Convert kg to lbs with the exact 0.45359237 definition. Also shows stone and pounds, pounds and ounces, and has a batch mode for columns.',
    keywords: ['kilograms to pounds', 'kg to lb', 'kg in pounds', 'convert kg'],
    category: 'units',
    icon: 'Scale',
    popular: true,
    faqs: [
      {
        q: 'How many pounds is 1 kg?',
        a: '2.20462262 lb. The pound is defined as exactly 0.45359237 kg, so the reverse figure is exact and this one is that value inverted.',
      },
      {
        q: 'Why does the page also show stone?',
        a: 'UK and Irish bathroom scales, GP surgeries and gyms still use stone and pounds. 70 kg is 154.32 lb, which is 11 st 0.3 lb. A plain decimal conversion does not give that number.',
      },
      {
        q: 'Is a pound of mass the same as a pound of force?',
        a: 'No. This converter handles mass (avoirdupois pounds). Pound-force is a unit of weight that depends on local gravity and is only numerically equal to pound-mass at standard gravity.',
      },
      {
        q: 'Can I convert a list of weights at once?',
        a: 'Yes. Paste a column into the Batch tab to get a matching column. Blank lines stay, so the result pastes back into a spreadsheet.',
      },
      {
        q: 'Do the numbers I enter leave my device?',
        a: 'No. JavaScript in this page does the calculation. The page sends no request and no analytics event with your data.',
      },
    ],
    related: ['lbs-to-kg', 'kg-to-stone', 'stone-to-pounds', 'kg-to-pounds-and-ounces', 'weight-converter'],
    updated: UPDATED,
  },
  {
    slug: 'lbs-to-kg',
    title: 'LBS to KG',
    h1: 'Convert pounds to kilograms',
    description:
      'Convert lbs to kg with the exact 0.45359237 factor. Accepts stone-and-pound entries such as 11 st 4 lb and converts pasted columns.',
    keywords: ['pounds to kilograms', 'lb to kg', 'lbs in kg', 'convert pounds'],
    category: 'units',
    icon: 'Scale',
    faqs: [
      {
        q: 'How many kg is 1 lb?',
        a: 'Exactly 0.45359237 kg. This definition was agreed internationally in 1959, so it is not an approximation.',
      },
      {
        q: 'Can I enter stone and pounds?',
        a: 'Yes. Type 11 st 4 lb and the tool reads it as 158 lb, then converts it. The page shows how it read the entry, so you can see a typo.',
      },
      {
        q: 'What is a healthy conversion habit for gym plates?',
        a: 'Remember that 45 lb is 20.41 kg and 25 lb is 11.34 kg. Imperial and metric plates are close but never identical, so a bar loaded from both sets is slightly uneven.',
      },
      {
        q: 'Why do airlines quote 23 kg rather than 50 lb?',
        a: '23 kg is 50.7 lb, so the metric allowance is slightly larger. The airport scale weighs bags in its own unit, and the difference matters only at the limit.',
      },
    ],
    related: ['kg-to-lbs', 'kg-to-stone', 'grams-to-ounces', 'ounces-to-grams', 'weight-converter'],
    updated: UPDATED,
  },
  {
    slug: 'kg-to-stone',
    title: 'KG to Stone',
    h1: 'Convert kilograms to stone and pounds',
    description:
      'Convert kg to stone with a stone-and-pounds answer, so 75 kg reads as 11 st 11.3 lb. Also shows decimal stone and pounds for forms.',
    keywords: ['kg to st', 'kilos to stone', 'kg in stone and pounds', 'weight in stone'],
    category: 'units',
    icon: 'Scale',
    faqs: [
      {
        q: 'How many kg in a stone?',
        a: '6.35029318 kg. A stone is 14 pounds, and a pound is exactly 0.45359237 kg, so the figure follows directly.',
      },
      {
        q: 'Why is 11.8 stone not "11 stone 8"?',
        a: 'The decimal is a fraction of a stone. 11.8 st is 11 st 11.2 lb, because 0.8 of 14 pounds is 11.2 pounds. This is a very common conversion mistake in the UK, so the tool shows the stone-and-pounds result separately.',
      },
      {
        q: 'Which countries still use stone?',
        a: 'Body weight in stone is normal in the UK and Ireland and almost nowhere else. Even there, medical records are kept in kilograms.',
      },
      {
        q: 'Is stone used for anything other than people?',
        a: 'Historically, for wool, livestock and produce, with different pound counts per stone by trade. Only the 14-pound body-weight stone survives in general use.',
      },
    ],
    related: ['stone-to-pounds', 'kg-to-lbs', 'lbs-to-kg', 'kg-to-pounds-and-ounces', 'weight-converter'],
    updated: UPDATED,
  },
  {
    slug: 'stone-to-pounds',
    title: 'Stone to Pounds',
    h1: 'Convert stone to pounds',
    description:
      'Convert stone to pounds and kilograms. Type 11 st 4 lb, 11.5 or 11 and the tool reads each form. A stone is exactly 14 pounds.',
    keywords: ['st to lb', 'stone to lbs', 'stone in pounds', 'stone to kg'],
    category: 'units',
    icon: 'Scale',
    faqs: [
      {
        q: 'How many pounds in a stone?',
        a: 'Exactly 14, by definition. The conversion is a whole-number multiplication with no rounding.',
      },
      {
        q: 'How do I write 11 stone 4 pounds as a decimal?',
        a: '11 st 4 lb is 158 lb, which is 11.2857 st. It is not 11.4, because the decimal is a fraction of fourteen pounds.',
      },
      {
        q: 'What is 11 stone in kilograms?',
        a: '69.85 kg, and 11 st 4 lb is 71.67 kg. The kilogram figure updates as you type.',
      },
      {
        q: 'Is there a "stone" in the US?',
        a: 'Not in everyday use. American scales and medical records use pounds, so for a US form, convert a UK weight to pounds.',
      },
    ],
    related: ['kg-to-stone', 'lbs-to-kg', 'kg-to-lbs', 'grams-to-ounces', 'weight-converter'],
    updated: UPDATED,
  },
  {
    slug: 'grams-to-ounces',
    title: 'Grams to Ounces',
    h1: 'Convert grams to ounces',
    description:
      'Convert grams to ounces (avoirdupois) with a pounds-and-ounces result for postage and a kitchen reference table for common weights.',
    keywords: ['g to oz', 'grams to ounces', 'grams in oz', 'convert grams'],
    category: 'units',
    icon: 'Scale',
    faqs: [
      {
        q: 'How many grams in an ounce?',
        a: '28.349523125 g exactly, for the avoirdupois ounce used for food and post. The troy ounce for precious metals is different: 31.1034768 g.',
      },
      {
        q: 'Is a fluid ounce the same thing?',
        a: 'No, and the two are unrelated. A fluid ounce measures volume (29.57 mL in the US). This page converts weight only.',
      },
      {
        q: 'What is 100 g in ounces?',
        a: '3.5274 oz, slightly more than three and a half. 500 g is 17.64 oz, and 1 kg is 35.27 oz or 2 lb 3.3 oz.',
      },
      {
        q: 'Why does my postage calculator disagree by a gram?',
        a: 'Postal tables round to whole ounces and then convert, which adds up to 28 g of error at a band limit. Weigh in grams and convert once. Do not convert a rounded ounce figure.',
      },
    ],
    related: ['ounces-to-grams', 'kg-to-lbs', 'lbs-to-kg', 'grams-to-cups', 'weight-converter'],
    updated: UPDATED,
  },
  {
    slug: 'ounces-to-grams',
    title: 'Ounces to Grams',
    h1: 'Convert ounces to grams',
    description:
      'Convert ounces to grams from fractions such as 1/2, 3/4 and 1 1/2. Also shows kilograms, pounds, and your entry in pounds and ounces.',
    keywords: ['oz to g', 'ounces to grams', 'oz in grams', 'convert ounces'],
    category: 'units',
    icon: 'Scale',
    faqs: [
      {
        q: 'How many grams is 1 oz?',
        a: '28.349523125 g. Rounding to 28.35 g is safe for cooking; rounding to 28 g introduces a 1.2% error, which shows up over a kilogram.',
      },
      {
        q: 'What is 8 oz in grams?',
        a: '226.8 g, which is half a pound. A 16 oz pound is 453.59 g, so "a pound of butter" and "450 g of butter" are almost the same block.',
      },
      {
        q: 'How do I convert ounces of liquid?',
        a: 'You need to know the liquid. A US fluid ounce is 29.5735 mL of volume, and converting it to grams needs the density. The ounces-to-cups tool shows both readings side by side.',
      },
      {
        q: 'Which ounce do gold prices use?',
        a: 'The troy ounce, 31.1034768 g, which is about 10% heavier than the avoirdupois ounce on this page. Do not mix them.',
      },
    ],
    related: ['grams-to-ounces', 'oz-to-cups', 'lbs-to-kg', 'grams-to-cups', 'weight-converter'],
    updated: UPDATED,
  },
  {
    slug: 'kg-to-pounds-and-ounces',
    title: 'KG to Pounds and Ounces',
    h1: 'Convert kilograms to pounds and ounces',
    description:
      'Convert kg to pounds and ounces, the format for birth weights and parcels: 3.4 kg is 7 lb 7.9 oz. Also shows the total in ounces and grams.',
    keywords: ['kg to lb oz', 'baby weight converter', 'kg to pounds ounces', 'birth weight kg'],
    category: 'units',
    icon: 'Baby',
    faqs: [
      {
        q: 'What is 3.4 kg in pounds and ounces?',
        a: '7 lb 7.9 oz. The decimal answer, 7.4957 lb, is the same weight. The decimal part, 0.4957 of a pound, is 7.9 ounces. Do not read it as 5 ounces.',
      },
      {
        q: 'Why is this the format hospitals use?',
        a: 'In the US and UK, birth weight is announced in pounds and ounces even where the chart records kilograms. Transcription errors happen in the conversion between them, so the exact remainder matters.',
      },
      {
        q: 'What counts as a low birth weight?',
        a: 'The WHO threshold is 2.5 kg, which is 5 lb 8.2 oz. This tool is a unit converter and does not give medical advice. Ask a midwife or paediatrician about any concern with a baby\'s weight.',
      },
      {
        q: 'Can I go the other way?',
        a: 'Yes. Type into the right-hand box, or press the swap button, and it converts pounds back to kilograms with the same exact factor.',
      },
    ],
    related: ['kg-to-lbs', 'lbs-to-kg', 'grams-to-ounces', 'kg-to-stone', 'weight-converter'],
    updated: UPDATED,
  },

  /* ================= temperature ================= */
  {
    slug: 'celsius-to-fahrenheit',
    title: 'Celsius to Fahrenheit',
    h1: 'Convert Celsius to Fahrenheit',
    description:
      'Celsius to Fahrenheit with the formula shown using your number, a drag-through slider, a Kelvin column and a table of reference points.',
    keywords: ['c to f', 'celsius fahrenheit', '°C to °F', 'convert celsius'],
    category: 'units',
    icon: 'Thermometer',
    popular: true,
    faqs: [
      {
        q: 'What is the Celsius to Fahrenheit formula?',
        a: '°F = (°C × 9/5) + 32. Multiply first. The scales have different degree sizes and different zero points, so adding 32 alone is wrong.',
      },
      {
        q: 'At what temperature do the two scales meet?',
        a: '−40. Minus forty Celsius is exactly minus forty Fahrenheit, the only point where the two scales agree.',
      },
      {
        q: 'What is 20 °C in Fahrenheit?',
        a: '68 °F, a mild room temperature. 25 °C is 77 °F, 30 °C is 86 °F, and 37 °C, normal body temperature, is 98.6 °F.',
      },
      {
        q: 'Is there a quick mental version?',
        a: 'Double it and add 30. That gives 70 for 20 °C (true value 68) and 60 for 15 °C (true value 59). This is good enough to choose a jacket, but too rough for an oven.',
      },
    ],
    related: ['fahrenheit-to-celsius', 'celsius-to-kelvin', 'oven-temperature-converter', 'fever-temperature-converter', 'temperature-converter'],
    updated: UPDATED,
  },
  {
    slug: 'fahrenheit-to-celsius',
    title: 'Fahrenheit to Celsius',
    h1: 'Convert Fahrenheit to Celsius',
    description:
      'Convert Fahrenheit to Celsius with each step of the formula shown, a slider from weather to oven temperatures, and Kelvin next to the result.',
    keywords: ['f to c', 'fahrenheit celsius', '°F to °C', 'convert fahrenheit'],
    category: 'units',
    icon: 'Thermometer',
    faqs: [
      {
        q: 'What is the Fahrenheit to Celsius formula?',
        a: '°C = (°F − 32) × 5/9. Subtract first, then scale. The reverse order is a common error and gives an answer about 14 degrees too low.',
      },
      {
        q: 'What is 98.6 °F in Celsius?',
        a: 'Exactly 37 °C. The figure 98.6 is a conversion of a round 37, which is why it looks so precise.',
      },
      {
        q: 'What is a comfortable thermostat setting in Celsius?',
        a: '68 °F is 20 °C and 72 °F is 22.2 °C. Most European heating advice lands on 19–21 °C for living rooms, which is 66–70 °F.',
      },
      {
        q: 'How cold is 0 °F?',
        a: '−17.8 °C. The zero of the Fahrenheit scale was set with a freezing brine mixture, so its landmarks do not line up with round Celsius values.',
      },
    ],
    related: ['celsius-to-fahrenheit', 'celsius-to-kelvin', 'oven-temperature-converter', 'fever-temperature-converter', 'temperature-converter'],
    updated: UPDATED,
  },
  {
    slug: 'celsius-to-kelvin',
    title: 'Celsius to Kelvin',
    h1: 'Convert Celsius to Kelvin',
    description:
      'Celsius to Kelvin with the exact 273.15 offset, absolute zero marked, Fahrenheit alongside and a slider from absolute zero to 1000 °C.',
    keywords: ['c to k', 'celsius kelvin', 'absolute temperature', 'convert to kelvin'],
    category: 'units',
    icon: 'ThermometerSnowflake',
    faqs: [
      {
        q: 'What is the Celsius to Kelvin formula?',
        a: 'K = °C + 273.15. There is no multiplication: a kelvin and a degree Celsius are exactly the same size, so only the zero point moves.',
      },
      {
        q: 'Why is it 273.15 and not 273?',
        a: 'Because the kelvin is defined so that the triple point of water sits at 273.16 K, which puts the ice point at 273.15 K. Dropping the 0.15 is a common shortcut in school problems and a real error in thermodynamics.',
      },
      {
        q: 'Do you write "degrees Kelvin"?',
        a: 'No. Kelvin is not a degree scale. Write 300 K and say "three hundred kelvin", with no degree sign and no capital on the unit name.',
      },
      {
        q: 'What is absolute zero?',
        a: '0 K, which is −273.15 °C or −459.67 °F. It is the point at which a system has minimum possible thermal energy, and it cannot be reached, only approached.',
      },
    ],
    related: ['celsius-to-fahrenheit', 'fahrenheit-to-celsius', 'temperature-converter', 'oven-temperature-converter'],
    updated: UPDATED,
  },
  {
    slug: 'fever-temperature-converter',
    title: 'Fever Temperature Converter',
    h1: 'Fever temperature converter (°C ↔ °F)',
    description:
      'Fever temperature converter for Celsius and Fahrenheit. See which band a reading falls in, from hypothermia to high fever, with the thresholds.',
    keywords: ['fever in celsius', 'fever chart', '38 c in f', 'temperature fever converter'],
    category: 'units',
    icon: 'ThermometerSun',
    faqs: [
      {
        q: 'What temperature counts as a fever?',
        a: '38.0 °C, which is 100.4 °F, is the threshold nearly every health service uses. Between 37.5 and 38 °C is usually described as a raised or low-grade temperature.',
      },
      {
        q: 'Is 37 °C really "normal"?',
        a: 'It is an average, published in 1868 and steadily revised down since. A healthy adult ranges roughly 36.1–37.5 °C across the day, lowest in the early morning and highest in the late afternoon.',
      },
      {
        q: 'Does the measurement site change the reading?',
        a: 'Yes. Rectal and ear readings are about 0.3–0.6 °C higher than oral, and armpit readings about 0.3–0.6 °C lower. Thresholds are usually for oral or tympanic measurement.',
      },
      {
        q: 'Should I use this to decide about medical care?',
        a: 'No. This is a unit converter with the common thresholds marked, and it does not diagnose. Any fever in an infant under three months, or any high fever with confusion, stiff neck, rash or breathing difficulty, needs urgent medical attention, whatever the number.',
      },
      {
        q: 'Is my family\'s health data stored?',
        a: 'No. Nothing is stored or sent. The conversion is arithmetic in your browser, and the page has no server part.',
      },
    ],
    related: ['celsius-to-fahrenheit', 'fahrenheit-to-celsius', 'celsius-to-kelvin', 'temperature-converter', 'bmi-calculator'],
    updated: UPDATED,
  },

  /* ================= kitchen ================= */
  {
    slug: 'grams-to-cups',
    title: 'Grams to Cups',
    h1: 'Convert grams to cups',
    description:
      'Convert grams to cups for over 100 ingredients, such as flour, sugar, butter, rice and cocoa, with a cup-standard selector and density notes.',
    keywords: ['g to cups', 'grams to cups flour', 'grams in a cup', 'baking conversion'],
    category: 'units',
    icon: 'CookingPot',
    faqs: [
      {
        q: 'How many grams are in a cup?',
        a: 'It depends on the ingredient. A US cup holds 236.6 mL, which is 237 g of water, 125 g of spooned flour, 200 g of granulated sugar and 85 g of cocoa powder. A single answer is correct only for water.',
      },
      {
        q: 'Why do flour conversions vary so much between sites?',
        a: 'Because of how the cup is filled. Flour spooned in and levelled is about 125 g. A cup dipped into the bag packs it to nearly 145 g. That 16% difference is a major cause of baking failures, and both figures are in the ingredient list.',
      },
      {
        q: 'Which cup should I choose?',
        a: 'US customary (236.6 mL) for American recipes, metric (250 mL) for Australian and New Zealand ones, and imperial (284 mL) only for pre-metric British books. The selector changes every number on the page.',
      },
      {
        q: 'Is a kitchen scale better?',
        a: 'Yes. A volume measure of a solid estimates its weight from an assumed packing density. A scale removes that assumption. This tool exists because recipes still use cups.',
      },
      {
        q: 'Does my recipe get uploaded?',
        a: 'No. The density table is part of the page and the arithmetic runs in your browser. Nothing you select or type is sent.',
      },
    ],
    related: ['cups-to-grams', 'ml-to-cups', 'oz-to-cups', 'tablespoons-to-cups', 'recipe-scaler'],
    updated: UPDATED,
  },
  {
    slug: 'cups-to-grams',
    title: 'Cups to Grams',
    h1: 'Convert cups to grams',
    description:
      'Convert cups to grams by ingredient, with fraction input such as 1 1/2 or 3/4, four cup standards, ounces, and a chart for the chosen ingredient.',
    keywords: ['cups to g', 'cup to grams flour', 'cups of sugar in grams', 'us cup grams'],
    category: 'units',
    icon: 'CookingPot',
    faqs: [
      {
        q: 'How many grams is 1 cup of flour?',
        a: '125 g of all-purpose flour if you spoon it in and level it off, which is the method most American recipes assume. Scooped from the bag, it is nearer 145 g. Bread flour is 130 g.',
      },
      {
        q: 'How many grams is 1 cup of sugar?',
        a: '200 g of granulated or caster sugar. Firmly packed brown sugar is 213 g, loose brown sugar 145 g, and unsifted icing sugar 120 g. You cannot swap one for another by volume.',
      },
      {
        q: 'Can I type fractions?',
        a: 'Yes. 1 1/2, 3/4, 1½ and 0.75 all work, because recipes use fractions.',
      },
      {
        q: 'Why does the answer change when I switch cup standard?',
        a: 'Because a cup is not a defined international unit. The US customary cup is 236.6 mL, the US legal cup 240 mL, the Australian metric cup 250 mL and the old British imperial cup 284 mL. That is a 20% spread from smallest to largest.',
      },
      {
        q: 'What if my ingredient is not listed?',
        a: 'Pick the nearest ingredient by texture: most flours behave alike, and so do most granulated sugars. Or weigh one cup of it once and use that number. A guessed density is more accurate than a guessed answer.',
      },
    ],
    related: ['grams-to-cups', 'tablespoons-to-cups', 'ml-to-cups', 'sticks-of-butter-converter', 'recipe-scaler'],
    updated: UPDATED,
  },
  {
    slug: 'ml-to-cups',
    title: 'ML to Cups',
    h1: 'Convert millilitres to cups',
    description:
      'Convert ml to cups in four standards at once (US customary, US legal, metric and imperial), plus fluid ounces, tablespoons and teaspoons.',
    keywords: ['ml to cups', 'milliliters to cups', '250 ml in cups', 'ml cup conversion'],
    category: 'units',
    icon: 'CupSoda',
    faqs: [
      {
        q: 'How many mL in a cup?',
        a: 'Four different answers, all correct in their own country: 236.588 mL (US customary), 240 mL (US legal, used on nutrition labels), 250 mL (Australia and New Zealand) and 284.131 mL (old British imperial). This page shows all four together.',
      },
      {
        q: 'Is 250 mL a cup?',
        a: 'It is exactly one metric cup, and about 1.06 US customary cups. A metric cup in a US recipe adds about 6% to each wet ingredient. You can notice that in a batter but not in a soup.',
      },
      {
        q: 'How many mL in a US fluid ounce?',
        a: '29.5735 mL. The imperial fluid ounce is 28.4131 mL, so a "16 oz" US pint (473 mL) is smaller than a 20 oz imperial pint (568 mL).',
      },
      {
        q: 'Do I need to pick an ingredient?',
        a: 'Only if you want the weight. Volume-to-volume conversion is arithmetic. With an ingredient selected, the page also shows what that volume weighs.',
      },
    ],
    related: ['cups-to-grams', 'grams-to-cups', 'oz-to-cups', 'tablespoons-to-cups', 'cooking-converter'],
    updated: UPDATED,
  },
  {
    slug: 'oz-to-cups',
    title: 'OZ to Cups',
    h1: 'Convert ounces to cups',
    description:
      'Convert oz to cups two ways, side by side: fluid ounces as volume and ounces as weight by ingredient, because recipes use "ounce" for both.',
    keywords: ['oz to cups', 'ounces to cups', 'fluid ounces to cups', '8 oz in cups'],
    category: 'units',
    icon: 'Beaker',
    faqs: [
      {
        q: 'How many ounces in a cup?',
        a: '8 US fluid ounces, if you mean volume. By weight the answer depends on the ingredient: a cup of flour is 4.4 oz, a cup of sugar 7.0 oz and a cup of water 8.3 oz. This page shows both readings so you can tell which one your recipe meant.',
      },
      {
        q: 'How do I know whether my recipe means fluid or weight ounces?',
        a: 'Liquids in US recipes are volume; "8 oz milk" means a cup. Dry ingredients in British and professional recipes are weight; "8 oz flour" means 227 g, which is nearly two cups. If the ingredient is a solid and the book is British, it is weight.',
      },
      {
        q: 'Is 8 oz always a cup?',
        a: 'Only for fluid ounces, and only with the US cup. Eight imperial fluid ounces is 227 mL, which is 0.96 of a US cup and 0.91 of a metric cup.',
      },
      {
        q: 'What about "a cup of coffee"?',
        a: 'Coffee makers use a 5 fl oz "cup". A twelve-cup carafe holds 60 fl oz, which is seven and a half 8 oz cups.',
      },
    ],
    related: ['ml-to-cups', 'cups-to-grams', 'grams-to-cups', 'ounces-to-grams', 'tablespoons-to-cups'],
    updated: UPDATED,
  },
  {
    slug: 'tablespoons-to-cups',
    title: 'Tablespoons to Cups',
    h1: 'Convert tablespoons to cups',
    description:
      'Convert tablespoons to cups with a selector for the US, metric and 20 mL Australian tablespoon, plus teaspoons, mL and grams.',
    keywords: ['tbsp to cups', 'tablespoons in a cup', 'tbsp cup conversion', 'how many tbsp in a cup'],
    category: 'units',
    icon: 'Utensils',
    faqs: [
      {
        q: 'How many tablespoons in a cup?',
        a: '16 US tablespoons make a US customary cup. An Australian tablespoon is 20 mL, so 11.8 of them fill that cup, and a metric 15 mL spoon gives 15.8. A 250 mL metric cup holds 12.5 Australian tablespoons.',
      },
      {
        q: 'Is a tablespoon 15 mL or 14.79 mL?',
        a: 'Both are in use. The US customary tablespoon is 14.7868 mL (half a fluid ounce); the metric tablespoon used across Europe is a round 15 mL. The 1.4% difference does not matter for one spoon, but it adds up over sixteen.',
      },
      {
        q: 'How many teaspoons in a tablespoon?',
        a: 'Three, everywhere except Australia, where the 20 mL tablespoon holds four 5 mL teaspoons. This is the most common Australian recipe trap.',
      },
      {
        q: 'How do I measure 3/4 cup with spoons?',
        a: '12 US tablespoons. Half a cup is 8, a third is 5 tablespoons plus 1 teaspoon, and a quarter is 4. The table on this page has the full list.',
      },
    ],
    related: ['cups-to-grams', 'ml-to-cups', 'grams-to-cups', 'sticks-of-butter-converter', 'cooking-converter'],
    updated: UPDATED,
  },
  {
    slug: 'sticks-of-butter-converter',
    title: 'Sticks of Butter Converter',
    h1: 'Sticks of butter to grams, cups and tablespoons',
    description:
      'Convert sticks of butter to grams, ounces, cups and tablespoons. One US stick is a quarter pound: 113.4 g, half a cup or 8 tablespoons.',
    keywords: ['stick of butter in grams', 'butter conversion', 'half stick butter', 'butter cups grams'],
    category: 'units',
    icon: 'Croissant',
    faqs: [
      {
        q: 'How many grams is a stick of butter?',
        a: '113.4 g, because a US stick is exactly a quarter of a pound. A four-stick pack is one pound, or 453.6 g.',
      },
      {
        q: 'How many tablespoons in a stick of butter?',
        a: 'Eight. The wrapper has tablespoon marks, which is the easiest way to measure butter without a scale. A stick is also exactly half a US cup.',
      },
      {
        q: 'What do I use outside the US?',
        a: 'European butter comes in 200 g, 250 g and 500 g blocks, so there is no stick to count. Convert to grams and cut the block by eye against a ruler, or weigh it.',
      },
      {
        q: 'Are Elgin and Western sticks different?',
        a: 'Only in shape. East of the Rockies butter is sold in long, thin "Elgin" sticks; west of them, short and fat "Western" sticks. Both are 4 oz, so every number here applies to either.',
      },
    ],
    related: ['cups-to-grams', 'grams-to-cups', 'tablespoons-to-cups', 'ounces-to-grams', 'recipe-scaler'],
    updated: UPDATED,
  },
  {
    slug: 'oven-temperature-converter',
    title: 'Oven Temperature Converter',
    h1: 'Oven temperature converter',
    description:
      'Convert oven temperatures between Celsius, Fahrenheit, gas mark and fan/convection, with the descriptive terms old cookbooks use and a full chart.',
    keywords: ['gas mark to celsius', 'fan oven conversion', '350f in celsius', 'oven temp chart'],
    category: 'units',
    icon: 'Flame',
    faqs: [
      {
        q: 'What is 350 °F in Celsius for a fan oven?',
        a: '350 °F is 177 °C, which recipes round to 180 °C. For a fan oven, use 160 °C, the standard 20 °C reduction.',
      },
      {
        q: 'What is gas mark 4?',
        a: '180 °C conventional, 160 °C fan, 350 °F. It is the usual setting for most cakes and biscuits in British recipes.',
      },
      {
        q: 'Why do fan ovens need a lower temperature?',
        a: 'Moving air strips away the insulating boundary layer of still air around the food, so heat transfers faster at the same air temperature. The 20 °C reduction compensates. Some manufacturers say 25 °C. The difference is within the accuracy of a domestic oven.',
      },
      {
        q: 'Is there a formula for gas marks?',
        a: 'Above mark 1, yes: °F = 25 × (mark + 10). Gas mark 4 is 25 × 14 = 350 °F. Below mark 1 the ladder breaks down, with mark 1/2 at 250 °F and mark 1/4 at 225 °F.',
      },
      {
        q: 'Is my oven actually at the temperature it says?',
        a: 'Probably not. Domestic ovens often run 10–20 °C off their dial and swing further as the thermostat cycles. An oven thermometer is more useful than a conversion chart.',
      },
    ],
    related: ['celsius-to-fahrenheit', 'fahrenheit-to-celsius', 'recipe-scaler', 'cups-to-grams', 'temperature-converter'],
    updated: UPDATED,
  },
  {
    slug: 'recipe-scaler',
    title: 'Recipe Scaler',
    h1: 'Recipe scaler: resize a whole ingredient list',
    description:
      'Recipe scaler: paste an ingredient list and scale each quantity to a new serving count. Results are kitchen fractions, with optional metric weights.',
    keywords: ['recipe converter', 'halve a recipe', 'double a recipe', 'scale recipe servings'],
    category: 'units',
    icon: 'ChefHat',
    faqs: [
      {
        q: 'Does it handle fractions and ranges?',
        a: 'Yes. The tool reads 1 1/2, 1½, 3/4 and "2-3 tbsp", scales them, and writes the results as fractions that match measuring spoons.',
      },
      {
        q: 'What happens to lines with no quantity?',
        a: 'They do not change. Headings, method notes and "salt to taste" stay as you typed them, so the output is still an ingredient list you can use.',
      },
      {
        q: 'Should I scale everything linearly?',
        a: 'Not quite. Use slightly less salt, raising agent, strong spice and alcohol than the scaled amount. Baking time depends on the depth of the food in the pan. When you double a recipe, sear in batches. The numbers are a starting point.',
      },
      {
        q: 'Can it convert cups to grams at the same time?',
        a: 'Yes. Turn on the metric option and each cup or spoon measure gets a gram figure. It uses the same ingredient density table as the grams-to-cups tool.',
      },
      {
        q: 'Is my recipe uploaded anywhere?',
        a: 'No. The text stays in the text box in your browser. Nothing is saved to a server or sent in an analytics event.',
      },
    ],
    related: ['cups-to-grams', 'grams-to-cups', 'oven-temperature-converter', 'tablespoons-to-cups', 'cooking-converter'],
    updated: UPDATED,
  },

  /* ================= sizes ================= */
  {
    slug: 'shoe-size-converter',
    title: 'Shoe Size Converter',
    h1: 'Shoe size converter (US, UK, EU, JP)',
    description:
      'Convert shoe sizes between US, UK, EU and Japanese systems. Each size comes from foot length in centimetres, which does not change between brands.',
    keywords: ['shoe size chart', 'us to uk shoe size', 'eu shoe size', 'foot length shoe size'],
    category: 'units',
    icon: 'Footprints',
    faqs: [
      {
        q: 'How do I measure my foot?',
        a: 'Stand on a sheet of paper with your heel against a wall, at the end of the day when your feet are largest. Mark the tip of your longest toe, measure from heel to mark, and do both feet. Use the longer one.',
      },
      {
        q: 'Why do converters disagree with each other?',
        a: 'There is no international standard. US and UK sizes come from the barleycorn (1/3 inch) system with different starting points. EU sizes use the Paris point (2/3 cm) measured on the last (the shoe form), not on the foot. Only foot length in centimetres has one meaning, so every row here starts from it.',
      },
      {
        q: 'What is Mondopoint?',
        a: 'Sizing by foot length in millimetres, sometimes with width. It is the ISO system, used for ski boots and military footwear, and it matches a Japanese size in centimetres.',
      },
      {
        q: 'What do the width letters mean?',
        a: 'They describe the girth of the shoe at the ball of the foot. D is standard for men and wide for women; B is standard for women. The table on this page lists the full ladder from 2A to 6E.',
      },
      {
        q: 'Will one size fit across brands?',
        a: 'No. A running brand and a dress-shoe brand can be a full size apart for the same label, and no chart can fix that. Buy by the foot length the brand publishes, and try both half sizes.',
      },
    ],
    related: ['clothing-size-converter', 'ring-size-converter', 'cm-to-inches', 'inches-to-cm', 'length-converter'],
    updated: UPDATED,
  },
  {
    slug: 'clothing-size-converter',
    title: 'Clothing Size Converter',
    h1: 'Clothing size converter (US, UK, EU, IT, FR, JP)',
    description:
      "Convert women's and men's clothing sizes and jeans waists across US, UK, EU, French, Italian and Japanese labels, driven by body measurements.",
    keywords: ['us to uk clothing size', 'eu size chart', 'women size conversion', 'jeans waist size'],
    category: 'units',
    icon: 'Shirt',
    faqs: [
      {
        q: 'How do I measure for a size chart?',
        a: 'Over light clothing, with the tape level and snug but not pulled tight. Bust and chest go round the fullest point, waist round the narrowest part of the torso, hips round the widest point of the seat.',
      },
      {
        q: 'Why is a US 4 a UK 8?',
        a: 'The two systems are four sizes apart. That offset is a convention and not a standard, and both systems changed over decades of vanity sizing. So this converter starts from a body measurement and gives the label for each system.',
      },
      {
        q: 'How do Italian and French sizes relate?',
        a: "For women's clothing, Italian sizes are about six numbers above the German/EU number and French sizes about two. A German 38 is about a French 40 and an Italian 44.",
      },
      {
        q: 'Why do jeans in my "size" not fit?',
        a: 'Denim waist labels are often smaller than the real waist. Jeans labelled W32 vary by several centimetres between brands, and between cuts of one brand. Measure a pair that fits you and match to that.',
      },
      {
        q: 'Are these charts brand-specific?',
        a: 'No. They are common industry mid-points. If a brand publishes its own measurement chart, use that, because these labels have no legal definition.',
      },
    ],
    related: ['shoe-size-converter', 'ring-size-converter', 'cm-to-inches', 'inches-to-cm', 'kg-to-lbs'],
    updated: UPDATED,
  },
  {
    slug: 'ring-size-converter',
    title: 'Ring Size Converter',
    h1: 'Ring size converter and on-screen sizer',
    description:
      'Convert ring sizes between US, UK, EU/ISO and Japanese systems, plus an on-screen sizer you calibrate against a bank card and a printable strip.',
    keywords: ['ring size chart', 'uk to us ring size', 'ring size mm', 'measure ring size'],
    category: 'units',
    icon: 'Gem',
    faqs: [
      {
        q: 'How do I measure a ring size at home?',
        a: 'Measure a ring that already fits the right finger. Lay it over the on-screen circle after calibrating the screen with a bank card, or print the sizer at 100% scale and match it there. Measuring the finger with string is much less reliable.',
      },
      {
        q: 'How does the screen calibration work?',
        a: 'Every ID-1 payment card is exactly 85.60 mm wide. You drag the on-screen box until it matches a real card, which tells the page how many pixels your display uses per millimetre. The ring circle is then drawn at true size.',
      },
      {
        q: 'What is the EU ring size?',
        a: 'The ISO 8653 size, which is the inside circumference of the band in millimetres. A US 7 is 54.4 mm, so it is a European 54 or 54.4.',
      },
      {
        q: 'How do UK letters map to US numbers?',
        a: 'Roughly two letters per US size: UK N is close to US 6.75, UK L 1/2 is US 6, and UK T 1/2 is US 10. The full table is on this page, with the millimetre figures that both are derived from.',
      },
      {
        q: 'When should I size up?',
        a: 'Fingers swell in heat and late in the day and shrink in cold, by as much as half a size. Wide bands fit tighter than narrow ones at the same nominal size. For a permanent ring, measure warm and consider a quarter size up for a band over 6 mm wide.',
      },
    ],
    related: ['shoe-size-converter', 'clothing-size-converter', 'mm-to-inches', 'cm-to-inches', 'length-converter'],
    updated: UPDATED,
  },

  /* ================= cycle dates ================= */
  {
    slug: 'ovulation-calculator',
    title: 'Ovulation Calculator',
    h1: 'Ovulation calculator and fertile window',
    description:
      'Ovulation calculator: find your ovulation date and six-day fertile window from the first day of your last period and your cycle length.',
    keywords: ['fertile window calculator', 'ovulation date', 'when do i ovulate', 'fertility calendar'],
    category: 'health',
    icon: 'CalendarHeart',
    popular: true,
    faqs: [
      {
        q: 'When do I ovulate?',
        a: 'About 14 days before your next period starts. This is not always 14 days after the last one began. The calculator asks for your luteal phase length because the second half of the cycle is much more consistent than the first, so counting back from the next period is more accurate than counting forward.',
      },
      {
        q: 'How long is the fertile window?',
        a: 'Six days: the five days before ovulation plus the day itself. Sperm can survive up to five days in fertile cervical mucus, while an egg is viable for around 24 hours. Conception rates are highest in the two days immediately before ovulation.',
      },
      {
        q: 'How accurate is a calendar prediction?',
        a: 'It is an estimate from an average, and cycle length varies month to month for most people. Ovulation predictor kits that detect the LH surge, basal body temperature charts and cervical mucus observation measure what happened. Use one of them together with this calculator.',
      },
      {
        q: 'Can I use this to avoid pregnancy?',
        a: 'No. Calendar-only methods are among the least reliable forms of contraception, with typical-use failure rates around 12–24% per year. Symptothermal fertility awareness methods taught by an instructor are a different method.',
      },
      {
        q: 'Is my reproductive health data safe here?',
        a: 'Your data stays on your device. This page has no server, cookies, analytics or account. Saving your dates is off by default. If you turn it on, the dates go to your browser storage, and the delete button removes them.',
      },
    ],
    related: ['period-calculator', 'conception-date-calculator', 'pregnancy-due-date-calculator', 'bmi-calculator', 'water-intake-calculator'],
    updated: UPDATED,
  },
  {
    slug: 'period-calculator',
    title: 'Period Calculator',
    h1: 'Period calculator: your next six cycles',
    description:
      'Period calculator: predict your next six periods and premenstrual weeks from one date and your cycle length, with a printable calendar.',
    keywords: ['menstrual cycle calculator', 'next period date', 'pms calendar', 'period tracker offline'],
    category: 'health',
    icon: 'CalendarDays',
    faqs: [
      {
        q: 'How is the next period date worked out?',
        a: 'By adding your average cycle length to the first day of your last period, then repeating. Cycle length is measured from the first day of one period to the day before the next starts. It is not measured from the day bleeding stops.',
      },
      {
        q: 'What counts as a normal cycle length?',
        a: 'Anything from 21 to 35 days in adults, and up to 45 days in the first few years after menarche. Variation of a few days month to month is normal; a sudden persistent change is worth mentioning to a clinician.',
      },
      {
        q: 'When does PMS usually start?',
        a: 'In the luteal phase, most often in the week before bleeding starts. This is the amber band on the calendar. Symptoms usually ease within a day or two after the period begins.',
      },
      {
        q: 'Why does this show a fertile window on a period calculator?',
        a: 'Because the same two inputs produce it, and knowing where ovulation falls explains why a period arrives when it does. If you are trying to conceive, the ovulation calculator uses the same calculation for that purpose.',
      },
      {
        q: 'Do you store my dates?',
        a: 'Only if you turn it on, and only in your own browser. There is no account, sync or server, so the tracker has no copy of your data to leak. The delete button clears the local copy.',
      },
    ],
    related: ['ovulation-calculator', 'conception-date-calculator', 'pregnancy-due-date-calculator', 'bmi-calculator', 'water-intake-calculator'],
    updated: UPDATED,
  },
  {
    slug: 'conception-date-calculator',
    title: 'Conception Date Calculator',
    h1: 'Conception date calculator',
    description:
      'Conception date calculator: count back 266 days from a due date to the estimated conception date and six-day window, or forward from your last period.',
    keywords: ['when did i conceive', 'conception date from due date', 'date of conception', 'estimated conception'],
    category: 'health',
    icon: 'Baby',
    faqs: [
      {
        q: 'How is the conception date calculated from a due date?',
        a: 'By subtracting 266 days. Pregnancy is dated from the first day of the last period, 280 days before the due date, but conception happens at ovulation, about 14 days later. 280 minus 14 is 266.',
      },
      {
        q: 'Is the conception date the same as the day of intercourse?',
        a: 'Not always. Sperm survive up to five days, so conception can occur days after intercourse. For this reason the tool gives a six-day window and not a single date, and a conception date is never proof of anything.',
      },
      {
        q: 'How accurate is a due date from a dating scan?',
        a: 'A first-trimester ultrasound is accurate to about ±5 days and is the standard used to set or revise a due date. Working back from a scan-based due date is more reliable than working forward from a remembered period.',
      },
      {
        q: 'Can this establish paternity or an exact date?',
        a: 'No. The window is six days wide, ovulation timing varies, and due dates are estimates. This page does date arithmetic, and its results are not evidence.',
      },
      {
        q: 'Is any of this sent anywhere?',
        a: 'No. Your browser processes the dates and discards them when you close the tab, unless you turn on local saving. One click deletes the saved dates.',
      },
    ],
    related: ['ovulation-calculator', 'period-calculator', 'pregnancy-due-date-calculator', 'bmi-calculator'],
    updated: UPDATED,
  },
]
