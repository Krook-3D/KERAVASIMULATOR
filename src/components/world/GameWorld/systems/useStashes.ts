import { useEffect, useMemo, useState } from 'react';
import type { WorldXZ } from '../../../../game/world/projection';
import { STASH_DEFS, STASH_STEP, stashQuestId, type PlacedStash } from '../../../../game/quests/stashes';
import { canAdd } from '../../../../game/store/gameReducer';
import { ITEMS as ITEM_DEFS, itemName } from '../../../../data/items';
import { levelFromXp } from '../../../../game/xp/xp';
import type { GameCtx } from '../gameWorld.types';
import type { PutkaReason } from './useShop';

type StashDef = (typeof STASH_DEFS)[number];

/**
 * Forest stashes: taking one starts its quest and brings the owners
 * (criminals, plain-clothes police or a geocacher) after you. Kept loot can
 * later be handed in at the police desk or fenced to the station crew.
 */
export function useStashes(ctx: GameCtx, toPutka: (karma: number, reason: PutkaReason) => void) {
  const { player, dispatch, positionRef, clockRef, say, close, setToast } = ctx;
  const stashTaken = useMemo(() => new Set(STASH_DEFS.filter((d) => player?.quests[stashQuestId(d.id)]).map((d) => d.id)), [player?.quests]);
  const [chase, setChase] = useState<{ stash: PlacedStash; from: WorldXZ; t0: number } | null>(null);
  const skillLv = (id: 'hustling' | 'evasion' | 'running' | 'strength') => levelFromXp(player?.skills[id]?.xp ?? 0);
  const stashStep = (s: PlacedStash, step: number) => dispatch({ type: 'setQuestStep', questId: stashQuestId(s.id), step, completed: step >= STASH_STEP.done });
  const loseStash = (s: PlacedStash) => {
    for (const it of s.items) dispatch({ type: 'removeItem', itemId: it, quantity: 1 });
    if (s.money) dispatch({ type: 'adjustStats', money: -s.money });
  };
  const takeStash = (s: PlacedStash) => {
    if (stashTaken.has(s.id) || chase) return;
    if (s.items.some((it) => player && !canAdd(player, it))) return setToast('🎒 Reppu on täynnä.');
    for (const it of s.items) dispatch({ type: 'addItem', itemId: it });
    if (s.money) dispatch({ type: 'adjustStats', money: s.money });
    stashStep(s, STASH_STEP.pursued);
    const got = [...s.items.map((i) => itemName(i)), ...(s.money ? [`${s.money} €`] : [])].join(', ');
    setToast(`${s.find} Otit: ${got}. Joku tulee…`);
    const pos = positionRef.current;
    const a = Math.random() * Math.PI * 2;
    window.setTimeout(() => setChase({ stash: s, from: [pos.x + Math.sin(a) * 18, pos.z + Math.cos(a) * 18], t0: clockRef.current }), 3500);
  };
  // the pursuers arrive and talk
  useEffect(() => {
    if (!chase) return;
    const id = window.setTimeout(() => stashTalk(chase.stash), 4300);
    return () => window.clearTimeout(id);
  }, [chase]);
  const endChase = (s: PlacedStash, kept: boolean, toast?: string) => {
    close();
    setChase(null);
    stashStep(s, kept ? STASH_STEP.deliver : STASH_STEP.done);
    if (!kept) dispatch({ type: 'grantReward', reward: { xp: 40 } });
    if (toast) setToast(toast);
  };
  const stashTalk = (s: PlacedStash) => {
    const hustle = skillLv('hustling'), evade = Math.max(skillLv('evasion'), skillLv('running'));
    if (s.owner === 'geocacher') {
      say('Retkeilijä', 'Hei! Toi on geokätkö! Se kuuluu kaikille. Kirjoita nimesi vihkoon ja laita takaisin, niin seuraavakin löytää sen.', [
        { text: 'Totta kai. Laitan takaisin.', onPick: () => { loseStash(s); dispatch({ type: 'adjustKarma', amount: 5 }); endChase(s, false, '📓 Kirjoitit nimesi vihkoon. Karma +5'); } },
        { text: 'Löytäjä saa pitää.', onPick: () => { dispatch({ type: 'adjustKarma', amount: -3 }); endChase(s, true, 'Retkeilijä tuhahtaa. Karma −3'); } },
      ]);
      return;
    }
    if (s.owner === 'police') {
      say('Siviilipoliisi', 'Poliisi! Tuo kätkö on todistusaineistoa. Olemme tarkkailleet sitä kolme päivää. Mitä sinä teet täällä?', [
        {
          text: `[Hustlaus 4] Löysin sen sattumalta ja aioin tuoda sen teille.`,
          onPick: () =>
            hustle >= 4
              ? say('Siviilipoliisi', 'Hmm. Uskotaan. Kiitos kansalaisaktiivisuudesta, tässä löytöpalkkio.', [{ text: 'Mielelläni.', onPick: () => { loseStash(s); dispatch({ type: 'adjustKarma', amount: 3 }); dispatch({ type: 'adjustStats', money: 20 }); dispatch({ type: 'grantReward', reward: { skillXp: { hustling: 40 } } }); endChase(s, false, 'Selvisit puhumalla. +20 € löytöpalkkio · karma +3'); } }], `Hustlaus ${hustle}/4: onnistui`)
              : say('Siviilipoliisi', 'Sattumalta. Kaikki sanoo niin. Lähdetään asemalle.', [{ text: 'Voi ei.', onPick: () => { loseStash(s); stashStep(s, STASH_STEP.done); setChase(null); toPutka(-4, 'stash'); } }], `Hustlaus ${hustle}/4: ei riittänyt`),
        },
        {
          text: `[Kyttien pakoilu 6] Juokse metsään.`,
          onPick: () =>
            evade >= 6
              ? (dispatch({ type: 'grantReward', reward: { skillXp: { evasion: 60 } } }), endChase(s, true, '🏃 Karistit poliisit metsään! +60 Kyttien pakoilu XP'))
              : say('Siviilipoliisi', 'Seis! *kampittaa sinut sammaleeseen*', [{ text: 'Auts.', onPick: () => { loseStash(s); stashStep(s, STASH_STEP.done); setChase(null); toPutka(-6, 'stash'); } }], `Pakoilu ${evade}/6: ei riittänyt`),
        },
        { text: 'Antaudun. Ottakaa se.', onPick: () => { loseStash(s); dispatch({ type: 'adjustKarma', amount: 1 }); endChase(s, false, 'Poliisit ottivat kätkön ja päästivät sinut varoituksella.'); } },
      ]);
      return;
    }
    say('Tuntematon jäbä', 'Ey. Toi on meidän. Mehtäläinen ei tykkää kun sen tavaroihin kosketaan. Anna se takas, niin kukaan ei satu.', [
      { text: 'Okei okei, ota.', onPick: () => { loseStash(s); dispatch({ type: 'adjustKarma', amount: 2 }); endChase(s, false, 'Annoit kätkön takaisin. Viisas valinta.'); } },
      {
        text: '[Hustlaus 6] Mehtäläinen itse käski mun hakea tän.',
        onPick: () =>
          hustle >= 6
            ? (dispatch({ type: 'grantReward', reward: { skillXp: { hustling: 50 } } }), endChase(s, true, '🤝 He uskoivat! Kätkö jäi sinulle. +50 Hustlaus XP'))
            : say('Tuntematon jäbä', 'Valehtelet. *lyö sinua*', [{ text: 'Ugh…', onPick: () => { loseStash(s); dispatch({ type: 'adjustStats', health: -25 }); endChase(s, false, '🤕 Sait turpaan ja kätkö vietiin. −25 HP'); } }], `Hustlaus ${hustle}/6: ei riittänyt`),
      },
      {
        text: '[Juoksu / pakoilu 5] Juokse karkuun.',
        onPick: () =>
          evade >= 5
            ? (dispatch({ type: 'grantReward', reward: { skillXp: { evasion: 50, running: 30 } } }), endChase(s, true, '🏃 Juoksit karkuun kätkön kanssa!'))
            : say('Tuntematon jäbä', '*saa sinut kiinni* Minne luulit meneväsi?', [{ text: 'Ugh…', onPick: () => { loseStash(s); dispatch({ type: 'adjustStats', health: -30 }); endChase(s, false, '🤕 Jäit kiinni ja kätkö vietiin. −30 HP'); } }], `Pakoilu ${evade}/5: ei riittänyt`),
      },
    ]);
  };
  /** Stashes you kept and can now hand in or sell. */
  const deliverable = STASH_DEFS.filter((d) => player?.quests[stashQuestId(d.id)]?.status === 'active' && player.quests[stashQuestId(d.id)]!.objectiveIndex === STASH_STEP.deliver);
  const stashValue = (d: StashDef) => d.items.reduce((a, it) => a + (player?.inventory.some((x) => x.itemId === it) ? ITEM_DEFS[it]?.value ?? 0 : 0), 0);
  const handInStash = (d: StashDef) => {
    for (const it of d.items) dispatch({ type: 'removeItem', itemId: it, quantity: 1 });
    dispatch({ type: 'adjustKarma', amount: 6 });
    dispatch({ type: 'grantReward', reward: { xp: 80, money: 25 } });
    dispatch({ type: 'setQuestStep', questId: stashQuestId(d.id), step: STASH_STEP.done, completed: true });
    close();
    setToast(`✓ Quest suoritettu: palautit kätkön poliisille. +25 € · karma +6`);
  };
  const fenceStash = (d: StashDef) => {
    const pay = Math.round(stashValue(d) * 0.55);
    for (const it of d.items) dispatch({ type: 'removeItem', itemId: it, quantity: 1 });
    dispatch({ type: 'adjustKarma', amount: -3 });
    dispatch({ type: 'grantReward', reward: { xp: 80, money: pay, skillXp: { hustling: 45 } } });
    dispatch({ type: 'setQuestStep', questId: stashQuestId(d.id), step: STASH_STEP.done, completed: true });
    close();
    setToast(`✓ Quest suoritettu: myit kätkön tavarat. +${pay} € · +45 Hustlaus XP · karma −3`);
  };
  /** Police desk option for the first stash waiting to be handed in. */
  const policeDeskOptions = deliverable.slice(0, 1).map((d) => ({ text: `Palauta löytämäni kätkö (${d.title})`, onPick: () => handInStash(d) }));

  return { stashTaken, chase, takeStash, deliverable, stashValue, fenceStash, policeDeskOptions };
}
