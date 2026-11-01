import type { Tool } from './types'

/**
 * Round-2 batch `calc-money` — finance, work and home calculators.
 *
 * Ten tools plus ten sibling URLs. Every entry has its own description, FAQs
 * and related rail; the pages that share a React island differ in copy, H1 and
 * reference content.
 */
export const tools: Tool[] = [
  /* ───────────────────────────── finance ───────────────────────────── */
  {
    slug: 'amortization-schedule-calculator',
    title: 'Amortization Schedule Calculator',
    h1: 'Amortization schedule calculator',
    description:
      'Build a full month-by-month amortization schedule with extra payments and lump sums, then export it to CSV, Excel or PDF.',
    keywords: [
      'loan amortization table',
      'amortization calculator with extra payments',
      'mortgage amortization schedule',
      'loan payoff schedule',
      'principal and interest breakdown',
    ],
    category: 'finance',
    icon: 'TableProperties',
    popular: true,
    faqs: [
      {
        q: 'What is an amortization schedule?',
        a: 'It is the payment-by-payment plan for a loan: how much of each instalment goes to interest, how much reduces the balance, and what is still owed afterwards. Early payments are mostly interest because interest is charged on whatever you still owe.',
      },
      {
        q: 'How much interest do extra payments save?',
        a: 'Each extra unit of principal cancels all the future interest that unit would have carried. On a 30-year loan at 6.25%, an extra 200 a month usually removes several years and tens of thousands in interest. Enter your own numbers above to see the saving next to the schedule.',
      },
      {
        q: 'Why does the last payment differ from the others?',
        a: 'The level payment is rounded to the cent, which leaves a small remainder after the final scheduled instalment. Lenders add it to the last payment and do not add an extra month. This calculator does the same.',
      },
      {
        q: 'Can I export the schedule?',
        a: 'Yes, as CSV, Excel (.xlsx) or PDF. Your browser makes each file.',
      },
      {
        q: 'Does this work for car loans and personal loans?',
        a: 'Yes. Any fixed-rate instalment loan with equal monthly payments amortises the same way. Mortgages, car finance, student loans and personal loans all use this formula.',
      },
    ],
    related: [
      'mortgage-calculator',
      'loan-calculator',
      'car-loan-calculator',
      'house-affordability-calculator',
      'credit-card-payoff-calculator',
      'debt-payoff-calculator',
    ],
    updated: '2026-11-01',
  },
  {
    slug: 'house-affordability-calculator',
    title: 'Home Affordability Calculator',
    h1: 'How much house can I afford?',
    description:
      'Home affordability calculator: find the highest home price your income supports under the 28/36 DTI rule, with property tax, insurance, HOA and PMI.',
    keywords: [
      'how much house can i afford',
      'home affordability',
      'debt to income ratio calculator',
      'mortgage affordability',
      'dti calculator',
    ],
    category: 'finance',
    icon: 'House',
    faqs: [
      {
        q: 'What is the 28/36 rule?',
        a: 'It is a lender benchmark. Housing costs stay under 28% of gross monthly income (the front-end ratio) and total debt payments under 36% (the back-end ratio). The calculator checks both and shows which one limits your budget.',
      },
      {
        q: 'Does this include property tax and insurance?',
        a: 'Yes. The monthly figure is full PITI plus HOA fees, and PMI when the loan-to-value ratio is above 80%. A lender tests this full figure against your income.',
      },
      {
        q: 'Is my income sent anywhere?',
        a: 'No. The arithmetic runs in your browser. The page has no server and no lead form.',
      },
      {
        q: 'Why does the answer drop so much when I add debts?',
        a: 'Card and car payments come out of the same 36% back-end allowance as your mortgage. Every 100 of monthly debt removes about 15,000–20,000 of borrowing power at current rates.',
      },
      {
        q: 'Should I borrow the maximum?',
        a: 'Usually not. The maximum a lender approves is an upper limit. It ignores childcare, commuting, maintenance, and property tax and insurance that rise every year. Many buyers use a 25/33 rule instead.',
      },
    ],
    related: [
      'mortgage-calculator',
      'amortization-schedule-calculator',
      'budget-calculator',
      'debt-payoff-calculator',
      'savings-goal-calculator',
      'loan-calculator',
    ],
    updated: '2026-11-01',
  },
  {
    slug: 'credit-card-payoff-calculator',
    title: 'Credit Card Payoff Calculator',
    h1: 'Credit card payoff calculator',
    description:
      'Credit card payoff calculator: see how many months your balance takes to clear and the interest it costs, and compare it with paying only the minimum.',
    keywords: [
      'credit card interest calculator',
      'how long to pay off credit card',
      'minimum payment calculator',
      'card payoff plan',
      'apr calculator',
    ],
    category: 'finance',
    icon: 'CreditCard',
    faqs: [
      {
        q: 'How is credit card interest calculated?',
        a: 'The APR divided by twelve gives a monthly periodic rate, which applies to the balance you carry into the month. A 22.9% APR is 1.908% a month. On a 6,400 balance that is 122 of interest before any of the payment reduces the debt.',
      },
      {
        q: 'Why does the minimum payment take so long?',
        a: 'The minimum is recalculated from the falling balance every month, so it shrinks as the debt shrinks. A minimum of 2% of the balance on a card that charges nearly 2% a month is only a little more than the interest. Minimum-only payoff can take decades.',
      },
      {
        q: 'What payment do I need to be debt-free by a certain date?',
        a: 'Switch the calculator to "payment from a deadline" and enter the number of months. It solves the annuity formula for the monthly payment and then checks it against the month-by-month simulation.',
      },
      {
        q: 'Does paying in full every month avoid interest?',
        a: 'On purchases, yes. Because of the grace period, a statement paid in full has no interest charge. Cash advances and balance transfers usually have no grace period and charge interest from the first day.',
      },
      {
        q: 'Is my balance stored anywhere?',
        a: 'No. The calculation runs in this tab and there is no account. Nothing is written to disk unless you download the plan.',
      },
    ],
    related: [
      'debt-payoff-calculator',
      'amortization-schedule-calculator',
      'budget-calculator',
      'loan-calculator',
      'simple-interest-calculator',
      'compound-interest-calculator',
    ],
    updated: '2026-11-01',
  },
  {
    slug: 'debt-payoff-calculator',
    title: 'Debt Snowball vs Avalanche',
    h1: 'Debt payoff calculator: snowball vs avalanche',
    description:
      'Debt payoff calculator: compare the snowball and avalanche methods for all your debts, with payoff order, monthly plan, interest paid and time saved.',
    keywords: [
      'debt snowball calculator',
      'debt avalanche calculator',
      'debt payoff plan',
      'pay off debt faster',
      'multiple debt calculator',
    ],
    category: 'finance',
    icon: 'Snowflake',
    faqs: [
      {
        q: 'What is the difference between snowball and avalanche?',
        a: 'Snowball pays off the smallest balance first, for an early win that keeps you motivated. Avalanche pays off the highest APR first, which always costs less in interest. Both pay the minimum on all other debts and move each cleared minimum to the next debt.',
      },
      {
        q: 'Which one should I use?',
        a: 'Avalanche costs less, and this page shows how much less for your debts. Snowball works better for people who need an early win to keep going. If the difference is small, pick the method you will finish.',
      },
      {
        q: 'What is the rollover?',
        a: 'When a debt clears, its minimum payment does not go back into your spending. It goes to the next debt in the order, so the payment on each next debt grows. This is the "snowball" effect, and avalanche uses it too.',
      },
      {
        q: 'Does this save my debts?',
        a: 'Only if you turn on the save switch, which is off by default. Saving writes to local storage in this browser only, and a delete button is next to the switch. Nothing is uploaded.',
      },
      {
        q: 'Should I include my mortgage?',
        a: 'Usually not. A payoff plan is for high-rate consumer debt. A low-rate mortgage in the same list dominates the avalanche order and distorts the plan. Model the mortgage separately with the amortization schedule.',
      },
    ],
    related: [
      'credit-card-payoff-calculator',
      'amortization-schedule-calculator',
      'budget-calculator',
      'loan-calculator',
      'house-affordability-calculator',
      'savings-goal-calculator',
    ],
    updated: '2026-11-01',
  },
  {
    slug: 'budget-calculator',
    title: '50/30/20 Budget Calculator',
    h1: '50/30/20 budget calculator',
    description:
      '50/30/20 budget calculator: split your take-home pay into needs, wants and savings, add your own line items and see the variance from each target.',
    keywords: [
      '50 30 20 rule',
      'monthly budget planner',
      'budget percentage calculator',
      'take home pay budget',
      'needs wants savings',
    ],
    category: 'finance',
    icon: 'PiggyBank',
    faqs: [
      {
        q: 'What is the 50/30/20 rule?',
        a: 'Half of your take-home pay goes to needs, 30% to wants and 20% to savings and extra debt payments. It comes from the book All Your Worth by Elizabeth Warren and Amelia Warren Tyagi. The split is coarse, so it is easy to keep to.',
      },
      {
        q: 'Is it based on gross or net income?',
        a: 'Net: the money that arrives in your account after tax and payroll deductions. If you apply the percentages to gross salary, each target is too high by about your average tax rate.',
      },
      {
        q: 'What counts as a need rather than a want?',
        a: 'Anything you would still have to pay in a bad month: rent or mortgage, utilities, groceries, transport to work, insurance and the minimum payment on every debt. Anything above the minimum on a debt counts as savings, because it reduces future interest.',
      },
      {
        q: 'My rent is more than 50% of my pay. Is the rule useless?',
        a: 'No, but change the split. Use the 60/20/20 preset for a high-rent city. The gap shows how much housing takes from everything else.',
      },
      {
        q: 'Is my budget saved or uploaded?',
        a: 'It is not uploaded. Line items are stored only if you turn on the save switch, and then only in this browser. A delete button is next to the switch.',
      },
    ],
    related: [
      'hourly-to-salary-calculator',
      'debt-payoff-calculator',
      'savings-goal-calculator',
      'house-affordability-calculator',
      'salary-calculator',
      'credit-card-payoff-calculator',
    ],
    updated: '2026-11-01',
  },
  {
    slug: 'hourly-to-salary-calculator',
    title: 'Hourly to Salary Calculator',
    h1: 'Hourly to salary calculator',
    description:
      'Hourly to salary calculator: convert an hourly rate to weekly, monthly and annual pay and back, with hours per week, unpaid time off and overtime.',
    keywords: [
      'hourly to annual salary',
      'salary to hourly',
      'yearly income calculator',
      'wage converter',
      'how much is 25 an hour a year',
    ],
    category: 'finance',
    icon: 'Banknote',
    faqs: [
      {
        q: 'How do I convert an hourly rate to an annual salary?',
        a: 'Multiply the hourly rate by hours per week and by the number of paid weeks in the year. At 40 hours and 52 weeks that is 2,080 hours, so 25 an hour is 52,000 a year before tax.',
      },
      {
        q: 'Why is "weekly pay × 4" wrong for a monthly figure?',
        a: 'An average month is 4.33 weeks. Multiplying by four gives a figure about 8% too low. A monthly salary is always the annual figure divided by twelve.',
      },
      {
        q: 'What is the difference between semi-monthly and bi-weekly pay?',
        a: 'Semi-monthly is 24 payments a year (twice a month). Bi-weekly is 26 (every two weeks). The same annual salary gives different cheque amounts, and bi-weekly gives two months a year with three pay dates.',
      },
      {
        q: 'Are these figures before or after tax?',
        a: 'Before. All figures are gross pay. Take-home pay depends on your country, state or province, filing status and deductions. This page does not ask for them.',
      },
      {
        q: 'How should I handle paid holiday?',
        a: 'Leave weeks per year at 52. A salaried employee is paid for all 52 weeks whether or not they work them. Reduce the number only for unpaid weeks, or use the unpaid-days field.',
      },
    ],
    related: [
      'salary-calculator',
      'time-card-calculator',
      'budget-calculator',
      'hours-calculator',
      'decimal-hours-converter',
      'house-affordability-calculator',
    ],
    updated: '2026-11-01',
  },
  {
    slug: 'margin-and-markup-calculator',
    title: 'Margin and Markup Calculator',
    h1: 'Margin and markup calculator',
    description:
      'Margin and markup calculator: solve for cost, price, margin or markup, see both percentages side by side, and price a pasted list of costs.',
    keywords: [
      'margin vs markup',
      'gross margin calculator',
      'markup percentage',
      'selling price calculator',
      'pricing calculator',
    ],
    category: 'finance',
    icon: 'Percent',
    faqs: [
      {
        q: 'What is the difference between margin and markup?',
        a: 'Both measure the same profit against a different base. Margin divides profit by the selling price; markup divides it by the cost. A 50% markup is a 33.3% margin. The two numbers are equal only at zero.',
      },
      {
        q: 'How do I price for a target margin?',
        a: 'Divide the cost by one minus the margin. For a 40% margin on a cost of 30: 30 ÷ 0.60 = 50. Adding 40% to the cost instead gives 42, which is only a 28.6% margin.',
      },
      {
        q: 'Can I price a whole list at once?',
        a: 'Yes. Paste a column of costs, or "name, cost" lines from a spreadsheet, into the bulk panel. Each row gets a price at the margin or markup you set, and you can download the result as CSV.',
      },
      {
        q: 'Is this gross or net margin?',
        a: 'Gross, based on the cost of the goods only. Overheads, shipping, payment fees, returns and tax all come out of the gross profit before anything reaches the bottom line.',
      },
      {
        q: 'Do my cost prices leave my device?',
        a: 'No. The arithmetic runs in your browser, and this page has no server to send your supplier costs to.',
      },
    ],
    related: [
      'profit-margin-calculator',
      'markup-calculator',
      'break-even-calculator',
      'vat-calculator',
      'discount-calculator',
      'percentage-calculator',
    ],
    updated: '2026-11-01',
  },
  {
    slug: 'profit-margin-calculator',
    title: 'Profit Margin Calculator',
    h1: 'Profit margin calculator',
    description:
      'Calculate gross profit margin from cost and selling price, or find the price that hits a target margin, with the working shown.',
    keywords: [
      'gross profit margin',
      'margin percentage calculator',
      'profit calculator',
      'net margin',
      'margin formula',
    ],
    category: 'finance',
    icon: 'ChartColumn',
    faqs: [
      {
        q: 'What is the profit margin formula?',
        a: 'Margin % = (selling price − cost) ÷ selling price × 100. The denominator is the price, which is what separates margin from markup and caps it below 100%.',
      },
      {
        q: 'What is a good profit margin?',
        a: 'It depends on the sector. Grocery retail has single-digit gross margins, hospitality about 60–70% on drinks, and software 80% or more. Compare your margin with your own sector and your own trend.',
      },
      {
        q: 'Why can a margin never reach 100%?',
        a: 'Because profit is a share of the price and the cost has to fit inside the same price. A 100% margin would mean the goods cost you nothing. Markup has no such ceiling.',
      },
      {
        q: 'Is this gross margin or net margin?',
        a: 'Gross margin: revenue minus the direct cost of the goods. Net margin also subtracts overheads, salaries, marketing, interest and tax. It is calculated for a whole business, and gross margin can be for a single line.',
      },
    ],
    related: [
      'margin-and-markup-calculator',
      'markup-calculator',
      'break-even-calculator',
      'roi-calculator',
      'percentage-calculator',
      'vat-calculator',
    ],
    updated: '2026-11-01',
  },
  {
    slug: 'markup-calculator',
    title: 'Markup Calculator',
    h1: 'Markup calculator',
    description:
      'Markup calculator: apply a markup percentage to a cost to get the selling price, and see the gross margin that the markup gives.',
    keywords: [
      'markup percentage calculator',
      'cost plus pricing',
      'markup formula',
      'wholesale to retail price',
      'keystone markup',
    ],
    category: 'finance',
    icon: 'Tags',
    faqs: [
      {
        q: 'What is the markup formula?',
        a: 'Markup % = (price − cost) ÷ cost × 100, and price = cost × (1 + markup). A 100% markup ("keystone" pricing in retail) doubles the cost and gives a 50% margin.',
      },
      {
        q: 'What markup do I need for a given margin?',
        a: 'Markup = margin ÷ (1 − margin). For a 40% margin you need a 66.7% markup; for 50% you need 100%. The conversion table on this page lists the common pairs.',
      },
      {
        q: 'Is markup the same as profit?',
        a: 'No. Markup is a percentage of the cost; profit is the cash difference between price and cost. The same profit is a different markup on a cheap item than on an expensive one.',
      },
      {
        q: 'Can I mark up a whole price list at once?',
        a: 'Yes. Paste your costs into the bulk panel. Each line gets a price, and its margin shows next to it.',
      },
    ],
    related: [
      'margin-and-markup-calculator',
      'profit-margin-calculator',
      'sales-tax-calculator',
      'vat-calculator',
      'discount-calculator',
      'break-even-calculator',
    ],
    updated: '2026-11-01',
  },
  {
    slug: 'vat-calculator',
    title: 'VAT Calculator',
    h1: 'VAT calculator: add or remove VAT',
    description:
      'Add or remove VAT at any rate, with UK, Irish and EU presets, reverse VAT, and a multi-line invoice totalling net, VAT and gross.',
    keywords: [
      'add vat',
      'remove vat',
      'reverse vat calculator',
      'uk vat 20 percent',
      'vat inclusive price',
    ],
    category: 'finance',
    icon: 'ReceiptText',
    faqs: [
      {
        q: 'How do I remove VAT from a price?',
        a: 'Divide by 1 plus the rate. For UK 20%, divide the gross figure by 1.2. A common mistake is to subtract 20% from the gross price: that takes 20% of the larger number and gives a net figure that is too low.',
      },
      {
        q: 'What is the VAT fraction?',
        a: 'The share of a gross amount that is tax: rate ÷ (100 + rate). At 20% that is 20/120 = 1/6, so a sixth of any VAT-inclusive price at the standard UK rate is VAT.',
      },
      {
        q: 'Are the country rates kept up to date?',
        a: 'They are static data in the page, with the date they were checked, because this site makes no network requests. They do not change without notice. Confirm the current rate with your tax authority before you file.',
      },
      {
        q: 'Can I do a whole invoice?',
        a: 'Yes. The multi-line panel takes any number of lines, each with its own rate. It rounds each line separately, as accounting software does, and exports the invoice to CSV, Excel or PDF.',
      },
      {
        q: 'Should I calculate margin before or after VAT?',
        a: 'Always on the net, VAT-exclusive figure. VAT is collected on behalf of the tax authority and is never part of your revenue or your margin.',
      },
    ],
    related: [
      'gst-calculator',
      'sales-tax-calculator',
      'margin-and-markup-calculator',
      'discount-calculator',
      'percentage-calculator',
      'markup-calculator',
    ],
    updated: '2026-11-01',
  },
  {
    slug: 'gst-calculator',
    title: 'GST Calculator',
    h1: 'GST calculator: add or remove GST',
    description:
      'Add or remove GST at Australian, New Zealand, Indian, Singaporean and Canadian rates, with a multi-line invoice and export.',
    keywords: [
      'gst calculator australia',
      'gst inclusive price',
      'nz gst 15',
      'india gst 18 percent',
      'hst calculator',
    ],
    category: 'finance',
    icon: 'Receipt',
    faqs: [
      {
        q: 'How do I work out GST from a GST-inclusive price?',
        a: 'For Australia’s 10% GST, divide the total by 11 to get the GST and by 1.1 to get the ex-GST price. For New Zealand’s 15%, divide by 7.6667 and 1.15 respectively. The calculator does it for any rate.',
      },
      {
        q: 'Which Indian GST rate applies?',
        a: 'Since 22 September 2025 India has two main slabs, 5% and 18%, plus 40% for luxury and sin goods, set per category by the GST Council. All three are presets; pick the slab your HSN or SAC code falls into.',
      },
      {
        q: 'How does Canadian GST, HST and PST work?',
        a: 'Some provinces charge 5% federal GST alone, some add a separate provincial PST, and others use a combined HST: 13% in Ontario, 14% in Nova Scotia and 15% in the other Atlantic provinces. GST and HST presets are included; for a province with separate PST, enter the two taxes as two lines.',
      },
      {
        q: 'Is GST the same as VAT?',
        a: 'In structure, yes. Both are broad-based consumption taxes collected at each stage, with credit for tax already paid. The name and the rules differ by country. The arithmetic is the same.',
      },
      {
        q: 'Are these rates fetched live?',
        a: 'No. This site never makes a network request. Rates are stored in the page with the date they were checked, and you can always type your own.',
      },
    ],
    related: [
      'vat-calculator',
      'sales-tax-calculator',
      'markup-calculator',
      'margin-and-markup-calculator',
      'discount-calculator',
      'percentage-calculator',
    ],
    updated: '2026-11-01',
  },

  /* ───────────────────────────── datetime ───────────────────────────── */
  {
    slug: 'time-card-calculator',
    title: 'Time Card Calculator',
    h1: 'Time card calculator',
    description:
      'Time card calculator: add up a week of clock-in and clock-out times with unpaid breaks, overtime rules and a pay rate, then print or export it.',
    keywords: [
      'timesheet calculator',
      'weekly time card',
      'work hours calculator with breaks',
      'overtime calculator',
      'punch clock calculator',
    ],
    category: 'datetime',
    icon: 'AlarmClock',
    popular: true,
    faqs: [
      {
        q: 'How do I enter times?',
        a: 'Type them in any common form: 9, 9:00, 0900, 9am and 09:00 all give the same time. There is no dropdown and no fixed format.',
      },
      {
        q: 'Does it handle overnight shifts?',
        a: 'Yes. If the out time is at or before the in time, the calculator adds 24 hours and marks the row as crossing midnight. 22:00 to 06:00 is eight hours.',
      },
      {
        q: 'How is overtime calculated?',
        a: 'Daily and weekly rules are available, separately or together. Daily overtime applies to hours above a per-day threshold. Weekly overtime applies to the remaining hours above a weekly threshold. No hour is paid at the overtime rate twice.',
      },
      {
        q: 'Will a refresh wipe my week?',
        a: 'Yes, if saving is off, which is the default. Turn on the switch and the week is kept in local storage in this browser. A delete button is next to the switch.',
      },
      {
        q: 'Can I print the time card for a signature?',
        a: 'Yes. The print button gives a printable card without the input controls. You can also export CSV, Excel and PDF.',
      },
    ],
    related: [
      'hours-calculator',
      'decimal-hours-converter',
      'military-time-converter',
      'hourly-to-salary-calculator',
      'time-duration-calculator',
      'salary-calculator',
    ],
    updated: '2026-11-01',
  },
  {
    slug: 'hours-calculator',
    title: 'Hours Calculator',
    h1: 'Hours calculator: time between two times',
    description:
      'Hours calculator: work out the hours between start and end times, add as many entries as you need, and get the total in h:mm and decimal hours.',
    keywords: [
      'hours between two times',
      'time duration calculator',
      'add up hours and minutes',
      'work hours calculator',
      'hours worked',
    ],
    category: 'datetime',
    icon: 'Clock',
    faqs: [
      {
        q: 'How many hours is 9:15 to 17:40?',
        a: 'Eight hours and twenty-five minutes, or 8.42 in decimal hours. Enter the two times above and both formats appear together, along with the total in minutes.',
      },
      {
        q: 'Can I add up several sessions?',
        a: 'Yes. Add a row for each session and give it a label. The totals add up across all rows.',
      },
      {
        q: 'Does it subtract lunch breaks?',
        a: 'Each entry has an unpaid break field in minutes, which is deducted from that entry before it is added to the total. Paid breaks should be left at zero.',
      },
      {
        q: 'What is the difference between 8:30 and 8.30?',
        a: '8:30 is eight hours thirty minutes. 8.30 is eight and three-tenths of an hour (8 hours 18 minutes), twelve minutes less. Payroll uses the decimal form and a clock shows the other. This page shows both for each entry.',
      },
    ],
    related: [
      'time-card-calculator',
      'decimal-hours-converter',
      'time-duration-calculator',
      'military-time-converter',
      'hourly-to-salary-calculator',
      'age-calculator',
    ],
    updated: '2026-11-01',
  },
  {
    slug: 'decimal-hours-converter',
    title: 'Decimal Hours Converter',
    h1: 'Decimal hours converter',
    description:
      'Convert hours and minutes to decimal hours and back, with payroll rounding and a whole pasted column converted at once.',
    keywords: [
      'minutes to decimal hours',
      'hours and minutes to decimal',
      'payroll time conversion',
      'time to decimal chart',
      'decimal to hours minutes',
    ],
    category: 'datetime',
    icon: 'Timer',
    faqs: [
      {
        q: 'How do I convert minutes to decimal hours?',
        a: 'Divide the minutes by sixty. Fifteen minutes is 0.25, twenty is 0.333, forty-five is 0.75. The reference table on this page lists every five-minute step to four decimal places.',
      },
      {
        q: 'Why does payroll want decimal hours?',
        a: 'Pay is hours multiplied by a rate, and you cannot multiply by 7:45. Payroll systems store 7.75. If you write 7.45 instead, you lose eighteen minutes of pay per shift.',
      },
      {
        q: 'What is quarter-hour rounding?',
        a: 'It rounds each entry to the nearest 0.25 of an hour, a common payroll convention. It must round to the nearest increment in both directions. Always rounding down is unlawful in several jurisdictions, including under the US FLSA.',
      },
      {
        q: 'Can I convert a whole column from a spreadsheet?',
        a: 'Yes. Paste it into the bulk panel: any line containing a colon is read as h:mm and converted to decimal, any bare number is read as decimal and converted to h:mm, and the results copy back out as a column.',
      },
    ],
    related: [
      'time-card-calculator',
      'hours-calculator',
      'military-time-converter',
      'time-converter',
      'hourly-to-salary-calculator',
      'time-duration-calculator',
    ],
    updated: '2026-11-01',
  },
  {
    slug: 'military-time-converter',
    title: 'Military Time Converter',
    h1: 'Military time converter',
    description:
      'Convert 24-hour military time to 12-hour AM/PM and back, with a full clock reference chart and bulk list conversion.',
    keywords: [
      'military time chart',
      '24 hour clock converter',
      'army time',
      '1400 in military time',
      'am pm to 24 hour',
    ],
    category: 'datetime',
    icon: 'Clock',
    faqs: [
      {
        q: 'What is 1400 in normal time?',
        a: '2:00 PM. From 1300 onwards, subtract twelve to get the PM hour; before 1200, the numbers are the same as the AM clock with a leading zero.',
      },
      {
        q: 'Is midnight 0000 or 2400?',
        a: 'Both notations exist for the same instant. 0000 starts a day and 2400 ends the previous one. Written schedules usually use 0000 for a start time and 2359 for an end time to avoid confusion.',
      },
      {
        q: 'Is military time the same as the 24-hour clock?',
        a: 'The numbers are identical. Military usage drops the colon (1430), reads whole hours as "hundred", and often appends a time-zone letter such as Z for UTC or J for local time.',
      },
      {
        q: 'Why is 12 PM noon and 12 AM midnight?',
        a: 'AM and PM mean before and after midday, and midday itself belongs to neither. The convention is arbitrary and causes confusion. This is why hospitals, airlines and the military use the 24-hour clock.',
      },
      {
        q: 'Can I convert a list of times at once?',
        a: 'Yes. Paste a column and each line is converted in the opposite direction to the way it was written, so a mixed list comes back consistent.',
      },
    ],
    related: [
      'time-card-calculator',
      'decimal-hours-converter',
      'hours-calculator',
      'timezone-converter',
      'unix-timestamp-converter',
      'time-converter',
    ],
    updated: '2026-11-01',
  },

  /* ───────────────────────────── everyday ───────────────────────────── */
  {
    slug: 'square-footage-calculator',
    title: 'Square Footage Calculator',
    h1: 'Square footage calculator',
    description:
      'Square footage calculator for several rooms at once, in feet, inches or metres, with a waste allowance, a cost per square foot and list export.',
    keywords: [
      'sq ft calculator',
      'room area calculator',
      'square meters to square feet',
      'floor area calculator',
      'multi room square footage',
    ],
    category: 'everyday',
    icon: 'Ruler',
    faqs: [
      {
        q: 'How do I calculate square footage?',
        a: 'Multiply length by width in feet. A 12 by 14 foot room is 168 square feet. Irregular spaces are easier as two rectangles than one complicated shape, and this page adds up as many rows as you need.',
      },
      {
        q: 'Can I measure in metres or inches?',
        a: 'Yes. Pick the unit once and it applies to every field. Any field also accepts feet-and-inches notation such as 12\' 6", whatever the selector says. Each total shows in square feet, square metres and square yards.',
      },
      {
        q: 'How do I handle an L-shaped room?',
        a: 'Use the L-shape option: enter the full rectangle it would occupy, then the length and width of the missing corner. The cut-out is subtracted automatically.',
      },
      {
        q: 'What waste allowance should I add?',
        a: 'Between 5% and 10% for most materials, and 15% for diagonal tile layouts or rooms with many angles. It covers off-cuts, breakages and the piece you measure wrong.',
      },
      {
        q: 'Is my room list saved?',
        a: 'Only if you turn on the save switch, and then only in this browser. The calculator also works offline.',
      },
    ],
    related: [
      'flooring-calculator',
      'paint-calculator',
      'tile-calculator',
      'concrete-calculator',
      'area-converter',
      'length-converter',
    ],
    updated: '2026-11-01',
  },
  {
    slug: 'paint-calculator',
    title: 'Paint Calculator',
    h1: 'Paint calculator: how much paint do I need?',
    description:
      'Work out how much paint a room needs from wall dimensions, coats and coverage, with doors and windows deducted automatically.',
    keywords: [
      'how much paint do i need',
      'paint coverage calculator',
      'wall paint quantity',
      'litres of paint per room',
      'paint estimator',
    ],
    category: 'everyday',
    icon: 'PaintRoller',
    faqs: [
      {
        q: 'How much wall does a gallon of paint cover?',
        a: 'About 350 square feet on a smooth, previously painted surface, or about 10 square metres per litre. Bare drywall, textured render and a large colour change all use more paint, so set a lower coverage figure for those.',
      },
      {
        q: 'How many coats do I need?',
        a: 'Two is standard. One coat only works when repainting the same colour on a sound surface; covering a dark colour with a light one, or painting bare plaster, often needs a primer plus two topcoats.',
      },
      {
        q: 'Does this deduct doors and windows?',
        a: 'Yes. Each door is deducted at 21 square feet (3 × 7 ft) and each window at 15 square feet (3 × 5 ft). Set the counts to zero if you would rather buy on the gross wall area.',
      },
      {
        q: 'How is the wall area worked out from room dimensions?',
        a: 'Perimeter times height: 2 × (length + width) × wall height. A 14 by 12 foot room with 8 foot ceilings has 416 square feet of wall before openings are deducted.',
      },
      {
        q: 'Should I round up?',
        a: 'Yes. The calculator rounds up to whole cans because paint is sold that way. If a batch-matched colour runs out in the middle of a wall, the fix is expensive.',
      },
    ],
    related: [
      'square-footage-calculator',
      'tile-calculator',
      'flooring-calculator',
      'concrete-calculator',
      'area-converter',
      'volume-converter',
    ],
    updated: '2026-11-01',
  },
  {
    slug: 'tile-calculator',
    title: 'Tile Calculator',
    h1: 'Tile calculator: how many tiles do I need?',
    description:
      'Tile calculator: turn floor and wall measurements into the number of tiles and boxes to buy, with grout joints and cutting waste included.',
    keywords: [
      'how many tiles do i need',
      'tile quantity calculator',
      'floor tile calculator',
      'tiles per square metre',
      'grout joint calculator',
    ],
    category: 'everyday',
    icon: 'Grid3x3',
    faqs: [
      {
        q: 'How many tiles do I need per square foot?',
        a: 'Divide by the tile’s area including its grout joint. A 12 × 12 inch tile with a 1/8 inch joint effectively covers 12.125 × 12.125 inches, or 1.02 square feet. A hundred square feet needs about 98 tiles before waste.',
      },
      {
        q: 'Does the grout joint really matter?',
        a: 'For small mosaic tiles, yes. A 1/8 inch joint around a 2 inch tile is over 12% of the area. For large-format tiles the effect is small, but it can still change the box count by one, and that is where you run out.',
      },
      {
        q: 'How much extra should I buy?',
        a: 'Ten per cent for a straight grid layout, fifteen for diagonal or herringbone, and more for a room with many angles or niches. Buy the extra tiles in the same batch, because the colour can differ visibly between production runs.',
      },
      {
        q: 'Can I mix floors and walls in one job?',
        a: 'Yes. Add a row per surface, use the wall shape for vertical areas, and set a quantity for repeated identical walls. The totals cover the whole job.',
      },
    ],
    related: [
      'square-footage-calculator',
      'flooring-calculator',
      'paint-calculator',
      'concrete-calculator',
      'area-converter',
      'length-converter',
    ],
    updated: '2026-11-01',
  },
  {
    slug: 'flooring-calculator',
    title: 'Flooring Calculator',
    h1: 'Flooring calculator',
    description:
      'Convert room measurements into the number of flooring boxes to buy, including a waste allowance and the total material cost.',
    keywords: [
      'flooring square footage',
      'how many boxes of laminate',
      'vinyl plank calculator',
      'hardwood flooring estimator',
      'flooring cost calculator',
    ],
    category: 'everyday',
    icon: 'Layers',
    faqs: [
      {
        q: 'How many boxes of flooring do I need?',
        a: 'Divide the room area plus waste by the coverage printed on the carton, then round up. A 300 square foot room at 10% waste needs 330 square feet, which is 17 boxes at 20 square feet each.',
      },
      {
        q: 'Why is coverage per box different for every product?',
        a: 'Plank size and pieces per pack vary by product range. Read the coverage on the carton. It is usually on the end label, in square feet and square metres.',
      },
      {
        q: 'How much waste should I allow for planks?',
        a: 'Ten per cent for a simple rectangular room laid straight, fifteen for diagonal layouts, long narrow rooms, or anywhere with lots of doorways and cuts. Keep a few spare planks after the job for repairs.',
      },
      {
        q: 'Do I measure under the skirting?',
        a: 'Measure the full floor to the wall face and add the expansion gap on top of your waste allowance. Flooring runs under the skirting or behind beading, so the visible floor is slightly smaller than what you buy.',
      },
    ],
    related: [
      'square-footage-calculator',
      'tile-calculator',
      'paint-calculator',
      'concrete-calculator',
      'area-converter',
      'length-converter',
    ],
    updated: '2026-11-01',
  },
  {
    slug: 'concrete-calculator',
    title: 'Concrete Calculator',
    h1: 'Concrete calculator',
    description:
      'Work out concrete volume in cubic yards, cubic metres and bags for slabs, footings and post holes, with a waste allowance.',
    keywords: [
      'cubic yards of concrete',
      'concrete slab calculator',
      'how many bags of concrete',
      'post hole concrete',
      'concrete volume calculator',
    ],
    category: 'everyday',
    icon: 'HardHat',
    faqs: [
      {
        q: 'How do I calculate cubic yards of concrete?',
        a: 'Multiply length by width by thickness in feet, then divide by 27. A 20 × 12 foot slab at 4 inches thick is 80 cubic feet, which is 2.96 cubic yards before any waste allowance.',
      },
      {
        q: 'How many bags of concrete are in a cubic yard?',
        a: 'Forty-five 80 lb bags, sixty 60 lb bags, or ninety 40 lb bags. Those bag yields are 0.60, 0.45 and 0.30 cubic feet respectively, and this page rounds up to whole bags.',
      },
      {
        q: 'When should I order ready-mix instead of bags?',
        a: 'At about a cubic yard. Above that, you mix forty-five bags or more by hand, and a truck is cheaper and faster. Most suppliers have a minimum load and a short-load charge.',
      },
      {
        q: 'How much extra should I order?',
        a: 'Five to ten per cent. Sub-base is never perfectly level, forms bulge slightly, and running out mid-pour leaves a cold joint you cannot undo.',
      },
      {
        q: 'Can I mix slabs and post holes in one job?',
        a: 'Yes. Add a slab row for each flat pour and a round column row for each hole, set a quantity for repeated holes, and the volume totals across everything.',
      },
    ],
    related: [
      'square-footage-calculator',
      'flooring-calculator',
      'tile-calculator',
      'paint-calculator',
      'volume-converter',
      'weight-converter',
    ],
    updated: '2026-11-01',
  },
]
