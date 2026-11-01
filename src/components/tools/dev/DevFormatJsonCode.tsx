import { useCallback, useMemo, useRef, useState } from 'react'
import { FileUp, RotateCcw, Wand2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { CopyButton } from '@/components/shared/CopyButton'
import { DownloadButton } from '@/components/shared/DownloadButton'
import {
  DfCodePane,
  DfField,
  DfProofPanel,
  DfSegmented,
  DfStatChips,
  DfStatus,
  readTextFile,
} from './dev-format-ui'
import {
  CODEGEN_SAMPLE,
  CODE_TARGETS,
  DEFAULT_CODEGEN,
  generateCode,
  type CodeTarget,
} from './dev-format-codegen'
import { jsonExcerpt, repairJson, validateJson } from './dev-format-json'

export interface DevFormatJsonCodeProps {
  target?: CodeTarget
  /** Hide the target switcher on a single-target page. */
  lockTarget?: boolean
}

const FILENAMES: Record<CodeTarget, string> = {
  typescript: 'types.ts',
  go: 'types.go',
  zod: 'schema.ts',
  'json-schema': 'schema.json',
  python: 'models.py',
  csharp: 'Models.cs',
}

export default function DevFormatJsonCode({
  target = 'typescript',
  lockTarget = false,
}: DevFormatJsonCodeProps) {
  const [input, setInput] = useState('')
  const [active, setActive] = useState<CodeTarget>(target)
  const [rootName, setRootName] = useState('Root')
  const [markOptional, setMarkOptional] = useState(true)
  const [nullable, setNullable] = useState(true)
  const [exported, setExported] = useState(true)
  const [useTypeAlias, setUseTypeAlias] = useState(false)
  const [fileError, setFileError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const validation = useMemo(() => (input.trim() === '' ? null : validateJson(input)), [input])

  const generated = useMemo(() => {
    if (!validation || !validation.ok) return null
    return generateCode(validation.value, active, {
      ...DEFAULT_CODEGEN,
      rootName: rootName.trim() || 'Root',
      markOptional,
      nullable,
      exported,
      tsDeclaration: useTypeAlias ? 'type' : 'interface',
    })
  }, [active, exported, markOptional, nullable, rootName, useTypeAlias, validation])

  const output = generated?.code ?? ''

  const onFile = useCallback(async (file: File | undefined) => {
    if (!file) return
    setFileError(null)
    try {
      setInput(await readTextFile(file, 16 * 1024 * 1024))
    } catch (caught) {
      setFileError(caught instanceof Error ? caught.message : 'That file could not be read.')
    }
  }, [])

  const blob = useMemo(
    () => (output ? new Blob([output], { type: 'text/plain' }) : null),
    [output],
  )

  const info = CODE_TARGETS.find((item) => item.id === active)
  const showTsOptions = active === 'typescript'

  return (
    <div className="space-y-6">
      <ToolPanel
        title={`JSON to ${info?.label ?? 'code'}`}
        description="Paste a real API response and get types that match its actual shape: nested objects become named types, keys missing from some array elements become optional, and values that vary become unions."
      >
        {!lockTarget ? (
          <DfSegmented
            label="Output language"
            value={active}
            onChange={setActive}
            options={CODE_TARGETS.map((item) => ({ value: item.id, label: item.label }))}
          />
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
            <FileUp className="size-4" aria-hidden="true" />
            Load .json file
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,.txt,application/json"
            className="sr-only"
            aria-label="Load a JSON file"
            onChange={(event) => {
              void onFile(event.target.files?.[0])
              event.target.value = ''
            }}
          />
          <Button type="button" variant="ghost" size="sm" onClick={() => setInput(CODEGEN_SAMPLE)}>
            <Wand2 className="size-4" aria-hidden="true" />
            Load sample
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={input === ''}
            onClick={() => setInput('')}
          >
            <RotateCcw className="size-4" aria-hidden="true" />
            Clear
          </Button>
        </div>

        {fileError ? <ErrorNote message={fileError} onRetry={() => setFileError(null)} /> : null}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <DfField
            label="Root type name"
            htmlFor="cg-root"
            hint="The name given to the outermost type."
          >
            <Input
              id="cg-root"
              value={rootName}
              onChange={(event) => setRootName(event.target.value)}
              className="font-mono"
            />
          </DfField>

          <div className="flex flex-col justify-end gap-3 pb-1">
            <div className="flex items-center gap-3">
              <Switch id="cg-optional" checked={markOptional} onCheckedChange={setMarkOptional} />
              <Label htmlFor="cg-optional" className="text-sm">
                Mark inconsistent keys optional
              </Label>
            </div>
            <div className="flex items-center gap-3">
              <Switch id="cg-nullable" checked={nullable} onCheckedChange={setNullable} />
              <Label htmlFor="cg-nullable" className="text-sm">
                Model nulls as nullable types
              </Label>
            </div>
          </div>

          <div className="flex flex-col justify-end gap-3 pb-1">
            <div className="flex items-center gap-3">
              <Switch id="cg-export" checked={exported} onCheckedChange={setExported} />
              <Label htmlFor="cg-export" className="text-sm">
                Export / public declarations
              </Label>
            </div>
            {showTsOptions ? (
              <div className="flex items-center gap-3">
                <Switch id="cg-alias" checked={useTypeAlias} onCheckedChange={setUseTypeAlias} />
                <Label htmlFor="cg-alias" className="text-sm">
                  Use <code className="font-mono text-xs">type</code> instead of{' '}
                  <code className="font-mono text-xs">interface</code>
                </Label>
              </div>
            ) : null}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <DfCodePane
            label="JSON sample"
            value={input}
            onChange={setInput}
            rows={20}
            wrap={false}
            invalid={validation ? !validation.ok : false}
            placeholder='{ "id": 1, "name": "Ada", "tags": ["admin"] }'
          />
          <DfCodePane
            label={info?.label ?? 'Generated code'}
            value={output}
            readOnly
            rows={20}
            wrap={false}
            actions={
              output ? (
                <DownloadButton
                  blob={blob}
                  filename={FILENAMES[active]}
                  label="Download"
                  variant="outline"
                  size="sm"
                />
              ) : null
            }
            placeholder="Generated types appear here."
          />
        </div>

        {validation && !validation.ok ? (
          <div className="space-y-3">
            <DfStatus ok={false}>{validation.error.message}</DfStatus>
            {validation.error.hint ? (
              <p className="text-sm text-pretty text-muted-foreground">{validation.error.hint}</p>
            ) : null}
            <div className="overflow-x-auto rounded-lg bg-muted px-4 py-3">
              <pre className="w-max min-w-full font-mono text-[13px] whitespace-pre text-foreground">
                {jsonExcerpt(input, validation.error)}
              </pre>
            </div>
            {validation.repairs.length > 0 ? (
              <Button
                type="button"
                size="sm"
                onClick={() => setInput((current) => repairJson(current).text)}
              >
                Repair {validation.repairs.length} problem
                {validation.repairs.length === 1 ? '' : 's'} and try again
              </Button>
            ) : null}
          </div>
        ) : null}

        {generated ? (
          <>
            <DfStatChips
              items={[
                { label: 'Types', value: String(generated.typeCount) },
                { label: 'Lines', value: String(output.split('\n').length) },
                { label: 'Target', value: info?.label ?? active },
              ]}
            />
            <ul className="space-y-1.5 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
              {generated.warnings.map((warning) => (
                <li key={warning} className="text-pretty">
                  {warning}
                </li>
              ))}
            </ul>
            <CopyButton value={output} label="Copy code" />
          </>
        ) : null}
      </ToolPanel>

      <DfProofPanel subject="JSON" />
    </div>
  )
}
