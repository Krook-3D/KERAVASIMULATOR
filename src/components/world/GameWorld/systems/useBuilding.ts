import { useEffect, useMemo, useState } from 'react';
import { levelFromXp } from '../../../../game/xp/xp';
import { itemIcon, itemName } from '../../../../data/items';
import { priceOf } from '../../../../game/shop/shop';
import { PropCollider } from '../../../../game/world/propCollider';
import {
  BUILD_STAGES,
  houseDone,
  houseHalf,
  MAX_PLOTS,
  missingFor,
  plotResale,
  PRACTICE,
  type Plot,
} from '../../../../game/world/plots';
import type { DialogueView } from '../../quest/DialogueBox';
import type { GameCtx } from '../gameWorld.types';
import type { WorldSetup } from '../useWorldSetup';

type Option = DialogueView['options'][number];

/** A timed job on a plot (a house stage or carpentry practice). */
export interface BuildJob {
  plotId: string;
  name: string;
  t0: number;
  time: number;
  needs: Record<string, number>;
  energy: number;
  xp: number;
  advance: boolean;
}

const fmt = (n: number) => n.toLocaleString('fi-FI');
const list = (needs: Record<string, number> | [string, number][]) =>
  (Array.isArray(needs) ? needs : Object.entries(needs)).map(([id, n]) => `${itemIcon(id)} ${itemName(id)} ×${n}`).join(', ');

/**
 * Own plots and the Rakentaminen skill: buy a plot (small and pricey in the
 * centre, big and cheap at the edge), then build a house on it in four stages
 * with materials from Motonet.
 */
export function useBuilding(ctx: GameCtx, w: WorldSetup) {
  const { player, dispatch, clockRef, say, close, setToast } = ctx;
  const [job, setJob] = useState<BuildJob | null>(null);
  const [progress, setProgress] = useState(0);
  const owned = player?.plots ?? {};
  const level = levelFromXp(player?.skills.construction?.xp ?? 0);
  const count = (id: string) => player?.inventory.reduce((a, s) => a + (s.itemId === id ? s.quantity : 0), 0) ?? 0;
  const bye: Option = { text: 'Selvä.', onPick: close };

  const start = (plot: Plot, j: Omit<BuildJob, 't0' | 'plotId'>) => {
    close();
    setJob({ ...j, plotId: plot.id, t0: clockRef.current });
    setProgress(0);
  };

  const describe = (plot: Plot) => `${plot.zone}, ${plot.size} × ${plot.size} m (${fmt(plot.size * plot.size)} m², ${(plot.price / (plot.size * plot.size)).toFixed(2).replace('.', ',')} €/m²)`;

  const forSale = (plot: Plot) => {
    const mine = Object.keys(owned).length;
    const opts: Option[] = [];
    if (mine >= MAX_PLOTS) opts.push({ text: `Sinulla on jo ${MAX_PLOTS} tonttia.`, onPick: close });
    else if ((player?.money ?? 0) < plot.price) opts.push({ text: `Rahat ei riitä (${fmt(plot.price)} €).`, onPick: close });
    else
      opts.push({
        text: `🖊️ Osta tontti (−${fmt(plot.price)} €)`,
        onPick: () => {
          dispatch({ type: 'buyPlot', plotId: plot.id, price: plot.price });
          close();
          setToast(`🏡 Ostit tontin: ${describe(plot)}. Rakennustarvikkeet saat Motonetista.`);
        },
      });
    opts.push({ text: 'Ei nyt.', onPick: close });
    say('🪧 MYYTÄVÄNÄ', `Rakennustontti, ${describe(plot)}. Hinta ${fmt(plot.price)} €. ${plot.zone === 'Keskusta' ? 'Keskeinen sijainti, palvelut kävelymatkan päässä.' : plot.zone === 'Laitakaupunki' ? 'Rauhallinen ja tilava, metsä vieressä.' : 'Hyvät yhteydet, omakotitaloalue.'}`, opts);
  };

  const ownPlot = (plot: Plot) => {
    const s = owned[plot.id]!;
    const energy = player?.energy ?? 0;
    const opts: Option[] = [];
    const next = BUILD_STAGES[s.stage];
    let note: string | undefined;
    if (next) {
      const miss = missingFor(next.needs, count);
      if (level < next.level) {
        opts.push({ text: `🔒 ${next.name}: vaatii Rakentaminen ${next.level}`, onPick: () => say('🏗️ Oma tontti', `${next.name} on vielä liian vaativa. Harjoittele puutöillä tai tee aiemmat vaiheet. Rakentaminen ${level}/${next.level}.`, [bye]) });
      } else if (miss.length) {
        opts.push({ text: `🧱 ${next.name}: puuttuu ${list(miss)}`, onPick: () => say('🏗️ Oma tontti', `Tarvitset vaiheeseen ${next.name}: ${list(next.needs)}. Puuttuu: ${list(miss)}. Rakennustarvikkeet löytyvät Motonetista.`, [bye]) });
      } else if (energy < next.energy) {
        opts.push({ text: `😮‍💨 ${next.name}: liian väsynyt (−${next.energy} ⚡)`, onPick: close });
      } else {
        opts.push({ text: `🔨 Rakenna: ${next.name} (${list(next.needs)}, −${next.energy} ⚡)`, onPick: () => start(plot, { name: next.name, time: next.time, needs: next.needs, energy: next.energy, xp: next.xp, advance: true }) });
      }
      note = `Vaihe ${s.stage + 1}/${BUILD_STAGES.length} · Rakentaminen ${level}`;
    }
    const pm = missingFor(PRACTICE.needs, count);
    opts.push(
      pm.length
        ? { text: `🪚 Puutyöt: tarvitset ${list(PRACTICE.needs)}`, onPick: close }
        : energy < PRACTICE.energy
          ? { text: '🪚 Puutyöt: liian väsynyt', onPick: close }
          : { text: `🪚 Tee puutöitä (${list(PRACTICE.needs)}, −${PRACTICE.energy} ⚡)`, onPick: () => start(plot, { name: PRACTICE.name, time: PRACTICE.time, needs: PRACTICE.needs, energy: PRACTICE.energy, xp: PRACTICE.xp, advance: false }) },
    );
    const resale = plotResale(plot, s, priceOf);
    opts.push({
      text: `💶 Myy tontti (${fmt(resale)} €)`,
      onPick: () =>
        say('🏗️ Oma tontti', `Myydäänkö ${houseDone(s) ? 'talo ja tontti' : 'tontti'} ${fmt(resale)} eurolla? Tätä ei voi perua.`, [
          { text: `Myy (+${fmt(resale)} €)`, onPick: () => { dispatch({ type: 'sellPlot', plotId: plot.id, value: resale }); close(); setToast(`💶 Myit tontin: +${fmt(resale)} €`); } },
          { text: 'Ei sittenkään.', onPick: close },
        ]),
    });
    opts.push(bye);
    const status = houseDone(s)
      ? 'Talo on valmis! Oma koti Keravalla.'
      : s.stage === 0
        ? 'Tyhjä tontti. Aloita valamalla perustus.'
        : `Valmiina: ${BUILD_STAGES.slice(0, s.stage).map((b) => b.name.toLowerCase()).join(', ')}. Seuraavaksi: ${next!.name.toLowerCase()}.`;
    say('🏗️ Oma tontti', `${describe(plot)}. ${status}`, opts, note);
  };

  const usePlot = (plot: Plot) => (owned[plot.id] ? ownPlot(plot) : forSale(plot));

  useEffect(() => {
    if (!job) return;
    const id = window.setInterval(() => {
      const k = (clockRef.current - job.t0) / job.time;
      setProgress(Math.min(1, k));
      if (k < 1) return;
      window.clearInterval(id);
      dispatch({ type: 'buildStage', plotId: job.plotId, needs: job.needs, energy: job.energy, xp: job.xp, advance: job.advance });
      const plotsLeft = job.advance && (owned[job.plotId]?.stage ?? 0) + 1 >= BUILD_STAGES.length;
      setToast(plotsLeft ? `🏡 Talo valmis! +${job.xp} Rakentaminen XP` : job.advance ? `🔨 ${job.name} valmis! +${job.xp} Rakentaminen XP` : `🪚 Puutyöt tehty. +${job.xp} Rakentaminen XP`);
      setJob(null);
    }, 200);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job]);

  // walls of the houses you've built (frame up) block walking
  const plotKey = JSON.stringify(owned);
  const houseCollider = useMemo(() => {
    const c = new PropCollider();
    for (const plot of w.plots) {
      const s = owned[plot.id];
      if (!s || s.stage < 2) continue;
      const [hw, hd] = houseHalf(plot.size);
      c.box(plot.at[0], plot.at[1], hw, hd, Math.atan2(plot.front[0], plot.front[1]));
    }
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w.plots, plotKey]);
  w.houseColRef.current = houseCollider;

  return { job, progress, usePlot, owned, level };
}
