import { useCallback, useMemo, useState } from 'react'
import { AlertTriangle, FolderCog } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { ResultStat } from '@/components/shared/ResultStat'
import { Formula } from '@/components/shared/Formula'
import { CopyButton } from '@/components/shared/CopyButton'
import { EncodeField } from './dev-encode-ui'

type Who = 'owner' | 'group' | 'other'
type What = 'read' | 'write' | 'execute'

const WHO: { id: Who; label: string; symbol: string; hint: string }[] = [
  { id: 'owner', label: 'Owner', symbol: 'u', hint: 'The user who owns the file' },
  { id: 'group', label: 'Group', symbol: 'g', hint: 'Members of the file’s group' },
  { id: 'other', label: 'Others', symbol: 'o', hint: 'Everyone else on the system' },
]

const WHAT: { id: What; label: string; symbol: string; value: number; fileMeaning: string; dirMeaning: string }[] = [
  {
    id: 'read',
    label: 'Read',
    symbol: 'r',
    value: 4,
    fileMeaning: 'open and read the contents',
    dirMeaning: 'list the names inside',
  },
  {
    id: 'write',
    label: 'Write',
    symbol: 'w',
    value: 2,
    fileMeaning: 'modify or truncate the file',
    dirMeaning: 'create, rename and delete entries',
  },
  {
    id: 'execute',
    label: 'Execute',
    symbol: 'x',
    value: 1,
    fileMeaning: 'run it as a program or script',
    dirMeaning: 'enter it and reach the files inside',
  },
]

const PRESETS: { octal: string; label: string; note: string }[] = [
  { octal: '644', label: 'Regular file', note: 'Owner edits, everyone reads (the default for documents and web assets)' },
  { octal: '755', label: 'Script or directory', note: 'Owner edits, everyone reads and runs or enters' },
  { octal: '600', label: 'Private file', note: 'Only the owner. SSH private keys and .env files' },
  { octal: '700', label: 'Private directory', note: 'Only the owner may enter. ~/.ssh' },
  { octal: '664', label: 'Group-writable file', note: 'Shared editing inside one team group' },
  { octal: '775', label: 'Group-writable directory', note: 'Shared project directory' },
  { octal: '400', label: 'Read-only key', note: 'Some tools insist on this for credentials' },
  { octal: '777', label: 'Everything to everyone', note: 'Almost always a mistake (see the warning below)' },
  { octal: '1777', label: 'Sticky shared directory', note: 'Like /tmp: anyone writes, only the owner deletes' },
  { octal: '2775', label: 'Setgid directory', note: 'New files inherit the directory’s group' },
]

interface Mode {
  bits: Record<Who, Record<What, boolean>>
  setuid: boolean
  setgid: boolean
  sticky: boolean
}

const EMPTY: Mode = {
  bits: {
    owner: { read: false, write: false, execute: false },
    group: { read: false, write: false, execute: false },
    other: { read: false, write: false, execute: false },
  },
  setuid: false,
  setgid: false,
  sticky: false,
}

function fromOctal(text: string): Mode | null {
  const cleaned = text.trim()
  if (!/^[0-7]{3,4}$/.test(cleaned)) return null
  const padded = cleaned.padStart(4, '0')
  const special = Number(padded[0])
  const digits: Record<Who, number> = {
    owner: Number(padded[1]),
    group: Number(padded[2]),
    other: Number(padded[3]),
  }
  const bits = {} as Mode['bits']
  for (const who of WHO) {
    bits[who.id] = {
      read: (digits[who.id] & 4) !== 0,
      write: (digits[who.id] & 2) !== 0,
      execute: (digits[who.id] & 1) !== 0,
    }
  }
  return {
    bits,
    setuid: (special & 4) !== 0,
    setgid: (special & 2) !== 0,
    sticky: (special & 1) !== 0,
  }
}

function fromSymbolic(text: string): Mode | null {
  const cleaned = text.trim().replace(/^[-dlbcps]/, '')
  if (!/^[rwxsStT-]{9}$/.test(cleaned)) return null
  const mode: Mode = JSON.parse(JSON.stringify(EMPTY)) as Mode
  const triples: Who[] = ['owner', 'group', 'other']
  triples.forEach((who, index) => {
    const chunk = cleaned.slice(index * 3, index * 3 + 3)
    mode.bits[who].read = chunk[0] === 'r'
    mode.bits[who].write = chunk[1] === 'w'
    const third = chunk[2]
    if (who === 'owner') {
      mode.setuid = third === 's' || third === 'S'
      mode.bits[who].execute = third === 'x' || third === 's'
    } else if (who === 'group') {
      mode.setgid = third === 's' || third === 'S'
      mode.bits[who].execute = third === 'x' || third === 's'
    } else {
      mode.sticky = third === 't' || third === 'T'
      mode.bits[who].execute = third === 'x' || third === 't'
    }
  })
  return mode
}

function toOctal(mode: Mode): string {
  const special = (mode.setuid ? 4 : 0) + (mode.setgid ? 2 : 0) + (mode.sticky ? 1 : 0)
  const digit = (who: Who) =>
    WHAT.reduce((sum, entry) => sum + (mode.bits[who][entry.id] ? entry.value : 0), 0)
  const base = `${digit('owner')}${digit('group')}${digit('other')}`
  return special > 0 ? `${special}${base}` : base
}

function toSymbolic(mode: Mode): string {
  const triple = (who: Who, special: boolean, specialChar: string) => {
    const bits = mode.bits[who]
    const third = special
      ? bits.execute
        ? specialChar
        : specialChar.toUpperCase()
      : bits.execute
        ? 'x'
        : '-'
    return `${bits.read ? 'r' : '-'}${bits.write ? 'w' : '-'}${third}`
  }
  return (
    triple('owner', mode.setuid, 's') +
    triple('group', mode.setgid, 's') +
    triple('other', mode.sticky, 't')
  )
}

function toSymbolicCommand(mode: Mode): string {
  const parts: string[] = []
  for (const who of WHO) {
    const bits = mode.bits[who.id]
    const letters = WHAT.filter((entry) => bits[entry.id])
      .map((entry) => entry.symbol)
      .join('')
    parts.push(`${who.symbol}=${letters}`)
  }
  const specials: string[] = []
  if (mode.setuid) specials.push('u+s')
  if (mode.setgid) specials.push('g+s')
  if (mode.sticky) specials.push('+t')
  return [...parts, ...specials].join(',')
}

function describe(mode: Mode, isDirectory: boolean): string[] {
  const lines: string[] = []
  for (const who of WHO) {
    const bits = mode.bits[who.id]
    const allowed = WHAT.filter((entry) => bits[entry.id]).map((entry) =>
      isDirectory ? entry.dirMeaning : entry.fileMeaning,
    )
    lines.push(
      allowed.length === 0
        ? `${who.label}: no access at all.`
        : `${who.label} can ${allowed.join(', ')}.`,
    )
  }
  return lines
}

export default function DevEncodeChmod() {
  const [mode, setMode] = useState<Mode>(() => fromOctal('644') ?? EMPTY)
  const [octalDraft, setOctalDraft] = useState('644')
  const [symbolicDraft, setSymbolicDraft] = useState('rw-r--r--')
  const [isDirectory, setIsDirectory] = useState(false)
  const [filename, setFilename] = useState('file.txt')

  const apply = useCallback((next: Mode) => {
    setMode(next)
    setOctalDraft(toOctal(next))
    setSymbolicDraft(toSymbolic(next))
  }, [])

  const toggle = useCallback(
    (who: Who, what: What, value: boolean) => {
      const next: Mode = {
        ...mode,
        bits: { ...mode.bits, [who]: { ...mode.bits[who], [what]: value } },
      }
      apply(next)
    },
    [mode, apply],
  )

  const octal = toOctal(mode)
  const symbolic = toSymbolic(mode)
  const command = `chmod ${octal} ${filename || 'file'}`
  const symbolicCommand = `chmod ${toSymbolicCommand(mode)} ${filename || 'file'}`
  const lsLine = `${isDirectory ? 'd' : '-'}${symbolic}`

  const digits = useMemo(
    () =>
      WHO.map((who) => ({
        who,
        value: WHAT.reduce(
          (sum, entry) => sum + (mode.bits[who.id][entry.id] ? entry.value : 0),
          0,
        ),
        terms: WHAT.filter((entry) => mode.bits[who.id][entry.id]),
      })),
    [mode],
  )

  const worldWritable = mode.bits.other.write

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <ResultStat
          label="Octal"
          value={<span className="font-mono text-2xl">{octal}</span>}
          hint="What chmod takes"
          emphasis
        />
        <ResultStat
          label="Symbolic"
          value={<span className="font-mono text-2xl">{symbolic}</span>}
          hint="What ls -l prints"
        />
        <ResultStat
          label="ls -l"
          value={<span className="font-mono text-lg">{lsLine}</span>}
          hint={isDirectory ? 'Directory' : 'Regular file'}
        />
      </div>

      <ToolPanel
        title="Permission grid"
        description="Tick what each class of user may do. The rest of the page updates as you tick."
      >
        <div className="overflow-x-auto rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-28">Who</TableHead>
                {WHAT.map((entry) => (
                  <TableHead key={entry.id} className="text-center">
                    {entry.label} ({entry.symbol})
                  </TableHead>
                ))}
                <TableHead className="w-20 text-right">Digit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {WHO.map((who) => (
                <TableRow key={who.id}>
                  <TableCell>
                    <div className="font-medium text-foreground">{who.label}</div>
                    <div className="text-xs text-muted-foreground">{who.hint}</div>
                  </TableCell>
                  {WHAT.map((entry) => {
                    const id = `${who.id}-${entry.id}`
                    return (
                      <TableCell key={entry.id} className="text-center">
                        <div className="flex justify-center">
                          <Checkbox
                            id={id}
                            checked={mode.bits[who.id][entry.id]}
                            onCheckedChange={(checked) =>
                              toggle(who.id, entry.id, checked === true)
                            }
                            aria-label={`${who.label} may ${entry.label.toLowerCase()}`}
                          />
                        </div>
                      </TableCell>
                    )
                  })}
                  <TableCell className="text-right font-mono text-lg font-semibold">
                    {WHAT.reduce(
                      (sum, entry) => sum + (mode.bits[who.id][entry.id] ? entry.value : 0),
                      0,
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {(
            [
              {
                key: 'setuid' as const,
                label: 'setuid (4000)',
                hint: 'Runs with the owner’s identity, not the caller’s',
              },
              {
                key: 'setgid' as const,
                label: 'setgid (2000)',
                hint: 'Runs as the group; on a directory, new files inherit that group',
              },
              {
                key: 'sticky' as const,
                label: 'sticky (1000)',
                hint: 'In a shared directory, only the owner of a file may delete it',
              },
            ]
          ).map((special) => (
            <div key={special.key} className="rounded-lg bg-muted p-3">
              <div className="flex items-center gap-2">
                <Switch
                  id={special.key}
                  checked={mode[special.key]}
                  onCheckedChange={(checked) => apply({ ...mode, [special.key]: checked })}
                />
                <Label htmlFor={special.key} className="text-sm">
                  {special.label}
                </Label>
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">{special.hint}</p>
            </div>
          ))}
        </div>
      </ToolPanel>

      <ToolPanel title="Type it either way" description="Both fields are live and two-way.">
        <div className="grid gap-4 sm:grid-cols-2">
          <EncodeField
            label="Octal notation"
            htmlFor="octal-input"
            hint="Three digits, or four with the special bits in front."
          >
            <Input
              id="octal-input"
              value={octalDraft}
              onChange={(event) => {
                const value = event.target.value
                setOctalDraft(value)
                const parsedMode = fromOctal(value)
                if (parsedMode) {
                  setMode(parsedMode)
                  setSymbolicDraft(toSymbolic(parsedMode))
                }
              }}
              className="font-mono text-lg"
              inputMode="numeric"
              aria-invalid={fromOctal(octalDraft) === null || undefined}
            />
          </EncodeField>
          <EncodeField
            label="Symbolic notation"
            htmlFor="symbolic-input"
            hint="Nine characters as ls -l prints them, with or without the leading type character."
          >
            <Input
              id="symbolic-input"
              value={symbolicDraft}
              onChange={(event) => {
                const value = event.target.value
                setSymbolicDraft(value)
                const parsedMode = fromSymbolic(value)
                if (parsedMode) {
                  setMode(parsedMode)
                  setOctalDraft(toOctal(parsedMode))
                }
              }}
              className="font-mono text-lg"
              aria-invalid={fromSymbolic(symbolicDraft) === null || undefined}
            />
          </EncodeField>
        </div>

        <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
          <EncodeField label="File or directory name" htmlFor="chmod-filename">
            <Input
              id="chmod-filename"
              value={filename}
              onChange={(event) => setFilename(event.target.value)}
              className="font-mono"
            />
          </EncodeField>
          <div className="flex items-center gap-2 pb-2">
            <Switch id="is-directory" checked={isDirectory} onCheckedChange={setIsDirectory} />
            <Label htmlFor="is-directory" className="text-sm">
              It is a directory
            </Label>
          </div>
        </div>

        <div className="space-y-2">
          {[command, symbolicCommand, `chmod -R ${octal} ${filename || 'dir'}`].map((line) => (
            <div
              key={line}
              className="flex items-center gap-2 overflow-x-auto rounded-lg bg-muted px-3 py-2"
            >
              <code className="min-w-0 flex-1 font-mono text-sm break-all text-foreground">
                {line}
              </code>
              <CopyButton value={line} label="Copy" variant="ghost" />
            </div>
          ))}
        </div>
      </ToolPanel>

      <ToolPanel title="What this actually allows">
        <ul className="space-y-1.5 text-sm text-muted-foreground">
          {describe(mode, isDirectory).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>

        <Formula caption="Each digit is the sum of read 4, write 2 and execute 1 for that class of user.">
          {digits
            .map(
              (entry) =>
                `${entry.who.label.padEnd(6)} ${entry.terms.length ? entry.terms.map((t) => `${t.symbol}=${t.value}`).join(' + ') : '0'} = ${entry.value}`,
            )
            .join('\n') + `\n\nchmod ${octal}`}
        </Formula>

        {worldWritable ? (
          <Alert role="status" variant="warning">
            <AlertTriangle aria-hidden="true" />
            <AlertTitle>Writable by everyone</AlertTitle>
            <AlertDescription>
              Any account on the machine can change this {isDirectory ? 'directory' : 'file'}. That
              is almost never what you want. 777 in particular is a habit picked up from
              &ldquo;fix my permissions&rdquo; forum posts, and it makes a web root editable by any
              compromised process on the box. Grant the group write access instead, or fix the
              ownership with <code className="font-mono">chown</code>.
            </AlertDescription>
          </Alert>
        ) : null}

        {mode.setuid ? (
          <Alert role="note" variant="warning">
            <AlertTitle>setuid is a privilege boundary</AlertTitle>
            <AlertDescription>
              A setuid binary owned by root runs as root no matter who starts it. It is the classic
              local privilege-escalation surface. Never set it on a shell script, which most kernels
              ignore for exactly this reason.
            </AlertDescription>
          </Alert>
        ) : null}
      </ToolPanel>

      <ToolPanel
        title="Common modes"
        description="Click one to load it into the grid."
      >
        <div className="grid gap-2 sm:grid-cols-2">
          {PRESETS.map((preset) => (
            <Button
              key={preset.octal}
              variant="outline"
              className="h-auto justify-start gap-3 py-2.5 text-left"
              onClick={() => {
                const next = fromOctal(preset.octal)
                if (next) apply(next)
              }}
            >
              <FolderCog className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="min-w-0">
                <span className="font-mono font-semibold">{preset.octal}</span>{' '}
                <span className="font-medium">{preset.label}</span>
                <span className="block text-xs font-normal text-wrap text-muted-foreground">
                  {preset.note}
                </span>
              </span>
            </Button>
          ))}
        </div>
      </ToolPanel>
    </div>
  )
}
