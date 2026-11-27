import { useEffect, useState } from 'react';
import type { WorldXZ } from '../../../../game/world/projection';
import { levelFromXp } from '../../../../game/xp/xp';
import { CREWS, type Npc } from '../../../../game/npc/population';
import { speakerName } from '../../../../game/npc/talk';
import { canAdd } from '../../../../game/store/gameReducer';
import { itemIcon, itemName } from '../../../../data/items';
import { CHECK_LEVEL, dealPrice, FAKE_GOOD, resolveDeal, STREET_GOODS, type StreetGood } from '../../../../game/street/streetDeals';
import { INSULTS, provoke, WARNINGS } from '../../../../game/street/provoke';
import { fightChance } from '../../../../game/street/fight';
import type { DialogueView } from '../../quest/DialogueBox';
import type { GameCtx } from '../gameWorld.types';

/** A crew running at the player after one provocation too many. */
export interface GangAttack {
  crewId: string;
  crewName: string;
  colour: string;
  size: number;
  /** Levels of the crew members coming at you. */
  levels: number[];
  from: WorldXZ;
  t0: number;
}

type Option = DialogueView['options'][number];

const hash = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 11);
/** How shady a seller is (0–1), stable per NPC. */
const shadiness = (npc: Npc) => (hash(npc.id) % 100) / 100;

/**
 * Crew street life: buying fictional street goods from any crew member (a
 * beginner gets scammed often) and provoking a crew until, on a random 3rd–5th
 * time, the whole crew comes at you.
 */
export function useCrewStreet(ctx: GameCtx, npcs: Npc[]) {
  const { player, dispatch, positionRef, clockRef, say, close, setToast } = ctx;
  /** Each crew's patience lives in the save, so it survives a reload. */
  const moodOf = (crewId: string) => player?.crewMood?.[crewId];
  const [gang, setGang] = useState<GangAttack | null>(null);
  const lv = (id: 'hustling' | 'evasion' | 'running' | 'strength' | 'martial') => levelFromXp(player?.skills[id]?.xp ?? 0);
  const money = player?.money ?? 0;
  const bye: Option = { text: 'Heippa.', onPick: close };

  // ---- buying
  const finishDeal = (npc: Npc, good: StreetGood, price: number, checked: boolean) => {
    const hustle = lv('hustling');
    const name = speakerName(npc);
    const out = resolveDeal(hustle, checked, Math.random(), Math.random(), shadiness(npc));
    const note = checked ? (hustle >= CHECK_LEVEL ? `Hustlaus ${hustle}/${CHECK_LEVEL}: tarkistit tavaran` : undefined) : undefined;
    if (out === 'spotted') {
      dispatch({ type: 'grantReward', reward: { skillXp: { hustling: 25 } } });
      say(name, '*Avaat pussin* …Tää on oreganoa. "Okei okei, läppä vaan bro. Unohda koko juttu."', [bye], note);
      setToast('🕵️ Huomasit huijauksen etkä maksanut mitään. +25 Hustlaus XP');
      return;
    }
    dispatch({ type: 'adjustStats', money: -price });
    if (out === 'ripoff') {
      dispatch({ type: 'grantReward', reward: { skillXp: { hustling: 5 } } });
      say(name, `*Nappaa ${price} € kädestäsi ja juoksee kulman taakse* Kiitti bro!`, [{ text: 'Hei! …', onPick: close }], note);
      setToast(`💸 Sinut huijattiin: myyjä juoksi ${price} €:n kanssa. Opit jotain: +5 Hustlaus XP`);
      return;
    }
    const itemId = out === 'fake' ? FAKE_GOOD : good.id;
    dispatch({ type: 'addItem', itemId });
    if (out === 'fake') {
      dispatch({ type: 'grantReward', reward: { skillXp: { hustling: 5 } } });
      say(name, 'Siinä. Nauti. *Kääntyy nopeasti pois*', [bye], note);
      setToast(`🫙 Kotona huomaat: pussissa on oreganoa ja talkkia. Sinua huijattiin (−${price} €).`);
      return;
    }
    dispatch({ type: 'grantReward', reward: { skillXp: { hustling: 12 } } });
    say(name, 'Siinä. Ja sä et saanu tätä multa.', [bye], note);
    setToast(`${itemIcon(good.id)} Ostit: ${itemName(good.id)} (−${price} €) · +12 Hustlaus XP`);
  };

  const offerGood = (npc: Npc, good: StreetGood) => {
    const hustle = lv('hustling');
    const price = dealPrice(good.price, hustle);
    const name = speakerName(npc);
    if (money < price) return say(name, `${price} euroo. Ai sulla ei oo? No tuu takas kun on.`, [bye]);
    if (player && !canAdd(player, good.id)) return say(name, 'Sun taskut on täynnä, bro.', [bye]);
    say(name, `${good.pitch} ${price} euroo.`, [
      { text: `Osta (−${price} €)`, onPick: () => finishDeal(npc, good, price, false) },
      {
        text: `[Hustlaus ${CHECK_LEVEL}] Näytä ensin tavara.`,
        onPick: () =>
          hustle >= CHECK_LEVEL
            ? finishDeal(npc, good, price, true)
            : say(name, '*Vilauttaa pussia* Näätsä? Kamaa.', [
                { text: `Osta silti (−${price} €)`, onPick: () => finishDeal(npc, good, price, false) },
                { text: 'Ei sittenkään.', onPick: close },
              ], `Hustlaus ${hustle}/${CHECK_LEVEL}: et osaa sanoa onko se aitoa`),
      },
      { text: 'Ei sittenkään.', onPick: close },
    ]);
  };

  const dealMenu = (npc: Npc) => {
    const hustle = lv('hustling');
    say(speakerName(npc), hustle >= 6 ? 'Ai sä. Sulle hyvä hinta. Mitä laitetaan?' : 'Shh, ei niin kovaa. Mitä sä haluut?', [
      ...Object.values(STREET_GOODS).map((g) => ({ text: `${itemIcon(g.id)} ${itemName(g.id)} (${dealPrice(g.price, hustle)} €)`, onPick: () => offerGood(npc, g) })),
      { text: 'En mitään, sori.', onPick: close },
    ]);
  };

  // ---- provoking
  /**
   * Counts a provocation against the NPC's crew. Returns true when the crew
   * attacks (the caller should stop its own dialogue).
   */
  const registerProvoke = (npc: Npc): boolean => {
    if (!npc.crew || gang) return false;
    const r = provoke(moodOf(npc.crew), Math.random(), Math.random());
    dispatch({ type: 'setCrewMood', crewId: npc.crew, mood: r.mood });
    if (!r.attack) return false;
    // the provoked one plus 2–3 mates from the same crew
    const mates = npcs.filter((n) => n.crew === npc.crew && n.id !== npc.id).sort(() => Math.random() - 0.5);
    const levels = [npc.level ?? 5, ...mates.slice(0, 2 + Math.floor(Math.random() * 2)).map((n) => n.level ?? 5)];
    const crew = CREWS.find((c) => c.id === npc.crew);
    say(speakerName(npc), 'Nyt riitti. Pojat! Tänne!', [
      {
        text: '…Oho.',
        onPick: () => {
          close();
          const pos = positionRef.current;
          const a = Math.random() * Math.PI * 2;
          setGang({ crewId: npc.crew!, crewName: crew?.name ?? 'Jengi', colour: crew?.colour ?? '#c8312b', size: levels.length, levels, from: [pos.x + Math.sin(a) * 16, pos.z + Math.cos(a) * 16], t0: clockRef.current });
        },
      },
    ]);
    return true;
  };

  const provokeTalk = (npc: Npc) => {
    if (registerProvoke(npc)) return;
    // the dispatch above lands next render, so count this provocation by hand
    const count = (npc.crew ? moodOf(npc.crew)?.count ?? 0 : 0) + 1;
    const warn = WARNINGS[Math.min(WARNINGS.length - 1, count - 1)]!;
    dispatch({ type: 'adjustKarma', amount: -1 });
    say(speakerName(npc), warn, [bye]);
  };

  /** Extra crew talk options: buy, provoke. */
  const crewOptions = (npc: Npc): Option[] =>
    npc.kind !== 'crew'
      ? []
      : [
          { text: '💰 Onks sulla jotain myytävää?', onPick: () => dealMenu(npc) },
          { text: `😤 "${INSULTS[(hash(npc.id) + (moodOf(npc.crew ?? '')?.count ?? 0)) % INSULTS.length]}"`, onPick: () => provokeTalk(npc) },
        ];

  // ---- the attack
  const endGang = (toast: string) => {
    close();
    setGang(null);
    setToast(toast);
  };
  useEffect(() => {
    if (!gang) return;
    const id = window.setTimeout(() => {
      const str = lv('strength'), martial = lv('martial'), run = Math.max(lv('evasion'), lv('running'));
      const chance = fightChance(str, martial, gang.levels);
      const pct = Math.round(chance * 100);
      const loot = Math.min(money, Math.max(10, Math.round(money * 0.3)));
      const top = Math.max(...gang.levels);
      const fightNote = `Voima ${str} · Kamppailu ${martial} · voittomahdollisuus ${pct} %`;
      say(`${gang.crewName} (${gang.size} jäbää, lv ${Math.min(...gang.levels)}–${top})`, 'Sä luulit et voit aukoo päätä meidän mestalla? Nyt puhutaan.', [
        {
          text: `🥊 Pistä vastaan (${pct} %)`,
          onPick: () => {
            const xpMul = 1 + top / 10;
            if (Math.random() < chance) {
              const sXp = Math.round(40 * xpMul), mXp = Math.round(60 * xpMul);
              dispatch({ type: 'adjustStats', health: -Math.round(8 + top * 0.8) });
              dispatch({ type: 'grantReward', reward: { skillXp: { strength: sXp, martial: mXp } } });
              dispatch({ type: 'setCrewMood', crewId: gang.crewId, mood: { count: 0, attackAt: 5 } });
              endGang(`🥊 Päihitit ${gang.crewName}! −${Math.round(8 + top * 0.8)} HP · +${mXp} Kamppailu XP · +${sXp} Voima XP`);
            } else {
              const mXp = Math.round(15 * xpMul);
              say(gang.crewName, '*Kaatavat sinut maahan ja tyhjentävät taskusi*', [{ text: 'Ugh…', onPick: () => { dispatch({ type: 'adjustStats', health: -35, money: -loot }); dispatch({ type: 'grantReward', reward: { skillXp: { martial: mXp } } }); endGang(`🤕 Sait turpaan. −35 HP${loot ? ` · veivät ${loot} €` : ''} · +${mXp} Kamppailu XP`); } }], `${fightNote}: hävisit`);
            }
          },
        },
        {
          text: '🏃 Juokse karkuun! (rämpytä Spacea)',
          onPick: () =>
            ctx.escape({
              title: gang.crewName,
              skill: run,
              difficulty: 0.8 + gang.size * 0.15,
              onDone: (ok) =>
                ok
                  ? (dispatch({ type: 'grantReward', reward: { skillXp: { evasion: 45, running: 30 } } }), endGang('🏃 Juoksit karkuun! +45 Kyttien pakoilu XP · +30 Juoksu XP'))
                  : say(gang.crewName, '*Saavat sinut kiinni kulmalla*', [{ text: 'Ugh…', onPick: () => { dispatch({ type: 'adjustStats', health: -28 }); endGang('🤕 Jäit kiinni. −28 HP'); } }]),
            }),
        },
        money >= 25
          ? { text: 'Sori, mä olin idiootti. Tässä, ottakaa. (−25 €)', onPick: () => { dispatch({ type: 'adjustStats', money: -25 }); endGang('Maksoit itsesi ulos. −25 €'); } }
          : { text: 'Sori, mä olin idiootti…', onPick: () => { dispatch({ type: 'adjustStats', health: -18 }); endGang('🤕 Anteeksipyyntö ei riittänyt. −18 HP'); } },
      ], fightNote);
    }, 4300);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gang]);

  return { gang, crewOptions, registerProvoke };
}
