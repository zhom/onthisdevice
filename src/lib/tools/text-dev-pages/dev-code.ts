import type { Def, Section } from './types'
import { def } from './types'

const LOCAL: Section = {
  h: 'Your code stays on this device',
  p: ['Formatting runs in this tab. The code is not uploaded, so private source, configs with secrets and unreleased work stay on your device.'],
}

export const CODE_DEFS: Def[] = [
  def({
    slug: 'yaml-formatter',
    title: 'YAML Formatter',
    h1: 'YAML formatter and beautifier',
    description: 'Format YAML with consistent indentation, keep comments and anchors, expand inline lists and optionally sort keys. Errors show the line and column.',
    keywords: ['yaml beautifier', 'format yaml online', 'yaml pretty print', 'yaml indentation fixer', 'yml formatter'],
    category: 'dev',
    icon: 'FileCode',
    family: 'code',
    faqs: [
      { q: 'Are comments kept?', a: 'Yes. The YAML is parsed into a document that keeps comments, anchors, aliases and tags, then printed again with clean indentation.' },
      { q: 'Does it support several documents?', a: 'Yes. Documents separated by --- are formatted one by one and kept apart.' },
      { q: 'What does expand inline lists do?', a: 'It rewrites flow style such as [a, b] and {key: value} as block style, one item per line, which is easier to read and to diff.' },
    ],
    related: ['yaml-validator', 'yaml-to-json', 'json-to-yaml', 'json-formatter'],
    explainer: [
      {
        h: 'How the formatter works',
        p: [
          'The input is parsed with a full YAML 1.2 parser. Each document is turned into a syntax tree that keeps comments and anchors, and is printed again with the indentation you pick. Long strings are not folded, so values stay on one line.',
          'Sorting keys reorders every mapping alphabetically. It is useful before comparing two files, but it moves comments with their keys, so check the result.',
        ],
      },
      {
        h: 'Common YAML mistakes',
        table: {
          head: ['Mistake', 'Fix'],
          rows: [
            ['Tabs for indentation', 'YAML allows only spaces'],
            ['Uneven indentation inside one mapping', 'Use the same number of spaces for keys at one level'],
            ['A colon inside a plain value', 'Quote the value: "time: 10:30"'],
            ['yes, no, on and off as strings', 'Quote them; older parsers read them as booleans'],
          ],
        },
      },
      LOCAL,
    ],
  }),
  def({
    slug: 'yaml-validator',
    title: 'YAML Validator',
    h1: 'YAML validator',
    description: 'Check YAML for syntax errors such as bad indentation, tabs, duplicate keys and unclosed quotes. Each problem shows its line, column and a clear message.',
    keywords: ['yaml lint', 'validate yaml', 'yaml checker', 'yaml syntax check', 'yml validator'],
    category: 'dev',
    icon: 'FileCheck',
    family: 'code',
    faqs: [
      { q: 'Does it check duplicate keys?', a: 'Yes. A key that appears twice in the same mapping is an error in YAML 1.2, and it is reported with its line.' },
      { q: 'Does it validate against a schema?', a: 'No. It checks that the file is valid YAML. Whether the keys and values are right for a tool such as a CI pipeline depends on that tool.' },
      { q: 'Why is a tab an error?', a: 'YAML uses indentation for structure and allows only spaces for it, because tab widths differ between editors.' },
    ],
    related: ['yaml-formatter', 'yaml-to-json', 'json-validator', 'xml-validator'],
    explainer: [
      {
        h: 'What is checked',
        p: [
          'The validator parses every document in the input with a YAML 1.2 parser and lists each error and warning with its position: indentation that does not match, tabs, unclosed quotes and brackets, duplicate keys, aliases to anchors that do not exist, and invalid escape sequences.',
          'When the YAML is valid, the top-level keys of the first document are listed, which helps to spot a key at the wrong level.',
        ],
      },
      LOCAL,
    ],
  }),
  def({
    slug: 'html-formatter',
    title: 'HTML Formatter',
    h1: 'HTML formatter and beautifier',
    description: 'Indent and beautify HTML so the structure is easy to read. Choose 2 or 4 spaces or tabs and a line width. Inline scripts and styles are formatted too.',
    keywords: ['html beautifier', 'html pretty print', 'format html online', 'indent html', 'html prettifier'],
    category: 'dev',
    icon: 'CodeXml',
    family: 'code',
    faqs: [
      { q: 'Does formatting change how the page looks?', a: 'Rarely. Whitespace between inline elements can matter, so the formatter keeps inline elements such as a, b and span on their lines.' },
      { q: 'Are script and style blocks formatted?', a: 'Yes. JavaScript and CSS inside the page are indented with the same settings.' },
      { q: 'Can it fix broken HTML?', a: 'It indents what is there. Missing closing tags are not added; the indentation shows where they are missing.' },
    ],
    related: ['html-minifier', 'css-formatter', 'javascript-beautifier', 'remove-html-tags'],
    explainer: [
      {
        h: 'How it works',
        p: ['The HTML is tokenized into tags, text and comments, and each block-level element starts a new, indented line. Inline elements stay with the text around them. Content of pre and textarea is never changed, because whitespace there is visible.'],
      },
      LOCAL,
    ],
  }),
  def({
    slug: 'html-minifier',
    title: 'HTML Minifier',
    h1: 'HTML minifier',
    description: 'Minify HTML by removing comments and extra whitespace, and compress inline CSS. Content of pre, textarea and script stays intact. Shows bytes saved.',
    keywords: ['minify html', 'html compressor', 'compress html', 'html whitespace remover'],
    category: 'dev',
    icon: 'Minimize2',
    family: 'code',
    faqs: [
      { q: 'Can minifying break my page?', a: 'This minifier only removes whitespace that cannot change the layout: between block elements and repeated spaces. Text inside pre, textarea and script is not touched.' },
      { q: 'Is JavaScript minified?', a: 'No. Inline scripts are kept as they are. CSS in style tags is minified when the option is on.' },
      { q: 'How much does it save?', a: 'Typically 10% to 25% on hand-written HTML. Compression by the server (gzip or Brotli) saves more, and both together give the smallest files.' },
    ],
    related: ['html-formatter', 'css-minifier', 'json-minify', 'xml-minify'],
    explainer: [
      {
        h: 'What is removed',
        list: [
          'Comments, except conditional comments.',
          'Whitespace between block-level tags such as div, p, li and table cells.',
          'Runs of spaces, tabs and line breaks inside text, which become one space.',
          'Extra spaces between attributes inside a tag.',
        ],
      },
      {
        h: 'What is kept',
        p: ['One space between inline elements, because "<b>a</b> <i>b</i>" and "<b>a</b><i>b</i>" render differently. Attribute quotes and optional closing tags are also kept, so the output stays valid for every parser.'],
      },
    ],
  }),
  def({
    slug: 'css-formatter',
    title: 'CSS Formatter',
    h1: 'CSS formatter and beautifier',
    description: 'Beautify minified or messy CSS: one declaration per line, consistent indentation, blank lines between rules and each selector on its own line.',
    keywords: ['css beautifier', 'format css online', 'css pretty print', 'unminify css', 'css prettifier'],
    category: 'dev',
    icon: 'Braces',
    family: 'code',
    faqs: [
      { q: 'Can it unminify CSS?', a: 'Yes. Paste minified CSS and each rule and declaration gets its own line.' },
      { q: 'Does it support media queries and nesting?', a: 'Yes. At-rules such as @media and @supports and nested rules are indented by level.' },
      { q: 'Does it sort properties?', a: 'No. The order of declarations can matter, so it stays as written.' },
    ],
    related: ['css-minifier', 'html-formatter', 'javascript-beautifier', 'box-shadow-generator'],
    explainer: [{ h: 'How it works', p: ['The CSS is read token by token, so strings, comments and url() values are never changed. Every opening brace increases the indent, every semicolon ends a line, and the closing brace returns to the outer level.'] }, LOCAL],
  }),
  def({
    slug: 'css-minifier',
    title: 'CSS Minifier',
    h1: 'CSS minifier',
    description: 'Minify CSS by removing comments, whitespace and last semicolons and by shortening colors. Strings and calc() stay correct. Shows the bytes saved.',
    keywords: ['minify css', 'css compressor', 'compress css', 'css minify online'],
    category: 'dev',
    icon: 'Minimize2',
    family: 'code',
    faqs: [
      { q: 'Is calc() safe?', a: 'Yes. The spaces around + and - inside calc() are required, so they are kept. Only spaces outside brackets around combinators are removed.' },
      { q: 'What are license comments?', a: 'Comments that start with /*! hold copyright notices. They are kept by default, as many licenses require.' },
      { q: 'Does it merge or reorder rules?', a: 'No. Reordering can change the cascade, so only whitespace, comments, the last semicolon of a block and long colors are changed.' },
    ],
    related: ['css-formatter', 'html-minifier', 'json-minify', 'px-to-rem-converter'],
    explainer: [
      {
        h: 'What the minifier changes',
        table: {
          head: ['Before', 'After'],
          rows: [
            ['a , b { color : red ; }', 'a,b{color:red}'],
            ['/* comment */', '(removed)'],
            ['#ffffff', '#fff'],
            ['.a > .b + .c', '.a>.b+.c'],
            ['width: calc(100% - 2rem)', 'width:calc(100% - 2rem)'],
          ],
        },
      },
    ],
  }),
  def({
    slug: 'javascript-beautifier',
    title: 'JavaScript Beautifier',
    h1: 'JavaScript beautifier and formatter',
    description: 'Format minified or messy JavaScript with clean indentation and line breaks. Choose the brace style and indent, and decode escaped strings.',
    keywords: ['js beautifier', 'javascript formatter', 'unminify javascript', 'js pretty print', 'format js online'],
    category: 'dev',
    icon: 'Braces',
    family: 'code',
    faqs: [
      { q: 'Can it restore minified code?', a: 'It restores the layout: indentation, line breaks and spaces. Names that a minifier shortened, such as a and b, cannot be restored.' },
      { q: 'Does it run my code?', a: 'No. The code is read as text and reformatted. It never runs.' },
      { q: 'Does it work with TypeScript or JSX?', a: 'Plain JavaScript formats best. TypeScript and JSX usually format, but type annotations and tags can get unusual spacing.' },
    ],
    related: ['json-formatter', 'html-formatter', 'css-formatter', 'diff-checker-code'],
    explainer: [
      {
        h: 'Brace styles',
        table: {
          head: ['Style', 'Example'],
          rows: [
            ['Same line', 'The brace ends the line: if (x) {'],
            ['Next line', 'The brace gets its own line under if (x)'],
            ['Else on next line', 'Same line, but else starts a new line after }'],
          ],
        },
      },
      LOCAL,
    ],
  }),
]
