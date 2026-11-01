import { useMemo, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { clamp, formatNumber } from '@/lib/utils'
import { OutputBox, Segmented, StatTile, ToggleRow } from './common'
import { countWords } from './text-core'
import { CORPORA, CORPUS_BY_ID, generateLorem, type LoremOptions } from './lorem-corpus'

const UNITS = [
  { value: 'paragraphs', label: 'Paragraphs' },
  { value: 'sentences', label: 'Sentences' },
  { value: 'words', label: 'Words' },
  { value: 'list', label: 'List items' },
] as const

type Unit = (typeof UNITS)[number]['value']

/**
 * The first render must be deterministic: the page is pre-rendered at build
 * time and hydrated in the browser, so a `Math.random()` seed here would make
 * the two renders disagree and React would throw away the server HTML. The
 * "Shuffle" button randomises the seed after mount.
 */
const INITIAL_SEED = 1_337_071

const MAX_BY_UNIT: Record<Unit, number> = {
  paragraphs: 100,
  sentences: 200,
  words: 500,
  list: 100,
}

export default function LoremIpsumGenerator() {
  const [unit, setUnit] = useState<Unit>('paragraphs')
  const [count, setCount] = useState(3)
  const [corpusId, setCorpusId] = useState('classic')
  const [startWithClassic, setStartWithClassic] = useState(true)
  const [html, setHtml] = useState(false)
  const [sentencesPerParagraph, setSentencesPerParagraph] = useState(5)
  const [seed, setSeed] = useState(INITIAL_SEED)

  const corpus = CORPUS_BY_ID[corpusId] ?? CORPORA[0]
  const max = MAX_BY_UNIT[unit]
  const safeCount = clamp(count, 1, max)

  const options: LoremOptions = useMemo(
    () => ({
      corpusId,
      unit,
      count: safeCount,
      startWithClassic,
      html,
      sentencesPerParagraph,
      seed,
    }),
    [corpusId, unit, safeCount, startWithClassic, html, sentencesPerParagraph, seed],
  )

  const output = useMemo(() => generateLorem(options), [options])

  const stats = useMemo(
    () => ({
      words: countWords(output),
      characters: output.length,
      paragraphs: output.split(/\n{2,}|\n(?=<p>)/).filter((p) => p.trim() !== '').length,
    }),
    [output],
  )

  return (
    <div className="space-y-6">
      <ToolPanel title="What do you need?">
        <div className="grid gap-4 lg:grid-cols-2">
          <Segmented label="Generate" value={unit} options={UNITS} onChange={setUnit} />

          <div className="space-y-1.5">
            <Label htmlFor="lorem-count" className="text-sm font-medium">
              How many (1–{max})
            </Label>
            <div className="flex items-center gap-3">
              <Slider
                id="lorem-count"
                className="flex-1"
                min={1}
                max={max}
                step={1}
                value={[safeCount]}
                onValueChange={(values: number[]) => setCount(values[0] ?? 1)}
                aria-label={`Number of ${unit}`}
              />
              <Input
                type="number"
                min={1}
                max={max}
                inputMode="numeric"
                aria-label={`Number of ${unit}, exact value`}
                className="w-20"
                value={count}
                onChange={(event) => {
                  const parsed = Number.parseInt(event.target.value, 10)
                  setCount(Number.isFinite(parsed) ? clamp(parsed, 1, max) : 1)
                }}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="lorem-corpus" className="text-sm font-medium">
              Style
            </Label>
            <Select value={corpusId} onValueChange={setCorpusId}>
              <SelectTrigger id="lorem-corpus" className="w-full">
                <SelectValue placeholder="Choose a style" />
              </SelectTrigger>
              <SelectContent>
                {CORPORA.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground text-pretty">{corpus.description}</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="lorem-density" className="text-sm font-medium">
              Sentences per paragraph: {sentencesPerParagraph}
            </Label>
            <Slider
              id="lorem-density"
              min={1}
              max={12}
              step={1}
              value={[sentencesPerParagraph]}
              onValueChange={(values: number[]) => setSentencesPerParagraph(values[0] ?? 5)}
              disabled={unit !== 'paragraphs'}
              aria-label="Sentences per paragraph"
            />
            <p className="text-xs text-muted-foreground">
              {unit === 'paragraphs'
                ? 'Paragraph length varies by one sentence either side of this figure.'
                : 'Only applies when generating paragraphs.'}
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <ToggleRow
            label="Start with the classic opening"
            description={`Begins with “${corpus.opening.slice(0, 42)}…”`}
            checked={startWithClassic}
            onChange={setStartWithClassic}
          />
          <ToggleRow
            label="Wrap in HTML tags"
            description={unit === 'list' ? 'Outputs a <ul> with <li> items.' : 'Wraps each block in <p> tags.'}
            checked={html}
            onChange={setHtml}
          />
        </div>

        <Button
          type="button"
          variant="outline"
          className="gap-2"
          onClick={() => setSeed(Math.floor(Math.random() * 2 ** 31))}
        >
          <RefreshCw className="size-4" aria-hidden="true" />
          Generate new text
        </Button>
      </ToolPanel>

      <ToolPanel>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Words" value={formatNumber(stats.words, 0)} accent />
          <StatTile label="Characters" value={formatNumber(stats.characters, 0)} />
          <StatTile label="Blocks" value={formatNumber(stats.paragraphs, 0)} />
          <StatTile label="Format" value={html ? 'HTML' : 'Plain text'} />
        </div>
        <OutputBox
          label="Generated text"
          value={output}
          filename={html ? 'lorem-ipsum.html' : 'lorem-ipsum.txt'}
          rows={14}
          mono={html}
          empty="Choose your options above to generate placeholder text."
        />
      </ToolPanel>
    </div>
  )
}
