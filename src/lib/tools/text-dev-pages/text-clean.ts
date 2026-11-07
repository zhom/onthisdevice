import type { Def } from './types'
import { def } from './types'

export const CLEAN_DEFS: Def[] = [
  def({
    slug: 'remove-extra-spaces',
    title: 'Remove Extra Spaces',
    h1: 'Remove extra spaces from text',
    description: 'Collapse double spaces, tabs and non-breaking spaces into single spaces and trim each line. Paste text from PDFs or email and get clean text.',
    keywords: ['remove double spaces', 'remove whitespace', 'collapse spaces', 'trim spaces', 'remove multiple spaces'],
    category: 'text',
    icon: 'Space',
    family: 'text',
    faqs: [
      { q: 'Does it remove line breaks too?', a: 'No. Lines stay as they are. To join lines, use the remove line breaks tool; to delete blank lines, use remove empty lines.' },
      { q: 'What is a non-breaking space?', a: 'A space character (U+00A0) that looks normal but stops a line from breaking. Text copied from web pages and word processors often contains it, and it breaks searches.' },
      { q: 'Does it change spaces inside code?', a: 'Yes, every run of spaces becomes one. Turn off trimming to keep indentation at the start of lines, or use tabs to spaces for code.' },
    ],
    related: ['remove-empty-lines', 'remove-line-breaks', 'tabs-to-spaces', 'remove-non-ascii-characters'],
    explainer: [
      {
        h: 'What counts as an extra space',
        p: [
          'Two or more spaces in a row become one space. With the wide spaces option on, a tab, a non-breaking space (U+00A0), the thin and em spaces (U+2000 to U+200A), the narrow no-break space (U+202F) and the ideographic space (U+3000) also become a normal space. Trimming removes spaces at the start and end of every line.',
          'Text copied from PDFs, slides and web pages often has these characters. They look like normal spaces but break search, sorting and comparison.',
        ],
      },
      {
        h: 'Examples',
        table: {
          head: ['Before', 'After'],
          rows: [
            ['Hello␣␣␣world', 'Hello world'],
            ['␣␣indented␣line␣', 'indented line'],
            ['tab→separated', 'tab separated'],
          ],
        },
      },
    ],
  }),
  def({
    slug: 'remove-empty-lines',
    title: 'Remove Empty Lines',
    h1: 'Remove empty lines from text',
    description: 'Delete blank lines, including lines that hold only spaces or tabs. Optionally keep one blank line between paragraphs. Copy or download the result.',
    keywords: ['remove blank lines', 'delete empty lines', 'remove white lines', 'strip blank lines'],
    category: 'text',
    icon: 'ListCollapse',
    family: 'text',
    faqs: [
      { q: 'Are lines with only spaces removed?', a: 'Yes. A line that holds only spaces or tabs counts as empty.' },
      { q: 'Can I keep paragraphs apart?', a: 'Yes. Turn on Keep one blank line between paragraphs. Several blank lines then become one.' },
      { q: 'Does it handle Windows line endings?', a: 'Yes. CRLF, LF and old Mac CR line endings are all recognized. The result uses LF.' },
    ],
    related: ['remove-extra-spaces', 'remove-duplicate-lines', 'remove-line-breaks', 'line-counter'],
    explainer: [
      {
        h: 'How it works',
        p: [
          'The text is split into lines at every line ending: LF, CRLF or CR. A line is empty when it has no characters other than spaces and tabs. Empty lines are dropped and the rest are joined with LF.',
          'With paragraphs kept, a run of empty lines between two lines of text becomes exactly one empty line, so the structure stays readable.',
        ],
      },
    ],
  }),
  def({
    slug: 'remove-punctuation',
    title: 'Remove Punctuation',
    h1: 'Remove punctuation from text',
    description: 'Strip punctuation marks from text in any language. Keep apostrophes in words such as don\'t, keep hyphens, or also remove symbols such as $ and %.',
    keywords: ['strip punctuation', 'delete punctuation', 'punctuation remover', 'remove commas and periods'],
    category: 'text',
    icon: 'Eraser',
    family: 'text',
    faqs: [
      { q: 'Which characters are punctuation?', a: 'Every character in the Unicode punctuation categories: . , ; : ! ? quotes, brackets, dashes, slashes and their equivalents in other scripts, such as 、。« ».' },
      { q: 'Are $, % and + punctuation?', a: 'No, Unicode calls them symbols. Turn on Also remove symbols to remove them too.' },
      { q: 'Why keep apostrophes?', a: "So that contractions stay words: don't stays don't instead of becoming dont." },
    ],
    related: ['remove-special-characters', 'remove-numbers-from-text', 'word-frequency-counter', 'remove-extra-spaces'],
    explainer: [
      {
        h: 'How punctuation is found',
        p: [
          'The tool removes every character in the Unicode General Category P (punctuation): connectors, dashes, open and close brackets, quotes and other marks. This covers all scripts, not only English.',
          'An apostrophe between two letters and a hyphen between two letters can be kept, so contractions and compound words survive. Symbols (category S: currency, math, arrows, emoji) are a separate option.',
        ],
      },
      {
        h: 'Example',
        table: {
          head: ['Option', 'Result for "It\'s a well-known fact: $5!"'],
          rows: [
            ['Default', "It's a wellknown fact $5"],
            ['Keep hyphens', "It's a well-known fact $5"],
            ['Also remove symbols', "It's a wellknown fact 5"],
          ],
        },
      },
    ],
  }),
  def({
    slug: 'remove-numbers-from-text',
    title: 'Remove Numbers from Text',
    h1: 'Remove numbers from text',
    description: 'Delete digits or whole numbers with their separators from any text, then tidy the spaces left behind. Handles decimals, negatives and percentages.',
    keywords: ['remove digits', 'strip numbers', 'delete numbers from text', 'number remover'],
    category: 'text',
    icon: 'Hash',
    family: 'text',
    faqs: [
      { q: 'What is the difference between digits and whole numbers?', a: 'Digits removes only 0 to 9, so 1,299.50 leaves ",." behind. Whole numbers removes the number with its separators, sign and percent sign.' },
      { q: 'Are digits in other scripts removed?', a: 'In digits mode, yes: every Unicode decimal digit, such as Arabic-Indic and Devanagari digits, is removed.' },
      { q: 'What does tidy do?', a: 'It removes the double spaces and the spaces before punctuation that are left where numbers were.' },
    ],
    related: ['extract-numbers', 'remove-punctuation', 'remove-special-characters', 'remove-extra-spaces'],
    explainer: [
      {
        h: 'How numbers are matched',
        p: [
          'In whole number mode a number is an optional sign, digits with optional thousands commas, an optional decimal part, an optional exponent and an optional percent sign: `-1,299.50`, `2.5e3` and `12%` are each removed in one piece. In digits mode each decimal digit is removed on its own.',
          'To keep the numbers and drop the text instead, use extract numbers.',
        ],
      },
    ],
  }),
  def({
    slug: 'remove-accents',
    title: 'Remove Accents',
    h1: 'Remove accents and diacritics from text',
    description: 'Remove accents and diacritics: é to e, ñ to n, ü to u. Optionally replace ø, ß, æ and ł too. For slugs, file names, search and old systems.',
    keywords: ['remove diacritics', 'strip accents', 'unaccent', 'convert accented characters', 'remove umlauts'],
    category: 'text',
    icon: 'Languages',
    family: 'text',
    faqs: [
      { q: 'How are accents removed?', a: 'Each letter is split into a base letter and its combining marks (Unicode NFD), the marks are deleted, and the text is recomposed.' },
      { q: 'Why does ø not change by default?', a: 'Letters such as ø, ß, æ, ł and đ have no separate accent mark. Turn on the special letters option to replace them with o, ss, ae, l and d.' },
      { q: 'Does it change Greek or Cyrillic letters?', a: 'Accents on them are removed (ά to α), but the letters are not transliterated to Latin.' },
    ],
    related: ['remove-non-ascii-characters', 'slug-generator', 'unicode-normalizer', 'remove-special-characters'],
    explainer: [
      {
        h: 'How diacritics are removed',
        p: [
          'Unicode can write é as one character (U+00E9) or as e followed by a combining acute accent (U+0301). The tool converts the text to the second form (NFD), deletes every nonspacing mark (category Mn) and converts the result back to the composed form (NFC).',
          'Letters that are not a base letter plus a mark need a lookup table. With the option on, ø becomes o, ß becomes ss, æ becomes ae, œ becomes oe, ł becomes l, đ and ð become d and þ becomes th.',
        ],
      },
      {
        h: 'Examples',
        table: {
          head: ['Input', 'Output'],
          rows: [
            ['Crème brûlée', 'Creme brulee'],
            ['São Paulo', 'Sao Paulo'],
            ['Łódź', 'Lodz'],
            ['Straße', 'Strasse'],
          ],
        },
      },
    ],
  }),
  def({
    slug: 'remove-html-tags',
    title: 'Remove HTML Tags',
    h1: 'Remove HTML tags and get plain text',
    description: 'Strip HTML tags from code and keep the readable text. Removes scripts, styles and comments, decodes entities, and keeps paragraphs as lines.',
    keywords: ['strip html', 'html to plain text', 'remove tags', 'html tag remover', 'clean html'],
    category: 'text',
    icon: 'CodeXml',
    family: 'text',
    faqs: [
      { q: 'Is the content of script and style tags removed?', a: 'Yes. Scripts, styles, templates, inline SVG and comments are removed with their content, because they are not readable text.' },
      { q: 'Does the HTML run in my browser?', a: 'No. The tool reads the markup as text with patterns and never renders it, so scripts in it cannot run.' },
      { q: 'What happens to &nbsp; and other entities?', a: 'With entity decoding on, named and numeric entities become their characters: &amp; becomes & and &#233; becomes é.' },
    ],
    related: ['markdown-to-text', 'html-to-markdown', 'html-entity-encoder', 'remove-extra-spaces'],
    explainer: [
      {
        h: 'How tags are removed',
        p: [
          'First, comments and the elements whose content is not text (script, style, noscript, template, svg and head) are removed. Then block elements such as p, div, h1 to h6, li and br become line breaks, list items get a leading dash and table cells are separated by tabs. All other tags are deleted, entities are decoded, and spaces and blank lines are tidied.',
          'The markup is never parsed by the browser as a page, so nothing in it can load or run.',
        ],
      },
    ],
  }),
  def({
    slug: 'remove-special-characters',
    title: 'Remove Special Characters',
    h1: 'Remove special characters from text',
    description: 'Remove symbols, emoji and other special characters and keep letters, numbers and spaces. Optionally keep basic punctuation and accented letters.',
    keywords: ['strip special characters', 'remove symbols', 'alphanumeric only', 'clean text', 'special character remover'],
    category: 'text',
    icon: 'Asterisk',
    family: 'text',
    faqs: [
      { q: 'What does it keep?', a: 'Letters of any alphabet, digits, spaces and line breaks. With basic punctuation on, it also keeps . , ; : ! ? quotes, brackets and hyphens.' },
      { q: 'Are accented letters special characters?', a: 'They are kept by default. Turn off Keep accented letters to change é to e and ß to ss instead.' },
      { q: 'Can I use it to make file names?', a: 'Yes, but the slug generator is better for that: it also replaces spaces with dashes and limits the length.' },
    ],
    related: ['remove-punctuation', 'remove-emojis', 'remove-non-ascii-characters', 'slug-generator'],
    explainer: [
      {
        h: 'What counts as special',
        p: [
          'Any character that is not a letter (Unicode category L), a number (category N) or whitespace is removed: symbols, currency signs, arrows, emoji, math signs and, unless you keep it, punctuation.',
          'This is stricter than remove punctuation, which keeps symbols, and gentler than remove non-ASCII, which also removes letters outside A to Z.',
        ],
      },
    ],
  }),
  def({
    slug: 'remove-emojis',
    title: 'Remove Emojis',
    h1: 'Remove emojis from text',
    description: 'Delete every emoji from text, including skin tones, flags, keycaps and joined sequences, and keep the words. Shows how many emoji were removed.',
    keywords: ['emoji remover', 'strip emoji', 'delete emojis', 'remove emoticons'],
    category: 'text',
    icon: 'Smile',
    family: 'text',
    faqs: [
      { q: 'Does it remove skin tones and family emoji completely?', a: 'Yes. An emoji with a skin tone modifier, a flag or a sequence joined with zero-width joiners is removed as one unit, with no stray characters left.' },
      { q: 'Are © and ™ removed?', a: 'No. These symbols are normal text in most writing, so they are kept, as are digits, # and *.' },
      { q: 'Why are emoji a problem in some systems?', a: 'Old databases and SMS gateways store text in encodings without emoji. An emoji can turn into question marks or make a text message use the shorter Unicode limit.' },
    ],
    related: ['remove-special-characters', 'remove-non-ascii-characters', 'emoji-search', 'character-counter'],
    explainer: [
      {
        h: 'How emoji are detected',
        p: [
          'The tool uses the Unicode Extended_Pictographic property, which lists every emoji and pictograph. It also removes the parts that build emoji: skin tone modifiers (U+1F3FB to U+1F3FF), the variation selector U+FE0F, the zero-width joiner, regional indicator letters that form flags, keycap sequences and tag characters.',
          'A family or a profession emoji is a sequence of several emoji joined by zero-width joiners. It is removed as a whole.',
        ],
      },
    ],
  }),
  def({
    slug: 'remove-non-ascii-characters',
    title: 'Remove Non-ASCII Characters',
    h1: 'Remove non-ASCII characters',
    description: 'Make text plain ASCII: accents become base letters, curly quotes become straight, and other characters are removed. For code, CSV files and old systems.',
    keywords: ['ascii only', 'strip unicode', 'convert to ascii', 'remove unicode characters', 'non ascii remover'],
    category: 'text',
    icon: 'Binary',
    family: 'text',
    faqs: [
      { q: 'What is ASCII?', a: 'The 128-character set from 1963: English letters, digits, basic punctuation and control codes. This tool keeps the printable range from space (32) to tilde (126), plus tabs and line breaks.' },
      { q: 'What does replace with the nearest ASCII do?', a: 'Before removing anything, é becomes e, ß becomes ss, “ and ” become ", dashes become - and an ellipsis becomes three dots. Characters with no equivalent are then removed.' },
      { q: 'Can I see which characters were the problem?', a: 'Use the Unicode character lookup to see each character of the original text with its name and code point.' },
    ],
    related: ['remove-accents', 'smart-quotes-to-straight-quotes', 'unicode-character-lookup', 'remove-special-characters'],
    explainer: [
      {
        h: 'How the conversion works',
        p: [
          'Every character outside the printable ASCII range (U+0020 to U+007E) is removed, except tabs and line breaks when you keep lines. With the nearest ASCII option on, the text first goes through accent removal and quote and dash replacement, so most European text keeps its meaning.',
          'Scripts with no Latin equivalent, such as Chinese or Arabic, are removed completely. Transliteration of those scripts needs a dictionary and is not done here.',
        ],
      },
    ],
  }),
  def({
    slug: 'smart-quotes-to-straight-quotes',
    title: 'Smart Quotes to Straight Quotes',
    h1: 'Convert smart quotes to straight quotes',
    description: 'Replace curly “smart” quotes and apostrophes with straight ones, plus dashes and ellipses, or curl straight quotes. For code, CSV and JSON.',
    keywords: ['curly quotes to straight', 'fix smart quotes', 'straight quotes converter', 'replace curly apostrophe'],
    category: 'text',
    icon: 'Quote',
    family: 'text',
    faqs: [
      { q: 'Why do smart quotes break code?', a: 'Programming languages, JSON and shells only accept the straight quote characters " and \'. A curly quote pasted from a word processor causes a syntax error.' },
      { q: 'Which characters are replaced?', a: '“ ” „ ‟ « » and the double prime become ", and ‘ ’ ‚ ‛ ‹ › and the prime become \'. With the extra option, en and em dashes become -, … becomes ... and non-breaking spaces become spaces.' },
      { q: 'Can it make straight quotes curly?', a: 'Yes. Switch to Straight to smart. A quote after a space, a bracket or the start of a line opens; others close. Apostrophes inside words become ’.' },
    ],
    related: ['remove-non-ascii-characters', 'json-escape', 'remove-extra-spaces', 'find-and-replace'],
    explainer: [
      {
        h: 'Straight and typographic quotes',
        table: {
          head: ['Character', 'Name', 'Becomes'],
          rows: [
            ['“ ”', 'Left and right double quotation marks', '"'],
            ['‘ ’', 'Left and right single quotation marks', "'"],
            ['„ ‚', 'Low quotation marks (German, Polish)', '" and \''],
            ['« » ‹ ›', 'Guillemets', '" and \''],
            ['– —', 'En dash and em dash', '-'],
            ['…', 'Horizontal ellipsis', '...'],
          ],
        },
      },
      {
        h: 'Curling quotes',
        p: [
          'In the other direction, a straight quote that follows a space, an opening bracket, a dash or the start of a line becomes an opening quote; every other quote becomes a closing quote. An apostrophe between two letters becomes ’. Check quotes that start with an apostrophe, such as ’90s, by hand.',
        ],
      },
    ],
  }),
  def({
    slug: 'tabs-to-spaces',
    title: 'Tabs to Spaces',
    h1: 'Convert tabs to spaces and spaces to tabs',
    description: 'Convert tab indentation to spaces with correct tab stops, or spaces back to tabs. Choose the tab width, convert code or text, then copy the result.',
    keywords: ['convert tabs to spaces', 'spaces to tabs', 'indentation converter', 'expand tabs', 'tab to space converter'],
    category: 'text',
    icon: 'IndentIncrease',
    family: 'text',
    faqs: [
      { q: 'Does a tab always become the same number of spaces?', a: 'No. A tab moves to the next tab stop, so it becomes 1 to 4 spaces at width 4, depending on the column. This keeps tables and aligned comments in line.' },
      { q: 'Which tab width should I use?', a: 'Most code uses 2 or 4. Go and Makefiles use real tabs, and many terminals show a tab as 8 columns.' },
      { q: 'What does only the indentation mean?', a: 'When converting spaces to tabs, only the spaces at the start of each line are replaced, so spaces inside strings and comments stay as they are.' },
    ],
    related: ['remove-extra-spaces', 'json-formatter', 'html-formatter', 'css-formatter'],
    explainer: [
      {
        h: 'Tab stops',
        p: [
          'A tab is not a fixed number of spaces: it moves the cursor to the next multiple of the tab width. With width 4, a tab at column 0 gives 4 spaces and a tab at column 6 gives 2. The converter counts columns the same way, so aligned text stays aligned.',
          'Spaces to tabs replaces each full group of tab-width spaces with one tab. Leftover spaces stay, so indentation that is not a multiple of the width is kept exactly.',
        ],
      },
    ],
  }),
  def({
    slug: 'remove-duplicate-words',
    title: 'Remove Duplicate Words',
    h1: 'Remove duplicate words from text',
    description: 'Fix repeated words such as "the the", or keep only the first use of every word in a list. Case sensitive or not. Shows how many words were removed.',
    keywords: ['repeated words', 'duplicate word remover', 'remove repeated words', 'unique words'],
    category: 'text',
    icon: 'Repeat',
    family: 'text',
    faqs: [
      { q: 'What is the difference between the two modes?', a: 'Repeats in a row only removes a word that directly repeats the word before it, a common typo. Every repeat removes all later uses of a word anywhere in the text.' },
      { q: 'Is "The the" a repeat?', a: 'Yes, unless you turn on case sensitive.' },
      { q: 'How do I remove duplicate lines instead?', a: 'Use the remove duplicate lines tool, which compares whole lines.' },
    ],
    related: ['remove-duplicate-lines', 'word-frequency-counter', 'find-and-replace', 'word-counter'],
    explainer: [
      {
        h: 'How repeats are found',
        p: [
          'In the default mode, a word followed by whitespace and the same word again is reduced to one copy. This catches the doubled words that spell checkers often miss, especially across a line break.',
          'In every repeat mode, the tool remembers each word it has seen and deletes later copies. Use it on lists of tags or keywords; on prose it will remove words such as "the" and break sentences.',
        ],
      },
    ],
  }),
]
