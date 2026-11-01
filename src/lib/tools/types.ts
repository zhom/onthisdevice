/**
 * Shared tool-registry contract.
 *
 * Every tool on onthisdevice.com is described once, here, and that single
 * description drives: the homepage grid, category hubs, search, breadcrumbs,
 * related-tool rails, the sitemap, and each page's SEO metadata.
 *
 * URLs are FLAT and slug-exact for SEO: a tool with slug `merge-pdf` lives at
 * `/merge-pdf` (file: `src/pages/merge-pdf.astro`).
 */

export type CategoryId =
  | 'pdf'
  | 'pdf-convert'
  | 'image-convert'
  | 'image-edit'
  | 'media'
  | 'data'
  | 'finance'
  | 'health'
  | 'math'
  | 'units'
  | 'datetime'
  | 'text'
  | 'dev'
  | 'security'
  | 'generators'
  | 'everyday'
  | 'redact'

/** Top-level nav grouping shown in the header mega-menu. */
export type GroupId = 'redact' | 'files' | 'media' | 'calculators' | 'text-code' | 'generators'

export interface Faq {
  q: string
  a: string
}

export interface Tool {
  /** URL slug, also the page filename. Kebab-case, keyword-exact. */
  slug: string
  /** Short nav/card label, e.g. "Merge PDF". */
  title: string
  /** Page <h1>. Defaults to `title` when omitted. */
  h1?: string
  /** Meta description + card subtitle. Aim for 110-155 characters. */
  description: string
  /** Secondary search keywords (the slug and title are indexed automatically). */
  keywords: string[]
  category: CategoryId
  /** lucide-react icon name in PascalCase, e.g. "FileStack". */
  icon: string
  /** Surfaces the tool on the homepage "most used" grid. */
  popular?: boolean
  /** Accepted input extensions, lowercase and without the dot. */
  accepts?: string[]
  /** 3-6 questions rendered as an accordion + FAQPage JSON-LD. */
  faqs?: Faq[]
  /** Slugs of related tools for the cross-link rail. */
  related?: string[]
  /** ISO date of last meaningful update, for sitemap lastmod. */
  updated?: string
}

export interface Category {
  id: CategoryId
  /** Hub page label, e.g. "PDF Tools". */
  title: string
  /** Hub lives at /category/<slug>. */
  slug: string
  /** One-line hook for cards and hub hero. */
  tagline: string
  /** 1-2 sentence hub intro used for the hub's meta description. */
  description: string
  /** lucide-react icon name in PascalCase. */
  icon: string
  group: GroupId
  /** Tailwind token name driving the category accent: chart-1..chart-5. */
  accent: 'chart-1' | 'chart-2' | 'chart-3' | 'chart-4' | 'chart-5'
}

export const GROUPS: { id: GroupId; title: string }[] = [
  { id: 'redact', title: 'Redaction' },
  { id: 'files', title: 'Files & Documents' },
  { id: 'media', title: 'Images & Media' },
  { id: 'calculators', title: 'Calculators' },
  { id: 'text-code', title: 'Text & Code' },
  { id: 'generators', title: 'Generators' },
]

export const CATEGORIES: Category[] = [
  {
    id: 'redact',
    title: 'Redaction Tools',
    slug: 'redaction-tools',
    tagline: 'Find and hide personal data',
    description:
      'Find and hide names, faces, numbers, keys and metadata in text, PDFs, photos, screenshots, video and audio. Detection models run in your browser.',
    icon: 'EyeOff',
    group: 'redact',
    accent: 'chart-1',
  },
  {
    id: 'pdf',
    title: 'PDF Tools',
    slug: 'pdf',
    tagline: 'Merge, split, compress and edit PDFs',
    description:
      'Merge, split, compress, rotate, sign, protect and edit PDF files. Each PDF tool runs in your browser, so your files stay on your device.',
    icon: 'FileText',
    group: 'files',
    accent: 'chart-4',
  },
  {
    id: 'pdf-convert',
    title: 'PDF Converters',
    slug: 'pdf-converters',
    tagline: 'Convert PDFs to and from anything',
    description:
      'Convert PDFs to images, text and Word files, and make PDFs from images and documents. The conversion runs on your device.',
    icon: 'FileOutput',
    group: 'files',
    accent: 'chart-4',
  },
  {
    id: 'image-convert',
    title: 'Image Converters',
    slug: 'image-converters',
    tagline: 'JPG, PNG, WebP, AVIF, HEIC and more',
    description:
      'Convert images between JPG, PNG, WebP, AVIF, HEIC and other formats. WebAssembly codecs do the encoding on your device.',
    icon: 'Images',
    group: 'media',
    accent: 'chart-2',
  },
  {
    id: 'image-edit',
    title: 'Image Editing',
    slug: 'image-editing',
    tagline: 'Resize, crop, compress and clean up',
    description:
      'Resize, crop, rotate and compress images, and remove their metadata. The images stay on your device.',
    icon: 'Crop',
    group: 'media',
    accent: 'chart-2',
  },
  {
    id: 'media',
    title: 'Video & Audio',
    slug: 'video-audio',
    tagline: 'Convert, trim and extract with FFmpeg',
    description:
      'Convert video and audio, trim clips, make GIFs and extract soundtracks with FFmpeg compiled to WebAssembly, on your device.',
    icon: 'Clapperboard',
    group: 'media',
    accent: 'chart-5',
  },
  {
    id: 'data',
    title: 'Documents & Data',
    slug: 'documents-data',
    tagline: 'CSV, JSON, YAML, Excel, Word, Markdown',
    description:
      'Convert and clean up spreadsheets, CSV, JSON, YAML, config files, Word documents and Markdown in your browser.',
    icon: 'Table',
    group: 'files',
    accent: 'chart-1',
  },
  {
    id: 'finance',
    title: 'Finance Calculators',
    slug: 'finance-calculators',
    tagline: 'Mortgages, loans, interest and savings',
    description:
      'Mortgage, loan, savings and investment calculators that show the full payment or growth schedule behind each result.',
    icon: 'Landmark',
    group: 'calculators',
    accent: 'chart-5',
  },
  {
    id: 'health',
    title: 'Health Calculators',
    slug: 'health-calculators',
    tagline: 'BMI, calories, body composition',
    description:
      'Health and fitness calculators for BMI, BMR, TDEE, macros and body fat. Each one shows the published formula it uses.',
    icon: 'HeartPulse',
    group: 'calculators',
    accent: 'chart-3',
  },
  {
    id: 'math',
    title: 'Math & Statistics',
    slug: 'math-calculators',
    tagline: 'Percentages, algebra, geometry, stats',
    description:
      'Calculators for percentages, quadratic equations, matrices, geometry and descriptive statistics, with step-by-step working.',
    icon: 'Sigma',
    group: 'calculators',
    accent: 'chart-1',
  },
  {
    id: 'units',
    title: 'Unit Converters',
    slug: 'unit-converters',
    tagline: 'Length, weight, temperature, data',
    description:
      'Exact unit conversion for length, mass, temperature, volume, area, speed, pressure, energy, cooking measures and digital storage.',
    icon: 'Ruler',
    group: 'calculators',
    accent: 'chart-2',
  },
  {
    id: 'datetime',
    title: 'Date & Time',
    slug: 'date-time',
    tagline: 'Age, durations, timestamps, timezones',
    description:
      'Work out ages, date differences, deadlines, business days, week numbers and Unix timestamps across any timezone.',
    icon: 'CalendarClock',
    group: 'calculators',
    accent: 'chart-3',
  },
  {
    id: 'text',
    title: 'Text Tools',
    slug: 'text-tools',
    tagline: 'Count, clean, compare and transform',
    description:
      'Count words, change case, remove duplicate lines, sort, compare and find and replace in text of any size, in your browser.',
    icon: 'Type',
    group: 'text-code',
    accent: 'chart-1',
  },
  {
    id: 'dev',
    title: 'Developer Tools',
    slug: 'developer-tools',
    tagline: 'JSON, Base64, JWT, regex, colors',
    description:
      'Developer tools to format JSON, encode and decode Base64 and URLs, decode JWTs, test regex and convert colors in your browser.',
    icon: 'Code2',
    group: 'text-code',
    accent: 'chart-2',
  },
  {
    id: 'security',
    title: 'Security & Privacy',
    slug: 'security-privacy',
    tagline: 'Passwords, hashes, encryption',
    description:
      'Generate strong passwords, and hash and encrypt data with the WebCrypto API in your browser. Secrets are not sent over the network.',
    icon: 'ShieldCheck',
    group: 'text-code',
    accent: 'chart-4',
  },
  {
    id: 'generators',
    title: 'Generators',
    slug: 'generators',
    tagline: 'QR codes, barcodes, favicons, gradients',
    description:
      'Make QR codes, barcodes, favicons, placeholder images, CSS gradients and other assets, and download them as files.',
    icon: 'Sparkles',
    group: 'generators',
    accent: 'chart-4',
  },
  {
    id: 'everyday',
    title: 'Everyday Calculators',
    slug: 'everyday-calculators',
    tagline: 'Tips, discounts, grades, fuel',
    description:
      'Calculators for everyday sums: tips, bill splits, discounts, grades, fuel costs and number conversions.',
    icon: 'Calculator',
    group: 'calculators',
    accent: 'chart-3',
  },
]

export const CATEGORY_BY_ID: Record<CategoryId, Category> = Object.fromEntries(
  CATEGORIES.map((c) => [c.id, c]),
) as Record<CategoryId, Category>
