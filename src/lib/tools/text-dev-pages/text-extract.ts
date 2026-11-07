import type { Def, Section } from './types'
import { def } from './types'

const OFFLINE: Section = {
  h: 'Nothing leaves your device',
  p: ['The text is searched by JavaScript in this tab. It is not uploaded, so you can paste customer lists, logs and exports that must stay private.'],
}

export const EXTRACT_DEFS: Def[] = [
  def({
    slug: 'extract-emails',
    title: 'Extract Emails',
    h1: 'Extract email addresses from text',
    description: 'Find every email address in text, a CSV export or an HTML page. Remove duplicates, lowercase and sort, then copy the list or download it as a file.',
    keywords: ['email extractor', 'find email addresses', 'email address finder', 'pull emails from text'],
    category: 'text',
    icon: 'Mail',
    family: 'text',
    popular: true,
    faqs: [
      { q: 'Which addresses are found?', a: 'Any address with a local part, an @ and a domain with a dot and a top-level domain of at least two letters, such as name+tag@mail.example.co.uk.' },
      { q: 'Does it check that the address exists?', a: 'No. That would need a network request to the mail server. The tool only checks the format.' },
      { q: 'Can I paste HTML or a CSV file?', a: 'Yes. Addresses inside mailto links, table cells and quoted fields are found the same way.' },
    ],
    related: ['extract-urls', 'extract-phone-numbers', 'remove-duplicate-lines', 'sort-lines'],
    explainer: [
      {
        h: 'How addresses are matched',
        p: [
          'The pattern follows the common form of RFC 5322 addresses: letters, digits and the characters ! # $ % & \' * + / = ? ^ _ ` { | } ~ - in dot-separated parts before the @, then a domain made of labels that start and end with a letter or digit, and a top-level domain of two or more letters.',
          'Rare forms such as quoted local parts ("john doe"@example.com) or IP literals are not matched, because they almost never appear in real lists.',
        ],
      },
      OFFLINE,
    ],
  }),
  def({
    slug: 'extract-urls',
    title: 'Extract URLs',
    h1: 'Extract URLs and links from text',
    description: 'Find every http, https, ftp and www link in text or HTML. Trailing punctuation is trimmed, brackets are balanced, and duplicates can be removed.',
    keywords: ['url extractor', 'link extractor', 'find links in text', 'extract links from html'],
    category: 'text',
    icon: 'Link',
    family: 'text',
    faqs: [
      { q: 'Is the full stop at the end of a sentence removed?', a: 'Yes. Trailing punctuation such as . , ; : ! ? and quotes is not part of the URL.' },
      { q: 'What about links that end in a bracket?', a: 'A closing bracket stays when the URL contains a matching opening bracket, as in many wiki links. Otherwise it is treated as punctuation.' },
      { q: 'Are links without http found?', a: 'Links that start with www. are found when the option is on.' },
    ],
    related: ['extract-emails', 'url-parser', 'url-encoder-decoder', 'remove-duplicate-lines'],
    explainer: [
      {
        h: 'How links are found',
        p: [
          'A link starts with http://, https://, ftp:// or www. and runs to the next space, quote or angle bracket. Punctuation at the end is then trimmed, and a closing bracket is kept only when it closes a bracket that opened inside the link.',
          'To see the parts of a link (host, path, query parameters), paste it into the URL parser.',
        ],
      },
      OFFLINE,
    ],
  }),
  def({
    slug: 'extract-numbers',
    title: 'Extract Numbers',
    h1: 'Extract numbers from text',
    description: 'Pull every number out of text, with decimals, negatives, thousands separators and exponents. Shows the count, sum, average and range of the numbers.',
    keywords: ['number extractor', 'get numbers from text', 'extract digits', 'sum numbers in text'],
    category: 'text',
    icon: 'Hash',
    family: 'text',
    faqs: [
      { q: 'Does it understand 1.234,56?', a: 'Yes. Set the decimal mark to comma for European formats. Points and spaces are then thousands separators.' },
      { q: 'Are percentages included?', a: 'The number is found without the percent sign: 12.5% gives 12.5.' },
      { q: 'Can I add up the numbers?', a: 'Yes. The sum, average and range are shown above the list.' },
    ],
    related: ['remove-numbers-from-text', 'average-calculator', 'sort-lines', 'extract-phone-numbers'],
    explainer: [
      {
        h: 'What counts as a number',
        p: [
          'A number is an optional sign, digits with optional groups of three separated by commas, an optional decimal part and an optional exponent such as e3. A number glued to letters, as in "Q3" or "mp4", is not counted, so product names and codes do not pollute the list.',
          'Each number is converted to a value for the sum and average. With duplicates removed, equal values count once even when they are written differently (1,000 and 1000).',
        ],
      },
      OFFLINE,
    ],
  }),
  def({
    slug: 'extract-phone-numbers',
    title: 'Extract Phone Numbers',
    h1: 'Extract phone numbers from text',
    description: 'Find phone numbers in text in national and international formats, with spaces, dots, dashes or brackets. Optionally reduce each to digits only.',
    keywords: ['phone number extractor', 'find phone numbers', 'extract telephone numbers', 'phone number finder'],
    category: 'text',
    icon: 'Phone',
    family: 'text',
    faqs: [
      { q: 'Which formats are found?', a: 'Numbers of 7 to 15 digits in groups separated by spaces, dots, dashes or brackets, with an optional + or 00 country prefix: +1 (415) 555-0132, 020 7946 0958, 555.0199.' },
      { q: 'Are dates mistaken for phone numbers?', a: 'Dates such as 2026-11-07 or 07/11/2026 are skipped. A plain run of digits without separators is also skipped, because it is usually an ID.' },
      { q: 'Does it check that the number is real?', a: 'No. It checks the format only. Numbering plans differ by country and change over time.' },
    ],
    related: ['extract-emails', 'extract-numbers', 'remove-duplicate-lines', 'sort-lines'],
    explainer: [
      {
        h: 'How numbers are matched',
        p: [
          'International numbers have at most 15 digits (ITU-T E.164) and real numbers rarely have fewer than 7. The tool finds digit groups joined by separators, counts the digits and keeps groups of 7 to 15. With digits only on, the result keeps a leading + for international numbers and drops everything else.',
        ],
      },
      OFFLINE,
    ],
  }),
  def({
    slug: 'extract-hashtags',
    title: 'Extract Hashtags',
    h1: 'Extract hashtags and mentions from text',
    description: 'List every #hashtag or @mention in posts, captions and comments. Remove duplicates, lowercase and sort, then copy the tags for your next post.',
    keywords: ['hashtag extractor', 'find hashtags', 'mention extractor', 'extract @mentions'],
    category: 'text',
    icon: 'AtSign',
    family: 'text',
    faqs: [
      { q: 'Are hashtags in other languages found?', a: 'Yes. A hashtag can contain letters of any alphabet, digits and underscores, but needs at least one letter, so #1 is not a tag.' },
      { q: 'Is an anchor in a URL a hashtag?', a: 'No. A # directly after a letter, a slash or an ampersand, as in page#section or &#39;, is not counted.' },
      { q: 'What counts as a mention?', a: 'An @ followed by letters, digits, underscores and dots, not directly after another word character, so email addresses are skipped.' },
    ],
    related: ['extract-urls', 'extract-emails', 'word-frequency-counter', 'character-counter'],
    explainer: [
      {
        h: 'How tags are found',
        p: [
          'A hashtag is # followed by letters, digits or underscores with at least one letter, and it must not follow a letter, digit, slash or ampersand. A mention is @ followed by a name of letters, digits, underscores and inner dots, and it must not follow a word character or a dot, which rules out email addresses.',
          'Most networks treat tags as case insensitive, so the lowercase option merges #Sunset and #sunset.',
        ],
      },
      OFFLINE,
    ],
  }),
  def({
    slug: 'extract-ip-addresses',
    title: 'Extract IP Addresses',
    h1: 'Extract IP addresses from logs and text',
    description: 'Find every IPv4 and IPv6 address in logs, configs or text, including CIDR ranges. Invalid addresses such as 999.1.1.1 are skipped. Copy or download.',
    keywords: ['ip extractor', 'find ip addresses in log', 'grep ip address', 'extract ipv4', 'ipv6 extractor'],
    category: 'dev',
    icon: 'Network',
    family: 'text',
    faqs: [
      { q: 'Are invalid addresses skipped?', a: 'Yes. Each IPv4 octet must be 0 to 255, so 999.1.1.1 and version strings such as 1.2.3.4.5 are not matched.' },
      { q: 'Are CIDR ranges kept?', a: 'Yes. 192.0.2.0/24 is found with its prefix length.' },
      { q: 'How do I find out who owns an address?', a: 'Use the IP address lookup, which looks up the network and country in a local copy of public registry data.' },
    ],
    related: ['ip-address-lookup', 'ipv6-expander', 'ip-to-decimal', 'cidr-to-ip-range'],
    explainer: [
      {
        h: 'How addresses are matched',
        p: [
          'IPv4: four decimal numbers from 0 to 255 joined by dots, with an optional /0 to /32 prefix, not part of a longer dotted number. IPv6: groups of up to four hex digits joined by colons, with at most one :: and an optional zone (%eth0) or prefix. Each IPv6 candidate is then checked for the right number of groups.',
        ],
      },
      OFFLINE,
    ],
  }),
]
