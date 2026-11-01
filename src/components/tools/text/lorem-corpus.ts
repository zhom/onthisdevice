/** Word banks and the generator behind the lorem ipsum tool. */

export interface Corpus {
  id: string
  label: string
  description: string
  /** Canonical opening, used by the "start with the classic line" option. */
  opening: string
  words: string[]
}

export const CORPORA: Corpus[] = [
  {
    id: 'classic',
    label: 'Classic Latin',
    description: 'The original scrambled Cicero that typesetters have used since the 1500s.',
    opening: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
    words: [
      'lorem', 'ipsum', 'dolor', 'sit', 'amet', 'consectetur', 'adipiscing', 'elit', 'sed', 'do',
      'eiusmod', 'tempor', 'incididunt', 'ut', 'labore', 'et', 'dolore', 'magna', 'aliqua', 'enim',
      'ad', 'minim', 'veniam', 'quis', 'nostrud', 'exercitation', 'ullamco', 'laboris', 'nisi',
      'aliquip', 'ex', 'ea', 'commodo', 'consequat', 'duis', 'aute', 'irure', 'in', 'reprehenderit',
      'voluptate', 'velit', 'esse', 'cillum', 'eu', 'fugiat', 'nulla', 'pariatur', 'excepteur',
      'sint', 'occaecat', 'cupidatat', 'non', 'proident', 'sunt', 'culpa', 'qui', 'officia',
      'deserunt', 'mollit', 'anim', 'id', 'est', 'laborum', 'curabitur', 'pretium', 'tincidunt',
      'lacus', 'nulla', 'gravida', 'orci', 'a', 'odio', 'nullam', 'varius', 'turpis', 'commodo',
      'sagittis', 'integer', 'at', 'purus', 'vitae', 'augue', 'facilisis', 'mattis', 'nunc',
      'vestibulum', 'ante', 'primis', 'faucibus', 'luctus', 'ultrices', 'posuere', 'cubilia',
      'curae', 'donec', 'pharetra', 'magna', 'nec', 'tellus', 'imperdiet', 'malesuada',
    ],
  },
  {
    id: 'plain',
    label: 'Plain English',
    description: 'Ordinary, readable filler for when Latin makes a mock-up hard to judge.',
    opening: 'The quick draft below is placeholder copy, written to fill the space that real words will eventually take.',
    words: [
      'the', 'a', 'and', 'of', 'to', 'in', 'is', 'that', 'for', 'with', 'as', 'on', 'by', 'at',
      'from', 'this', 'page', 'word', 'sentence', 'draft', 'copy', 'text', 'reader', 'writer',
      'idea', 'story', 'detail', 'question', 'answer', 'example', 'notice', 'change', 'small',
      'large', 'simple', 'careful', 'plain', 'quiet', 'clear', 'useful', 'ordinary', 'first',
      'second', 'final', 'morning', 'evening', 'window', 'table', 'letter', 'number', 'colour',
      'shape', 'space', 'line', 'paragraph', 'heading', 'button', 'form', 'list', 'note', 'plan',
      'measure', 'follow', 'begin', 'finish', 'consider', 'explain', 'describe', 'remember',
      'often', 'rarely', 'always', 'never', 'perhaps', 'because', 'although', 'while', 'until',
    ],
  },
  {
    id: 'startup',
    label: 'Tech & startup',
    description: 'Product-launch vocabulary for SaaS mock-ups and pitch decks.',
    opening: 'Our platform unlocks scalable value across the entire product lifecycle, from onboarding to retention.',
    words: [
      'platform', 'workflow', 'pipeline', 'runtime', 'dashboard', 'endpoint', 'latency', 'stack',
      'scale', 'deploy', 'iterate', 'ship', 'onboarding', 'retention', 'activation', 'cohort',
      'roadmap', 'sprint', 'backlog', 'telemetry', 'observability', 'throughput', 'container',
      'cluster', 'schema', 'cache', 'index', 'token', 'webhook', 'integration', 'automation',
      'orchestration', 'serverless', 'edge', 'region', 'tenant', 'quota', 'ingest', 'stream',
      'batch', 'model', 'inference', 'embedding', 'vector', 'benchmark', 'baseline', 'rollout',
      'canary', 'rollback', 'incident', 'runbook', 'uptime', 'seamlessly', 'natively', 'securely',
      'across', 'toward', 'without', 'for', 'the', 'a', 'and', 'of', 'to', 'in', 'with', 'that',
    ],
  },
  {
    id: 'corporate',
    label: 'Corporate jargon',
    description: 'Boardroom filler for slides and annual-report layouts.',
    opening: 'Going forward, we will leverage cross-functional synergies to deliver measurable stakeholder value.',
    words: [
      'synergy', 'stakeholder', 'alignment', 'deliverable', 'initiative', 'framework', 'strategy',
      'governance', 'compliance', 'oversight', 'efficiency', 'optimisation', 'transformation',
      'benchmark', 'milestone', 'headcount', 'quarter', 'forecast', 'variance', 'mandate',
      'workstream', 'touchpoint', 'bandwidth', 'leverage', 'streamline', 'facilitate', 'cascade',
      'operationalise', 'incentivise', 'prioritise', 'holistic', 'robust', 'scalable', 'agile',
      'strategic', 'core', 'value-added', 'best-in-class', 'end-to-end', 'cross-functional',
      'the', 'a', 'and', 'of', 'to', 'in', 'with', 'for', 'across', 'toward', 'within', 'through',
    ],
  },
  {
    id: 'hipster',
    label: 'Hipster',
    description: 'Artisanal nonsense that nobody mistakes for real copy.',
    opening: 'Artisan cold-brew tote bag, sustainably sourced and slow-fermented in a converted warehouse.',
    words: [
      'artisan', 'cold-brew', 'tote', 'bag', 'kombucha', 'sourdough', 'vinyl', 'polaroid',
      'typewriter', 'bicycle', 'flannel', 'beard', 'mustache', 'terrarium', 'succulent', 'kale',
      'quinoa', 'kimchi', 'ferment', 'small-batch', 'single-origin', 'roastery', 'letterpress',
      'zine', 'analogue', 'thrifted', 'vintage', 'reclaimed', 'sustainable', 'locavore',
      'foraged', 'heirloom', 'hand-dyed', 'raw', 'denim', 'loft', 'warehouse', 'gallery',
      'pop-up', 'market', 'brunch', 'flat-white', 'the', 'a', 'and', 'of', 'to', 'in', 'with',
    ],
  },
  {
    id: 'kitchen',
    label: 'Recipe & food',
    description: 'Warm, sensory filler that suits food blogs and menu layouts.',
    opening: 'Fold the warm butter through the flour until the dough just comes together, then rest it for an hour.',
    words: [
      'butter', 'flour', 'sugar', 'sea-salt', 'yeast', 'dough', 'batter', 'zest', 'thyme',
      'rosemary', 'garlic', 'shallot', 'lemon', 'orange', 'honey', 'vinegar', 'olive', 'oil',
      'skillet', 'saucepan', 'oven', 'simmer', 'braise', 'roast', 'caramelise', 'whisk', 'fold',
      'knead', 'rest', 'chill', 'season', 'garnish', 'slice', 'golden', 'crisp', 'tender',
      'fragrant', 'glossy', 'silky', 'charred', 'bright', 'until', 'then', 'while', 'gently',
      'the', 'a', 'and', 'of', 'to', 'in', 'with', 'over', 'through', 'for',
    ],
  },
]

export const CORPUS_BY_ID: Record<string, Corpus> = Object.fromEntries(
  CORPORA.map((c) => [c.id, c]),
)

/** Small xorshift PRNG so "regenerate" is reproducible from a seed. */
export function makeRandom(seed: number): () => number {
  let state = seed >>> 0 || 0x9e3779b9
  return () => {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    state >>>= 0
    return state / 0x100000000
  }
}

export interface LoremOptions {
  corpusId: string
  /** 'paragraphs' | 'sentences' | 'words' | 'list' */
  unit: 'paragraphs' | 'sentences' | 'words' | 'list'
  count: number
  startWithClassic: boolean
  html: boolean
  /** Average sentences per paragraph. */
  sentencesPerParagraph: number
  seed: number
}

function pick(words: string[], random: () => number): string {
  return words[Math.floor(random() * words.length)]
}

function buildSentence(words: string[], random: () => number, minWords = 6, maxWords = 16): string {
  const length = minWords + Math.floor(random() * (maxWords - minWords + 1))
  const parts: string[] = []
  for (let i = 0; i < length; i++) parts.push(pick(words, random))

  // Sprinkle in commas for rhythm, never at the very start or end.
  for (let i = 2; i < parts.length - 2; i++) {
    if (random() < 0.08) parts[i] += ','
  }

  let sentence = parts.join(' ')
  sentence = sentence.charAt(0).toUpperCase() + sentence.slice(1)
  const ending = random() < 0.05 ? '?' : '.'
  return `${sentence}${ending}`
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export function generateLorem(options: LoremOptions): string {
  const corpus = CORPUS_BY_ID[options.corpusId] ?? CORPORA[0]
  const random = makeRandom(options.seed)
  const count = Math.max(1, Math.min(500, Math.floor(options.count)))
  const words = corpus.words

  if (options.unit === 'words') {
    const list: string[] = []
    if (options.startWithClassic) {
      for (const word of corpus.opening.replace(/[.,?]/g, '').toLowerCase().split(/\s+/)) {
        if (list.length < count) list.push(word)
      }
    }
    while (list.length < count) list.push(pick(words, random))
    let text = list.slice(0, count).join(' ')
    text = text.charAt(0).toUpperCase() + text.slice(1)
    if (!/[.?!]$/.test(text)) text += '.'
    return options.html ? `<p>${escapeHtml(text)}</p>` : text
  }

  const makeSentence = (isFirst: boolean): string =>
    isFirst && options.startWithClassic ? corpus.opening : buildSentence(words, random)

  if (options.unit === 'sentences') {
    const sentences: string[] = []
    for (let i = 0; i < count; i++) sentences.push(makeSentence(i === 0))
    const joined = sentences.join(' ')
    return options.html ? `<p>${escapeHtml(joined)}</p>` : joined
  }

  if (options.unit === 'list') {
    const items: string[] = []
    for (let i = 0; i < count; i++) {
      const item =
        i === 0 && options.startWithClassic
          ? corpus.opening.replace(/[.?]$/, '')
          : buildSentence(words, random, 3, 9).replace(/[.?]$/, '')
      items.push(item)
    }
    if (!options.html) return items.map((item) => `• ${item}`).join('\n')
    return ['<ul>', ...items.map((item) => `  <li>${escapeHtml(item)}</li>`), '</ul>'].join('\n')
  }

  const paragraphs: string[] = []
  const perParagraph = Math.max(1, Math.round(options.sentencesPerParagraph))
  let sentenceIndex = 0
  for (let p = 0; p < count; p++) {
    const spread = perParagraph <= 2 ? 0 : 1
    const sentenceCount = Math.max(1, perParagraph + Math.floor(random() * (spread * 2 + 1)) - spread)
    const sentences: string[] = []
    for (let s = 0; s < sentenceCount; s++) {
      sentences.push(makeSentence(sentenceIndex === 0))
      sentenceIndex++
    }
    paragraphs.push(sentences.join(' '))
  }

  if (options.html) return paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join('\n')
  return paragraphs.join('\n\n')
}
