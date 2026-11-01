import type { Tool } from './types'

export const tools: Tool[] = [
  {
    slug: 'bmi-calculator',
    title: 'BMI Calculator',
    h1: 'BMI calculator: body mass index in metric or imperial',
    description:
      'BMI calculator: work out your body mass index in kg/cm or lb/ft, and see your category and the healthy weight range for your height.',
    keywords: [
      'body mass index',
      'bmi chart',
      'healthy weight range',
      'bmi metric',
      'bmi imperial',
      'am i overweight',
    ],
    category: 'health',
    icon: 'Scale',
    popular: true,
    faqs: [
      {
        q: 'What is a healthy BMI?',
        a: 'For adults, the WHO puts the healthy range at 18.5 to 24.9. Below 18.5 is classed as underweight, 25 to 29.9 as overweight, and 30 or above as obese. The cut-offs are the same for men and women.',
      },
      {
        q: 'Why does BMI say I am overweight when I am not?',
        a: 'BMI only knows your height and weight, so it cannot tell muscle from fat. Muscular people, sprinters, rowers and rugby players routinely score 26 to 30 with low body fat. If that sounds like you, use a waist measurement or the body fat calculator instead.',
      },
      {
        q: 'Does BMI work for children?',
        a: 'No. Children and teenagers are assessed with age- and sex-specific percentile charts. This calculator uses the fixed adult cut-offs, so it is for adults aged 20 and over.',
      },
      {
        q: 'Should Asian populations use different cut-offs?',
        a: 'The WHO notes that health risk rises at a lower BMI in many Asian populations, and several countries use 23 as the overweight threshold and 27.5 for obesity. The calculator shows both the standard bands and where you sit numerically so you can apply either.',
      },
      {
        q: 'Is my BMI stored or uploaded anywhere?',
        a: 'No. Every number is calculated by JavaScript in your own browser. Nothing is sent to a server and nothing is logged.',
      },
    ],
    related: ['body-fat-calculator', 'ideal-weight-calculator', 'bmr-calculator', 'calorie-calculator'],
    updated: '2026-11-01',
  },
  {
    slug: 'bmr-calculator',
    title: 'BMR Calculator',
    h1: 'BMR calculator: Mifflin-St Jeor, Harris-Benedict and Katch-McArdle',
    description:
      'BMR calculator: estimate your basal metabolic rate with the Mifflin-St Jeor, Harris-Benedict and Katch-McArdle equations side by side.',
    keywords: [
      'basal metabolic rate',
      'mifflin st jeor',
      'harris benedict',
      'katch mcardle',
      'resting metabolic rate',
      'calories at rest',
    ],
    category: 'health',
    icon: 'Flame',
    faqs: [
      {
        q: 'What is the difference between BMR and RMR?',
        a: 'BMR is measured after an overnight fast, lying still in a thermoneutral room, fully rested. RMR is measured under looser conditions and usually lands about 5 to 10 percent higher. These equations predict BMR, and in practice people use the number for both.',
      },
      {
        q: 'Which equation should I use?',
        a: 'Mifflin-St Jeor is the default for most people. It was validated on a modern population and is usually within about 10 percent of measured BMR. If you know your body fat percentage, Katch-McArdle is usually better, because it uses lean mass instead of total weight.',
      },
      {
        q: 'Why is Harris-Benedict higher than Mifflin-St Jeor?',
        a: 'The original Harris-Benedict data was collected in 1919 on a leaner, more active sample, so it tends to over-predict by roughly 5 percent for today’s average adult. The revised 1984 coefficients used here narrow the gap but do not close it.',
      },
      {
        q: 'Can I eat only my BMR calories?',
        a: 'BMR is what your body burns at complete rest. It does not include digestion, walking or exercise. Eating at BMR is a large deficit for most people. Use the TDEE calculator to get a realistic daily target.',
      },
    ],
    related: ['tdee-calculator', 'calorie-calculator', 'body-fat-calculator', 'macro-calculator'],
    updated: '2026-11-01',
  },
  {
    slug: 'tdee-calculator',
    title: 'TDEE Calculator',
    h1: 'TDEE calculator: total daily energy expenditure',
    description:
      'TDEE calculator: find your maintenance calories from your BMR and an activity multiplier, with cut, maintain and bulk targets and the working shown.',
    keywords: [
      'total daily energy expenditure',
      'maintenance calories',
      'activity multiplier',
      'daily calorie needs',
      'how many calories do i burn',
    ],
    category: 'health',
    icon: 'Activity',
    popular: true,
    faqs: [
      {
        q: 'How accurate is a TDEE estimate?',
        a: 'Expect plus or minus 10 to 15 percent. Most of the error comes from the choice of activity multiplier. Treat the number as a starting point, then adjust it after two weeks of real weight data.',
      },
      {
        q: 'Which activity level should I pick?',
        a: 'Most people choose too high a level. Three or four gym sessions a week and a desk job is "lightly active" to "moderately active". "Very active" means hard training six or seven days a week, or a physically demanding job and training.',
      },
      {
        q: 'Should I add my workout calories on top of TDEE?',
        a: 'No. The activity multiplier already includes them. If you add a fitness-tracker burn, you count the same exercise twice. This is the most common reason a "deficit" stops working.',
      },
      {
        q: 'How do I check my real TDEE?',
        a: 'Track intake carefully for two to three weeks and weigh yourself every morning. If the weekly average is flat, your intake is your TDEE. That empirical number beats any equation.',
      },
    ],
    related: ['bmr-calculator', 'calorie-calculator', 'macro-calculator', 'bmi-calculator'],
    updated: '2026-11-01',
  },
  {
    slug: 'calorie-calculator',
    title: 'Calorie Calculator',
    h1: 'Calorie calculator: daily calories to lose, keep or gain weight',
    description:
      'Set a goal weight and a weekly rate, and get your daily calorie target plus a week-by-week timeline showing when you would reach it.',
    keywords: [
      'daily calorie needs',
      'calorie deficit calculator',
      'weight loss calories',
      'how many calories to lose weight',
      'calorie surplus',
    ],
    category: 'health',
    icon: 'Utensils',
    popular: true,
    faqs: [
      {
        q: 'How big should a calorie deficit be?',
        a: 'A deficit of about 0.5 to 1 percent of body weight per week suits most people. For an 80 kg adult that is about 0.4 to 0.8 kg (1 to 1.75 lb). Faster loss costs more lean mass and is much harder to keep up.',
      },
      {
        q: 'Where does the 7,700 kcal per kilogram figure come from?',
        a: 'It is the approximate energy stored in a kilogram of adipose tissue (3,500 kcal per pound). It works well for short horizons, but real loss slows down over time because a lighter body burns fewer calories, which is why the timeline here recalculates each week.',
      },
      {
        q: 'Why did my weight loss stall?',
        a: 'Usually one of three things: your maintenance dropped as you got lighter, portion creep has closed the deficit, or you are holding water after a hard session or a salty meal. Recalculate with your current weight and compare weekly averages instead of daily readings.',
      },
      {
        q: 'Is there a minimum I should not go below?',
        a: 'Intakes below roughly 1,500 kcal for men and 1,200 kcal for women make it hard to get enough protein and micronutrients. The calculator flags it when your target lands there and suggests a slower rate instead.',
      },
    ],
    related: ['tdee-calculator', 'macro-calculator', 'bmr-calculator', 'ideal-weight-calculator'],
    updated: '2026-11-01',
  },
  {
    slug: 'macro-calculator',
    title: 'Macro Calculator',
    h1: 'Macro calculator: protein, carbs and fat in grams',
    description:
      'Macro calculator: split a calorie target into protein, carbs and fat with balanced, low-carb, high-protein or keto presets, in grams and percent.',
    keywords: [
      'macronutrient calculator',
      'iifym',
      'protein carbs fat split',
      'keto macros',
      'macros per meal',
      'flexible dieting',
    ],
    category: 'health',
    icon: 'ChartPie',
    faqs: [
      {
        q: 'How much protein do I need?',
        a: 'For general health, about 0.8 g per kg of body weight is the minimum. To build or keep muscle in a deficit, the evidence supports 1.6 to 2.2 g per kg. The calculator shows where your split is on that scale.',
      },
      {
        q: 'How many calories are in a gram of each macro?',
        a: 'Protein and carbohydrate supply about 4 kcal per gram, fat about 9 kcal per gram, and alcohol about 7 kcal per gram. Those Atwater factors are what turn a percentage split into grams.',
      },
      {
        q: 'What macro split does keto use?',
        a: 'About 70 to 75 percent of calories from fat, 20 to 25 percent from protein and 5 percent or less from carbohydrate. That is usually under 50 g of carbs a day, the level that tends to keep ketosis going.',
      },
      {
        q: 'Do I need to hit my macros exactly every day?',
        a: 'No. Weekly averages matter more than any single day. Most people do well by treating protein as a floor to reach and calories as a ceiling, then letting carbs and fat move around to fit their meals.',
      },
    ],
    related: ['calorie-calculator', 'tdee-calculator', 'bmr-calculator', 'body-fat-calculator', 'one-rep-max-calculator'],
    updated: '2026-11-01',
  },
  {
    slug: 'body-fat-calculator',
    title: 'Body Fat Calculator',
    h1: 'Body fat calculator: US Navy method and BMI estimate',
    description:
      'Estimate body fat percentage from tape measurements with the US Navy formula, cross-check it against the BMI method, and see fat and lean mass.',
    keywords: [
      'body fat percentage',
      'us navy body fat',
      'tape measure body fat',
      'lean body mass',
      'body composition',
      'waist to height',
    ],
    category: 'health',
    icon: 'Percent',
    faqs: [
      {
        q: 'How accurate is the US Navy body fat formula?',
        a: 'Against a DEXA scan it is typically within about 3 to 4 percentage points for people of average build, and less accurate at the extremes. Its strength is consistency: if you measure the same way each time, it tracks change reliably.',
      },
      {
        q: 'Where exactly do I measure?',
        a: 'Neck: just below the larynx, tape sloping slightly down at the front. Waist: at the navel for men, at the narrowest point for women. Hips: at the widest point of the buttocks. Keep the tape snug but not compressing, and measure first thing in the morning.',
      },
      {
        q: 'What is a healthy body fat percentage?',
        a: 'The American Council on Exercise puts the fitness range at 14 to 17 percent for men and 21 to 24 percent for women, with essential fat at 2 to 5 and 10 to 13 percent. Under about 5 percent for men and 12 for women is not sustainable.',
      },
      {
        q: 'Why do the two methods disagree?',
        a: 'The BMI-based Deurenberg estimate only knows height, weight, age and sex, so it reads muscle as fat. The Navy method uses circumferences and reflects where the mass actually sits. If you are muscular, trust the Navy number more.',
      },
    ],
    related: ['bmi-calculator', 'bmr-calculator', 'ideal-weight-calculator', 'macro-calculator'],
    updated: '2026-11-01',
  },
  {
    slug: 'ideal-weight-calculator',
    title: 'Ideal Weight Calculator',
    h1: 'Ideal weight calculator: Devine, Robinson, Miller and Hamwi',
    description:
      'Compare four clinical ideal body weight formulas against the healthy BMI range for your height, in kilograms or pounds, with the maths shown.',
    keywords: [
      'ideal body weight',
      'devine formula',
      'robinson formula',
      'hamwi formula',
      'healthy weight for height',
      'ibw calculator',
    ],
    category: 'health',
    icon: 'Target',
    faqs: [
      {
        q: 'Is there really one ideal weight?',
        a: 'No. These formulas were written for drug dosing and ventilator settings. Use the spread between them and the healthy BMI range as a band, and do not aim for one exact figure.',
      },
      {
        q: 'Which formula is used in hospitals?',
        a: 'Devine (1974) is still the most common in clinical pharmacy for weight-based dosing. Robinson and Miller were later re-fits of the same data set, and Hamwi (1964) is the quick bedside rule dietitians learned.',
      },
      {
        q: 'Do the formulas work if I am under five feet tall?',
        a: 'Not well. All four are anchored at 5 ft (152.4 cm) and subtract a fixed amount per inch below that, which under-predicts. Below 5 ft, the healthy BMI range shown alongside is the more reliable guide.',
      },
      {
        q: 'How do I adjust for frame size?',
        a: 'The Hamwi rule allows plus or minus 10 percent for large or small frames, which this calculator shows as a range. A quick check: put your thumb and middle finger around the opposite wrist. If they overlap, your frame is probably small. If they do not touch, it is probably large.',
      },
    ],
    related: ['bmi-calculator', 'body-fat-calculator', 'calorie-calculator', 'bmr-calculator'],
    updated: '2026-11-01',
  },
  {
    slug: 'water-intake-calculator',
    title: 'Water Intake Calculator',
    h1: 'Water intake calculator: how much water should you drink a day?',
    description:
      'Water intake calculator: estimate how much water to drink a day from body weight, exercise time and climate, in litres, cups or fluid ounces.',
    keywords: [
      'how much water should i drink',
      'daily water intake',
      'hydration calculator',
      'water per kg body weight',
      'ounces of water per day',
    ],
    category: 'health',
    icon: 'Droplets',
    faqs: [
      {
        q: 'Is eight glasses a day right?',
        a: 'It is a convenient slogan with no strong evidence behind it. Needs scale with body size, sweat rate and climate, which is why this calculator starts from 30–40 ml per kg of body weight, depending on age, and then adds for exercise and heat.',
      },
      {
        q: 'Does tea, coffee or food count?',
        a: 'Yes. Roughly 20 to 30 percent of total water intake usually comes from food, and caffeinated drinks in normal amounts are still net hydrating. The figure shown here is total water; the drink-only target subtracts the food share.',
      },
      {
        q: 'How do I tell if I am drinking enough?',
        a: 'Pale straw-coloured urine and no strong thirst are the practical signs. Dark yellow urine, headaches or dizziness after exercise point the other way. Weighing yourself before and after a long session shows exactly how much you lost.',
      },
      {
        q: 'Can you drink too much water?',
        a: 'Yes, though it is rare. Drinking litres per hour well beyond sweat losses can dilute blood sodium (hyponatraemia), which is dangerous. Endurance athletes should drink to thirst and include electrolytes on long efforts.',
      },
    ],
    related: ['calorie-calculator', 'tdee-calculator', 'pace-calculator', 'bmi-calculator'],
    updated: '2026-11-01',
  },
  {
    slug: 'pregnancy-due-date-calculator',
    title: 'Due Date Calculator',
    h1: 'Pregnancy due date calculator',
    description:
      'Estimate your due date from your last period, conception date, IVF transfer or a dating scan, with gestational age, trimesters and milestones.',
    keywords: [
      'due date calculator',
      'pregnancy calculator',
      'naegele rule',
      'gestational age calculator',
      'ivf due date',
      'how many weeks pregnant',
    ],
    category: 'health',
    icon: 'Baby',
    faqs: [
      {
        q: 'How is a due date worked out?',
        a: 'Naegele’s rule adds 280 days (40 weeks) to the first day of your last menstrual period, assuming a 28-day cycle with ovulation on day 14. This calculator adjusts that assumption if your cycle is longer or shorter.',
      },
      {
        q: 'Why does my scan give a different date?',
        a: 'A first-trimester scan measures the embryo directly and is more accurate than a remembered period date. Clinical guidance is to re-date the pregnancy when an early scan differs from the LMP estimate by more than about five to seven days.',
      },
      {
        q: 'How do IVF due dates work?',
        a: 'Because the embryo’s age is known exactly, the due date is the transfer date plus 280 days minus 14 days minus the embryo’s age. That is 261 days after a day-5 blastocyst transfer and 263 after a day-3 transfer.',
      },
      {
        q: 'How likely is the baby to arrive on the due date?',
        a: 'About 4 percent of babies are born on their estimated date. Roughly 80 percent arrive within the two weeks around it, and a first-time pregnancy commonly runs a few days past 40 weeks.',
      },
      {
        q: 'Is anything I type here sent anywhere?',
        a: 'No. The dates stay in your browser tab. They are not uploaded, stored or logged, and closing the tab discards them.',
      },
    ],
    related: ['age-calculator', 'date-calculator', 'water-intake-calculator', 'bmi-calculator'],
    updated: '2026-11-01',
  },
  {
    slug: 'one-rep-max-calculator',
    title: 'One Rep Max Calculator',
    h1: 'One rep max calculator: 1RM from reps and weight',
    description:
      'One rep max calculator: estimate your 1RM from any set with the Epley, Brzycki, Lombardi and O’Conner formulas, with training weights from 50 to 100%.',
    keywords: [
      '1rm calculator',
      'epley formula',
      'brzycki formula',
      'squat bench deadlift max',
      'percentage of 1rm chart',
      'strength training percentages',
    ],
    category: 'health',
    icon: 'Dumbbell',
    faqs: [
      {
        q: 'How many reps give the most accurate estimate?',
        a: 'Sets of two to five reps taken close to failure give the best estimate. Beyond about ten reps the estimate drifts high, because endurance and technique start to matter more than maximal strength.',
      },
      {
        q: 'Which 1RM formula is best?',
        a: 'They agree closely at low reps and give the same result at 10. Below 10 reps Brzycki reads slightly lower than Epley; above 10 it reads higher, and the gap grows quickly. This calculator averages them, so the result does not depend on one model.',
      },
      {
        q: 'Does the same formula work for every lift?',
        a: 'Not equally well. Deadlifts and squats usually track the estimates closely; bench press often comes in a little under, and Olympic lifts are technique-limited enough that rep-based estimates are unreliable.',
      },
      {
        q: 'Should I test a true one rep max?',
        a: 'Rarely. It is fatiguing and carries more risk, especially without a spotter. A hard set of three, run through these formulas, gives the number you need for programming most of the time.',
      },
    ],
    related: ['pace-calculator', 'bmr-calculator', 'macro-calculator', 'body-fat-calculator'],
    updated: '2026-11-01',
  },
  {
    slug: 'pace-calculator',
    title: 'Pace Calculator',
    h1: 'Running pace calculator: pace, time and distance',
    description:
      'Convert running pace, speed, time and distance for 5K, 10K, half and full marathon, with a kilometre or mile split table you can copy.',
    keywords: [
      'running pace calculator',
      'marathon pace chart',
      '5k pace',
      'min per mile to min per km',
      'race time predictor',
      'split times',
    ],
    category: 'health',
    icon: 'Timer',
    faqs: [
      {
        q: 'How do I convert min/km to min/mile?',
        a: 'Multiply the pace in minutes per kilometre by 1.609344. A 5:00/km pace is 8:03/mile; a 6:00/km pace is 9:39/mile. The calculator shows both together.',
      },
      {
        q: 'What pace do I need for a sub-4-hour marathon?',
        a: '5:41 per kilometre, or 9:09 per mile, held for the full 42.195 km. Sub-3 needs 4:16/km (6:52/mile) and a sub-2-hour half needs 5:41/km, the same pace as a four-hour marathon.',
      },
      {
        q: 'How does the race-time prediction work?',
        a: 'It uses Riegel’s formula, T2 = T1 x (D2 / D1) raised to the power 1.06. It is a good guide when the distances are within roughly a factor of four and you have trained for the longer one, and optimistic otherwise.',
      },
      {
        q: 'What is a negative split?',
        a: 'Running the second half of a race faster than the first. It is how most road records are set, and the split table here lets you plan one by aiming a few seconds per kilometre slower than target early on.',
      },
    ],
    related: ['one-rep-max-calculator', 'water-intake-calculator', 'calorie-calculator', 'tdee-calculator'],
    updated: '2026-11-01',
  },
]
