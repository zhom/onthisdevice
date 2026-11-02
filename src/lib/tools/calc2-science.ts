import type { Tool } from './types'

export const tools: Tool[] = [
  {
    slug: 'projectile-motion-calculator',
    title: 'Projectile Motion Calculator',
    h1: 'Projectile motion calculator',
    description:
      'Projectile motion calculator: range, maximum height and time of flight from speed, angle and height, with the path drawn to scale and animated.',
    keywords: ['projectile range', 'trajectory calculator', 'time of flight', 'maximum height', 'launch angle', 'kinematics'],
    category: 'science',
    icon: 'Rocket',
    popular: true,
    faqs: [
      {
        q: 'Which angle gives the longest range?',
        a: 'On flat ground with no air resistance, 45°. Launched from a height, the best angle is a little below 45°, because the body already has extra time to fall.',
      },
      {
        q: 'Does the mass of the object matter?',
        a: 'No. Without air resistance every body falls with the same acceleration, so a bowling ball and a tennis ball launched the same way follow the same path.',
      },
      {
        q: 'Why is the real range shorter than the answer?',
        a: 'Air resistance. It takes speed off the body during the whole flight. For a dense, slow object over a short distance the effect is small; for a fast, light ball it is large.',
      },
      {
        q: 'Is the animation in real time?',
        a: 'Yes when the flight lasts between about 1 and 8 seconds. Shorter or longer flights play slowed down or sped up, and the label under the picture gives the factor.',
      },
    ],
    related: ['free-fall-calculator', 'kinetic-energy-calculator', 'pendulum-calculator', 'speed-converter', 'quadratic-equation-solver'],
    updated: '2026-11-02',
  },
  {
    slug: 'ohms-law-calculator',
    title: "Ohm's Law Calculator",
    h1: "Ohm's law calculator",
    description:
      "Ohm's law calculator: find voltage, current, resistance and power from any two values, with prefixes like kΩ and mA and an animated circuit.",
    keywords: ['voltage calculator', 'current calculator', 'resistance calculator', 'power calculator', 'v=ir', 'watts volts amps ohms'],
    category: 'science',
    icon: 'Zap',
    popular: true,
    faqs: [
      {
        q: "What is Ohm's law?",
        a: 'The voltage across a resistor equals the current through it times its resistance: V = I × R. With the power law P = V × I, any two of voltage, current, resistance and power give the other two.',
      },
      {
        q: 'How do I find the resistor for an LED?',
        a: 'Subtract the LED forward voltage from the supply voltage, then divide by the LED current. For a 5 V supply, a 2 V LED and 20 mA: (5 − 2) ÷ 0.02 = 150 Ω.',
      },
      {
        q: 'What power rating does my resistor need?',
        a: 'At least the power the calculator gives, and in practice about twice that. A resistor that dissipates 0.2 W should be rated at 0.5 W.',
      },
      {
        q: "Does Ohm's law work for AC?",
        a: 'For pure resistors, yes, with RMS voltage and current. With capacitors or inductors in the circuit, the resistance becomes an impedance and the phase between voltage and current matters.',
      },
    ],
    related: ['resistor-color-code-calculator', 'electricity-cost-calculator', 'power-converter', 'energy-converter', 'scientific-notation-converter'],
    updated: '2026-11-02',
  },
  {
    slug: 'resistor-color-code-calculator',
    title: 'Resistor Color Code Calculator',
    h1: 'Resistor color code calculator',
    description:
      'Resistor color code calculator for 4, 5 and 6 band resistors: read the value, tolerance and temperature coefficient, or find the bands for a value.',
    keywords: ['resistor colour code', 'resistor bands', 'resistor value', 'band chart', 'ohm color code', '4 band resistor'],
    category: 'science',
    icon: 'Rows4',
    faqs: [
      {
        q: 'Which end of a resistor do I read from?',
        a: 'From the end with the bands closer to it. The tolerance band, often gold or silver, is at the other end and usually has a wider gap before it.',
      },
      {
        q: 'What is the difference between 4, 5 and 6 band resistors?',
        a: 'A 4 band resistor has two digits, a multiplier and a tolerance. A 5 band resistor has three digits, for 1% and better parts. A 6 band resistor adds a temperature coefficient in ppm per kelvin.',
      },
      {
        q: 'Why does my value round on 4 bands?',
        a: 'Four bands carry only two significant digits. A 4.75 kΩ resistor needs three digits, so it needs 5 bands; on 4 bands the nearest is 4.8 kΩ.',
      },
      {
        q: 'What do gold and silver mean as multipliers?',
        a: 'Gold multiplies by 0.1 and silver by 0.01, for values below 10 Ω. As a tolerance band, gold is ±5% and silver ±10%.',
      },
    ],
    related: ['ohms-law-calculator', 'electricity-cost-calculator', 'scientific-notation-converter', 'rounding-calculator'],
    updated: '2026-11-02',
  },
  {
    slug: 'pendulum-calculator',
    title: 'Pendulum Calculator',
    h1: 'Pendulum calculator',
    description:
      'Pendulum calculator: period and frequency from length and gravity, or the length for a period, with the large-angle correction and a live swing.',
    keywords: ['pendulum period', 'simple pendulum formula', 'pendulum length', 'seconds pendulum', 'period of oscillation', 'harmonic motion'],
    category: 'science',
    icon: 'Timer',
    faqs: [
      {
        q: 'Does the mass of the bob change the period?',
        a: 'No. For a simple pendulum the period depends only on the length and gravity. A heavier bob swings with the same period.',
      },
      {
        q: 'Why does a wide swing take longer?',
        a: 'The formula T = 2π√(L/g) assumes a small angle. At 30° the period is 1.7% longer, at 90° it is 18% longer. The calculator uses the exact value for the amplitude you enter.',
      },
      {
        q: 'How long is a pendulum that ticks once a second?',
        a: 'A seconds pendulum has a 2 s period, one second each way. On Earth that needs a length of about 0.994 m.',
      },
      {
        q: 'Is the animation in real time?',
        a: 'Yes when the period is between about half a second and six seconds. Very short or very long pendulums play slowed down or sped up, and the label under the picture says by how much.',
      },
    ],
    related: ['free-fall-calculator', 'projectile-motion-calculator', 'kinetic-energy-calculator', 'square-root-calculator'],
    updated: '2026-11-02',
  },
  {
    slug: 'free-fall-calculator',
    title: 'Free Fall Calculator',
    h1: 'Free fall calculator',
    description:
      'Free fall calculator: fall time, impact speed and distance from a height or a time, on Earth or other worlds, with a timed drop shown to scale.',
    keywords: ['falling object calculator', 'fall time', 'impact velocity', 'drop height', 'acceleration due to gravity', 'how long to fall'],
    category: 'science',
    icon: 'ArrowDownToLine',
    faqs: [
      {
        q: 'How long does it take to fall 100 m?',
        a: 'Without air resistance, 4.52 s, reaching 44.3 m/s (159 km/h). A real person reaches only about 53 m/s at terminal velocity, after a much longer fall.',
      },
      {
        q: 'Do heavy objects fall faster?',
        a: 'Not in a vacuum: all bodies fall with the same acceleration. In air, a light object with a large surface, such as a feather, is slowed much more.',
      },
      {
        q: 'Why are the ghost images further apart lower down?',
        a: 'They are taken at equal time steps. The body speeds up as it falls, so it covers more distance in each step: the gaps grow as 1, 3, 5, 7.',
      },
      {
        q: 'When is air resistance important?',
        a: 'For falls of more than a few metres, or for light objects. A dropped ball is close to the calculated values for the first second or two.',
      },
    ],
    related: ['projectile-motion-calculator', 'kinetic-energy-calculator', 'pendulum-calculator', 'speed-converter'],
    updated: '2026-11-02',
  },
  {
    slug: 'kinetic-energy-calculator',
    title: 'Kinetic Energy Calculator',
    h1: 'Kinetic energy calculator',
    description:
      'Kinetic energy calculator: KE = ½mv² from mass and speed, or the mass or speed for an energy, in joules, kJ, kWh and calories, with an energy curve.',
    keywords: ['ke calculator', 'kinetic energy formula', '1/2 mv2', 'energy of moving object', 'joules calculator', 'velocity from energy'],
    category: 'science',
    icon: 'Gauge',
    faqs: [
      {
        q: 'Why does doubling the speed give four times the energy?',
        a: 'Kinetic energy grows with the square of the speed. At 2v it is ½m(2v)² = 4 × ½mv². This is why braking distance grows so fast with speed.',
      },
      {
        q: 'What units does the formula use?',
        a: 'Mass in kilograms and speed in metres per second give joules. The calculator converts other units first and shows the energy in J, kJ, kWh and kcal.',
      },
      {
        q: 'How much energy does a car at motorway speed have?',
        a: 'A 1,500 kg car at 110 km/h (30.6 m/s) has about 700 kJ, the same as lifting it 48 m straight up.',
      },
      {
        q: 'Is this the relativistic kinetic energy?',
        a: 'No. ½mv² is correct to better than 1% below about a tenth of the speed of light, which covers everything outside particle physics.',
      },
    ],
    related: ['projectile-motion-calculator', 'free-fall-calculator', 'energy-converter', 'speed-converter', 'weight-converter'],
    updated: '2026-11-02',
  },
  {
    slug: 'half-life-calculator',
    title: 'Half-Life Calculator',
    h1: 'Half-life calculator',
    description:
      'Half-life calculator: remaining amount, starting amount, elapsed time or half-life of a decay, with carbon-14 presets and particles that decay live.',
    keywords: ['radioactive decay calculator', 'carbon dating calculator', 'decay constant', 'exponential decay', 'half life formula', 'remaining quantity'],
    category: 'science',
    icon: 'Atom',
    faqs: [
      {
        q: 'What is a half-life?',
        a: 'The time in which half of a radioactive substance decays. After one half-life 50% is left, after two 25%, after three 12.5%, and so on.',
      },
      {
        q: 'How does carbon dating use this?',
        a: 'Living things keep a fixed level of carbon-14. After death it decays with a half-life of 5,730 years, so the fraction left gives the age: 25% left means about 11,460 years.',
      },
      {
        q: 'Why do the particles not decay exactly on the curve?',
        a: 'Decay is random. Each particle has the same chance to decay in each moment, so a few hundred particles follow the curve only on average. Large samples follow it closely.',
      },
      {
        q: 'Does the half-life work for drugs too?',
        a: 'Yes, for drugs that the body clears at a rate in proportion to the amount, which is most of them. Enter the drug’s elimination half-life.',
      },
    ],
    related: ['scientific-notation-converter', 'exponent-and-log-calculator', 'time-converter', 'molar-mass-calculator'],
    updated: '2026-11-02',
  },
  {
    slug: 'ideal-gas-law-calculator',
    title: 'Ideal Gas Law Calculator',
    h1: 'Ideal gas law calculator',
    description:
      'Ideal gas law calculator: solve PV = nRT for pressure, volume, moles or temperature in kPa, atm, psi, litres and °C, with a box of moving particles.',
    keywords: ['pv=nrt calculator', 'gas pressure calculator', 'molar volume', 'gas constant', 'boyles law', 'charles law'],
    category: 'science',
    icon: 'Wind',
    faqs: [
      {
        q: 'What value of R does the calculator use?',
        a: 'R = 8.314462618 J/(mol·K), the exact value since the 2019 SI. The calculator converts every unit to pascals, cubic metres and kelvin first.',
      },
      {
        q: 'Why must the temperature be in kelvin?',
        a: 'The law needs absolute temperature, which starts at absolute zero. You can enter °C or °F; the calculator adds 273.15 to Celsius before it uses the value.',
      },
      {
        q: 'What is the volume of one mole of gas?',
        a: 'At 0 °C and 1 atm, 22.414 L. At 25 °C and 1 atm, 24.465 L.',
      },
      {
        q: 'When does a real gas differ from the ideal gas law?',
        a: 'At high pressure and low temperature, near the point where the gas would liquefy. At room conditions, air and most common gases are within about 1% of the ideal values.',
      },
    ],
    related: ['pressure-converter', 'temperature-converter', 'volume-converter', 'molar-mass-calculator', 'molarity-calculator'],
    updated: '2026-11-02',
  },
  {
    slug: 'gear-ratio-calculator',
    title: 'Gear Ratio Calculator',
    h1: 'Gear ratio calculator',
    description:
      'Gear ratio calculator: output speed and torque from the teeth on the driver and driven gears, with an optional idler and meshing gears that turn.',
    keywords: ['gear ratio', 'rpm calculator', 'gear torque', 'gear reduction', 'teeth ratio', 'speed reducer'],
    category: 'science',
    icon: 'Cog',
    faqs: [
      {
        q: 'How is the gear ratio worked out?',
        a: 'Divide the teeth on the driven gear by the teeth on the driver gear. A 20 tooth gear driving a 60 tooth gear gives 60 ÷ 20 = 3, written 3 : 1.',
      },
      {
        q: 'What does a ratio of 3 : 1 do?',
        a: 'The output turns three times slower and, apart from friction, with three times the torque. Power stays the same: speed goes down as torque goes up.',
      },
      {
        q: 'What does an idler gear do?',
        a: 'It reverses the direction of the output so it turns the same way as the input. Its own number of teeth has no effect on the ratio.',
      },
      {
        q: 'Is the animation at real speed?',
        a: 'Only when the gears turn slowly enough to see. Faster gears play slowed down by a round factor, which the label under the drawing gives.',
      },
    ],
    related: ['ratio-calculator', 'tire-size-calculator', 'gcd-lcm-calculator', 'power-converter'],
    updated: '2026-11-02',
  },
  {
    slug: 'density-calculator',
    title: 'Density Calculator',
    h1: 'Density calculator',
    description:
      'Density calculator: find density, mass or volume with ρ = m/V in kg/m³, g/cm³ or lb/ft³, compare common materials and see if the object floats.',
    keywords: ['density formula', 'mass volume density', 'specific gravity', 'material density', 'will it float', 'g/cm3 to kg/m3'],
    category: 'science',
    icon: 'Box',
    faqs: [
      {
        q: 'What is the formula for density?',
        a: 'Density is mass divided by volume: ρ = m ÷ V. Rearranged, m = ρ × V and V = m ÷ ρ.',
      },
      {
        q: 'How do I know if something floats?',
        a: 'It floats when its average density is below the liquid’s. In fresh water at 1,000 kg/m³, ice at 917 kg/m³ floats with 91.7% under the surface; steel sinks.',
      },
      {
        q: 'How do I convert g/cm³ to kg/m³?',
        a: 'Multiply by 1,000. Water is 1 g/cm³, which is 1,000 kg/m³ and also 1 kg/L.',
      },
      {
        q: 'What is specific gravity?',
        a: 'The density of a material divided by the density of water. Aluminium at 2,700 kg/m³ has a specific gravity of 2.7.',
      },
    ],
    related: ['volume-calculator', 'weight-converter', 'volume-converter', 'molar-mass-calculator', 'ideal-gas-law-calculator'],
    updated: '2026-11-02',
  },
  {
    slug: 'molarity-calculator',
    title: 'Molarity Calculator',
    h1: 'Molarity calculator',
    description:
      'Molarity calculator: concentration in mol/L from mass, molar mass and volume, the grams needed for a solution, and dilutions with M₁V₁ = M₂V₂.',
    keywords: ['molar concentration', 'dilution calculator', 'm1v1=m2v2', 'grams to molarity', 'solution preparation', 'mol/l calculator'],
    category: 'science',
    icon: 'FlaskConical',
    faqs: [
      {
        q: 'What is molarity?',
        a: 'The number of moles of solute in one litre of solution, in mol/L, written M. A 1 M sodium chloride solution has 58.44 g of NaCl in each litre.',
      },
      {
        q: 'How many grams do I need for a solution?',
        a: 'Multiply the molarity by the volume in litres and by the molar mass. For 250 mL of 0.5 M NaCl: 0.5 × 0.25 × 58.44 = 7.31 g.',
      },
      {
        q: 'How does dilution work?',
        a: 'Adding solvent does not change the moles of solute, so M₁V₁ = M₂V₂. To make 200 mL of 0.5 M from a 1 M stock, take 100 mL of stock and fill up to 200 mL.',
      },
      {
        q: 'Is the volume of the solvent or the solution?',
        a: 'Of the finished solution. Dissolve the solute in less solvent, then fill up to the mark.',
      },
    ],
    related: ['molar-mass-calculator', 'ideal-gas-law-calculator', 'density-calculator', 'ratio-calculator'],
    updated: '2026-11-02',
  },
  {
    slug: 'molar-mass-calculator',
    title: 'Molar Mass Calculator',
    h1: 'Molar mass calculator',
    description:
      'Molar mass calculator: type a chemical formula with brackets or hydrates and get g/mol, atoms per element and mass percent from IUPAC atomic weights.',
    keywords: ['molecular weight calculator', 'formula mass', 'g/mol calculator', 'mass percent composition', 'atomic weight', 'periodic table'],
    category: 'science',
    icon: 'Hexagon',
    popular: true,
    faqs: [
      {
        q: 'How do I type a hydrate?',
        a: 'Join the parts with a dot, a star or a full stop: CuSO4·5H2O, CuSO4*5H2O and CuSO4.5H2O all give 249.68 g/mol.',
      },
      {
        q: 'Which atomic weights are used?',
        a: 'The IUPAC abridged standard atomic weights. For elements that have no stable isotopes, the mass number of the longest-lived isotope is used, and the result says so.',
      },
      {
        q: 'Are capital letters important?',
        a: 'Yes. Co is cobalt, CO is carbon monoxide. Each element symbol starts with a capital letter and has at most one lower-case letter.',
      },
      {
        q: 'What is mass percent?',
        a: 'The share of the molar mass that comes from one element. In water, oxygen is 15.999 of 18.015 g/mol, which is 88.8%.',
      },
    ],
    related: ['molarity-calculator', 'ideal-gas-law-calculator', 'density-calculator', 'half-life-calculator'],
    updated: '2026-11-02',
  },
]
