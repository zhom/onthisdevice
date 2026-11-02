import type { Tool } from './types'

export const tools: Tool[] = [
  {
    slug: 'graphing-calculator',
    title: 'Graphing Calculator',
    h1: 'Graphing calculator',
    description:
      'Graphing calculator: plot up to five functions of x, drag to pan and pinch to zoom, and read the roots and y-intercepts in view. Curves morph as you type.',
    keywords: ['graph a function', 'plot y = f(x)', 'function plotter', 'online graph', 'graph calculator', 'plot equation'],
    category: 'math',
    icon: 'ChartSpline',
    popular: true,
    faqs: [
      {
        q: 'What can I type?',
        a: 'Any expression in x: + − × ÷ and ^, brackets, |x| for absolute value, and sin, cos, tan, asin, acos, atan, sinh, cosh, tanh, sqrt, cbrt, abs, ln, log, log2, exp, floor, ceil, round, sign, min and max, with the constants pi, e and tau. 2x, 2(x + 1) and x sin x are read as products.',
      },
      {
        q: 'Are angles in degrees or radians?',
        a: 'Radians, as in mathematics. To use degrees, multiply by pi/180: sin(x pi/180).',
      },
      {
        q: 'How do I move and zoom the graph?',
        a: 'Drag with a mouse or one finger to move it. Pinch with two fingers or use the scroll wheel to zoom about that point. The buttons under the graph zoom about the centre, and Reset view goes back to x from −6 to 6.',
      },
      {
        q: 'How are the roots found?',
        a: 'Each function is sampled across the visible range, every sign change is refined by bisection to about 15 digits, and jumps such as tan x at π/2 are skipped. A root where the curve only touches the axis, as for x², is found when the sample hits it exactly, so zoom in to check one.',
      },
      {
        q: 'Why does −2^2 give −4?',
        a: 'Powers bind tighter than a minus sign, so −2^2 means −(2^2). Write (−2)^2 for 4. Powers also group from the right: 2^3^2 is 2^9 = 512.',
      },
    ],
    related: ['quadratic-equation-solver', 'scientific-calculator', 'slope-calculator', 'system-of-equations-solver', 'exponent-and-log-calculator'],
    updated: '2026-11-02',
  },
  {
    slug: 'matrix-calculator',
    title: 'Matrix Calculator',
    h1: 'Matrix calculator',
    description:
      'Matrix calculator for up to 4×4: determinant, inverse, A × B, A + B, transpose and rank, with every step shown and the 2×2 transformation animated.',
    keywords: ['determinant calculator', 'inverse matrix calculator', 'matrix multiplication', 'transpose matrix', 'matrix rank', 'rref calculator'],
    category: 'math',
    icon: 'Grid3x3',
    faqs: [
      {
        q: 'When does a matrix have an inverse?',
        a: 'When it is square and its determinant is not zero. A zero determinant means the matrix squashes space onto a line or a point, and that cannot be undone.',
      },
      {
        q: 'Why can I not multiply some matrices?',
        a: 'A × B needs as many columns in A as rows in B. A 2×3 matrix times a 3×4 matrix gives a 2×4 matrix; a 2×3 times a 2×3 is not defined.',
      },
      {
        q: 'Is A × B the same as B × A?',
        a: 'Usually not. Matrix multiplication is not commutative. Swap the matrices and compare the results to see it.',
      },
      {
        q: 'What does the determinant mean?',
        a: 'For a 2×2 matrix, |det A| is the area of the shape the unit square turns into, and a negative sign means the square is flipped. The animation shows this. For 3×3 it is a volume.',
      },
      {
        q: 'How is the rank found?',
        a: 'By Gauss-Jordan elimination to reduced row echelon form. The rank is the number of pivots, which is the number of rows that do not depend on the others.',
      },
    ],
    related: ['system-of-equations-solver', 'graphing-calculator', 'scientific-calculator', 'fraction-calculator'],
    updated: '2026-11-02',
  },
  {
    slug: 'system-of-equations-solver',
    title: 'System of Equations Solver',
    h1: 'System of equations solver',
    description:
      'System of equations solver for 2 or 3 unknowns by elimination, with each row operation shown. For two unknowns, both lines and where they meet are drawn.',
    keywords: ['simultaneous equations solver', 'linear system calculator', 'solve 3 equations', 'elimination method', 'gaussian elimination', 'two equations two unknowns'],
    category: 'math',
    icon: 'Equal',
    faqs: [
      {
        q: 'What if the system has no solution?',
        a: 'Then the equations contradict each other. For two unknowns the two lines are parallel and never meet. The solver says so and shows the row that reduces to 0 = a number that is not zero.',
      },
      {
        q: 'What if there are infinitely many solutions?',
        a: 'Then one equation is a multiple or a sum of the others, so it adds no information. For two unknowns the two lines lie on top of each other.',
      },
      {
        q: 'Which method does the solver use?',
        a: 'Gauss-Jordan elimination on the augmented matrix [A | b]. Each step is a row operation: swap two rows, divide a row by a number, or subtract a multiple of one row from another.',
      },
      {
        q: 'Can I enter fractions?',
        a: 'Enter decimals, for example 0.5 for one half. The answer is shown as a decimal to 10 significant figures.',
      },
    ],
    related: ['matrix-calculator', 'graphing-calculator', 'quadratic-equation-solver', 'slope-calculator'],
    updated: '2026-11-02',
  },
  {
    slug: 'probability-calculator',
    title: 'Probability Calculator',
    h1: 'Probability calculator',
    description:
      'Probability calculator for two independent events: P(A and B), P(A or B), not A, exactly one, neither, and the chance of at least one success in n trials.',
    keywords: ['probability of a and b', 'probability of a or b', 'independent events calculator', 'at least once probability', 'chance calculator', 'odds calculator'],
    category: 'math',
    icon: 'Dices',
    faqs: [
      {
        q: 'What does independent mean?',
        a: 'That one event does not change the chance of the other. Two coin flips are independent. Drawing two cards from one deck without putting the first back is not.',
      },
      {
        q: 'Why is P(A or B) not P(A) + P(B)?',
        a: 'Because the outcomes where both happen would be counted twice. P(A or B) = P(A) + P(B) − P(A and B). Only for events that cannot happen together is it the plain sum.',
      },
      {
        q: 'What is the chance of at least one success in n tries?',
        a: 'One minus the chance of failing every time: 1 − (1 − p)ⁿ. The chance of at least one six in four rolls of a die is 1 − (5/6)⁴ = 51.8%.',
      },
      {
        q: 'Can I enter percentages?',
        a: 'Yes. Pick Percent and enter 25 for a 25% chance, or pick Decimal and enter 0.25.',
      },
    ],
    related: ['permutation-and-combination-calculator', 'z-score-calculator', 'dice-roller', 'coin-flip', 'percentage-calculator'],
    updated: '2026-11-02',
  },
  {
    slug: 'permutation-and-combination-calculator',
    title: 'Permutation and Combination Calculator',
    h1: 'Permutation and combination calculator',
    description:
      'Permutation and combination calculator: exact nPr, nCr and both with repetition for numbers of any size, with small cases animated one by one.',
    keywords: ['npr calculator', 'ncr calculator', 'combinations calculator', 'permutations calculator', 'n choose r', 'combinations with repetition'],
    category: 'math',
    icon: 'Shuffle',
    faqs: [
      {
        q: 'What is the difference between a permutation and a combination?',
        a: 'In a permutation the order matters: ABC and CBA are two arrangements. In a combination it does not: they are the same selection. So nPr is always at least nCr, and nPr = nCr × r!.',
      },
      {
        q: 'What does with repetition mean?',
        a: 'That an item can be picked more than once, like digits in a PIN. Ordered with repetition there are nʳ ways; unordered, C(n + r − 1, r).',
      },
      {
        q: 'How big can n be?',
        a: 'Up to 100,000, and r up to 10,000. The results are exact whole numbers computed with arbitrary precision, so 100C50 shows all 30 digits.',
      },
      {
        q: 'How many 5-card poker hands are there?',
        a: '52C5 = 2,598,960. The order of the cards in a hand does not matter, so it is a combination.',
      },
    ],
    related: ['probability-calculator', 'dice-roller', 'random-picker', 'scientific-calculator'],
    updated: '2026-11-02',
  },
  {
    slug: 'z-score-calculator',
    title: 'Z-Score Calculator',
    h1: 'Z-score calculator',
    description:
      'Z-score calculator: turn a value, mean and standard deviation into z, the percentile and left, right and two-tailed p-values on a shaded normal curve.',
    keywords: ['z score to percentile', 'p value from z', 'standard score', 'normal distribution calculator', 'z table', 'area under normal curve'],
    category: 'math',
    icon: 'ChartBellCurve',
    faqs: [
      {
        q: 'What is a z-score?',
        a: 'The number of standard deviations a value is from the mean: z = (x − μ) ÷ σ. A z of 2 is two standard deviations above the mean; −1 is one below.',
      },
      {
        q: 'How is the percentile found from z?',
        a: 'From the area under the standard normal curve to the left of z, Φ(z). The calculator computes Φ to about 15 digits, so there is no table lookup and no rounding to two decimals.',
      },
      {
        q: 'Which p-value should I use?',
        a: 'Left-tailed tests if a value is unusually low, right-tailed if it is unusually high, and two-tailed if it is unusual in either direction. The two-tailed p is twice the smaller tail.',
      },
      {
        q: 'Does this work for data that is not normal?',
        a: 'The z-score itself always works. The percentile and p-values assume the data follow a normal distribution, so they can be far off for skewed data.',
      },
    ],
    related: ['standard-deviation-calculator', 'confidence-interval-calculator', 'sample-size-calculator', 'average-calculator', 'probability-calculator'],
    updated: '2026-11-02',
  },
  {
    slug: 'confidence-interval-calculator',
    title: 'Confidence Interval Calculator',
    h1: 'Confidence interval calculator',
    description:
      'Confidence interval calculator for a mean (z or t) or a proportion (Wald and Wilson), with the margin of error and a simulation of repeated samples.',
    keywords: ['margin of error calculator', '95 confidence interval', 't interval calculator', 'proportion confidence interval', 'wilson interval', 'confidence level'],
    category: 'math',
    icon: 'Target',
    faqs: [
      {
        q: 'What does 95% confidence mean?',
        a: 'That the method captures the true value in 95% of samples. Any one interval either contains the true value or does not. The simulation on this page draws many samples and marks the intervals that miss.',
      },
      {
        q: 'When should I use t instead of z?',
        a: 'When you only know the standard deviation of your sample, which is almost always. The t interval is wider for small samples and becomes the z interval as the sample grows.',
      },
      {
        q: 'Wald or Wilson for a proportion?',
        a: 'Wilson. The Wald interval is the textbook formula but it is too narrow for small samples and for proportions near 0 or 1, and it can go below 0 or above 1. Wilson does not.',
      },
      {
        q: 'How do I make the interval narrower?',
        a: 'Take a larger sample or accept a lower confidence level. The width falls with the square root of n, so four times the sample halves the margin of error.',
      },
    ],
    related: ['sample-size-calculator', 'z-score-calculator', 'standard-deviation-calculator', 'average-calculator'],
    updated: '2026-11-02',
  },
  {
    slug: 'sample-size-calculator',
    title: 'Sample Size Calculator',
    h1: 'Sample size calculator',
    description:
      'Sample size calculator for surveys: responses needed for a confidence level and margin of error, with the finite population correction and a live curve.',
    keywords: ['survey sample size', 'how many respondents', 'margin of error sample size', 'sample size formula', 'statistical sample size', 'population sample size'],
    category: 'math',
    icon: 'Users',
    faqs: [
      {
        q: 'Why 385 for 95% and ±5%?',
        a: 'n = z² p (1 − p) ÷ E² = 1.96² × 0.25 ÷ 0.05² = 384.2, rounded up to 385. It uses p = 0.5, the most cautious guess, which gives the largest sample.',
      },
      {
        q: 'Does the population size matter?',
        a: 'Only when the sample is a large share of it. For 1,000 people the finite population correction brings 385 down to 278. For a city or a country it changes almost nothing.',
      },
      {
        q: 'What value of p should I use?',
        a: 'Your best guess of the proportion you will measure. If you have no idea, keep 0.5: it gives the largest sample, so the margin of error is met whatever the answer.',
      },
      {
        q: 'Does this account for people who do not reply?',
        a: 'No. It is the number of completed responses you need. If you expect 20% of invitations to be answered, invite five times as many people.',
      },
    ],
    related: ['confidence-interval-calculator', 'z-score-calculator', 'percentage-calculator', 'standard-deviation-calculator'],
    updated: '2026-11-02',
  },
  {
    slug: 'percent-error-calculator',
    title: 'Percent Error Calculator',
    h1: 'Percent error calculator',
    description:
      'Percent error calculator: compare a measured value with the true or accepted value and get the percent error, the signed error and the absolute difference.',
    keywords: ['percentage error', 'experimental error', 'accepted value', 'relative error calculator', 'measurement error', 'percent error formula'],
    category: 'math',
    icon: 'Crosshair',
    faqs: [
      {
        q: 'What is the percent error formula?',
        a: 'Percent error = |measured − true| ÷ |true| × 100. Measuring g as 9.70 m/s² against 9.81 m/s² gives 0.11 ÷ 9.81 × 100 = 1.12%.',
      },
      {
        q: 'Can percent error be negative?',
        a: 'The usual definition takes the absolute value, so it is never negative. The signed error, shown as well, is negative when the measurement is below the true value.',
      },
      {
        q: 'What if the true value is zero?',
        a: 'Percent error is not defined then, because it divides by the true value. Report the absolute difference instead.',
      },
      {
        q: 'Is percent error the same as percentage change?',
        a: 'The formula is the same, but percent error compares a measurement with a known value, and percentage change compares a new value with an old one.',
      },
    ],
    related: ['percentage-change-calculator', 'percentage-calculator', 'significant-figures-calculator', 'rounding-calculator'],
    updated: '2026-11-02',
  },
  {
    slug: 'percentage-change-calculator',
    title: 'Percentage Change Calculator',
    h1: 'Percentage change calculator',
    description:
      'Percentage change calculator: the percent increase or decrease from an old value to a new one, plus the percentage difference between two values.',
    keywords: ['percent increase calculator', 'percent decrease calculator', 'percentage difference', 'percent change formula', 'growth rate', 'price change percent'],
    category: 'math',
    icon: 'TrendingUp',
    faqs: [
      {
        q: 'How do I calculate percentage change?',
        a: 'Subtract the old value from the new one, divide by the old value and multiply by 100. From 50 to 75 is (75 − 50) ÷ 50 × 100 = 50% up.',
      },
      {
        q: 'Why is a 50% rise followed by a 50% fall not zero?',
        a: 'Because the second change starts from a larger number. 100 up 50% is 150, and 150 down 50% is 75, so the total is a 25% fall.',
      },
      {
        q: 'What is the percentage difference?',
        a: 'A comparison with no old and new: |a − b| ÷ ((a + b) ÷ 2) × 100. The difference between 10 and 15 is 5 ÷ 12.5 = 40%, whichever comes first.',
      },
      {
        q: 'What about a change from zero?',
        a: 'It is not defined, because the formula divides by the old value. Any rise from zero is an infinite percentage.',
      },
    ],
    related: ['percentage-calculator', 'percent-error-calculator', 'percentage-off-calculator', 'inflation-calculator', 'discount-calculator'],
    updated: '2026-11-02',
  },
  {
    slug: 'significant-figures-calculator',
    title: 'Significant Figures Calculator',
    h1: 'Significant figures calculator',
    description:
      'Significant figures calculator: count sig figs digit by digit, round to any number of figures, and apply the rules for adding and multiplying measurements.',
    keywords: ['sig fig calculator', 'sig figs counter', 'round to significant figures', 'significant digits', 'sig fig rules', 'how many significant figures'],
    category: 'math',
    icon: 'Hash',
    faqs: [
      {
        q: 'Which zeros are significant?',
        a: 'Zeros between other digits always are (1005 has 4). Leading zeros never are (0.0045 has 2). Trailing zeros are when there is a decimal point (4.50 has 3, 1200. has 4).',
      },
      {
        q: 'How many significant figures does 1200 have?',
        a: 'It is ambiguous: 2, 3 or 4. This calculator counts 2 and says so. Write 1.20 × 10³ for 3, or 1200. with a point for 4.',
      },
      {
        q: 'What is the rule for adding and subtracting?',
        a: 'Round the answer to the last decimal place of the least precise number. 12.11 + 18.0 = 30.11, which becomes 30.1 because 18.0 is only known to tenths.',
      },
      {
        q: 'And for multiplying and dividing?',
        a: 'Keep as many significant figures as the input with the fewest. 4.56 × 1.4 = 6.384, which becomes 6.4 because 1.4 has two.',
      },
    ],
    related: ['scientific-notation-converter', 'rounding-calculator', 'percent-error-calculator', 'scientific-calculator'],
    updated: '2026-11-02',
  },
  {
    slug: 'scientific-notation-converter',
    title: 'Scientific Notation Converter',
    h1: 'Scientific notation converter',
    description:
      'Scientific notation converter: decimal to scientific, E and engineering notation and back, exact for long numbers, with the point moving step by step.',
    keywords: ['scientific notation calculator', 'standard form calculator', 'e notation converter', 'engineering notation', 'convert to scientific notation', 'decimal to scientific notation'],
    category: 'math',
    icon: 'Superscript',
    faqs: [
      {
        q: 'How do I write a number in scientific notation?',
        a: 'Move the decimal point until one non-zero digit is left in front of it, and count the moves. Moving left gives a positive power of ten: 45,600 = 4.56 × 10⁴. Moving right gives a negative one: 0.0072 = 7.2 × 10⁻³.',
      },
      {
        q: 'What is E notation?',
        a: 'The same thing written for calculators and code: 4.56E4 means 4.56 × 10⁴, and 7.2E-3 means 7.2 × 10⁻³.',
      },
      {
        q: 'What is engineering notation?',
        a: 'Scientific notation with the power of ten a multiple of 3, so it matches the prefixes kilo, mega, milli and micro: 0.000047 = 47 × 10⁻⁶, which is 47 micro.',
      },
      {
        q: 'Are trailing zeros kept?',
        a: 'Zeros after a decimal point are kept, because they are significant: 0.00450 is 4.50 × 10⁻³. Trailing zeros of a whole number without a point are dropped: 1200 is 1.2 × 10³.',
      },
    ],
    related: ['significant-figures-calculator', 'scientific-calculator', 'rounding-calculator', 'exponent-and-log-calculator', 'number-base-converter'],
    updated: '2026-11-02',
  },
]
