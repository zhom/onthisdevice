import type { Def, Section } from './types'
import { def } from './types'

const CASE_TABLE: Section = {
  h: 'Every case style compared',
  table: {
    head: ['Style', 'Example', 'Common use'],
    rows: [
      ['UPPERCASE', 'USER PROFILE', 'Headings, warnings, acronyms'],
      ['lowercase', 'user profile', 'Tags, email addresses, normalizing input'],
      ['Title Case', 'The Lord of the Rings', 'Headlines, book and film titles'],
      ['Sentence case', 'The lord of the rings', 'Body text, buttons, UI labels'],
      ['camelCase', 'userProfile', 'JavaScript and Java variables'],
      ['PascalCase', 'UserProfile', 'Class names, React components, C# methods'],
      ['snake_case', 'user_profile', 'Python, Ruby, SQL columns'],
      ['kebab-case', 'user-profile', 'URLs, CSS classes, file names'],
      ['CONSTANT_CASE', 'USER_PROFILE', 'Constants and environment variables'],
      ['aLtErNaTiNg', 'uSeR pRoFiLe', 'Mocking tone in chat'],
    ],
  },
}

const IDENT_RULES: Section = {
  h: 'How words are found',
  p: [
    'The converter first splits each line into words. A space, dash, underscore, dot or any other non-letter starts a new word, and so does a change from lowercase to uppercase (`userId` gives user and id). A run of capitals stays together as one word, so `HTTPServer` gives http and server, and digits split from letters.',
    'The words are then joined in the new style. Because the split comes first, you can convert from any style to any other: `max-retry-count`, `max_retry_count` and `maxRetryCount` all give the same result.',
  ],
}

const caseFaq = (name: string) => ({
  q: 'Does it change each line separately?',
  a: `Yes. Each line is converted to ${name} on its own, so you can paste a whole list of names, headings or variables and convert them in one step.`,
})

export const CASE_DEFS: Def[] = [
  def({
    slug: 'uppercase-converter',
    title: 'Uppercase Converter',
    h1: 'Convert text to uppercase',
    description: 'Convert text to UPPERCASE in one click. Works with accented letters, Greek and Cyrillic, keeps line breaks, and copies or downloads the result.',
    keywords: ['to upper case', 'caps converter', 'all caps', 'capitalize text', 'convert to capital letters'],
    category: 'text',
    icon: 'CaseUpper',
    family: 'text',
    faqs: [
      { q: 'Does it work with accented letters?', a: 'Yes. It uses the Unicode case rules of your browser, so é becomes É, ß becomes SS and Greek and Cyrillic letters change too.' },
      { q: 'What happens to numbers and symbols?', a: 'They stay as they are. Only letters that have an uppercase form change.' },
      { q: 'Can I convert caps back to normal text?', a: 'Use the lowercase converter or the sentence case converter, which also capitalizes the first letter of each sentence.' },
    ],
    related: ['lowercase-converter', 'sentence-case-converter', 'title-case-converter', 'case-converter'],
    explainer: [
      {
        h: 'How the uppercase converter works',
        p: [
          'Paste your text and the uppercase version appears below as you type. The conversion uses the Unicode case mapping built into your browser, so it handles every alphabet that has capital letters, not only A to Z.',
          'Some letters get longer: the German ß becomes SS, and the ligature ﬁ becomes FI. Letters without a capital form, such as Chinese characters, stay the same.',
        ],
      },
      {
        h: 'When to use all caps',
        p: [
          'Capitals suit short labels, acronyms, warnings and headings in some designs. Long passages in capitals are slower to read, because word shapes disappear. In email and chat, all caps reads as shouting.',
        ],
      },
      CASE_TABLE,
    ],
  }),
  def({
    slug: 'lowercase-converter',
    title: 'Lowercase Converter',
    h1: 'Convert text to lowercase',
    description: 'Convert text to lowercase instantly. Fixes text typed with Caps Lock on, handles every alphabet, keeps line breaks, and copies or downloads the result.',
    keywords: ['to lower case', 'caps lock fix', 'decapitalize text', 'convert capital letters to small'],
    category: 'text',
    icon: 'CaseLower',
    family: 'text',
    faqs: [
      { q: 'Does it change numbers or punctuation?', a: 'No. Only letters change. Numbers, symbols, spaces and line breaks stay where they are.' },
      { q: 'Why would I lowercase email addresses?', a: 'Email domains are not case sensitive and most mail servers treat the local part the same way, so lowercasing makes duplicates easy to find.' },
      { q: 'How do I get capital letters back at the start of sentences?', a: 'Use the sentence case converter. It lowercases the text and then capitalizes the first letter of each sentence.' },
    ],
    related: ['uppercase-converter', 'sentence-case-converter', 'title-case-converter', 'case-converter'],
    explainer: [
      {
        h: 'How the lowercase converter works',
        p: [
          'The text is converted with the Unicode lowercase mapping of your browser. Every letter that has a lowercase form changes, in any alphabet. Line breaks, numbers and symbols stay as they are.',
          'Lowercasing is the usual first step to compare or deduplicate text: tags, keywords, user names and email addresses often differ only in case.',
        ],
      },
      CASE_TABLE,
    ],
  }),
  def({
    slug: 'title-case-converter',
    title: 'Title Case Converter',
    h1: 'Title case converter',
    description: 'Capitalize titles and headlines correctly. Short words such as of, and, the stay lowercase, acronyms stay intact, and each line is a separate title.',
    keywords: ['capitalize title', 'headline capitalization', 'title capitalization tool', 'capitalize each word'],
    category: 'text',
    icon: 'Heading',
    family: 'text',
    faqs: [
      { q: 'Which words stay lowercase?', a: 'Articles (a, an, the), short conjunctions (and, but, or, nor) and short prepositions (of, in, on, to, by, for, with) stay lowercase, unless they start or end the title or follow a colon.' },
      { q: 'Will it break acronyms such as NASA?', a: 'No. Words that are already in capitals, such as NASA or API, stay as they are.' },
      { q: 'Can I capitalize every word instead?', a: 'Yes. Set the style to Every word to capitalize each word with no exceptions.' },
    ],
    related: ['sentence-case-converter', 'uppercase-converter', 'case-converter', 'slug-generator'],
    explainer: [
      {
        h: 'The title case rules used',
        p: [
          'Headline style capitalizes the first and last word and every major word: nouns, verbs, adjectives, adverbs and pronouns. Articles, short conjunctions and prepositions of up to four letters stay lowercase in the middle of a title. A word after a colon, a dash or a full stop starts a new part and is capitalized.',
          'Hyphenated compounds get a capital on each part (Step-By-Step), and words written in capitals are kept, so acronyms survive. Style guides disagree on details: some lowercase all prepositions, some only short ones. Check the result against the guide you follow.',
        ],
      },
      {
        h: 'Examples',
        table: {
          head: ['Input', 'Headline style'],
          rows: [
            ['the lord of the rings', 'The Lord of the Rings'],
            ['a guide to the NASA api', 'A Guide to the NASA Api'],
            ['what is it good for?', 'What Is It Good For?'],
            ['step-by-step: getting started', 'Step-By-Step: Getting Started'],
          ],
        },
      },
    ],
  }),
  def({
    slug: 'sentence-case-converter',
    title: 'Sentence Case Converter',
    h1: 'Sentence case converter',
    description: 'Convert text to sentence case: the first letter of each sentence is a capital and the rest is lowercase. Fixes all-caps text and keeps line breaks.',
    keywords: ['sentence capitalization', 'fix caps lock text', 'capitalize first letter of sentence'],
    category: 'text',
    icon: 'Pilcrow',
    family: 'text',
    faqs: [
      { q: 'How does it find the start of a sentence?', a: 'After a full stop, question mark, exclamation mark or line break, the next letter becomes a capital.' },
      { q: 'What about names and acronyms?', a: 'They become lowercase, because the converter cannot tell a name from a normal word. Fix names by hand after the conversion. The pronoun I is always capitalized.' },
      { q: 'Is sentence case good for headings?', a: 'Many style guides and design systems use sentence case for headings and buttons because it is easier to read than title case.' },
    ],
    related: ['title-case-converter', 'lowercase-converter', 'uppercase-converter', 'case-converter'],
    explainer: [
      {
        h: 'How sentence case is applied',
        p: [
          'The text is lowercased, then the first letter after the start of the text, a full stop, a question mark, an exclamation mark or a line break is made a capital. The word I and its contractions (I am, I have, I will) are always capitals.',
          'Proper nouns cannot be detected without a dictionary of names, so London or Ada become lowercase. Read the result once and fix them.',
        ],
      },
      CASE_TABLE,
    ],
  }),
  def({
    slug: 'camel-case-converter',
    title: 'camelCase Converter',
    h1: 'Convert text to camelCase',
    description: 'Convert words, snake_case or kebab-case names to camelCase. Each line becomes one identifier, ready for JavaScript, Java or JSON keys.',
    keywords: ['camel case', 'convert to camelcase', 'snake case to camel case', 'lower camel case'],
    category: 'text',
    icon: 'CaseSensitive',
    family: 'text',
    faqs: [
      { q: 'What is camelCase?', a: 'Words joined without spaces, the first word in lowercase and every later word starting with a capital: userProfileSettings.' },
      { q: 'How are acronyms handled?', a: 'An acronym counts as one word and is written like any other word: HTTPResponseCode becomes httpResponseCode.' },
      caseFaq('camelCase'),
    ],
    related: ['pascal-case-converter', 'snake-case-converter', 'kebab-case-converter', 'constant-case-converter'],
    explainer: [IDENT_RULES, CASE_TABLE],
  }),
  def({
    slug: 'snake-case-converter',
    title: 'snake_case Converter',
    h1: 'Convert text to snake_case',
    description: 'Convert words, camelCase or kebab-case names to snake_case for Python, Ruby and SQL. Each line becomes one identifier in lowercase with underscores.',
    keywords: ['snake case', 'camel case to snake case', 'underscore case', 'convert to snake_case'],
    category: 'text',
    icon: 'CaseSensitive',
    family: 'text',
    faqs: [
      { q: 'What is snake_case?', a: 'Lowercase words joined with underscores: user_profile_settings. Python, Ruby, Rust and most SQL schemas use it.' },
      { q: 'How is camelCase split?', a: 'A change from a lowercase letter to a capital starts a new word, so firstName becomes first_name and HTTPServer becomes http_server.' },
      caseFaq('snake_case'),
    ],
    related: ['camel-case-converter', 'constant-case-converter', 'kebab-case-converter', 'pascal-case-converter'],
    explainer: [IDENT_RULES, CASE_TABLE],
  }),
  def({
    slug: 'kebab-case-converter',
    title: 'kebab-case Converter',
    h1: 'Convert text to kebab-case',
    description: 'Convert words, camelCase or snake_case names to kebab-case for URLs, CSS classes and file names. Each line becomes one lowercase, hyphenated name.',
    keywords: ['kebab case', 'dash case', 'hyphen case', 'camel case to kebab case', 'spinal case'],
    category: 'text',
    icon: 'CaseSensitive',
    family: 'text',
    faqs: [
      { q: 'What is kebab-case?', a: 'Lowercase words joined with hyphens: user-profile-settings. It is used in URLs, CSS class names, HTML attributes and command line flags.' },
      { q: 'Is this the same as a URL slug?', a: 'Close. For full slugs with accent removal and length limits, use the slug generator.' },
      caseFaq('kebab-case'),
    ],
    related: ['slug-generator', 'snake-case-converter', 'camel-case-converter', 'pascal-case-converter'],
    explainer: [IDENT_RULES, CASE_TABLE],
  }),
  def({
    slug: 'pascal-case-converter',
    title: 'PascalCase Converter',
    h1: 'Convert text to PascalCase',
    description: 'Convert words, camelCase or snake_case names to PascalCase for class names, types and components. Each line becomes one identifier.',
    keywords: ['pascal case', 'upper camel case', 'convert to pascalcase', 'class name case'],
    category: 'text',
    icon: 'CaseSensitive',
    family: 'text',
    faqs: [
      { q: 'What is PascalCase?', a: 'Words joined without spaces, every word starting with a capital: UserProfileSettings. It is also called upper camel case.' },
      { q: 'Where is PascalCase used?', a: 'Class and type names in most languages, React and Vue components, C# methods and .NET namespaces.' },
      caseFaq('PascalCase'),
    ],
    related: ['camel-case-converter', 'snake-case-converter', 'kebab-case-converter', 'constant-case-converter'],
    explainer: [IDENT_RULES, CASE_TABLE],
  }),
  def({
    slug: 'constant-case-converter',
    title: 'CONSTANT_CASE Converter',
    h1: 'Convert text to CONSTANT_CASE',
    description: 'Convert words or camelCase names to CONSTANT_CASE for constants and environment variables: capital letters joined with underscores, one per line.',
    keywords: ['constant case', 'screaming snake case', 'upper snake case', 'environment variable name'],
    category: 'text',
    icon: 'CaseUpper',
    family: 'text',
    faqs: [
      { q: 'What is CONSTANT_CASE?', a: 'Uppercase words joined with underscores: MAX_RETRY_COUNT. It is also called screaming snake case.' },
      { q: 'Why do environment variables use it?', a: 'Shells treat names as case sensitive, and the uppercase convention keeps environment and configuration names apart from local variables.' },
      caseFaq('CONSTANT_CASE'),
    ],
    related: ['snake-case-converter', 'camel-case-converter', 'uppercase-converter', 'env-to-json'],
    explainer: [IDENT_RULES, CASE_TABLE],
  }),
  def({
    slug: 'alternating-case-converter',
    title: 'Alternating Case Converter',
    h1: 'aLtErNaTiNg case converter',
    description: 'Convert text to aLtErNaTiNg cAsE: letters switch between lowercase and capitals. Choose the first letter, then copy the result into any chat.',
    keywords: ['alternating caps', 'mocking text', 'random case', 'alternate case generator'],
    category: 'text',
    icon: 'CaseSensitive',
    family: 'text',
    faqs: [
      { q: 'Do spaces count when it alternates?', a: 'No. Only letters count, so the pattern continues across spaces and punctuation without a break.' },
      { q: 'Can I start with a capital?', a: 'Yes. Set the first letter to UPPERCASE.' },
      { q: 'Will it work in social media posts?', a: 'Yes. The result is normal letters in a different case, so it works everywhere text works.' },
    ],
    related: ['uppercase-converter', 'fancy-text-generator', 'upside-down-text', 'cursed-text-generator'],
    explainer: [
      {
        h: 'How alternating case works',
        p: [
          'The converter walks through the text and switches between lowercase and uppercase at every letter. Spaces, digits and punctuation do not change the pattern. The result is ordinary text, so you can paste it anywhere.',
          'Alternating case is used online to mark a quote as mocking. It is hard to read, so keep it to a few words.',
        ],
      },
      CASE_TABLE,
    ],
  }),
]
