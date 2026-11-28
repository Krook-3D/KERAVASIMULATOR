import { useEffect, useState } from 'react';
import { levelFromXp } from '../../../../game/xp/xp';
import { resolveCook, type Recipe } from '../../../../game/cooking/recipes';
import type { CookSpot } from '../../../../game/world/grills';
import type { GameCtx } from '../gameWorld.types';

/** Cooking at park grills and camp fires: a timed cook with a level-based burn chance. */
export function useCooking(ctx: GameCtx) {
  const { player, dispatch, clockRef, setToast } = ctx;
  const [atCook, setAtCook] = useState<CookSpot | null>(null);
  const [cooking, setCooking] = useState<{ recipe: Recipe; t0: number } | null>(null);
  const [cookProgress, setCookProgress] = useState(0);
  const cookLevel = levelFromXp(player?.skills.cooking?.xp ?? 0);

  const startCook = (r: Recipe) => {
    if (cooking) return;
    setCooking({ recipe: r, t0: clockRef.current });
    setCookProgress(0);
  };
  useEffect(() => {
    if (!cooking) return;
    const id = window.setInterval(() => {
      const k = (clockRef.current - cooking.t0) / cooking.recipe.time;
      setCookProgress(Math.min(1, k));
      if (k < 1) return;
      window.clearInterval(id);
      const { burnt, out, xp } = resolveCook(cookLevel, cooking.recipe, Math.random());
      dispatch({ type: 'cook', ingredients: cooking.recipe.ingredients, out, xp });
      setToast(burnt ? `🔥 Hups, ${cooking.recipe.name.toLowerCase()} paloi. +${xp} Ruoanlaitto XP` : `🍳 ${cooking.recipe.name} valmis! +${xp} Ruoanlaitto XP`);
      setCooking(null);
    }, 200);
    return () => window.clearInterval(id);
  }, [cooking, cookLevel, dispatch]);

  return { atCook, setAtCook, cooking, cookProgress, cookLevel, startCook };
}
