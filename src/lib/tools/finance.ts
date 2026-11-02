import type { Tool } from './types'

export const tools: Tool[] = [
  {
    slug: 'mortgage-calculator',
    title: 'Mortgage Calculator',
    h1: 'Mortgage calculator with taxes, insurance and PMI',
    description:
      'Mortgage calculator for the full monthly payment with property tax, insurance, HOA and PMI, plus total interest, payoff date and amortisation schedule.',
    keywords: [
      'mortgage payment calculator',
      'home loan calculator',
      'amortization schedule',
      'pmi calculator',
      'house payment calculator',
      'extra mortgage payment calculator',
    ],
    category: 'finance',
    icon: 'House',
    popular: true,
    faqs: [
      {
        q: 'What does the monthly payment include?',
        a: 'Principal and interest from the loan itself, plus the escrow items most lenders collect with it: property tax, homeowners insurance, HOA or condo fees, and PMI while your loan-to-value is above 80%. You can zero out any of them.',
      },
      {
        q: 'When does PMI stop?',
        a: 'This calculator drops PMI as soon as the balance falls below 80% of the purchase price, which is when you can normally request cancellation on a conventional US loan. Lenders must cancel automatically at 78% and may use an appraised value instead of the purchase price.',
      },
      {
        q: 'How much does one extra payment a month save?',
        a: 'Enter an amount in the extra monthly principal field and the tool shows the interest saved and the months removed from the term. On a 30-year loan, even a small extra amount often cuts several years off, because every extra dollar of principal stops accruing interest for the rest of the term.',
      },
      {
        q: 'Is the amortisation schedule downloadable?',
        a: 'Yes. The monthly and yearly views come from the same schedule. The CSV button exports each payment with its interest, principal and remaining balance for a spreadsheet.',
      },
      {
        q: 'Do my numbers get uploaded anywhere?',
        a: 'No. The calculation runs in JavaScript in your browser. Your figures do not go to a server or to analytics.',
      },
    ],
    related: ['loan-calculator', 'car-loan-calculator', 'compound-interest-calculator', 'inflation-calculator'],
    updated: '2026-11-01',
  },
  {
    slug: 'loan-calculator',
    title: 'Loan Calculator',
    h1: 'Loan calculator with amortisation schedule',
    description:
      'Loan calculator: work out the monthly payment, total interest and total cost of any amortising loan, with a payment schedule you can download as CSV.',
    keywords: [
      'personal loan calculator',
      'monthly payment calculator',
      'installment loan calculator',
      'amortization calculator',
      'student loan calculator',
      'interest calculator',
    ],
    category: 'finance',
    icon: 'Landmark',
    popular: true,
    faqs: [
      {
        q: 'What kind of loans does this cover?',
        a: 'Any loan repaid in equal monthly instalments at a fixed rate: personal loans, student loans, business loans, home improvement loans and most car finance. Interest-only and balloon structures are not covered.',
      },
      {
        q: 'What is the difference between the interest rate and the APR?',
        a: 'The interest rate prices the borrowing itself. APR also folds in fees, so it is higher whenever there is an arrangement fee. Enter your fee separately and the tool shows the total cost of borrowing, which is the figure worth comparing between lenders.',
      },
      {
        q: 'Why is so much of my first payment interest?',
        a: 'Interest is charged on the outstanding balance, which is at its largest at the start. As the balance falls, the interest portion of a fixed payment shrinks and the principal portion grows. The schedule shows the month where they cross.',
      },
      {
        q: 'Does paying extra each month help?',
        a: 'Yes. Extra money goes straight to the principal, so it removes all the future interest on that part of the balance. Add an amount in the extra field to see the interest saved and the time cut.',
      },
    ],
    related: ['mortgage-calculator', 'car-loan-calculator', 'simple-interest-calculator', 'compound-interest-calculator'],
    updated: '2026-11-01',
  },
  {
    slug: 'car-loan-calculator',
    title: 'Car Loan Calculator',
    h1: 'Car loan calculator with tax, trade-in and fees',
    description:
      'Car loan calculator with price, trade-in, down payment, sales tax and fees. See the amount financed, the monthly payment and the total cost.',
    keywords: [
      'auto loan calculator',
      'car payment calculator',
      'vehicle finance calculator',
      'trade in calculator',
      'car loan interest',
      'sales tax on car',
    ],
    category: 'finance',
    icon: 'Car',
    faqs: [
      {
        q: 'How is the amount financed worked out?',
        a: 'Vehicle price plus sales tax plus fees, minus your cash down payment, minus the net value of your trade-in (its value less anything you still owe on it). Fees can be paid in cash instead of financed with the toggle.',
      },
      {
        q: 'Is sales tax charged on the trade-in?',
        a: 'In most US states you only pay tax on the price after the trade-in credit, which is what the calculator assumes by default. A few states tax the full price. Switch the toggle off for those.',
      },
      {
        q: 'What is negative equity and why does it matter?',
        a: 'If you owe more on your current car than the dealer gives you for it, the shortfall gets rolled into the new loan. You then start the new car owing more than it is worth, and the calculator flags it because it inflates both the payment and the total interest.',
      },
      {
        q: 'Is a longer term a good idea?',
        a: 'A 72 or 84-month loan lowers the payment but raises the total interest sharply, and the car depreciates faster than the balance falls, so you owe more than the car is worth for longer. Compare a few terms in the calculator to see the difference in total cost.',
      },
    ],
    related: ['loan-calculator', 'mortgage-calculator', 'simple-interest-calculator', 'salary-calculator'],
    updated: '2026-11-01',
  },
  {
    slug: 'compound-interest-calculator',
    title: 'Compound Interest Calculator',
    h1: 'Compound interest calculator with regular deposits',
    description:
      'Compound interest calculator: project savings growth with regular deposits and any compounding frequency, and see how much of the balance is interest.',
    keywords: [
      'investment growth calculator',
      'savings interest calculator',
      'future value calculator',
      'daily compound interest',
      'monthly compounding',
      'apy calculator',
    ],
    category: 'finance',
    icon: 'TrendingUp',
    popular: true,
    faqs: [
      {
        q: 'What does compounding frequency change?',
        a: 'It sets how often earned interest is added to the balance and starts earning interest itself. At 7% nominal, annual compounding gives 7.00% effective, monthly gives 7.23% and daily gives 7.25%. The tool shows the effective annual rate next to your choice.',
      },
      {
        q: 'What if my deposits and my compounding happen at different frequencies?',
        a: 'The calculator handles this exactly. It converts the nominal rate into the equivalent growth over one deposit period using (1 + r/m)^(m/c) − 1, so monthly deposits into a quarterly-compounding account come out right.',
      },
      {
        q: 'Should I choose deposits at the start or the end of the period?',
        a: 'End of period (an ordinary annuity) is the safer default and matches most standing orders. Start of period earns one extra period of interest on every deposit, which adds about one percent over a long run.',
      },
      {
        q: 'Does this account for inflation and tax?',
        a: 'No. The projection is in nominal money before tax. Run the final figure through the inflation calculator to see it in today’s money, and subtract your fund fees from the expected return to approximate charges.',
      },
    ],
    related: ['savings-goal-calculator', 'retirement-calculator', 'simple-interest-calculator', 'inflation-calculator'],
    updated: '2026-11-01',
  },
  {
    slug: 'simple-interest-calculator',
    title: 'Simple Interest Calculator',
    h1: 'Simple interest calculator',
    description:
      'Calculate simple interest, or solve for the principal, rate or time, with the worked formula and a side-by-side comparison against compounding.',
    keywords: [
      'simple interest formula',
      'i = prt calculator',
      'interest on a loan',
      'principal rate time',
      'flat rate interest',
    ],
    category: 'finance',
    icon: 'Percent',
    faqs: [
      {
        q: 'What is the simple interest formula?',
        a: 'I = P × r × t, where P is the principal, r is the annual rate as a decimal and t is the time in years. The final balance is A = P × (1 + r × t). The calculator substitutes your numbers into both.',
      },
      {
        q: 'How is it different from compound interest?',
        a: 'Simple interest is always charged on the original principal, so it grows in a straight line. Compound interest is charged on the balance including interest already added, so it curves upward. The comparison chart shows the gap for your figures.',
      },
      {
        q: 'Can I solve for the rate or the time?',
        a: 'Yes. Pick what to solve for and enter the other three values. The calculator rearranges the formula to P = I / (r × t), r = I / (P × t) or t = I / (P × r) and shows the working.',
      },
      {
        q: 'Where is simple interest used?',
        a: 'Short-term promissory notes, many private and family loans, some car loans, certain bond coupon calculations, and statutory interest on late payments. Savings accounts and credit cards almost always compound instead.',
      },
    ],
    related: ['compound-interest-calculator', 'loan-calculator', 'savings-goal-calculator', 'roi-calculator'],
    updated: '2026-11-01',
  },
  {
    slug: 'savings-goal-calculator',
    title: 'Savings Goal Calculator',
    h1: 'Savings goal calculator',
    description:
      'Savings goal calculator: find the regular deposit to reach a target by a date, or how long your current deposit takes, with a year-by-year plan.',
    keywords: [
      'how much to save per month',
      'savings target calculator',
      'house deposit calculator',
      'emergency fund calculator',
      'save by date calculator',
    ],
    category: 'finance',
    icon: 'PiggyBank',
    faqs: [
      {
        q: 'Which direction should I solve in?',
        a: 'Use “deposit needed” when the date is fixed, for example a wedding, a house deposit or a car. Use “time needed” when the amount you can spare each month is fixed and you want to know when you get there.',
      },
      {
        q: 'What return should I assume?',
        a: 'For a goal under three years, use the rate on an actual savings account or term deposit. For longer horizons people often assume a market-like return, but that comes with the risk the balance is down in the year you need the money.',
      },
      {
        q: 'Why does the answer change so much with the return?',
        a: 'Interest earns interest, so a higher rate compounds over every remaining period. For short goals the deposits dominate and the rate barely matters; for a ten-year goal the return can supply a third of the total.',
      },
      {
        q: 'Does it account for inflation?',
        a: 'No. If your goal is a purchase several years from now, increase the target for inflation first. The inflation calculator shows what today’s price is likely to become.',
      },
    ],
    related: ['compound-interest-calculator', 'retirement-calculator', 'inflation-calculator', 'salary-calculator'],
    updated: '2026-11-01',
  },
  {
    slug: 'retirement-calculator',
    title: 'Retirement Calculator',
    h1: 'Retirement savings calculator',
    description:
      'Project your retirement nest egg in both nominal and inflation-adjusted terms, then see the sustainable income it supports at a 4% withdrawal rate.',
    keywords: [
      'retirement savings calculator',
      '401k calculator',
      'pension projection',
      'nest egg calculator',
      '4 percent rule',
      'fire calculator',
    ],
    category: 'finance',
    icon: 'Umbrella',
    faqs: [
      {
        q: 'What is the difference between the nominal and real figures?',
        a: 'Nominal is the number that will appear on your statement. Real is that number divided by cumulative inflation, so it is expressed in what money buys today. At 2.5% inflation over 30 years, prices roughly double, so the real figure is about half the nominal one.',
      },
      {
        q: 'What is the 4% rule?',
        a: 'A planning rule of thumb from studies of historical US portfolios: withdraw 4% of the balance in the first year of retirement, then increase that amount with inflation each year. It is a starting point for sizing a pot and is not a guarantee. You can change the withdrawal rate here.',
      },
      {
        q: 'Should I include my employer match?',
        a: 'Yes. Add it to the monthly contribution, because it compounds in the same way. Do the same for tax relief on pension contributions if it lands in the account.',
      },
      {
        q: 'What return should I use?',
        a: 'Use a long-run average for your actual asset mix, then subtract your fund fees. A globally diversified equity portfolio has historically returned in the region of 7% nominal before fees; a bond-heavy mix is lower and steadier.',
      },
      {
        q: 'Why does the yearly contribution increase matter so much?',
        a: 'Contributions that rise with your pay keep their real value and land earlier relative to your salary, so they compound for longer. Even a 2% annual step-up changes a 30-year projection noticeably.',
      },
    ],
    related: ['compound-interest-calculator', 'savings-goal-calculator', 'inflation-calculator', 'roi-calculator'],
    updated: '2026-11-01',
  },
  {
    slug: 'roi-calculator',
    title: 'ROI Calculator',
    h1: 'Return on investment (ROI) calculator',
    description:
      'Calculate ROI, net profit and annualised return over any holding period, and compare the result against a benchmark rate you choose.',
    keywords: [
      'return on investment calculator',
      'annualized return calculator',
      'cagr calculator',
      'investment profit calculator',
      'roi formula',
    ],
    category: 'finance',
    icon: 'ChartLine',
    faqs: [
      {
        q: 'What is the difference between ROI and annualised ROI?',
        a: 'ROI is the total percentage gain over the whole holding period, however long that was. Annualised ROI (CAGR) is the steady yearly rate that would produce the same result, which is the only fair way to compare a two-year deal with a ten-year one.',
      },
      {
        q: 'What counts as a cost?',
        a: 'Everything you paid out: the purchase itself plus commission, fees, stamp duty, renovation, or campaign spend. Leaving costs out is the most common way an ROI figure ends up flattering.',
      },
      {
        q: 'How do I handle dividends or rent?',
        a: 'Put the total cash received in the income field. It is added to the final value, so it lifts both the net profit and the annualised return.',
      },
      {
        q: 'What if I added money along the way?',
        a: 'ROI assumes a single amount in and a single amount out. If you contributed or withdrew during the period, an internal rate of return (IRR) is the correct measure. ROI overstates or understates the return, depending on the timing.',
      },
    ],
    related: ['compound-interest-calculator', 'inflation-calculator', 'break-even-calculator', 'retirement-calculator'],
    updated: '2026-11-01',
  },
  {
    slug: 'inflation-calculator',
    title: 'Inflation Calculator',
    h1: 'Inflation calculator (US CPI, 1913 to today)',
    description:
      'Compare purchasing power between any two years using the official CPI-U series from 1913, or project prices forward at a custom inflation rate.',
    keywords: [
      'purchasing power calculator',
      'cpi calculator',
      'value of money over time',
      'historical inflation',
      'cost of living calculator',
      'dollar value calculator',
    ],
    category: 'finance',
    icon: 'Coins',
    faqs: [
      {
        q: 'Where does the CPI data come from?',
        a: 'It is the annual average CPI-U series of the US Bureau of Labor Statistics: Consumer Price Index for All Urban Consumers, US city average, all items, index base 1982-84 = 100. The table is in the page, so nothing is fetched at runtime.',
      },
      {
        q: 'How is the equivalent value calculated?',
        a: 'Value = amount × CPI(to year) ÷ CPI(from year). That rebases the amount from one year’s price level to another. The same ratio gives cumulative inflation and, taken to the power of one over the number of years, the average annual rate.',
      },
      {
        q: 'Why does this not match my own experience of prices?',
        a: 'CPI-U tracks a fixed basket for the average urban US household. If your spending is weighted towards housing, healthcare, childcare or tuition, your personal inflation rate has been higher than the headline figure for most of the last two decades.',
      },
      {
        q: 'Can I use it for other countries?',
        a: 'The CPI table is US-only. Switch to custom rate mode and enter your own country’s average inflation rate to run the same maths on any currency.',
      },
      {
        q: 'How current is the data?',
        a: 'Annual averages are included through the most recent complete year. The table is refreshed each month from the BLS.',
      },
    ],
    related: ['compound-interest-calculator', 'retirement-calculator', 'salary-calculator', 'savings-goal-calculator'],
    updated: '2026-11-01',
  },
  {
    slug: 'salary-calculator',
    title: 'Salary Calculator',
    h1: 'Salary calculator: hourly to annual and back',
    description:
      'Salary calculator: convert pay between hourly, daily, weekly, bi-weekly, monthly and annual, adjust for holidays and leave, and see what a raise is worth.',
    keywords: [
      'hourly to salary calculator',
      'annual salary calculator',
      'wage converter',
      'pay raise calculator',
      'hourly rate calculator',
      'salary to hourly',
    ],
    category: 'finance',
    icon: 'Briefcase',
    faqs: [
      {
        q: 'How do I convert an hourly rate to an annual salary?',
        a: 'Multiply the hourly rate by the hours you work each week and then by the weeks you work each year. 40 hours over 52 weeks is 2,080 hours, so $30 an hour is $62,400 a year. The calculator shows this and all the other conversions together.',
      },
      {
        q: 'What does the adjusted column mean?',
        a: 'It treats public holidays and vacation days as unpaid. For an hourly worker with 10 holidays and 15 leave days, that removes five weeks of pay from the year. This gives a fair comparison with a salaried offer that includes paid leave.',
      },
      {
        q: 'Why do bi-weekly and semi-monthly pay differ?',
        a: 'Bi-weekly means 26 pay dates a year and semi-monthly means 24, so the two amounts differ even for identical annual pay. Some years contain 27 bi-weekly pay dates, which is why payslips occasionally disagree with an annual figure divided by 26.',
      },
      {
        q: 'Are these figures before or after tax?',
        a: 'Before. All figures are gross pay. Income tax, social security or national insurance, pension contributions and health premiums come out afterwards, and the rates depend on where you live.',
      },
    ],
    related: ['compound-interest-calculator', 'inflation-calculator', 'savings-goal-calculator', 'retirement-calculator', 'break-even-calculator'],
    updated: '2026-11-01',
  },
  {
    slug: 'break-even-calculator',
    title: 'Break-Even Calculator',
    h1: 'Break-even point calculator',
    description:
      'Break-even calculator: find the units and revenue that cover your costs, with contribution margin, margin of safety and a cost and revenue chart.',
    keywords: [
      'break even point',
      'contribution margin calculator',
      'break even analysis',
      'fixed and variable costs',
      'margin of safety',
      'break even units',
    ],
    category: 'finance',
    icon: 'Scale',
    faqs: [
      {
        q: 'What is the break-even formula?',
        a: 'Break-even units = fixed costs ÷ contribution margin, where contribution margin is the selling price minus the variable cost per unit. Break-even revenue is the same fixed costs divided by the contribution margin ratio.',
      },
      {
        q: 'Which costs are fixed and which are variable?',
        a: 'Fixed costs do not change with volume: rent, salaried staff, software, insurance. Variable costs scale with each unit: materials, packaging, shipping, payment processing, per-unit labour. Anything that steps up occasionally, like a second shift, is semi-fixed. Treat it as fixed inside the range you analyse.',
      },
      {
        q: 'What is the margin of safety?',
        a: 'The gap between the sales you expect and the sales you need. A 30% margin of safety means revenue can fall by nearly a third before you start to lose money. It is a more useful risk measure than the break-even point alone.',
      },
      {
        q: 'What if I sell several products?',
        a: 'Use a weighted average selling price and variable cost based on your expected sales mix, or run each product line separately and allocate the fixed costs between them. A single-product model breaks down if the mix shifts.',
      },
    ],
    related: ['roi-calculator', 'loan-calculator', 'salary-calculator', 'percentage-calculator'],
    updated: '2026-11-01',
  },
]
