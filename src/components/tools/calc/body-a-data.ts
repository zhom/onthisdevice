/**
 * Data tables for the body-a calculators (calories burned).
 * MET values and codes from the 2011 Compendium of Physical Activities
 * (Ainsworth et al., Med Sci Sports Exerc 2011;43(8):1575-81, supplement).
 */

export type ActivityGroup = 'Walking' | 'Running' | 'Cycling' | 'Swimming' | 'Gym and classes' | 'Sports' | 'Home and garden'

export interface MetActivity {
  id: string
  label: string
  /** Name for charts. */
  short: string
  group: ActivityGroup
  met: number
  /** Compendium activity code. */
  code: string
}

export const MET_ACTIVITIES: MetActivity[] = [
  { id: 'walk-slow', label: 'Walking, 2 mph (3.2 km/h), slow', short: 'Walking, slow', group: 'Walking', met: 2.8, code: '17152' },
  { id: 'walk-moderate', label: 'Walking, 3 mph (4.8 km/h), moderate', short: 'Walking, moderate', group: 'Walking', met: 3.5, code: '17190' },
  { id: 'walk-brisk', label: 'Walking, 3.5 mph (5.6 km/h), brisk', short: 'Walking, brisk', group: 'Walking', met: 4.3, code: '17200' },
  { id: 'walk-very-brisk', label: 'Walking, 4 mph (6.4 km/h), very brisk', short: 'Walking, very brisk', group: 'Walking', met: 5.0, code: '17220' },
  { id: 'hiking', label: 'Hiking, cross country', short: 'Hiking', group: 'Walking', met: 6.0, code: '17080' },
  { id: 'stairs', label: 'Stair climbing, fast', short: 'Stair climbing', group: 'Walking', met: 8.8, code: '17134' },
  { id: 'run-5', label: 'Running, 5 mph (8 km/h), 12 min/mile', short: 'Running, 5 mph', group: 'Running', met: 8.3, code: '12030' },
  { id: 'run-6', label: 'Running, 6 mph (9.7 km/h), 10 min/mile', short: 'Running, 6 mph', group: 'Running', met: 9.8, code: '12050' },
  { id: 'run-7', label: 'Running, 7 mph (11.3 km/h), 8.5 min/mile', short: 'Running, 7 mph', group: 'Running', met: 11.0, code: '12070' },
  { id: 'run-8', label: 'Running, 8 mph (12.9 km/h), 7.5 min/mile', short: 'Running, 8 mph', group: 'Running', met: 11.8, code: '12090' },
  { id: 'run-10', label: 'Running, 10 mph (16.1 km/h), 6 min/mile', short: 'Running, 10 mph', group: 'Running', met: 14.5, code: '12120' },
  { id: 'cycle-leisure', label: 'Cycling, 10-11.9 mph (16-19 km/h), light', short: 'Cycling, light', group: 'Cycling', met: 6.8, code: '01020' },
  { id: 'cycle-moderate', label: 'Cycling, 12-13.9 mph (19-22 km/h), moderate', short: 'Cycling, moderate', group: 'Cycling', met: 8.0, code: '01030' },
  { id: 'cycle-fast', label: 'Cycling, 14-15.9 mph (22.5-25.5 km/h), fast', short: 'Cycling, fast', group: 'Cycling', met: 10.0, code: '01040' },
  { id: 'cycle-stationary', label: 'Stationary bike, 90-100 watts', short: 'Stationary bike', group: 'Cycling', met: 6.8, code: '02012' },
  { id: 'swim-leisure', label: 'Swimming, leisurely, not laps', short: 'Swimming, leisurely', group: 'Swimming', met: 6.0, code: '18310' },
  { id: 'swim-slow', label: 'Swimming laps, freestyle, slow', short: 'Swimming laps, slow', group: 'Swimming', met: 5.8, code: '18240' },
  { id: 'swim-fast', label: 'Swimming laps, freestyle, fast', short: 'Swimming laps, fast', group: 'Swimming', met: 9.8, code: '18230' },
  { id: 'weights', label: 'Weight training, 8-15 reps, several exercises', short: 'Weight training', group: 'Gym and classes', met: 3.5, code: '02054' },
  { id: 'weights-hard', label: 'Weight training, power lifting or body building', short: 'Weight training, hard', group: 'Gym and classes', met: 6.0, code: '02050' },
  { id: 'circuit', label: 'Circuit training, vigorous', short: 'Circuit training', group: 'Gym and classes', met: 8.0, code: '02040' },
  { id: 'elliptical', label: 'Elliptical trainer, moderate', short: 'Elliptical trainer', group: 'Gym and classes', met: 5.0, code: '02048' },
  { id: 'rowing', label: 'Rowing machine, 100 watts', short: 'Rowing machine', group: 'Gym and classes', met: 7.0, code: '02072' },
  { id: 'jump-rope', label: 'Jumping rope, 100-120 skips/min', short: 'Jumping rope', group: 'Gym and classes', met: 11.8, code: '15551' },
  { id: 'yoga', label: 'Yoga, Hatha', short: 'Yoga', group: 'Gym and classes', met: 2.5, code: '02150' },
  { id: 'pilates', label: 'Pilates', short: 'Pilates', group: 'Gym and classes', met: 3.0, code: '02105' },
  { id: 'aerobics', label: 'Aerobics, low impact', short: 'Aerobics', group: 'Gym and classes', met: 5.0, code: '03020' },
  { id: 'dancing', label: 'Dancing, general (disco, folk, line)', short: 'Dancing', group: 'Gym and classes', met: 7.8, code: '03031' },
  { id: 'basketball', label: 'Basketball, general', short: 'Basketball', group: 'Sports', met: 6.5, code: '15055' },
  { id: 'soccer', label: 'Soccer, casual', short: 'Soccer', group: 'Sports', met: 7.0, code: '15610' },
  { id: 'tennis', label: 'Tennis, singles', short: 'Tennis', group: 'Sports', met: 8.0, code: '15690' },
  { id: 'golf', label: 'Golf, walking and pulling clubs', short: 'Golf', group: 'Sports', met: 5.3, code: '15285' },
  { id: 'volleyball', label: 'Volleyball, casual', short: 'Volleyball', group: 'Sports', met: 3.0, code: '15720' },
  { id: 'cleaning', label: 'House cleaning, moderate', short: 'House cleaning', group: 'Home and garden', met: 3.3, code: '05030' },
  { id: 'gardening', label: 'Gardening, moderate', short: 'Gardening', group: 'Home and garden', met: 3.8, code: '08245' },
  { id: 'mowing', label: 'Mowing the lawn, walking, power mower', short: 'Mowing the lawn', group: 'Home and garden', met: 5.0, code: '08120' },
  { id: 'snow', label: 'Shoveling snow by hand, moderate', short: 'Shoveling snow', group: 'Home and garden', met: 5.3, code: '08195' },
]

export const ACTIVITY_GROUPS: ActivityGroup[] = ['Walking', 'Running', 'Cycling', 'Swimming', 'Gym and classes', 'Sports', 'Home and garden']

/** Light to vigorous activities shown next to the chosen one. */
export const MET_SPREAD = ['yoga', 'walk-brisk', 'weights-hard', 'cycle-moderate', 'run-6', 'jump-rope'] as const

export function activityById(id: string): MetActivity {
  return MET_ACTIVITIES.find((a) => a.id === id) ?? MET_ACTIVITIES[2]!
}
