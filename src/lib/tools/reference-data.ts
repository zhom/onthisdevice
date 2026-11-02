import type { Tool } from './types'

/*
 * Reference data tools. Their data is public, fetched on a schedule by scripts/data/ and
 * shipped with the site (src/data/, public/data/). Each page reads only from this site.
 */
const UPDATED = '2026-11-02'

export const tools: Tool[] = [
  {
    slug: 'currency-converter',
    title: 'Currency Converter',
    h1: 'Currency converter with ECB exchange rates',
    description:
      'Currency converter for 29 currencies with the daily euro reference rates of the European Central Bank, and a chart of each currency pair since 1999.',
    keywords: ['exchange rate', 'euro to dollar', 'usd to eur', 'gbp to usd', 'forex converter', 'ecb rates', 'exchange rate history'],
    category: 'finance',
    icon: 'ArrowLeftRight',
    popular: true,
    faqs: [
      {
        q: 'Where do the exchange rates come from?',
        a: 'From the euro foreign exchange reference rates of the European Central Bank. The ECB publishes them once each working day at about 16:00 CET. The site downloads them every day and the converter calculates every other pair from the euro rates.',
      },
      {
        q: 'Why is my bank rate different?',
        a: 'The ECB rate is a reference rate for information. Banks, card networks and exchange offices add a margin or a fee, so the rate you get is usually a few percent worse.',
      },
      {
        q: 'How far back does the history go?',
        a: 'To 4 January 1999, the first day of the euro. Currencies that the ECB started to quote later, for example the Chinese yuan in 2005, start on their first day.',
      },
      {
        q: 'Does the converter work offline?',
        a: 'Yes, after the page has loaded once. The latest rates are part of the page, and the history files come from this site, not from a rate service.',
      },
    ],
    related: ['crypto-converter', 'inflation-calculator', 'percentage-calculator'],
    updated: UPDATED,
  },
  {
    slug: 'crypto-converter',
    title: 'Crypto Converter',
    h1: 'Crypto converter and price history',
    description:
      'Crypto converter for Bitcoin, Ethereum and 26 other coins to US dollars, euros and 27 more currencies, with daily prices and a history chart.',
    keywords: ['bitcoin to usd', 'btc to usd', 'eth to usd', 'crypto calculator', 'bitcoin price history', 'cryptocurrency converter'],
    category: 'finance',
    icon: 'Bitcoin',
    faqs: [
      {
        q: 'How current are the prices?',
        a: 'They are daily prices. The site downloads one price per coin each day, so the converter shows the price of the date above the result, not a live market price.',
      },
      {
        q: 'How is a coin converted to euros or pounds?',
        a: 'The coin price is in US dollars. The converter multiplies it by the ECB reference rate between the dollar and the other currency.',
      },
      {
        q: 'Why does the history start in March 2024?',
        a: 'The public-domain price source has daily snapshots from 2 March 2024. A day with no snapshot, or with a price that is clearly wrong, is left out of the chart.',
      },
    ],
    related: ['currency-converter', 'compound-interest-calculator', 'roi-calculator'],
    updated: UPDATED,
  },
  {
    slug: 'current-mortgage-rates',
    title: 'Current Mortgage Rates',
    h1: 'Current mortgage rates in the US',
    description:
      'Current US mortgage rates: the weekly average 30-year and 15-year fixed rates from the Freddie Mac survey, with every week since 1971 in a chart.',
    keywords: ['mortgage rates today', '30 year mortgage rate', '15 year mortgage rate', 'mortgage rate history', 'freddie mac pmms', 'average mortgage rate'],
    category: 'finance',
    icon: 'Landmark',
    faqs: [
      {
        q: 'What are these rates?',
        a: 'National averages from the Freddie Mac Primary Mortgage Market Survey. They are the average rates on conventional, conforming, fully amortising home purchase loans for borrowers with a 20% down payment and excellent credit.',
      },
      {
        q: 'When are they updated?',
        a: 'Freddie Mac publishes the survey each Thursday at noon US Eastern time. The site downloads it on Thursday afternoon.',
      },
      {
        q: 'Will my rate be the same?',
        a: 'Probably not. Your rate depends on your credit score, down payment, loan size, points and lender. Use the average as a reference when you compare offers.',
      },
    ],
    related: ['mortgage-calculator', 'amortization-schedule-calculator', 'loan-calculator'],
    updated: UPDATED,
  },
  {
    slug: 'stock-market-return-calculator',
    title: 'Stock Market Return Calculator',
    h1: 'Stock market return calculator (S&P since 1871)',
    description:
      'Stock market return calculator for any period since 1871: S&P Composite total return with dividends reinvested, before and after inflation.',
    keywords: ['s&p 500 return calculator', 'historical stock returns', 'investment return calculator', 'dividends reinvested', 'real return', 'stock market history'],
    category: 'finance',
    icon: 'TrendingUp',
    faqs: [
      {
        q: 'What data does the calculator use?',
        a: 'The monthly S&P Composite index, dividends and US consumer prices compiled by economist Robert J. Shiller, from January 1871. Dividends are reinvested each month at that month’s price.',
      },
      {
        q: 'What is the real return?',
        a: 'The return after inflation. The calculator divides each value by the consumer price index of its month, so the result is in money of the end month.',
      },
      {
        q: 'Are fees and taxes included?',
        a: 'No. The figures are for the index itself, before fund fees, trading costs and taxes on dividends and gains.',
      },
      {
        q: 'Why does the data end before this month?',
        a: 'Total return needs the dividend of each month, and the public-domain data set has dividends only up to the month shown under the calculator.',
      },
    ],
    related: ['compound-interest-calculator', 'inflation-calculator', 'retirement-calculator', 'roi-calculator'],
    updated: UPDATED,
  },
  {
    slug: 'ip-address-lookup',
    title: 'IP Address Lookup',
    h1: 'IP address lookup: ASN, network and country',
    description:
      'IP address lookup for IPv4 and IPv6: the autonomous system (ASN), network owner, country and routed range, plus the address in binary.',
    keywords: ['ip lookup', 'asn lookup', 'ip to asn', 'who owns this ip', 'ip owner lookup', 'ipv6 lookup', 'ip whois'],
    category: 'reference',
    icon: 'Network',
    popular: true,
    faqs: [
      {
        q: 'Does this page see my IP address?',
        a: 'No. A static page cannot read your address, and this one does not try. Type or paste the address you want to look up.',
      },
      {
        q: 'What is an ASN?',
        a: 'An autonomous system number identifies a network that routes its own IP ranges on the internet, for example an internet provider, a cloud or a large company. The lookup shows which network announces the range that contains the address.',
      },
      {
        q: 'How does the lookup work without a server?',
        a: 'The routing table is split into small files on this site. The page loads only the file that covers your address and searches it in your browser.',
      },
      {
        q: 'Is the country the location of the user?',
        a: 'No. It is the country where the network is registered. A mobile or cloud network can serve users in many countries.',
      },
    ],
    related: ['cloud-ip-lookup', 'subnet-calculator', 'cidr-to-ip-range', 'ipv4-to-binary'],
    updated: UPDATED,
  },
  {
    slug: 'cloud-ip-lookup',
    title: 'Cloud IP Lookup',
    h1: 'Cloud IP lookup: which cloud or CDN owns an IP',
    description:
      'Cloud IP lookup for an IP address or CIDR: finds AWS, Azure, Google Cloud, Cloudflare and other cloud or CDN ranges, with service and region.',
    keywords: ['aws ip lookup', 'azure ip ranges', 'google cloud ip ranges', 'cloudflare ip check', 'is this ip aws', 'cdn ip lookup'],
    category: 'reference',
    icon: 'Cloud',
    faqs: [
      {
        q: 'Which providers are included?',
        a: 'Amazon Web Services, Microsoft Azure, Google Cloud and other Google ranges, Oracle Cloud, Cloudflare, Fastly, DigitalOcean, Akamai Cloud (Linode) and Vultr. Each publishes its ranges for firewall rules.',
      },
      {
        q: 'Why does one address show more than one service?',
        a: 'Providers publish ranges that overlap. A block can belong to a whole region and also to one service in it, so the lookup lists each published entry that contains the address.',
      },
      {
        q: 'Can I check a CIDR range?',
        a: 'Yes. Enter a range such as 52.94.0.0/22. The lookup shows the provider entries that contain the first address and says whether the whole range is inside them.',
      },
    ],
    related: ['ip-address-lookup', 'subnet-calculator', 'cidr-to-ip-range'],
    updated: UPDATED,
  },
  {
    slug: 'mac-address-lookup',
    title: 'MAC Address Lookup',
    h1: 'MAC address lookup: find the vendor',
    description:
      'MAC address lookup in the IEEE registries (MA-L, MA-M, MA-S): find the vendor of any MAC address or OUI, one at a time or a whole list.',
    keywords: ['mac vendor lookup', 'oui lookup', 'mac address vendor', 'ieee oui', 'manufacturer lookup', 'bssid lookup'],
    category: 'reference',
    icon: 'Router',
    faqs: [
      {
        q: 'Which part of the MAC address identifies the vendor?',
        a: 'The first 24 bits (6 hex digits) for a large block (MA-L, the old OUI), the first 28 bits for a medium block (MA-M) or the first 36 bits for a small block (MA-S). The lookup tries the longest match first.',
      },
      {
        q: 'Why is there no vendor for my address?',
        a: 'If the second hex digit is 2, 6, A or E, the address is locally administered. Phones and computers make such random addresses for privacy, so no vendor owns them.',
      },
      {
        q: 'Which formats can I paste?',
        a: 'Any common one: 00:1A:2B:3C:4D:5E, 00-1A-2B-3C-4D-5E, 001A.2B3C.4D5E or plain hex. Paste several addresses, one per line, to look them all up.',
      },
    ],
    related: ['ip-address-lookup', 'port-number-lookup', 'random-string-generator'],
    updated: UPDATED,
  },
  {
    slug: 'port-number-lookup',
    title: 'Port Number Lookup',
    h1: 'Port number lookup (TCP and UDP)',
    description:
      'Port number lookup in the IANA registry: search TCP and UDP ports by number or service name, with the protocol, description and RFC.',
    keywords: ['tcp port lookup', 'udp port', 'what port is', 'port 443', 'common ports list', 'iana port numbers', 'service name lookup'],
    category: 'reference',
    icon: 'EthernetPort',
    faqs: [
      {
        q: 'What are well-known, registered and dynamic ports?',
        a: 'Ports 0 to 1023 are system or well-known ports, 1024 to 49151 are registered ports, and 49152 to 65535 are dynamic or private ports that systems use for short-lived connections.',
      },
      {
        q: 'Is a program on this port the registered service?',
        a: 'Not always. The registry records which service asked for a port. Any program can listen on any port, and many programs use unregistered ports.',
      },
      {
        q: 'Why does one port have several names?',
        a: 'The registry can list several services, or one service under several names, for the same number and for different transport protocols.',
      },
    ],
    related: ['ip-address-lookup', 'mac-address-lookup', 'subnet-calculator'],
    updated: UPDATED,
  },
  {
    slug: 'domain-extension-lookup',
    title: 'Domain Extension Lookup',
    h1: 'Domain extension lookup (TLDs and public suffixes)',
    description:
      'Domain extension lookup for all top-level domains in the IANA root zone, with their type and manager, and the registrable domain of any hostname.',
    keywords: ['tld lookup', 'top level domain list', 'domain extensions', 'public suffix list', 'country code tld', 'registrable domain', 'etld+1'],
    category: 'reference',
    icon: 'Earth',
    faqs: [
      {
        q: 'What is the registrable domain?',
        a: 'The part of a hostname that one owner registers: the public suffix plus one label. For news.bbc.co.uk the public suffix is co.uk and the registrable domain is bbc.co.uk. Browsers use the same rule to separate sites for cookies.',
      },
      {
        q: 'What do the TLD types mean?',
        a: 'Generic TLDs such as .com and .app are open or brand domains. Country code TLDs are two letters (or an internationalised name) for a country or territory. Sponsored TLDs serve a community, and .arpa is for internet infrastructure.',
      },
      {
        q: 'What is a private public suffix?',
        a: 'A domain that a company opens to its users, for example a hosting service where each user gets a subdomain. The Public Suffix List treats these like extensions, so separate users are separate sites.',
      },
    ],
    related: ['url-encoder-decoder', 'ip-address-lookup'],
    updated: UPDATED,
  },
  {
    slug: 'browser-version-checker',
    title: 'Browser Version Checker',
    h1: 'Browser version checker: is my browser up to date?',
    description:
      'Browser version checker: shows your browser and version and compares it with the latest stable release of Chrome, Firefox, Safari and Edge.',
    keywords: ['what browser am i using', 'is my browser up to date', 'chrome version', 'latest firefox version', 'safari version', 'user agent'],
    category: 'reference',
    icon: 'AppWindow',
    faqs: [
      {
        q: 'How does the page know my browser version?',
        a: 'It reads the user agent and, where the browser has it, the User-Agent Client Hints API. Both are local browser features, so nothing is sent.',
      },
      {
        q: 'Why does Chrome show a version that ends in .0.0.0?',
        a: 'Chrome and Edge reduce the user agent string to the major version. Where the browser offers the full version through Client Hints, the page shows it.',
      },
      {
        q: 'How do I update my browser?',
        a: 'Chrome, Edge and Firefox update in the background; open their About page to start an update now. Safari updates with macOS or iOS in Software Update.',
      },
    ],
    related: ['end-of-life-checker', 'screen-size-calculator'],
    updated: UPDATED,
  },
  {
    slug: 'end-of-life-checker',
    title: 'End-of-Life Checker',
    h1: 'End-of-life checker for software versions',
    description:
      'End-of-life checker for over 120 languages, frameworks, databases and operating systems: support and security end dates of each version, on a timeline.',
    keywords: ['end of life', 'eol dates', 'python end of life', 'node lts schedule', 'ubuntu support end', 'php supported versions', 'software support lifecycle'],
    category: 'reference',
    icon: 'CalendarX',
    faqs: [
      {
        q: 'What is the difference between active support and security support?',
        a: 'During active support a version gets bug fixes and small improvements. After that, many projects give security fixes only, until the end-of-life date. After end of life there are no more fixes.',
      },
      {
        q: 'Where do the dates come from?',
        a: 'From endoflife.date, a community data set that collects the published support policies of each project. The site downloads it each week.',
      },
      {
        q: 'What does LTS mean?',
        a: 'Long-term support: a version that the project promises to support for longer than its other versions, for example even-numbered Node.js releases and Ubuntu .04 releases of even years.',
      },
    ],
    related: ['browser-version-checker', 'date-difference-calculator', 'json-formatter'],
    updated: UPDATED,
  },
  {
    slug: 'airport-code-lookup',
    title: 'Airport Code Lookup',
    h1: 'Airport code lookup (IATA and ICAO)',
    description:
      'Airport code lookup for 9,000 airports: find an airport by IATA or ICAO code, name or city, with its country, coordinates and position on a map.',
    keywords: ['iata code lookup', 'icao code', 'airport codes', 'airport finder', 'three letter airport code', 'airport code list'],
    category: 'reference',
    icon: 'PlaneTakeoff',
    faqs: [
      {
        q: 'What is the difference between IATA and ICAO codes?',
        a: 'IATA codes have three letters and appear on tickets and bag tags (LHR). ICAO codes have four letters, are used by pilots and air traffic control, and start with a region letter (EGLL).',
      },
      {
        q: 'Which airports are included?',
        a: 'Every airport, seaplane base and heliport with an IATA code in OurAirports, an open data set of the world’s airports.',
      },
      {
        q: 'Why does a city have more than one code?',
        a: 'Cities with several airports often have a metropolitan code too (LON for London). This list has the airports themselves.',
      },
    ],
    related: ['flight-distance-calculator', 'timezone-converter', 'length-converter'],
    updated: UPDATED,
  },
  {
    slug: 'flight-distance-calculator',
    title: 'Flight Distance Calculator',
    h1: 'Flight distance calculator between airports',
    description:
      'Flight distance calculator: the great-circle distance between two airports in kilometres, miles and nautical miles, drawn as an arc on a world map.',
    keywords: ['distance between airports', 'flight miles calculator', 'great circle distance', 'how far is the flight', 'air distance calculator', 'flight time estimate'],
    category: 'reference',
    icon: 'Plane',
    faqs: [
      {
        q: 'What is great-circle distance?',
        a: 'The shortest distance between two points on the surface of a sphere. Flights follow a route close to it, which is why a flight from Europe to the US west coast passes over Greenland.',
      },
      {
        q: 'How accurate is it?',
        a: 'The haversine formula on a sphere with the mean Earth radius (6,371 km) is within about 0.5% of the distance on the true ellipsoid. The flown distance is longer because of air routes, winds and holding.',
      },
      {
        q: 'How is the flight time estimated?',
        a: 'At an average speed of 800 km/h plus 30 minutes for taxi, climb and descent. Real schedules depend on the aircraft, the wind and the route.',
      },
    ],
    related: ['airport-code-lookup', 'length-converter', 'timezone-converter'],
    updated: UPDATED,
  },
  {
    slug: 'emoji-search',
    title: 'Emoji Search',
    h1: 'Emoji search: find and copy any emoji',
    description:
      'Emoji search by name or keyword across every emoji in the latest Unicode version, with its code points and the version that added it. Copy with a tap.',
    keywords: ['emoji finder', 'copy and paste emoji', 'emoji keyboard', 'emoji meaning', 'emoji unicode', 'emoji list'],
    category: 'reference',
    icon: 'Smile',
    faqs: [
      {
        q: 'Where do the names and keywords come from?',
        a: 'Names come from the Unicode emoji data and keywords from the English annotations of the Unicode CLDR project, the same data many phone keyboards use.',
      },
      {
        q: 'Why does an emoji look different on another device?',
        a: 'Unicode defines the character and its meaning; each system draws it with its own font. A new emoji can show as a box on a system that has no font for it yet.',
      },
      {
        q: 'Are skin tone variants included?',
        a: 'The list shows each emoji once, in its default form. Most keyboards let you pick a skin tone after you insert it.',
      },
    ],
    related: ['unicode-character-lookup', 'character-counter', 'ascii-table'],
    updated: UPDATED,
  },
  {
    slug: 'unicode-character-lookup',
    title: 'Unicode Character Lookup',
    h1: 'Unicode character lookup',
    description:
      'Unicode character lookup: paste text or a code point to see each character’s name, block, category and UTF-8 and UTF-16 bytes, or search by name.',
    keywords: ['unicode lookup', 'what character is this', 'code point', 'utf-8 bytes', 'unicode character name', 'invisible character detector'],
    category: 'reference',
    icon: 'Languages',
    faqs: [
      {
        q: 'What can I paste?',
        a: 'Any text, a code point such as U+00E9 or 0xE9, or an HTML entity number such as &#233;. The lookup lists every character, including invisible ones such as zero-width spaces.',
      },
      {
        q: 'Why do some characters have names like CJK UNIFIED IDEOGRAPH-4E2D?',
        a: 'Unicode names large sets of characters, such as Chinese ideographs and Korean syllables, by a rule from their code point instead of one by one.',
      },
      {
        q: 'What is the difference between UTF-8 and UTF-16?',
        a: 'Both encode the same code points. UTF-8 uses 1 to 4 bytes per character and is the web default. UTF-16 uses 2 or 4 bytes and is how JavaScript stores strings.',
      },
    ],
    related: ['emoji-search', 'ascii-table', 'character-counter', 'url-encoder-decoder'],
    updated: UPDATED,
  },
  {
    slug: 'life-expectancy-calculator',
    title: 'Life Expectancy Calculator',
    h1: 'Life expectancy calculator (US life table)',
    description:
      'Life expectancy calculator from the US period life table: years left at your age and sex, the chance to reach each later age, and a survival curve.',
    keywords: ['how long will i live', 'life expectancy by age', 'remaining life expectancy', 'life table', 'survival probability', 'actuarial life table'],
    category: 'health',
    icon: 'Hourglass',
    faqs: [
      {
        q: 'What is a period life table?',
        a: 'A table of the death rates at each age in one year, here from the US Social Security Administration. Life expectancy from it assumes that those rates stay the same for the rest of your life.',
      },
      {
        q: 'Why is my expected age higher than the life expectancy at birth?',
        a: 'Because you have already lived to your age. The table counts only the people who reached it, so the expected age at death goes up as you get older.',
      },
      {
        q: 'Does it account for health or lifestyle?',
        a: 'No. The table is an average for the whole US population of one sex. Smoking, health, income and other factors change individual risk a lot.',
      },
    ],
    related: ['age-calculator', 'bmi-calculator', 'retirement-calculator'],
    updated: UPDATED,
  },
  {
    slug: 'baby-name-popularity',
    title: 'Baby Name Popularity',
    h1: 'Baby name popularity in the US since 1880',
    description:
      'Baby name popularity from US Social Security data: rank and number of babies for any name each year since 1880, compared in an animated chart.',
    keywords: ['baby name rank', 'name popularity over time', 'popular baby names', 'how popular is my name', 'ssa baby names', 'name trends'],
    category: 'reference',
    icon: 'Baby',
    faqs: [
      {
        q: 'Where does the data come from?',
        a: 'From the US Social Security Administration, which counts the first names on applications for Social Security cards for babies born in the US. SSA adds each year in May.',
      },
      {
        q: 'Why is my name not found?',
        a: 'The tool includes the names that reached the top 1,000 for boys or girls in at least one year since 1880. SSA itself lists only names given to at least 5 babies of one sex in a year.',
      },
      {
        q: 'Are different spellings counted together?',
        a: 'No. SSA counts each spelling as a separate name, so Aiden and Aidan have separate ranks.',
      },
    ],
    related: ['random-picker', 'age-calculator', 'life-expectancy-calculator'],
    updated: UPDATED,
  },
  {
    slug: 'child-growth-percentile-calculator',
    title: 'Child Growth Percentile Calculator',
    h1: 'Child growth percentile calculator (CDC charts)',
    description:
      'Child growth percentile calculator with the CDC growth charts: weight, length, height, head size and BMI percentile and z-score from birth to age 20.',
    keywords: ['growth chart calculator', 'baby weight percentile', 'height percentile', 'bmi percentile for kids', 'head circumference percentile', 'cdc growth chart'],
    category: 'health',
    icon: 'Ruler',
    faqs: [
      {
        q: 'What does the percentile mean?',
        a: 'The percentage of children of the same age and sex in the reference population with a smaller measurement. At the 75th percentile, 75 of 100 children measure less.',
      },
      {
        q: 'Which charts are used?',
        a: 'The 2000 CDC growth charts: weight, length and head circumference from birth to 36 months, and weight, stature and BMI from 2 to 20 years. The CDC recommends the WHO charts for children under 2 in the US; a doctor may use those.',
      },
      {
        q: 'Is a low or high percentile a problem?',
        a: 'Not by itself. Doctors look at how a child follows a curve over time. A sudden change across percentile lines is a reason to ask a doctor.',
      },
    ],
    related: ['bmi-calculator', 'age-calculator', 'life-expectancy-calculator'],
    updated: UPDATED,
  },
]
