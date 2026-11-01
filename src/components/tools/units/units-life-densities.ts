/**
 * units-life batch — ingredient density table for the kitchen converters.
 *
 * `gramsPerCup` is grams per **US customary cup of 236.6 mL** (half a US pint),
 * the cup US recipes and USDA tables use: 2 sticks of butter = 1 cup = 227 g.
 * Every other cup size, spoon size and
 * fluid ounce is derived from that by volume, so switching the cup standard in
 * the UI stays internally consistent.
 *
 * These are typical values for a normally handled ingredient. Packing, sifting,
 * humidity and grind change flour by 15–20% and brown sugar by up to 45%, which
 * is exactly why a single "1 cup = 128 g" answer is wrong for anything but
 * water. Where the handling matters, the ingredient is listed twice.
 */

export interface Ingredient {
  id: string
  name: string
  group: string
  /** Grams in one US customary cup (236.6 mL). */
  gramsPerCup: number
  /** Optional handling note shown next to the result. */
  note?: string
}

export const CUP_STANDARDS = {
  'us-customary': { id: 'us-customary', label: 'US customary cup (236.6 mL)', ml: 236.5882365 },
  'us-legal': { id: 'us-legal', label: 'US legal cup (240 mL)', ml: 240 },
  metric: { id: 'metric', label: 'Metric cup (250 mL), AU/NZ', ml: 250 },
  imperial: { id: 'imperial', label: 'Imperial cup (284.1 mL), old UK', ml: 284.130625 },
  japanese: { id: 'japanese', label: 'Japanese cup (200 mL)', ml: 200 },
} as const

export type CupStandardId = keyof typeof CUP_STANDARDS

export const SPOONS = {
  'us-tbsp': { label: 'US tablespoon (14.79 mL)', ml: 14.78676478125 },
  'metric-tbsp': { label: 'Metric tablespoon (15 mL)', ml: 15 },
  'au-tbsp': { label: 'Australian tablespoon (20 mL)', ml: 20 },
} as const

export type SpoonId = keyof typeof SPOONS

/** Reference cup used by the gramsPerCup column: the US customary cup. */
export const REFERENCE_CUP_ML = 236.5882365

export const US_FLUID_OUNCE_ML = 29.5735295625
export const IMPERIAL_FLUID_OUNCE_ML = 28.4130625
export const US_TEASPOON_ML = 4.92892159375
export const BUTTER_STICK_GRAMS = 113.3980925 // exactly a quarter pound

export const INGREDIENTS: Ingredient[] = [
  /* Flour and grain */
  { id: 'flour-ap-spooned', name: 'Flour, all-purpose (spooned & levelled)', group: 'Flour & grain', gramsPerCup: 125, note: 'Spoon flour into the cup and level it off. Scooping straight from the bag adds up to 20%.' },
  { id: 'flour-ap-scooped', name: 'Flour, all-purpose (scooped from the bag)', group: 'Flour & grain', gramsPerCup: 145, note: 'Compacted by the scoop. This is why scooped cookies come out dry.' },
  { id: 'flour-bread', name: 'Flour, bread', group: 'Flour & grain', gramsPerCup: 130 },
  { id: 'flour-cake', name: 'Flour, cake', group: 'Flour & grain', gramsPerCup: 115, note: 'Lighter and finer than all-purpose; always sift before measuring by volume.' },
  { id: 'flour-wholewheat', name: 'Flour, whole wheat / wholemeal', group: 'Flour & grain', gramsPerCup: 130 },
  { id: 'flour-selfraising', name: 'Flour, self-raising', group: 'Flour & grain', gramsPerCup: 125 },
  { id: 'flour-rye', name: 'Flour, rye', group: 'Flour & grain', gramsPerCup: 102 },
  { id: 'flour-almond', name: 'Flour, almond', group: 'Flour & grain', gramsPerCup: 96 },
  { id: 'flour-coconut', name: 'Flour, coconut', group: 'Flour & grain', gramsPerCup: 112, note: 'Extremely absorbent. Never substitute it 1:1 for wheat flour.' },
  { id: 'semolina', name: 'Semolina', group: 'Flour & grain', gramsPerCup: 167 },
  { id: 'cornmeal', name: 'Cornmeal / polenta', group: 'Flour & grain', gramsPerCup: 138 },
  { id: 'cornstarch', name: 'Cornstarch / cornflour', group: 'Flour & grain', gramsPerCup: 128 },
  { id: 'oats-rolled', name: 'Oats, rolled', group: 'Flour & grain', gramsPerCup: 90 },
  { id: 'oats-steelcut', name: 'Oats, steel-cut (dry)', group: 'Flour & grain', gramsPerCup: 175 },
  { id: 'rice-white', name: 'Rice, white (uncooked)', group: 'Flour & grain', gramsPerCup: 185 },
  { id: 'rice-brown', name: 'Rice, brown (uncooked)', group: 'Flour & grain', gramsPerCup: 190 },
  { id: 'rice-cooked', name: 'Rice, cooked', group: 'Flour & grain', gramsPerCup: 175 },
  { id: 'quinoa', name: 'Quinoa (uncooked)', group: 'Flour & grain', gramsPerCup: 170 },
  { id: 'couscous', name: 'Couscous (dry)', group: 'Flour & grain', gramsPerCup: 173 },
  { id: 'pasta-dry', name: 'Pasta, dry elbow macaroni', group: 'Flour & grain', gramsPerCup: 105, note: 'Shape changes this a lot. Weigh dry pasta if the recipe matters.' },
  { id: 'pasta-cooked', name: 'Pasta, cooked', group: 'Flour & grain', gramsPerCup: 140 },
  { id: 'breadcrumbs-dry', name: 'Breadcrumbs, dry', group: 'Flour & grain', gramsPerCup: 108 },
  { id: 'panko', name: 'Panko breadcrumbs', group: 'Flour & grain', gramsPerCup: 60 },

  /* Sugar and syrup */
  { id: 'sugar-granulated', name: 'Sugar, granulated (white)', group: 'Sugar & syrup', gramsPerCup: 200 },
  { id: 'sugar-caster', name: 'Sugar, caster / superfine', group: 'Sugar & syrup', gramsPerCup: 200 },
  { id: 'sugar-brown-packed', name: 'Sugar, brown (firmly packed)', group: 'Sugar & syrup', gramsPerCup: 213, note: 'US recipes almost always mean packed. Loose brown sugar is around 145 g per cup.' },
  { id: 'sugar-brown-loose', name: 'Sugar, brown (loose)', group: 'Sugar & syrup', gramsPerCup: 145 },
  { id: 'sugar-powdered', name: 'Sugar, powdered / icing (unsifted)', group: 'Sugar & syrup', gramsPerCup: 120 },
  { id: 'sugar-powdered-sifted', name: 'Sugar, powdered / icing (sifted)', group: 'Sugar & syrup', gramsPerCup: 100 },
  { id: 'sugar-coconut', name: 'Sugar, coconut', group: 'Sugar & syrup', gramsPerCup: 154 },
  { id: 'honey', name: 'Honey', group: 'Sugar & syrup', gramsPerCup: 340, note: 'Weighing honey is far more accurate than trying to scrape a sticky cup clean.' },
  { id: 'maple-syrup', name: 'Maple syrup', group: 'Sugar & syrup', gramsPerCup: 322 },
  { id: 'golden-syrup', name: 'Golden syrup', group: 'Sugar & syrup', gramsPerCup: 340 },
  { id: 'molasses', name: 'Molasses / treacle', group: 'Sugar & syrup', gramsPerCup: 328 },
  { id: 'corn-syrup', name: 'Corn syrup', group: 'Sugar & syrup', gramsPerCup: 328 },
  { id: 'agave', name: 'Agave nectar', group: 'Sugar & syrup', gramsPerCup: 336 },

  /* Fat and dairy */
  { id: 'butter', name: 'Butter', group: 'Fat & dairy', gramsPerCup: 227, note: 'One US stick is half a cup: 113.4 g, or exactly a quarter pound.' },
  { id: 'margarine', name: 'Margarine', group: 'Fat & dairy', gramsPerCup: 227 },
  { id: 'shortening', name: 'Shortening', group: 'Fat & dairy', gramsPerCup: 205 },
  { id: 'oil-vegetable', name: 'Oil, vegetable / canola', group: 'Fat & dairy', gramsPerCup: 218 },
  { id: 'oil-olive', name: 'Oil, olive', group: 'Fat & dairy', gramsPerCup: 216 },
  { id: 'oil-coconut', name: 'Oil, coconut (melted)', group: 'Fat & dairy', gramsPerCup: 218 },
  { id: 'milk-whole', name: 'Milk, whole', group: 'Fat & dairy', gramsPerCup: 244 },
  { id: 'milk-skim', name: 'Milk, skim', group: 'Fat & dairy', gramsPerCup: 245 },
  { id: 'buttermilk', name: 'Buttermilk', group: 'Fat & dairy', gramsPerCup: 245 },
  { id: 'cream-heavy', name: 'Cream, heavy / double', group: 'Fat & dairy', gramsPerCup: 238 },
  { id: 'sour-cream', name: 'Sour cream', group: 'Fat & dairy', gramsPerCup: 240 },
  { id: 'yogurt', name: 'Yogurt, plain', group: 'Fat & dairy', gramsPerCup: 245 },
  { id: 'yogurt-greek', name: 'Yogurt, Greek', group: 'Fat & dairy', gramsPerCup: 260 },
  { id: 'cream-cheese', name: 'Cream cheese', group: 'Fat & dairy', gramsPerCup: 232 },
  { id: 'ricotta', name: 'Ricotta', group: 'Fat & dairy', gramsPerCup: 246 },
  { id: 'cottage-cheese', name: 'Cottage cheese', group: 'Fat & dairy', gramsPerCup: 226 },
  { id: 'condensed-milk', name: 'Milk, sweetened condensed', group: 'Fat & dairy', gramsPerCup: 306 },
  { id: 'evaporated-milk', name: 'Milk, evaporated', group: 'Fat & dairy', gramsPerCup: 252 },
  { id: 'cheddar-grated', name: 'Cheese, cheddar (grated)', group: 'Fat & dairy', gramsPerCup: 113, note: 'Grate size changes this more than anything else on the list.' },
  { id: 'parmesan-grated', name: 'Cheese, parmesan (finely grated)', group: 'Fat & dairy', gramsPerCup: 100 },
  { id: 'mozzarella-shredded', name: 'Cheese, mozzarella (shredded)', group: 'Fat & dairy', gramsPerCup: 112 },

  /* Liquids */
  { id: 'water', name: 'Water', group: 'Liquids', gramsPerCup: 236.6, note: 'The only ingredient where 1 mL really does weigh 1 g.' },
  { id: 'stock', name: 'Stock / broth', group: 'Liquids', gramsPerCup: 240 },
  { id: 'wine', name: 'Wine', group: 'Liquids', gramsPerCup: 235 },
  { id: 'lemon-juice', name: 'Lemon or lime juice', group: 'Liquids', gramsPerCup: 244 },
  { id: 'vinegar', name: 'Vinegar', group: 'Liquids', gramsPerCup: 239 },
  { id: 'coffee-brewed', name: 'Coffee, brewed', group: 'Liquids', gramsPerCup: 237 },
  { id: 'soy-sauce', name: 'Soy sauce', group: 'Liquids', gramsPerCup: 255 },
  { id: 'tomato-passata', name: 'Tomato sauce / passata', group: 'Liquids', gramsPerCup: 245 },
  { id: 'tomato-paste', name: 'Tomato paste / purée', group: 'Liquids', gramsPerCup: 262 },

  /* Nuts and seeds */
  { id: 'almonds-whole', name: 'Almonds, whole', group: 'Nuts & seeds', gramsPerCup: 143 },
  { id: 'almonds-sliced', name: 'Almonds, sliced', group: 'Nuts & seeds', gramsPerCup: 92 },
  { id: 'walnuts', name: 'Walnuts, chopped', group: 'Nuts & seeds', gramsPerCup: 117 },
  { id: 'pecans', name: 'Pecans, chopped', group: 'Nuts & seeds', gramsPerCup: 109 },
  { id: 'peanuts', name: 'Peanuts', group: 'Nuts & seeds', gramsPerCup: 146 },
  { id: 'peanut-butter', name: 'Peanut butter', group: 'Nuts & seeds', gramsPerCup: 258 },
  { id: 'cashews', name: 'Cashews', group: 'Nuts & seeds', gramsPerCup: 137 },
  { id: 'pistachios', name: 'Pistachios, shelled', group: 'Nuts & seeds', gramsPerCup: 123 },
  { id: 'sunflower-seeds', name: 'Sunflower seeds', group: 'Nuts & seeds', gramsPerCup: 140 },
  { id: 'chia', name: 'Chia seeds', group: 'Nuts & seeds', gramsPerCup: 170 },
  { id: 'flaxseed', name: 'Flaxseed, whole', group: 'Nuts & seeds', gramsPerCup: 168 },
  { id: 'sesame', name: 'Sesame seeds', group: 'Nuts & seeds', gramsPerCup: 144 },
  { id: 'poppy-seeds', name: 'Poppy seeds', group: 'Nuts & seeds', gramsPerCup: 145 },

  /* Baking and store cupboard */
  { id: 'cocoa', name: 'Cocoa powder, unsweetened', group: 'Baking & store cupboard', gramsPerCup: 85 },
  { id: 'choc-chips', name: 'Chocolate chips', group: 'Baking & store cupboard', gramsPerCup: 170 },
  { id: 'choc-chopped', name: 'Chocolate, chopped', group: 'Baking & store cupboard', gramsPerCup: 170 },
  { id: 'baking-powder', name: 'Baking powder', group: 'Baking & store cupboard', gramsPerCup: 220, note: 'Measured in teaspoons in practice. 1 US tsp is about 4.6 g.' },
  { id: 'baking-soda', name: 'Bicarbonate of soda', group: 'Baking & store cupboard', gramsPerCup: 230 },
  { id: 'salt-table', name: 'Salt, fine table', group: 'Baking & store cupboard', gramsPerCup: 292, note: 'Never swap salts by volume. Table salt is twice as heavy per spoon as flaky kosher salt.' },
  { id: 'salt-kosher-diamond', name: 'Salt, Diamond Crystal kosher', group: 'Baking & store cupboard', gramsPerCup: 145 },
  { id: 'salt-kosher-morton', name: 'Salt, Morton kosher', group: 'Baking & store cupboard', gramsPerCup: 218 },
  { id: 'yeast-instant', name: 'Yeast, instant / dried', group: 'Baking & store cupboard', gramsPerCup: 150 },
  { id: 'gelatin', name: 'Gelatin powder', group: 'Baking & store cupboard', gramsPerCup: 150 },
  { id: 'coconut-shredded', name: 'Coconut, desiccated / shredded', group: 'Baking & store cupboard', gramsPerCup: 85 },
  { id: 'marshmallows-mini', name: 'Marshmallows, mini', group: 'Baking & store cupboard', gramsPerCup: 50 },
  { id: 'lentils', name: 'Lentils, dry', group: 'Baking & store cupboard', gramsPerCup: 192 },
  { id: 'chickpeas-dry', name: 'Chickpeas, dry', group: 'Baking & store cupboard', gramsPerCup: 200 },
  { id: 'chickpeas-canned', name: 'Chickpeas, canned & drained', group: 'Baking & store cupboard', gramsPerCup: 164 },
  { id: 'black-beans-canned', name: 'Black beans, canned & drained', group: 'Baking & store cupboard', gramsPerCup: 172 },

  /* Fruit and vegetables */
  { id: 'raisins', name: 'Raisins / sultanas', group: 'Fruit & vegetables', gramsPerCup: 145 },
  { id: 'cranberries-dried', name: 'Cranberries, dried', group: 'Fruit & vegetables', gramsPerCup: 120 },
  { id: 'dates-chopped', name: 'Dates, chopped', group: 'Fruit & vegetables', gramsPerCup: 147 },
  { id: 'blueberries', name: 'Blueberries, fresh', group: 'Fruit & vegetables', gramsPerCup: 148 },
  { id: 'strawberries-sliced', name: 'Strawberries, sliced', group: 'Fruit & vegetables', gramsPerCup: 166 },
  { id: 'banana-mashed', name: 'Banana, mashed', group: 'Fruit & vegetables', gramsPerCup: 225 },
  { id: 'applesauce', name: 'Apple sauce / purée', group: 'Fruit & vegetables', gramsPerCup: 244 },
  { id: 'pumpkin-puree', name: 'Pumpkin purée', group: 'Fruit & vegetables', gramsPerCup: 244 },
  { id: 'carrot-grated', name: 'Carrot, grated', group: 'Fruit & vegetables', gramsPerCup: 110 },
  { id: 'onion-chopped', name: 'Onion, chopped', group: 'Fruit & vegetables', gramsPerCup: 160 },
  { id: 'potato-diced', name: 'Potato, diced raw', group: 'Fruit & vegetables', gramsPerCup: 150 },
  { id: 'peas-frozen', name: 'Peas, frozen', group: 'Fruit & vegetables', gramsPerCup: 134 },
  { id: 'corn-kernels', name: 'Corn kernels', group: 'Fruit & vegetables', gramsPerCup: 154 },
  { id: 'spinach-raw', name: 'Spinach, raw leaves', group: 'Fruit & vegetables', gramsPerCup: 30, note: 'Leafy greens barely register by volume. Packed or wilted spinach is several times heavier.' },
  { id: 'lettuce-shredded', name: 'Lettuce, shredded', group: 'Fruit & vegetables', gramsPerCup: 36 },
]

export const INGREDIENT_GROUPS: string[] = Array.from(new Set(INGREDIENTS.map((i) => i.group)))

export const INGREDIENT_BY_ID: Record<string, Ingredient> = Object.fromEntries(
  INGREDIENTS.map((i) => [i.id, i]),
)

/** Density in grams per millilitre. */
export function densityOf(ingredient: Ingredient): number {
  return ingredient.gramsPerCup / REFERENCE_CUP_ML
}

/** A handful of ingredients worth a one-tap shortcut button. */
export const QUICK_PICKS = [
  'flour-ap-spooned',
  'sugar-granulated',
  'butter',
  'water',
  'milk-whole',
  'rice-white',
  'cocoa',
  'honey',
]
