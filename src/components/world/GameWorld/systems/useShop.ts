import { useEffect, useState } from 'react';
import type { InteriorId } from '../../../../game/interiors/interiors';
import { POLICE_CELL_SPAWN } from '../../../../game/interiors/interiors';
import { SHOPS, CAUGHT_KARMA_MULT, STEAL_KARMA, alertLevel, basketTotal, catchChance, type Shelf } from '../../../../game/shop/shop';
import { canAdd, INVENTORY_SIZE } from '../../../../game/store/gameReducer';
import { itemName } from '../../../../data/items';
import type { DialogueOptionView } from '../../quest/DialogueBox';
import type { GameCtx } from '../gameWorld.types';

export type PutkaReason = 'theft' | 'graffiti' | 'stash';

/**
 * Shops (basket, till, shoplifting with guards) and the police station
 * (holding cell sentence, the service desk). `toPutka` is shared with the
 * other systems that can get you arrested.
 */
export function useShop(ctx: GameCtx) {
  const { player, dispatch, scene, clockRef, say, close, setToast, teleport } = ctx;
  const [basket, setBasket] = useState<Record<string, number>>({});
  const [atShelf, setAtShelf] = useState<Shelf | null>(null);
  const [atTill, setAtTill] = useState(false);
  const [visitThefts, setVisitThefts] = useState(0);
  const [putkaUntil, setPutkaUntil] = useState<number | null>(null);
  const [putkaLeft, setPutkaLeft] = useState(0);

  const shop = scene !== 'world' ? SHOPS[scene as InteriorId] : undefined;
  const alert = player ? alertLevel(player, { inShop: !!shop, visitThefts }) : 0;

  /** Called when the player changes scene: an unpaid basket stays in the shop. */
  const leaveScene = (left: string) => {
    if (SHOPS[left as InteriorId] && Object.keys(basket).length) setToast('Jätit täyden korin kauppaan.');
    setBasket({});
    setVisitThefts(0);
    setAtShelf(null);
    setAtTill(false);
  };

  const toBasket = (id: string) => setBasket((b) => ({ ...b, [id]: (b[id] ?? 0) + 1 }));
  const fromBasket = (id: string) =>
    setBasket((b) => {
      const n = { ...b };
      if ((n[id] ?? 0) > 1) n[id]!--;
      else delete n[id];
      return n;
    });
  const payBasket = () => {
    if (!player) return;
    const total = basketTotal(basket);
    if (player.money < total) return setToast('Rahat ei riitä.');
    const newSlots = Object.keys(basket).filter((id) => !player.inventory.some((s) => s.itemId === id)).length;
    if (player.inventory.length + newSlots > INVENTORY_SIZE) return setToast('🎒 Reppuun ei mahdu kaikki ostokset.');
    dispatch({ type: 'buyBasket', basket, total });
    setBasket({});
    setAtTill(false);
    setToast(`🧾 Maksoit ${total.toFixed(2).replace('.', ',')} €. Kiitos käynnistä!`);
  };

  const toPutka = (karma: number, reason: PutkaReason = 'theft') => {
    close();
    if (reason === 'theft') dispatch({ type: 'caughtStealing', karma });
    else dispatch({ type: 'adjustKarma', amount: karma });
    const sentence = reason === 'theft' ? 25 + Math.min(35, visitThefts * 6) : 30;
    setPutkaUntil(clockRef.current + sentence + 0.5);
    setPutkaLeft(sentence);
    teleport('police', POLICE_CELL_SPAWN);
    const what = reason === 'theft' ? 'Varastetut tavarat takavarikoitiin' : reason === 'stash' ? 'Kätkö takavarikoitiin' : 'Töhrimisestä tuli merkintä';
    window.setTimeout(() => setToast(`🚓 Putkaan ${sentence} s. ${what} · karma ${karma}`), 500);
  };
  const caughtStealing = (itemId: string) => {
    const karma = CAUGHT_KARMA_MULT * STEAL_KARMA * (visitThefts + 1);
    setAtShelf(null);
    setBasket({});
    say('Vartija', `Hetkinen! Mitä sulla on taskussa? ${itemName(itemId)}. Kamerat näki kaiken. Poliisi on jo tulossa.`, [
      {
        text: 'Ei se oo mitä luulet…',
        onPick: () => say('Vartija', 'Se on just sitä. Istu alas, partio vie sut asemalle.', [{ text: '…', onPick: () => toPutka(karma) }]),
      },
      { text: '[Juokse] Yritä livahtaa ovesta.', onPick: () => say('Vartija', 'Ovet on lukossa, kaveri. Hyvä yritys.', [{ text: 'Voi ei.', onPick: () => toPutka(karma - 2) }]) },
    ]);
  };
  // holding cell countdown
  useEffect(() => {
    if (putkaUntil === null) return;
    const id = window.setInterval(() => {
      const left = Math.max(0, Math.ceil(putkaUntil - clockRef.current));
      setPutkaLeft(left);
      if (left <= 0) {
        setPutkaUntil(null);
        say('Konstaapeli', 'Noniin. Kuulustelu on pidetty ja paperit täytetty. Olet vapaa lähtemään, mutta seuraavalla kerralla tulee sakot.', [
          { text: 'Kiitos. Ei toistu.', onPick: () => { dispatch({ type: 'adjustKarma', amount: 1 }); close(); } },
          { text: 'Katsotaan.', onPick: close },
        ]);
      }
    }, 500);
    return () => window.clearInterval(id);
  }, [putkaUntil]);

  const stealItem = (itemId: string) => {
    if (!player) return;
    if (!canAdd(player, itemId)) return setToast('🎒 Reppu on täynnä.');
    if (Math.random() < catchChance(player.sinceCaught ?? 0, alert)) return caughtStealing(itemId);
    dispatch({ type: 'stealItem', itemId });
    setVisitThefts((n) => n + 1);
    setToast(`🫳 ${itemName(itemId)} taskuun. Karma ${STEAL_KARMA}. Vartija vilkaisee suuntaasi…`);
  };
  /** `extra` = options other systems add (handing in a stash). */
  const talkAtPoliceDesk = (extra: DialogueOptionView[]) =>
    say('Päivystäjä', putkaUntil !== null ? 'Odota vuoroasi.' : 'Keravan poliisi, päivää. Miten voin auttaa?', [
      { text: 'Tulin vain kysymään tietä.', onPick: () => say('Päivystäjä', 'Asema on suoraan pohjoiseen. Prisma itään. Ja muista: kamerat näkee kaiken.', [{ text: 'Selvä.', onPick: close }]) },
      { text: 'Haluan ilmoittaa rikoksesta.', onPick: () => say('Päivystäjä', 'Ilmoituksen voi tehdä netissä. Mutta kiitos aktiivisuudesta.', [{ text: '(+1 karma) Selvä.', onPick: () => { dispatch({ type: 'adjustKarma', amount: 1 }); close(); } }]) },
      ...extra,
      { text: 'Ei mitään. Heippa.', onPick: close },
    ]);

  return {
    shop, alert, basket, atShelf, setAtShelf, atTill, setAtTill, putkaUntil, putkaLeft,
    leaveScene, toBasket, fromBasket, payBasket, stealItem, toPutka, talkAtPoliceDesk,
  };
}
