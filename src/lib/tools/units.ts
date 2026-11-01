import type { Tool } from './types'

export const tools: Tool[] = [
  {
    slug: 'length-converter',
    title: 'Length Converter',
    h1: 'Length and distance converter',
    description:
      'Length converter for cm to inches, metres to feet, km to miles and 13 other units. Each result uses an exact factor and shows the formula.',
    keywords: [
      'cm to inches',
      'meters to feet',
      'km to miles',
      'distance converter',
      'mm to inches',
      'feet to meters',
      'inches to cm',
      'yards to meters',
    ],
    category: 'units',
    icon: 'Ruler',
    popular: true,
    faqs: [
      {
        q: 'How many centimetres are in an inch?',
        a: 'Exactly 2.54. An international agreement in 1959 defined the inch as 25.4 mm, so cm → in is a division by 2.54 with no rounding.',
      },
      {
        q: 'How do I convert metres to feet in my head?',
        a: 'Multiply by 3 and add ten per cent: 10 m becomes about 33 ft, and the true value is 32.81 ft. For an exact result, use the factor 3.280839895 in the formula panel.',
      },
      {
        q: 'Is a nautical mile the same as a mile?',
        a: 'No. A nautical mile is exactly 1,852 m (one minute of latitude). A statute mile is 1,609.344 m. A nautical mile is about 15 % longer.',
      },
      {
        q: 'Can I convert astronomical distances?',
        a: 'Yes. Light-years and astronomical units are included. Results above 10¹⁸ switch to scientific notation, so no digits are cut off.',
      },
      {
        q: 'Does this send my numbers anywhere?',
        a: 'No. The conversion table and the arithmetic are part of the page and run in your browser. The tool also works with the network off.',
      },
    ],
    related: ['area-converter', 'weight-converter', 'speed-converter', 'volume-converter'],
    updated: '2026-11-01',
  },
  {
    slug: 'weight-converter',
    title: 'Weight Converter',
    h1: 'Weight and mass converter',
    description:
      'Weight converter for kg to lbs, grams to ounces, stone to kilos and tonnes to tons, with exact factors, two-way fields and a reference table.',
    keywords: [
      'kg to lbs',
      'pounds to kg',
      'grams to ounces',
      'stone to kg',
      'mass converter',
      'oz to grams',
      'tonnes to tons',
      'lbs to stone',
    ],
    category: 'units',
    icon: 'Scale',
    popular: true,
    faqs: [
      {
        q: 'How many pounds are in a kilogram?',
        a: '2.2046226218 lb. The pound is defined as exactly 0.45359237 kg, so the reverse direction (pounds to kilograms) is the exact one.',
      },
      {
        q: 'What is the difference between a US ton, a UK ton and a tonne?',
        a: 'A short (US) ton is 2,000 lb = 907.18 kg, a long (UK) ton is 2,240 lb = 1,016.05 kg, and a metric tonne is exactly 1,000 kg. All three are in the list.',
      },
      {
        q: 'Why is a troy ounce different from a normal ounce?',
        a: 'A troy ounce (31.103 g) is used only for precious metals; the everyday avoirdupois ounce is 28.35 g. Quoting gold in the wrong one overstates it by about 10 %.',
      },
      {
        q: 'Is weight the same as mass?',
        a: 'Strictly, no. Mass is the amount of matter, and weight is the force of gravity on it. Everyday use treats them as the same thing. Every unit here is a mass unit.',
      },
    ],
    related: ['length-converter', 'cooking-converter', 'volume-converter', 'bmi-calculator'],
    updated: '2026-11-01',
  },
  {
    slug: 'temperature-converter',
    title: 'Temperature Converter',
    h1: 'Temperature converter',
    description:
      'Temperature converter for Celsius to Fahrenheit, Kelvin, Rankine and Réaumur, with the formula shown, an absolute-zero check and a lookup chart.',
    keywords: [
      'celsius to fahrenheit',
      'fahrenheit to celsius',
      'c to f',
      'kelvin converter',
      'f to c',
      'temperature conversion formula',
      'rankine',
      'oven temperature conversion',
    ],
    category: 'units',
    icon: 'Thermometer',
    popular: true,
    faqs: [
      {
        q: 'What is the formula for Celsius to Fahrenheit?',
        a: '°F = °C × 1.8 + 32. The reverse is °C = (°F − 32) × 5⁄9. The tool shows both formulas with your number in them.',
      },
      {
        q: 'At what temperature are Celsius and Fahrenheit the same?',
        a: '−40°. It is the one point where the two scales cross, so it is a good test for any converter.',
      },
      {
        q: 'Why can I not enter a temperature below −273.15 °C?',
        a: 'That is absolute zero, the point where a substance has no thermal energy left. Nothing can be colder, so the tool flags the input and gives no result.',
      },
      {
        q: 'Do I need Kelvin for everyday use?',
        a: 'Rarely. It is the SI unit, so scientific work, colour temperature and gas-law calculations use it. Kelvin is Celsius shifted by 273.15 with no scaling.',
      },
      {
        q: 'What is Réaumur?',
        a: 'An 18th-century scale where water freezes at 0 °Ré and boils at 80 °Ré. It survives in a few traditional cheese, syrup and confectionery recipes.',
      },
    ],
    related: ['cooking-converter', 'energy-converter', 'pressure-converter', 'length-converter'],
    updated: '2026-11-01',
  },
  {
    slug: 'volume-converter',
    title: 'Volume Converter',
    h1: 'Volume and capacity converter',
    description:
      'Volume converter for litres, millilitres, US and imperial gallons, quarts, pints, cups and fluid ounces, with US and UK units kept separate.',
    keywords: [
      'litres to gallons',
      'ml to oz',
      'gallons to litres',
      'cups to ml',
      'us gallon vs imperial gallon',
      'quarts to litres',
      'pints to ml',
      'cubic meters to litres',
    ],
    category: 'units',
    icon: 'FlaskConical',
    faqs: [
      {
        q: 'Is a US gallon the same as a UK gallon?',
        a: 'No. A US liquid gallon is 3.785 L. An imperial gallon is 4.546 L, about 20 % larger. The list shows them as separate units.',
      },
      {
        q: 'How many millilitres are in a fluid ounce?',
        a: '29.5735 mL for a US fluid ounce and 28.4131 mL for an imperial one. The UK ounce is the smaller of the two, even though the UK pint is the bigger one.',
      },
      {
        q: 'Are litres and cubic decimetres the same?',
        a: 'Yes, exactly. One litre is one cubic decimetre, and one millilitre is one cubic centimetre, which is why cc and mL are interchangeable on syringes and engines.',
      },
      {
        q: 'Which cup should I use for recipes?',
        a: 'A US cup is 236.6 mL. The metric cup used in the UK, Australia and New Zealand is exactly 250 mL. For ingredient weights, use the cooking converter.',
      },
    ],
    related: ['cooking-converter', 'weight-converter', 'length-converter', 'area-converter', 'fuel-cost-calculator'],
    updated: '2026-11-01',
  },
  {
    slug: 'area-converter',
    title: 'Area Converter',
    h1: 'Area converter',
    description:
      'Area converter for square metres to square feet, acres to hectares and other area units. Land units such as the acre use exact defined factors.',
    keywords: [
      'square meters to square feet',
      'acres to hectares',
      'hectares to acres',
      'sq ft to sq m',
      'land area converter',
      'square miles to km2',
      'acre to sq ft',
    ],
    category: 'units',
    icon: 'LandPlot',
    faqs: [
      {
        q: 'How many square feet are in a square metre?',
        a: '10.7639 ft². The factor is the square of the linear one: 1 m = 3.28084 ft, and 3.28084² = 10.7639.',
      },
      {
        q: 'How big is an acre?',
        a: 'Exactly 43,560 ft², or 4,046.8564224 m² (about 0.4047 hectares). It was first the area one ox team could plough in a day.',
      },
      {
        q: 'What is a hectare?',
        a: 'A square 100 m on each side, so 10,000 m². It is the standard land unit almost everywhere outside the US, and equals 2.4711 acres.',
      },
      {
        q: 'Why is a square mile 640 acres?',
        a: 'The US Public Land Survey divided land into one-square-mile sections, and each section into 16 quarter-quarter sections of 40 acres.',
      },
    ],
    related: ['length-converter', 'volume-converter', 'angle-converter', 'triangle-calculator', 'weight-converter'],
    updated: '2026-11-01',
  },
  {
    slug: 'speed-converter',
    title: 'Speed Converter',
    h1: 'Speed converter',
    description:
      'Speed converter for km/h to mph, m/s to km/h, knots, feet per second and Mach, with exact factors and a printable two-way speed chart.',
    keywords: [
      'kmh to mph',
      'mph to kmh',
      'm/s to km/h',
      'knots to mph',
      'knots to km/h',
      'mach to mph',
      'speed conversion',
      'fps to mph',
    ],
    category: 'units',
    icon: 'Gauge',
    faqs: [
      {
        q: 'How do I convert km/h to mph quickly?',
        a: 'Multiply by 0.621371, or halve it and add ten per cent for a rough figure: 100 km/h ≈ 50 + 12 = 62 mph, against the exact 62.14 mph.',
      },
      {
        q: 'What is a knot?',
        a: 'One nautical mile per hour, which is exactly 1.852 km/h. It is used at sea and in aviation because a nautical mile is one minute of latitude on a chart.',
      },
      {
        q: 'Is Mach 1 a fixed speed?',
        a: 'No. It is the local speed of sound, which depends on air temperature. This tool uses the sea-level standard of 340.29 m/s; at cruise altitude Mach 1 is nearer 295 m/s.',
      },
      {
        q: 'How do I convert m/s to km/h?',
        a: 'Multiply by 3.6, because there are 3,600 seconds in an hour and 1,000 metres in a kilometre. Dividing by 3.6 goes back the other way.',
      },
    ],
    related: ['length-converter', 'time-converter', 'fuel-economy-converter', 'pace-calculator', 'power-converter'],
    updated: '2026-11-01',
  },
  {
    slug: 'time-converter',
    title: 'Time Converter',
    h1: 'Time unit converter',
    description:
      'Time converter for seconds, minutes, hours, days, weeks, months, years and nanoseconds. A year is the Gregorian average of 365.2425 days.',
    keywords: [
      'minutes to hours',
      'seconds to minutes',
      'days to hours',
      'hours to days',
      'weeks to months',
      'milliseconds to seconds',
      'years to days',
      'time unit conversion',
    ],
    category: 'units',
    icon: 'Clock',
    faqs: [
      {
        q: 'How long is a "month" here?',
        a: 'One twelfth of an average Gregorian year, which is 30.436875 days. Real calendar months are 28 to 31 days, so use the date-difference calculator when exact dates matter.',
      },
      {
        q: 'Why is a year 365.2425 days and not 365?',
        a: 'Because of leap years. The Gregorian rule adds a day every four years, skips century years, but keeps every fourth century. The average is 365.2425 days.',
      },
      {
        q: 'How many seconds are in a day?',
        a: '86,400, assuming a 24-hour day. Leap seconds make a few real days one second longer, but ordinary calculations ignore them.',
      },
      {
        q: 'Can I convert milliseconds for performance work?',
        a: 'Yes. Nanoseconds, microseconds and milliseconds are included. Results keep up to 12 significant digits, then switch to scientific notation.',
      },
    ],
    related: ['speed-converter', 'data-storage-converter', 'age-calculator', 'time-duration-calculator'],
    updated: '2026-11-01',
  },
  {
    slug: 'data-storage-converter',
    title: 'Data Storage Converter',
    h1: 'Data storage converter (KB, MB, GB, TB)',
    description:
      'Data storage converter for bytes, KB, MB, GB, TB and PB, with a switch between 1000-based and 1024-based units, plus the IEC KiB, MiB and GiB.',
    keywords: [
      'mb to gb',
      'gb to tb',
      'kb to mb',
      'bytes to mb',
      '1024 vs 1000',
      'gib to gb',
      'why is my hard drive smaller',
      'bits to bytes',
    ],
    category: 'units',
    icon: 'HardDrive',
    faqs: [
      {
        q: 'Is a gigabyte 1,000 or 1,024 megabytes?',
        a: 'Both answers are in use. Drive makers, macOS and the SI standard say 1,000; Windows and RAM sizes say 1,024. The switch above changes every KB/MB/GB/TB row at once.',
      },
      {
        q: 'Why does my 1 TB drive show as 931 GB?',
        a: 'The drive has 1,000,000,000,000 bytes. Windows divides that by 1,024 three times, which gives 931.32, and labels the result GB even though it means GiB.',
      },
      {
        q: 'What are KiB, MiB and GiB?',
        a: 'The IEC binary units, always powers of 1,024 and never ambiguous. A kibibyte is 1,024 bytes, a mebibyte is 1,048,576 bytes, and so on up the scale.',
      },
      {
        q: 'Why are internet speeds in megabits, not megabytes?',
        a: 'Networking has always counted bits. A 100 Mbps line moves at most 12.5 MB per second, because there are 8 bits in a byte. Convert bit to byte above to check.',
      },
    ],
    related: ['number-base-converter', 'time-converter', 'compress-image', 'compress-pdf', 'base64-encoder-decoder'],
    updated: '2026-11-01',
  },
  {
    slug: 'pressure-converter',
    title: 'Pressure Converter',
    h1: 'Pressure converter',
    description:
      'Pressure converter for bar to psi, kPa, MPa, atmospheres, torr, mmHg and inHg. Use it for tyre pressure, blood pressure and weather readings.',
    keywords: [
      'bar to psi',
      'psi to bar',
      'kpa to psi',
      'mmhg to kpa',
      'atm to psi',
      'tyre pressure converter',
      'inhg to hpa',
      'pascal converter',
    ],
    category: 'units',
    icon: 'CircleGauge',
    faqs: [
      {
        q: 'How many psi are in a bar?',
        a: '14.5038 psi. Car tyres are the usual reason people ask: 2.2 bar is 32 psi, and 2.5 bar is 36 psi.',
      },
      {
        q: 'Is 1 bar the same as 1 atmosphere?',
        a: 'Almost. A bar is exactly 100 kPa; a standard atmosphere is 101.325 kPa, so an atmosphere is 1.325 % larger. Weather reports use hectopascals, which equal millibars exactly.',
      },
      {
        q: 'Why is blood pressure measured in mmHg?',
        a: 'Because the original instrument was a column of mercury, and a reading of 120 meant the pressure raised the column 120 mm. The unit stayed even though the mercury mostly has not.',
      },
      {
        q: 'What is the difference between torr and mmHg?',
        a: 'A torr is exactly 1⁄760 of an atmosphere, and a millimetre of mercury is 133.322387415 Pa. They differ by about one part in seven million, which matters only in metrology.',
      },
    ],
    related: ['temperature-converter', 'energy-converter', 'power-converter', 'weight-converter'],
    updated: '2026-11-01',
  },
  {
    slug: 'energy-converter',
    title: 'Energy Converter',
    h1: 'Energy converter',
    description:
      'Energy converter for joules, kilojoules, calories, kcal, watt-hours, kWh, BTU, therms and electronvolts, with exact definitions and the formula.',
    keywords: [
      'kcal to kj',
      'kj to calories',
      'kwh to joules',
      'btu to kwh',
      'joules to calories',
      'therms to kwh',
      'energy conversion',
      'ev to joules',
    ],
    category: 'units',
    icon: 'Zap',
    faqs: [
      {
        q: 'How many kilojoules are in a kilocalorie?',
        a: '4.184 kJ exactly. That is why a 500-Calorie meal is labelled 2,092 kJ in countries that use kilojoules on nutrition panels.',
      },
      {
        q: 'Is a food Calorie the same as a calorie?',
        a: 'No. The capital-C Calorie on a food label is a kilocalorie, which is 1,000 small calories. Both are in the list. Pick kcal for nutrition values.',
      },
      {
        q: 'How much energy is a kilowatt-hour?',
        a: '3.6 million joules: one kilowatt drawn for one hour. It is the unit your electricity meter counts, and equals 3,412 BTU.',
      },
      {
        q: 'What is a therm?',
        a: '100,000 BTU (as measured at 59 °F; 99,976 in the IT BTU used here), or about 29.3 kWh. US gas bills are measured in therms, so this is the conversion to use when comparing gas and electricity prices.',
      },
    ],
    related: ['power-converter', 'temperature-converter', 'pressure-converter', 'calorie-calculator'],
    updated: '2026-11-01',
  },
  {
    slug: 'power-converter',
    title: 'Power Converter',
    h1: 'Power converter',
    description:
      'Power converter for kW to hp, PS to hp, watts, megawatts, BTU/h and tons of refrigeration. The three horsepower definitions are separate units.',
    keywords: [
      'kw to hp',
      'hp to kw',
      'ps to hp',
      'watts to horsepower',
      'btu to kw',
      'metric horsepower',
      'brake horsepower converter',
      'mw to kw',
    ],
    category: 'units',
    icon: 'Plug',
    faqs: [
      {
        q: 'How many horsepower is a kilowatt?',
        a: '1.341 mechanical hp, or 1.3596 metric hp (PS). Car makers in Europe quote PS, so a "150 PS" engine is 148 hp and 110 kW.',
      },
      {
        q: 'What is the difference between hp, PS and bhp?',
        a: 'Mechanical hp is 745.7 W, metric hp (PS, CV, pk) is 735.5 W, and electrical hp is exactly 746 W. "bhp" is mechanical hp measured at the crankshaft. It is not a separate unit.',
      },
      {
        q: 'How do I convert an air conditioner BTU rating to kW?',
        a: 'Divide BTU/h by 3,412. A 12,000 BTU/h unit is 3.52 kW of cooling. This is also one ton of refrigeration, which is in the list.',
      },
      {
        q: 'What is the difference between power and energy?',
        a: 'Power is a rate, and energy is an amount. A 2 kW heater that runs for three hours uses 6 kWh of energy. Use the energy converter to convert the kWh.',
      },
    ],
    related: ['energy-converter', 'pressure-converter', 'speed-converter', 'temperature-converter', 'fuel-economy-converter'],
    updated: '2026-11-01',
  },
  {
    slug: 'cooking-converter',
    title: 'Cooking Converter',
    h1: 'Cooking measurement converter',
    description:
      'Cooking converter for cups to grams, tablespoons to millilitres and ounces to cups. It uses the density of each ingredient, such as flour or butter.',
    keywords: [
      'cups to grams',
      'grams to cups',
      'tablespoons to ml',
      'cups to ml',
      'oz to cups',
      'flour cup to grams',
      'butter sticks to grams',
      'baking conversion chart',
    ],
    category: 'units',
    icon: 'CookingPot',
    faqs: [
      {
        q: 'Why does a cup of flour weigh less than a cup of sugar?',
        a: 'Because weight per cup depends on density. A US cup holds 125 g of spooned flour, 200 g of granulated sugar and 340 g of honey. Pick the ingredient above and the tool uses its density.',
      },
      {
        q: 'How many grams is one cup of flour?',
        a: '125 g for all-purpose flour spooned into the cup and levelled off. Scooping straight from the bag compacts it to as much as 145 g, which is why bakers weigh instead.',
      },
      {
        q: 'Are US and metric cups the same?',
        a: 'No. A US cup is 236.6 mL; the metric cup used in the UK, Australia and New Zealand is exactly 250 mL. Both are in the unit list, along with the 15 mL and 20 mL tablespoons.',
      },
      {
        q: 'How much is a stick of butter?',
        a: 'A US stick is a quarter-pound: 113 g, half a cup, or 8 tablespoons. It is included as its own unit so you can convert a recipe without doing that sum first.',
      },
      {
        q: 'Can I type fractions like ¾?',
        a: 'Yes. The input accepts 3/4, 1 1/2 and single-character fractions such as ½ and ¼, as recipes use them.',
      },
    ],
    related: ['volume-converter', 'weight-converter', 'temperature-converter', 'ratio-calculator'],
    updated: '2026-11-01',
  },
  {
    slug: 'fuel-economy-converter',
    title: 'Fuel Economy Converter',
    h1: 'Fuel economy converter',
    description:
      'Fuel economy converter for mpg to L/100km, US mpg to UK mpg and km/L. L/100km is the reciprocal of mpg, so the tool divides: 235.21 ÷ US mpg.',
    keywords: [
      'mpg to l/100km',
      'l/100km to mpg',
      'us mpg to uk mpg',
      'km/l to mpg',
      'fuel consumption converter',
      'imperial mpg',
      'miles per gallon converter',
    ],
    category: 'units',
    icon: 'Fuel',
    faqs: [
      {
        q: 'Why can I not just multiply mpg by a number to get L/100km?',
        a: 'Because they run in opposite directions: mpg is distance per fuel, L/100km is fuel per distance. The conversion is a division: L/100km = 235.21 ÷ mpg (US).',
      },
      {
        q: 'Why is UK mpg higher than US mpg for the same car?',
        a: 'The imperial gallon is 4.546 L and the US gallon is 3.785 L. The imperial gallon holds 20 % more fuel, so the same car gets about 20 % more miles per gallon in UK figures.',
      },
      {
        q: 'What counts as good fuel economy?',
        a: 'Roughly: under 5 L/100km (47 US mpg) is excellent, 6–8 L/100km is typical for a modern petrol car, and over 12 L/100km (under 20 mpg) is thirsty.',
      },
      {
        q: 'Does the kWh/100 km option work for electric cars?',
        a: 'It uses the EPA equivalence of about 8.9 kWh per litre of petrol, so it compares energy use. Use it for running costs. It does not apply to tank size.',
      },
    ],
    related: ['speed-converter', 'volume-converter', 'length-converter', 'fuel-cost-calculator'],
    updated: '2026-11-01',
  },
  {
    slug: 'angle-converter',
    title: 'Angle Converter',
    h1: 'Angle converter',
    description:
      'Angle converter for degrees to radians, gradians, arcminutes, arcseconds, turns, milliradians and NATO mils, with exact π-based factors.',
    keywords: [
      'degrees to radians',
      'radians to degrees',
      'gradians',
      'arcminutes to degrees',
      'arcseconds',
      'mrad to degrees',
      'angle conversion',
      'turns to degrees',
    ],
    category: 'units',
    icon: 'Triangle',
    faqs: [
      {
        q: 'How do I convert degrees to radians?',
        a: 'Multiply by π/180, or divide by 57.29577951. A full turn of 360° is 2π radians, and a right angle is π/2.',
      },
      {
        q: 'What is a gradian?',
        a: 'A hundredth of a right angle, so 400 gon make a full turn. Surveying software and some European calculators still offer it alongside degrees and radians.',
      },
      {
        q: 'How small is an arcsecond?',
        a: 'One 3,600th of a degree. That is the angle of a €1 coin seen from about 5 km away. Astronomy and GPS coordinates use arcseconds.',
      },
      {
        q: 'What is the difference between a milliradian and a NATO mil?',
        a: 'A true milliradian is 1/1000 of a radian (0.0573°). A NATO mil divides the circle into 6,400 parts, so it is 0.05625°. The two are close but different.',
      },
    ],
    related: ['length-converter', 'area-converter', 'triangle-calculator', 'time-converter'],
    updated: '2026-11-01',
  },
]
