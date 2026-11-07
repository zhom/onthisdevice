import type { Def, Section } from './types'
import { def } from './types'

const PRIVATE: Section = {
  h: 'Your text stays on this device',
  p: ['The tool is JavaScript that runs in this tab. The text is not uploaded, so lists of customers, logs and drafts stay private. After the page loads it also works offline.'],
}

export const LINES_DEFS: Def[] = [
  def({
    slug: 'add-line-numbers',
    title: 'Add Line Numbers',
    h1: 'Add line numbers to text',
    description: 'Number every line of text or code. Pick the start number and the separator, pad with zeros, and skip empty lines. Copy or download the result.',
    keywords: ['number lines', 'line numbering', 'numbered list maker', 'prefix line numbers'],
    category: 'text',
    icon: 'ListOrdered',
    family: 'text',
    faqs: [
      { q: 'Can I start at a number other than 1?', a: 'Yes. Set Start at to any whole number, including 0 or a negative number.' },
      { q: 'What does padding with zeros do?', a: 'All numbers get the same width, such as 01 to 12 or 001 to 120, so the text after them lines up and sorts correctly.' },
      { q: 'Are empty lines numbered?', a: 'Not by default. Turn off Skip empty lines to give blank lines a number too.' },
    ],
    related: ['add-prefix-and-suffix-to-lines', 'line-counter', 'sort-lines', 'remove-empty-lines'],
    explainer: [
      {
        h: 'How numbering works',
        p: [
          'Each line gets its number, the separator you pick and then the original text. With padding on, the width comes from the largest number, so 100 lines are numbered 001 to 100.',
          'Use a tab as separator to paste the result into a spreadsheet as two columns: number and text.',
        ],
      },
      PRIVATE,
    ],
  }),
  def({
    slug: 'add-prefix-and-suffix-to-lines',
    title: 'Add Prefix and Suffix to Lines',
    h1: 'Add text to the start and end of every line',
    description: 'Add a prefix, a suffix or both to every line. Quote a list of values for SQL or code, add bullets, or wrap lines in tags. Empty lines can be skipped.',
    keywords: ['add text to each line', 'prepend to lines', 'append to lines', 'line prefix tool', 'wrap each line'],
    category: 'text',
    icon: 'ListPlus',
    family: 'text',
    faqs: [
      { q: 'How do I quote each line for SQL?', a: "Set the prefix to ' and the suffix to ', (quote and comma). Remove the last comma by hand, or use list to comma-separated with single quotes." },
      { q: 'Can I add HTML tags?', a: 'Yes. Set the prefix to <li> and the suffix to </li> to make list items.' },
      { q: 'Are spaces in the prefix kept?', a: 'Yes. The prefix and suffix are added exactly as typed, including spaces.' },
    ],
    related: ['list-to-comma-separated', 'add-line-numbers', 'find-and-replace', 'sort-lines'],
    explainer: [
      {
        h: 'Common uses',
        table: {
          head: ['Prefix', 'Suffix', 'Result for apple'],
          rows: [
            ["'", "',", "'apple',"],
            ['- ', '', '- apple'],
            ['<li>', '</li>', '<li>apple</li>'],
            ['"', '": null,', '"apple": null,'],
          ],
        },
      },
      PRIVATE,
    ],
  }),
  def({
    slug: 'split-text',
    title: 'Split Text',
    h1: 'Split text into parts',
    description: 'Split long text into pieces by character count, word count, sentences or a delimiter. Words stay whole. For posts, text messages and form limits.',
    keywords: ['text splitter', 'split text by characters', 'chunk text', 'split string by delimiter', 'split long text'],
    category: 'text',
    icon: 'Scissors',
    family: 'text',
    faqs: [
      { q: 'Does it cut words in half?', a: 'No. When splitting by characters, each piece ends at the last space before the limit. Only a single word longer than the limit is cut.' },
      { q: 'How do I split at line breaks or tabs?', a: 'Choose Delimiter and type \\n for a line break or \\t for a tab.' },
      { q: 'How are sentences detected?', a: 'A sentence ends at a full stop, question mark or exclamation mark, with any closing quote or bracket after it.' },
    ],
    related: ['wrap-text', 'character-counter', 'comma-separated-to-list', 'word-counter'],
    explainer: [
      {
        h: 'Four ways to split',
        list: [
          'Characters: pieces of at most N characters. Line breaks become spaces, and each piece ends at a word boundary.',
          'Words: pieces of N words each.',
          'Sentences: one sentence per piece.',
          'Delimiter: the text is cut at every occurrence of the delimiter, which is removed. Pieces are shown one per line.',
        ],
      },
      {
        h: 'Typical limits',
        table: {
          head: ['Where', 'Limit'],
          rows: [
            ['SMS (GSM-7)', '160 characters, or 153 per part in a long message'],
            ['SMS with emoji or accents (UCS-2)', '70 characters, or 67 per part'],
            ['Meta description', 'About 155 characters'],
            ['Short post', '280 to 500 characters, depending on the network'],
          ],
        },
      },
    ],
  }),
  def({
    slug: 'wrap-text',
    title: 'Wrap Text',
    h1: 'Wrap text at a fixed width',
    description: 'Hard-wrap text at 72, 80 or any number of columns. Words stay whole, indentation is kept, and long words can be broken. For email, commits and code.',
    keywords: ['word wrap', 'line wrap', 'hard wrap text', 'wrap at 80 characters', 'text wrapper'],
    category: 'text',
    icon: 'WrapText',
    family: 'text',
    faqs: [
      { q: 'What width should I use?', a: '72 is common for plain text email and git commit bodies, 80 for code and terminals, and 100 or 120 for some code styles.' },
      { q: 'Is indentation kept?', a: 'Yes. When a line is wrapped, each new line gets the same leading spaces as the original line.' },
      { q: 'How do I unwrap text again?', a: 'Use the remove line breaks tool, which joins wrapped lines back into paragraphs.' },
    ],
    related: ['remove-line-breaks', 'split-text', 'character-counter', 'tabs-to-spaces'],
    explainer: [
      {
        h: 'How wrapping works',
        p: [
          'Each line longer than the width is cut at the last space that fits, and the rest moves to a new line with the same indentation. Lines that already fit are not touched, so paragraphs and lists keep their shape.',
          'A word longer than the width, such as a URL, stays on its own line unless you turn on breaking long words.',
        ],
      },
      PRIVATE,
    ],
  }),
  def({
    slug: 'list-to-comma-separated',
    title: 'List to Comma-Separated',
    h1: 'Convert a list to comma-separated values',
    description: 'Turn a column of values into one comma-separated line. Add quotes, wrap in brackets for an SQL IN list, remove duplicates, or pick another separator.',
    keywords: ['comma separator', 'column to comma separated', 'list to csv', 'join list with commas', 'sql in list generator'],
    category: 'text',
    icon: 'List',
    family: 'text',
    popular: true,
    faqs: [
      { q: 'How do I make an SQL IN list?', a: "Choose single quotes and wrap in ( ). The result looks like ('a', 'b', 'c'). Quotes inside values are doubled, as SQL expects." },
      { q: 'Can I paste a column from a spreadsheet?', a: 'Yes. Each cell of the column is one line, which becomes one item.' },
      { q: 'Are empty lines included?', a: 'No. Empty lines are skipped, so a trailing blank line does not create an empty item.' },
    ],
    related: ['comma-separated-to-list', 'add-prefix-and-suffix-to-lines', 'remove-duplicate-lines', 'remove-line-breaks'],
    explainer: [
      {
        h: 'How it works',
        p: [
          'Each non-empty line is one item. Items are trimmed, optionally deduplicated, optionally quoted, then joined with the separator. A quote character inside an item is escaped: doubled for single quotes (SQL style) and prefixed with a backslash for double quotes.',
        ],
      },
      {
        h: 'Examples',
        table: {
          head: ['Options', 'Result'],
          rows: [
            ['Comma and space', 'apple, banana, cherry'],
            ['Single quotes, ( )', "('apple', 'banana', 'cherry')"],
            ['Double quotes, [ ]', '["apple", "banana", "cherry"]'],
            ['Pipe', 'apple | banana | cherry'],
          ],
        },
      },
    ],
  }),
  def({
    slug: 'comma-separated-to-list',
    title: 'Comma-Separated to List',
    h1: 'Convert comma-separated values to a list',
    description: 'Split comma, semicolon, pipe or tab separated values into one item per line. Detects the separator, keeps quoted values whole and removes quotes.',
    keywords: ['comma to new line', 'csv to list', 'split by comma', 'comma separated to column', 'replace comma with line break'],
    category: 'text',
    icon: 'Rows3',
    family: 'text',
    faqs: [
      { q: 'What if a value contains a comma?', a: 'Put the value in quotes: "cherry, red" stays one item. The quotes are removed in the result when Remove surrounding quotes is on.' },
      { q: 'How is the separator detected?', a: 'The tool counts commas, semicolons, tabs and pipes and uses the one that appears most often.' },
      { q: 'Can I paste the result into a spreadsheet?', a: 'Yes. Each line becomes one cell of a column.' },
    ],
    related: ['list-to-comma-separated', 'split-text', 'csv-to-json', 'sort-lines'],
    explainer: [
      {
        h: 'How it works',
        p: [
          'The text is split at each separator outside quotes. Line breaks in the input count as separators too. Each value is trimmed, quotes around it are removed if you ask, and empty values are skipped.',
          'For real CSV files with several columns, use CSV to JSON or CSV to Excel, which keep the columns.',
        ],
      },
      PRIVATE,
    ],
  }),
]
