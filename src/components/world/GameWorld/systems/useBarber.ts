import { useMemo, useState } from 'react';
import { BARBER_PRICE, defaultAppearance, type Appearance } from '../../../../game/player/appearance';
import { playerOutfit } from '../../PlayerCharacter';
import type { GameCtx } from '../gameWorld.types';

/** The barber: preview a new hairstyle and pay for it. */
export function useBarber(ctx: GameCtx, color: string) {
  const { player, dispatch, setToast } = ctx;
  const appearance = player?.appearance;
  const money = player?.money ?? 0;
  const [barberDraft, setBarberDraft] = useState<Appearance | null>(null);
  const currentLook = appearance ?? defaultAppearance(color);
  const barberChanged = !!barberDraft && (barberDraft.hairStyle !== currentLook.hairStyle || barberDraft.hair !== currentLook.hair || barberDraft.facialHair !== currentLook.facialHair);
  const draftOutfit = useMemo(() => (barberDraft ? playerOutfit(color, barberDraft) : null), [barberDraft, color]);
  const payBarber = () => {
    if (!barberDraft) return;
    if (money < BARBER_PRICE) {
      setToast(`Leikkuu maksaa ${BARBER_PRICE} €. Rahat ei riitä.`);
      return;
    }
    dispatch({ type: 'setAppearance', appearance: { hairStyle: barberDraft.hairStyle, hair: barberDraft.hair, facialHair: barberDraft.facialHair }, cost: BARBER_PRICE });
    setBarberDraft(null);
    setToast(`✂ Uusi look! (−${BARBER_PRICE} €)`);
  };
  return { barberDraft, setBarberDraft, currentLook, barberChanged, draftOutfit, payBarber };
}
