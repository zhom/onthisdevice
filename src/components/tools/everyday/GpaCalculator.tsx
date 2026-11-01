import { useMemo, useRef, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { ResultStat } from '@/components/shared/ResultStat'
import { CopyButton } from '@/components/shared/CopyButton'
import { Formula } from '@/components/shared/Formula'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatNumber } from '@/components/tools/finance/format'
import {
  Breakdown,
  EmptyState,
  NumField,
  Note,
  ScrollTable,
  StatGrid,
  parseNum,
  summaryLines,
} from './common'

interface GradeDef {
  letter: string
  points: number
  plusPoints?: number
}

const GRADES: GradeDef[] = [
  { letter: 'A+', points: 4.0, plusPoints: 4.3 },
  { letter: 'A', points: 4.0 },
  { letter: 'A−', points: 3.7 },
  { letter: 'B+', points: 3.3 },
  { letter: 'B', points: 3.0 },
  { letter: 'B−', points: 2.7 },
  { letter: 'C+', points: 2.3 },
  { letter: 'C', points: 2.0 },
  { letter: 'C−', points: 1.7 },
  { letter: 'D+', points: 1.3 },
  { letter: 'D', points: 1.0 },
  { letter: 'D−', points: 0.7 },
  { letter: 'F', points: 0.0 },
]

type Level = 'regular' | 'honors' | 'ap'

const LEVEL_BONUS: Record<Level, number> = { regular: 0, honors: 0.5, ap: 1.0 }
const LEVEL_LABEL: Record<Level, string> = {
  regular: 'Regular',
  honors: 'Honours',
  ap: 'AP / IB',
}

interface Course {
  id: string
  name: string
  credits: string
  letter: string
  level: Level
}

export default function GpaCalculator() {
  const idRef = useRef(100)
  const nextId = () => `c${idRef.current++}`

  const [courses, setCourses] = useState<Course[]>([
    { id: 'r1', name: 'English Literature', credits: '3', letter: 'A−', level: 'regular' },
    { id: 'r2', name: 'Calculus', credits: '4', letter: 'B+', level: 'ap' },
    { id: 'r3', name: 'Chemistry', credits: '4', letter: 'B', level: 'honors' },
    { id: 'r4', name: 'History', credits: '3', letter: 'A', level: 'regular' },
  ])
  const [aPlusIs43, setAPlusIs43] = useState(false)
  const [priorGpa, setPriorGpa] = useState('3.42')
  const [priorCredits, setPriorCredits] = useState('45')
  const [targetGpa, setTargetGpa] = useState('3.6')
  const [futureCredits, setFutureCredits] = useState('15')

  const pointsFor = (letter: string): number => {
    const g = GRADES.find((x) => x.letter === letter)
    if (!g) return 0
    return aPlusIs43 && g.plusPoints !== undefined ? g.plusPoints : g.points
  }

  const semester = useMemo(() => {
    const rows = courses
      .map((c) => ({ ...c, cr: parseNum(c.credits) }))
      .filter((c) => c.cr !== null && (c.cr as number) > 0)
    if (rows.length === 0) return null
    const credits = rows.reduce((a, c) => a + (c.cr as number), 0)
    const unweightedPoints = rows.reduce((a, c) => a + pointsFor(c.letter) * (c.cr as number), 0)
    const weightedPoints = rows.reduce(
      (a, c) => a + (pointsFor(c.letter) + LEVEL_BONUS[c.level]) * (c.cr as number),
      0,
    )
    return {
      rows,
      credits,
      unweightedPoints,
      weightedPoints,
      unweighted: unweightedPoints / credits,
      weighted: weightedPoints / credits,
      hasBonus: rows.some((c) => LEVEL_BONUS[c.level] > 0),
    }
  }, [aPlusIs43, courses])

  const cumulative = useMemo(() => {
    if (!semester) return null
    const pg = parseNum(priorGpa)
    const pc = parseNum(priorCredits)
    if (pg === null || pc === null || pc <= 0) return null
    const totalCredits = pc + semester.credits
    const totalPoints = pg * pc + semester.unweightedPoints
    return { totalCredits, totalPoints, gpa: totalPoints / totalCredits, pg, pc }
  }, [priorCredits, priorGpa, semester])

  const target = useMemo(() => {
    const t = parseNum(targetGpa)
    const f = parseNum(futureCredits)
    if (t === null || f === null || f <= 0) return null
    const currentCredits = cumulative ? cumulative.totalCredits : semester ? semester.credits : 0
    const currentPoints = cumulative
      ? cumulative.totalPoints
      : semester
        ? semester.unweightedPoints
        : 0
    if (currentCredits <= 0) return null
    const required = (t * (currentCredits + f) - currentPoints) / f
    return { t, f, currentCredits, currentPoints, required, currentGpa: currentPoints / currentCredits }
  }, [cumulative, futureCredits, semester, targetGpa])

  const summary = semester
    ? summaryLines([
        `Semester GPA (unweighted): ${semester.unweighted.toFixed(3)}`,
        semester.hasBonus ? `Semester GPA (weighted): ${semester.weighted.toFixed(3)}` : null,
        `Credits this semester: ${formatNumber(semester.credits, 2)}`,
        cumulative ? `Cumulative GPA: ${cumulative.gpa.toFixed(3)} over ${formatNumber(cumulative.totalCredits, 2)} credits` : null,
        '',
        ...semester.rows.map(
          (c) =>
            `  ${c.name.trim() || 'Course'}: ${c.letter} (${LEVEL_LABEL[c.level]}), ${formatNumber(c.cr as number, 2)} cr, ${(pointsFor(c.letter) + LEVEL_BONUS[c.level]).toFixed(2)} pts`,
        ),
      ])
    : ''

  return (
    <div className="space-y-6">
      <ToolPanel
        title="This semester's courses"
        description="Credits are usually credit hours, units or Carnegie units. Use the number on your transcript."
        footer={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() =>
              setCourses((prev) => [
                ...prev,
                { id: nextId(), name: '', credits: '3', letter: 'A', level: 'regular' },
              ])
            }
          >
            <Plus className="size-4" aria-hidden="true" />
            Add course
          </Button>
        }
      >
        <ul className="space-y-3">
          {courses.map((c, i) => (
            <li key={c.id} className="rounded-lg bg-muted p-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Label htmlFor={`course-${c.id}`}>Course {i + 1}</Label>
                  <Input
                    id={`course-${c.id}`}
                    value={c.name}
                    autoComplete="off"
                    placeholder="Course name"
                    onChange={(e) =>
                      setCourses((prev) => prev.map((q) => (q.id === c.id ? { ...q, name: e.target.value } : q)))
                    }
                  />
                </div>
                <NumField
                  label="Credits"
                  value={c.credits}
                  onChange={(v) => setCourses((prev) => prev.map((q) => (q.id === c.id ? { ...q, credits: v } : q)))}
                  className="w-full sm:w-24"
                />
                <div className="w-full space-y-1.5 sm:w-28">
                  <Label htmlFor={`grade-${c.id}`}>Grade</Label>
                  <Select
                    value={c.letter}
                    onValueChange={(letter) =>
                      setCourses((prev) => prev.map((q) => (q.id === c.id ? { ...q, letter } : q)))
                    }
                  >
                    <SelectTrigger id={`grade-${c.id}`} className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {GRADES.map((g) => (
                        <SelectItem key={g.letter} value={g.letter}>
                          {g.letter}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-full space-y-1.5 sm:w-32">
                  <Label htmlFor={`level-${c.id}`}>Level</Label>
                  <Select
                    value={c.level}
                    onValueChange={(level) =>
                      setCourses((prev) =>
                        prev.map((q) => (q.id === c.id ? { ...q, level: level as Level } : q)),
                      )
                    }
                  >
                    <SelectTrigger id={`level-${c.id}`} className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="regular">Regular</SelectItem>
                      <SelectItem value="honors">Honours (+0.5)</SelectItem>
                      <SelectItem value="ap">AP / IB (+1.0)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove course ${i + 1}`}
                  disabled={courses.length <= 1}
                  onClick={() => setCourses((prev) => prev.filter((q) => q.id !== c.id))}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </Button>
              </div>
            </li>
          ))}
        </ul>

        <div className="flex items-start justify-between gap-3 rounded-lg bg-muted p-3">
          <div className="min-w-0">
            <Label htmlFor="aplus" className="text-sm font-medium">
              Count an A+ as 4.3
            </Label>
            <p className="mt-1 text-xs text-pretty text-muted-foreground">
              Some universities cap every A at 4.0; others award 4.3 for an A+. Match your registrar.
            </p>
          </div>
          <Switch id="aplus" checked={aPlusIs43} onCheckedChange={setAPlusIs43} aria-label="Count an A+ as 4.3" />
        </div>
      </ToolPanel>

      <ToolPanel
        title="Your GPA"
        footer={semester ? <CopyButton value={summary} label="Copy the transcript" /> : undefined}
      >
        {semester ? (
          <div className="space-y-4">
            <StatGrid cols={semester.hasBonus ? 3 : 2}>
              <ResultStat
                label="Semester GPA"
                value={semester.unweighted.toFixed(3)}
                hint={`Unweighted, ${formatNumber(semester.credits, 2)} credits`}
                emphasis
              />
              {semester.hasBonus && (
                <ResultStat
                  label="Weighted GPA"
                  value={semester.weighted.toFixed(3)}
                  hint="With honours and AP bonuses"
                />
              )}
              <ResultStat
                label="Quality points"
                value={formatNumber(semester.unweightedPoints, 2)}
                hint="Credits × grade points, summed"
              />
            </StatGrid>

            <ScrollTable>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Course</TableHead>
                    <TableHead className="text-right">Credits</TableHead>
                    <TableHead className="text-right">Grade</TableHead>
                    <TableHead className="text-right">Points</TableHead>
                    <TableHead className="text-right">Quality points</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {semester.rows.map((c) => {
                    const base = pointsFor(c.letter)
                    const bonus = LEVEL_BONUS[c.level]
                    return (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">
                          {c.name.trim() || 'Course'}
                          {bonus > 0 && (
                            <span className="ml-2 text-xs text-muted-foreground">{LEVEL_LABEL[c.level]}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{formatNumber(c.cr as number, 2)}</TableCell>
                        <TableCell className="text-right">{c.letter}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {base.toFixed(1)}
                          {bonus > 0 ? ` + ${bonus.toFixed(1)}` : ''}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {(base * (c.cr as number)).toFixed(2)}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </ScrollTable>

            <Formula caption="GPA is the credit-weighted mean of your grade points. A 4-credit course moves it twice as much as a 2-credit one.">
              {[
                `GPA = Σ(credits × grade points) ÷ Σ(credits)`,
                `    = ${formatNumber(semester.unweightedPoints, 2)} ÷ ${formatNumber(semester.credits, 2)}`,
                `    = ${semester.unweighted.toFixed(3)}`,
              ].join('\n')}
            </Formula>
          </div>
        ) : (
          <EmptyState message="Add a course with a credit value to see your GPA." />
        )}
      </ToolPanel>

      <ToolPanel
        title="Cumulative GPA"
        description="Add what is already on your transcript to fold this semester into the running total."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <NumField label="GPA before this semester" value={priorGpa} onChange={setPriorGpa} />
          <NumField label="Credits already completed" value={priorCredits} onChange={setPriorCredits} />
        </div>

        {cumulative ? (
          <div className="space-y-4">
            <StatGrid>
              <ResultStat
                label="New cumulative GPA"
                value={cumulative.gpa.toFixed(3)}
                hint={`Across ${formatNumber(cumulative.totalCredits, 2)} credits`}
                emphasis
              />
              <ResultStat
                label="Change this semester"
                value={`${cumulative.gpa >= cumulative.pg ? '+' : ''}${(cumulative.gpa - cumulative.pg).toFixed(3)}`}
                hint={`Was ${cumulative.pg.toFixed(3)}`}
              />
            </StatGrid>
            <Breakdown
              rows={[
                { label: 'Quality points carried in', value: formatNumber(cumulative.pg * cumulative.pc, 2) },
                { label: 'Quality points this semester', value: formatNumber(semester ? semester.unweightedPoints : 0, 2) },
                { label: 'Total credits', value: formatNumber(cumulative.totalCredits, 2) },
                { label: 'Cumulative GPA', value: cumulative.gpa.toFixed(3), strong: true },
              ]}
            />
          </div>
        ) : (
          <EmptyState message="Enter your previous GPA and completed credits to see the cumulative figure." />
        )}
      </ToolPanel>

      <ToolPanel
        title="Target GPA solver"
        description="Work out the average you need in your next courses to reach a goal."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <NumField label="Cumulative GPA you want" value={targetGpa} onChange={setTargetGpa} />
          <NumField label="Credits still to take" value={futureCredits} onChange={setFutureCredits} />
        </div>

        {target ? (
          <div className="space-y-4">
            <StatGrid>
              <ResultStat
                label="GPA needed in those credits"
                value={target.required.toFixed(3)}
                hint={
                  target.required > 4.3
                    ? 'Not reachable on a 4.0 scale'
                    : target.required <= 0
                      ? 'Already achieved'
                      : `Over the next ${formatNumber(target.f, 2)} credits`
                }
                emphasis
              />
              <ResultStat
                label="Where you start from"
                value={target.currentGpa.toFixed(3)}
                hint={`${formatNumber(target.currentCredits, 2)} credits banked`}
              />
            </StatGrid>

            {target.required > 4.0 && (
              <Note tone="warning">
                {target.required.toFixed(3)} is above a straight-A average
                {aPlusIs43 ? ' of 4.3' : ' of 4.0'}. Either take more credits than{' '}
                {formatNumber(target.f, 2)}, or aim at a slightly lower cumulative GPA.
              </Note>
            )}
            {target.required <= 0 && (
              <Note tone="success">
                Your banked credits already carry you past {target.t.toFixed(2)}. Any average above 0.0
                keeps you there.
              </Note>
            )}

            <Formula caption="Solve the cumulative-average equation for the unknown future GPA.">
              {[
                `needed = (target × (banked + future) − banked points) ÷ future`,
                `       = (${target.t.toFixed(2)} × ${formatNumber(target.currentCredits + target.f, 2)} − ${formatNumber(target.currentPoints, 2)}) ÷ ${formatNumber(target.f, 2)}`,
                `       = ${target.required.toFixed(3)}`,
              ].join('\n')}
            </Formula>
          </div>
        ) : (
          <EmptyState message="Enter a target GPA and the credits you have left." />
        )}
      </ToolPanel>

      <ToolPanel title="Grade point reference" description="The 4.0 scale used above.">
        <ScrollTable>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Letter</TableHead>
                <TableHead className="text-right">Standard points</TableHead>
                <TableHead className="text-right">Honours (+0.5)</TableHead>
                <TableHead className="text-right">AP / IB (+1.0)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {GRADES.map((g) => {
                const base = aPlusIs43 && g.plusPoints !== undefined ? g.plusPoints : g.points
                return (
                  <TableRow key={g.letter}>
                    <TableCell className="font-medium">{g.letter}</TableCell>
                    <TableCell className="text-right tabular-nums">{base.toFixed(1)}</TableCell>
                    <TableCell className="text-right tabular-nums">{(base + 0.5).toFixed(1)}</TableCell>
                    <TableCell className="text-right tabular-nums">{(base + 1).toFixed(1)}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </ScrollTable>
        <Note>
          Weighted bonuses are the most common US convention, not a universal rule. Some districts add
          1.0 to honours classes as well, and some cap the weighted GPA at 5.0. The unweighted number
          is the one nearly every university recalculates for itself.
        </Note>
      </ToolPanel>
    </div>
  )
}
