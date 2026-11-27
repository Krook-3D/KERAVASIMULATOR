import { useEffect } from 'react';
import { drugUnits } from '../../../../game/shop/shop';
import { levelFromXp } from '../../../../game/xp/xp';
import type { WorldDoorId } from '../../../../game/interiors/interiors';
import type { GameCtx, WorldDoor } from '../gameWorld.types';
import type { PutkaReason } from './useShop';

/**
 * Public alert from carrying drugs: near the centre a patrol may stop you
 * (checked every 30 s) unless you are already busy with something.
 */
export function usePolicePatrol(
  ctx: GameCtx,
  opts: { doors: Record<WorldDoorId, WorldDoor> | null; alert: number; occupied: boolean; toPutka: (karma: number, reason: PutkaReason) => void },
) {
  const { player, dispatch, scene, dialogue, cutscene, positionRef, say, close, setToast } = ctx;
  const { doors, alert, occupied, toPutka } = opts;
  const skillLv = (id: 'hustling' | 'evasion' | 'running') => levelFromXp(player?.skills[id]?.xp ?? 0);
  // Re-subscribes every render so the interval always sees the latest state (as before the split).
  useEffect(() => {
    if (scene !== 'world' || !doors) return;
    const id = window.setInterval(() => {
      if (!player || dialogue || cutscene || occupied) return;
      const units = drugUnits(player);
      if (units < 4) return;
      const pos = positionRef.current;
      const centre = doors['station-town'].at;
      if (Math.hypot(centre[0] - pos.x, centre[1] - pos.z) > 350) return;
      if (Math.random() > 0.1 + Math.min(0.25, alert * 0.003)) return;
      const hustle = skillLv('hustling'), evade = Math.max(skillLv('evasion'), skillLv('running'));
      say('Poliisipartio', 'Iltaa. Rutiinitarkastus. Sulla näyttää olevan reppu aika täynnä. Mitä siellä on?', [
        {
          text: '[Hustlaus 7] Salilisäravinteita. Proteiinia ja vitamiineja.',
          onPick: () => (hustle >= 7 ? (dispatch({ type: 'grantReward', reward: { skillXp: { hustling: 40 } } }), say('Poliisipartio', 'Hmm. Jatka matkaa.', [{ text: 'Kiitos.', onPick: close }], `Hustlaus ${hustle}/7: onnistui`)) : say('Poliisipartio', 'Katsotaanpa… Nämä lähtee meidän mukaan. Ja sinä myös.', [{ text: 'Voi ei.', onPick: () => { dispatch({ type: 'confiscateDrugs' }); toPutka(-5, 'stash'); } }], `Hustlaus ${hustle}/7: ei riittänyt`)),
        },
        {
          text: '[Pakoilu 6] Juokse.',
          onPick: () => (evade >= 6 ? (dispatch({ type: 'grantReward', reward: { skillXp: { evasion: 50 } } }), close(), setToast('🏃 Karistit partion! +50 Kyttien pakoilu XP')) : say('Poliisipartio', 'Seis! *saa sinut kiinni*', [{ text: 'Auts.', onPick: () => { dispatch({ type: 'confiscateDrugs' }); toPutka(-6, 'stash'); } }], `Pakoilu ${evade}/6: ei riittänyt`)),
        },
        { text: 'Ottakaa ne. En halua ongelmia.', onPick: () => { dispatch({ type: 'confiscateDrugs' }); dispatch({ type: 'adjustKarma', amount: 1 }); close(); setToast('Partio takavarikoi tavarat ja päästi sinut varoituksella.'); } },
      ]);
    }, 30000);
    return () => window.clearInterval(id);
  });
}
