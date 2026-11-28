import { useEffect, useMemo, useState } from 'react';
import { LIFTS, SET_ENERGY, liftChance, liftXp, barWeight, type LiftId } from '../../../../game/gym/lifting';
import { GYM_PLATE_SPOT, GYM_STATIONS } from '../../../../game/interiors/interiors';
import { buffMultipliers } from '../../../../game/gym/roina';
import { levelFromXp } from '../../../../game/xp/xp';
import { setDuration, type GymActive } from '../../interiors/GymInterior';
import { SWIM_TIME } from '../../interiors/PoolInterior';
import { SWIM_ENERGY } from '../constants';
import type { GameCtx } from '../gameWorld.types';
import { DRILLS, drillXp, type DrillId } from '../../../../game/gym/drills';
import { DRILL_TIME, type FightActive } from '../../interiors/FightGymInterior';

/**
 * Gym lifts (carry plates, load the bar, lift) and swimming laps, plus the
 * slow energy regeneration and buff ticking while you are not busy.
 * `otherBusy` = another timed activity (cooking) is running.
 */
export function useTraining(ctx: GameCtx, otherBusy: boolean) {
  const { player, dispatch, clockRef, setRoute, setToast, setPlayerVisible } = ctx;
  const strength = levelFromXp(player?.skills.strength?.xp ?? 0);
  const energy = player?.energy ?? 0;
  const [atStation, setAtStation] = useState<LiftId | null>(null);
  const [gymPairs, setGymPairs] = useState<Record<LiftId, number[]>>({ bench: [], squat: [], deadlift: [] });
  const [carrying, setCarrying] = useState<{ lift: LiftId; plate: number } | null>(null);
  const [gymActive, setGymActive] = useState<GymActive | null>(null);
  const [atPool, setAtPool] = useState(false);
  const [swimT0, setSwimT0] = useState<number | null>(null);
  const [atDrill, setAtDrill] = useState<DrillId | null>(null);
  const [fightActive, setFightActive] = useState<FightActive | null>(null);
  const martial = levelFromXp(player?.skills.martial?.xp ?? 0);
  const busy = !!gymActive || swimT0 !== null || !!fightActive || otherBusy;
  const buffMult = useMemo(() => buffMultipliers(player?.buffs ?? []), [player?.buffs]);

  // Energy comes back slowly while you are not training.
  useEffect(() => {
    const id = window.setInterval(() => {
      if (!busy) dispatch({ type: 'adjustStats', energy: Math.round(buffMult.energyRegen) });
      dispatch({ type: 'tickBuffs', dt: 6 });
    }, 6000);
    return () => window.clearInterval(id);
  }, [busy, dispatch, buffMult.energyRegen]);

  const fetchPlate = (plate: number) => {
    if (!atStation) return;
    const st = GYM_STATIONS.find((g) => g.lift === atStation)!;
    setCarrying({ lift: atStation, plate });
    setRoute([GYM_PLATE_SPOT, st.use]);
  };
  const arriveAtStation = (lift: LiftId) => {
    setAtStation(lift);
    if (carrying && carrying.lift === lift) {
      setGymPairs((g) => ({ ...g, [lift]: [...g[lift], carrying.plate] }));
      setCarrying(null);
    }
  };
  const removePair = () => atStation && setGymPairs((g) => ({ ...g, [atStation]: g[atStation].slice(0, -1) }));
  const startLift = () => {
    if (!atStation || busy || energy < SET_ENERGY) return;
    const lift = atStation;
    const kg = barWeight(gymPairs[lift]);
    const chance = liftChance(lift, strength, kg / buffMult.maxLift);
    const success = Math.random() < chance;
    setGymActive({ lift, success, t0: clockRef.current });
    setPlayerVisible(false);
    window.setTimeout(() => {
      setGymActive(null);
      setPlayerVisible(true);
      const xp = chance > 0 ? Math.round(liftXp(lift, strength, kg, success) * buffMult.strengthXp) : 0;
      dispatch({ type: 'adjustStats', energy: -SET_ENERGY });
      if (xp) dispatch({ type: 'grantReward', reward: { skillXp: { strength: xp } } });
      if (success) dispatch({ type: 'recordLift', lift, kg });
      setToast(
        success
          ? `💪 ${LIFTS[lift].name} ${kg} kg × 5 – onnistui! +${xp} Voima XP`
          : chance > 0
            ? `Tanko pysähtyi kesken… ${kg} kg ei noussut tällä kertaa. +${xp} Voima XP`
            : `${kg} kg ei hievahdakaan. Kevennä tankoa.`,
      );
    }, setDuration(success) * 1000);
  };
  const startSwim = () => {
    if (busy || energy < SWIM_ENERGY) return;
    setSwimT0(clockRef.current);
    setPlayerVisible(false);
    window.setTimeout(() => {
      setSwimT0(null);
      setPlayerVisible(true);
      dispatch({ type: 'adjustStats', energy: -SWIM_ENERGY });
      const xp = Math.round((35 + Math.random() * 10) * buffMult.enduranceXp);
      dispatch({ type: 'grantReward', reward: { skillXp: { endurance: xp } } });
      setToast(`🏊 Uit 10 × 25 m. +${xp} Kestävyys XP`);
    }, SWIM_TIME * 1000);
  };

  const startDrill = () => {
    const d = atDrill ? DRILLS[atDrill] : null;
    if (!d || busy || energy < d.energy || martial < d.level) return;
    setFightActive({ drill: d.id, t0: clockRef.current });
    setPlayerVisible(false);
    window.setTimeout(() => {
      setFightActive(null);
      setPlayerVisible(true);
      dispatch({ type: 'adjustStats', energy: -d.energy });
      const xp = drillXp(d, martial, Math.random());
      const sXp = d.strengthXp ? Math.round(d.strengthXp * buffMult.strengthXp) : 0;
      dispatch({ type: 'grantReward', reward: { skillXp: { martial: xp, ...(sXp ? { strength: sXp } : {}) } } });
      const hurt = d.hurtChance && Math.random() < d.hurtChance ? d.hurt ?? 0 : 0;
      if (hurt) dispatch({ type: 'adjustStats', health: -hurt });
      setToast(`🥊 ${d.name} valmis. +${xp} Kamppailu XP${sXp ? ` · +${sXp} Voima XP` : ''}${hurt ? ` · osuma naamaan −${hurt} HP` : ''}`);
    }, DRILL_TIME * 1000);
  };

  return {
    martial, atDrill, setAtDrill, fightActive, startDrill,
    strength, energy, busy, gymActive, gymPairs, carrying, setCarrying, atStation, setAtStation, atPool, setAtPool, swimT0,
    fetchPlate, arriveAtStation, removePair, startLift, startSwim,
  };
}
