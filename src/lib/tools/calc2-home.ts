import type { Tool } from './types'

export const tools: Tool[] = [
  {
    slug: 'roofing-calculator',
    title: 'Roofing Calculator',
    h1: 'Roofing calculator',
    description:
      'Roofing calculator: roof area, squares, shingle bundles and underlayment from the footprint, pitch and overhang, for gable, hip and shed roofs.',
    keywords: ['roof area calculator', 'roofing squares', 'shingle calculator', 'roof pitch', 'how many bundles of shingles', 'roof square footage'],
    category: 'home',
    icon: 'House',
    popular: true,
    faqs: [
      {
        q: 'What is a roofing square?',
        a: 'A square is 100 square feet of roof. Shingles are priced and sold by the square, and most asphalt shingles come three bundles to a square.',
      },
      {
        q: 'Why does a hip roof have the same area as a gable roof?',
        a: 'When every plane has the same pitch, the sloped area is the plan area times the pitch factor, whatever the shape. A hip roof needs more waste allowance, because every hip is a cut line.',
      },
      {
        q: 'How do I find the pitch of my roof?',
        a: 'Hold a level horizontally against a rafter or the roof surface, measure 12 inches along it, then measure straight up to the roof. That height is the rise in 12. From the ground, a phone angle app on the gable end gives the angle in degrees.',
      },
      {
        q: 'How much waste should I add?',
        a: 'About 10 % for a simple gable roof and 15 % for a hip roof or a roof with valleys and dormers. Starter strips and ridge caps are extra.',
      },
    ],
    related: ['square-footage-calculator', 'concrete-calculator', 'stair-calculator', 'solar-panel-calculator', 'area-converter', 'angle-converter'],
    updated: '2026-11-02',
  },
  {
    slug: 'gravel-calculator',
    title: 'Gravel Calculator',
    h1: 'Gravel calculator',
    description:
      'Gravel calculator: cubic yards, cubic metres and tons of gravel, sand or stone for a rectangular or round area at any depth, with typical densities.',
    keywords: ['how much gravel do i need', 'gravel tons', 'crushed stone calculator', 'cubic yards of gravel', 'driveway gravel', 'sand calculator'],
    category: 'home',
    icon: 'Mountain',
    faqs: [
      {
        q: 'How deep should gravel be?',
        a: 'About 2 inches (5 cm) for a decorative layer or a path, and 4 to 6 inches (10 to 15 cm) on a prepared base for a driveway, laid in compacted layers.',
      },
      {
        q: 'How many tons are in a cubic yard of gravel?',
        a: 'About 1.4 US tons for loose gravel. Wet, compacted or very dense stone weighs more, so ask the supplier for the density of the exact product.',
      },
      {
        q: 'Should I order extra?',
        a: 'Yes. Gravel settles and compacts, and the ground is never perfectly level. Order about 10 % more than the calculated volume, and more for a compacted base.',
      },
    ],
    related: ['mulch-calculator', 'concrete-calculator', 'square-footage-calculator', 'volume-converter', 'weight-converter'],
    updated: '2026-11-02',
  },
  {
    slug: 'mulch-calculator',
    title: 'Mulch Calculator',
    h1: 'Mulch calculator',
    description:
      'Mulch calculator: cubic yards and the number of 2 or 3 cubic foot bags (or 40 and 50 litre bags) to cover a garden bed at the depth you choose.',
    keywords: ['how much mulch do i need', 'bags of mulch', 'cubic yards of mulch', 'mulch coverage', 'bark chips calculator', 'garden bed'],
    category: 'home',
    icon: 'Sprout',
    faqs: [
      {
        q: 'How deep should mulch be?',
        a: 'Two to three inches (5 to 8 cm) for most beds. Less does not stop weeds; more can starve roots of air. Keep mulch a few inches away from stems and tree trunks.',
      },
      {
        q: 'How much does a 2 cubic foot bag cover?',
        a: '12 square feet at 2 inches deep, or 8 square feet at 3 inches. Divide 24 by the depth in inches to get the square feet a 2 cubic foot bag covers.',
      },
      {
        q: 'When is bulk cheaper than bags?',
        a: 'Usually above two or three cubic yards. One cubic yard is 13.5 bags of 2 cubic feet, so a large bed takes many bags.',
      },
    ],
    related: ['gravel-calculator', 'square-footage-calculator', 'volume-converter', 'area-converter'],
    updated: '2026-11-02',
  },
  {
    slug: 'drywall-calculator',
    title: 'Drywall Calculator',
    h1: 'Drywall calculator',
    description:
      'Drywall calculator: sheets of 4 × 8, 4 × 10 or 4 × 12 board for the walls and ceiling of a room, less doors and windows, plus screws, mud and tape.',
    keywords: ['how many sheets of drywall', 'sheetrock calculator', 'plasterboard calculator', 'drywall sheets', 'joint compound', 'drywall screws'],
    category: 'home',
    icon: 'PanelsTopLeft',
    faqs: [
      {
        q: 'How many sheets of drywall for a 12 × 12 room?',
        a: 'With 8 foot walls the walls are 384 square feet, which is 12 sheets of 4 × 8 before openings and waste. The ceiling adds 144 square feet, or 5 more sheets.',
      },
      {
        q: 'Which sheet size should I buy?',
        a: 'The longest sheet you can carry and fit. Longer sheets make fewer joints to tape and sand. On 8 foot walls, sheets hung horizontally leave one long joint at 4 feet.',
      },
      {
        q: 'How much joint compound and tape do I need?',
        a: 'About 9.4 US gallons (138 lb) of ready-mixed compound and 370 feet of tape for every 1,000 square feet of board, for three coats.',
      },
      {
        q: 'How are doors and windows deducted?',
        a: 'Each door at 21 square feet (3 × 7 ft) and each window at 15 square feet (3 × 5 ft). The waste allowance covers the cuts around them.',
      },
    ],
    related: ['paint-calculator', 'square-footage-calculator', 'wallpaper-calculator', 'tile-calculator', 'area-converter'],
    updated: '2026-11-02',
  },
  {
    slug: 'btu-calculator',
    title: 'BTU Calculator',
    h1: 'BTU calculator for room air conditioners',
    description:
      'BTU calculator: air conditioner size for a room from the ENERGY STAR table, adjusted for sun, people and kitchens, plus a heating estimate in BTU/h.',
    keywords: ['how many btu do i need', 'air conditioner size', 'ac btu calculator', 'room ac size', 'btu per square foot', 'heater size'],
    category: 'home',
    icon: 'AirVent',
    popular: true,
    faqs: [
      {
        q: 'How many BTU do I need per square foot?',
        a: 'About 20 BTU per hour per square foot, which is where the ENERGY STAR table comes from. A 400 square foot room needs about 9,000 BTU/h before adjustments.',
      },
      {
        q: 'What happens if the air conditioner is too big?',
        a: 'It cools the room before it removes the moisture, then switches off. The room feels cold and damp, and the unit cycles on and off more often.',
      },
      {
        q: 'How do BTU convert to watts?',
        a: '1 watt is 3.412 BTU per hour, so a 10,000 BTU/h unit moves about 2.9 kW of heat. Its electrical input is lower: divide by the efficiency ratio on the label.',
      },
      {
        q: 'Is the heating estimate a load calculation?',
        a: 'No. It is a rule of thumb from room volume, temperature rise and insulation. For a heating system for a whole house, a Manual J load calculation is the correct method.',
      },
    ],
    related: ['electricity-cost-calculator', 'square-footage-calculator', 'power-converter', 'energy-converter', 'temperature-converter'],
    updated: '2026-11-02',
  },
  {
    slug: 'electricity-cost-calculator',
    title: 'Electricity Cost Calculator',
    h1: 'Electricity cost calculator',
    description:
      'Electricity cost calculator: what appliances cost to run per day, month and year, from their watts, hours of use and your price per kWh.',
    keywords: ['appliance energy cost', 'kwh cost calculator', 'cost to run', 'power consumption calculator', 'watts to kwh', 'energy bill'],
    category: 'home',
    icon: 'PlugZap',
    faqs: [
      {
        q: 'How do I calculate the cost of running an appliance?',
        a: 'Multiply the watts by the hours of use and divide by 1,000 to get kWh, then multiply by your price per kWh. A 1,500 W heater for 3 hours uses 4.5 kWh, which is 67.5 cents at 15 cents per kWh.',
      },
      {
        q: 'Where do I find the wattage?',
        a: 'On the rating plate or the charger label. For a device that cycles, such as a fridge, the label gives the maximum; a plug-in power meter gives the true average over a day.',
      },
      {
        q: 'What is the spinning disc?',
        a: 'An electromechanical meter. Its disc turns once for every 7.2 watt-hours (Kh 7.2 on many US meters), so it turns faster as the load grows. The drawing spins at the true rate for the total load you entered.',
      },
    ],
    related: ['btu-calculator', 'solar-panel-calculator', 'power-converter', 'energy-converter', 'fuel-cost-calculator'],
    updated: '2026-11-02',
  },
  {
    slug: 'stair-calculator',
    title: 'Stair Calculator',
    h1: 'Stair calculator',
    description:
      'Stair calculator: risers and treads, riser height, total run, stringer length and angle from the floor-to-floor height, checked against the IRC.',
    keywords: ['stair stringer calculator', 'riser height', 'how many steps', 'stair rise and run', 'staircase calculator', 'stair dimensions'],
    category: 'home',
    icon: 'ChartNoAxesColumnIncreasing',
    faqs: [
      {
        q: 'What is the maximum riser height?',
        a: 'The International Residential Code allows 7¾ inches (196 mm) and requires treads of at least 10 inches (254 mm), with headroom of 6 feet 8 inches. Local codes can differ.',
      },
      {
        q: 'Why is there one fewer tread than risers?',
        a: 'The upper floor is the last step. A stair with 14 risers has 13 treads.',
      },
      {
        q: 'What is the 2R + T rule?',
        a: 'Two risers plus one tread should be about 24 to 25 inches (61 to 64 cm), the length of a normal stride. A stair inside that range is comfortable to climb.',
      },
      {
        q: 'Is the stringer length the board length to buy?',
        a: 'It is the length along the slope from floor to floor. Buy a board at least a foot longer for the cuts at the top and bottom.',
      },
    ],
    related: ['roofing-calculator', 'pythagorean-theorem-calculator', 'slope-calculator', 'triangle-calculator', 'length-converter'],
    updated: '2026-11-02',
  },
  {
    slug: 'wallpaper-calculator',
    title: 'Wallpaper Calculator',
    h1: 'Wallpaper calculator',
    description:
      'Wallpaper calculator: rolls of wallpaper for a room from the wall size, the roll size and the pattern repeat, with the strips you get from each roll.',
    keywords: ['how many rolls of wallpaper', 'wallpaper rolls', 'pattern repeat', 'wallpaper estimator', 'double roll', 'euro roll'],
    category: 'home',
    icon: 'Wallpaper',
    faqs: [
      {
        q: 'How does the pattern repeat change the number of rolls?',
        a: 'Each strip must start at the same point of the pattern, so its length is rounded up to whole repeats. A 96 inch wall with a 21 inch repeat needs 105 inch strips, and a 33 foot roll gives only 3 of them.',
      },
      {
        q: 'What is a double roll?',
        a: 'In the US, wallpaper is priced by the single roll but sold in double rolls, about 27 inches by 33 feet. A European roll is 0.53 by 10.05 metres.',
      },
      {
        q: 'Are windows deducted?',
        a: 'No. The wall above and below a window still takes strips, and offcuts rarely match. Only doors are deducted, at 3 feet (0.9 m) of wall width each.',
      },
    ],
    related: ['paint-calculator', 'drywall-calculator', 'square-footage-calculator', 'tile-calculator'],
    updated: '2026-11-02',
  },
  {
    slug: 'board-foot-calculator',
    title: 'Board Foot Calculator',
    h1: 'Board foot calculator',
    description:
      'Board foot calculator: board feet of lumber from thickness, width and length for several boards, with the total price and the volume in cubic metres.',
    keywords: ['board feet', 'lumber calculator', 'hardwood board feet', 'bf calculator', 'lumber volume', 'timber calculator'],
    category: 'home',
    icon: 'Ruler',
    faqs: [
      {
        q: 'What is a board foot?',
        a: 'A volume of 144 cubic inches: a board 12 inches wide, 12 inches long and 1 inch thick. Hardwood is priced by the board foot.',
      },
      {
        q: 'How many board feet is a 2 × 6 × 8?',
        a: '2 × 6 × 8 ÷ 12 = 8 board feet, using the nominal size. The planed board is 1½ × 5½ inches, but lumber is sold on the nominal size.',
      },
      {
        q: 'What do 4/4 and 8/4 mean?',
        a: 'Thickness in quarters of an inch for rough hardwood: 4/4 is 1 inch and 8/4 is 2 inches. Enter 1 or 2 as the thickness.',
      },
    ],
    related: ['volume-converter', 'length-converter', 'drywall-calculator', 'stair-calculator', 'square-footage-calculator'],
    updated: '2026-11-02',
  },
  {
    slug: 'solar-panel-calculator',
    title: 'Solar Panel Calculator',
    h1: 'Solar panel calculator',
    description:
      'Solar panel calculator: system size in kW, number of panels and roof area to cover your electricity use, from peak sun hours and system losses.',
    keywords: ['how many solar panels do i need', 'solar system size', 'solar kw calculator', 'peak sun hours', 'solar roof area', 'pv calculator'],
    category: 'home',
    icon: 'SolarPanel',
    faqs: [
      {
        q: 'What are peak sun hours?',
        a: 'The day’s sunlight expressed as hours at 1,000 W/m². A place with 5 peak sun hours gets 5 kWh of sunlight on each square metre of panel per day. Most of the US has 3.5 to 6.',
      },
      {
        q: 'Why multiply by 0.8?',
        a: 'Panels rarely make their rated power. Heat, dust, wiring, the inverter and shading take about 15 to 25 % of it, so 0.75 to 0.85 is a common derate factor.',
      },
      {
        q: 'How much roof does a panel need?',
        a: 'A 400 W panel is about 1.7 by 1.1 metres, close to 2 square metres or 21 square feet. Leave space for access paths and the setbacks your local code asks for.',
      },
    ],
    related: ['electricity-cost-calculator', 'roofing-calculator', 'btu-calculator', 'power-converter', 'energy-converter'],
    updated: '2026-11-02',
  },
]
