import type { Tool } from '../types'

const updated = '2026-11-02'

/** Time value of money and returns. */
export const tools: Tool[] = [
  {
    slug: 'present-value-calculator',
    title: 'Present Value Calculator',
    h1: 'Present value calculator',
    description:
      'Present value calculator: find what a future amount, with optional level payments, is worth today at your discount rate and compounding.',
    keywords: ['pv calculator', 'discount factor', 'present value of annuity', 'discounted value', 'time value of money'],
    category: 'finance',
    icon: 'Rewind',
    faqs: [
      { q: 'What is present value?', a: 'It is what a future amount is worth today. At 5% a year, 10,000 received in 10 years is worth 6,139.13 today, because 6,139.13 invested at 5% grows to 10,000 in that time.' },
      { q: 'Which discount rate should I use?', a: 'Use the return you could get elsewhere at the same risk: a savings rate for a safe payment, an expected investment return for a risky one.' },
      { q: 'What is the difference between payments at the end and at the start of a period?', a: 'Payments at the start are received one period sooner, so each is worth (1 + i) times more today. Rent and leases are usually paid at the start; loan payments and bond coupons at the end.' },
      { q: 'Are my numbers sent anywhere?', a: 'No. The calculation runs in your browser.' },
    ],
    related: ['future-value-calculator', 'npv-calculator', 'inflation-calculator', 'compound-interest-calculator'],
    updated,
  },
  {
    slug: 'future-value-calculator',
    title: 'Future Value Calculator',
    h1: 'Future value calculator',
    description:
      'Future value calculator: grow a starting amount and regular payments at a fixed rate, with any compounding, and see the interest year by year.',
    keywords: ['fv calculator', 'future value of annuity', 'investment growth', 'savings growth calculator', 'time value of money'],
    category: 'finance',
    icon: 'FastForward',
    faqs: [
      { q: 'What is future value?', a: 'It is what money you have now, plus any regular payments, will be worth later at a given rate. 10,000 plus 200 a month at 6% for 15 years grows to 82,704.68.' },
      { q: 'Does compounding frequency matter?', a: 'Yes, a little. More frequent compounding adds interest on interest sooner. 6% compounded monthly is an effective 6.168% a year.' },
      { q: 'What if my payments are at the start of each month?', a: 'Choose start of period. Each payment then earns one more month of interest, which raises the future value.' },
      { q: 'Are my numbers sent anywhere?', a: 'No. The calculation runs in your browser.' },
    ],
    related: ['present-value-calculator', 'compound-interest-calculator', 'savings-goal-calculator', 'investment-calculator'],
    updated,
  },
  {
    slug: 'npv-calculator',
    title: 'NPV Calculator',
    h1: 'NPV calculator (net present value)',
    description:
      'NPV calculator: discount yearly cash flows at your rate to get net present value, IRR, payback, discounted payback and profitability index.',
    keywords: ['net present value calculator', 'discounted cash flow', 'profitability index', 'discounted payback period', 'capital budgeting'],
    category: 'finance',
    icon: 'HandCoins',
    faqs: [
      { q: 'What does a positive NPV mean?', a: 'The cash flows are worth more today than they cost, at your discount rate. The project earns more than that rate, so it adds value.' },
      { q: 'How do I enter the initial investment?', a: 'As a negative number in year 0. Later years are the money that comes back, at the end of each year. Use negative numbers for later costs too.' },
      { q: 'What is the difference between NPV and IRR?', a: 'NPV is an amount of money at a rate you choose. IRR is the rate at which NPV is zero. When two projects differ in size or timing, rank them by NPV.' },
      { q: 'Are my numbers sent anywhere?', a: 'No. The calculation runs in your browser.' },
    ],
    related: ['irr-calculator', 'present-value-calculator', 'roi-calculator', 'break-even-calculator'],
    updated,
  },
  {
    slug: 'irr-calculator',
    title: 'IRR Calculator',
    h1: 'IRR calculator (internal rate of return)',
    description:
      'IRR calculator: find the internal rate of return of yearly cash flows, the MIRR at your finance and reinvestment rates, and the NPV profile.',
    keywords: ['internal rate of return calculator', 'mirr calculator', 'npv profile', 'multiple irr', 'investment return'],
    category: 'finance',
    icon: 'Crosshair',
    faqs: [
      { q: 'What is IRR?', a: 'The discount rate at which the net present value of the cash flows is zero. An investment pays when its IRR is above your cost of money.' },
      { q: 'Why can there be more than one IRR?', a: 'When the cash flows change sign more than once, for example a cost at the end, NPV can cross zero more than once. The calculator lists every rate and the chart shows each crossing.' },
      { q: 'What is MIRR?', a: 'The modified IRR. It grows the money that comes back at a reinvestment rate you choose and discounts the money you pay at a finance rate, so it has only one answer.' },
      { q: 'Are my numbers sent anywhere?', a: 'No. The calculation runs in your browser.' },
    ],
    related: ['npv-calculator', 'cagr-calculator', 'roi-calculator', 'investment-calculator'],
    updated,
  },
  {
    slug: 'cagr-calculator',
    title: 'CAGR Calculator',
    h1: 'CAGR calculator (compound annual growth rate)',
    description:
      'CAGR calculator: find the compound annual growth rate from a start value, an end value and years, or the end value from a growth rate.',
    keywords: ['compound annual growth rate', 'annualized return', 'average annual growth', 'growth rate calculator', 'investment growth rate'],
    category: 'finance',
    icon: 'ChartSpline',
    faqs: [
      { q: 'What is CAGR?', a: 'The one yearly growth rate that takes a start value to an end value over a number of years, with compounding. From 10,000 to 19,000 in 3 years is 23.86% a year.' },
      { q: 'Why is CAGR lower than the average yearly growth?', a: 'The simple average divides total growth by the years and ignores compounding. Compounding reaches the same end value with a lower yearly rate.' },
      { q: 'Can I use part years?', a: 'Yes. Enter years as a decimal, for example 2.5 for two and a half years.' },
      { q: 'Are my numbers sent anywhere?', a: 'No. The calculation runs in your browser.' },
    ],
    related: ['roi-calculator', 'irr-calculator', 'investment-calculator', 'rule-of-72-calculator'],
    updated,
  },
  {
    slug: 'rule-of-72-calculator',
    title: 'Rule of 72 Calculator',
    h1: 'Rule of 72 calculator',
    description:
      'Rule of 72 calculator: estimate how many years money takes to double at a rate, and compare it with the exact time, the rule of 70 and 69.3.',
    keywords: ['doubling time calculator', 'years to double money', 'rule of 70', 'rule of 69', 'how long to double investment'],
    category: 'finance',
    icon: 'Hourglass',
    faqs: [
      { q: 'What is the rule of 72?', a: 'Divide 72 by the yearly rate in percent to get the years money takes to double. At 8%, 72 ÷ 8 = 9 years; the exact answer is 9.006.' },
      { q: 'How accurate is the rule of 72?', a: 'It is closest near 8%. At 2% it gives 36 years against an exact 35.00; at 20% it gives 3.6 years against an exact 3.80.' },
      { q: 'When should I use the rule of 70 or 69.3?', a: 'The rule of 70 is closer at rates of about 1% to 5%, such as inflation or population growth. The rule of 69.3 is exact for continuous compounding.' },
      { q: 'Are my numbers sent anywhere?', a: 'No. The calculation runs in your browser.' },
    ],
    related: ['compound-interest-calculator', 'cagr-calculator', 'inflation-calculator', 'investment-calculator'],
    updated,
  },
]
