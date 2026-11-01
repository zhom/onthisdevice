import type { Tool } from './types'

export const tools: Tool[] = [
  {
    slug: 'tip-calculator',
    title: 'Tip Calculator',
    h1: 'Tip calculator with bill splitting',
    description:
      'Tip calculator for the tip and the total, with percentage presets, a slider, pre-tax tipping, round-up options and an exact per-person split.',
    keywords: [
      'tip calculator',
      'gratuity calculator',
      'how much to tip',
      'restaurant tip calculator',
      '20 percent tip',
      'tip per person',
    ],
    category: 'everyday',
    icon: 'Receipt',
    popular: true,
    faqs: [
      {
        q: 'Should I tip on the pre-tax or post-tax amount?',
        a: 'Etiquette guides say the pre-tax subtotal, because sales tax is not part of the service. In practice most people tip on the printed total, which on an 8% tax rate costs about 1.6% more on a 20% tip. Switch on "tip on the pre-tax subtotal" and enter your tax rate to do it the strict way.',
      },
      {
        q: 'What is a normal tip in the US?',
        a: '18–20% of the bill is the usual range for table service, 15% for adequate service and 25% for outstanding service. Counter service, takeaway and bars follow different customs, and tipping norms elsewhere in the world are far lower or built into the price.',
      },
      {
        q: 'How does the round-up option work?',
        a: 'Each rounding mode changes the tip, never the bill. "Total up" lifts the total to the next whole unit and gives the difference to the server; "Share up" rounds each person\'s share up so nobody has to hunt for coins. The effective tip percentage is always shown.',
      },
      {
        q: 'How do you split a bill that will not divide evenly?',
        a: 'Cent-exact splitting is impossible for most totals, so the calculator gives the leftover one or two cents to the first people in the list. The shares always add up to the exact total, which is what matters when one person pays the card machine.',
      },
      {
        q: 'Do my figures get sent anywhere?',
        a: 'No. The whole calculator is JavaScript running in your browser. There is no server request, no account and no analytics on the numbers you enter.',
      },
    ],
    related: ['bill-split-calculator', 'percentage-off-calculator', 'sales-tax-calculator', 'percentage-calculator'],
    updated: '2026-11-01',
  },
  {
    slug: 'bill-split-calculator',
    title: 'Bill Split Calculator',
    h1: 'Split a bill evenly or by item',
    description:
      'Split any restaurant bill evenly or item by item, share dishes between people, spread tax and tip proportionally, and see exactly what each person owes.',
    keywords: [
      'split bill calculator',
      'restaurant bill splitter',
      'who owes what',
      'split check by item',
      'group dinner calculator',
      'itemized bill split',
    ],
    category: 'everyday',
    icon: 'Users',
    faqs: [
      {
        q: 'How is tax and tip shared out in itemised mode?',
        a: 'Proportionally. If your food is 30% of the subtotal, you carry 30% of the tax and 30% of the tip. That is the fairest common rule: the person who ordered the steak pays more tax than the person who ordered soup.',
      },
      {
        q: 'Can two or three people share one dish?',
        a: 'Yes. Tap every name that shared it, and the price is divided equally between them. A platter shared by four counts as a quarter each and appears in each of their item lists with a ÷4 marker.',
      },
      {
        q: 'Why do the individual totals sometimes end in odd cents?',
        a: 'A proportional share rarely lands on a whole cent. The tool rounds each person to the nearest cent, then gives the leftover cent or two to whoever had the largest fraction. The personal totals then add up to the bill exactly.',
      },
      {
        q: 'Does it handle a service charge that is already on the bill?',
        a: 'Switch the tax field to "a fixed amount" and enter the service charge there, or set the tip to 0% if the service charge covers it. Any fixed amount you enter is shared in the same proportional way.',
      },
    ],
    related: ['tip-calculator', 'sales-tax-calculator', 'percentage-calculator', 'discount-calculator'],
    updated: '2026-11-01',
  },
  {
    slug: 'discount-calculator',
    title: 'Discount Calculator',
    h1: 'Discount calculator with stacked coupons',
    description:
      'Discount calculator for the sale price, savings and true discount after stacked coupons and tax. Reverse modes find the original price or the % off.',
    keywords: [
      'discount calculator',
      'sale price calculator',
      'stacked discount calculator',
      'original price calculator',
      'markdown calculator',
      'coupon calculator',
    ],
    category: 'everyday',
    icon: 'Tag',
    faqs: [
      {
        q: 'Do stacked discounts add together?',
        a: 'No. 30% off and then a further 20% off is 44% off, not 50%, because the second coupon comes off the reduced price. The step table shows what each coupon removes.',
      },
      {
        q: 'How do I find the original price from what I paid?',
        a: 'Divide by the fraction that remains. Paying $70 after 30% off means the original was 70 ÷ 0.70 = $100. Adding 30% back gives $91, which is wrong. The "Find original" tab does this and can remove sales tax first.',
      },
      {
        q: 'Is sales tax charged before or after the discount?',
        a: 'After, in the US and almost everywhere else. You pay tax on the price you pay, so a coupon reduces the tax as well. The switch lets you model the rarer case where tax is charged on the full ticket price.',
      },
      {
        q: 'Why is the percentage back to the original price bigger than the discount?',
        a: 'The two percentages are measured against different bases. A 20% discount takes 20% off the original, but recovering it needs 25% added to the smaller sale price. The tool shows both figures side by side.',
      },
    ],
    related: ['percentage-off-calculator', 'sales-tax-calculator', 'percentage-calculator', 'tip-calculator'],
    updated: '2026-11-01',
  },
  {
    slug: 'sales-tax-calculator',
    title: 'Sales Tax Calculator',
    h1: 'Sales tax calculator: add or remove tax',
    description:
      'Add sales tax to a price or back it out of a total, using a built-in table of US state rates, an editable local rate, or any VAT or GST rate you enter.',
    keywords: [
      'sales tax calculator',
      'reverse sales tax calculator',
      'vat calculator',
      'state sales tax rates',
      'add tax to price',
      'tax from total',
    ],
    category: 'everyday',
    icon: 'Landmark',
    faqs: [
      {
        q: 'How do I remove sales tax from a total?',
        a: 'Divide, do not subtract. A $108.25 total at 8.25% has a net price of 108.25 ÷ 1.0825 = $100.00, not $99.32. Subtracting 8.25% from the gross is the classic error and always understates the net price.',
      },
      {
        q: 'Are the state rates in the table exact for my address?',
        a: 'They are the state base rates. Most states let counties, cities and special districts add their own tax on top, so the rate charged at a specific address is usually higher. The local field starts with a typical add-on rate. Replace it with the rate on your receipt.',
      },
      {
        q: 'Which states have no sales tax?',
        a: 'Alaska, Delaware, Montana, New Hampshire and Oregon have no state-level sales tax. Alaska and Montana still allow local sales taxes in some places, so a purchase there is not always tax free.',
      },
      {
        q: 'Can I use this for VAT or GST?',
        a: 'Yes. Switch to a custom rate and enter 20 for UK VAT, 19 for German VAT, 5 for Canadian GST and so on. The add and remove modes handle VAT-exclusive and VAT-inclusive prices.',
      },
      {
        q: 'Are the rates guaranteed to be current?',
        a: 'No. Rates change by law, and this table is for reference only. Check with your state revenue department before you use a figure on a return or an invoice.',
      },
    ],
    related: ['discount-calculator', 'tip-calculator', 'percentage-calculator', 'salary-calculator', 'bill-split-calculator'],
    updated: '2026-11-01',
  },
  {
    slug: 'percentage-off-calculator',
    title: 'Percentage Off Calculator',
    h1: 'What is X% off Y?',
    description:
      'Percentage off calculator for "what is 20% off $80?". Shows the amount saved, the price you pay, a tax line and a table of common discounts.',
    keywords: [
      'percent off calculator',
      'what is 20 percent off',
      '15 percent off calculator',
      'how much is 30 off',
      'sale price calculator',
      'percentage off chart',
    ],
    category: 'everyday',
    icon: 'Percent',
    popular: true,
    faqs: [
      {
        q: 'What is 20% off $80?',
        a: '$64. Twenty percent of 80 is 16, so the sale price is 80 − 16 = 64. The shortcut is to multiply by the fraction that survives: 80 × 0.80 = 64, which is one step instead of two.',
      },
      {
        q: 'What is the fastest way to work out a discount in my head?',
        a: 'Take 10% by moving the decimal point one place, then scale it. 30% off £45: 10% is £4.50, so 30% is £13.50, leaving £31.50. For 15%, take 10% and add half of it.',
      },
      {
        q: 'Is the sales tax charged on the discounted price?',
        a: 'Yes, in almost every jurisdiction. Tax follows the price you pay, so a discount reduces the tax too. Switch on the tax line to see the total at the till.',
      },
      {
        q: 'How do I go from the sale price back to the original?',
        a: 'Divide the sale price by (1 − discount). A $63 jacket after 30% off started at 63 ÷ 0.7 = $90. The discount calculator has a reverse mode for this.',
      },
    ],
    related: ['discount-calculator', 'percentage-calculator', 'sales-tax-calculator', 'tip-calculator'],
    updated: '2026-11-01',
  },
  {
    slug: 'grade-calculator',
    title: 'Grade Calculator',
    h1: 'Weighted grade calculator',
    description:
      'Calculate your current class grade from weighted categories or raw points, then solve for the exact score you need on the final exam to hit your target.',
    keywords: [
      'grade calculator',
      'weighted grade calculator',
      'final grade calculator',
      'what do i need on my final',
      'test grade calculator',
      'class grade percentage',
    ],
    category: 'everyday',
    icon: 'GraduationCap',
    faqs: [
      {
        q: 'How is a weighted grade calculated?',
        a: 'Multiply each category score by its weight, add those products up, then divide by the total weight that has been graded so far. A 92% homework score worth 20% contributes 18.4 points towards the 20 available.',
      },
      {
        q: 'What do I need on the final to get an A?',
        a: 'Use the "Final needed" tab: enter your current grade, what the final is worth and the grade you want. The answer is (target − current × (1 − weight)) ÷ weight, and the table shows where every plausible exam score lands you.',
      },
      {
        q: 'Why do my weights need to add up to 100%?',
        a: 'They do not have to while the term is running. Anything not yet graded has no score. The calculator tells you when the total is not 100% and still calculates your grade over the graded portion, which is what your teacher sees mid-term.',
      },
      {
        q: 'What is the difference between weighted and points-based grading?',
        a: 'Weighted grading fixes each category\'s share of the final grade regardless of how many assignments it holds. Points-based grading adds up every point earned, so a 100-point exam matters five times as much as a 20-point quiz. Both are on separate tabs here.',
      },
    ],
    related: ['gpa-calculator', 'percentage-calculator', 'average-calculator', 'standard-deviation-calculator'],
    updated: '2026-11-01',
  },
  {
    slug: 'gpa-calculator',
    title: 'GPA Calculator',
    h1: 'GPA calculator: semester, cumulative and weighted',
    description:
      'Turn letter grades and credit hours into a 4.0 GPA, add honours and AP weighting, roll it into your cumulative average and solve for a target GPA.',
    keywords: [
      'gpa calculator',
      'weighted gpa calculator',
      'cumulative gpa calculator',
      'college gpa calculator',
      'high school gpa',
      'grade point average',
    ],
    category: 'everyday',
    icon: 'School',
    popular: true,
    faqs: [
      {
        q: 'How is GPA calculated?',
        a: 'Each letter grade maps to grade points (A = 4.0, B = 3.0 and so on), each course contributes credits × grade points as "quality points", and GPA is total quality points divided by total credits. Credit hours are what make a 4-credit course count double a 2-credit one.',
      },
      {
        q: 'What is the difference between weighted and unweighted GPA?',
        a: 'Unweighted GPA caps every course at 4.0. Weighted GPA adds a bonus for harder classes, typically +0.5 for honours and +1.0 for AP or IB, so it can exceed 4.0. Universities usually recalculate an unweighted GPA of their own from your transcript.',
      },
      {
        q: 'How do I calculate my cumulative GPA?',
        a: 'Multiply your old GPA by the credits it covered to recover your banked quality points, add this semester\'s quality points and credits, then divide again. Enter your prior GPA and prior credits, and the tool does this.',
      },
      {
        q: 'Can I work out what I need next semester?',
        a: 'Yes. The target solver takes the cumulative GPA you want and the credits you have left, and returns the average GPA those credits must earn. If the answer is above 4.0, it tells you that more credits are needed.',
      },
      {
        q: 'Does an A+ count as 4.0 or 4.3?',
        a: 'It depends on the institution. Many cap all A grades at 4.0; others award 4.3 for an A+. There is a switch for it, and the reference table updates to match your choice.',
      },
    ],
    related: ['grade-calculator', 'average-calculator', 'percentage-calculator', 'standard-deviation-calculator'],
    updated: '2026-11-01',
  },
  {
    slug: 'fuel-cost-calculator',
    title: 'Fuel Cost Calculator',
    h1: 'Fuel cost calculator for any trip',
    description:
      'Estimate the fuel cost of a drive in MPG or L/100km, split it between passengers, add the return leg, and compare two vehicles on the same journey.',
    keywords: [
      'fuel cost calculator',
      'gas cost calculator',
      'trip cost calculator',
      'petrol cost calculator',
      'cost per mile',
      'road trip fuel',
    ],
    category: 'everyday',
    icon: 'Fuel',
    faqs: [
      {
        q: 'Which fuel economy units are supported?',
        a: 'US MPG, imperial (UK) MPG, litres per 100 km and kilometres per litre. Everything is converted to litres per 100 km internally, so you can mix a US MPG figure with a price per litre without doing any conversion yourself.',
      },
      {
        q: 'Why is UK MPG higher than US MPG for the same car?',
        a: 'An imperial gallon is 4.546 litres against the US gallon\'s 3.785, so the same car travels about 20% further on one imperial gallon. A car rated 40 US MPG is about 48 UK MPG. Pick the right unit or the cost will be wrong by a fifth.',
      },
      {
        q: 'Should I use the manufacturer\'s MPG figure?',
        a: 'Use your own if you have it. Official figures come from a standardised test cycle and real-world consumption is typically 10–20% worse, more in cold weather, on short trips or with a roof box. Fill up, reset the trip meter and divide distance by fuel used for a true number.',
      },
      {
        q: 'Does this include the full cost of driving?',
        a: 'No, it is fuel only. Tyres, servicing, insurance and depreciation about double the real per-mile cost for an average car. Remember this when you compare driving with a train ticket.',
      },
    ],
    related: ['fuel-economy-converter', 'length-converter', 'speed-converter', 'car-loan-calculator'],
    updated: '2026-11-01',
  },
  {
    slug: 'roman-numeral-converter',
    title: 'Roman Numeral Converter',
    h1: 'Roman numeral converter',
    description:
      'Convert numbers to Roman numerals and back, from 1 to 3,999,999, with strict validation, the vinculum overline convention explained and a reference chart.',
    keywords: [
      'roman numeral converter',
      'roman numerals to numbers',
      'number to roman numerals',
      'roman numeral chart',
      'roman numeral date',
      'vinculum roman numerals',
    ],
    category: 'everyday',
    icon: 'ScrollText',
    faqs: [
      {
        q: 'How do Roman numerals go above 3,999?',
        a: 'With a vinculum: a bar drawn over a numeral multiplies it by 1,000. So V with a bar is 5,000 and MMM with a bar is 3,000,000. Plain text loses the bar, so the same value is often written in parentheses, e.g. (MMM)CMXCIX. This converter accepts both.',
      },
      {
        q: 'Why is 4 written IV and not IIII?',
        a: 'Standard subtractive notation places a smaller symbol before a larger one to mean "one less". I, X and C may each be repeated at most three times, so IIII is replaced by IV. IIII does appear on clock faces as a stylistic tradition, but it is not standard notation.',
      },
      {
        q: 'Is there a Roman numeral for zero?',
        a: 'No. The system has no zero and no negative numbers. It was made to count and record quantities, and was not used for arithmetic. Medieval scribes wrote the word "nulla" when they needed to express nothing.',
      },
      {
        q: 'What is 2026 in Roman numerals?',
        a: 'MMXXVI: two thousands (MM), two tens (XX), a five (V) and a one (I). Type any year into the converter and the step table shows how each symbol adds up.',
      },
    ],
    related: ['number-to-words-converter', 'number-base-converter', 'percentage-calculator', 'date-calculator'],
    updated: '2026-11-01',
  },
  {
    slug: 'number-to-words-converter',
    title: 'Number to Words Converter',
    h1: 'Number to words converter',
    description:
      'Number to words converter for English: cardinal, ordinal or cheque wording for amounts, with lakh/crore support and a words-to-digits reverse mode.',
    keywords: [
      'number to words',
      'spell out numbers',
      'amount in words',
      'cheque amount in words',
      'words to number converter',
      'number spelling',
    ],
    category: 'everyday',
    icon: 'SpellCheck',
    faqs: [
      {
        q: 'How do I write an amount in words on a cheque?',
        a: 'Write the whole units in words, then the fractional part as xx/100, for example "One thousand two hundred dollars and 50/100". Spelling the cents out in words is also accepted. Draw a line through any leftover space so nothing can be added.',
      },
      {
        q: 'Do I write "one hundred and five" or "one hundred five"?',
        a: 'British, Irish, Australian and Indian English use the "and"; American English usually drops it. Both are correct in their own register, and the switch changes every result at once.',
      },
      {
        q: 'Does it handle lakh and crore?',
        a: 'Yes. Switch the number system to lakh/crore and 12,500,000 becomes "one crore twenty-five lakh". The reverse mode reads those words back too, alongside million, billion and trillion.',
      },
      {
        q: 'How large a number can it spell?',
        a: 'Up to duodecillion (42 digits). The integer part uses BigInt, so no precision is lost. Decimals are read out digit by digit after the word "point".',
      },
    ],
    related: ['roman-numeral-converter', 'number-base-converter', 'case-converter', 'word-counter'],
    updated: '2026-11-01',
  },
  {
    slug: 'dice-roller',
    title: 'Dice Roller',
    h1: 'Online dice roller with full notation',
    description:
      'Dice roller for any dice notation, such as 3d6+2, 1d20 or 4d6kh3, with keep-highest support, roll history and a chart of the totals you rolled.',
    keywords: [
      'dice roller',
      'roll d20',
      'virtual dice',
      '3d6 roller',
      'dnd dice roller',
      'random dice generator',
    ],
    category: 'everyday',
    icon: 'Dices',
    faqs: [
      {
        q: 'What dice notation does it understand?',
        a: 'NdX with any number of terms and modifiers: 3d6+2, 1d20-1, 2d8+1d6+3. It also supports keep-highest and keep-lowest: 4d6kh3 rolls four six-sided dice and keeps the best three, and 2d20kh1 is advantage.',
      },
      {
        q: 'Are the rolls random?',
        a: 'They use crypto.getRandomValues, the browser\'s cryptographically secure generator, with rejection sampling so there is no modulo bias. Nothing is seeded from the clock and every face is exactly equally likely.',
      },
      {
        q: 'How do I roll with advantage or disadvantage?',
        a: 'Advantage is 2d20kh1 (roll two, keep the highest) and disadvantage is 2d20kl1. Both are one tap away in the preset row, and the dropped die is shown struck through so you can see the full roll.',
      },
      {
        q: 'Why does 3d6 produce far more 10s and 11s than 3s?',
        a: 'There are 27 ways to roll 10 with three dice and only one way to roll 3. The sum of several dice has a bell-shaped distribution. Roll a batch and the outcome chart on this page shows the shape.',
      },
    ],
    related: ['coin-flip', 'random-picker', 'uuid-generator', 'standard-deviation-calculator', 'random-number-generator'],
    updated: '2026-11-01',
  },
  {
    slug: 'coin-flip',
    title: 'Coin Flip',
    h1: 'Flip a coin online',
    description:
      'Flip a fair coin with an animated toss, or run up to 10,000 flips at once and watch the heads share converge on 50% in a live fairness chart.',
    keywords: [
      'coin flip',
      'flip a coin',
      'heads or tails',
      'coin toss simulator',
      'random coin flip',
      'coin flip 10000 times',
    ],
    category: 'everyday',
    icon: 'Coins',
    faqs: [
      {
        q: 'Is this coin flip really 50/50?',
        a: 'Yes. Each flip reads a new value from crypto.getRandomValues and uses rejection sampling, so heads and tails are exactly equally likely and no result depends on the previous one.',
      },
      {
        q: 'Why did I get eight heads in a row?',
        a: 'Runs are normal. In 1,000 flips, a run of ten identical results is more likely than not. A streak does not mean the coin is broken. The fairness chart shows the share settling towards 50% as the count rises.',
      },
      {
        q: 'How many flips can I run at once?',
        a: 'Up to 10,000 per batch, and they accumulate across batches. The work is chunked with a progress bar so the page never freezes, even on a phone.',
      },
      {
        q: 'Is a real coin toss fair?',
        a: 'Almost. Careful experiments find a slight bias, about 51%, towards the side that faced up when the coin was flipped, because of how the coin precesses in the air. A digital flip has no such bias.',
      },
    ],
    related: ['dice-roller', 'random-picker', 'uuid-generator', 'percentage-calculator'],
    updated: '2026-11-01',
  },
  {
    slug: 'random-picker',
    title: 'Random Picker',
    h1: 'Random name picker and list shuffler',
    description:
      'Random name picker: paste a list and draw winners with no repeats, add weights, or shuffle the whole list. Uses cryptographic randomness.',
    keywords: [
      'random name picker',
      'random picker wheel',
      'giveaway winner picker',
      'list randomizer',
      'random selector',
      'shuffle list',
    ],
    category: 'everyday',
    icon: 'Shuffle',
    faqs: [
      {
        q: 'Can I pick more than one winner?',
        a: 'Yes. Set how many winners you want and they are drawn without replacement, so nobody is picked twice. If you ask for more winners than there are entries, everyone wins and the tool says so.',
      },
      {
        q: 'How do weights work?',
        a: 'Switch weights on and write "Name | 3" to give that line three times the chance of any line weighted 1. The odds table lists every entrant\'s exact probability of being drawn first.',
      },
      {
        q: 'Is this fair enough for a giveaway?',
        a: 'The draw uses crypto.getRandomValues with a Fisher–Yates shuffle, the standard unbiased algorithm. Sorting by Math.random is biased. There is no seed and no server, so nothing can be rigged after the draw. This also means there is no shareable audit trail.',
      },
      {
        q: 'Does my list get uploaded?',
        a: 'No. Everything, including the entrant names, stays in your browser tab. Nothing is transmitted, stored or logged, which matters when the list is customer emails or employee names.',
      },
    ],
    related: ['dice-roller', 'coin-flip', 'sort-lines', 'remove-duplicate-lines'],
    updated: '2026-11-01',
  },
]
