import type { Tool } from '../types'

const updated = '2026-11-02'

/** Pay, assets and depreciation (calc1 agent). */
export const tools: Tool[] = [
  {
    slug: 'commission-calculator',
    title: 'Commission Calculator',
    h1: 'Commission calculator with tiers',
    description:
      'Commission calculator: work out sales commission at one rate or with tiers, plus base pay, the effective rate and what the next sale earns you.',
    keywords: ['sales commission calculator', 'tiered commission', 'commission rate', 'commission pay', 'real estate commission'],
    category: 'finance',
    icon: 'HandCoins',
    faqs: [
      { q: 'How does tiered commission work?', a: 'Each tier pays its rate on the sales inside it. With 5% up to 50,000, 7% up to 100,000 and 10% above, sales of 120,000 earn 2,500 + 3,500 + 2,000 = 8,000.' },
      { q: 'What is the effective commission rate?', a: 'Total commission divided by total sales. In the example above it is 6.67%.' },
      { q: 'My plan pays the top rate on all sales. Does this work?', a: 'Use the one-rate option with the rate for your sales level. The tier mode is for marginal plans, where each rate applies only above its edge.' },
    ],
    related: ['salary-calculator', 'hourly-to-salary-calculator', 'overtime-calculator', 'pay-raise-calculator'],
    updated,
  },
  {
    slug: 'overtime-calculator',
    title: 'Overtime Calculator',
    h1: 'Overtime pay calculator',
    description:
      'Overtime calculator: work out overtime pay at time and a half or double time, the total pay for the week, the average hourly rate and the yearly figure.',
    keywords: ['overtime pay calculator', 'time and a half calculator', 'double time pay', 'ot calculator', 'overtime rate'],
    category: 'finance',
    icon: 'Clock',
    faqs: [
      { q: 'How is time and a half calculated?', a: 'Multiply the hourly rate by 1.5, then by the overtime hours. At 25 an hour, 8 overtime hours pay 25 × 1.5 × 8 = 300.' },
      { q: 'When do I get overtime?', a: 'In the US, non-exempt employees get at least 1.5 times their regular rate for hours over 40 in a workweek. Some states also pay overtime for hours over 8 in a day.' },
      { q: 'Is the result before or after tax?', a: 'Before tax and deductions.' },
    ],
    related: ['hourly-to-salary-calculator', 'salary-calculator', 'time-card-calculator', 'pay-raise-calculator'],
    updated,
  },
  {
    slug: 'pay-raise-calculator',
    title: 'Pay Raise Calculator',
    h1: 'Pay raise calculator with inflation',
    description:
      'Pay raise calculator: see your new salary or hourly rate after a raise, the extra per month and per paycheck, and the real raise after inflation.',
    keywords: ['salary increase calculator', 'raise percentage calculator', 'new salary after raise', 'real wage increase', 'cost of living raise'],
    category: 'finance',
    icon: 'TrendingUp',
    faqs: [
      { q: 'How do I calculate a raise percentage?', a: 'Divide the raise by your old pay and multiply by 100. A raise from 60,000 to 62,400 is 2,400 ÷ 60,000 × 100 = 4%.' },
      { q: 'What is a real raise?', a: 'The raise after inflation: (1 + raise) ÷ (1 + inflation) − 1. A 4% raise with 3% inflation is a real raise of about 0.97%.' },
      { q: 'How much more is a raise per paycheck?', a: 'Divide the yearly increase by the number of paychecks. 2,400 a year is 92.31 every two weeks, before tax.' },
    ],
    related: ['salary-calculator', 'inflation-calculator', 'hourly-to-salary-calculator', 'commission-calculator'],
    updated,
  },
  {
    slug: 'depreciation-calculator',
    title: 'Depreciation Calculator',
    h1: 'Depreciation calculator: straight line, declining balance, MACRS',
    description:
      'Depreciation calculator with straight line, double declining balance, sum of the years’ digits and MACRS tables, with a year-by-year schedule.',
    keywords: ['straight line depreciation', 'double declining balance', 'macrs depreciation calculator', 'sum of years digits', 'book value calculator'],
    category: 'finance',
    icon: 'TrendingDown',
    faqs: [
      { q: 'How is straight-line depreciation calculated?', a: 'Cost minus salvage value, divided by the useful life. A 50,000 asset with 5,000 salvage over 5 years depreciates 9,000 a year.' },
      { q: 'What is double declining balance?', a: 'Each year takes 2 ÷ life of the book value at the start of the year, and switches to straight line when that gives more. It never goes below salvage. The same 50,000 asset gives 20,000, 12,000, 7,200, 4,320 and 1,480.' },
      { q: 'What is MACRS?', a: 'The US tax depreciation system. It uses fixed yearly percentages for each property class from IRS Publication 946 and ignores salvage. 5-year property is depreciated over 6 tax years because of the half-year convention.' },
      { q: 'Which method should I use?', a: 'For US tax returns, MACRS for most business property. For financial statements, the method that matches how the asset is used up; straight line is the most common.' },
    ],
    related: ['roi-calculator', 'break-even-calculator', 'car-loan-calculator', 'net-worth-calculator'],
    updated,
  },
  {
    slug: 'net-worth-calculator',
    title: 'Net Worth Calculator',
    h1: 'Net worth calculator',
    description:
      'Net worth calculator: add up what you own and what you owe to get your net worth, debt-to-asset ratio, liquid net worth and the mix of your assets.',
    keywords: ['personal net worth', 'assets minus liabilities', 'net worth statement', 'household net worth', 'balance sheet calculator'],
    category: 'finance',
    icon: 'Wallet',
    faqs: [
      { q: 'How is net worth calculated?', a: 'Total assets minus total debts. Assets are what you own at today’s value; debts are what it would take to pay off every loan and card today.' },
      { q: 'Should I count my home?', a: 'Yes, at what it would sell for after selling costs, and count the mortgage as a debt. Liquid net worth leaves the home out and shows what you could reach quickly.' },
      { q: 'Do retirement accounts count?', a: 'Yes. Keep in mind that withdrawals from pre-tax accounts are taxed, so their value to you is lower than the balance.' },
      { q: 'Are my numbers saved or sent anywhere?', a: 'No. They stay in this browser tab and are gone when you close it.' },
    ],
    related: ['budget-calculator', 'debt-payoff-calculator', 'retirement-calculator', 'investment-calculator'],
    updated,
  },
]
