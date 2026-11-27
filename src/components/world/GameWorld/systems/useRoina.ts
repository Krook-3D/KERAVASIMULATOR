import { ROINA, strainEffect, type RoinaId } from '../../../../game/gym/roina';
import { canAdd } from '../../../../game/store/gameReducer';
import { itemName } from '../../../../data/items';
import type { GameCtx } from '../gameWorld.types';

/** Pumppi-Pete in the gym's back room sells fictional "supplements" (game-abstract buffs + strain). */
export function useRoina(ctx: GameCtx) {
  const { player, dispatch, say, close } = ctx;
  const money = player?.money ?? 0;
  const buyRoina = (id: RoinaId) => {
    const d = ROINA[id];
    if (!player) return;
    if (player.money < d.price) return say('Pumppi-Pete', 'Ei rahaa, ei kamaa. Tuu takas kun on.', [{ text: 'Okei.', onPick: close }]);
    if (!canAdd(player, id)) return say('Pumppi-Pete', 'Sun reppu on täynnä, bro.', [{ text: 'Okei.', onPick: close }]);
    dispatch({ type: 'adjustStats', money: -d.price });
    dispatch({ type: 'addItem', itemId: id });
    if (d.karma) dispatch({ type: 'adjustKarma', amount: d.karma });
    dispatch({ type: 'grantReward', reward: { skillXp: { hustling: 6 } } });
    say('Pumppi-Pete', `Siinä. ${itemName(id)}. Ja muista: sä et saanu tätä multa.`, [{ text: 'Mitä muuta sulla on?', onPick: talkToPete }, { text: 'Kiitti.', onPick: close }]);
  };
  const talkToPete = () =>
    say(
      'Pumppi-Pete',
      'Psst. Haluuks sä kasvaa nopeemmin? Mulla on "lisäravinteita". Ei mitään laillista, ei mitään takuita. Rasitus kasvaa, ja liika rasitus tuntuu kropassa.',
      [
        ...(['tankkioljy', 'massamix', 'kuivatin', 'palautin', 'tuplaus', 'leikkuri'] as RoinaId[]).map((id) => ({
          text: `${itemName(id)} · ${ROINA[id].price} € — ${ROINA[id].blurb}`,
          onPick: () => buyRoina(id),
        })),
        { text: 'Ei kiitos, mä treenaan puhtaasti.', onPick: () => { dispatch({ type: 'adjustKarma', amount: 1 }); close(); } },
      ],
      `Rahaa ${money} € · rasitus ${Math.round(player?.strain ?? 0)}/100 · ${strainEffect(player?.strain ?? 0).label}`,
    );
  return { talkToPete };
}
