import type { Tool } from './types'

export const tools: Tool[] = [
  {
    slug: 'percentage-calculator',
    title: 'Percentage Calculator',
    h1: 'Percentage calculator with steps',
    description:
      'Percentage calculator for X% of Y, what percent one number is of another, percentage increase or decrease, and adding a percentage, with steps.',
    keywords: [
      'percent calculator',
      'percentage increase',
      'percentage decrease',
      'percent change',
      'what percent of',
      'percentage difference',
      'add percentage',
    ],
    category: 'math',
    icon: 'Percent',
    popular: true,
    faqs: [
      {
        q: 'How do I calculate a percentage of a number?',
        a: 'Divide the percentage by 100 and multiply by the number. 15% of 240 is 0.15 × 240 = 36. The "X% of Y" tab does this and shows both lines of working.',
      },
      {
        q: 'What is the difference between percentage change and percentage difference?',
        a: 'Percentage change compares a new value against a specific starting value, so it has a direction. Percentage difference compares two values against their average, so the order does not matter.',
      },
      {
        q: 'Why is a 50% rise followed by a 50% fall not back to the start?',
        a: 'Each percentage is taken from a different base. 100 rises to 150, then 50% of 150 is 75, so the result is 75. The tool shows the base of each step, so you can see why.',
      },
      {
        q: 'Can I use decimals and negative numbers?',
        a: 'Yes. Any real number works. Percentage change from a negative starting value uses the absolute value of that base, which is the usual convention.',
      },
      {
        q: 'Does anything I type get uploaded?',
        a: 'No. The calculator runs in your browser tab and sends nothing. The page also works offline after it loads.',
      },
    ],
    related: ['fraction-calculator', 'ratio-calculator', 'average-calculator', 'discount-calculator', 'tip-calculator'],
    updated: '2026-11-01',
  },
  {
    slug: 'fraction-calculator',
    title: 'Fraction Calculator',
    h1: 'Fraction calculator with steps',
    description:
      'Fraction calculator that adds, subtracts, multiplies and divides fractions and mixed numbers, and shows the common denominator and the decimal value.',
    keywords: [
      'add fractions',
      'subtract fractions',
      'multiply fractions',
      'divide fractions',
      'mixed number calculator',
      'simplify fractions',
      'common denominator',
    ],
    category: 'math',
    icon: 'Divide',
    popular: true,
    faqs: [
      {
        q: 'How do I enter a mixed number?',
        a: 'Type the whole part, a space, then the fraction, for example 2 3/4. The tool also accepts improper fractions like 11/4, integers like 5 and decimals like 1.25.',
      },
      {
        q: 'How does it find the common denominator?',
        a: 'It uses the least common multiple of the two denominators, then rescales each fraction. The working shows the LCM, both rescaled numerators and the final reduction by the greatest common divisor.',
      },
      {
        q: 'Are the results exact?',
        a: 'Yes. Each fraction is a pair of arbitrary-precision integers, so there is no floating-point error. The decimal next to the answer is that exact value, rounded.',
      },
      {
        q: 'Can it handle negative fractions?',
        a: 'Yes. Put the minus sign in front of the whole expression, such as -2 1/2 or -7/8. The tool keeps the sign on the numerator and shows it in front of the answer.',
      },
    ],
    related: ['decimal-to-fraction-converter', 'percentage-calculator', 'gcd-lcm-calculator', 'ratio-calculator'],
    updated: '2026-11-01',
  },
  {
    slug: 'decimal-to-fraction-converter',
    title: 'Decimal to Fraction',
    h1: 'Decimal to fraction converter',
    description:
      'Decimal to fraction converter with exact results, including repeating decimals written as 0.(3). Shows simplified, mixed and unreduced forms with steps.',
    keywords: [
      'decimal to fraction',
      'repeating decimal to fraction',
      'recurring decimal',
      'fraction to decimal',
      'convert decimal',
      'mixed number',
    ],
    category: 'math',
    icon: 'ArrowRightLeft',
    faqs: [
      {
        q: 'How do I type a repeating decimal?',
        a: 'Wrap the repeating block in brackets: 0.(3) for 0.333…, or 1.8(3) for 1.8333…. The tool also reads the ellipsis form, such as 0.333..., and overline text pasted from a document.',
      },
      {
        q: 'How is a repeating decimal turned into a fraction?',
        a: 'Multiply the number by ten to the power of the repeating block length, subtract the original, and the repeating tails cancel. The tool shows that subtraction for your number.',
      },
      {
        q: 'Why does 0.999… equal exactly 1?',
        a: 'The algebra gives 9x = 9, so x = 1. This is exact: the two notations name the same real number, and the converter reports 1/1.',
      },
      {
        q: 'Can it convert a fraction back to a decimal?',
        a: 'Yes. The reverse tab runs exact long division and finds the repeating cycle, so 5/7 gives 0.(714285). The result is not cut off at 0.714286.',
      },
    ],
    related: ['fraction-calculator', 'percentage-calculator', 'gcd-lcm-calculator', 'ratio-calculator', 'number-to-words-converter'],
    updated: '2026-11-01',
  },
  {
    slug: 'ratio-calculator',
    title: 'Ratio Calculator',
    h1: 'Ratio calculator and simplifier',
    description:
      'Ratio calculator that solves A:B = C:D for a missing term, simplifies a ratio to lowest terms, scales it up or down, and splits a total by a ratio.',
    keywords: [
      'ratio simplifier',
      'proportion calculator',
      'solve for x ratio',
      'aspect ratio',
      'scale ratio',
      'split by ratio',
      'equivalent ratios',
    ],
    category: 'math',
    icon: 'Ratio',
    faqs: [
      {
        q: 'How do I solve a proportion for the missing value?',
        a: 'Leave one of the four boxes empty and the calculator cross-multiplies: A × D = B × C. The working shows the cross product and the division that isolates the unknown.',
      },
      {
        q: 'Can it simplify a ratio with decimals?',
        a: 'Yes. Decimal terms are scaled by a power of ten until they are whole numbers, then divided by their greatest common divisor, so 2.5 : 1.5 becomes 5 : 3.',
      },
      {
        q: 'How does splitting a total by a ratio work?',
        a: 'The parts are added to get the total number of shares, one share is the amount divided by that total, and each term gets its share count. Rounding differences are shown separately.',
      },
      {
        q: 'Does it handle three-part ratios?',
        a: 'The simplify and split modes accept any number of terms separated by colons, such as 3:5:8. The proportion solver works on the classic two-by-two form.',
      },
    ],
    related: ['fraction-calculator', 'percentage-calculator', 'gcd-lcm-calculator', 'decimal-to-fraction-converter'],
    updated: '2026-11-01',
  },
  {
    slug: 'average-calculator',
    title: 'Average Calculator',
    h1: 'Average calculator: mean, median, mode',
    description:
      'Average calculator: paste a list of numbers to get the mean, median, mode, range, sum and count, plus quartiles and a sorted view of the data.',
    keywords: [
      'mean median mode',
      'mean calculator',
      'median calculator',
      'mode calculator',
      'range calculator',
      'sum of numbers',
      'central tendency',
    ],
    category: 'math',
    icon: 'Sigma',
    faqs: [
      {
        q: 'What separators can I paste?',
        a: 'Commas, spaces, tabs, semicolons, pipes and newlines all work, so you can paste a column from a spreadsheet. The tool lists each token that is not a number.',
      },
      {
        q: 'What happens when there is no mode?',
        a: 'If every value appears once, there is no mode, and the tool says so. When several values tie for the highest count, all of them are listed.',
      },
      {
        q: 'How is the median found for an even count?',
        a: 'The list is sorted and the two middle values are averaged. The tool shows the sorted list with the middle position highlighted so you can check it by eye.',
      },
      {
        q: 'Which mean does it report?',
        a: 'The arithmetic mean is the headline figure. Geometric and harmonic means are also shown when they are defined, which is useful for growth rates and averaged rates respectively.',
      },
    ],
    related: ['standard-deviation-calculator', 'percentage-calculator', 'gcd-lcm-calculator', 'grade-calculator', 'gpa-calculator'],
    updated: '2026-11-01',
  },
  {
    slug: 'standard-deviation-calculator',
    title: 'Standard Deviation Calculator',
    h1: 'Standard deviation calculator with working',
    description:
      'Sample and population standard deviation and variance from any list of numbers, with the full deviation table, the formula and a dot plot.',
    keywords: [
      'standard deviation',
      'variance calculator',
      'sample standard deviation',
      'population standard deviation',
      'sigma calculator',
      'sum of squares',
    ],
    category: 'math',
    icon: 'ChartColumn',
    faqs: [
      {
        q: 'Should I use the sample or the population formula?',
        a: 'Use the sample formula, dividing by n − 1, when your numbers are a subset drawn from a larger group. Use the population formula, dividing by n, only when you have measured every member.',
      },
      {
        q: 'Why divide by n − 1 for a sample?',
        a: 'Deviations are measured from the sample mean, because the true mean is unknown. This makes them slightly too small. Dividing by n − 1, the Bessel correction, removes that bias.',
      },
      {
        q: 'What does the dot plot show?',
        a: 'Each value as a point on a number line, with the mean marked and shaded bands at one and two standard deviations, so you can see how spread out and how symmetric the data is.',
      },
      {
        q: 'How many numbers can I paste?',
        a: 'Tens of thousands are fine. The calculation runs in your browser in a single pass. The deviation table shows the first 200 rows so the page stays responsive.',
      },
      {
        q: 'Is the standard error included?',
        a: 'Yes. The standard error of the mean is the sample standard deviation divided by the square root of n, and it is reported alongside variance and the coefficient of variation.',
      },
    ],
    related: ['average-calculator', 'percentage-calculator', 'quadratic-equation-solver', 'scientific-calculator'],
    updated: '2026-11-01',
  },
  {
    slug: 'quadratic-equation-solver',
    title: 'Quadratic Equation Solver',
    h1: 'Quadratic equation solver with steps',
    description:
      'Quadratic equation solver for ax² + bx + c = 0 with real or complex roots. Shows the discriminant, vertex, factored form and a parabola graph.',
    keywords: [
      'quadratic formula',
      'solve quadratic',
      'discriminant calculator',
      'roots of quadratic',
      'vertex form',
      'completing the square',
      'factor quadratic',
    ],
    category: 'math',
    icon: 'ChartSpline',
    faqs: [
      {
        q: 'What does the discriminant tell me?',
        a: 'b² − 4ac decides the root type: positive gives two distinct real roots, zero gives one repeated real root, negative gives a conjugate pair of complex roots. The value is shown before the roots.',
      },
      {
        q: 'Does it show complex roots?',
        a: 'Yes. When the discriminant is negative, the roots are given in exact a ± bi form, and the graph shows that the parabola does not touch the x-axis.',
      },
      {
        q: 'Can I see the completed-square form?',
        a: 'Yes. Every solve includes the vertex form a(x − h)² + k with h and k derived line by line, which is also where the vertex and axis of symmetry come from.',
      },
      {
        q: 'What if a is zero?',
        a: 'Then the equation is linear. The solver detects this, solves bx + c = 0 and tells you why the quadratic formula does not apply.',
      },
    ],
    related: ['scientific-calculator', 'exponent-and-log-calculator', 'triangle-calculator', 'standard-deviation-calculator'],
    updated: '2026-11-01',
  },
  {
    slug: 'scientific-calculator',
    title: 'Scientific Calculator',
    h1: 'Online scientific calculator',
    description:
      'Scientific calculator with trig in degrees or radians, logs, powers, roots, factorials, memory keys, parentheses and a full history tape.',
    keywords: [
      'scientific calculator online',
      'trig calculator',
      'log calculator',
      'sin cos tan',
      'factorial calculator',
      'expression calculator',
      'free calculator',
    ],
    category: 'math',
    icon: 'Calculator',
    popular: true,
    faqs: [
      {
        q: 'Can I type instead of clicking?',
        a: 'Yes. The expression box takes full keyboard input including function names like sin, ln and sqrt. Enter evaluates, Escape clears, and every key on the pad has a keyboard equivalent.',
      },
      {
        q: 'Does it work in degrees or radians?',
        a: 'Both. The toggle above the keypad switches the angle mode for sin, cos, tan and their inverses, and the current mode is recorded next to each entry in the history tape.',
      },
      {
        q: 'How does the memory work?',
        a: 'MS stores the current result, MR recalls it into the expression, M+ and M− add or subtract the result from the stored value, and MC clears it. The stored value is always visible.',
      },
      {
        q: 'Is the expression parser safe?',
        a: 'It is a hand-written tokeniser and recursive-descent parser. It does not use eval or the Function constructor. A syntax error points at the character that caused it.',
      },
      {
        q: 'What precision does it use?',
        a: 'IEEE 754 double precision, which gives about 15 significant digits. Results show 12 digits to hide small floating-point errors.',
      },
    ],
    related: ['exponent-and-log-calculator', 'quadratic-equation-solver', 'percentage-calculator', 'triangle-calculator', 'prime-number-checker'],
    updated: '2026-11-01',
  },
  {
    slug: 'prime-number-checker',
    title: 'Prime Number Checker',
    h1: 'Prime number checker and generator',
    description:
      'Prime number checker: test if a number is prime, see its prime factorisation and divisors, find the nearest primes and list the primes in a range.',
    keywords: [
      'is this number prime',
      'prime factorization',
      'prime numbers list',
      'sieve of eratosthenes',
      'factor calculator',
      'composite number',
    ],
    category: 'math',
    icon: 'Hash',
    faqs: [
      {
        q: 'How large a number can it test?',
        a: 'Primality testing uses a deterministic Miller–Rabin routine on big integers, so numbers with dozens of digits are fast to test. Full factorisation is trial division and is practical to about 10^15.',
      },
      {
        q: 'Why is 1 not prime?',
        a: 'A prime has exactly two distinct positive divisors, 1 and itself. The number 1 has only one, so treating it as prime would break unique factorisation. The tool labels it as a unit.',
      },
      {
        q: 'What does the range generator do?',
        a: 'It runs a sieve of Eratosthenes between your two bounds and lists every prime found, along with the count, the twin-prime pairs and the largest gap in that interval.',
      },
      {
        q: 'How is the factorisation shown?',
        a: 'As prime powers, for example 360 = 2³ × 3² × 5, together with the divisor count and the complete list of divisors for smaller inputs.',
      },
    ],
    related: ['gcd-lcm-calculator', 'fraction-calculator', 'scientific-calculator', 'number-base-converter'],
    updated: '2026-11-01',
  },
  {
    slug: 'gcd-lcm-calculator',
    title: 'GCD and LCM Calculator',
    h1: 'GCD and LCM calculator with steps',
    description:
      'GCD and LCM calculator: find the greatest common divisor and least common multiple of a list of numbers, with Euclidean algorithm steps.',
    keywords: [
      'greatest common factor',
      'gcf calculator',
      'hcf calculator',
      'least common multiple',
      'lcm calculator',
      'euclidean algorithm',
      'prime factorization',
    ],
    category: 'math',
    icon: 'Grid2x2',
    faqs: [
      {
        q: 'What is the difference between GCD, GCF and HCF?',
        a: 'They are three names for the same thing: the largest whole number that divides all your inputs. Greatest common divisor, greatest common factor and highest common factor are interchangeable.',
      },
      {
        q: 'How does the Euclidean algorithm work?',
        a: 'Repeatedly replace the larger number with the remainder of dividing it by the smaller one. When the remainder hits zero, the last non-zero value is the GCD. Every division is listed.',
      },
      {
        q: 'How is the LCM of more than two numbers found?',
        a: 'Pairwise, left to right, using LCM(a, b) = a × b ÷ GCD(a, b). The tool also shows the prime-factor method, taking the highest power of each prime that appears.',
      },
      {
        q: 'Can it handle very large numbers?',
        a: 'GCD and LCM use arbitrary-precision integers, so hundred-digit inputs are fine. Prime factorisation is only attempted for values small enough to factor quickly.',
      },
    ],
    related: ['prime-number-checker', 'fraction-calculator', 'ratio-calculator', 'decimal-to-fraction-converter'],
    updated: '2026-11-01',
  },
  {
    slug: 'triangle-calculator',
    title: 'Triangle Calculator',
    h1: 'Triangle calculator: sides, angles and area',
    description:
      'Triangle calculator that solves a triangle from SSS, SAS, ASA, AAS or SSA inputs and gives each side, angle, the area and height, with a scale drawing.',
    keywords: [
      'triangle solver',
      'law of cosines',
      'law of sines',
      'triangle area calculator',
      'sss sas asa',
      'right triangle calculator',
      'hypotenuse',
    ],
    category: 'math',
    icon: 'Triangle',
    faqs: [
      {
        q: 'Which combinations of inputs can it solve?',
        a: 'Any three values that determine a triangle: three sides, two sides and the included angle, two angles and any side, or two sides and a non-included angle. Fill in the boxes you know.',
      },
      {
        q: 'Why does SSA sometimes give two answers?',
        a: 'Two sides and a non-included angle can describe two different triangles. This is the ambiguous case. The tool then shows both solutions, each with its own diagram values.',
      },
      {
        q: 'How is the area calculated?',
        a: 'From Heron’s formula once all three sides are known, cross-checked against the ½ab·sin(C) form. Both are shown so you can see they agree.',
      },
      {
        q: 'Does the diagram match my numbers?',
        a: 'Yes, it is drawn to scale from the solved coordinates, with the sides and angles labelled. A triangle that is nearly degenerate will look that way in the drawing.',
      },
      {
        q: 'What if my inputs are impossible?',
        a: 'You get an explanation and no result, for example that two sides are shorter than the third, or that the angles add to more than 180°.',
      },
    ],
    related: ['quadratic-equation-solver', 'scientific-calculator', 'exponent-and-log-calculator', 'area-converter', 'angle-converter'],
    updated: '2026-11-01',
  },
  {
    slug: 'exponent-and-log-calculator',
    title: 'Exponent and Log Calculator',
    h1: 'Exponent, root and logarithm calculator',
    description:
      'Exponent and log calculator: raise a number to any power, take nth roots, and find logs in any base, including ln and log₁₀, with the steps shown.',
    keywords: [
      'exponent calculator',
      'power calculator',
      'nth root calculator',
      'log base calculator',
      'natural log',
      'antilog',
      'scientific notation',
    ],
    category: 'math',
    icon: 'Superscript',
    faqs: [
      {
        q: 'How do I take a log in an unusual base?',
        a: 'Enter the base and the number and the calculator applies the change-of-base rule, log_b(x) = ln(x) ÷ ln(b), showing both natural logs so you can verify the division yourself.',
      },
      {
        q: 'Can it handle negative and fractional exponents?',
        a: 'Yes. A negative exponent becomes a reciprocal and a fractional one becomes a root, and both rewrites are shown as steps before the numeric answer.',
      },
      {
        q: 'Why does an even root of a negative number fail?',
        a: 'No real number squared gives a negative result, so the even root is undefined over the reals. Odd roots of negatives are fine and the tool computes them, for example the cube root of −27 is −3.',
      },
      {
        q: 'What does the scientific notation tab do?',
        a: 'It converts between plain decimal and a × 10ⁿ form in both directions, reports the exponent and the number of significant figures, and gives the engineering-notation variant.',
      },
    ],
    related: ['scientific-calculator', 'quadratic-equation-solver', 'percentage-calculator', 'standard-deviation-calculator'],
    updated: '2026-11-01',
  },
]
