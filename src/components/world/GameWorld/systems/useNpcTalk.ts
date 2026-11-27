import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import type { WorldXZ } from '../../../../game/world/projection';
import { levelFromXp } from '../../../../game/xp/xp';
import type { Npc } from '../../../../game/npc/population';
import { speakerName, talkTreeFor, type TalkOption, type TalkTree } from '../../../../game/npc/talk';
import type { STASH_DEFS } from '../../../../game/quests/stashes';
import type { NpcLive } from '../../npc/Crowd';
import { dist } from '../constants';
import type { GameCtx } from '../gameWorld.types';

type StashDef = (typeof STASH_DEFS)[number];

/**
 * Talking to town NPCs: walk up to them, then RuneScape-style dialogue trees
 * with hustle checks and effects. The station crew also fences kept stashes.
 */
export function useNpcTalk(
  ctx: GameCtx,
  opts: {
    npcs: Npc[];
    npcLive: MutableRefObject<NpcLive>;
    /** True while something else blocks clicks (training, riding). */
    blocked: boolean;
    walkTo: (p: WorldXZ) => void;
    stash: { deliverable: StashDef[]; stashValue: (d: StashDef) => number; fenceStash: (d: StashDef) => void };
  },
) {
  const { player, dispatch, dialogue, cutscene, fading, positionRef, setRoute, setToast, say, close } = ctx;
  const { npcs, npcLive, blocked, walkTo, stash } = opts;
  const [talkingId, setTalkingId] = useState<string | null>(null);
  const pendingTalk = useRef<string | null>(null);

  useEffect(() => {
    if (!dialogue) setTalkingId(null);
  }, [dialogue]);
  const runTalk = (npc: Npc, tree: TalkTree, nodeId = 'start') => {
    const node = tree[nodeId] ?? tree.start;
    say(speakerName(npc), node.text, node.options.map((o) => ({ text: o.text, onPick: () => pickTalk(npc, tree, o) })));
  };
  const pickTalk = (npc: Npc, tree: TalkTree, o: TalkOption) => {
    if (o.next) return runTalk(npc, tree, o.next);
    const hustle = levelFromXp(player?.skills.hustling?.xp ?? 0);
    const ok = o.hustle === undefined || hustle >= o.hustle;
    let eff = ok ? o.effect : o.failEffect;
    let reply = ok ? o.reply : o.failReply ?? o.reply;
    if (eff?.money && eff.money < 0 && (player?.money ?? 0) < -eff.money) {
      reply = 'Ai sulla ei ookaan rahaa? No ei sitten.';
      eff = undefined;
    }
    if (eff?.karma) dispatch({ type: 'adjustKarma', amount: eff.karma });
    if (eff?.money || eff?.health) dispatch({ type: 'adjustStats', money: eff.money, health: eff.health });
    if (eff?.hustlingXp) dispatch({ type: 'grantReward', reward: { skillXp: { hustling: eff.hustlingXp } } });
    const bits = [eff?.karma ? `karma ${eff.karma > 0 ? '+' : ''}${eff.karma}` : '', eff?.hustlingXp ? `+${eff.hustlingXp} Hustlaus XP` : '', eff?.money ? `${eff.money > 0 ? '+' : ''}${eff.money} €` : ''].filter(Boolean);
    say(speakerName(npc), reply ?? '…', [{ text: 'Heippa.', onPick: close }], o.hustle !== undefined ? (ok ? `Hustlaus ${hustle}/${o.hustle}: onnistui` : `Hustlaus ${hustle}/${o.hustle}: ei riittänyt`) : undefined);
    if (eff?.toast) setToast(eff.toast);
    else if (bits.length) setToast(bits.join(' · '));
  };
  const startTalk = (npc: Npc) => {
    pendingTalk.current = null;
    setRoute([]);
    setTalkingId(npc.follow ?? npc.id);
    const d = stash.deliverable[0];
    if (d && npc.crew === 'laituri') {
      const pay = Math.round(stash.stashValue(d) * 0.55);
      say(speakerName(npc), 'Kuulin et sä löysit jotain metsästä. Lasse ostaa. Mitä sulla on?', [
        { text: `Myy kätkön tavarat (${pay} €)`, onPick: () => stash.fenceStash(d) },
        { text: 'Ei mulla mitään. Mitä kuuluu?', onPick: () => runTalk(npc, talkTreeFor(npc)) },
      ]);
      return;
    }
    runTalk(npc, talkTreeFor(npc));
  };
  const onNpcClick = (npc: Npc) => {
    if (cutscene || dialogue || fading || blocked) return;
    const at = npcLive.current.get(npc.id)?.p ?? npc.at;
    if (!at) return;
    const here: WorldXZ = [positionRef.current.x, positionRef.current.z];
    if (dist(here, at) < 3.5) return startTalk(npc);
    const k = 1.4 / Math.max(1e-3, dist(here, at));
    const goal: WorldXZ = [at[0] + (here[0] - at[0]) * k, at[1] + (here[1] - at[1]) * k];
    walkTo(goal);
    pendingTalk.current = npc.id;
  };
  /** On arrival: start a talk that was waiting for the walk, if the NPC is still close. */
  const arrived = (p: WorldXZ) => {
    const pend = pendingTalk.current ? npcs.find((n) => n.id === pendingTalk.current) : undefined;
    if (pend) {
      const at = npcLive.current.get(pend.id)?.p;
      if (at && dist(at, p) < 6) startTalk(pend);
      else setToast(`${pend.name} käveli jo ohi.`);
      pendingTalk.current = null;
    }
  };

  return { talkingId, pendingTalk, onNpcClick, arrived };
}
