import type { Tool } from '../types'

const updated = '2026-11-02'

/** Loans and mortgages (calc1 agent). */
export const tools: Tool[] = [
  {
    slug: 'refinance-calculator',
    title: 'Refinance Calculator',
    h1: 'Mortgage refinance calculator with break-even',
    description:
      'Refinance calculator: compare your current mortgage with a new rate and term, see the monthly saving, the break-even month and the lifetime cost.',
    keywords: ['mortgage refinance calculator', 'refinance break even', 'should i refinance', 'refi calculator', 'refinance savings'],
    category: 'finance',
    icon: 'RefreshCw',
    faqs: [
      { q: 'What is the break-even point of a refinance?', a: 'It is the number of months until the monthly saving has paid back the closing costs: closing costs divided by the monthly saving. With 6,000 of costs and a saving of 313.93 a month, that is 20 months.' },
      { q: 'Can a lower payment cost more in total?', a: 'Yes. A new 30-year loan on a balance with 27 years left stretches the payments. The lifetime difference and the chart show the total cost of each path, closing costs included.' },
      { q: 'Should I add the closing costs to the loan?', a: 'It saves cash now and you pay interest on the costs for the life of the loan. Pick each option in the calculator to compare the payment and the lifetime cost.' },
      { q: 'Are my numbers sent anywhere?', a: 'No. The calculation runs in your browser.' },
    ],
    related: ['mortgage-calculator', 'mortgage-payoff-calculator', 'amortization-schedule-calculator', 'apr-calculator'],
    updated,
  },
  {
    slug: 'auto-lease-calculator',
    title: 'Auto Lease Calculator',
    h1: 'Car lease calculator with money factor',
    description:
      'Auto lease calculator: work out the monthly car lease payment from the price, residual value, money factor or APR, down payment, fees and sales tax.',
    keywords: ['car lease calculator', 'lease payment calculator', 'money factor calculator', 'residual value', 'vehicle lease'],
    category: 'finance',
    icon: 'Car',
    faqs: [
      { q: 'What is a money factor?', a: 'It is the lease rate written as a small decimal. Multiply it by 2,400 to get the approximate APR: a money factor of 0.0025 is about 6%.' },
      { q: 'What is the residual value?', a: 'It is what the lessor expects the car to be worth at the end of the lease, as a percentage of the MSRP. A higher residual means you pay for less depreciation, so the payment is lower.' },
      { q: 'Does a bigger down payment save money on a lease?', a: 'It lowers the monthly payment and the finance fee a little, but if the car is stolen or written off early, the down payment is usually lost. Many people keep the amount due at signing small.' },
      { q: 'How is sales tax on a lease charged?', a: 'In most US states tax is charged on each monthly payment, which is how this calculator works. Some states tax the full price up front.' },
    ],
    related: ['car-loan-calculator', 'loan-calculator', 'apr-calculator', 'down-payment-calculator'],
    updated,
  },
  {
    slug: 'down-payment-calculator',
    title: 'Down Payment Calculator',
    h1: 'Down payment calculator for a house',
    description:
      'Down payment calculator: find the down payment and cash you need for a home, the loan amount, and how many months of saving it takes to get there.',
    keywords: ['house down payment', 'how much to put down on a house', 'down payment savings', 'home deposit calculator', '20 percent down'],
    category: 'finance',
    icon: 'PiggyBank',
    faqs: [
      { q: 'How much should I put down on a house?', a: 'Twenty percent avoids private mortgage insurance on most conventional US loans. Many loans accept 3% to 5% down, and some government-backed loans accept less, with insurance added to the payment.' },
      { q: 'Do I need more than the down payment?', a: 'Yes. Closing costs are usually 2% to 5% of the price. The calculator adds them to the cash you need.' },
      { q: 'How is the saving time worked out?', a: 'Your savings grow each month by the interest rate and your monthly deposit until they reach the cash you need. On a 400,000 home with 20% down and 3% closing costs, 30,000 saved and 1,500 a month at 4% gets there in 37 months.' },
    ],
    related: ['house-affordability-calculator', 'mortgage-calculator', 'savings-goal-calculator', 'rent-vs-buy-calculator'],
    updated,
  },
  {
    slug: 'apr-calculator',
    title: 'APR Calculator',
    h1: 'APR calculator with fees',
    description:
      'APR calculator: find the annual percentage rate of a loan with fees or points, compare it with the interest rate and see the full cost of borrowing.',
    keywords: ['annual percentage rate calculator', 'apr vs interest rate', 'loan apr with fees', 'mortgage apr', 'true cost of loan'],
    category: 'finance',
    icon: 'Percent',
    faqs: [
      { q: 'What is the difference between APR and the interest rate?', a: 'The interest rate sets the payment. The APR is the rate at which those payments repay only the money you actually receive after fees, so it includes the fees as a yearly cost.' },
      { q: 'Why is my APR higher than my rate?', a: 'Because fees reduce the money you receive while the payments stay the same. A 25,000 loan at 7.5% for 5 years with 1,000 of fees has an APR of about 9.24%.' },
      { q: 'Does it matter if the fees are added to the loan?', a: 'A little. When the fees are added, you pay interest on them, the payment rises and the APR is slightly different. The calculator handles both cases.' },
      { q: 'Is the APR the same as the APY?', a: 'No. APR is a nominal yearly rate (monthly rate times 12). APY includes compounding within the year.' },
    ],
    related: ['loan-calculator', 'mortgage-calculator', 'refinance-calculator', 'car-loan-calculator'],
    updated,
  },
  {
    slug: 'student-loan-calculator',
    title: 'Student Loan Calculator',
    h1: 'Student loan repayment calculator',
    description:
      'Student loan calculator: work out the monthly payment, total interest and payoff time, and see how an extra payment each month shortens the loan.',
    keywords: ['student loan repayment calculator', 'student loan payoff', 'college loan calculator', 'student loan interest', 'pay off student loans early'],
    category: 'finance',
    icon: 'GraduationCap',
    faqs: [
      { q: 'How is the student loan payment worked out?', a: 'With the standard level-payment formula: the same amount each month repays the balance and the interest over the term. 35,000 at 6.5% over 10 years is 397.42 a month.' },
      { q: 'How much does paying 100 extra a month save?', a: 'On 35,000 at 6.5% over 10 years, 100 extra each month ends the loan after 89 payments and saves about 3,500 of interest.' },
      { q: 'Does it include income-driven repayment?', a: 'No. It shows the standard plan. Income-driven plans set the payment from your income and family size and can change each year.' },
      { q: 'Are my numbers sent anywhere?', a: 'No. Everything is calculated in your browser.' },
    ],
    related: ['loan-calculator', 'debt-payoff-calculator', 'debt-to-income-ratio-calculator', 'amortization-schedule-calculator'],
    updated,
  },
  {
    slug: 'debt-to-income-ratio-calculator',
    title: 'Debt-to-Income Ratio Calculator',
    h1: 'Debt-to-income ratio calculator',
    description:
      'Debt-to-income ratio calculator: add your monthly debt payments and gross income to get your DTI, the housing ratio, and the room left under lender limits.',
    keywords: ['dti calculator', 'debt to income ratio', 'front end ratio', 'back end ratio', 'mortgage dti'],
    category: 'finance',
    icon: 'Scale',
    faqs: [
      { q: 'What is a good debt-to-income ratio?', a: '36% or less is the usual target. 43% is a common limit for a qualified US mortgage, and some government-backed loans allow about 50% with other strengths.' },
      { q: 'What counts as debt?', a: 'Required monthly payments: rent or mortgage with tax and insurance, car loans, student loans, credit card minimums, personal loans and support payments. Utilities, food and phone bills do not count.' },
      { q: 'What is the difference between front-end and back-end DTI?', a: 'Front-end counts only the housing payment. Back-end counts all debt payments. Lenders look at both.' },
      { q: 'Should I use gross or net income?', a: 'Gross income, before tax and deductions. That is what lenders use.' },
    ],
    related: ['house-affordability-calculator', 'mortgage-calculator', 'budget-calculator', 'debt-payoff-calculator'],
    updated,
  },
  {
    slug: 'mortgage-payoff-calculator',
    title: 'Mortgage Payoff Calculator',
    h1: 'Mortgage payoff calculator with extra payments',
    description:
      'Mortgage payoff calculator: see how extra monthly, yearly or one-time payments change your payoff date and the interest you save, year by year.',
    keywords: ['extra payment calculator', 'pay off mortgage early', 'mortgage prepayment', 'early payoff calculator', 'principal prepayment'],
    category: 'finance',
    icon: 'CalendarCheck',
    faqs: [
      { q: 'How much does an extra payment each month save?', a: 'It depends on the balance, the rate and the time left. On a 250,000 loan at 6.5% with 25 years left, 200 extra a month saves about 64,900 in interest and ends the loan 5 years 6 months sooner. Enter your own numbers to see your figure.' },
      { q: 'Is it better to pay extra every month or once a year?', a: 'Monthly is a little better, because each extra payment stops interest on that amount from the next month. The calculator accepts both, so you can compare them.' },
      { q: 'Does the extra payment lower my monthly payment?', a: 'No. The scheduled payment stays the same and the loan ends sooner. Some lenders can recast the loan to lower the payment after a large one-time payment; ask yours.' },
      { q: 'Are my numbers sent anywhere?', a: 'No. The schedule is calculated in your browser.' },
    ],
    related: ['mortgage-calculator', 'amortization-schedule-calculator', 'refinance-calculator', 'loan-calculator'],
    updated,
  },
]
