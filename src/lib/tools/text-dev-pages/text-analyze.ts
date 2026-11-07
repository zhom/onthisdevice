import type { Def } from './types'
import { def } from './types'

export const ANALYZE_DEFS: Def[] = [
  def({
    slug: 'word-frequency-counter',
    title: 'Word Frequency Counter',
    h1: 'Word frequency counter',
    description: 'Count how often each word or 2 and 3-word phrase appears in a text. Skip common words, see the share of each, and download the table as CSV.',
    keywords: ['word frequency', 'count word occurrences', 'keyword frequency', 'most used words', 'phrase frequency'],
    category: 'text',
    icon: 'ChartColumn',
    family: 'text',
    faqs: [
      { q: 'What are common words?', a: 'Function words such as the, and, of, to and is. They are the most frequent words in any English text, so they are hidden by default to show the words that carry meaning.' },
      { q: 'How are phrases counted?', a: 'Every run of 2 or 3 consecutive words is counted. A phrase is kept when its first and last words are not common words, so "state of the art" style phrases survive.' },
      { q: 'Are Word and word the same?', a: 'Yes, unless you turn on case sensitive. Punctuation at the start and end of a word is ignored.' },
    ],
    related: ['word-counter', 'character-frequency-counter', 'sentence-counter', 'readability-checker'],
    explainer: [
      {
        h: 'How the count works',
        p: [
          'The text is split into words at whitespace, punctuation at the edges of each word is removed, and the words are lowercased. Each word, or each 2 or 3-word phrase, is counted. The share is its count divided by all counted terms.',
          'Word frequency follows Zipf\'s law: in English the most common word appears about twice as often as the second and three times as often as the third. Hiding common words makes the topic words visible.',
        ],
      },
      { h: 'Uses', list: ['Find overused words in a draft.', 'Check which phrases a page is about before you publish it.', 'Compare the vocabulary of two texts.', 'Build a word list for a word cloud.'] },
    ],
  }),
  def({
    slug: 'character-frequency-counter',
    title: 'Character Frequency Counter',
    h1: 'Letter and character frequency counter',
    description: 'Count how often each letter or character appears in text, with the share and code point of each. For cryptograms, ciphers and language analysis.',
    keywords: ['letter frequency', 'letter counter', 'character count by letter', 'frequency analysis', 'letter frequency analysis'],
    category: 'text',
    icon: 'ChartColumn',
    family: 'text',
    faqs: [
      { q: 'How does this help break a cipher?', a: 'In a substitution cipher the most frequent symbol usually stands for E, the most common letter in English (about 12.7%), then T, A and O.' },
      { q: 'Are accented letters counted apart?', a: 'Yes. é and e are different characters. Use remove accents first to merge them.' },
      { q: 'Can I count digits and punctuation?', a: 'Yes. Turn off Letters only to count every character except whitespace.' },
    ],
    related: ['caesar-cipher', 'word-frequency-counter', 'character-counter', 'unicode-character-lookup'],
    explainer: [
      {
        h: 'English letter frequencies',
        table: {
          head: ['Letter', 'E', 'T', 'A', 'O', 'I', 'N', 'S', 'H', 'R'],
          rows: [['Share', '12.7%', '9.1%', '8.2%', '7.5%', '7.0%', '6.7%', '6.3%', '6.1%', '6.0%']],
        },
      },
      {
        h: 'How it counts',
        p: ['Each character of the text is counted once; whitespace is skipped unless you count spaces. With case sensitivity off, capitals count as their lowercase letter. The code point column helps to tell apart characters that look alike, such as a Latin a and a Cyrillic а.'],
      },
    ],
  }),
  def({
    slug: 'sentence-counter',
    title: 'Sentence Counter',
    h1: 'Sentence counter',
    description: 'Count the sentences in a text, see the words in each, the average sentence length and the longest sentence. Abbreviations such as Dr. do not split.',
    keywords: ['count sentences', 'number of sentences', 'sentence length checker', 'average sentence length'],
    category: 'text',
    icon: 'Pilcrow',
    family: 'text',
    faqs: [
      { q: 'How is the end of a sentence found?', a: 'At a full stop, question mark, exclamation mark or ellipsis followed by a space or the end of the text, and at a blank line.' },
      { q: 'Do abbreviations end a sentence?', a: 'No. Common abbreviations (Dr., Mr., etc., e.g.) and single initials (J. R. R.) do not end a sentence.' },
      { q: 'What is a good sentence length?', a: 'For general readers, an average of 15 to 20 words. Sentences over 30 words are hard to follow.' },
    ],
    related: ['word-counter', 'paragraph-counter', 'readability-checker', 'line-counter'],
    explainer: [
      {
        h: 'How sentences are counted',
        p: [
          'The counter reads the text line by line. A sentence ends at terminal punctuation followed by whitespace, a closing quote or bracket, or at the end of a paragraph. Headings and list items without a full stop count as sentences, because a blank line or the end of the text closes them.',
          'Average sentence length is the strongest single factor in most readability formulas. The table lists each sentence with its word count so you can find the long ones.',
        ],
      },
    ],
  }),
  def({
    slug: 'line-counter',
    title: 'Line Counter',
    h1: 'Line counter',
    description: 'Count the lines in text or code: total, non-empty, empty and duplicate lines, the longest line and the line ending type. Works with large files.',
    keywords: ['count lines', 'number of lines', 'line count tool', 'lines of code counter'],
    category: 'text',
    icon: 'ListOrdered',
    family: 'text',
    faqs: [
      { q: 'Does a final line break count as a line?', a: 'A text that ends with a line break has an empty last line, which is counted as an empty line, the same way most editors show it.' },
      { q: 'Can I count lines in a file?', a: 'Yes. Open or drop a text file onto the input. It is read on your device.' },
      { q: 'What are the line ending types?', a: 'LF is used by Linux and macOS, CRLF by Windows and CR by very old Mac files.' },
    ],
    related: ['add-line-numbers', 'remove-empty-lines', 'remove-duplicate-lines', 'word-counter'],
    explainer: [
      {
        h: 'What is counted',
        p: [
          'Lines are split at LF, CRLF and CR. A line is empty when it holds only spaces or tabs. Duplicate lines are non-empty lines that appear more than once; the first copy is not counted as a duplicate. Line length is counted in characters, so an emoji counts as one.',
        ],
      },
    ],
  }),
  def({
    slug: 'paragraph-counter',
    title: 'Paragraph Counter',
    h1: 'Paragraph counter',
    description: 'Count the paragraphs in a text and see the sentences and words in each, with averages. Paragraphs are blocks of text separated by a blank line.',
    keywords: ['count paragraphs', 'number of paragraphs', 'paragraph length checker'],
    category: 'text',
    icon: 'Pilcrow',
    family: 'text',
    faqs: [
      { q: 'What counts as a paragraph?', a: 'A block of text between blank lines. A single line break inside a block does not start a new paragraph.' },
      { q: 'How long should a paragraph be?', a: 'On screens, 2 to 4 sentences or 40 to 80 words is easy to scan. Essays and academic writing use longer paragraphs.' },
      { q: 'Why does my text count as one paragraph?', a: 'Text copied from some editors has single line breaks between paragraphs. Add a blank line between them.' },
    ],
    related: ['sentence-counter', 'word-counter', 'line-counter', 'readability-checker'],
    explainer: [
      {
        h: 'How paragraphs are counted',
        p: ['The text is split at every blank line (a line with nothing or only spaces). Each block is a paragraph. Sentences in each paragraph are counted with the same rules as the sentence counter, and words with the same rules as the word counter.'],
      },
    ],
  }),
  def({
    slug: 'readability-checker',
    title: 'Readability Checker',
    h1: 'Readability checker: Flesch-Kincaid and more',
    description: 'Score text with Flesch Reading Ease, Flesch-Kincaid grade, Gunning Fog, SMOG, Coleman-Liau and ARI, and find the longest sentences to rewrite.',
    keywords: ['flesch kincaid calculator', 'readability score', 'flesch reading ease', 'gunning fog index', 'reading level checker'],
    category: 'text',
    icon: 'BookOpen',
    family: 'text',
    popular: true,
    faqs: [
      { q: 'What is a good Flesch Reading Ease score?', a: '60 to 70 is plain English that most adults read easily. Many publications aim for 60 or higher. Scores below 30 are for specialists.' },
      { q: 'Why do the grade levels differ?', a: 'Each formula weighs sentence length, word length and syllables differently. Use the average as a guide and look at the long sentences.' },
      { q: 'How accurate is the syllable count?', a: 'Syllables are estimated from vowel groups, which is right for most English words. A few words, such as names, can be off by one.' },
    ],
    related: ['word-counter', 'sentence-counter', 'reading-time-calculator', 'word-frequency-counter'],
    explainer: [
      {
        h: 'The formulas',
        table: {
          head: ['Index', 'Formula'],
          rows: [
            ['Flesch Reading Ease', '206.835 − 1.015 × (words ÷ sentences) − 84.6 × (syllables ÷ words)'],
            ['Flesch-Kincaid Grade', '0.39 × (words ÷ sentences) + 11.8 × (syllables ÷ words) − 15.59'],
            ['Gunning Fog', '0.4 × (words ÷ sentences + 100 × complex words ÷ words)'],
            ['SMOG', '1.043 × √(words of 3+ syllables × 30 ÷ sentences) + 3.1291'],
            ['Coleman-Liau', '0.0588 × letters per 100 words − 0.296 × sentences per 100 words − 15.8'],
            ['Automated Readability', '4.71 × (characters ÷ words) + 0.5 × (words ÷ sentences) − 21.43'],
          ],
        },
      },
      {
        h: 'Reading the scores',
        p: [
          'Grade levels estimate the US school grade needed to understand the text on first reading: 8 means a 13 to 14 year old. All six indices measure only length: long sentences and long words. They cannot tell whether the text is clear or correct, so use them to find sentences to split, not as a target.',
        ],
      },
    ],
  }),
  def({
    slug: 'reading-time-calculator',
    title: 'Reading Time Calculator',
    h1: 'Reading time calculator',
    description: 'Estimate how long a text takes to read silently or aloud. Set your words per minute and compare skimming, average and careful reading speeds.',
    keywords: ['reading time', 'how long to read', 'speech time calculator', 'words per minute', 'speaking time'],
    category: 'text',
    icon: 'Clock',
    family: 'text',
    faqs: [
      { q: 'What reading speed is used?', a: '238 words per minute, the average for adult silent reading of English non-fiction in a 2019 meta-analysis. Change it to suit your readers.' },
      { q: 'How long is a 5-minute speech?', a: 'At 140 words per minute, about 700 words. Fast speakers reach 160, and a slow, clear talk is 120.' },
      { q: 'Does it count images or code?', a: 'No. It counts words only. Add time for figures, tables and code, which are read more slowly.' },
    ],
    related: ['word-counter', 'readability-checker', 'sentence-counter', 'character-counter'],
    explainer: [
      {
        h: 'The formula',
        code: 'reading time = words ÷ words per minute',
        p: ['A 1,200-word article at 238 words per minute takes about 5 minutes. Speaking time uses the slower speaking speed, because speakers pause between sentences.'],
      },
      {
        h: 'Typical speeds',
        table: {
          head: ['Activity', 'Words per minute'],
          rows: [
            ['Skimming', '400 to 700'],
            ['Silent reading, non-fiction', '238'],
            ['Silent reading, fiction', '260'],
            ['Reading aloud', '183'],
            ['Presentation', '130 to 150'],
            ['Audiobook narration', '150 to 160'],
          ],
        },
      },
    ],
  }),
  def({
    slug: 'palindrome-checker',
    title: 'Palindrome Checker',
    h1: 'Palindrome checker',
    description: 'Check whether words, phrases or numbers read the same backwards. Ignores case, spaces, punctuation and accents, and finds the longest palindrome.',
    keywords: ['is it a palindrome', 'palindrome test', 'palindrome finder', 'check palindrome'],
    category: 'text',
    icon: 'ArrowLeftRight',
    family: 'text',
    faqs: [
      { q: 'Is "A man, a plan, a canal: Panama" a palindrome?', a: 'Yes, when spaces, punctuation and case are ignored, which is how phrase palindromes are judged. With exact characters only, it is not.' },
      { q: 'Can I check several at once?', a: 'Yes. Put one word or phrase on each line and each line is checked.' },
      { q: 'Do numbers work?', a: 'Yes. Digits are compared like letters, so 12321 is a palindrome.' },
    ],
    related: ['reverse-text', 'anagram-solver', 'character-frequency-counter', 'word-counter'],
    explainer: [
      {
        h: 'How the check works',
        p: [
          'Each line is reduced to its letters and digits: accents are removed, letters are lowercased, and spaces and punctuation are dropped. The result is compared with itself reversed. With exact characters only, the line is compared as typed.',
          'The longest palindrome inside the text is found by growing a window around every position while the characters on both sides match.',
        ],
      },
      { h: 'Examples', table: { head: ['Text', 'Palindrome'], rows: [['racecar', 'Yes'], ['Was it a car or a cat I saw?', 'Yes'], ['Never odd or even', 'Yes'], ['palindrome', 'No']] } },
    ],
  }),
]
