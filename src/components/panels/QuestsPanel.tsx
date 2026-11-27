import type { Player } from '../../types/game';
import { QUESTS } from '../../game/quests/jailbreak';

export function QuestsPanel({ player }: { player: Player }) {
  const entries = Object.entries(player.quests);
  const active = entries.filter(([, q]) => q.status === 'active');
  const done = entries.filter(([, q]) => q.status === 'completed');
  if (entries.length === 0) {
    return (
      <p className="muted">
        Ei aktiivisia questeja. Keravalla tapahtuu kyllä, kunhan joku vain kertoisi mitä. Asematunnelin
        suulla notkuu yleensä joku, jolla on asiaa.
      </p>
    );
  }
  return (
    <div className="stack">
      <ul className="quest-list">
        {active.map(([id, q]) => {
          const def = QUESTS[id];
          const obj = def?.objectives[q.objectiveIndex];
          return (
            <li key={id} className="quest">
              <strong>{def?.title ?? id}</strong>
              {def && <p className="muted">{def.description}</p>}
              {obj && <p>› {obj.text}</p>}
            </li>
          );
        })}
      </ul>
      {done.length > 0 && (
        <ul className="quest-list">
          {done.map(([id]) => (
            <li key={id} className="quest is-done">
              ✓ {QUESTS[id]?.title ?? id}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
