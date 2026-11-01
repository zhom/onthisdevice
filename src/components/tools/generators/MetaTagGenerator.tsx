import { useEffect, useMemo, useState } from 'react'
import { Globe, Image as ImageIcon, TriangleAlert } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { CopyButton } from '@/components/shared/CopyButton'
import { cn } from '@/lib/utils'
import { CodeBlock, Field } from './GenUi'

type TwitterCard = 'summary' | 'summary_large_image'
type OgType = 'website' | 'article' | 'product' | 'profile' | 'video.other'

/* Google renders desktop titles at roughly 20px Arial and truncates the line
   near 600 CSS pixels; snippets are about 14px over two lines near 920px. */
const TITLE_FONT = '400 20px Arial, sans-serif'
const DESC_FONT = '400 14px Arial, sans-serif'
const TITLE_LIMIT_PX = 600
const DESC_LIMIT_PX = 920

let measureContext: CanvasRenderingContext2D | null | undefined

/** Width of `text` in `font`, measured by the browser's own text shaper. */
function measureText(text: string, font: string): number {
  if (measureContext === undefined) {
    measureContext =
      typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d')
  }
  if (!measureContext) return text.length * 8
  measureContext.font = font
  return measureContext.measureText(text).width
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function hostOf(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, '')
  } catch {
    return 'example.com'
  }
}

function pathCrumbs(url: string): string {
  try {
    const parsed = new URL(url)
    const parts = parsed.pathname.split('/').filter(Boolean)
    return parts.length > 0 ? ` › ${parts.join(' › ')}` : ''
  } catch {
    return ''
  }
}

interface CounterProps {
  label: string
  count: number
  min: number
  max: number
  pixels?: number
  pixelLimit?: number
}

function Counter({ label, count, min, max, pixels, pixelLimit }: CounterProps) {
  const short = count > 0 && count < min
  const long = count > max
  const pixelLong = pixels !== undefined && pixelLimit !== undefined && pixels > pixelLimit
  const state = count === 0 ? 'empty' : long || pixelLong ? 'long' : short ? 'short' : 'good'

  return (
    <p
      className={cn(
        'flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs',
        state === 'long' ? 'text-warning' : 'text-muted-foreground',
      )}
      role="status"
      aria-live="polite"
    >
      {state === 'long' ? <TriangleAlert className="size-3.5 shrink-0" aria-hidden="true" /> : null}
      <span className="tabular-nums">
        {count} characters
        {pixels !== undefined ? ` · ${Math.round(pixels)} px` : ''}
      </span>
      <span>
        {state === 'empty'
          ? `${label} is empty. Search engines will invent one from the page content.`
          : state === 'long'
            ? `Too long. ${pixelLong ? 'Google will cut it off mid-sentence.' : `Aim for ${min}–${max} characters.`}`
            : state === 'short'
              ? `A little short: ${min}–${max} characters uses the space you are given.`
              : 'Good length.'}
      </span>
    </p>
  )
}

export default function MetaTagGenerator() {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [canonical, setCanonical] = useState('')
  const [siteName, setSiteName] = useState('')
  const [author, setAuthor] = useState('')
  const [locale, setLocale] = useState('en_US')

  const [index, setIndex] = useState(true)
  const [follow, setFollow] = useState(true)
  const [noArchive, setNoArchive] = useState(false)
  const [noImageIndex, setNoImageIndex] = useState(false)

  const [ogType, setOgType] = useState<OgType>('website')
  const [ogImage, setOgImage] = useState('')
  const [ogImageAlt, setOgImageAlt] = useState('')
  const [ogTitle, setOgTitle] = useState('')
  const [ogDescription, setOgDescription] = useState('')
  const [syncOg, setSyncOg] = useState(true)

  const [twitterCard, setTwitterCard] = useState<TwitterCard>('summary_large_image')
  const [twitterSite, setTwitterSite] = useState('')
  const [twitterCreator, setTwitterCreator] = useState('')

  const [includeBoilerplate, setIncludeBoilerplate] = useState(true)

  const effectiveOgTitle = syncOg ? title : ogTitle
  const effectiveOgDescription = syncOg ? description : ogDescription

  const titlePx = useMemo(() => measureText(title, TITLE_FONT), [title])
  const descPx = useMemo(() => measureText(description, DESC_FONT), [description])

  const robots = useMemo(() => {
    const parts = [index ? 'index' : 'noindex', follow ? 'follow' : 'nofollow']
    if (noArchive) parts.push('noarchive')
    if (noImageIndex) parts.push('noimageindex')
    return parts.join(', ')
  }, [index, follow, noArchive, noImageIndex])

  const html = useMemo(() => {
    const lines: string[] = []
    if (includeBoilerplate) {
      lines.push('<meta charset="utf-8">')
      lines.push('<meta name="viewport" content="width=device-width, initial-scale=1">')
    }
    if (title) lines.push(`<title>${escapeAttr(title)}</title>`)
    if (description) lines.push(`<meta name="description" content="${escapeAttr(description)}">`)
    if (canonical) lines.push(`<link rel="canonical" href="${escapeAttr(canonical)}">`)
    lines.push(`<meta name="robots" content="${robots}">`)
    if (author) lines.push(`<meta name="author" content="${escapeAttr(author)}">`)

    lines.push('')
    lines.push('<!-- Open Graph: Facebook, LinkedIn, Slack, Discord, WhatsApp -->')
    lines.push(`<meta property="og:type" content="${ogType}">`)
    if (effectiveOgTitle) lines.push(`<meta property="og:title" content="${escapeAttr(effectiveOgTitle)}">`)
    if (effectiveOgDescription)
      lines.push(`<meta property="og:description" content="${escapeAttr(effectiveOgDescription)}">`)
    if (canonical) lines.push(`<meta property="og:url" content="${escapeAttr(canonical)}">`)
    if (siteName) lines.push(`<meta property="og:site_name" content="${escapeAttr(siteName)}">`)
    if (ogImage) {
      lines.push(`<meta property="og:image" content="${escapeAttr(ogImage)}">`)
      lines.push('<meta property="og:image:width" content="1200">')
      lines.push('<meta property="og:image:height" content="630">')
      if (ogImageAlt) lines.push(`<meta property="og:image:alt" content="${escapeAttr(ogImageAlt)}">`)
    }
    if (locale) lines.push(`<meta property="og:locale" content="${escapeAttr(locale)}">`)

    lines.push('')
    lines.push('<!-- Twitter / X -->')
    lines.push(`<meta name="twitter:card" content="${twitterCard}">`)
    if (twitterSite) lines.push(`<meta name="twitter:site" content="${escapeAttr(twitterSite)}">`)
    if (twitterCreator) lines.push(`<meta name="twitter:creator" content="${escapeAttr(twitterCreator)}">`)
    if (effectiveOgTitle) lines.push(`<meta name="twitter:title" content="${escapeAttr(effectiveOgTitle)}">`)
    if (effectiveOgDescription)
      lines.push(`<meta name="twitter:description" content="${escapeAttr(effectiveOgDescription)}">`)
    if (ogImage) lines.push(`<meta name="twitter:image" content="${escapeAttr(ogImage)}">`)
    if (ogImageAlt) lines.push(`<meta name="twitter:image:alt" content="${escapeAttr(ogImageAlt)}">`)

    return `${lines.join('\n')}\n`
  }, [
    includeBoilerplate,
    title,
    description,
    canonical,
    robots,
    author,
    ogType,
    effectiveOgTitle,
    effectiveOgDescription,
    siteName,
    ogImage,
    ogImageAlt,
    locale,
    twitterCard,
    twitterSite,
    twitterCreator,
  ])

  const [imageOk, setImageOk] = useState<boolean | null>(null)
  useEffect(() => {
    setImageOk(null)
  }, [ogImage])

  const host = hostOf(canonical)
  const crumbs = pathCrumbs(canonical)

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
        <div className="flex flex-col gap-6">
          <ToolPanel title="The page itself">
            <Field label="Title" htmlFor="mt-title">
              <Input
                id="mt-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Merge PDF files into one document"
              />
            </Field>
            <Counter label="The title" count={title.length} min={30} max={60} pixels={titlePx} pixelLimit={TITLE_LIMIT_PX} />

            <Field label="Meta description" htmlFor="mt-desc">
              <Textarea
                id="mt-desc"
                rows={3}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Combine several PDFs into one document. Drag the files into order and set a page range for each."
              />
            </Field>
            <Counter
              label="The description"
              count={description.length}
              min={110}
              max={160}
              pixels={descPx}
              pixelLimit={DESC_LIMIT_PX}
            />

            <Field
              label="Canonical URL"
              htmlFor="mt-canonical"
              hint="The single address you want indexed. Always absolute, always including https://."
            >
              <Input
                id="mt-canonical"
                type="url"
                inputMode="url"
                spellCheck={false}
                value={canonical}
                onChange={(event) => setCanonical(event.target.value)}
                placeholder="https://example.com/merge-pdf"
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Site name" htmlFor="mt-sitename">
                <Input
                  id="mt-sitename"
                  value={siteName}
                  onChange={(event) => setSiteName(event.target.value)}
                  placeholder="Example"
                />
              </Field>
              <Field label="Author" htmlFor="mt-author">
                <Input
                  id="mt-author"
                  value={author}
                  onChange={(event) => setAuthor(event.target.value)}
                  placeholder="Jane Doe"
                />
              </Field>
            </div>
          </ToolPanel>

          <ToolPanel
            title="Crawling and indexing"
            description="These flags are directives, not hints. Getting noindex onto a live page is the single fastest way to lose all of its traffic, so read the summary before you copy."
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex items-center justify-between gap-3 rounded-lg bg-muted p-3">
                <Label htmlFor="mt-index" className="text-sm">
                  Allow indexing
                </Label>
                <Switch id="mt-index" checked={index} onCheckedChange={setIndex} />
              </div>
              <div className="flex items-center justify-between gap-3 rounded-lg bg-muted p-3">
                <Label htmlFor="mt-follow" className="text-sm">
                  Follow links
                </Label>
                <Switch id="mt-follow" checked={follow} onCheckedChange={setFollow} />
              </div>
              <div className="flex items-center justify-between gap-3 rounded-lg bg-muted p-3">
                <Label htmlFor="mt-noarchive" className="text-sm">
                  No cached copy
                </Label>
                <Switch id="mt-noarchive" checked={noArchive} onCheckedChange={setNoArchive} />
              </div>
              <div className="flex items-center justify-between gap-3 rounded-lg bg-muted p-3">
                <Label htmlFor="mt-noimageindex" className="text-sm">
                  No image indexing
                </Label>
                <Switch id="mt-noimageindex" checked={noImageIndex} onCheckedChange={setNoImageIndex} />
              </div>
            </div>
            <p className="text-xs text-pretty text-muted-foreground">
              Current directive: <code className="font-mono">{robots}</code>.{' '}
              {index
                ? 'This page can appear in search results.'
                : 'This page will be dropped from search results once the tag is crawled.'}
            </p>
          </ToolPanel>

          <ToolPanel title="Social sharing">
            <div className="flex items-center justify-between gap-3 rounded-lg bg-muted p-3">
              <div className="min-w-0">
                <Label htmlFor="mt-sync" className="text-sm">
                  Reuse the page title and description
                </Label>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Turn this off when the shared card should read differently from the search result.
                  Social copy can be punchier and does not need the keyword up front.
                </p>
              </div>
              <Switch id="mt-sync" checked={syncOg} onCheckedChange={setSyncOg} />
            </div>

            {!syncOg ? (
              <>
                <Field label="Social title" htmlFor="mt-ogtitle">
                  <Input id="mt-ogtitle" value={ogTitle} onChange={(event) => setOgTitle(event.target.value)} />
                </Field>
                <Field label="Social description" htmlFor="mt-ogdesc">
                  <Textarea
                    id="mt-ogdesc"
                    rows={2}
                    value={ogDescription}
                    onChange={(event) => setOgDescription(event.target.value)}
                  />
                </Field>
              </>
            ) : null}

            <Field
              label="Share image URL"
              htmlFor="mt-ogimage"
              hint="Absolute URL to a 1200 × 630 image. Relative paths are ignored by most crawlers."
            >
              <Input
                id="mt-ogimage"
                type="url"
                inputMode="url"
                spellCheck={false}
                value={ogImage}
                onChange={(event) => setOgImage(event.target.value)}
                placeholder="https://example.com/og.png"
              />
            </Field>

            <Field label="Image alt text" htmlFor="mt-ogalt">
              <Input
                id="mt-ogalt"
                value={ogImageAlt}
                onChange={(event) => setOgImageAlt(event.target.value)}
                placeholder="Screenshot of the PDF merging tool"
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Open Graph type" htmlFor="mt-ogtype">
                <Select value={ogType} onValueChange={(value) => setOgType(value as OgType)}>
                  <SelectTrigger id="mt-ogtype" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="website">website</SelectItem>
                    <SelectItem value="article">article</SelectItem>
                    <SelectItem value="product">product</SelectItem>
                    <SelectItem value="profile">profile</SelectItem>
                    <SelectItem value="video.other">video.other</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Locale" htmlFor="mt-locale">
                <Input
                  id="mt-locale"
                  value={locale}
                  onChange={(event) => setLocale(event.target.value)}
                  placeholder="en_US"
                />
              </Field>
              <Field label="Twitter card" htmlFor="mt-twcard">
                <Select value={twitterCard} onValueChange={(value) => setTwitterCard(value as TwitterCard)}>
                  <SelectTrigger id="mt-twcard" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="summary_large_image">summary_large_image</SelectItem>
                    <SelectItem value="summary">summary</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Twitter site handle" htmlFor="mt-twsite">
                <Input
                  id="mt-twsite"
                  value={twitterSite}
                  onChange={(event) => setTwitterSite(event.target.value)}
                  placeholder="@example"
                />
              </Field>
              <Field label="Twitter author handle" htmlFor="mt-twcreator">
                <Input
                  id="mt-twcreator"
                  value={twitterCreator}
                  onChange={(event) => setTwitterCreator(event.target.value)}
                  placeholder="@janedoe"
                />
              </Field>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-lg bg-muted p-3">
              <div className="min-w-0">
                <Label htmlFor="mt-boiler" className="text-sm">
                  Include charset and viewport
                </Label>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  The two tags every page needs. Leave them out if your framework already emits them.
                </p>
              </div>
              <Switch id="mt-boiler" checked={includeBoilerplate} onCheckedChange={setIncludeBoilerplate} />
            </div>
          </ToolPanel>
        </div>

        <div className="flex flex-col gap-6 lg:sticky lg:top-6 lg:self-start">
          <ToolPanel title="Previews">
            <Tabs defaultValue="google">
              <TabsList className="w-full">
                <TabsTrigger value="google" className="flex-1">
                  Google
                </TabsTrigger>
                <TabsTrigger value="social" className="flex-1">
                  Social card
                </TabsTrigger>
              </TabsList>

              <TabsContent value="google" className="mt-4">
                <div className="rounded-lg bg-card p-4">
                  <div className="flex items-center gap-2">
                    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-muted">
                      <Globe className="size-3.5 text-muted-foreground" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-[13px] text-foreground">{siteName || host}</div>
                      <div className="truncate text-[12px] text-muted-foreground">
                        {canonical ? `${host}${crumbs}` : 'example.com'}
                      </div>
                    </div>
                  </div>
                  <p className="mt-2 line-clamp-2 text-[18px] leading-6 text-foreground">
                    {title || 'Your page title appears here'}
                  </p>
                  <p className="mt-1 line-clamp-2 text-[13px] leading-5 text-muted-foreground">
                    {description ||
                      'Your meta description appears here. Without one, Google will assemble a snippet from whatever text on the page best matches the query.'}
                  </p>
                </div>
                <p className="mt-2 text-xs text-pretty text-muted-foreground">
                  Rendered at Google’s desktop proportions. Titles are cut near {TITLE_LIMIT_PX} px and
                  snippets near {DESC_LIMIT_PX} px, which is why two titles of the same length can
                  truncate differently: a “W” is three times the width of an “i”.
                </p>
              </TabsContent>

              <TabsContent value="social" className="mt-4">
                <div className="overflow-hidden rounded-xl border border-border bg-card">
                  {twitterCard === 'summary_large_image' ? (
                    <div className="aspect-[1.91/1] w-full bg-muted">
                      {ogImage && imageOk !== false ? (
                        <img
                          src={ogImage}
                          alt=""
                          className="size-full object-cover"
                          onError={() => setImageOk(false)}
                          onLoad={() => setImageOk(true)}
                        />
                      ) : (
                        <div className="flex size-full flex-col items-center justify-center gap-1 text-muted-foreground">
                          <ImageIcon className="size-6" aria-hidden="true" />
                          <span className="px-4 text-center text-xs">
                            {ogImage ? 'That image URL did not load' : '1200 × 630 share image'}
                          </span>
                        </div>
                      )}
                    </div>
                  ) : null}
                  <div className="flex gap-3 p-3">
                    {twitterCard === 'summary' ? (
                      <div className="size-16 shrink-0 overflow-hidden rounded bg-muted">
                        {ogImage && imageOk !== false ? (
                          <img
                            src={ogImage}
                            alt=""
                            className="size-full object-cover"
                            onError={() => setImageOk(false)}
                            onLoad={() => setImageOk(true)}
                          />
                        ) : null}
                      </div>
                    ) : null}
                    <div className="min-w-0">
                      <p className="truncate text-xs text-muted-foreground">{host}</p>
                      <p className="mt-0.5 line-clamp-2 text-sm font-medium text-foreground">
                        {effectiveOgTitle || 'Your shared title'}
                      </p>
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                        {effectiveOgDescription || 'Your shared description appears under the title.'}
                      </p>
                    </div>
                  </div>
                </div>
                <p className="mt-2 text-xs text-pretty text-muted-foreground">
                  The preview loads the image straight from the URL you typed, so a broken path shows
                  up immediately. Nothing about your page is sent anywhere by this tool.
                </p>
              </TabsContent>
            </Tabs>
          </ToolPanel>
        </div>
      </div>

      <ToolPanel
        title="Copy this into your <head>"
        footer={<CopyButton value={html} label="Copy the tags" />}
      >
        <CodeBlock code={html} />
      </ToolPanel>
    </div>
  )
}
