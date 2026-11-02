import type { Tool } from '../types'

const updated = '2026-11-02'

/** Body composition, heart rate, calories, protein, alcohol. */
export const tools: Tool[] = [
  {
    slug: 'lean-body-mass-calculator',
    title: 'Lean Body Mass Calculator',
    h1: 'Lean body mass calculator',
    description:
      'Lean body mass calculator: estimate lean and fat mass from height and weight with the Boer, James and Hume formulas, or from your body fat percentage.',
    keywords: ['lbm calculator', 'fat free mass calculator', 'boer formula', 'james formula', 'katch mcardle'],
    category: 'health',
    icon: 'PersonStanding',
    faqs: [
      { q: 'What is lean body mass?', a: 'It is your weight minus your fat: muscle, bone, organs, skin and water. A man of 178 cm and 80 kg has about 61 kg of lean mass by the Boer formula.' },
      { q: 'Which lean body mass formula should I use?', a: 'Boer is the default here. James gives values that fall as weight rises above a BMI of about 43 for men and 36 for women. A good body fat measurement gives a better figure than any of the three formulas.' },
      { q: 'What is lean body mass used for?', a: 'It is the input to the Katch-McArdle resting energy equation and to some protein targets. Doctors also use it to dose some drugs.' },
      { q: 'Are my measurements sent anywhere?', a: 'No. The calculator runs in your browser.' },
    ],
    related: ['body-fat-calculator', 'bmr-calculator', 'protein-intake-calculator', 'ideal-weight-calculator'],
    updated,
  },
  {
    slug: 'waist-to-hip-ratio-calculator',
    title: 'Waist to Hip Ratio Calculator',
    h1: 'Waist-to-hip ratio calculator',
    description:
      'Waist to hip ratio calculator: divide your waist by your hip, see your risk band and the WHO cut-offs for men and women, plus your waist-to-height ratio.',
    keywords: ['whr calculator', 'waist hip ratio', 'waist to height ratio', 'abdominal obesity', 'apple pear body shape'],
    category: 'health',
    icon: 'Proportions',
    faqs: [
      { q: 'What is a healthy waist-to-hip ratio?', a: 'The World Health Organization sets a substantially increased risk at 0.90 or more for men and 0.85 or more for women. Below those values is the lower-risk range.' },
      { q: 'How do I measure my waist and hips?', a: 'Measure the waist midway between the lowest rib and the top of the hip bone, after a normal breath out. Measure the hips around the widest part of the buttocks with your feet together. Keep the tape level and snug.' },
      { q: 'Is the waist-to-hip ratio better than BMI?', a: 'It shows where fat sits, which BMI cannot. In a large international study of heart attacks, the waist-to-hip ratio was more closely linked to risk than BMI. The two measures are best used together.' },
      { q: 'Are my measurements sent anywhere?', a: 'No. The ratio is calculated in your browser.' },
    ],
    related: ['bmi-calculator', 'body-fat-calculator', 'army-body-fat-calculator', 'lean-body-mass-calculator'],
    updated,
  },
  {
    slug: 'target-heart-rate-calculator',
    title: 'Target Heart Rate Calculator',
    h1: 'Target heart rate calculator (Karvonen)',
    description:
      'Target heart rate calculator with the Karvonen method: your training heart rate and five heart rate zones from your age, resting heart rate and intensity.',
    keywords: ['karvonen formula', 'heart rate zones', 'max heart rate calculator', 'heart rate reserve', 'training heart rate'],
    category: 'health',
    icon: 'HeartPulse',
    faqs: [
      { q: 'What is a good target heart rate for exercise?', a: 'Exercise guidelines give 40 to 59% of heart rate reserve for moderate exercise and 60 to 89% for vigorous exercise. For a 35-year-old with a resting rate of 62 bpm, 70% is about 148 bpm.' },
      { q: 'Which maximum heart rate formula should I use?', a: '220 − age is the oldest and simplest, but it gives too low a value for many people over 40. Tanaka and Gellish come from larger studies and fit adults of all ages better. A maximum measured in a hard test is better than any formula.' },
      { q: 'What is heart rate reserve?', a: 'It is your maximum heart rate minus your resting heart rate. The Karvonen method takes a share of it, so a fitter person with a lower resting rate gets zones that match their effort better.' },
      { q: 'How do I check my heart rate during exercise?', a: 'Count your pulse at the wrist or neck for 10 seconds and compare it with the 10-second count, or use a chest strap or watch.' },
    ],
    related: ['vo2-max-calculator', 'pace-calculator', 'calories-burned-calculator', 'race-time-predictor'],
    updated,
  },
  {
    slug: 'calories-burned-calculator',
    title: 'Calories Burned Calculator',
    h1: 'Calories burned calculator',
    description:
      'Calories burned calculator for 37 activities, from walking and running to yoga and gardening, with MET values from the Compendium of Physical Activities.',
    keywords: ['exercise calorie calculator', 'met calculator', 'calories burned walking', 'calories burned running', 'activity calories'],
    category: 'health',
    icon: 'Bike',
    faqs: [
      { q: 'What is a MET?', a: 'A metabolic equivalent is the energy cost of an activity as a multiple of sitting at rest. An activity of 4 MET uses four times the energy of rest.' },
      { q: 'How many calories does walking burn?', a: 'A 70 kg person walking briskly at 3.5 mph (5.6 km/h) for 30 minutes burns about 158 kcal. Enter your own weight and time for your figure.' },
      { q: 'Why does a heavier person burn more calories?', a: 'Moving a heavier body takes more energy, so the formula grows in step with weight. At the same MET, 90 kg burns 29% more than 70 kg.' },
      { q: 'Are my numbers sent anywhere?', a: 'No. The calculator runs in your browser.' },
    ],
    related: ['tdee-calculator', 'bmr-calculator', 'weight-loss-calculator', 'pace-calculator'],
    updated,
  },
  {
    slug: 'protein-intake-calculator',
    title: 'Protein Intake Calculator',
    h1: 'Protein intake calculator',
    description:
      'Protein intake calculator: grams of protein a day and per meal from your weight and goal, from the 0.8 g/kg RDA to the ranges for muscle gain and fat loss.',
    keywords: ['protein calculator', 'how much protein per day', 'grams of protein per kg', 'protein for muscle gain', 'daily protein'],
    category: 'health',
    icon: 'Beef',
    faqs: [
      { q: 'How much protein do I need a day?', a: 'The RDA for healthy adults is 0.8 g per kg of body weight, which is 60 g for a 75 kg person. Active people and older adults need more.' },
      { q: 'How much protein do I need to build muscle?', a: 'Most guidance for strength training gives 1.6 to 2.2 g per kg a day. A 2018 review of studies found that muscle gains stopped rising above about 1.6 g per kg.' },
      { q: 'How much protein should be in each meal?', a: 'A 2018 review advises about 0.4 g per kg in each meal, over at least four meals, for muscle growth. For a 75 kg person that is 30 g a meal.' },
      { q: 'Are my numbers sent anywhere?', a: 'No. The calculator runs in your browser.' },
    ],
    related: ['macro-calculator', 'calorie-calculator', 'tdee-calculator', 'lean-body-mass-calculator'],
    updated,
  },
  {
    slug: 'bac-calculator',
    title: 'BAC Calculator',
    h1: 'BAC calculator (blood alcohol content)',
    description:
      'BAC calculator: estimate blood alcohol content with the Widmark formula from your drinks, weight, sex and time, and see when it falls back to zero.',
    keywords: ['blood alcohol calculator', 'blood alcohol content', 'widmark formula', 'how long to sober up', 'standard drinks'],
    category: 'health',
    icon: 'Wine',
    faqs: [
      { q: 'Can I use this to know if I can drive?', a: 'No. It is an estimate for learning only. Real BAC depends on food, absorption, medication and health, and impairment starts below the legal limit. The only safe level for driving is zero.' },
      { q: 'How long does it take for alcohol to leave the body?', a: 'BAC falls by about 0.015% an hour on average, so a BAC of 0.08% takes about 5 hours 20 minutes to reach zero. Coffee, water and a cold shower do not make it fall faster.' },
      { q: 'What is a standard drink?', a: 'In the US it is 14 g of alcohol: about 12 fl oz of 5% beer, 5 fl oz of 12% wine or 1.5 fl oz of 40% spirits. Other countries use other sizes, for example 10 g in Australia.' },
      { q: 'Are my numbers sent anywhere?', a: 'No. The calculator runs in your browser.' },
    ],
    related: ['water-intake-calculator', 'calories-burned-calculator', 'bmi-calculator'],
    updated,
  },
]
