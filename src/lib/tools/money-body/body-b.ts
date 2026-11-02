import type { Tool } from '../types'

const updated = '2026-11-02'

/** Pregnancy, body surface area, running, weight loss, Army body fat, VO2 max. */
export const tools: Tool[] = [
  {
    slug: 'pregnancy-week-calculator',
    title: 'Pregnancy Week Calculator',
    h1: 'Pregnancy week calculator: how many weeks pregnant am I?',
    description:
      'Pregnancy week calculator: find how many weeks and days pregnant you are from your last period or due date, with your trimester and the usual scan weeks.',
    keywords: ['how many weeks pregnant am i', 'weeks pregnant calculator', 'gestational age calculator', 'trimester calculator', 'pregnancy weeks'],
    category: 'health',
    icon: 'Baby',
    faqs: [
      { q: 'How are pregnancy weeks counted?', a: 'From the first day of the last period, about two weeks before conception. At conception you are already about 2 weeks pregnant, and a full pregnancy is 40 weeks.' },
      { q: 'When does each trimester start?', a: 'The first trimester is weeks 0 to 13. The second starts at week 14 and the third at week 28.' },
      { q: 'What if my cycle is not 28 days?', a: 'Enter your cycle length. Each day over 28 moves the start of the count and the due date one day later. Each day under 28 moves them one day earlier.' },
      { q: 'Is my date sent anywhere?', a: 'No. The calculator runs in your browser.' },
    ],
    related: ['pregnancy-due-date-calculator', 'conception-date-calculator', 'ovulation-calculator'],
    updated,
  },
  {
    slug: 'body-surface-area-calculator',
    title: 'Body Surface Area Calculator',
    h1: 'Body surface area calculator (BSA)',
    description:
      'Body surface area calculator: BSA in m² from height and weight with the Mosteller, Du Bois, Haycock, Gehan and George, Boyd and Fujimoto formulas.',
    keywords: ['bsa calculator', 'mosteller formula', 'du bois formula', 'body surface area formula', 'bsa m2'],
    category: 'health',
    icon: 'PersonStanding',
    faqs: [
      { q: 'Which body surface area formula should I use?', a: 'Mosteller is widely used because it is simple. Du Bois is the oldest and is also common. For most adults the six formulas agree within a few percent. If your clinic uses one formula, use that one.' },
      { q: 'What is a normal body surface area?', a: 'About 1.9 m² is often given as the average for adult men and about 1.6 m² for adult women.' },
      { q: 'What is body surface area used for?', a: 'Doctors use it to scale some drug doses, such as chemotherapy, and to scale measures such as kidney function and cardiac output to body size.' },
      { q: 'Are my numbers sent anywhere?', a: 'No. The calculation runs in your browser.' },
    ],
    related: ['bmi-calculator', 'ideal-weight-calculator', 'lean-body-mass-calculator', 'body-fat-calculator'],
    updated,
  },
  {
    slug: 'race-time-predictor',
    title: 'Race Time Predictor',
    h1: 'Race time predictor (Riegel formula)',
    description:
      'Race time predictor: predict your mile, 5K, 10K, half marathon and marathon times from one race result with the Riegel formula, with pace and splits.',
    keywords: ['marathon time predictor', 'riegel formula', 'half marathon time predictor', '5k to marathon time', 'running time calculator'],
    category: 'health',
    icon: 'Timer',
    faqs: [
      { q: 'How accurate is the Riegel formula?', a: 'It works best between races of similar length and for runners who train for the longer race. From a 5K time, many runners run a marathon slower than the prediction.' },
      { q: 'What exponent should I use?', a: '1.06 is the standard value. Use a higher value, such as 1.08, for a more cautious prediction of a long race.' },
      { q: 'Which race result should I enter?', a: 'A recent race that you ran at full effort, as close as possible in distance to the race you want to predict.' },
      { q: 'Are my times stored?', a: 'No. The prediction is calculated in your browser.' },
    ],
    related: ['pace-calculator', 'vo2-max-calculator', 'target-heart-rate-calculator', 'calories-burned-calculator'],
    updated,
  },
  {
    slug: 'weight-loss-calculator',
    title: 'Weight Loss Calculator',
    h1: 'Weight loss calculator: when will I reach my goal?',
    description:
      'Weight loss calculator: find your goal date and daily calorie target from your weight, height, age, activity and pace, with a week-by-week weight curve.',
    keywords: ['weight loss date calculator', 'goal weight calculator', 'calorie deficit calculator', 'how long to lose weight', 'weight loss planner'],
    category: 'health',
    icon: 'TrendingDown',
    faqs: [
      { q: 'Why does weight loss slow down?', a: 'A lighter body burns fewer calories. If you keep eating the same amount, the daily deficit gets smaller as you lose weight, so each week you lose a little less.' },
      { q: 'How fast should I lose weight?', a: 'Many guidelines suggest about 0.5 to 1 kg (1 to 2 lb) a week. The calculator warns you when the pace is more than 1% of your body weight a week or the intake is very low.' },
      { q: 'How many calories are in a kilogram of body weight?', a: 'The calculator uses 7,700 kcal per kilogram, about 3,500 kcal per pound. This is a rule of thumb.' },
      { q: 'Are my numbers sent anywhere?', a: 'No. The calculation runs in your browser.' },
    ],
    related: ['tdee-calculator', 'calorie-calculator', 'bmr-calculator', 'ideal-weight-calculator'],
    updated,
  },
  {
    slug: 'army-body-fat-calculator',
    title: 'Army Body Fat Calculator',
    h1: 'Army body fat calculator (one-site tape test)',
    description:
      'Army body fat calculator: the 2023 one-site tape test or the older neck and waist method, checked against the Army maximum for your age and sex.',
    keywords: ['army tape test calculator', 'army body composition', 'ar 600-9 calculator', 'one site tape test', 'army body fat standards'],
    category: 'health',
    icon: 'Shield',
    faqs: [
      { q: 'What is the Army one-site tape test?', a: 'Since 2023 the Army estimates body fat from body weight and one tape measurement around the abdomen at the navel (Army Directive 2023-11). It replaced the neck and waist method.' },
      { q: 'What is the Army body fat maximum?', a: 'For men it is 20% at ages 17 to 20, 22% at 21 to 27, 24% at 28 to 39 and 26% at 40 and over. For women it is 30%, 32%, 34% and 36%.' },
      { q: 'Who has to take the tape test?', a: 'Soldiers who weigh more than the screening table weight for their height, age and sex.' },
      { q: 'Are my measurements sent anywhere?', a: 'No. The calculation runs in your browser.' },
    ],
    related: ['body-fat-calculator', 'bmi-calculator', 'waist-to-hip-ratio-calculator', 'lean-body-mass-calculator'],
    updated,
  },
  {
    slug: 'vo2-max-calculator',
    title: 'VO2 Max Calculator',
    h1: 'VO2 max calculator',
    description:
      'VO2 max calculator: estimate VO2 max from the Cooper 12-minute run, a 1.5-mile run, the Rockport walk or your heart rates, with a fitness rating by age.',
    keywords: ['vo2 max test', 'cooper test calculator', 'rockport walk test', 'aerobic fitness calculator', 'vo2max estimate'],
    category: 'health',
    icon: 'HeartPulse',
    faqs: [
      { q: 'What is a good VO2 max?', a: 'It depends on age and sex. For men aged 30 to 39, 41 to 45 ml/kg/min is good and 45 to 49.5 is excellent. For women of the same age, 31.5 to 35.7 is good.' },
      { q: 'Which test should I use?', a: 'Use a run test if you can run hard for 12 minutes or 1.5 miles. The walk test suits beginners. The heart rate ratio needs no exercise, but it works best with a measured maximum heart rate.' },
      { q: 'What is a MET?', a: 'One MET is the oxygen use at rest, 3.5 ml/kg/min. A VO2 max of 42 ml/kg/min is 12 METs.' },
      { q: 'Are my results sent anywhere?', a: 'No. The calculation runs in your browser.' },
    ],
    related: ['target-heart-rate-calculator', 'race-time-predictor', 'pace-calculator', 'calories-burned-calculator'],
    updated,
  },
]
