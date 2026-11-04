import type { Tool } from './types'

export const tools: Tool[] = [
  {
    slug: 'prime-factorization-calculator',
    title: 'Prime Factorization Calculator',
    h1: 'Prime factorization calculator',
    description:
      'Prime factorization calculator: break a whole number of up to 300 digits into primes, with a factor tree, exponent form and the divisor count.',
    keywords: ['prime factors', 'factor tree', 'prime decomposition', 'factorize a number', 'number of divisors'],
    category: 'math',
    icon: 'Network',
    faqs: [
      {
        q: 'What is prime factorization?',
        a: 'Writing a whole number as a product of primes. Every whole number above 1 has exactly one such product, apart from the order of the factors.',
      },
      {
        q: 'How does the calculator factor large numbers?',
        a: 'Up to 10¹⁸ it uses Pollard’s rho method in the page. Above that, parallel WebAssembly workers run the elliptic curve method, whose time depends on the size of the factor and not of the number. A 39-digit number with two 20-digit prime factors usually takes under a second. Two very large prime factors can take hours, so you can stop at any time and keep what was found.',
      },
      {
        q: 'How do I count the divisors from the factorization?',
        a: 'Add 1 to each exponent and multiply. 360 = 2³ × 3² × 5 has (3 + 1)(2 + 1)(1 + 1) = 24 divisors.',
      },
      {
        q: 'Is 1 a prime number?',
        a: 'No. A prime has exactly two divisors, 1 and itself, and 1 has only one. For this reason the calculator starts at 2.',
      },
    ],
    related: ['prime-number-checker', 'gcd-lcm-calculator', 'square-root-calculator', 'long-division-calculator', 'fraction-calculator'],
    updated: '2026-11-02',
  },
  {
    slug: 'square-root-calculator',
    title: 'Square Root Calculator',
    h1: 'Square root calculator (and nth root)',
    description:
      'Square root calculator for square, cube and nth roots, with the simplified radical form (√72 = 6√2) and the steps of Newton’s method on a number line.',
    keywords: ['nth root calculator', 'cube root calculator', 'simplify square root', 'radical calculator', 'simplest radical form'],
    category: 'math',
    icon: 'Radical',
    faqs: [
      {
        q: 'How do you simplify a square root?',
        a: 'Factor the number and take each pair of equal primes out of the root. 72 = 2³ × 3² = 6² × 2, so √72 = 6√2. For a cube root, take out each group of three.',
      },
      {
        q: 'Can I take the root of a negative number?',
        a: 'An odd root, yes: ∛−27 = −3. An even root of a negative number has no real value. It is an imaginary number, which this calculator does not compute.',
      },
      {
        q: 'How does the calculator find the root?',
        a: 'With Newton’s method: start from a guess and improve it with y ← ((n − 1)y + x ÷ yⁿ⁻¹) ÷ n. Near the root, each step about doubles the number of correct digits. The steps are listed under the result.',
      },
      {
        q: 'Is the nth root the same as a power of 1/n?',
        a: 'Yes. The nth root of x equals x to the power 1/n, so ∛8 = 8^(1/3) = 2 and √x = x^0.5.',
      },
    ],
    related: ['exponent-and-log-calculator', 'prime-factorization-calculator', 'scientific-calculator', 'pythagorean-theorem-calculator', 'quadratic-equation-solver'],
    updated: '2026-11-02',
  },
  {
    slug: 'slope-calculator',
    title: 'Slope Calculator',
    h1: 'Slope calculator',
    description:
      'Slope calculator: find the slope, angle and equation of the line through two points in slope-intercept, point-slope and standard form, with a graph.',
    keywords: ['rise over run', 'slope of a line', 'gradient calculator', 'equation of a line', 'slope intercept form', 'point slope form'],
    category: 'math',
    icon: 'TrendingUp',
    faqs: [
      {
        q: 'What is the slope formula?',
        a: 'm = (y₂ − y₁) ÷ (x₂ − x₁): the rise divided by the run between two points on the line.',
      },
      {
        q: 'What do a slope of zero and an undefined slope mean?',
        a: 'A slope of zero is a horizontal line, y = b. An undefined slope is a vertical line, x = a number: the run is zero, and division by zero has no value.',
      },
      {
        q: 'How do I turn a slope into an angle?',
        a: 'Take the arctangent: angle = arctan(m). A slope of 1 is 45° and a slope of 3 is 71.57°. A road grade in percent is the slope × 100.',
      },
      {
        q: 'Does the order of the two points matter?',
        a: 'No. Swapping the points changes the sign of both the rise and the run, so the slope stays the same.',
      },
    ],
    related: ['distance-and-midpoint-calculator', 'pythagorean-theorem-calculator', 'quadratic-equation-solver', 'angle-converter', 'triangle-calculator'],
    updated: '2026-11-02',
  },
  {
    slug: 'distance-and-midpoint-calculator',
    title: 'Distance and Midpoint Calculator',
    h1: 'Distance and midpoint calculator',
    description:
      'Distance and midpoint calculator for two points in 2D or 3D: the distance formula and the midpoint formula worked through with your coordinates.',
    keywords: ['distance formula', 'midpoint formula', 'distance between two points', '3d distance calculator', 'euclidean distance'],
    category: 'math',
    icon: 'MoveDiagonal2',
    faqs: [
      {
        q: 'What is the distance formula?',
        a: 'd = √((x₂ − x₁)² + (y₂ − y₁)²). It is the Pythagorean theorem: the differences in x and y are the legs of a right triangle and the distance is its hypotenuse.',
      },
      {
        q: 'How does it work in 3D?',
        a: 'Add the third difference under the root: d = √(Δx² + Δy² + Δz²). From (1, 2, 3) to (4, 6, 15) the distance is √(9 + 16 + 144) = 13.',
      },
      {
        q: 'How do you find the midpoint?',
        a: 'Average each coordinate: M = ((x₁ + x₂) ÷ 2, (y₁ + y₂) ÷ 2). The midpoint is half the distance from each end.',
      },
      {
        q: 'Can I use it for latitude and longitude?',
        a: 'Only over short distances on a flat map. Latitude and longitude are angles on a sphere, so long distances need the great-circle formula.',
      },
    ],
    related: ['slope-calculator', 'pythagorean-theorem-calculator', 'triangle-calculator', 'length-converter', 'circle-calculator'],
    updated: '2026-11-02',
  },
  {
    slug: 'pythagorean-theorem-calculator',
    title: 'Pythagorean Theorem Calculator',
    h1: 'Pythagorean theorem calculator',
    description:
      'Pythagorean theorem calculator: solve for the hypotenuse or a missing leg with a² + b² = c², get the angles and area, and watch the squares add up.',
    keywords: ['hypotenuse calculator', 'a2 + b2 = c2', 'right triangle calculator', 'missing side of a triangle', 'pythagoras'],
    category: 'math',
    icon: 'TriangleRight',
    faqs: [
      {
        q: 'What does the Pythagorean theorem say?',
        a: 'In a right triangle, the square on the hypotenuse equals the sum of the squares on the other two sides: a² + b² = c². The hypotenuse c is the side opposite the right angle.',
      },
      {
        q: 'How do I find a leg instead of the hypotenuse?',
        a: 'Rearrange the formula: a = √(c² − b²). The hypotenuse must be the longest side, so c has to be larger than b.',
      },
      {
        q: 'What are Pythagorean triples?',
        a: 'Whole numbers that fit the formula exactly, such as 3-4-5, 5-12-13 and 8-15-17. Every multiple of a triple, such as 6-8-10, is also one.',
      },
      {
        q: 'Does it work for a triangle without a right angle?',
        a: 'No. For other triangles use the law of cosines, c² = a² + b² − 2ab cos C, which the triangle calculator solves.',
      },
    ],
    related: ['triangle-calculator', 'distance-and-midpoint-calculator', 'square-root-calculator', 'slope-calculator', 'stair-calculator'],
    updated: '2026-11-02',
  },
  {
    slug: 'circle-calculator',
    title: 'Circle Calculator',
    h1: 'Circle calculator: area, circumference, radius and diameter',
    description:
      'Circle calculator: enter the radius, diameter, circumference or area and get the other three, with the circumference unrolled into a line of length πd.',
    keywords: ['area of a circle', 'circumference calculator', 'radius from circumference', 'diameter calculator', 'pi r squared'],
    category: 'math',
    icon: 'Circle',
    faqs: [
      {
        q: 'What are the circle formulas?',
        a: 'Diameter d = 2r, circumference C = 2πr = πd, and area A = πr². From any one of r, d, C or A you can get the other three.',
      },
      {
        q: 'How do I get the radius from the area?',
        a: 'r = √(A ÷ π). An area of 50 cm² gives a radius of √(50 ÷ π) = 3.989 cm.',
      },
      {
        q: 'How do I measure the diameter of a round object?',
        a: 'Wrap a tape or a string around it to get the circumference, then divide by π. For a tree trunk or a pipe this is easier and more accurate than measuring across.',
      },
      {
        q: 'How precise is the value of π?',
        a: 'The calculator uses π to 16 significant digits, 3.141592653589793. That is far more precise than any measurement you enter.',
      },
    ],
    related: ['area-converter', 'volume-calculator', 'surface-area-calculator', 'pythagorean-theorem-calculator', 'length-converter'],
    updated: '2026-11-02',
  },
  {
    slug: 'volume-calculator',
    title: 'Volume Calculator',
    h1: 'Volume calculator',
    description:
      'Volume calculator for cubes, boxes, cylinders, cones, spheres, pyramids, prisms and capsules in any unit, with litres, gallons and the formula worked out.',
    keywords: ['volume of a cylinder', 'volume of a sphere', 'cubic feet calculator', 'volume of a cone', 'capacity calculator', 'cubic meters'],
    category: 'math',
    icon: 'Box',
    faqs: [
      {
        q: 'How do I convert a volume to litres?',
        a: 'One litre is 1,000 cm³, or 0.001 m³. The calculator gives litres and US gallons next to every result, whatever unit you measured in.',
      },
      {
        q: 'Which unit should I use?',
        a: 'Use one unit for all the dimensions. The answer is in that unit cubed: centimetres give cm³ and feet give ft³.',
      },
      {
        q: 'Why does a cone hold a third of a cylinder?',
        a: 'A cone with the same base and height as a cylinder holds exactly one third as much, and a pyramid holds a third of the box around it. The ⅓ comes from adding up cross-sections that shrink toward the tip.',
      },
      {
        q: 'Why does the liquid rise at different speeds in the animation?',
        a: 'It fills at a steady rate by volume. The level rises fast where the shape is narrow, such as the tip of a cone, and slowly where it is wide.',
      },
    ],
    related: ['surface-area-calculator', 'volume-converter', 'circle-calculator', 'concrete-calculator', 'density-calculator'],
    updated: '2026-11-02',
  },
  {
    slug: 'surface-area-calculator',
    title: 'Surface Area Calculator',
    h1: 'Surface area calculator',
    description:
      'Surface area calculator for cubes, boxes, cylinders, cones, spheres, pyramids and prisms, split into faces, with each shape unfolding into its net.',
    keywords: ['surface area of a cylinder', 'surface area of a cone', 'surface area of a sphere', 'net of a shape', 'lateral area', 'total surface area'],
    category: 'math',
    icon: 'PackageOpen',
    faqs: [
      {
        q: 'What is the difference between lateral and total surface area?',
        a: 'The lateral area is the sides only; the total adds the bases. For a cylinder the lateral area is 2πrh and the total is 2πrh + 2πr². The calculator lists each part.',
      },
      {
        q: 'Why is the area of a sphere 4πr²?',
        a: 'It equals the area of four circles with the same radius, a result Archimedes proved. A sphere has no flat net, so the animation lays out those four circles.',
      },
      {
        q: 'How do I use this for paint or wrapping paper?',
        a: 'Find the total area, then add 10 to 15 percent for overlaps and waste. For the walls of a room, the paint calculator also deducts doors and windows.',
      },
      {
        q: 'Which unit is the answer in?',
        a: 'The unit you measured in, squared. Centimetres give cm² and feet give ft².',
      },
    ],
    related: ['volume-calculator', 'area-converter', 'paint-calculator', 'circle-calculator', 'pythagorean-theorem-calculator'],
    updated: '2026-11-02',
  },
  {
    slug: 'mean-median-mode-calculator',
    title: 'Mean, Median, Mode Calculator',
    h1: 'Mean, median and mode calculator',
    description:
      'Mean, median and mode calculator: paste a list of numbers to get the average, middle value, most common value, range and sum on a balancing dot plot.',
    keywords: ['median calculator', 'mode calculator', 'range calculator', 'average of numbers', 'central tendency', 'statistics calculator'],
    category: 'math',
    icon: 'ChartScatter',
    faqs: [
      {
        q: 'What is the difference between mean, median and mode?',
        a: 'The mean is the sum divided by the count. The median is the middle value of the sorted list. The mode is the value that occurs most often.',
      },
      {
        q: 'How is the median found for an even count?',
        a: 'Take the two middle values of the sorted list and average them. For 3, 5, 6 and 9 the median is (5 + 6) ÷ 2 = 5.5.',
      },
      {
        q: 'Can there be more than one mode, or none?',
        a: 'Yes. 1, 2, 2, 3, 3 has two modes, 2 and 3. When every value occurs once, there is no mode.',
      },
      {
        q: 'When is the median better than the mean?',
        a: 'When the data is skewed or has outliers. Incomes are the usual example: a few very high values pull the mean up, but the median hardly moves.',
      },
    ],
    related: ['average-calculator', 'standard-deviation-calculator', 'z-score-calculator', 'grade-calculator', 'probability-calculator'],
    updated: '2026-11-02',
  },
  {
    slug: 'long-division-calculator',
    title: 'Long Division Calculator',
    h1: 'Long division calculator with remainders',
    description:
      'Long division calculator with remainders: divide whole numbers step by step in the written layout, with the decimal answer and its repeating digits.',
    keywords: ['long division with remainder', 'long division steps', 'division calculator', 'repeating decimal', 'quotient and remainder'],
    category: 'math',
    icon: 'Divide',
    faqs: [
      {
        q: 'How does long division work?',
        a: 'Take the digits of the dividend from the left. At each step, find how many times the divisor fits, write that digit in the quotient, subtract, and bring down the next digit.',
      },
      {
        q: 'What is the remainder?',
        a: 'What is left when the divisor no longer fits. 1234 ÷ 7 = 176 remainder 2, because 7 × 176 = 1232 and 1234 − 1232 = 2.',
      },
      {
        q: 'Why do some decimals repeat?',
        a: 'After the decimal point each step brings down a zero. A remainder is always smaller than the divisor, so either a remainder of 0 ends the division or a remainder comes back and the digits cycle: 1 ÷ 7 = 0.142857142857…',
      },
      {
        q: 'How do I write the answer as a mixed number?',
        a: 'Write the quotient, then the remainder over the divisor: 1234 ÷ 7 = 176 2⁄7.',
      },
    ],
    related: ['fraction-calculator', 'decimal-to-fraction-converter', 'prime-factorization-calculator', 'rounding-calculator', 'scientific-calculator'],
    updated: '2026-11-02',
  },
  {
    slug: 'rounding-calculator',
    title: 'Rounding Calculator',
    h1: 'Rounding calculator',
    description:
      'Rounding calculator: round to decimal places, significant figures or the nearest 10, 100 or 1,000, half up, half to even, up, down or toward zero.',
    keywords: ['round to nearest', 'round to 2 decimal places', 'round to significant figures', 'bankers rounding', 'round half to even', 'round up calculator'],
    category: 'math',
    icon: 'ArrowUpDown',
    faqs: [
      {
        q: 'What is the usual rounding rule?',
        a: 'Round half up: look at the first digit you drop. 5 or more rounds up, 4 or less rounds down. For a negative number a half rounds away from zero, so −2.5 becomes −3.',
      },
      {
        q: 'What is round half to even?',
        a: 'A tie, exactly half, goes to the even neighbour: 2.5 becomes 2 and 3.5 becomes 4. It is also called banker’s rounding, and it keeps the total of many rounded values unbiased.',
      },
      {
        q: 'Why does 1.005 round to 1.01 here but to 1.00 in some programs?',
        a: 'Many programs store numbers in binary, where 1.005 is 1.00499999… This calculator rounds the decimal digits you typed, so a 5 is a 5.',
      },
      {
        q: 'What is the difference between rounding down and truncating?',
        a: 'Rounding down (floor) moves toward minus infinity, so −2.1 becomes −3. Toward zero (truncate) cuts off the digits, so −2.9 becomes −2.',
      },
    ],
    related: ['significant-figures-calculator', 'scientific-notation-converter', 'percent-error-calculator', 'long-division-calculator', 'decimal-to-fraction-converter'],
    updated: '2026-11-02',
  },
]
