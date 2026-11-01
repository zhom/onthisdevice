import { useMemo, useRef, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { ResultStat } from '@/components/shared/ResultStat'
import { CopyButton } from '@/components/shared/CopyButton'
import { Formula } from '@/components/shared/Formula'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatNumber } from '@/components/tools/finance/format'
import {
  Breakdown,
  EmptyState,
  NumField,
  Note,
  ScrollTable,
  StatGrid,
  num,
  parseNum,
  pct,
  summaryLines,
} from './common'

export interface LetterBand {
  letter: string
  min: number
}

export const LETTER_SCALE: LetterBand[] = [
  { letter: 'A+', min: 97 },
  { letter: 'A', min: 93 },
  { letter: 'A−', min: 90 },
  { letter: 'B+', min: 87 },
  { letter: 'B', min: 83 },
  { letter: 'B−', min: 80 },
  { letter: 'C+', min: 77 },
  { letter: 'C', min: 73 },
  { letter: 'C−', min: 70 },
  { letter: 'D+', min: 67 },
  { letter: 'D', min: 63 },
  { letter: 'D−', min: 60 },
  { letter: 'F', min: 0 },
]

export function letterFor(percent: number): string {
  const band = LETTER_SCALE.find((b) => percent >= b.min)
  return band ? band.letter : 'F'
}

interface CategoryRow {
  id: string
  name: string
  score: string
  weight: string
}

interface PointRow {
  id: string
  name: string
  earned: string
  possible: string
}

export default function GradeCalculator() {
  const idRef = useRef(100)
  const nextId = () => `g${idRef.current++}`
  const [tab, setTab] = useState('weighted')

  const [rows, setRows] = useState<CategoryRow[]>([
    { id: 'c1', name: 'Homework', score: '92', weight: '20' },
    { id: 'c2', name: 'Quizzes', score: '85', weight: '15' },
    { id: 'c3', name: 'Midterm', score: '78', weight: '25' },
    { id: 'c4', name: 'Final exam', score: '', weight: '40' },
  ])

  const [points, setPoints] = useState<PointRow[]>([
    { id: 'p1', name: 'Essay 1', earned: '44', possible: '50' },
    { id: 'p2', name: 'Lab report', earned: '18', possible: '20' },
    { id: 'p3', name: 'Midterm', earned: '82', possible: '100' },
  ])

  const [currentGrade, setCurrentGrade] = useState('84')
  const [finalWeight, setFinalWeight] = useState('30')
  const [targetGrade, setTargetGrade] = useState('90')

  /* ------------------------- weighted ------------------------- */
  const weighted = useMemo(() => {
    const graded = rows
      .map((r) => ({ ...r, s: parseNum(r.score), w: parseNum(r.weight) }))
      .filter((r) => r.s !== null && r.w !== null && (r.w as number) > 0)
    const totalWeightAll = rows.reduce((a, r) => a + Math.max(0, num(r.weight)), 0)
    if (graded.length === 0) return null
    const gradedWeight = graded.reduce((a, r) => a + (r.w as number), 0)
    const weightedPoints = graded.reduce((a, r) => a + (r.s as number) * (r.w as number), 0)
    const current = weightedPoints / gradedWeight
    const ifZeroRest = totalWeightAll > 0 ? weightedPoints / totalWeightAll : current
    const remainingWeight = Math.max(0, totalWeightAll - gradedWeight)
    return {
      current,
      ifZeroRest,
      gradedWeight,
      totalWeightAll,
      remainingWeight,
      weightedPoints,
      maxPossible: totalWeightAll > 0 ? (weightedPoints + remainingWeight * 100) / totalWeightAll : 100,
      contributions: graded.map((r) => ({
        name: r.name.trim() || 'Category',
        score: r.s as number,
        weight: r.w as number,
        points: ((r.s as number) * (r.w as number)) / 100,
      })),
    }
  }, [rows])

  /* -------------------------- points -------------------------- */
  const pointsResult = useMemo(() => {
    const valid = points
      .map((p) => ({ ...p, e: parseNum(p.earned), m: parseNum(p.possible) }))
      .filter((p) => p.e !== null && p.m !== null && (p.m as number) > 0)
    if (valid.length === 0) return null
    const earned = valid.reduce((a, p) => a + (p.e as number), 0)
    const possible = valid.reduce((a, p) => a + (p.m as number), 0)
    return { earned, possible, percent: (earned / possible) * 100, rows: valid }
  }, [points])

  /* --------------------- what do I need? --------------------- */
  const needed = useMemo(() => {
    const cur = parseNum(currentGrade)
    const w = parseNum(finalWeight)
    const target = parseNum(targetGrade)
    if (cur === null || w === null || target === null) return null
    if (w <= 0 || w > 100) return { error: 'The final exam weight has to be between 0 and 100%.' as const }
    const fraction = w / 100
    const required = (target - cur * (1 - fraction)) / fraction
    return {
      error: null,
      cur,
      w,
      target,
      required,
      outcomes: [0, 50, 60, 70, 80, 90, 95, 100].map((score) => ({
        score,
        finalGrade: cur * (1 - fraction) + score * fraction,
      })),
    }
  }, [currentGrade, finalWeight, targetGrade])

  const summary =
    tab === 'weighted' && weighted
      ? summaryLines([
          `Current weighted grade: ${formatNumber(weighted.current, 2)}% (${letterFor(weighted.current)})`,
          `Graded weight so far: ${formatNumber(weighted.gradedWeight, 2)}% of ${formatNumber(weighted.totalWeightAll, 2)}%`,
          ...weighted.contributions.map(
            (c) => `  ${c.name}: ${formatNumber(c.score, 2)}% × ${formatNumber(c.weight, 2)}% = ${formatNumber(c.points, 2)} pts`,
          ),
        ])
      : tab === 'points' && pointsResult
        ? summaryLines([
            `Points: ${formatNumber(pointsResult.earned, 2)} / ${formatNumber(pointsResult.possible, 2)}`,
            `Grade: ${formatNumber(pointsResult.percent, 2)}% (${letterFor(pointsResult.percent)})`,
          ])
        : tab === 'final' && needed && !needed.error
          ? summaryLines([
              `Current grade: ${formatNumber(needed.cur, 2)}%`,
              `Final worth: ${formatNumber(needed.w, 2)}%`,
              `Target: ${formatNumber(needed.target, 2)}%`,
              `Score needed on the final: ${formatNumber(needed.required, 2)}%`,
            ])
          : ''

  return (
    <div className="space-y-6">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="weighted">Weighted</TabsTrigger>
          <TabsTrigger value="points">Points</TabsTrigger>
          <TabsTrigger value="final">Final needed</TabsTrigger>
        </TabsList>

        {/* -------------------------- WEIGHTED -------------------------- */}
        <TabsContent value="weighted" className="mt-6 space-y-6">
          <ToolPanel
            title="Categories and weights"
            description="Copy the weights straight off the syllabus. Leave a score blank for anything not graded yet."
            footer={
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => setRows((prev) => [...prev, { id: nextId(), name: '', score: '', weight: '' }])}
              >
                <Plus className="size-4" aria-hidden="true" />
                Add category
              </Button>
            }
          >
            <ul className="space-y-3">
              {rows.map((r, i) => (
                <li key={r.id} className="flex flex-col gap-3 rounded-lg bg-muted p-3 sm:flex-row sm:items-end">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <Label htmlFor={`cat-${r.id}`}>Category {i + 1}</Label>
                    <Input
                      id={`cat-${r.id}`}
                      value={r.name}
                      autoComplete="off"
                      placeholder="Homework, exams…"
                      onChange={(e) =>
                        setRows((prev) => prev.map((q) => (q.id === r.id ? { ...q, name: e.target.value } : q)))
                      }
                    />
                  </div>
                  <NumField
                    label="Your score"
                    value={r.score}
                    onChange={(v) => setRows((prev) => prev.map((q) => (q.id === r.id ? { ...q, score: v } : q)))}
                    suffix="%"
                    placeholder="–"
                    className="w-full sm:w-32"
                  />
                  <NumField
                    label="Weight"
                    value={r.weight}
                    onChange={(v) => setRows((prev) => prev.map((q) => (q.id === r.id ? { ...q, weight: v } : q)))}
                    suffix="%"
                    className="w-full sm:w-32"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove category ${i + 1}`}
                    disabled={rows.length <= 1}
                    onClick={() => setRows((prev) => prev.filter((q) => q.id !== r.id))}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </Button>
                </li>
              ))}
            </ul>
          </ToolPanel>

          <ToolPanel
            title="Where you stand"
            footer={weighted ? <CopyButton value={summary} label="Copy the breakdown" /> : undefined}
          >
            {weighted ? (
              <div className="space-y-4">
                {Math.abs(weighted.totalWeightAll - 100) > 0.01 && (
                  <Note tone="warning">
                    Your weights add up to {formatNumber(weighted.totalWeightAll, 2)}%, not 100%. The
                    current grade below is calculated over the {formatNumber(weighted.gradedWeight, 2)}%
                    that already has a score, so it is still correct. Check the syllabus.
                  </Note>
                )}

                <StatGrid cols={3}>
                  <ResultStat
                    label="Current grade"
                    value={`${formatNumber(weighted.current, 2)}%`}
                    hint={`Letter grade ${letterFor(weighted.current)}, from graded work only`}
                    emphasis
                  />
                  <ResultStat
                    label="If you scored 0 on everything left"
                    value={`${formatNumber(weighted.ifZeroRest, 2)}%`}
                    hint={letterFor(weighted.ifZeroRest)}
                  />
                  <ResultStat
                    label="Best still possible"
                    value={`${formatNumber(weighted.maxPossible, 2)}%`}
                    hint={`${formatNumber(weighted.remainingWeight, 2)}% of the grade is still open`}
                  />
                </StatGrid>

                <ScrollTable>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">Score</TableHead>
                        <TableHead className="text-right">Weight</TableHead>
                        <TableHead className="text-right">Points contributed</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {weighted.contributions.map((c, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">{c.name}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatNumber(c.score, 2)}%</TableCell>
                          <TableCell className="text-right tabular-nums">{formatNumber(c.weight, 2)}%</TableCell>
                          <TableCell className="text-right tabular-nums">{formatNumber(c.points, 2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollTable>

                <Formula caption="A weighted grade is the weighted mean of your category scores.">
                  {[
                    `grade = Σ(score × weight) ÷ Σ(weight)`,
                    `      = ${formatNumber(weighted.weightedPoints, 2)} ÷ ${formatNumber(weighted.gradedWeight, 2)}`,
                    `      = ${formatNumber(weighted.current, 2)}%  →  ${letterFor(weighted.current)}`,
                  ].join('\n')}
                </Formula>
              </div>
            ) : (
              <EmptyState message="Add a score and a weight to at least one category." />
            )}
          </ToolPanel>
        </TabsContent>

        {/* --------------------------- POINTS --------------------------- */}
        <TabsContent value="points" className="mt-6 space-y-6">
          <ToolPanel
            title="Assignments by points"
            description="For classes graded on total points rather than category weights."
            footer={
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => setPoints((prev) => [...prev, { id: nextId(), name: '', earned: '', possible: '' }])}
              >
                <Plus className="size-4" aria-hidden="true" />
                Add assignment
              </Button>
            }
          >
            <ul className="space-y-3">
              {points.map((p, i) => (
                <li key={p.id} className="flex flex-col gap-3 rounded-lg bg-muted p-3 sm:flex-row sm:items-end">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <Label htmlFor={`pt-${p.id}`}>Assignment {i + 1}</Label>
                    <Input
                      id={`pt-${p.id}`}
                      value={p.name}
                      autoComplete="off"
                      placeholder="Essay, lab, quiz…"
                      onChange={(e) =>
                        setPoints((prev) => prev.map((q) => (q.id === p.id ? { ...q, name: e.target.value } : q)))
                      }
                    />
                  </div>
                  <NumField
                    label="Points earned"
                    value={p.earned}
                    onChange={(v) => setPoints((prev) => prev.map((q) => (q.id === p.id ? { ...q, earned: v } : q)))}
                    className="w-full sm:w-32"
                  />
                  <NumField
                    label="Out of"
                    value={p.possible}
                    onChange={(v) => setPoints((prev) => prev.map((q) => (q.id === p.id ? { ...q, possible: v } : q)))}
                    className="w-full sm:w-32"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove assignment ${i + 1}`}
                    disabled={points.length <= 1}
                    onClick={() => setPoints((prev) => prev.filter((q) => q.id !== p.id))}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </Button>
                </li>
              ))}
            </ul>
          </ToolPanel>

          <ToolPanel
            title="Your grade"
            footer={pointsResult ? <CopyButton value={summary} label="Copy the result" /> : undefined}
          >
            {pointsResult ? (
              <div className="space-y-4">
                <StatGrid>
                  <ResultStat
                    label="Grade"
                    value={`${formatNumber(pointsResult.percent, 2)}%`}
                    hint={`Letter grade ${letterFor(pointsResult.percent)}`}
                    emphasis
                  />
                  <ResultStat
                    label="Points"
                    value={`${formatNumber(pointsResult.earned, 2)} / ${formatNumber(pointsResult.possible, 2)}`}
                    hint={`${formatNumber(pointsResult.possible - pointsResult.earned, 2)} points dropped`}
                  />
                </StatGrid>
                <ScrollTable>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Assignment</TableHead>
                        <TableHead className="text-right">Score</TableHead>
                        <TableHead className="text-right">Percent</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pointsResult.rows.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="font-medium">{p.name.trim() || 'Assignment'}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatNumber(p.e as number, 2)} / {formatNumber(p.m as number, 2)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatNumber(((p.e as number) / (p.m as number)) * 100, 2)}%
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollTable>
                <Formula caption="Every point counts the same in a points-based class. A 100-point exam matters five times as much as a 20-point quiz.">
                  {`grade = ${formatNumber(pointsResult.earned, 2)} ÷ ${formatNumber(pointsResult.possible, 2)} × 100 = ${formatNumber(pointsResult.percent, 2)}%`}
                </Formula>
              </div>
            ) : (
              <EmptyState message="Enter points earned and points possible for at least one assignment." />
            )}
          </ToolPanel>
        </TabsContent>

        {/* ---------------------------- FINAL ---------------------------- */}
        <TabsContent value="final" className="mt-6 space-y-6">
          <ToolPanel
            title="What do I need on the final?"
            description="Solve for the exam score that gets you to the grade you want."
          >
            <div className="grid gap-4 sm:grid-cols-3">
              <NumField label="Current grade" value={currentGrade} onChange={setCurrentGrade} suffix="%" />
              <NumField
                label="Final is worth"
                value={finalWeight}
                onChange={setFinalWeight}
                suffix="%"
                hint="Of the overall course grade."
              />
              <NumField label="Grade you want" value={targetGrade} onChange={setTargetGrade} suffix="%" />
            </div>
          </ToolPanel>

          <ToolPanel
            title="The score you need"
            footer={needed && !needed.error ? <CopyButton value={summary} label="Copy the answer" /> : undefined}
          >
            {!needed ? (
              <EmptyState message="Fill in all three fields to solve for the final exam score." />
            ) : needed.error ? (
              <Note tone="warning">{needed.error}</Note>
            ) : (
              <div className="space-y-4">
                <StatGrid>
                  <ResultStat
                    label="Score needed on the final"
                    value={`${formatNumber(needed.required, 2)}%`}
                    hint={
                      needed.required > 100
                        ? 'Out of reach without extra credit'
                        : needed.required <= 0
                          ? 'Already secure: even a zero keeps your target'
                          : `To finish the course at ${formatNumber(needed.target, 2)}%`
                    }
                    emphasis
                  />
                  <ResultStat
                    label="Target letter grade"
                    value={letterFor(needed.target)}
                    hint={`${formatNumber(needed.target, 2)}% on the standard scale`}
                  />
                </StatGrid>

                {needed.required > 100 && (
                  <Note tone="warning">
                    {formatNumber(needed.required, 2)}% is above a perfect paper. The best you can
                    finish with is{' '}
                    {formatNumber(needed.cur * (1 - needed.w / 100) + needed.w, 2)}%. Aim for that,
                    or ask about extra credit.
                  </Note>
                )}
                {needed.required <= 0 && (
                  <Note tone="success">
                    You have already done enough. Even a zero on the final leaves you at{' '}
                    {formatNumber(needed.cur * (1 - needed.w / 100), 2)}%.
                  </Note>
                )}

                <Breakdown
                  rows={[
                    { label: 'Grade already banked', value: `${formatNumber(needed.cur * (1 - needed.w / 100), 2)} pts` },
                    { label: 'Points still available from the final', value: `${formatNumber(needed.w, 2)} pts` },
                    { label: 'Points you still need', value: `${formatNumber(needed.target - needed.cur * (1 - needed.w / 100), 2)} pts` },
                  ]}
                />

                <ScrollTable>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>If you score…</TableHead>
                        <TableHead className="text-right">Course grade</TableHead>
                        <TableHead className="text-right">Letter</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {needed.outcomes.map((o) => (
                        <TableRow key={o.score}>
                          <TableCell className="font-medium">{o.score}%</TableCell>
                          <TableCell className="text-right tabular-nums">{formatNumber(o.finalGrade, 2)}%</TableCell>
                          <TableCell className="text-right">{letterFor(o.finalGrade)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollTable>

                <Formula caption="Rearranged from: final grade = current × (1 − w) + exam × w.">
                  {[
                    `needed = (target − current × (1 − w)) ÷ w`,
                    `       = (${formatNumber(needed.target, 2)} − ${formatNumber(needed.cur, 2)} × ${formatNumber(1 - needed.w / 100, 4)}) ÷ ${formatNumber(needed.w / 100, 4)}`,
                    `       = ${formatNumber(needed.required, 2)}%`,
                  ].join('\n')}
                </Formula>
              </div>
            )}
          </ToolPanel>
        </TabsContent>
      </Tabs>

      <ToolPanel title="Standard US letter grade scale" description="Used for every letter shown above.">
        <ScrollTable>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Letter</TableHead>
                <TableHead className="text-right">Percentage</TableHead>
                <TableHead className="text-right">Typical GPA points</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {LETTER_SCALE.map((b, i) => {
                const upper = i === 0 ? 100 : LETTER_SCALE[i - 1].min - 0.01
                const gpa = [4.0, 4.0, 3.7, 3.3, 3.0, 2.7, 2.3, 2.0, 1.7, 1.3, 1.0, 0.7, 0.0][i]
                return (
                  <TableRow key={b.letter}>
                    <TableCell className="font-medium">{b.letter}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {b.letter === 'F' ? 'Below 60' : `${formatNumber(b.min, 0)}–${formatNumber(upper, 2)}`}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{gpa.toFixed(1)}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </ScrollTable>
        <Note>
          Scales vary by school. Some drop the plus/minus grades, and some set an A at 90% flat. Change
          the target percentage above to match your syllabus. {pct(90, 0)} is the most
          common A cut-off outside the plus/minus system.
        </Note>
      </ToolPanel>
    </div>
  )
}
