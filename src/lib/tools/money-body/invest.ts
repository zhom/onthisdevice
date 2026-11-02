import type { Tool } from '../types'

const updated = '2026-11-02'

/** Saving, investing and retirement. */
export const tools: Tool[] = [
  {
    slug: 'cd-calculator',
    title: 'CD Calculator',
    h1: 'CD calculator',
    description:
      'CD calculator: find the balance at maturity, the interest and the APY of a certificate of deposit for any rate, term and compounding, with tax.',
    keywords: ['certificate of deposit calculator', 'cd interest calculator', 'cd rate calculator', 'apy calculator', 'cd maturity calculator'],
    category: 'finance',
    icon: 'Vault',
    faqs: [
      { q: 'How much does a 10,000 CD earn in a year?', a: 'At 4.5% compounded daily, a 10,000 CD earns 460.25 in 12 months. The APY is 4.60%. Enter your own rate and term to see your figure.' },
      { q: 'What is the difference between the rate and the APY?', a: 'The rate is the yearly interest before compounding. The APY includes the interest earned on interest during the year, so it is a little higher when interest compounds more than once a year.' },
      { q: 'Does daily compounding make a big difference?', a: 'A small one. At 4.5% for 12 months on 10,000, daily compounding gives 460.25 and monthly compounding gives 459.40.' },
      { q: 'Is the early withdrawal penalty included?', a: 'No. The calculator assumes you keep the CD until it matures. Ask the bank for its penalty, often some months of interest.' },
      { q: 'Are my numbers sent anywhere?', a: 'No. The calculation runs in your browser.' },
    ],
    related: ['compound-interest-calculator', 'savings-goal-calculator', 'apr-calculator', 'simple-interest-calculator'],
    updated,
  },
  {
    slug: '401k-calculator',
    title: '401(k) Calculator',
    h1: '401(k) calculator with employer match',
    description:
      '401k calculator: project your 401(k) balance at retirement from your salary, contribution, employer match, return and the yearly contribution limit.',
    keywords: ['401k retirement calculator', '401k match calculator', '401k growth calculator', 'employer match calculator', '401k contribution calculator'],
    category: 'finance',
    icon: 'BriefcaseBusiness',
    faqs: [
      { q: 'How does the employer match work?', a: 'A match of 50% up to 6% of salary means the employer adds half of what you put in, on the first 6% of your salary. On a 70,000 salary with a 6% contribution, you put in 4,200 and the employer adds 2,100.' },
      { q: 'What is the 401(k) contribution limit for 2026?', a: 'The limit on your own contributions is 24,500 for people under 50. At 50 or older you can add catch-up contributions. Check the IRS figure for your year and enter it in the limit field.' },
      { q: 'What return should I enter?', a: 'Use a long-term yearly return after fees for your mix of funds. The calculator uses the same return every year; real returns change from year to year.' },
      { q: 'Is the balance before or after tax?', a: 'Before tax. Withdrawals from a traditional 401(k) are taxed as income. The balance is also in future money, not adjusted for inflation.' },
      { q: 'Are my numbers sent anywhere?', a: 'No. The projection is calculated in your browser.' },
    ],
    related: ['roth-ira-calculator', 'retirement-calculator', 'compound-interest-calculator', 'salary-calculator'],
    updated,
  },
  {
    slug: 'roth-ira-calculator',
    title: 'Roth IRA Calculator',
    h1: 'Roth IRA calculator',
    description:
      'Roth IRA calculator: see what yearly contributions grow to tax-free by retirement, and how much more that is than an account taxed every year.',
    keywords: ['roth ira growth calculator', 'roth ira contribution calculator', 'roth ira retirement calculator', 'tax-free growth calculator', 'roth vs taxable'],
    category: 'finance',
    icon: 'Sprout',
    faqs: [
      { q: 'How much can I put in a Roth IRA in 2026?', a: 'The limit is 7,500, or 8,600 at age 50 or older. You cannot put in more than you earn in the year, and above an income limit the amount you can contribute goes down to zero.' },
      { q: 'Why does a Roth IRA grow more than a taxable account?', a: 'Its return is not taxed. A taxable account pays tax on dividends and gains, so less money stays invested to grow. At 6% with a 20% tax on the return, the taxable account grows at 4.8%.' },
      { q: 'When can I take the money out tax-free?', a: 'Earnings are tax-free after age 59½ when the account is at least 5 years old. You can take out your own contributions at any time without tax or penalty.' },
      { q: 'Are my numbers sent anywhere?', a: 'No. The calculation runs in your browser.' },
    ],
    related: ['401k-calculator', 'retirement-calculator', 'investment-calculator', 'compound-interest-calculator'],
    updated,
  },
  {
    slug: 'investment-calculator',
    title: 'Investment Calculator',
    h1: 'Investment calculator',
    description:
      'Investment calculator: see what a starting amount and monthly deposits grow to at a fixed return, with the growth and the value in today\'s money.',
    keywords: ['investment growth calculator', 'monthly investment calculator', 'stock market calculator', 'future value of investment', 'investment return calculator'],
    category: 'finance',
    icon: 'ChartArea',
    faqs: [
      { q: 'What does 500 a month grow to in 20 years?', a: 'With 10,000 to start and 7% a year compounded monthly, 500 at the end of each month grows to about 300,851. You put in 130,000; the rest is growth.' },
      { q: 'Does it matter if I deposit at the start or the end of the month?', a: 'Yes, a little. A deposit at the start earns one more month of return. In the example above the balance is 302,370 with deposits at the start of each month.' },
      { q: "What does 'in today's money' mean?", a: 'It is the final balance divided by the inflation over the years. It shows what the balance would buy at today\'s prices.' },
      { q: 'Are my numbers sent anywhere?', a: 'No. The calculation runs in your browser.' },
    ],
    related: ['compound-interest-calculator', 'roi-calculator', 'inflation-calculator', 'dividend-calculator'],
    updated,
  },
  {
    slug: 'dividend-calculator',
    title: 'Dividend Calculator',
    h1: 'Dividend calculator',
    description:
      'Dividend calculator: estimate your yearly and monthly dividend income after tax from the yield, dividend growth and price growth, with or without DRIP.',
    keywords: ['dividend income calculator', 'drip calculator', 'dividend reinvestment calculator', 'dividend yield calculator', 'passive income calculator'],
    category: 'finance',
    icon: 'HandCoins',
    faqs: [
      { q: 'How much dividend income will I get?', a: 'With 10,000 to start, 1,200 added each year, a 4% yield growing 5% a year, 4% price growth, 15% tax and dividends reinvested, the income in year 20 is 3,860.97 after tax, or 321.75 a month.' },
      { q: 'What does reinvesting dividends change?', a: 'Each dividend buys more shares, and those shares pay dividends too. In the example above the income in year 20 is 3,860.97 with reinvesting and 2,316.37 without.' },
      { q: 'What is dividend growth?', a: 'The yearly increase in the dividend each share pays. Many companies raise their dividend over time; some cut it.' },
      { q: 'Are my numbers sent anywhere?', a: 'No. The calculation runs in your browser.' },
    ],
    related: ['investment-calculator', 'compound-interest-calculator', 'roi-calculator', 'cagr-calculator'],
    updated,
  },
  {
    slug: 'rent-vs-buy-calculator',
    title: 'Rent vs Buy Calculator',
    h1: 'Rent vs buy calculator',
    description:
      'Rent vs buy calculator: compare your wealth after buying a home or renting and investing the difference, year by year, with the break-even year.',
    keywords: ['rent or buy calculator', 'buy vs rent calculator', 'should i buy a house', 'renting vs buying a home', 'rent vs own calculator'],
    category: 'finance',
    icon: 'KeyRound',
    faqs: [
      { q: 'How does the calculator decide if buying or renting is better?', a: 'Both start with the same cash. The buyer pays the down payment and closing costs; the renter invests that money. Each month the one who pays less invests the difference. After the years you stay, it compares the home equity after selling plus investments with the renter\'s investments.' },
      { q: 'What is the break-even year?', a: 'The first year at which buying leaves you with more wealth than renting, if you sell then. Before it, the costs of buying and selling a home are not yet paid back.' },
      { q: 'Why can renting come out ahead?', a: 'Buying has costs that build no equity: closing and selling costs, interest, property tax, insurance and maintenance. If you sell after a short stay, the home has not risen enough to pay for them.' },
      { q: 'Are taxes included?', a: 'No. The mortgage interest deduction, tax on the gain from the home and tax on investment returns are left out.' },
      { q: 'Are my numbers sent anywhere?', a: 'No. The calculation runs in your browser.' },
    ],
    related: ['mortgage-calculator', 'house-affordability-calculator', 'down-payment-calculator', 'investment-calculator'],
    updated,
  },
]
