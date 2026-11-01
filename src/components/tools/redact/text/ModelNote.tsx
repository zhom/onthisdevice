import { Cpu, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { ProgressPanel } from '@/components/shared/ProgressPanel'
import { formatBytes } from '@/lib/utils'
import type { NerState } from './useNer'

/** The language model's state: offer the download, show progress, or say it is ready. */
export function ModelNote({ ner, what = 'Names, addresses, organizations and places' }: { ner: NerState; what?: string }) {
  if (ner.phase === 'checking') return null
  if (ner.phase === 'loading') {
    return <ProgressPanel label="Downloading the language model" value={ner.progress} sublabel="Once only. After this it loads from your browser's storage." />
  }
  if (ner.phase === 'error') {
    return <ErrorNote title="The language model did not load" message={ner.error ?? 'Unknown error.'} onRetry={ner.start} />
  }
  if (ner.phase === 'idle') {
    return (
      <div className="flex flex-col gap-3 rounded-xl bg-muted p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-pretty text-foreground">
          {what} are found by a language model. It downloads {formatBytes(ner.downloadBytes)} once and then works offline. Pattern rules already run.
        </p>
        <Button type="button" className="shrink-0 gap-2" onClick={ner.start}>
          <Download className="size-4" aria-hidden="true" />
          Load the model
        </Button>
      </div>
    )
  }
  return (
    <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status" aria-live="polite">
      <Cpu className="size-4 shrink-0" aria-hidden="true" />
      {ner.phase === 'running' ? `Language model is reading the text: ${ner.progress}%` : 'Language model ready. It runs on this device.'}
    </p>
  )
}
