import { useCallback, type MutableRefObject } from 'react';
import { JAILBREAK, JAILBREAK_ID, JAILBREAK_STEP } from '../../../../game/quests/jailbreak';
import { levelFromXp } from '../../../../game/xp/xp';
import { newJailLive, type JailLive } from '../../quest/Jailbreak';
import { CELL_SPAWN } from '../constants';
import type { GameCtx } from '../gameWorld.types';

/** Quest "Viilattu vapaus": Jonne's bag, the arrest, the visit with the file, the guards and the escape. */
export function useJailbreak(ctx: GameCtx, jailStep: number, jailLive: MutableRefObject<JailLive>, holdingRef: MutableRefObject<boolean>) {
  const { player, dispatch, say, close, teleport, goTo, setToast, setRoute, setDialogue } = ctx;

  const sendToJail = () => {
    dispatch({ type: 'setQuestStep', questId: JAILBREAK_ID, step: JAILBREAK_STEP.visit });
    jailLive.current = newJailLive();
    close();
    teleport('prison', CELL_SPAWN);
    window.setTimeout(() => setToast('Sinut vietiin Keravan vankilaan. Questit-paneelissa: Viilattu vapaus.'), 500);
  };

  const arrest = () => {
    const hustle = levelFromXp(player?.skills.hustling?.xp ?? 0);
    say('Poliisi', 'Poliisi, seis! Mitäs tuossa pussissa on?', [
      { text: 'Ei se oo mun! Joku Jonne antoi sen…', onPick: () => say('Poliisi', 'Jonne. Aivan. Niitä on Keravalla aika monta. Lähdetään asemalle.', [{ text: 'Voihan vittu.', onPick: sendToJail }]) },
      { text: 'Pullaa. Ihan vaan pullaa.', onPick: () => say('Poliisi', 'Pullaa ei yleensä pakata noin. Mukaan vaan.', [{ text: '…', onPick: sendToJail }]) },
      {
        text: '[Hustlaus 10] Selitä tilanne rauhallisesti.',
        onPick: () =>
          hustle >= 10
            ? say('Poliisi', 'No… mene sitten. Mutta pidä nenäsi puhtaana.', [{ text: 'Kiitos, konstaapeli.', onPick: close }])
            : say('Poliisi', 'Joo joo. Selität sitten kuulustelussa.', [{ text: 'Voihan vittu.', onPick: sendToJail }], `Hustlauksesi ei riittänyt (taso ${hustle}/10).`),
      },
    ]);
  };

  const talkToJonne = () => {
    if (jailStep !== JAILBREAK_STEP.notStarted) {
      say('Jonne', jailStep === JAILBREAK_STEP.done ? 'Ai sä pääsit pois? Respect. Mä en tiedä mitään mistään.' : 'Mitä?', [{ text: 'Painu hiiteen, Jonne.', onPick: close }]);
      return;
    }
    say('Jonne', 'Hei kaveri! Voisitko pitää tätä pussia hetken? Mä käyn vaan tossa kioskilla. Kaks minuuttia, max.', [
      {
        text: 'Okei, anna tänne.',
        onPick: () =>
          say('Jonne', 'Kiitti, oot kingi! Älä sit avaa sitä.', [
            { text: '(Odota…)', onPick: () => say('Kertoja', 'Jonne katoaa tunneliin. Hetken päästä sireenit ulvovat aukiolla.', [{ text: 'Mitä hel…', onPick: arrest }]) },
          ]),
      },
      { text: 'En koske tuntemattomien pusseihin.', onPick: () => say('Jonne', 'Tylsimys. Mä kysyn joltain muulta.', [{ text: 'Hyvä niin.', onPick: close }]) },
    ]);
  };

  const visit = () =>
    say('Vartija', 'Sulle on vieras. Tapaamishuone, viisi minuuttia.', [
      {
        text: 'Mennään.',
        onPick: () =>
          say('Serkku Pasi', 'No moi! Äiti leipoi sulle pullaa. Syö se ihan RAUHASSA. Ja yksin. Ymmärsitkö? Yksin.', [
            {
              text: 'Ymmärsin… luulisin.',
              onPick: () =>
                say('Kertoja', 'Pullan sisältä löytyy pieni metalliviila. Kiitos, Pasi.', [
                  {
                    text: 'Takaisin selliin.',
                    onPick: () => {
                      dispatch({ type: 'addItem', itemId: 'viila' });
                      dispatch({ type: 'addItem', itemId: 'pulla' });
                      dispatch({ type: 'setQuestStep', questId: JAILBREAK_ID, step: JAILBREAK_STEP.file });
                      jailLive.current.progress = 0;
                      close();
                      teleport('prison', CELL_SPAWN);
                    },
                  },
                ]),
            },
          ]),
      },
    ]);

  const onCaught = useCallback(() => {
    holdingRef.current = false;
    setRoute([]);
    setDialogue({
      speaker: 'Vartija',
      text: jailStep === JAILBREAK_STEP.escape ? 'HEI! Minne luulet meneväsi?! Takaisin selliin!' : 'Mitäs täällä raaputetaan?! Anna tänne se!',
      note: 'Jäit kiinni. Viila takavarikoitiin ja kalterit korjattiin.',
      options: [
        {
          text: 'Voi ei…',
          onPick: () => {
            dispatch({ type: 'removeItem', itemId: 'viila' });
            dispatch({ type: 'setQuestStep', questId: JAILBREAK_ID, step: JAILBREAK_STEP.visit });
            jailLive.current.progress = 0;
            setDialogue(null);
            teleport('prison', CELL_SPAWN);
          },
        },
      ],
    });
  }, [dispatch, jailStep, teleport]);

  const onFiled = useCallback(() => {
    holdingRef.current = false;
    dispatch({ type: 'setQuestStep', questId: JAILBREAK_ID, step: JAILBREAK_STEP.escape });
    setToast('Kalterit poikki! Nyt hiljaa ulos.');
  }, [dispatch]);

  const escaped = () => {
    dispatch({ type: 'setQuestStep', questId: JAILBREAK_ID, step: JAILBREAK_STEP.done, completed: true });
    dispatch({ type: 'grantReward', reward: JAILBREAK.rewards });
    dispatch({ type: 'removeItem', itemId: 'viila' });
    goTo({ scene: 'world', door: 'prison-yard' });
    window.setTimeout(() => setToast('✓ Quest suoritettu: Viilattu vapaus · +250 Kyttien pakoilu XP · +40 Hustlaus XP'), 500);
  };

  return { talkToJonne, visit, onCaught, onFiled, escaped };
}
