import type { Tool } from './types'

export const tools: Tool[] = [
  {
    slug: 'word-counter',
    title: 'Word Counter',
    h1: 'Word counter with reading time and keyword density',
    description:
      'Count words, characters, sentences, paragraphs and reading time as you type, with keyword density and live social character limits.',
    keywords: [
      'word count',
      'character count',
      'words to minutes',
      'reading time calculator',
      'keyword density checker',
      'essay word counter',
      'sentence counter',
      'paragraph counter',
    ],
    category: 'text',
    icon: 'Type',
    popular: true,
    accepts: ['txt', 'md', 'csv'],
    faqs: [
      {
        q: 'How are words counted?',
        a: 'A word is any run of non-space characters with at least one letter or digit. Most word processors use the same rule. "Rock-solid" and "isn\'t" each count as one word. A lone dash or bullet does not count.',
      },
      {
        q: 'How is reading time calculated?',
        a: 'The word count is divided by a reading speed, then rounded. The default of 238 words per minute comes from Brysbaert\'s 2019 meta-analysis of adult silent reading. You can switch to 150 wpm for technical material or 350 wpm for skimming. Speaking time uses 140 wpm, a comfortable presentation pace.',
      },
      {
        q: 'What counts as a sentence?',
        a: 'A sentence ends at a full stop, question mark, exclamation mark or ellipsis followed by whitespace or the end of the text, and also at a blank line. Common abbreviations such as "Dr." and initials such as "J. R. R." are not treated as sentence endings.',
      },
      {
        q: 'What is a good keyword density?',
        a: 'For SEO copy, 0.5–2.5% for your main phrase reads naturally. Above about 4%, it looks like keyword stuffing. Set the phrase length to two or three words to see the multi-word phrases that search engines match.',
      },
      {
        q: 'Is my text uploaded anywhere?',
        a: 'No. Every count is computed by JavaScript in this tab. There is no server call, no analytics event containing your text, and the page keeps working with the network switched off.',
      },
    ],
    related: [
      'character-counter',
      'case-converter',
      'text-diff-checker',
      'remove-line-breaks',
      'sort-lines',
      'markdown-to-html',
    ],
    updated: '2026-11-01',
  },
  {
    slug: 'character-counter',
    title: 'Character Counter',
    h1: 'Character counter with limits and byte size',
    description:
      'Count characters with and without spaces against any limit, with a live progress ring, UTF-8 byte size and SMS segment counts.',
    keywords: [
      'character count',
      'letter counter',
      'twitter character counter',
      'sms character counter',
      'meta description length',
      'utf-8 byte count',
      'text length checker',
    ],
    category: 'text',
    icon: 'Hash',
    accepts: ['txt', 'md'],
    faqs: [
      {
        q: 'Do spaces count as characters?',
        a: 'Usually, yes. Twitter/X, SMS gateways and HTML meta tags all count spaces. The tool shows both counts, and you choose if spaces count towards the limit you set.',
      },
      {
        q: 'Why is the byte count higher than the character count?',
        a: 'UTF-8 uses one byte for plain ASCII, two for most accented Latin and Greek letters, three for most CJK characters and four for emoji. Database columns and HTTP headers usually measure bytes, so a 200-character bio can exceed a 255-byte column.',
      },
      {
        q: 'How are SMS segments worked out?',
        a: 'If every character fits the GSM-7 alphabet, a single message holds 160 characters and each part of a longer message holds 153. One character outside that alphabet, such as a curly quote or an emoji, forces UCS-2 encoding, which drops the limits to 70 and 67.',
      },
      {
        q: 'How long should a meta description be?',
        a: 'Google truncates around 155–160 characters on desktop and closer to 120 on mobile, so aim for 150 with the important words first. The tool marks the 155-character line for you.',
      },
    ],
    related: [
      'word-counter',
      'case-converter',
      'remove-line-breaks',
      'text-repeater',
      'slug-generator',
      'lorem-ipsum-generator',
    ],
    updated: '2026-11-01',
  },
  {
    slug: 'case-converter',
    title: 'Case Converter',
    h1: 'Case converter: UPPER, lower, Title Case and code cases',
    description:
      'Convert text case to UPPER, lower, Title Case, Sentence case, camelCase, snake_case or kebab-case. Acronyms such as NASA stay uppercase.',
    keywords: [
      'uppercase converter',
      'lowercase converter',
      'title case converter',
      'sentence case',
      'camelcase converter',
      'snake case',
      'kebab case',
      'capitalize each word',
    ],
    category: 'text',
    icon: 'CaseSensitive',
    popular: true,
    accepts: ['txt', 'md'],
    faqs: [
      {
        q: 'What is the difference between Title Case and Capitalise Each Word?',
        a: 'Title Case follows editorial style: articles, conjunctions and short prepositions such as "a", "of" and "the" stay lowercase unless they open or close the line. Capitalise Each Word capitalises everything, which is what you want for names and menu labels.',
      },
      {
        q: 'Are acronyms preserved?',
        a: 'Yes. Title Case and Capitalise Each Word leave a fully uppercase word of two or more letters, such as NASA, API or PDF, as it is. NASA does not become "Nasa".',
      },
      {
        q: 'How does it handle multi-line input?',
        a: 'Each line is converted separately. A list of headings stays a list of headings, and a list of labels becomes a list of separate camelCase or snake_case identifiers.',
      },
      {
        q: 'What is iNVERSE case for?',
        a: 'It swaps the case of every letter. This repairs a sentence typed with Caps Lock on while holding Shift, such as "hELLO wORLD".',
      },
      {
        q: 'Does it work offline?',
        a: 'Yes. All the conversion code loads with the page. After it loads, you can disconnect and it keeps working. Nothing you paste is sent.',
      },
    ],
    related: [
      'word-counter',
      'slug-generator',
      'find-and-replace',
      'reverse-text',
      'text-diff-checker',
    ],
    updated: '2026-11-01',
  },
  {
    slug: 'text-diff-checker',
    title: 'Text Diff Checker',
    h1: 'Text diff checker: compare two texts',
    description:
      'Text diff checker that compares two texts line by line and word by word. See the changes side by side or download a unified .diff patch.',
    keywords: [
      'text compare',
      'diff checker',
      'compare two files',
      'difference between two texts',
      'unified diff',
      'side by side comparison',
      'contract comparison',
    ],
    category: 'text',
    icon: 'GitCompare',
    popular: true,
    accepts: ['txt', 'md', 'csv', 'json'],
    faqs: [
      {
        q: 'Which diff algorithm is used?',
        a: 'Myers\' O(ND) greedy algorithm, the same family that git uses, with a patience-style pass that anchors on lines that appear exactly once in both texts. This keeps large, heavily edited files fast and still gives a minimal edit script.',
      },
      {
        q: 'Can I compare files instead of pasting?',
        a: 'Yes. Drop a .txt, .md, .csv or code file onto either box, or use the Open file button.',
      },
      {
        q: 'What does "ignore whitespace" ignore?',
        a: 'It collapses runs of spaces and tabs to one space and trims each line before comparing, so re-indented code or re-wrapped prose stops showing as a change. The output still shows the original text.',
      },
      {
        q: 'Can I use the result in git?',
        a: 'Yes. "Download .diff" produces a standard unified patch with @@ hunk headers and three lines of context, which git apply and most review tools accept.',
      },
      {
        q: 'How large a file can it handle?',
        a: 'A few megabytes. Above about 6,000 changed lines, the tool skips word-level highlighting to keep the page responsive and caps the on-screen table. The downloaded diff always contains every change.',
      },
    ],
    related: [
      'remove-duplicate-lines',
      'sort-lines',
      'find-and-replace',
      'word-counter',
      'json-formatter',
    ],
    updated: '2026-11-01',
  },
  {
    slug: 'remove-duplicate-lines',
    title: 'Remove Duplicate Lines',
    h1: 'Remove duplicate lines from a list',
    description:
      'Remove duplicate lines from a list and keep the first or last copy, or show only the repeats. Has options for case, trimming and blank lines.',
    keywords: [
      'delete duplicate lines',
      'dedupe list',
      'unique lines',
      'remove repeated lines',
      'find duplicates in list',
      'email list dedupe',
    ],
    category: 'text',
    icon: 'CopyMinus',
    accepts: ['txt', 'csv'],
    faqs: [
      {
        q: 'Does it keep the original order?',
        a: 'Yes. Unlike sort-based deduplication, the remaining lines stay where they were. Choose "keep first" to keep the earliest occurrence or "keep last" to keep the most recent one.',
      },
      {
        q: 'How do I see which lines were duplicated?',
        a: 'Switch to "Show only duplicates". You get one entry per repeated value, and the count prefix option adds the number of occurrences before each line, separated by a tab so it pastes cleanly into a spreadsheet.',
      },
      {
        q: 'Are trailing spaces treated as a difference?',
        a: 'Only if you turn "Trim each line" off. With trimming on (the default), "apple" and "apple " are the same line. This is usually correct for lists exported from spreadsheets.',
      },
      {
        q: 'How many lines can it handle?',
        a: 'Hundreds of thousands. The tool reads lines in chunks with a pause between them, so the browser stays responsive.',
      },
    ],
    related: ['sort-lines', 'text-diff-checker', 'remove-line-breaks', 'find-and-replace', 'word-counter'],
    updated: '2026-11-01',
  },
  {
    slug: 'sort-lines',
    title: 'Sort Lines',
    h1: 'Sort lines alphabetically, numerically or naturally',
    description:
      'Sort lines alphabetically, numerically, naturally, by length or at random, with case sensitivity, deduplication and blank-line removal.',
    keywords: [
      'alphabetize list',
      'sort text lines',
      'natural sort',
      'sort numbers',
      'sort by length',
      'randomize list',
      'a-z sorter',
    ],
    category: 'text',
    icon: 'ArrowDownAZ',
    accepts: ['txt', 'csv'],
    faqs: [
      {
        q: 'What is natural sort?',
        a: 'Natural sort compares digit runs as numbers, so "file2" comes before "file10". Plain alphabetical sorting compares character by character and puts "file10" first, because "1" is lower than "2".',
      },
      {
        q: 'What happens to lines without a number in numeric mode?',
        a: 'They are grouped at the end in their original order, so nothing disappears. Numeric mode reads the first number on the line, including negatives and decimals.',
      },
      {
        q: 'Is the sort stable?',
        a: 'Yes. Lines that compare as equal keep their original relative order, which matters when you sort by length or by a leading number.',
      },
      {
        q: 'Does case sensitivity change the result?',
        a: 'With case sensitivity on, uppercase letters sort before lowercase ones (code-point order), matching the Unix sort command in the C locale. With it off, "apple" and "Apple" sort together using your browser locale rules.',
      },
    ],
    related: ['remove-duplicate-lines', 'remove-line-breaks', 'find-and-replace', 'word-counter', 'csv-to-json'],
    updated: '2026-08-16',
  },
  {
    slug: 'find-and-replace',
    title: 'Find and Replace',
    h1: 'Find and replace text online',
    description:
      'Find and replace text with plain or regex matching, capture groups, whole-word and case options, plus a live highlighted preview.',
    keywords: [
      'search and replace',
      'regex replace',
      'bulk find replace',
      'replace text online',
      'regular expression replace',
      'capture group replace',
    ],
    category: 'text',
    icon: 'Replace',
    accepts: ['txt', 'md', 'csv'],
    faqs: [
      {
        q: 'How do capture groups work?',
        a: 'Wrap part of your pattern in parentheses, then reference it in the replacement with $1, $2 and so on. For example, matching "Invoice (\\d+)" and replacing with "INV-$1" turns "Invoice 1042" into "INV-1042". Named groups work too, via $<name>.',
      },
      {
        q: 'Which regex flavour is supported?',
        a: 'JavaScript regular expressions, including lookahead, lookbehind, named groups and Unicode property escapes such as \\p{L}. Global matching is always on; case-insensitivity, multiline anchors and dot-matches-newline are toggles.',
      },
      {
        q: 'Can I replace a tab or a line break?',
        a: 'Yes. Both fields understand \\n, \\r, \\t and \\uXXXX escapes even in plain-text mode, so you can replace every tab with a comma without touching regular expressions.',
      },
      {
        q: 'What does whole words only do?',
        a: 'It wraps your pattern in boundaries so "cat" matches the word cat but not "category" or "concatenate". The boundary is Unicode-aware, so accented words behave correctly.',
      },
      {
        q: 'Is there an undo?',
        a: 'The original text stays in the input box until you press "Apply to input". If you clear the Find field, the result box shows the original text again.',
      },
    ],
    related: ['text-diff-checker', 'case-converter', 'remove-line-breaks', 'sort-lines', 'regex-tester'],
    updated: '2026-11-01',
  },
  {
    slug: 'lorem-ipsum-generator',
    title: 'Lorem Ipsum Generator',
    h1: 'Lorem ipsum generator',
    description:
      'Generate lorem ipsum paragraphs, sentences, words or list items in classic Latin or modern styles, with optional HTML markup.',
    keywords: [
      'lorem ipsum',
      'placeholder text',
      'dummy text generator',
      'filler text',
      'lipsum',
      'sample paragraphs',
    ],
    category: 'text',
    icon: 'Pilcrow',
    faqs: [
      {
        q: 'Where does lorem ipsum come from?',
        a: 'It is scrambled Latin from Cicero\'s De Finibus Bonorum et Malorum, written in 45 BC. Typesetters have used it since the 1500s because its word shapes and letter frequencies resemble Latin-alphabet prose without being readable.',
      },
      {
        q: 'Why use placeholder text at all?',
        a: 'Real copy pulls attention to the wording; placeholder text keeps reviewers focused on layout, type size and rhythm. If a design only looks good with perfect copy, the design is not finished.',
      },
      {
        q: 'Can I get HTML-ready output?',
        a: 'Yes. Turn on "Wrap in HTML tags" to get each paragraph inside <p> tags, or a full <ul> with <li> items when you generate list items. The markup is escaped and ready to paste into a template.',
      },
      {
        q: 'Is each generation different?',
        a: 'Yes. Press "Generate new text" for a new random draw. The generator is seeded, so the same options and seed always give the same text until you regenerate.',
      },
    ],
    related: ['word-counter', 'character-counter', 'case-converter', 'text-repeater', 'password-generator'],
    updated: '2026-11-01',
  },
  {
    slug: 'remove-line-breaks',
    title: 'Remove Line Breaks',
    h1: 'Remove line breaks and unwrap paragraphs',
    description:
      'Remove line breaks or unwrap hard-wrapped paragraphs copied from a PDF or email. Also collapses extra spaces and converts between LF and CRLF.',
    keywords: [
      'remove line breaks',
      'delete line breaks',
      'unwrap text',
      'join lines',
      'remove carriage returns',
      'fix pdf copy paste',
      'crlf to lf',
    ],
    category: 'text',
    icon: 'WrapText',
    accepts: ['txt', 'md'],
    faqs: [
      {
        q: 'How do I keep my paragraphs when removing line breaks?',
        a: 'Use "Unwrap paragraphs". It joins the hard-wrapped lines inside a paragraph but keeps the blank line between paragraphs. Text copied out of a PDF or an email client needs this.',
      },
      {
        q: 'What is the difference between LF and CRLF?',
        a: 'Unix, macOS and the web use a single line-feed character (LF, \\n). Windows tools traditionally use carriage return plus line feed (CRLF, \\r\\n). Mixing them causes stray ^M characters in editors and doubled lines in some parsers.',
      },
      {
        q: 'Will it remove double spaces too?',
        a: 'Yes, if "Collapse repeated spaces" is on. Runs of spaces and tabs become a single space, and trailing spaces at the end of each line are removed. Turn it off to keep your original spacing.',
      },
      {
        q: 'Can I join lines with something other than a space?',
        a: 'Yes. Pick a comma, a pipe or nothing, or type your own separator. A comma turns a column of values into a comma-separated list that you can paste into a query.',
      },
    ],
    related: ['word-counter', 'remove-duplicate-lines', 'sort-lines', 'find-and-replace', 'case-converter'],
    updated: '2026-11-01',
  },
  {
    slug: 'text-repeater',
    title: 'Text Repeater',
    h1: 'Text repeater: repeat text any number of times',
    description:
      'Text repeater that repeats any text up to 100,000 times, with a separator you choose and numbering from a template such as "{n}. {text}".',
    keywords: [
      'repeat text',
      'duplicate text',
      'copy text multiple times',
      'text multiplier',
      'numbered list generator',
      'bulk text generator',
    ],
    category: 'text',
    icon: 'Repeat',
    faqs: [
      {
        q: 'How many copies can I make?',
        a: 'Up to 100,000 repetitions, with a cap of about eight million characters of output so the page stays usable. If you reach the cap, download what you have. The file on disk has no such limit.',
      },
      {
        q: 'Can I number each copy?',
        a: 'Yes. Turn on numbering and edit the template: {n} inserts the counter and {text} inserts your text, so "{n}. {text}" produces a numbered list and "row-{n}" produces sequential identifiers.',
      },
      {
        q: 'Can I use it to build test data?',
        a: 'Yes. Combine numbering with a custom separator to make SQL value lists, CSV rows or padded strings of an exact length for testing field limits.',
      },
      {
        q: 'Does multi-line text work?',
        a: 'Yes. The whole block is treated as one unit, so a three-line template repeated five times gives fifteen lines, separated by whatever separator you choose.',
      },
    ],
    related: ['lorem-ipsum-generator', 'character-counter', 'reverse-text', 'case-converter', 'word-counter'],
    updated: '2026-11-01',
  },
  {
    slug: 'reverse-text',
    title: 'Reverse Text',
    h1: 'Reverse text, words or line order',
    description:
      'Reverse text by character, word or line order, check for palindromes, and create mirrored or upside-down Unicode output.',
    keywords: [
      'backwards text',
      'reverse string',
      'flip text',
      'mirror text',
      'upside down text',
      'reverse word order',
      'palindrome checker',
    ],
    category: 'text',
    icon: 'FlipHorizontal',
    faqs: [
      {
        q: 'Does reversing break emoji and accented letters?',
        a: 'No. The tool splits text into user-perceived characters using the browser\'s grapheme segmenter, so emoji with skin-tone modifiers, flags and letters with combining accents survive the reversal intact.',
      },
      {
        q: 'What is the difference between mirror and upside-down text?',
        a: 'Mirror text swaps each character for its left-right reflection, so it reads correctly when held up to a mirror. Upside-down text rotates each character 180°, which is what people paste into chat and social bios.',
      },
      {
        q: 'Will upside-down text work everywhere?',
        a: 'It is ordinary Unicode, so it works anywhere that accepts Unicode: most chat apps, social profiles and documents. Some fonts do not have all the substitute glyphs and show a box instead.',
      },
      {
        q: 'How does the palindrome check work?',
        a: 'It compares the text with its reverse after removing everything that is not a letter or digit and lowercasing the rest, so "A man, a plan, a canal: Panama" is correctly reported as a palindrome.',
      },
    ],
    related: ['case-converter', 'text-repeater', 'word-counter', 'find-and-replace', 'character-counter'],
    updated: '2026-11-01',
  },
  {
    slug: 'slug-generator',
    title: 'Slug Generator',
    h1: 'URL slug generator',
    description:
      'Turn titles into clean URL slugs with accent transliteration, stop-word removal, length limits and batch mode for long lists.',
    keywords: [
      'url slug',
      'permalink generator',
      'seo url',
      'title to slug',
      'slugify',
      'clean url generator',
      'batch slug',
    ],
    category: 'text',
    icon: 'Link',
    accepts: ['txt', 'csv'],
    faqs: [
      {
        q: 'What makes a good URL slug?',
        a: 'Lowercase, hyphen-separated, ASCII only, and short enough to read in a search result. Three to six meaningful words is a good target. Keep the words people search for and drop the filler.',
      },
      {
        q: 'How are accents and non-Latin scripts handled?',
        a: 'Transliteration maps characters to ASCII before slugging: café becomes cafe, Zürich becomes zuerich, ß becomes ss, and Cyrillic and Greek letters are romanised. Turn it off if you deliberately want Unicode URLs.',
      },
      {
        q: 'Should I remove stop words?',
        a: 'It shortens URLs and is safe for most posts, but it can make a slug harder to read: "how-to-fix-404-error" reads better than "fix-404-error". Use it only when a title is long.',
      },
      {
        q: 'Can I convert a whole list of titles?',
        a: 'Yes. Paste one title per line, or drop a text file, and every line becomes its own slug. Duplicate slugs get -2, -3 suffixes, so URLs do not collide. You can export the result as CSV.',
      },
      {
        q: 'Does the separator matter for SEO?',
        a: 'Hyphens are the safe choice: Google treats them as word separators, while underscores are treated as joiners. Dots and no separator at all make words run together and should be avoided in public URLs.',
      },
    ],
    related: ['case-converter', 'word-counter', 'find-and-replace', 'remove-duplicate-lines', 'qr-code-generator'],
    updated: '2026-11-01',
  },
]
