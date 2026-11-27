/**
 * Cooking (Ruoanlaitto): buy or shoplift ingredients, take them to a grill
 * shelter (grillikatos) or a campfire and cook. Higher level unlocks better
 * recipes and burns less food; cooked food restores much more energy than
 * raw ingredients.
 */
export interface Recipe {
  id: string;
  /** The cooked item id (defined in data/items.ts). */
  out: string;
  name: string;
  level: number;
  xp: number;
  ingredients: Record<string, number>;
  /** Seconds at the grill. */
  time: number;
}

export const RECIPES: Recipe[] = [
  { id: 'makkara', out: 'grillimakkara', name: 'Grillimakkara', level: 1, xp: 12, ingredients: { makkara: 1 }, time: 3 },
  { id: 'munakas', out: 'munakas', name: 'Munakas', level: 1, xp: 14, ingredients: { kananmunat: 1, maito: 1 }, time: 3.5 },
  { id: 'muusi', out: 'perunamuusi', name: 'Perunamuusi', level: 3, xp: 20, ingredients: { peruna: 1, maito: 1 }, time: 4 },
  { id: 'letut', out: 'letut', name: 'Letut', level: 5, xp: 28, ingredients: { jauhot: 1, maito: 1, kananmunat: 1 }, time: 4.5 },
  { id: 'lihapullat', out: 'lihapullat', name: 'Lihapullat', level: 8, xp: 38, ingredients: { jauheliha: 1, sipuli: 1, kananmunat: 1 }, time: 5 },
  { id: 'bolognese', out: 'bolognese', name: 'Spagetti bolognese', level: 12, xp: 52, ingredients: { pasta: 1, jauheliha: 1, tomaatti: 1 }, time: 5.5 },
  { id: 'broileririisi', out: 'broileririisi', name: 'Broileririisi', level: 16, xp: 64, ingredients: { broileri: 1, riisi: 1, mausteet: 1 }, time: 6 },
  { id: 'pizza', out: 'lammitettypizza', name: 'Grillattu pizza', level: 2, xp: 10, ingredients: { pakastepizza: 1 }, time: 3 },
];

/** Burn chance: 45 % at the recipe's level, down 4 points per extra level, never below 3 %. */
export function burnChance(level: number, recipe: Recipe): number {
  return Math.max(0.03, 0.45 - (level - recipe.level) * 0.04);
}

export function canCook(inv: { itemId: string; quantity: number }[], r: Recipe): boolean {
  return Object.entries(r.ingredients).every(([id, n]) => (inv.find((s) => s.itemId === id)?.quantity ?? 0) >= n);
}
