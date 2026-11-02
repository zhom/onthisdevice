import type { Tool } from './types'

export const tools: Tool[] = [
  {
    slug: 'moon-phase-calculator',
    title: 'Moon Phase Calculator',
    h1: 'Moon phase calculator',
    description:
      'Moon phase calculator: the phase, lit percentage and age of the moon for any date, the next full and new moon, and the moon drawn through its month.',
    keywords: ['moon phase today', 'lunar calendar', 'full moon date', 'new moon date', 'moon illumination', 'what phase is the moon'],
    category: 'everyday',
    icon: 'MoonStar',
    popular: true,
    faqs: [
      {
        q: 'How accurate are the full and new moon times?',
        a: 'Within about a minute. The calculator uses the method in Meeus, Astronomical Algorithms, chapter 49, with its periodic corrections and the difference between atomic and Earth time.',
      },
      {
        q: 'Why does the moon look the other way round in Australia?',
        a: 'From the southern hemisphere you see the moon upside down compared with the north, so the lit side is on the left while it is waxing. The drawing shows the northern view.',
      },
      {
        q: 'How long is a lunar month?',
        a: 'From new moon to new moon is 29.53 days on average. A single month can be up to about 7 hours longer or shorter, because the moon’s orbit is an ellipse.',
      },
      {
        q: 'When is a moon called full?',
        a: 'At the moment the moon is opposite the sun in longitude. The calculator names the day around that moment Full moon; the moon looks nearly full for a day or two either side.',
      },
    ],
    related: ['sunrise-sunset-calculator', 'day-of-the-week-calculator', 'date-calculator', 'days-until-christmas', 'week-number-calculator'],
    updated: '2026-11-02',
  },
  {
    slug: 'sunrise-sunset-calculator',
    title: 'Sunrise Sunset Calculator',
    h1: 'Sunrise and sunset calculator',
    description:
      'Sunrise and sunset calculator for any date and place: sunrise, sunset, solar noon, twilight and day length, with the sun path across the sky drawn.',
    keywords: ['sunrise time', 'sunset time', 'day length', 'solar noon', 'civil twilight', 'golden hour', 'daylight hours'],
    category: 'everyday',
    icon: 'Sunrise',
    faqs: [
      {
        q: 'How accurate are the times?',
        a: 'Within a minute of the NOAA solar calculator for latitudes below about 70°. Hills, buildings and unusual air near the horizon can move the real sunrise by a few minutes.',
      },
      {
        q: 'Why is sunrise defined at 0.833° below the horizon?',
        a: 'Sunrise is when the top edge of the sun appears. The sun’s radius is about 0.27° and the air bends its light by about 0.57° near the horizon, so its centre is still 0.833° below.',
      },
      {
        q: 'What is civil twilight?',
        a: 'The time when the sun is less than 6° below the horizon. There is enough light to be outdoors without lamps. Dawn and dusk in the results are the start and end of civil twilight.',
      },
      {
        q: 'Does the calculator ask for my location?',
        a: 'No. Pick a city from the list or type a latitude and longitude. Nothing is sent anywhere; the solar equations run on your device.',
      },
    ],
    related: ['moon-phase-calculator', 'timezone-converter', 'day-of-the-week-calculator', 'date-calculator', 'solar-panel-calculator'],
    updated: '2026-11-02',
  },
  {
    slug: 'day-of-the-week-calculator',
    title: 'Day of the Week Calculator',
    h1: 'Day of the week calculator',
    description:
      'Day of the week calculator: find the weekday of any date, past or future, with the doomsday rule worked out step by step and shown on the calendar.',
    keywords: ['what day was i born', 'what day of the week', 'weekday finder', 'doomsday rule', 'day of week for date'],
    category: 'everyday',
    icon: 'CalendarDays',
    faqs: [
      {
        q: 'Which calendar is used?',
        a: 'The Gregorian calendar, extended backwards before 1582 (the proleptic Gregorian calendar). Dates before a country switched from the Julian calendar can differ from old records.',
      },
      {
        q: 'What is the doomsday rule?',
        a: 'A method by John Conway to find a weekday in your head. In any year, 4/4, 6/6, 8/8, 10/10, 12/12 and a few other easy dates all fall on the same weekday, the doomsday.',
      },
      {
        q: 'How is the ISO week number counted?',
        a: 'Weeks start on Monday, and week 1 is the week with the year’s first Thursday. So 1 January can be in week 52 or 53 of the year before.',
      },
    ],
    related: ['date-calculator', 'week-number-calculator', 'age-calculator', 'date-difference-calculator', 'moon-phase-calculator'],
    updated: '2026-11-02',
  },
  {
    slug: 'tire-size-calculator',
    title: 'Tire Size Calculator',
    h1: 'Tire size calculator',
    description:
      'Tire size calculator: compare two tire sizes such as 225/45R17 and 245/40R18 for diameter, sidewall and speedometer error, drawn to scale side by side.',
    keywords: ['tire size comparison', 'tyre size calculator', 'tire diameter', 'speedometer error', 'plus size tires', 'revs per mile'],
    category: 'everyday',
    icon: 'CircleDot',
    faqs: [
      {
        q: 'How do I read a tire size?',
        a: 'In 225/45R17, 225 is the width in millimetres, 45 is the sidewall height as a percentage of the width, R means radial and 17 is the rim diameter in inches.',
      },
      {
        q: 'How much bigger can a replacement tire be?',
        a: 'A common rule is within 3% of the original diameter, so the speedometer, ABS and gearing stay close to their calibration. Check the vehicle’s documentation and the tire’s load rating.',
      },
      {
        q: 'Why does a bigger tire make the speedometer read low?',
        a: 'The speedometer counts wheel turns. A larger tire covers more ground per turn, so the car goes faster than the turns suggest.',
      },
    ],
    related: ['speed-converter', 'fuel-cost-calculator', 'length-converter', 'mm-to-inches', 'circle-calculator'],
    updated: '2026-11-02',
  },
  {
    slug: 'ppi-calculator',
    title: 'PPI Calculator',
    h1: 'PPI calculator: pixels per inch',
    description:
      'PPI calculator: pixel density of a screen from its resolution and diagonal, with pixel pitch, physical size and the distance where pixels blend together.',
    keywords: ['pixels per inch', 'pixel density', 'dpi calculator', 'screen ppi', 'pixel pitch', 'retina distance'],
    category: 'everyday',
    icon: 'Monitor',
    faqs: [
      {
        q: 'How is PPI calculated?',
        a: 'Divide the diagonal in pixels, √(width² + height²), by the diagonal in inches. A 27 inch 2560 × 1440 monitor has 2937.5 pixels across its diagonal, so 108.8 PPI.',
      },
      {
        q: 'Is PPI the same as DPI?',
        a: 'For screens they are used for the same thing. Strictly, DPI is for printers, which build each pixel from several ink dots.',
      },
      {
        q: 'What PPI is enough?',
        a: 'It depends on the distance. With normal eyesight a pixel disappears when it is smaller than one minute of arc: about 60 cm for a 110 PPI monitor and 25 cm for a 330 PPI phone.',
      },
    ],
    related: ['screen-size-calculator', 'aspect-ratio-calculator', 'px-to-em', 'change-image-dpi', 'download-time-calculator'],
    updated: '2026-11-02',
  },
  {
    slug: 'download-time-calculator',
    title: 'Download Time Calculator',
    h1: 'Download time calculator',
    description:
      'Download time calculator: how long a file takes to download or upload at your connection speed, in Mbit/s or MB/s, with overhead and common speeds.',
    keywords: ['download speed calculator', 'upload time', 'file transfer time', 'mbps to mb/s', 'how long to download'],
    category: 'everyday',
    icon: 'Download',
    faqs: [
      {
        q: 'Why is my download slower than my plan?',
        a: 'Plans are sold in megabits per second, while files are measured in megabytes: divide by 8. 100 Mbit/s moves at most 12.5 MB/s, and protocol overhead and Wi-Fi take some of that.',
      },
      {
        q: 'What is the difference between GB and GiB?',
        a: 'A GB is 1,000,000,000 bytes; a GiB is 1,073,741,824 bytes, 7.4% more. Operating systems often show GiB but label it GB.',
      },
      {
        q: 'What overhead should I use?',
        a: 'About 5 to 10% for a good wired connection. Busy Wi-Fi or a distant server can lose much more; set the overhead from a speed test if you know it.',
      },
    ],
    related: ['data-storage-converter', 'speed-converter', 'ppi-calculator', 'compress-video', 'time-duration-calculator'],
    updated: '2026-11-02',
  },
  {
    slug: 'unit-price-calculator',
    title: 'Unit Price Calculator',
    h1: 'Unit price calculator',
    description:
      'Unit price calculator: compare packs of different sizes by price per kg, litre or item, find the best value and see how much more the others cost.',
    keywords: ['price per unit', 'price per ounce', 'best value calculator', 'grocery price comparison', 'cost per kg'],
    category: 'everyday',
    icon: 'Scale',
    faqs: [
      {
        q: 'How is the unit price worked out?',
        a: 'Price divided by the amount, after converting the amount to grams, millilitres or items. $3.99 for 500 g is $7.98 per kg; $6.49 for 1 kg is $6.49 per kg.',
      },
      {
        q: 'Can I compare ounces with grams?',
        a: 'Yes. Weights are converted to grams and volumes to millilitres, so 12 oz and 500 g compare directly. Weight and volume cannot be compared with each other.',
      },
      {
        q: 'Is the biggest pack always the best value?',
        a: 'Often, but not always: offers on smaller packs are common. It is also only good value if you use it before it goes off.',
      },
    ],
    related: ['discount-calculator', 'percentage-off-calculator', 'sales-tax-calculator', 'weight-converter', 'cooking-converter'],
    updated: '2026-11-02',
  },
]
