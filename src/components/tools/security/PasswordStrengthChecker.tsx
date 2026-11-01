import { useMemo, useState } from 'react'
import { CircleCheck, CircleX, Eye, EyeOff, Info, TriangleAlert, X, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { ResultStat } from '@/components/shared/ResultStat'
import { CrackTimeTable, PrivacyNotice, StrengthMeter } from './SecurityUi'
import { formatCountFromBits } from './seclib'
import { analyzePassword, DICTIONARY_SIZE, type MatchKind, type PatternMatch } from './strength'
import { formatNumber } from '@/lib/utils'

const KIND_ICONS: Record<MatchKind, LucideIcon> = {
  breached: CircleX,
  dictionary: TriangleAlert,
  sequence: TriangleAlert,
  keyboard: TriangleAlert,
  repeat: TriangleAlert,
  date: TriangleAlert,
  bruteforce: CircleCheck,
}

function KindIcon({ kind, className }: { kind: MatchKind; className: string }) {
  const Icon = KIND_ICONS[kind]
  return <Icon className={className} aria-hidden="true" />
}

function MatchChip({ match, masked }: { match: PatternMatch; masked: boolean }) {
  const shown = masked ? '•'.repeat(match.token.length) : match.token
  return (
    <span
      className="inline-flex flex-col items-start gap-0.5 rounded-md bg-background px-2 py-1 text-foreground"
    >
      <code className="font-mono text-sm break-all">{shown}</code>
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <KindIcon kind={match.kind} className="size-3 shrink-0" />
        {match.label}
      </span>
    </span>
  )
}

export default function PasswordStrengthChecker() {
  const [password, setPassword] = useState('')
  const [revealed, setRevealed] = useState(false)

  const analysis = useMemo(() => analyzePassword(password), [password])
  const hasInput = password.length > 0
  const patterns = analysis.matches.filter((match) => match.kind !== 'bruteforce')
  const unpredictable = analysis.matches
    .filter((match) => match.kind === 'bruteforce')
    .reduce((sum, match) => sum + (match.end - match.start), 0)

  return (
    <div className="flex flex-col gap-6">
      <PrivacyNotice>
        Your password is not sent anywhere. The analysis below runs in JavaScript inside this tab,
        against dictionaries in the page itself. Nothing is stored, and closing the tab discards
        everything.
      </PrivacyNotice>

      <ToolPanel title="Password to check">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="strength-input">Password</Label>
          <div className="flex items-center gap-2">
            <Input
              id="strength-input"
              type={revealed ? 'text' : 'password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Type or paste a password"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              className="flex-1 font-mono"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={revealed ? 'Hide password' : 'Show password'}
              aria-pressed={revealed}
              onClick={() => setRevealed((previous) => !previous)}
            >
              {revealed ? (
                <EyeOff className="size-4" aria-hidden="true" />
              ) : (
                <Eye className="size-4" aria-hidden="true" />
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Clear the password field"
              disabled={!hasInput}
              onClick={() => setPassword('')}
            >
              <X className="size-4" aria-hidden="true" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            You can paste a real password. If you prefer not to, type something with the same
            shape: same length, same mix of words, digits and symbols.
          </p>
        </div>

        {hasInput ? (
          <div aria-live="polite" className="flex flex-col gap-4">
            <StrengthMeter bits={analysis.guessBits} band={analysis.band} />
            {analysis.breached && (
              <p className="flex items-start gap-2 rounded-lg bg-muted px-3 py-2 text-sm text-foreground">
                <CircleX className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>
                  <strong className="font-semibold">This exact password is on the list.</strong> It
                  appears verbatim among the most common breached passwords, which means it is tried
                  in the first fraction of a second of any attack.
                </span>
              </p>
            )}
          </div>
        ) : (
          <p className="rounded-lg bg-muted px-4 py-8 text-center text-sm text-muted-foreground">
            Enter a password to see its entropy, the patterns inside it and how long each kind of
            attack would take.
          </p>
        )}
      </ToolPanel>

      {hasInput && (
        <>
          <ToolPanel
            title="The numbers"
            description="A naive meter multiplies the alphabet by the length. A real attacker looks for structure first, which is what the adjusted figure prices in."
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <ResultStat label="Length" value={analysis.length} hint="characters" />
              <ResultStat
                label="Alphabet"
                value={analysis.poolSize}
                hint="characters implied by the classes used"
              />
              <ResultStat
                label="Naive entropy"
                value={`${formatNumber(analysis.naiveBits, 1)} bits`}
                hint="log2(alphabet ^ length)"
              />
              <ResultStat
                label="Adjusted entropy"
                value={`${formatNumber(analysis.guessBits, 1)} bits`}
                hint={`≈ ${formatCountFromBits(analysis.guessBits)} guesses`}
                emphasis
              />
            </div>
            <p className="text-xs text-pretty text-muted-foreground">
              {unpredictable} of {analysis.length} characters could not be explained by any pattern.
              That unpredictable part is what actually does the work.
            </p>
          </ToolPanel>

          <ToolPanel
            title="How an attacker reads your password"
            description="The cheapest way to cover the whole string, left to right. Segments marked Unpredictable are the parts a cracker would still have to brute force."
          >
            <div className="flex flex-wrap items-start gap-1.5">
              {analysis.matches.map((match) => (
                <MatchChip key={`${match.start}-${match.end}`} match={match} masked={!revealed} />
              ))}
            </div>

            {patterns.length > 0 ? (
              <ul className="flex flex-col gap-2">
                {patterns.map((match) => (
                  <li
                    key={`detail-${match.start}-${match.end}`}
                    className="flex items-start gap-3 rounded-lg bg-muted px-3 py-2.5"
                  >
                    <KindIcon kind={match.kind} className="mt-0.5 size-4 shrink-0" />
                    <span className="shrink-0 text-sm font-medium text-foreground">{match.label}</span>
                    <span className="min-w-0 text-sm text-pretty text-muted-foreground">
                      {revealed
                        ? match.detail
                        : match.detail.replace(/“[^”]*”/g, '“•••”')}{' '}
                      <span className="whitespace-nowrap text-foreground">
                        ≈ {formatNumber(match.bits, 1)} bits
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="flex items-start gap-2 rounded-lg bg-muted px-3 py-2 text-sm text-foreground">
                <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>
                  No dictionary words, keyboard runs, sequences, repeats or dates were found. The
                  whole string is priced at full brute-force cost.
                </span>
              </p>
            )}

            <p className="flex items-start gap-2 text-xs text-pretty text-muted-foreground">
              <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              <span>
                The embedded dictionaries hold about {formatNumber(DICTIONARY_SIZE, 0)} entries: the
                most common breached passwords plus everyday English words, names, months and teams.
                A real cracking rig loads tens of millions. Treat the adjusted number as a best
                case: your password is never
                stronger than this, and often weaker.
              </span>
            </p>
          </ToolPanel>

          <ToolPanel
            title="Time to crack"
            description="Based on the adjusted guess count, assuming the attacker already holds the password database."
          >
            <CrackTimeTable bits={analysis.guessBits} />
          </ToolPanel>

          {analysis.advice.length > 0 && (
            <ToolPanel title="What to do about it">
              <ul className="flex flex-col gap-2">
                {analysis.advice.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-start gap-3 rounded-lg bg-muted px-3 py-2.5 text-sm text-pretty"
                  >
                    {item.tone === 'critical' ? (
                      <CircleX
                        className="mt-0.5 size-4 shrink-0"
                        aria-hidden="true"
                      />
                    ) : item.tone === 'good' ? (
                      <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                    ) : (
                      <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    )}
                    <span className="text-foreground">
                      <span className="font-semibold">
                        {item.tone === 'critical'
                          ? 'Critical: '
                          : item.tone === 'good'
                            ? 'Good: '
                            : 'Suggestion: '}
                      </span>
                      {item.text}
                    </span>
                  </li>
                ))}
              </ul>
            </ToolPanel>
          )}
        </>
      )}
    </div>
  )
}
