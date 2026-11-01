import type { Tool } from './types'

export const tools: Tool[] = [
  {
    slug: 'age-calculator',
    title: 'Age Calculator',
    h1: 'Age calculator: exact age in years, months and days',
    description:
      'Age calculator for your exact age in years, months and days, plus total weeks, hours and minutes lived, your birth weekday and next birthday.',
    keywords: [
      'how old am i',
      'age in days',
      'date of birth calculator',
      'birthday calculator',
      'chronological age',
      'age in months',
    ],
    category: 'datetime',
    icon: 'Cake',
    popular: true,
    faqs: [
      {
        q: 'How is exact age in years, months and days calculated?',
        a: 'Whole years are counted first, then whole months from that anniversary, then the leftover days. Hospitals, visa forms and school registrars use the same method, so 1 March minus 1 January is "2 months, 0 days", never 59 days rounded.',
      },
      {
        q: 'What happens if I was born on 29 February?',
        a: 'In non-leap years the anniversary is 28 February, as in most legal systems and calendar libraries. The total-days figure counts real elapsed days, so it does not change.',
      },
      {
        q: 'Does the timezone matter?',
        a: 'It changes what "today" means, which can shift your age by one day around midnight. The calculator shows its timezone and lets you change it, so you can calculate an age as of the country you were born in.',
      },
      {
        q: 'Can I calculate my age on a future or past date?',
        a: 'Yes. Set the "age at date" field to any date. The tool calculates the years, months, days, totals and weekday as of that date.',
      },
      {
        q: 'Is my date of birth sent anywhere?',
        a: 'No. The page makes no network calls. The arithmetic runs in your browser tab, and nothing is stored or sent.',
      },
    ],
    related: ['date-difference-calculator', 'days-until-christmas', 'countdown-timer', 'week-number-calculator', 'pregnancy-due-date-calculator'],
    updated: '2026-11-01',
  },
  {
    slug: 'date-difference-calculator',
    title: 'Date Difference Calculator',
    h1: 'Date difference calculator: days between two dates',
    description:
      'Date difference calculator: count the days, weeks, months and years between two dates, with or without the end date, or in business days only.',
    keywords: [
      'days between dates',
      'date duration calculator',
      'how many days between',
      'weeks between dates',
      'time between two dates',
    ],
    category: 'datetime',
    icon: 'CalendarRange',
    popular: true,
    faqs: [
      {
        q: 'Should I include the end date?',
        a: 'Include it when both dates are days you count: a hotel stay of 3–5 June is three days. Exclude it for elapsed time, which is the usual answer for deadlines, notice periods and interest.',
      },
      {
        q: 'Why is "months" not just days ÷ 30?',
        a: 'Calendar months have 28–31 days, so the tool counts whole calendar months from the start date and then shows the leftover days. It also shows the days ÷ 30.44 approximation, labelled as an average.',
      },
      {
        q: 'How are business days counted?',
        a: 'Business days are all the days between the two dates that are not a Saturday or Sunday. Public holidays are not removed here. For a custom holiday list, use the business days calculator.',
      },
      {
        q: 'Does it handle dates before 1970 or far in the future?',
        a: 'Yes. Dates from year 1 to year 9999 work. Leap years follow the Gregorian 100-year and 400-year rules.',
      },
    ],
    related: ['business-days-calculator', 'date-calculator', 'age-calculator', 'week-number-calculator'],
    updated: '2026-11-01',
  },
  {
    slug: 'date-calculator',
    title: 'Date Calculator',
    h1: 'Date calculator: add or subtract days from a date',
    description:
      'Date calculator to add or subtract days, weeks, months and years from any date. A business-days mode skips Saturdays and Sundays.',
    keywords: [
      'add days to date',
      'subtract days from date',
      'date plus days',
      '90 days from today',
      'what date will it be',
    ],
    category: 'datetime',
    icon: 'CalendarPlus',
    faqs: [
      {
        q: 'What does "31 January plus one month" give?',
        a: '28 February (29 in a leap year). When the target month has no matching day number, the result moves to the last day of that month. Contracts and the major date libraries use the same rule.',
      },
      {
        q: 'In what order are the units applied?',
        a: 'Years first, then months, then weeks, then days. The order matters at month ends, so the working-out panel shows each intermediate date.',
      },
      {
        q: 'What does business-days mode do?',
        a: 'It counts only Monday to Friday, so "10 business days from Thursday" lands two weeks later on the Thursday. From a Saturday or Sunday, the first business day counted is the Monday.',
      },
      {
        q: 'Can I count backwards?',
        a: 'Yes. Choose Subtract, or enter negative numbers. Both give the same result, and the working-out panel shows the direction.',
      },
    ],
    related: ['date-difference-calculator', 'business-days-calculator', 'countdown-timer', 'age-calculator', 'pregnancy-due-date-calculator'],
    updated: '2026-11-01',
  },
  {
    slug: 'business-days-calculator',
    title: 'Business Days Calculator',
    h1: 'Business days calculator: working days between two dates',
    description:
      'Business days calculator: count working days between two dates with your own weekend days and holiday list, and see each day that was excluded.',
    keywords: [
      'working days calculator',
      'weekdays between dates',
      'business day count',
      'net workdays',
      'holiday calendar calculator',
    ],
    category: 'datetime',
    icon: 'Briefcase',
    faqs: [
      {
        q: 'Which days count as the weekend?',
        a: 'Saturday and Sunday by default. Each weekday has its own toggle: set Friday and Saturday for the Gulf states, or Sunday only where that is the norm.',
      },
      {
        q: 'Where are my holidays stored?',
        a: 'In this browser only, in localStorage. They are never uploaded. If you clear site data or use a different browser, the list is empty. Export the list as CSV to keep a copy.',
      },
      {
        q: 'Are the start and end dates included?',
        a: 'Both endpoints are included when they are working days. SLAs and notice periods are normally written this way, and the summary shows the inclusive range.',
      },
      {
        q: 'What if a holiday falls on a weekend?',
        a: 'It is not counted twice. The tool removes weekends first, then removes only the holidays that fall on a remaining working day, and lists the holidays it removed.',
      },
    ],
    related: ['date-difference-calculator', 'date-calculator', 'week-number-calculator', 'days-until-christmas'],
    updated: '2026-11-01',
  },
  {
    slug: 'countdown-timer',
    title: 'Countdown Timer',
    h1: 'Countdown timer to any date and time',
    description:
      'Countdown timer to any date and time, with milestone presets, an optional alarm and a share link that holds the target date, title and timezone.',
    keywords: [
      'countdown to date',
      'days until',
      'event countdown',
      'countdown clock',
      'time until',
      'deadline timer',
    ],
    category: 'datetime',
    icon: 'Timer',
    faqs: [
      {
        q: 'Does the countdown keep running if I close the tab?',
        a: 'The display stops, but the target is in the page URL. Open the link again and the countdown continues with the correct remaining time.',
      },
      {
        q: 'How does the shareable link work?',
        a: 'The target instant, title and timezone are in the URL fragment. Anyone who opens the link counts down to the same moment, shown in the timezone you picked.',
      },
      {
        q: 'Will the alarm fire while the tab is in the background?',
        a: 'Usually yes. Some browsers throttle background tabs and can delay the sound by a few seconds. Keep the tab visible if the exact second matters.',
      },
      {
        q: 'Is it accurate over long periods?',
        a: 'Yes. On each tick the tool calculates the remaining time from the system clock, so the countdown cannot drift, even if the tab is suspended for hours.',
      },
    ],
    related: ['days-until-christmas', 'date-difference-calculator', 'timezone-converter', 'time-duration-calculator', 'sleep-calculator'],
    updated: '2026-11-01',
  },
  {
    slug: 'unix-timestamp-converter',
    title: 'Unix Timestamp Converter',
    h1: 'Unix timestamp converter: epoch to date and back',
    description:
      'Unix timestamp converter for epoch time to date and back. It detects seconds or milliseconds, shows ISO 8601 and RFC 2822, and has a batch mode.',
    keywords: [
      'epoch converter',
      'unix time',
      'timestamp to date',
      'date to timestamp',
      'epoch to human date',
      'milliseconds timestamp',
    ],
    category: 'datetime',
    icon: 'Clock',
    popular: true,
    faqs: [
      {
        q: 'How does it tell seconds from milliseconds?',
        a: 'By size. Values of up to about 10 digits are seconds, 13 digits are milliseconds, and 16 or 19 digits are microseconds or nanoseconds. You can also set the unit manually.',
      },
      {
        q: 'What is the year 2038 problem?',
        a: 'A signed 32-bit counter of seconds overflows on 19 January 2038 at 03:14:07 UTC. This converter uses JavaScript numbers, which handle timestamps well beyond that, so 2038 values convert fine here.',
      },
      {
        q: 'Are Unix timestamps timezone dependent?',
        a: 'No. An epoch value is always the seconds since 1970-01-01 00:00:00 UTC. Only the human-readable date depends on a timezone, so the page shows the display zone and lets you change it.',
      },
      {
        q: 'Can I convert a whole list at once?',
        a: 'Yes. Batch mode accepts one timestamp per line, or comma-separated values, and returns a table you can copy or download as CSV.',
      },
      {
        q: 'Do leap seconds affect the result?',
        a: 'No. Unix time ignores leap seconds: every day is exactly 86,400 seconds long. Conversions here match what servers and databases report.',
      },
    ],
    related: ['timezone-converter', 'date-difference-calculator', 'countdown-timer', 'cron-expression-parser', 'json-formatter'],
    updated: '2026-11-01',
  },
  {
    slug: 'timezone-converter',
    title: 'Time Zone Converter',
    h1: 'Time zone converter and meeting planner',
    description:
      'Time zone converter for one time across many zones at once. A colour-coded hour strip shows when working hours overlap, with the DST offset for each date.',
    keywords: [
      'time zone converter',
      'world clock',
      'meeting planner',
      'time difference between cities',
      'utc converter',
      'est to cet',
    ],
    category: 'datetime',
    icon: 'Globe',
    faqs: [
      {
        q: 'Is daylight saving time handled?',
        a: 'Yes. Conversions use the IANA timezone database in your browser, so each zone gets the offset in force on the date you picked. This includes the week or two each spring and autumn when regions change their clocks on different dates.',
      },
      {
        q: 'How do I read the overlap strip?',
        a: 'Each row is one zone and each cell one hour of the reference day. Cells inside your chosen working window are highlighted, so a vertical band of highlighted cells is an hour that suits everyone.',
      },
      {
        q: 'Which timezone list is used?',
        a: 'The full IANA list in your browser, typically 400+ zones. The tool uses region names such as Europe/Lisbon, because abbreviations such as CST are ambiguous.',
      },
      {
        q: 'Can I share a planned meeting time?',
        a: 'Copy the summary. It lists the same instant in each selected zone, ready to paste into an email or chat.',
      },
    ],
    related: ['unix-timestamp-converter', 'countdown-timer', 'time-duration-calculator', 'date-difference-calculator'],
    updated: '2026-11-01',
  },
  {
    slug: 'time-duration-calculator',
    title: 'Time Duration Calculator',
    h1: 'Time duration calculator: add and subtract hours and minutes',
    description:
      'Time duration calculator to add or subtract HH:MM:SS durations, total a timesheet in hours and decimal hours, and convert between time units.',
    keywords: [
      'hours calculator',
      'add time',
      'timesheet calculator',
      'hours and minutes calculator',
      'time addition',
      'decimal hours',
    ],
    category: 'datetime',
    icon: 'Hourglass',
    faqs: [
      {
        q: 'What input formats are accepted?',
        a: 'HH:MM, HH:MM:SS, plain minutes, and shorthand like "1h 30m" or "90m". Each line of the timesheet tab can also be a clock range such as "09:15-17:45".',
      },
      {
        q: 'What are decimal hours and why do I need them?',
        a: 'Decimal hours show minutes as a fraction of an hour: 7:30 becomes 7.5. Payroll systems and invoices normally use this form. Each total is shown in both forms.',
      },
      {
        q: 'Can a result be negative?',
        a: 'Yes. Subtracting a longer duration gives a negative total with a leading minus sign. The total does not wrap around, which is correct for flexitime balances.',
      },
      {
        q: 'Does it handle durations longer than 24 hours?',
        a: 'Yes. Totals keep adding up past 24 hours and do not reset, so a weekly total of 47:30 shows as 47:30.',
      },
    ],
    related: ['date-difference-calculator', 'timezone-converter', 'countdown-timer', 'business-days-calculator', 'sleep-calculator'],
    updated: '2026-11-01',
  },
  {
    slug: 'week-number-calculator',
    title: 'Week Number Calculator',
    h1: 'Week number calculator: ISO 8601 week of the year',
    description:
      'Find the ISO 8601 week number for any date, look up the exact date range of a week number, and see the current week with the full year calendar.',
    keywords: [
      'iso week number',
      'what week is it',
      'week of the year',
      'week number to date',
      'calendar week',
      'kw calculator',
    ],
    category: 'datetime',
    icon: 'CalendarSearch',
    faqs: [
      {
        q: 'What makes a week "ISO week 1"?',
        a: 'ISO 8601 defines week 1 as the week that contains the first Thursday of January. This is also the week that contains 4 January. Weeks always run Monday to Sunday.',
      },
      {
        q: 'Why do some years have 53 weeks?',
        a: 'A year has 53 ISO weeks when 1 January is a Thursday, or when it is a Wednesday in a leap year. Everything else has 52, and the tool tells you which case applies.',
      },
      {
        q: 'Why can early January belong to the previous year?',
        a: 'A week belongs to the year that contains its Thursday. 1 January 2027 is a Friday, so it is in week 53 of 2026. This is the ISO week-numbering year, which the tool shows next to the calendar year.',
      },
      {
        q: 'How does this differ from the US week numbering?',
        a: 'The common US system starts weeks on Sunday and calls the week that contains 1 January week 1, so its number is often one different. The tool shows both numbers.',
      },
    ],
    related: ['date-difference-calculator', 'business-days-calculator', 'date-calculator', 'age-calculator'],
    updated: '2026-11-01',
  },
  {
    slug: 'sleep-calculator',
    title: 'Sleep Calculator',
    h1: 'Sleep calculator: best bedtimes and wake-up times',
    description:
      'Sleep calculator for bedtimes and wake-up times that match 90-minute sleep cycles, plus the time you take to fall asleep. Works in both directions.',
    keywords: [
      'bedtime calculator',
      'sleep cycle calculator',
      'when should i go to sleep',
      'wake up time calculator',
      '90 minute sleep cycles',
    ],
    category: 'datetime',
    icon: 'Moon',
    faqs: [
      {
        q: 'Why 90 minutes?',
        a: 'A full sleep cycle (light, deep, then REM sleep) is about 90 minutes in adults on average. Waking at the end of a cycle, and not in deep sleep, tends to reduce grogginess.',
      },
      {
        q: 'How accurate is the 90-minute figure?',
        a: 'It is an average. Real cycles are about 70 to 120 minutes long and get longer through the night. Use the suggested times as a starting point and set the cycle length to what works for you.',
      },
      {
        q: 'How long should it take to fall asleep?',
        a: 'Ten to twenty minutes is typical for a healthy adult. The default here is 15. If you fall asleep in under five minutes most nights, that usually means sleep deprivation.',
      },
      {
        q: 'How many cycles should I aim for?',
        a: 'Five or six (7.5 to 9 hours), which matches the sleep most adults need. Four cycles (6 hours) is a minimum for an occasional short night and is not for every night.',
      },
    ],
    related: ['countdown-timer', 'time-duration-calculator', 'age-calculator', 'timezone-converter'],
    updated: '2026-11-01',
  },
  {
    slug: 'days-until-christmas',
    title: 'Days Until Christmas',
    h1: 'Days until Christmas and every other holiday',
    description:
      'Days until Christmas: a live countdown with days remaining, the weekday the date falls on, and every other major holiday still ahead this year.',
    keywords: [
      'how many days until christmas',
      'christmas countdown',
      'days until halloween',
      'days until thanksgiving',
      'holiday countdown',
      'when is easter',
    ],
    category: 'datetime',
    icon: 'Gift',
    faqs: [
      {
        q: 'How is Easter calculated?',
        a: 'With the Gregorian computus (the Meeus/Jones/Butcher algorithm). Easter Sunday is the first Sunday after the first ecclesiastical full moon on or after 21 March. The page calculates it each time and does not use a table.',
      },
      {
        q: 'When is Thanksgiving and Black Friday?',
        a: 'US Thanksgiving is the fourth Thursday of November, so it moves between the 22nd and 28th. Black Friday is the day after, and Cyber Monday the Monday following.',
      },
      {
        q: 'Does the countdown depend on my timezone?',
        a: 'Yes. "Days until" counts calendar days from today in your timezone. You can change the reference timezone, which matters most in the last day or two before the holiday.',
      },
      {
        q: 'Will the page still be right next year?',
        a: 'Yes. Each date is calculated from its rule when the page loads, so each holiday moves to next year the day after it passes.',
      },
    ],
    related: ['countdown-timer', 'date-difference-calculator', 'business-days-calculator', 'age-calculator'],
    updated: '2026-11-01',
  },
]
