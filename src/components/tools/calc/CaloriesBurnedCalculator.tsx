import { useState } from 'react'
import { BarList } from '@/components/viz'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import { NumberField, UnitToggle, WeightField, useUnitSystem } from '@/components/tools/health/common'
import { metCalories } from './body-math'
import { ACTIVITY_GROUPS, MET_ACTIVITIES, MET_SPREAD, activityById } from './body-a-data'
import type { MetActivity } from './body-a-data'
import { Assumptions, CalcGrid, Formula, Headline, ResultPanel, Stats, num, numUpTo } from './mb-ui'

const kcalText = (n: number) => `${num(n, 0)} kcal`

/** The chosen activity plus the spread, minus the spread entry closest to it, sorted by MET. */
function comparison(chosen: MetActivity): MetActivity[] {
  const spread = MET_SPREAD.map((id) => activityById(id))
  if (spread.some((a) => a.id === chosen.id)) return spread
  const closest = spread.reduce((best, a) => (Math.abs(a.met - chosen.met) < Math.abs(best.met - chosen.met) ? a : best))
  return [...spread.filter((a) => a !== closest), chosen].sort((a, b) => a.met - b.met)
}

export default function CaloriesBurnedCalculator() {
  const [units, setUnits] = useUnitSystem()
  const [activityId, setActivityId] = useState('walk-brisk')
  const [kg, setKg] = useState(70)
  const [minutes, setMinutes] = useState(30)

  const activity = activityById(activityId)
  const ok = kg >= 20 && kg <= 350 && minutes > 0 && minutes <= 1440
  const kcal = ok ? metCalories(activity.met, kg, minutes) : NaN
  const perHour = metCalories(activity.met, kg, 60)
  const net = metCalories(activity.met - 1, kg, minutes)
  const perMin = (activity.met * 3.5 * kg) / 200
  const list = comparison(activity)
  const duration = `${numUpTo(minutes, 1)} min`

  return (
    <CalcGrid
      inputs={
        <>
          <UnitToggle units={units} onChange={setUnits} className="max-w-none" />
          <div className="space-y-1.5">
            <Label htmlFor="cb-activity" className="text-sm">
              Activity
            </Label>
            <Select value={activityId} onValueChange={setActivityId}>
              <SelectTrigger id="cb-activity" className="w-full">
                <SelectValue placeholder="Activity" />
              </SelectTrigger>
              <SelectContent>
                {ACTIVITY_GROUPS.map((g) => (
                  <SelectGroup key={g}>
                    <SelectLabel>{g}</SelectLabel>
                    {MET_ACTIVITIES.filter((a) => a.group === g).map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {num(activity.met, 1)} MET, Compendium code {activity.code}
            </p>
          </div>
          <WeightField id="cb-weight" kg={kg} onChange={setKg} units={units} />
          <NumberField id="cb-minutes" label="Duration" value={minutes} onChange={setMinutes} unit="min" min={1} max={1440} dp={1} step={5} />
        </>
      }
      results={
        <ResultPanel>
          <Headline
            label="Calories burned"
            value={kcal}
            format={kcalText}
            hint={ok ? `${activity.short} for ${duration} at ${num(activity.met, 1)} MET.` : 'Enter a weight and a duration.'}
          />
          <Stats
            cols={2}
            items={[
              { label: 'Per hour', value: ok ? kcalText(perHour) : '–' },
              { label: 'MET', value: num(activity.met, 1), hint: 'times your resting rate' },
              { label: 'Above resting', value: ok ? kcalText(net) : '–', hint: `what you burn on top of rest in ${duration}` },
              { label: 'Per minute', value: ok ? `${num(perMin, 1)} kcal` : '–' },
            ]}
          />
          {ok ? (
            <BarList
              items={list.map((a) => ({ label: a.short, value: metCalories(a.met, kg, minutes), note: `${num(a.met, 1)} MET`, highlight: a.id === activity.id }))}
              formatValue={kcalText}
              columns={['Activity', `kcal in ${duration}`]}
              summary={`In ${duration} at your weight, ${list[0]?.short.toLowerCase()} burns ${kcalText(metCalories(list[0]?.met ?? 0, kg, minutes))} and ${list[list.length - 1]?.short.toLowerCase()} burns ${kcalText(metCalories(list[list.length - 1]?.met ?? 0, kg, minutes))}. ${activity.short} burns ${kcalText(kcal)}.`}
              table
            />
          ) : null}
        </ResultPanel>
      }
      below={
        <div className="space-y-6">
          <Formula
            items={[
              {
                label: 'Calories burned',
                general: 'kcal = MET × 3.5 × kg ÷ 200 × minutes',
                steps: [`kcal = ${num(activity.met, 1)} × 3.5 × ${num(kg, 1)} ÷ 200 × ${numUpTo(minutes, 1)}`],
                result: kcalText(kcal),
              },
              {
                label: 'Above resting',
                general: 'kcal = (MET − 1) × 3.5 × kg ÷ 200 × minutes',
                steps: [`kcal = ${num(activity.met - 1, 1)} × 3.5 × ${num(kg, 1)} ÷ 200 × ${numUpTo(minutes, 1)}`],
                result: kcalText(net),
              },
            ]}
            note="1 MET is 3.5 ml of oxygen per kg per minute, and 1 litre of oxygen is about 5 kcal. The formula uses kilograms; pounds are converted first."
          />
          <Assumptions
            title="Limits"
            items={[
              'MET values are averages for adults from the 2011 Compendium of Physical Activities. Fitness, skill, terrain, wind and rest breaks change the real cost.',
              '1 MET is set at 3.5 ml of oxygen per kg per minute. Many people, most of all older or heavier people, use less than that at rest, so for them the result is too high.',
              'The total includes the energy you would burn at rest in the same time. Use the figure above resting to compare with your food intake.',
              'Fitness watches estimate from heart rate and can differ from this result.',
            ]}
          />
        </div>
      }
    />
  )
}
