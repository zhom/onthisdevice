import type { Tool } from './types'

/**
 * Round-2 batch `dev-format` — the "your paste never leaves this tab" cluster.
 *
 * 10 tools across 43 URLs. Every sibling slug is a first-class entry with its
 * own description and its own FAQs; the pages share a component but never share
 * body copy.
 */

const UPDATED = '2026-11-01'

export const tools: Tool[] = [
  /* ================================================================ */
  /* 51 · SQL formatter (+ sql-minify)                                */
  /* ================================================================ */
  {
    slug: 'sql-formatter',
    title: 'SQL Formatter',
    h1: 'SQL formatter and beautifier',
    description:
      'SQL formatter for Postgres, MySQL, T-SQL, Oracle, SQLite, Snowflake and BigQuery. It moves only whitespace, so the query itself does not change.',
    keywords: [
      'sql beautifier',
      'format sql online',
      'sql pretty print',
      'postgres formatter',
      't-sql formatter',
      'sql indent',
    ],
    category: 'dev',
    icon: 'Database',
    popular: true,
    accepts: ['sql', 'txt'],
    faqs: [
      {
        q: 'Does the formatter change my query?',
        a: 'No. It moves only whitespace. The tokenizer reads strings, comments, quoted identifiers and parameters as single units and prints them again byte for byte. No keyword is reordered, no alias is renamed, and nothing is added or removed. If the tool cannot lay out a query, it tells you and leaves your input as it is.',
      },
      {
        q: 'Is it safe to paste a query with real table and column names?',
        a: 'Yes. The formatting runs as JavaScript in your tab, with no upload step and no logging. In 2025, researchers found about 80,000 saved snippets on popular formatter sites, many with live database credentials and connection strings. That can only happen on a site that receives your paste. This one does not.',
      },
      {
        q: 'Which dialect should I pick?',
        a: 'Pick the one you run. The dialect sets the keyword list, the comment syntax (MySQL also accepts #), the identifier quoting (backticks in MySQL and BigQuery, square brackets in T-SQL, double quotes elsewhere) and dialect-specific keywords such as QUALIFY, RETURNING and CONNECT BY. The wrong dialect still formats, but it may not uppercase every keyword.',
      },
      {
        q: 'Can it handle a file with many statements?',
        a: 'Yes. The tool splits statements on the semicolon, resets the indent stack between them, and can put a blank line between each one. For a large file, load the .sql file with the button.',
      },
      {
        q: 'Why are my parentheses reported as unbalanced?',
        a: 'The formatter counts opening and closing parentheses before it lays anything out. If they do not match it still produces output, but it warns you, because the indentation past that point is a guess. It is usually a missing bracket in a subquery or a CASE expression.',
      },
    ],
    related: ['sql-minify', 'json-validator', 'json-formatter', 'xml-formatter', 'diff-checker-code'],
    updated: UPDATED,
  },
  {
    slug: 'sql-minify',
    title: 'SQL Minifier',
    h1: 'Minify SQL to a single line',
    description:
      'SQL minifier that puts a query on one line for a config file, an env var or a log entry. You can remove comments, and the tokens do not change.',
    keywords: [
      'sql minifier',
      'sql one line',
      'compress sql',
      'remove sql comments',
      'sql to single line',
    ],
    category: 'dev',
    icon: 'Minimize2',
    accepts: ['sql', 'txt'],
    faqs: [
      {
        q: 'Why would I want SQL on one line?',
        a: 'Three common reasons: pasting a query into a YAML or JSON config field where a newline would need escaping, putting it into an environment variable, and getting a whole statement into a single log line so a grep finds all of it. It also makes two queries easy to compare character by character.',
      },
      {
        q: 'Is minified SQL faster?',
        a: 'No. The database parses the statement before it plans it, and discards whitespace at that stage. Minification only reduces the bytes that you send and store. It has no effect on query time.',
      },
      {
        q: 'What happens to my comments?',
        a: 'You choose. Removal is the default, because a line comment on one line hides the rest of the statement. If you keep comments, each line comment is followed by a newline so the query still parses. The output is then not strictly one line.',
      },
      {
        q: 'Are string literals safe?',
        a: 'Yes. The tokenizer treats a quoted string as one token, including doubled quotes and dollar-quoted Postgres bodies, so a comma or a double space inside a literal is preserved exactly. Only whitespace between tokens is collapsed.',
      },
    ],
    related: ['sql-formatter', 'json-minify', 'xml-minify', 'json-to-one-line'],
    updated: UPDATED,
  },

  /* ================================================================ */
  /* 52 · JSON validator family                                       */
  /* ================================================================ */
  {
    slug: 'json-validator',
    title: 'JSON Validator',
    h1: 'JSON validator with exact error positions',
    description:
      'JSON validator that shows the line, column and cause of each error. A repair button fixes trailing commas, single quotes and comments.',
    keywords: [
      'validate json',
      'json syntax checker',
      'json error line number',
      'fix json',
      'json parse error',
    ],
    category: 'dev',
    icon: 'CheckCheck',
    popular: true,
    accepts: ['json', 'txt'],
    faqs: [
      {
        q: 'How is this different from pasting into a browser console?',
        a: '`JSON.parse` gives one message. Its wording differs between browsers, and its position is a raw character offset. This page runs its own parser. It reports what it expected, what it found, and the line and column, then prints the bad line with a caret under the exact character.',
      },
      {
        q: 'What does the repair button actually change?',
        a: 'Six things, each counted separately before you commit: a byte-order mark, single-quoted strings, typographic “smart quotes”, // and /* */ comments, trailing commas before a closing bracket, and the JavaScript-only literals NaN, Infinity and undefined (replaced with null). It also quotes bare object keys. Anything inside a string literal is never touched.',
      },
      {
        q: 'Why does it warn about duplicate keys when the JSON is valid?',
        a: 'Duplicate keys are legal JSON but are almost never intentional. Every mainstream parser keeps the last occurrence and discards the earlier value without a warning, so a config file with the same key twice does not behave as it looks.',
      },
      {
        q: 'What is the warning about large integers?',
        a: 'JavaScript numbers are IEEE-754 doubles, so any integer above 2^53 loses precision. A 19-digit database ID pasted into JSON will round. The validator flags it; the fix is to send large IDs as strings.',
      },
      {
        q: 'Does it validate against a JSON Schema?',
        a: 'No. This page checks syntax only. To get a schema, use the JSON to JSON Schema generator to make one from a sample, then validate with your own tooling.',
      },
    ],
    related: ['json-lint', 'json-formatter', 'json-minify', 'json-to-typescript', 'json-viewer'],
    updated: UPDATED,
  },
  {
    slug: 'json-lint',
    title: 'JSON Lint',
    h1: 'JSON lint: syntax and quality warnings',
    description:
      'JSON lint that reports syntax errors with the line and column, plus warnings for duplicate keys and integers too large for JavaScript.',
    keywords: ['jsonlint', 'json linter', 'lint json online', 'json quality check'],
    category: 'dev',
    icon: 'ScanText',
    accepts: ['json', 'txt'],
    faqs: [
      {
        q: 'What does linting add over validating?',
        a: 'Validation answers one question: does a parser accept this? Linting also flags things that parse but are almost certainly bugs: the same key twice in one object, and integers too large to survive a JavaScript round trip. Both checks run here. The lint warnings appear under the green verdict.',
      },
      {
        q: 'Does it enforce a style guide?',
        a: 'No. JSON has no canonical style, and a style rule only adds noise. For consistent formatting across a repository, format with a fixed indent and sorted keys and commit that. The sort-keys switch on this page makes diffs stable.',
      },
      {
        q: 'Can I lint newline-delimited JSON (NDJSON)?',
        a: 'Not as one document. JSON permits exactly one top-level value, so an NDJSON file fails with “expected the end of the document”. Lint one line at a time, or put the lines in an array first.',
      },
      {
        q: 'What about JSON5 or JSONC?',
        a: 'They are different languages. Comments, trailing commas and unquoted keys are legal in JSON5 and in VS Code\'s JSONC, and illegal in JSON. If your file is JSONC, the errors on this page are expected. Use the repair button to make a strict-JSON copy.',
      },
    ],
    related: ['json-validator', 'json-formatter', 'json-to-json-schema', 'yaml-to-json'],
    updated: UPDATED,
  },
  {
    slug: 'json-minify',
    title: 'JSON Minifier',
    h1: 'Minify JSON',
    description:
      'JSON minifier that removes all optional whitespace and shows the bytes saved. The input is parsed first, so a result also proves that the JSON is valid.',
    keywords: ['json minifier', 'compress json', 'json compact', 'remove whitespace json'],
    category: 'dev',
    icon: 'Minimize2',
    accepts: ['json', 'txt'],
    faqs: [
      {
        q: 'How much smaller does JSON get?',
        a: 'Typically 15–30% for a formatted document, and much more for deeply nested data indented with four spaces. The exact figure for your file is shown above the output.',
      },
      {
        q: 'Will minifying make my API faster?',
        a: 'Less than you expect. Gzip and Brotli compress repeated indentation very well, so on a compressed transport the saving is often only a few percent. Minify for hard byte limits, such as a database column, a message-queue payload limit or a URL parameter.',
      },
      {
        q: 'Is minified JSON still valid?',
        a: 'Yes. Whitespace between tokens has no meaning in JSON, so both forms parse to exactly the same value. This tool parses your input, then serializes the parsed value again. For this reason an invalid input gives an error and no output.',
      },
      {
        q: 'Does key order change?',
        a: 'No, unless you turn on the sort switch. Object member order carries no meaning in JSON, but it is preserved by default so a diff against the original stays readable.',
      },
    ],
    related: ['json-formatter', 'json-validator', 'json-to-one-line', 'sql-minify', 'xml-minify'],
    updated: UPDATED,
  },
  {
    slug: 'json-to-one-line',
    title: 'JSON to One Line',
    h1: 'Convert JSON to one line',
    description:
      'Convert JSON to one line, with or without a space after each colon and comma, for log lines, environment variables and shell arguments.',
    keywords: [
      'json single line',
      'json one line converter',
      'flatten json formatting',
      'json for env variable',
    ],
    category: 'dev',
    icon: 'WrapText',
    accepts: ['json', 'txt'],
    faqs: [
      {
        q: 'How is this different from minifying?',
        a: 'Minifying removes every optional byte. One-line mode can keep a space after each colon and comma, which is still one line but stays readable when it appears in a log viewer or a terminal. Turn the spacing switch off and the two produce identical output.',
      },
      {
        q: 'Why do I need JSON on one line?',
        a: 'Structured log lines have to be one line or the log shipper splits them into separate records. Environment variables cannot contain a raw newline without escaping. And a JSON argument passed to a CLI is far easier to quote correctly when it has no line breaks.',
      },
      {
        q: 'How do I get this into a shell command safely?',
        a: 'Wrap it in single quotes for bash and zsh: `curl -d \'{"a": 1}\'`. If the JSON itself contains a single quote, use the Escape JSON tool to produce a fully escaped string literal instead.',
      },
      {
        q: 'Does it change any values?',
        a: 'No. The document is parsed and written again, so numbers keep their value and strings keep their exact contents. A newline inside a string stays as the two-character escape \\n and never becomes a real line break.',
      },
    ],
    related: ['json-minify', 'json-escape', 'json-formatter', 'json-validator'],
    updated: UPDATED,
  },
  {
    slug: 'json-escape',
    title: 'JSON Escape',
    h1: 'Escape a string for JSON',
    description:
      'Escape text for JSON. Turn any text, including a whole JSON document, into one escaped JSON string literal to put inside another payload.',
    keywords: [
      'escape json string',
      'json string escaper',
      'escape quotes for json',
      'stringify text',
    ],
    category: 'dev',
    icon: 'Quote',
    faqs: [
      {
        q: 'When do I need to escape JSON?',
        a: 'When a JSON value must contain text with quotes, backslashes or newlines. The two most common cases are a JSON document inside another JSON document (webhook payloads and log fields do this often) and a multi-line template in a single string field.',
      },
      {
        q: 'Which characters get escaped?',
        a: 'Double quote and backslash always. The control characters backspace, form feed, newline, carriage return and tab become their two-character escapes. Each other character below U+0020 becomes a \\u escape. Printable Unicode above ASCII stays as it is, because JSON is UTF-8.',
      },
      {
        q: 'Should I keep the surrounding quotes?',
        a: 'Keep them if you are pasting the result as a complete JSON value. Turn them off if you are pasting into somewhere that already has quotes around it, such as between the quotes of an existing string in a code editor.',
      },
      {
        q: 'Is this the same as URL encoding or HTML escaping?',
        a: 'No. These are three different escaping rules for three different contexts. JSON escaping uses backslashes, URL encoding uses %XX, and HTML escaping uses &entity;. The wrong one gives text that looks escaped but is not safe.',
      },
    ],
    related: ['json-unescape', 'json-validator', 'url-encoder-decoder', 'html-entity-encoder'],
    updated: UPDATED,
  },
  {
    slug: 'json-unescape',
    title: 'JSON Unescape',
    h1: 'Unescape a JSON string',
    description:
      'Unescape a JSON string back into readable text: \\" becomes ", \\n becomes a real line break, and \\uXXXX becomes the character it names.',
    keywords: [
      'unescape json',
      'json string decoder',
      'remove backslashes json',
      'decode escaped json',
    ],
    category: 'dev',
    icon: 'TextQuote',
    faqs: [
      {
        q: 'What can I paste here?',
        a: 'A complete JSON string literal with its double quotes, or only the escaped body without them. The tool adds the quotes for you. If the result is a JSON document, send it to the validator to format it.',
      },
      {
        q: 'Why does it say my string is not valid?',
        a: 'Almost always a lone backslash. In a JSON string, a literal backslash must be written as two backslashes, so a Windows path pasted raw (C:\\Users\\me) is invalid. The error also fires on an unterminated string and on a \\u escape without four hex digits.',
      },
      {
        q: 'It says "that parsed to a JSON value, not a string". What now?',
        a: 'You pasted a JSON object or array, and there is nothing to unescape. Use the JSON validator or formatter.',
      },
      {
        q: 'Does it decode \\u escapes outside the Basic Multilingual Plane?',
        a: 'Yes. JSON encodes characters above U+FFFF as a surrogate pair of two \\u escapes, and the tool joins the pair into the correct character, emoji included.',
      },
    ],
    related: ['json-escape', 'json-validator', 'json-formatter', 'url-encoder-decoder'],
    updated: UPDATED,
  },

  /* ================================================================ */
  /* 53 · XML formatter family                                        */
  /* ================================================================ */
  {
    slug: 'xml-formatter',
    title: 'XML Formatter',
    h1: 'XML formatter and pretty printer',
    description:
      'XML formatter that pretty-prints XML, SOAP, WSDL and config files with indentation and attribute wrapping. Mixed content stays as written.',
    keywords: [
      'xml beautifier',
      'format xml online',
      'pretty print xml',
      'soap formatter',
      'wsdl formatter',
    ],
    category: 'dev',
    icon: 'FileCode2',
    accepts: ['xml', 'svg', 'wsdl', 'xsd', 'rss'],
    faqs: [
      {
        q: 'Which parser does this use?',
        a: "The browser's own XML parser, the same one it uses for XHR responses and XSLT. A document that is well-formed here is well-formed in a real consumer. No third-party parser is downloaded or bundled.",
      },
      {
        q: 'Why is one of my elements left on a single line?',
        a: 'It has mixed content: text and child elements together, as in `<p>An <em>important</em> note</p>`. Whitespace between those children is significant, so new indentation would change the rendered text. The formatter detects mixed content, leaves it exactly as written, and tells you.',
      },
      {
        q: 'Does it validate against a DTD or XSD?',
        a: 'No. It checks well-formedness (tags matched and nested correctly, attributes quoted, entities defined), which catches most real errors. Schema validation needs the schema itself and is out of scope for a browser tool.',
      },
      {
        q: 'What happens to comments, CDATA and processing instructions?',
        a: 'Comments are kept by default and can be dropped with a switch. CDATA sections are reproduced verbatim, including their contents. Processing instructions and the XML declaration are preserved at the top of the document.',
      },
      {
        q: 'Is it safe to paste a SOAP request with credentials in the header?',
        a: 'Yes. Formatting happens in this tab, with no network request. If you disconnect from the internet, it still works. Expand the panel under the tool to see the live request counter.',
      },
    ],
    related: ['xml-validator', 'xml-minify', 'xml-viewer', 'xml-to-json', 'json-formatter'],
    updated: UPDATED,
  },
  {
    slug: 'xml-validator',
    title: 'XML Validator',
    h1: 'XML validator: check well-formedness',
    description:
      'XML validator that checks if a document is well-formed. It gives the line, column and a plain-English explanation of the first error.',
    keywords: [
      'validate xml',
      'xml syntax checker',
      'xml well formed',
      'xml error line',
      'check xml online',
    ],
    category: 'dev',
    icon: 'ShieldCheck',
    accepts: ['xml', 'xsd', 'wsdl'],
    faqs: [
      {
        q: 'What counts as an error?',
        a: 'Anything that stops the document being well-formed: a closing tag that does not match its opening tag (XML is case-sensitive), an unquoted attribute value, a bare & or <, an undefined entity such as &nbsp;, more than one root element, or content after the root closes.',
      },
      {
        q: 'Why does &nbsp; fail?',
        a: 'XML predefines exactly five entities: &amp; &lt; &gt; &quot; and &apos;. Each other entity must be declared in a DTD. HTML entities such as &nbsp;, &copy; and &mdash; are not available. Write the numeric reference, for example &#160; for a non-breaking space.',
      },
      {
        q: 'The error mentions a namespace prefix that is not bound. What does that mean?',
        a: 'You used something like `<soap:Envelope>` without a matching `xmlns:soap="…"` declaration in scope. Add the declaration on that element or an ancestor. Copy-pasting a fragment out of a larger document is the usual cause.',
      },
      {
        q: 'Does a valid result mean my API will accept it?',
        a: 'It means only that the document parses. It does not mean that it matches the schema the service expects, that required elements are present, or that values are in range.',
      },
    ],
    related: ['xml-formatter', 'xml-viewer', 'json-validator', 'xml-to-json'],
    updated: UPDATED,
  },
  {
    slug: 'xml-minify',
    title: 'XML Minifier',
    h1: 'Minify XML',
    description:
      'XML minifier that removes whitespace between elements and, if you choose, comments. It shows the size before and after, and the output is always valid.',
    keywords: ['xml minifier', 'compress xml', 'strip xml whitespace', 'remove xml comments'],
    category: 'dev',
    icon: 'Minimize2',
    accepts: ['xml'],
    faqs: [
      {
        q: 'Which whitespace is safe to remove?',
        a: 'Whitespace-only text nodes between elements: the indentation that a pretty printer added. Whitespace inside a text node that also has characters is kept, and can optionally be collapsed to one space. If your document relies on `xml:space="preserve"`, minify with care.',
      },
      {
        q: 'How much does XML shrink?',
        a: 'Usually 20–50% for a document that was indented, because XML has more markup per byte of data than JSON does. The exact figure for your file is shown above the output.',
      },
      {
        q: 'Should I minify a sitemap or an RSS feed?',
        a: 'You can, but serve it with gzip or Brotli first. Compression does far more for transfer size than minification, and consumers ignore the layout. Minify when there is a hard byte limit, such as an SMS/MMS gateway payload or an embedded device.',
      },
      {
        q: 'Are empty elements collapsed?',
        a: 'Optionally. `<a></a>` and `<a/>` are exactly equivalent to a parser, and the short form saves bytes, so it is on by default. Turn it off if a downstream consumer of yours is not a real XML parser and mishandles self-closing tags.',
      },
    ],
    related: ['xml-formatter', 'xml-validator', 'json-minify', 'sql-minify'],
    updated: UPDATED,
  },
  {
    slug: 'xml-viewer',
    title: 'XML Viewer',
    h1: 'XML tree viewer',
    description:
      'XML viewer that shows a large document as a collapsible tree of element names, attributes and text. Each branch opens from the keyboard.',
    keywords: ['xml tree viewer', 'browse xml online', 'xml explorer', 'open xml file'],
    category: 'dev',
    icon: 'ListTree',
    accepts: ['xml', 'svg', 'rss', 'atom'],
    faqs: [
      {
        q: 'How big a file can I open?',
        a: 'The limit is the memory of your device. A few tens of megabytes is comfortable in a desktop browser. On a phone, the tree becomes slow well before that. For a large file, use the file button.',
      },
      {
        q: 'Can I navigate it with the keyboard?',
        a: 'Yes. Every branch is a native disclosure element, so Tab moves between them and Enter or Space expands and collapses. Browser find (Ctrl+F / Cmd+F) searches the expanded text.',
      },
      {
        q: 'The first two levels are open and the rest are closed. Can I change that?',
        a: 'The first two levels open automatically, because they usually show the shape of the document. Deeper branches open one at a time. There is no expand-all, because on a large document it freezes the page.',
      },
      {
        q: 'Where did the whitespace between my elements go?',
        a: 'Whitespace-only text nodes are not shown, because in an indented document they are only formatting. Text nodes with content appear to the right of the element name.',
      },
    ],
    related: ['xml-formatter', 'xml-validator', 'json-viewer', 'xml-to-json'],
    updated: UPDATED,
  },
  {
    slug: 'xml-escape',
    title: 'XML Escape',
    h1: 'Escape text for XML',
    description:
      'Escape text for XML: &, <, > and quotes become entity references, so a fragment is safe in element text or in an attribute value.',
    keywords: ['escape xml', 'xml entity encoder', 'escape ampersand xml', 'xml special characters'],
    category: 'dev',
    icon: 'Quote',
    faqs: [
      {
        q: 'Which characters have to be escaped in XML?',
        a: 'In element text, & and < always. In an attribute value, also the quote character you used as the delimiter. > is not strictly required in text but is escaped here by default, because leaving it raw can create an accidental `]]>` inside CDATA-adjacent content.',
      },
      {
        q: 'Why are there only five entities?',
        a: 'XML defines &amp; &lt; &gt; &quot; and &apos; and nothing else. Any other named entity must come from a DTD. For this reason HTML entities such as &nbsp; break an XML parser. Use a numeric reference like &#160;.',
      },
      {
        q: 'Should I escape non-ASCII characters?',
        a: 'No. XML documents are Unicode, normally UTF-8, so accented letters, CJK text and emoji can appear literally. Escaping them to numeric references makes the file larger and harder to read for no benefit.',
      },
      {
        q: 'Is this the same as HTML escaping?',
        a: 'Almost. HTML has about 2,000 named entities and XML has five. Text escaped for XML is always safe in HTML. Text escaped for HTML can contain entities that an XML parser rejects.',
      },
    ],
    related: ['xml-unescape', 'html-entity-reference', 'html-entity-encoder', 'xml-formatter'],
    updated: UPDATED,
  },
  {
    slug: 'xml-unescape',
    title: 'XML Unescape',
    h1: 'Unescape XML entities',
    description:
      'Unescape XML entities back into characters, including numeric forms such as &#160; and &#x00A0;, so that escaped markup is readable again.',
    keywords: [
      'unescape xml',
      'decode xml entities',
      'xml entity decoder',
      'convert &amp; back',
    ],
    category: 'dev',
    icon: 'TextQuote',
    faqs: [
      {
        q: 'Which entities are decoded?',
        a: 'The five XML built-ins, each decimal reference (&#160;), each hexadecimal reference (&#x00A0;), and the two dozen HTML named entities that appear most often in escaped XML: nbsp, copy, mdash, the curly quotes and the currency signs. The tool leaves an unknown entity exactly as written.',
      },
      {
        q: 'My text has &amp;amp; in it. What is going on?',
        a: 'It was escaped twice. This is a common bug when a value passes through two layers that each escape it. Run the unescape twice, then fix the pipeline so only one layer escapes.',
      },
      {
        q: 'Does unescaping make my markup unsafe?',
        a: 'It can. The result is no longer safe to paste back into an XML document without escaping it again. Unescape to read a value, and escape it again before you write it anywhere.',
      },
      {
        q: 'Will it turn escaped markup back into working XML?',
        a: 'It gives the original characters, so `&lt;a/&gt;` becomes `<a/>`. Whether the result is a well-formed document depends on what was escaped. Paste the output into the XML validator to find out.',
      },
    ],
    related: ['xml-escape', 'xml-validator', 'html-entity-reference', 'ascii-table'],
    updated: UPDATED,
  },

  /* ================================================================ */
  /* 54 · XML ↔ JSON                                                  */
  /* ================================================================ */
  {
    slug: 'xml-to-json',
    title: 'XML to JSON Converter',
    h1: 'Convert XML to JSON',
    description:
      'Convert XML to JSON with a configurable attribute prefix, text key and forced-array rules. A note marks each place where the mapping loses data.',
    keywords: [
      'xml to json converter',
      'convert xml to json online',
      'soap to json',
      'xml json attributes',
    ],
    category: 'dev',
    icon: 'ArrowLeftRight',
    accepts: ['xml'],
    faqs: [
      {
        q: 'Why does the output have keys starting with @?',
        a: 'XML has attributes and JSON does not. The convention here puts a prefix on attribute names, so `<item id="1"/>` becomes `{"item": {"@id": "1"}}`. You can change the prefix to $, _ or anything else. Without a prefix, an attribute and a child element with the same name would collide.',
      },
      {
        q: 'A list with one item comes out as an object instead of an array. How do I fix it?',
        a: 'This is the most common XML-to-JSON bug, and the "always arrays" field is there for it. Enter the element names that represent a collection, such as `item, book, entry`, and they become arrays even when the document has exactly one.',
      },
      {
        q: 'What is lost in the conversion?',
        a: 'Three things, and the tool tells you when each applies. Mixed content loses the position of text relative to its sibling elements. Document order between differently-named siblings is lost, because JSON objects group by key. And comments and processing instructions are dropped unless you keep them.',
      },
      {
        q: 'Should I turn on scalar coercion?',
        a: 'Only if you know your data. It turns "42" into 42 and "true" into true. This is convenient, and wrong for anything that only looks numeric: zip codes, phone numbers, version strings, and IDs with leading zeros. Leading zeros are kept as strings, but "0000123" is not the only trap.',
      },
    ],
    related: ['json-to-xml', 'xml-formatter', 'json-formatter', 'json-to-typescript', 'csv-to-json'],
    updated: UPDATED,
  },
  {
    slug: 'json-to-xml',
    title: 'JSON to XML Converter',
    h1: 'Convert JSON to XML',
    description:
      'Convert JSON to XML. Prefixed keys become attributes, arrays repeat their element, and the tool renames illegal key names and lists each change.',
    keywords: [
      'json to xml converter',
      'convert json to xml online',
      'json xml attributes',
      'generate xml from json',
    ],
    category: 'dev',
    icon: 'ArrowLeftRight',
    accepts: ['json'],
    faqs: [
      {
        q: 'How do I make a JSON key become an attribute?',
        a: 'Put the attribute marker in front of it: `"@id": "1"` gives `id="1"` on the element in place of a child element. Change the marker in the options if your data uses `$` or `_`.',
      },
      {
        q: 'What happens to an array?',
        a: 'It repeats the element. `{"items": {"item": [1, 2]}}` becomes two `<item>` elements inside `<items>`. A bare top-level array is wrapped in the root element and each entry becomes an `<item>`, since XML must have exactly one root.',
      },
      {
        q: 'Why was one of my keys renamed?',
        a: 'XML element names cannot start with a digit, cannot contain spaces or most punctuation, and cannot start with the letters "xml" in any case. The tool replaces illegal characters with underscores and lists each rename under the output.',
      },
      {
        q: 'Does it produce a declaration and an encoding?',
        a: 'Yes, `<?xml version="1.0" encoding="UTF-8"?>` by default. Switch it off to make a fragment for a larger document. The output is UTF-8, because your browser produces UTF-8.',
      },
    ],
    related: ['xml-to-json', 'xml-formatter', 'json-validator', 'json-to-yaml'],
    updated: UPDATED,
  },

  /* ================================================================ */
  /* 55 · JSON to code                                                */
  /* ================================================================ */
  {
    slug: 'json-to-typescript',
    title: 'JSON to TypeScript',
    h1: 'Generate TypeScript interfaces from JSON',
    description:
      'Convert JSON to TypeScript interfaces. Paste an API response and get named interfaces with optional keys, union types and nested types from the data.',
    keywords: [
      'json to typescript interface',
      'generate typescript types from json',
      'json to ts',
      'typescript interface generator',
    ],
    category: 'dev',
    icon: 'FileCode',
    accepts: ['json'],
    faqs: [
      {
        q: 'How does it decide what is optional?',
        a: 'It compares each element of an array. A key in all elements is required, and a key in only some is marked with `?`. For this reason several records give much better types than one: one record shows nothing about variability.',
      },
      {
        q: 'Where do the interface names come from?',
        a: 'From the key that holds the object, in PascalCase, and in the singular for array elements, so `line_items` gives a `LineItem` interface. Objects with the same structure share one interface, and a name collision gets a numeric suffix.',
      },
      {
        q: 'Why is a field typed `unknown[]`?',
        a: 'The array was empty in your sample, so there is no element type to infer. Paste a response with at least one element, or fill in the type by hand.',
      },
      {
        q: 'Can I trust the generated types?',
        a: 'Treat them as a first draft. They describe the sample you pasted, and the API contract can differ: a field that is non-null in your response can be nullable in production, and an enum-like string becomes plain `string`. Check them against the API documentation before you commit.',
      },
      {
        q: 'Is my API response uploaded anywhere?',
        a: 'No. The inference and the emitter are about 500 lines of JavaScript that run in this tab. This matters here, because a real API response usually contains customer records, internal IDs and sometimes a token.',
      },
    ],
    related: [
      'json-to-zod-schema',
      'json-to-go',
      'json-to-json-schema',
      'json-validator',
      'json-formatter',
    ],
    updated: UPDATED,
  },
  {
    slug: 'json-to-go',
    title: 'JSON to Go Struct',
    h1: 'Generate Go structs from JSON',
    description:
      'Convert JSON to Go structs with correct json tags, Go initialisms (ID, URL, API), int64 and float64 inference, and omitempty on optional keys.',
    keywords: [
      'json to go struct',
      'go struct generator',
      'json tags golang',
      'generate golang types from json',
    ],
    category: 'dev',
    icon: 'FileCode',
    accepts: ['json'],
    faqs: [
      {
        q: 'Does it follow Go naming conventions?',
        a: 'Yes. Field names are exported PascalCase, and known initialisms are fully capitalised the way `go vet` and golint expect: `user_id` becomes `UserID`, not `UserId`, and `api_url` becomes `APIURL`. The original key is preserved in the json tag, so the wire format is unaffected.',
      },
      {
        q: 'Why int64 rather than int?',
        a: '`int` is 32-bit on some platforms, and JSON integers often exceed that: a Unix timestamp in milliseconds already does. int64 is the safe default. Change it by hand if you know the range is small.',
      },
      {
        q: 'When do I get a pointer type?',
        a: 'When a value was sometimes null and nullable modelling is on. A `*string` lets you distinguish "absent or null" from "empty string", which a plain `string` cannot. Slices and maps are already nilable, so they are never wrapped in a pointer.',
      },
      {
        q: 'What does omitempty do here?',
        a: 'It is added to keys that were missing from some records, so when you marshal the struct back to JSON, those keys are left out and no zero value is written. Be careful: omitempty also drops legitimate zeros, empty strings and false, so remove it on fields where those values have meaning.',
      },
    ],
    related: ['json-to-typescript', 'json-to-csharp', 'json-to-python-dataclass', 'json-validator'],
    updated: UPDATED,
  },
  {
    slug: 'json-to-zod-schema',
    title: 'JSON to Zod Schema',
    h1: 'Generate a Zod schema from JSON',
    description:
      'Convert JSON to a Zod schema with nested z.object() definitions, .optional() and .nullable() modifiers, and an inferred TypeScript type.',
    keywords: [
      'json to zod',
      'zod schema generator',
      'generate zod from json',
      'zod validation schema',
    ],
    category: 'dev',
    icon: 'ShieldCheck',
    accepts: ['json'],
    faqs: [
      {
        q: 'Why generate a Zod schema instead of a TypeScript interface?',
        a: 'An interface disappears at runtime. A Zod schema is a runtime check. When you parse an API response through a schema, a contract change fails at the boundary, before it causes an undefined-property crash three functions later. `z.infer` still gives you the static type.',
      },
      {
        q: 'What does the generated code import?',
        a: "Only `import { z } from 'zod'`. This page does not bundle Zod and does not need it to generate the schema. You install it in your own project.",
      },
      {
        q: 'Are integers distinguished from floats?',
        a: 'Yes. A value that was a whole number in the sample becomes `z.number().int()`. If the same field is sometimes fractional across your records, the merged type drops `.int()`. Review the strictness before you ship: a field that was integral in your sample may not always be.',
      },
      {
        q: 'How do I make the schema stricter?',
        a: 'Add the constraints that the generator cannot infer: `.email()`, `.uuid()`, `.min()`, `.max()`, `.datetime()`, and `z.enum([...])` where a string only takes a few values. The generated file is a starting point.',
      },
    ],
    related: ['json-to-typescript', 'json-to-json-schema', 'json-validator', 'json-formatter'],
    updated: UPDATED,
  },
  {
    slug: 'json-to-json-schema',
    title: 'JSON to JSON Schema',
    h1: 'Generate a JSON Schema from a sample',
    description:
      'JSON Schema generator that infers a draft 2020-12 schema from sample JSON, with types, required keys, nested object schemas and array item types.',
    keywords: [
      'json schema generator',
      'generate json schema from json',
      'draft 2020-12 schema',
      'infer json schema',
    ],
    category: 'dev',
    icon: 'Braces',
    accepts: ['json'],
    faqs: [
      {
        q: 'Which draft does it emit?',
        a: 'Draft 2020-12, declared in `$schema`. It is the current release and the default of Ajv, python-jsonschema and most modern validators. Earlier drafts differ mainly in how `items` and `$defs` work. A change to an earlier draft is usually a small edit.',
      },
      {
        q: 'Why is additionalProperties false?',
        a: 'A schema made from a sample should be strict by default: an unexpected key is the kind of drift that a schema must catch. Delete the line if your API can add fields without notice.',
      },
      {
        q: 'How is "required" decided?',
        a: 'A key that appeared in each merged sample of that object is required. A key that appeared in only some is not. More sample records give a better answer than one.',
      },
      {
        q: 'What is not inferred?',
        a: 'Formats (email, uri, date-time), enums, numeric ranges, string patterns, descriptions and titles. These encode intent, and no sample can show them. Add them by hand.',
      },
    ],
    related: ['json-to-zod-schema', 'json-to-typescript', 'json-validator', 'json-lint'],
    updated: UPDATED,
  },
  {
    slug: 'json-to-python-dataclass',
    title: 'JSON to Python Dataclass',
    h1: 'Generate Python dataclasses from JSON',
    description:
      'Convert JSON to Python dataclasses with modern type hints, snake_case attribute names, and optional fields that default to None.',
    keywords: [
      'json to python class',
      'python dataclass generator',
      'json to dataclass',
      'generate python types from json',
    ],
    category: 'dev',
    icon: 'FileCode',
    accepts: ['json'],
    faqs: [
      {
        q: 'Which Python version does the output target?',
        a: 'Python 3.10 and later. It uses built-in generics (`list[str]` rather than `List[str]`) and the `X | None` union syntax, and includes `from __future__ import annotations` so the forward references between classes resolve regardless of definition order.',
      },
      {
        q: 'What happens to a key that is not a valid identifier?',
        a: 'It is converted to snake_case, and a trailing underscore is added if the result collides with a Python keyword (`class` becomes `class_`). The original JSON key is preserved in a comment on the same line so you can wire up an alias.',
      },
      {
        q: 'Will these classes deserialise JSON automatically?',
        a: 'No. `SomeClass(**data)` works for a flat object, but nested dataclasses need construction by hand or a library such as dacite, pydantic or mashumaro. The generated file gives you the shape, and you choose the parsing strategy.',
      },
      {
        q: 'Why do optional fields come last?',
        a: 'A dataclass field with a default cannot come before a field without one: Python raises a TypeError at class definition time. Required fields come first, then optional fields with `= None`.',
      },
    ],
    related: ['json-to-typescript', 'json-to-go', 'json-to-csharp', 'json-validator'],
    updated: UPDATED,
  },
  {
    slug: 'json-to-csharp',
    title: 'JSON to C# Classes',
    h1: 'Generate C# classes from JSON',
    description:
      'Convert JSON to C# classes with System.Text.Json attributes, PascalCase properties, nullable reference types and List<T> collections.',
    keywords: [
      'json to c# class',
      'csharp class generator',
      'json to poco',
      'system.text.json attributes',
    ],
    category: 'dev',
    icon: 'FileCode',
    accepts: ['json'],
    faqs: [
      {
        q: 'Which serialiser do the attributes target?',
        a: 'System.Text.Json: `[JsonPropertyName("…")]` from `System.Text.Json.Serialization`. If your project uses Newtonsoft.Json, replace the attribute with `[JsonProperty("…")]` and the using directive with `Newtonsoft.Json`. Nothing else changes.',
      },
      {
        q: 'Why long and double instead of int and decimal?',
        a: 'long, because JSON integers often exceed 32 bits. double, because a JSON number is an IEEE-754 double. For money, change the field to decimal by hand and make sure that the API sends it as a string. If not, you get the float rounding that you wanted to avoid.',
      },
      {
        q: 'Do the properties handle nullable reference types?',
        a: 'Values that were null in the sample, and keys that were missing from some records, get `?`. Reference-type properties that were always present are emitted without it, which will warn under `<Nullable>enable</Nullable>` until you add a constructor or `required`.',
      },
      {
        q: 'Can I get records instead of classes?',
        a: 'Not automatically, but the change is mechanical: change `class X { … }` to `record X(…)` with the properties as positional parameters, or use `init` accessors in place of `set` for an immutable class.',
      },
    ],
    related: ['json-to-typescript', 'json-to-go', 'json-to-python-dataclass', 'json-validator'],
    updated: UPDATED,
  },

  /* ================================================================ */
  /* 56 · Markdown editor                                             */
  /* ================================================================ */
  {
    slug: 'markdown-editor',
    title: 'Markdown Editor',
    h1: 'Markdown editor with live preview',
    description:
      'Markdown editor with a synced live preview, GFM tables and task lists, a word count, optional autosave in this browser, and export to .md or .html.',
    keywords: [
      'markdown editor online',
      'markdown live preview',
      'gfm editor',
      'markdown writer',
      'md editor',
    ],
    category: 'data',
    icon: 'NotebookPen',
    popular: true,
    accepts: ['md', 'markdown', 'txt'],
    faqs: [
      {
        q: 'Where is my draft stored?',
        a: 'Nowhere, unless you turn on autosave. Then it is only in the localStorage of this browser, on this device. There is no account and no sync. The panel shows the time of the last save, and a "delete saved draft" button is always next to it.',
      },
      {
        q: 'Which Markdown flavour does the preview use?',
        a: 'GitHub Flavored Markdown: pipe tables, task lists, strikethrough, fenced code blocks and autolinks, on top of CommonMark. An option treats a single newline as a line break. This matches GitHub comments, but CommonMark paragraphs do not work this way.',
      },
      {
        q: 'Is raw HTML in my Markdown rendered?',
        a: 'Only the safe parts. The preview goes through an allowlist sanitiser: script, style, iframe, form and similar elements are removed, each inline event handler is removed, and any URL that is not http, https, mailto, tel or a relative path is dropped. Your source does not change. The filter applies only to the preview.',
      },
      {
        q: 'How do the two panes stay in sync?',
        a: 'When you scroll one pane, the other scrolls in proportion. The sync uses a ratio and does not map line by line, so a document with a very tall image or code block drifts slightly.',
      },
      {
        q: 'Can I export to Word or PDF?',
        a: 'Download the HTML and open it in Word, or use the print button and choose "Save as PDF". For a real .docx there is a dedicated Markdown to Word tool elsewhere on the site.',
      },
    ],
    related: [
      'markdown-to-html',
      'markdown-table-generator',
      'html-to-markdown',
      'markdown-to-pdf',
      'word-counter',
    ],
    updated: UPDATED,
  },

  /* ================================================================ */
  /* 57 · Markdown table family                                       */
  /* ================================================================ */
  {
    slug: 'markdown-table-generator',
    title: 'Markdown Table Generator',
    h1: 'Markdown table generator',
    description:
      'Markdown table generator with a spreadsheet-style grid. Paste from Excel, Sheets, CSV or HTML, set alignment, and export Markdown, CSV, HTML or JSON.',
    keywords: [
      'markdown table generator',
      'gfm table maker',
      'excel to markdown table',
      'markdown table editor',
    ],
    category: 'data',
    icon: 'Table',
    popular: true,
    faqs: [
      {
        q: 'Can I paste straight from Excel or Google Sheets?',
        a: 'Yes. A spreadsheet copies as tab-separated text. The paste box detects it automatically, and also comma, semicolon and pipe separated values, HTML tables and existing Markdown tables. The detected format shows next to the box.',
      },
      {
        q: 'How do I set column alignment?',
        a: 'Click the alignment button above a column to cycle left, centre and right. That writes the `:---`, `:---:` and `---:` markers into the separator row, which is what GitHub, GitLab and most Markdown renderers use.',
      },
      {
        q: 'What if a cell contains a pipe character?',
        a: 'It is escaped as `\\|` automatically, which is the GFM rule. Newlines inside a cell become `<br>`, because a Markdown table row cannot span lines.',
      },
      {
        q: 'Does the padding matter?',
        a: 'Not to the renderer: a table with ragged pipes renders the same. It matters to people who read the source, and to your diffs. Padding is on by default. Turn it off for the smallest output.',
      },
      {
        q: 'Is my data saved?',
        a: 'Only if you turn on "keep this table on this device", which writes the grid to the localStorage of this browser. When you turn it off, the saved grid is deleted immediately. Nothing is sent anywhere.',
      },
    ],
    related: [
      'csv-to-markdown-table',
      'html-table-to-markdown',
      'markdown-table-to-csv',
      'markdown-editor',
      'csv-to-json',
    ],
    updated: UPDATED,
  },
  {
    slug: 'csv-to-markdown-table',
    title: 'CSV to Markdown Table',
    h1: 'Convert CSV to a Markdown table',
    description:
      'Convert CSV to a Markdown table. Paste comma, tab, semicolon or pipe separated values and get an aligned GFM table, with quoted fields parsed correctly.',
    keywords: [
      'csv to markdown',
      'convert csv to markdown table',
      'tsv to markdown',
      'spreadsheet to markdown',
    ],
    category: 'data',
    icon: 'TableProperties',
    faqs: [
      {
        q: 'Does it handle quoted fields?',
        a: 'Yes. The parser follows RFC 4180: a field in double quotes can contain commas, newlines and doubled quotes, and none of them break the column split. A naive split on commas, which most online converters use, mangles exactly those rows.',
      },
      {
        q: 'How is the delimiter detected?',
        a: 'The tool reads the first rows and picks the separator that gives a consistent column count. It recognises comma, tab, semicolon and pipe. This covers CSV exported in European locales (semicolon) and data copied from a spreadsheet (tab).',
      },
      {
        q: 'My first row is data, not a header. What do I do?',
        a: 'Turn off "first row is a header" in the output options. Markdown tables always render a header row, so a generic `Column 1`, `Column 2` header is emitted instead and all of your rows stay in the body.',
      },
      {
        q: 'Can I edit before exporting?',
        a: 'Yes. The parsed data goes into an editable grid, so you can fix a typo, delete a column or set alignment before you copy the Markdown.',
      },
    ],
    related: [
      'markdown-table-generator',
      'markdown-table-to-csv',
      'csv-to-json',
      'excel-to-csv',
      'markdown-editor',
    ],
    updated: UPDATED,
  },
  {
    slug: 'html-table-to-markdown',
    title: 'HTML Table to Markdown',
    h1: 'Convert an HTML table to Markdown',
    description:
      'Convert an HTML table to Markdown. Paste a <table> and get a GFM table, with align attributes kept in the separator row and nested markup reduced to text.',
    keywords: [
      'html table to markdown',
      'convert table to markdown',
      'html to gfm table',
      'scrape table to markdown',
    ],
    category: 'data',
    icon: 'Table2',
    faqs: [
      {
        q: 'What exactly should I paste?',
        a: 'The HTML source of the table, starting at `<table>`. In a browser, right-click the table, choose Inspect, then copy the outer HTML of the `<table>` node. A copy of the rendered table usually arrives as tab-separated text. The CSV to Markdown Table tool handles that.',
      },
      {
        q: 'What happens to formatting inside cells?',
        a: 'It is flattened to text. Bold, links and spans inside a cell become their plain text content, and runs of whitespace collapse to a single space. Markdown tables cannot contain block elements, so a nested list or a second table cannot survive the trip.',
      },
      {
        q: 'Are colspan and rowspan supported?',
        a: 'No. No Markdown table format supports them, because GFM tables are strictly rectangular. A merged cell becomes a single cell in its own column and the rest of the row shifts, so check the grid before you export.',
      },
      {
        q: 'Does it keep the alignment?',
        a: 'Yes, when it is expressed as an `align` attribute on the header cells. Alignment set in CSS cannot be read from the markup alone, so set those columns manually in the grid.',
      },
    ],
    related: [
      'markdown-table-generator',
      'html-to-markdown',
      'csv-to-markdown-table',
      'markdown-editor',
    ],
    updated: UPDATED,
  },
  {
    slug: 'markdown-table-to-csv',
    title: 'Markdown Table to CSV',
    h1: 'Convert a Markdown table to CSV',
    description:
      'Convert a Markdown table to CSV for Excel, Numbers or a script. Escaped pipes are restored, alignment markers are removed, and you pick the delimiter.',
    keywords: [
      'markdown to csv',
      'markdown table to excel',
      'convert md table to csv',
      'pipe table to csv',
    ],
    category: 'data',
    icon: 'FileSpreadsheet',
    faqs: [
      {
        q: 'What counts as a valid Markdown table?',
        a: 'A header row of pipe-separated cells, then a separator row where every cell is dashes with optional colons, then the body. Leading and trailing pipes are optional. If the separator row is missing or its cell count does not match the header, the tool tells you and does not guess.',
      },
      {
        q: 'How do I open the result in Excel?',
        a: 'Download the CSV and open it. If your locale uses a comma as the decimal separator, choose the semicolon delimiter first, or Excel puts every row in one column. The delimiter switch is under the output.',
      },
      {
        q: 'What happens to escaped pipes and <br> tags?',
        a: '`\\|` becomes a literal pipe inside the CSV field, correctly quoted. `<br>` stays as text. A CSV field can contain a real newline, and a silent conversion would change your data. Replace it yourself if you want a newline.',
      },
      {
        q: 'Can I get JSON instead?',
        a: 'Yes. Switch the output format to JSON and each body row becomes an object keyed by the header cells. Use this to turn a documentation table into fixtures or seed data.',
      },
    ],
    related: [
      'markdown-table-generator',
      'csv-to-markdown-table',
      'csv-to-excel',
      'csv-to-json',
      'markdown-editor',
    ],
    updated: UPDATED,
  },

  /* ================================================================ */
  /* 58 · Colour pairs                                                */
  /* ================================================================ */
  {
    slug: 'hex-to-rgb-converter',
    title: 'HEX to RGB Converter',
    h1: 'HEX to RGB converter',
    description:
      'Convert HEX to RGB with a live swatch, alpha support and WCAG contrast ratios. Each other CSS notation for the colour is listed, ready to copy.',
    keywords: ['hex to rgb', 'hex color to rgb', 'hex2rgb', 'convert hex to rgb css'],
    category: 'dev',
    icon: 'Palette',
    faqs: [
      {
        q: 'How does hex map to RGB?',
        a: 'Each pair of hex digits is one channel in base 16. `#2563eb` splits into 25, 63 and eb, which are 37, 99 and 235 in decimal, so `rgb(37, 99, 235)`. Three-digit shorthand doubles each digit: `#2ce` means `#22ccee`.',
      },
      {
        q: 'What does an eight-digit hex code mean?',
        a: 'The last pair is alpha, from 00 (transparent) to ff (opaque). `#2563eb80` is about 50% opacity. Every current browser supports it. For very old browsers, use `rgba()`.',
      },
      {
        q: 'Why does the page show contrast ratios?',
        a: 'You usually convert a colour because you want to put text on it. WCAG asks for 4.5:1 for body text and 3:1 for large text. The two figures show whether white or black text passes on this background.',
      },
      {
        q: 'Can I paste a colour name?',
        a: 'Yes. Any of the 148 CSS named colours works (`rebeccapurple`, `tomato`, `cornflowerblue`), and so do bare triples like `37 99 235`. The nearest named colour is listed at the bottom of the table for any input.',
      },
    ],
    related: ['rgb-to-hex', 'hex-to-hsl', 'rgba-to-hex', 'color-converter', 'color-palette-generator'],
    updated: UPDATED,
  },
  {
    slug: 'rgb-to-hex',
    title: 'RGB to HEX Converter',
    h1: 'RGB to HEX converter',
    description:
      'RGB to HEX converter for rgb() and rgba() values. Alpha becomes the last pair of an 8-digit hex code, and each other CSS notation is ready to copy.',
    keywords: ['rgb to hex', 'rgb2hex', 'convert rgb to hex code', 'rgba to hex color'],
    category: 'dev',
    icon: 'Palette',
    faqs: [
      {
        q: 'What input formats are accepted?',
        a: '`rgb(37, 99, 235)`, the modern space syntax `rgb(37 99 235 / 50%)`, percentages, `rgba()` with a 0–1 alpha, and a bare triple such as `37, 99, 235`. The tool clamps out-of-range values to 0–255.',
      },
      {
        q: 'Why do designers still use hex?',
        a: 'Habit and compactness. Six characters carry the same information as `rgb(37, 99, 235)` and paste more cleanly into a spreadsheet, a Figma field or a Slack message. To a browser the two are identical.',
      },
      {
        q: 'Does converting lose precision?',
        a: 'Not for whole-number channels: 0–255 maps exactly onto 00–ff. Percentages and alpha do round. An alpha of 0.5 becomes 80 in hex, which is 128/255, or 50.2%. The difference is invisible.',
      },
      {
        q: 'Where does the shorthand form come from?',
        a: 'Three-digit hex is possible only when both digits of each channel match: `#2244cc` can be written `#24c`, but `#2563eb` cannot. The full form is always shown.',
      },
    ],
    related: ['hex-to-rgb-converter', 'hsl-to-hex', 'rgba-to-hex', 'color-converter'],
    updated: UPDATED,
  },
  {
    slug: 'hex-to-hsl',
    title: 'HEX to HSL Converter',
    h1: 'HEX to HSL converter',
    description:
      'Convert HEX to HSL to work in hue, saturation and lightness. In HSL, a tint and shade scale is one hue and saturation at a range of lightness values.',
    keywords: ['hex to hsl', 'convert hex to hsl css', 'hsl color converter', 'hex hsl'],
    category: 'dev',
    icon: 'Droplet',
    faqs: [
      {
        q: 'Why work in HSL at all?',
        a: 'It maps onto the things that designers change. A darker version of a colour has the same hue and saturation and a lower lightness. A muted version has the same hue and less saturation. In hex, both are guesswork.',
      },
      {
        q: 'How do I build a tint and shade scale?',
        a: 'Take the hue and saturation from the conversion and change the lightness in even steps: 95%, 90%, 80% and down to 15%. Reduce saturation slightly at the extremes, or the lightest tints look chalky and the darkest shades look muddy.',
      },
      {
        q: 'What does the hue number mean?',
        a: 'A position on the colour wheel in degrees: 0 red, 60 yellow, 120 green, 180 cyan, 240 blue, 300 magenta. Adding 180 gives the complementary colour; ±30 gives analogous colours.',
      },
      {
        q: 'Is HSL the same as HSB or HSV?',
        a: 'No. HSL lightness goes from black through the pure hue at 50% to white at 100%. HSV/HSB brightness goes from black to the pure hue at 100% and never reaches white. The table shows both values.',
      },
    ],
    related: ['hsl-to-hex', 'hex-to-rgb-converter', 'color-palette-generator', 'css-gradient-generator'],
    updated: UPDATED,
  },
  {
    slug: 'hsl-to-hex',
    title: 'HSL to HEX Converter',
    h1: 'HSL to HEX converter',
    description:
      'HSL to HEX converter for hsl() and hsla() values, with a live swatch. Hue wraps at 360, and each other CSS notation is listed next to the result.',
    keywords: ['hsl to hex', 'convert hsl to hex', 'hsla to hex', 'hsl color to hex code'],
    category: 'dev',
    icon: 'Droplet',
    faqs: [
      {
        q: 'What input does it accept?',
        a: '`hsl(221, 83%, 53%)`, the space syntax `hsl(221 83% 53% / 50%)`, `hsla()` with a 0–1 alpha, and a bare triple with percent signs such as `221 83% 53%`. Hue wraps, so 380 is treated as 20.',
      },
      {
        q: 'Why does my hex look slightly different from the HSL I typed?',
        a: 'Rounding. HSL is continuous and hex is a 24-bit grid, so the conversion snaps to the nearest colour on the grid. A round trip hex → HSL → hex always returns the original byte. A round trip in the other direction can shift a hue by a fraction of a degree.',
      },
      {
        q: 'Should I ship HSL or hex in my CSS?',
        a: 'Either. Browsers treat them the same. HSL is easier to maintain in a design-token file, because one hue can give a whole scale. Hex is easier to paste between tools. Many teams store HSL channel values in a custom property and compose them where needed.',
      },
      {
        q: 'What about oklch and other modern colour spaces?',
        a: 'They are better for perceptual uniformity. This converter does not output them, because a correct sRGB-to-Oklab conversion needs more care than this page can show. Convert to hex here and use a dedicated tool for wide-gamut work.',
      },
    ],
    related: ['hex-to-hsl', 'rgb-to-hex', 'color-converter', 'css-gradient-generator'],
    updated: UPDATED,
  },
  {
    slug: 'rgba-to-hex',
    title: 'RGBA to HEX Converter',
    h1: 'RGBA to HEX converter',
    description:
      'RGBA to HEX converter that keeps the alpha channel in an 8-digit hex code. It also shows the flat hex of the colour composited onto a background.',
    keywords: [
      'rgba to hex',
      'rgba to hex with alpha',
      '8 digit hex',
      'convert transparency to hex',
    ],
    category: 'dev',
    icon: 'Blend',
    faqs: [
      {
        q: 'How is alpha written in hex?',
        a: 'As a fourth pair of digits appended to the six: `#RRGGBBAA`. An alpha of 1 is `ff`, 0.5 is `80`, 0 is `00`. Four-digit shorthand `#RGBA` works the same way as three-digit shorthand does for opaque colours.',
      },
      {
        q: 'Is 8-digit hex safe to use?',
        a: 'Yes in every current browser. If you need to support something very old, use `rgba()`, which has been supported far longer and expresses exactly the same colour.',
      },
      {
        q: 'Why does my semi-transparent colour look different over a dark background?',
        a: 'Alpha is a blend instruction. `rgba(0, 0, 0, 0.5)` is grey on white and near-black on dark grey. For one fixed colour that looks the same everywhere, composite it against your real background and use the opaque hex that results.',
      },
      {
        q: 'How do I convert a percentage opacity?',
        a: 'Divide by 100 to get the 0–1 alpha, then multiply by 255 and convert to hex. Or type the percentage into the slider on this page and read the eight-digit value from the table.',
      },
    ],
    related: ['hex-to-rgb-converter', 'rgb-to-hex', 'hex-to-hsl', 'color-converter'],
    updated: UPDATED,
  },
  {
    slug: 'hex-to-cmyk',
    title: 'HEX to CMYK Converter',
    h1: 'HEX to CMYK converter',
    description:
      'Convert HEX to CMYK ink percentages for print with the standard formula. The result is an approximation, because a real separation needs an ICC profile.',
    keywords: ['hex to cmyk', 'rgb to cmyk', 'convert hex for print', 'cmyk color converter'],
    category: 'dev',
    icon: 'SwatchBook',
    faqs: [
      {
        q: 'How accurate is this conversion?',
        a: 'It is the naive, device-independent formula, the same one that design software uses when colour management is off. It is a reasonable starting point. It is not a press-ready separation. A real conversion depends on an ICC profile for the specific paper, ink and press.',
      },
      {
        q: 'Why does my bright screen colour look dull in print?',
        a: 'sRGB can display colours that CMYK ink cannot reproduce, especially saturated cyans, greens and oranges. These are "out of gamut": the conversion picks the closest printable colour, which is duller. No formula can fix this. It is a physical limit of ink on paper.',
      },
      {
        q: 'What is the K channel for?',
        a: 'Black. In theory, equal amounts of cyan, magenta and yellow make black. In practice they make a muddy brown, soak the paper and use three times as much ink. K prints black directly and is subtracted from the other three, so the formula calculates it first.',
      },
      {
        q: 'What should I give my printer?',
        a: 'Ask them. Most commercial printers want a PDF with a specific output intent, or they run the conversion themselves from your RGB file with the right profile. Use these numbers to set expectations and to match a brand colour approximately. Do not use them as final artwork values.',
      },
    ],
    related: ['hex-to-rgb-converter', 'hex-to-hsl', 'color-converter', 'color-palette-generator'],
    updated: UPDATED,
  },

  /* ================================================================ */
  /* 59 · CSS unit pairs                                              */
  /* ================================================================ */
  {
    slug: 'px-to-rem-converter',
    title: 'PX to REM Converter',
    h1: 'PX to REM converter',
    description:
      'Convert PX to REM at any root font size. Paste a stylesheet to change each px value at once, or look up a size in the 1–96 px reference table.',
    keywords: [
      'px to rem',
      'pixel to rem converter',
      'px rem calculator',
      'convert css px to rem',
      'rem calculator 16px',
    ],
    category: 'dev',
    icon: 'Ruler',
    popular: true,
    faqs: [
      {
        q: 'What is the formula?',
        a: 'rem = px ÷ root font size. With the browser default of 16 px, 24 px is 1.5 rem and 14 px is 0.875 rem. The page shows the division with your own numbers, so you can check it.',
      },
      {
        q: 'Why use rem instead of px?',
        a: 'rem follows the font-size setting of the browser, and px does not. A person who sets the default to 20 px, because 16 px is hard to read, gets a proportionally larger interface. For most sites, this is the accessibility change with the largest effect.',
      },
      {
        q: 'What does the bulk rewrite skip, and why?',
        a: 'By default: zero values, because `0rem` is noise; 1–2 px values, because they are usually hairline borders that must stay crisp at any zoom; and anything in a `@media` prelude, because breakpoints in rem behave differently from breakpoints in px. Each of these is a switch. Strings, comments and `url()` contents never change.',
      },
      {
        q: 'Should I set html { font-size: 62.5% } to make 1 rem = 10 px?',
        a: 'It makes the arithmetic easier and is a common trick. But it changes the default text size for anyone who has not overridden it, and it breaks the link with the size that the user chose. If your project uses it, set the root font size field here to 10. If not, leave it at 16.',
      },
      {
        q: 'Is rem right for everything?',
        a: 'No. Use rem for type, spacing and radii. Use px for hairline borders and for things that must not scale. Use ch or ex for measure. Use % or fr for layout that must fill its container.',
      },
    ],
    related: ['rem-to-px', 'px-to-em', 'px-to-pt', 'px-to-percent', 'css-gradient-generator'],
    updated: UPDATED,
  },
  {
    slug: 'rem-to-px',
    title: 'REM to PX Converter',
    h1: 'REM to PX converter',
    description:
      'Convert REM to PX at any root font size, to check the size of a design token on screen. The formula is px = rem × root font size.',
    keywords: ['rem to px', 'rem to pixel converter', 'convert rem to px', 'rem px calculator'],
    category: 'dev',
    icon: 'Ruler',
    faqs: [
      {
        q: 'What is the formula?',
        a: 'px = rem × root font size. At the 16 px default, 1.5 rem is 24 px and 0.875 rem is 14 px. Change the root field if your project sets `html { font-size }` to a different value, and each number on the page changes with it.',
      },
      {
        q: 'Why would I convert back to px?',
        a: 'To check a design against a mockup. Figma, Sketch and screenshots are in pixels, so when a stakeholder asks why the heading "looks small", you convert 1.75 rem to 28 px. It is also how you check that a hit target is at least the 44 px minimum.',
      },
      {
        q: 'Does the result change on a high-DPI screen?',
        a: 'No. A CSS pixel is a logical unit. On a 2× display, 24 CSS px is 48 device pixels, but the physical size is the same. The device pixel ratio exists for this reason.',
      },
      {
        q: 'What if a parent element sets a font size?',
        a: 'It has no effect on rem. This is the difference between rem and em: rem is always relative to the root element, at any nesting depth. If nesting matters to you, use the em converter.',
      },
    ],
    related: ['px-to-rem-converter', 'em-to-px', 'px-to-pt', 'px-to-percent'],
    updated: UPDATED,
  },
  {
    slug: 'px-to-em',
    title: 'PX to EM Converter',
    h1: 'PX to EM converter',
    description:
      'Convert PX to EM against the parent font size, for one value or a whole stylesheet. A note explains how em values compound in nested elements.',
    keywords: ['px to em', 'pixel to em converter', 'em calculator css', 'convert px to em'],
    category: 'dev',
    faqs: [
      {
        q: 'What is em relative to?',
        a: "The font size of the element itself, except for the `font-size` property, where it is relative to the parent. This one exception causes most em confusion. Set the parent font size field on this page to the computed font size of the containing element.",
      },
      {
        q: 'What is the compounding problem?',
        a: 'em multiplies down the tree. If a list sets `font-size: 0.9em` and a nested list inherits the same rule, the second level is 0.81em, the third 0.729em, and by the fourth your text is unreadable. rem avoids this, because it is always relative to the root.',
      },
      {
        q: 'So when should I use em?',
        a: 'When you want something to scale with its own text. Padding inside a button, the gap between an icon and its label, and a border-radius on a chip all look right in em, because they follow the font size of the component wherever it is used. Global type scales belong in rem.',
      },
      {
        q: 'Does the bulk rewrite know the parent size of each rule?',
        a: 'No. That depends on where the element is in the DOM. The rewrite applies the one parent size that you set at the top. For a stylesheet with several nested contexts, convert one section at a time.',
      },
    ],
    icon: 'Scaling',
    related: ['em-to-px', 'px-to-rem-converter', 'rem-to-px', 'px-to-percent'],
    updated: UPDATED,
  },
  {
    slug: 'em-to-px',
    title: 'EM to PX Converter',
    h1: 'EM to PX converter',
    description:
      'Convert EM to PX against the parent font size that you set, to see the size of a nested component on screen. The formula is px = em × parent size.',
    keywords: ['em to px', 'em to pixel converter', 'convert em to px css', 'em px calculator'],
    category: 'dev',
    icon: 'Scaling',
    faqs: [
      {
        q: 'What is the formula?',
        a: 'px = em × parent font size. At a 16 px parent, 1.25 em is 20 px. At a 14 px parent, the same 1.25 em is 17.5 px. For this reason you cannot read em values at a glance as you can rem values.',
      },
      {
        q: 'How do I find the parent font size?',
        a: 'In devtools, select the parent element and read `font-size` in the Computed panel. That is the resolved pixel value after inheritance. Type it into the field above.',
      },
      {
        q: 'Why does my padding measure something unexpected?',
        a: 'Check whether the element sets its own `font-size`. Padding in em uses the computed size of the element itself, but a `font-size` in em on the same element uses the size of the parent. Two different bases in one rule surprise most developers at least once.',
      },
      {
        q: 'Do media queries accept em?',
        a: 'Yes. In a media query, em is always relative to the initial font size (the browser default or the user setting) and never to the declared size of the root element. For this reason em breakpoints are more predictable than rem breakpoints when a project changes the root size.',
      },
    ],
    related: ['px-to-em', 'rem-to-px', 'px-to-rem-converter', 'px-to-pt'],
    updated: UPDATED,
  },
  {
    slug: 'px-to-pt',
    title: 'PX to PT Converter',
    h1: 'PX to points converter',
    description:
      'Convert PX to PT (CSS pixels to typographic points) and back with the 96 px per inch that CSS defines, for print stylesheets and PDF work.',
    keywords: [
      'px to pt',
      'pixel to point converter',
      'css points',
      'convert px to points print',
    ],
    category: 'dev',
    icon: 'Proportions',
    faqs: [
      {
        q: 'What is the exact relationship?',
        a: 'CSS fixes 1 inch = 96 px and 1 inch = 72 pt, so 1 pt = 96/72 px = 1.3333 px, and 1 px = 0.75 pt. 12 pt is exactly 16 px. This is why the browser default body size is 16 px: it matches the classic 12 pt of a printed page.',
      },
      {
        q: 'Is the pixel here a real screen pixel?',
        a: 'No. The CSS "reference pixel" is a unit of angular measure, defined so that content looks the same size at a normal viewing distance on any device. For this reason 96 px per inch is true at any display density.',
      },
      {
        q: 'When do I need points?',
        a: 'Print stylesheets, PDF generation, and any place where you match a document made in Word or InDesign. Keep screen CSS in rem and px. Points give no benefit on a display and confuse the type scale.',
      },
      {
        q: 'Why does my printed page not match?',
        a: 'Printers scale. Most browsers apply shrink-to-fit and a default margin when they print, so a 12 pt heading can come out at 11 pt. If exact sizing matters, set explicit `@page` margins and turn off scaling in the print dialog.',
      },
    ],
    related: ['px-to-rem-converter', 'px-to-percent', 'rem-to-px', 'length-converter'],
    updated: UPDATED,
  },
  {
    slug: 'px-to-percent',
    title: 'PX to Percent Converter',
    h1: 'PX to percent converter',
    description:
      'Convert PX to percent: a pixel font size as a percentage of its parent font size. Use it for accessible base sizing and for fluid layout widths.',
    keywords: [
      'px to percent',
      'pixel to percentage css',
      'font size percentage',
      'convert px to %',
    ],
    category: 'dev',
    icon: 'Percent',
    faqs: [
      {
        q: 'What is a percentage relative to?',
        a: 'It depends on the property, and this often causes errors. For `font-size` it is the font size of the parent, which is what this converter calculates. For `width` it is the width of the containing block. For `padding` and `margin` it is also the width of the containing block, even for top and bottom values. For `line-height` it is the font size of the element itself.',
      },
      {
        q: 'Where is percentage font sizing still used?',
        a: 'Mostly on the root element. `html { font-size: 100% }` is the standard way to respect the size that the user chose, and `62.5%` is the known trick that makes 1 rem equal 10 px. Below the root, rem and em are easier to work with.',
      },
      {
        q: 'Do percentages compound like em?',
        a: 'Yes, in the same way: a percentage font size is em in a different notation. Nested elements that each multiply by 90% shrink just as fast. Use rem to avoid this.',
      },
      {
        q: 'How do I convert a pixel width to a percentage?',
        a: 'Set the parent size field to the width of the container in pixels, then read the percentage. A 320 px column in a 1200 px container is 26.6667%. In a modern layout, grid or flex is usually a better choice.',
      },
    ],
    related: ['px-to-rem-converter', 'px-to-em', 'px-to-pt', 'percentage-calculator'],
    updated: UPDATED,
  },

  /* ================================================================ */
  /* 60 · Reference pages                                             */
  /* ================================================================ */
  {
    slug: 'http-status-codes',
    title: 'HTTP Status Codes',
    h1: 'HTTP status codes: the complete reference',
    description:
      'HTTP status codes with the meaning, usual causes and fix for each one. Search the list, open a page per code, and see the RFC that defines it.',
    keywords: [
      'http status codes',
      'http error codes list',
      'what does 404 mean',
      'http response codes',
      'rest api status codes',
    ],
    category: 'dev',
    icon: 'Server',
    faqs: [
      {
        q: 'What do the five classes mean?',
        a: '1xx is informational handshake traffic. 2xx means the request succeeded. 3xx means you need to go somewhere else. 4xx means the request was wrong, and the same request will fail again. 5xx means the server failed and the request may have been correct, so retry an idempotent request with backoff.',
      },
      {
        q: 'Which codes are not part of HTTP?',
        a: 'Several of the most-searched ones. 499 is the "client closed request" code of nginx, and 520 through 526 are Cloudflare codes. They are marked "non-standard" here, because generic clients do not understand them if your own application sends them.',
      },
      {
        q: 'When should an API return 400 versus 422?',
        a: '400 when the request itself is malformed: unparseable JSON, a bad header, an invalid percent-encoding. 422 when the syntax is correct but the data fails validation. The difference matters, because a 400 is a client bug and a 422 is usually a user-input problem that you can show in a form.',
      },
      {
        q: 'Is 401 or 403 the right choice?',
        a: '401 means "I do not know who you are" and must include a `WWW-Authenticate` header. 403 means "I know who you are and you still may not". Sending 401 for an authorisation failure sends clients into a token-refresh loop that can never succeed.',
      },
      {
        q: 'Where does this data come from?',
        a: 'The RFCs (RFC 9110 for the core semantics, plus the extension RFCs cited on each code) and the IANA HTTP Status Code Registry. The causes and fixes are practitioner notes and are not part of a specification.',
      },
    ],
    related: ['mime-types', 'json-validator', 'url-encoder-decoder', 'jwt-decoder'],
    updated: UPDATED,
  },
  {
    slug: 'mime-types',
    title: 'MIME Types List',
    h1: 'MIME types and file extensions',
    description:
      'MIME types list with the file extension for each content type. Search by type or extension, and see notes on the types that servers often get wrong.',
    keywords: [
      'mime types list',
      'content type header',
      'file extension mime type',
      'mime type for docx',
    ],
    category: 'dev',
    icon: 'FileType',
    faqs: [
      {
        q: 'Why does the Content-Type header matter so much?',
        a: 'It is the only thing that tells the browser what a response is. Serve JavaScript as `text/plain` with `X-Content-Type-Options: nosniff`, and the browser refuses to run it. Serve a font as `application/octet-stream` and it downloads and does not load. Almost every static-asset bug that "works locally but not in production" is a MIME type.',
      },
      {
        q: 'Which types are most often wrong?',
        a: 'Four come up often. `image/jpg` does not exist: it is `image/jpeg`. `audio/mp3` does not exist: it is `audio/mpeg`. WebAssembly must be `application/wasm` or streaming instantiation fails. And `text/javascript` replaces `application/javascript`, though both work.',
      },
      {
        q: 'Should I add a charset?',
        a: 'For `text/*`, yes: `text/html; charset=utf-8`. Without it the default is not UTF-8, and older browsers decode accented characters incorrectly. For `application/json`, no: the JSON specification fixes the encoding as UTF-8 and defines no charset parameter.',
      },
      {
        q: 'How do I force a download instead of displaying inline?',
        a: 'Keep the correct MIME type and add `Content-Disposition: attachment; filename="report.csv"`. A false `application/octet-stream` label also works, but it breaks anything that inspects the type.',
      },
    ],
    related: ['http-status-codes', 'ascii-table', 'image-metadata-viewer', 'file-hash-checker'],
    updated: UPDATED,
  },
  {
    slug: 'ascii-table',
    title: 'ASCII Table',
    h1: 'ASCII table: decimal, hex, octal and binary',
    description:
      'ASCII table for all ASCII and Latin-1 characters, with decimal, hex, octal and binary values, control-character names and their escape sequences.',
    keywords: [
      'ascii table',
      'ascii chart',
      'ascii to hex',
      'ascii codes list',
      'ascii control characters',
    ],
    category: 'dev',
    icon: 'Binary',
    faqs: [
      {
        q: 'What are the control characters for?',
        a: 'They come from teletypes, and most are obsolete, but a few are still everywhere: 9 is tab, 10 is line feed (the newline on Unix and in every internet protocol), 13 is carriage return (paired with LF on Windows), 27 is escape, which begins every ANSI terminal colour sequence, and 0 terminates a C string.',
      },
      {
        q: 'Why do codes 128–159 show as unassigned?',
        a: 'In ISO-8859-1 they are a second block of control characters with no printable meaning. Windows-1252 puts curly quotes, the em dash and the euro sign there. For this reason a smart quote pasted from Word turns into â€œ when a page is declared as Latin-1 by mistake.',
      },
      {
        q: 'Is ASCII the same as UTF-8?',
        a: 'For the first 128 characters, yes: UTF-8 was designed so that each ASCII byte encodes itself. Above 127 they are different: UTF-8 uses multi-byte sequences, and Latin-1 uses single bytes. This compatibility is the reason UTF-8 won.',
      },
      {
        q: 'How do I convert a character to its code in code?',
        a: 'JavaScript: `"A".charCodeAt(0)` gives 65 and `String.fromCharCode(65)` reverses it. Python: `ord("A")` and `chr(65)`. For anything above U+FFFF, use `codePointAt` and `fromCodePoint` in JavaScript, because `charCodeAt` returns half a surrogate pair.',
      },
    ],
    related: ['html-entity-reference', 'number-base-converter', 'mime-types', 'case-converter'],
    updated: UPDATED,
  },
  {
    slug: 'html-entity-reference',
    title: 'HTML Entity Reference',
    h1: 'HTML entities reference',
    description:
      'HTML entity reference: a searchable table of named, decimal and hexadecimal references for arrows, currency, maths, Greek letters, accents and dashes.',
    keywords: [
      'html entities list',
      'html special characters',
      'nbsp code',
      'html entity codes',
      'html symbol reference',
    ],
    category: 'dev',
    icon: 'Hash',
    faqs: [
      {
        q: 'Which characters must I escape?',
        a: 'In HTML text content, only `&` and `<` are strictly required. In an attribute value, also escape the quote that delimits it. Everything else is optional in a UTF-8 document: you can type é and the em dash (U+2014) directly.',
      },
      {
        q: 'Named, decimal or hexadecimal?',
        a: 'Named references are readable and safe in HTML, so use them. XML has only five names, so use numeric references there. Hexadecimal matches how the Unicode standard writes code points (U+2014 → `&#x2014;`), which makes it easier to check against a character chart.',
      },
      {
        q: 'When should I actually use &nbsp;?',
        a: 'To stop a line break at a specific place: between a number and its unit ("10&nbsp;kg"), before a lone short word at the end of a heading, or in "Figure&nbsp;4". A run of them for indentation is a layout hack. Use CSS padding or margin.',
      },
      {
        q: 'Why does my entity show as literal text?',
        a: 'There are two usual causes. The ampersand itself was escaped upstream, so the browser sees `&amp;nbsp;`. Or the context does not process entities: a `<pre>` block does, but a `<textarea>` value set from JavaScript, a JSON string and an XML document with an undeclared entity do not.',
      },
    ],
    related: ['html-entity-encoder', 'ascii-table', 'xml-escape', 'url-encoder-decoder'],
    updated: UPDATED,
  },
]
