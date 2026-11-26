import type { Player } from '../../types/game';

export function QuestsPanel({ player }: { player: Player }) {
  const active = Object.entries(player.quests).filter(([, q]) => q.status === 'active');
  if (active.length === 0) {
    return (
      <p className="muted">
        Ei aktiivisia questeja. Keravalla tapahtuu kyllä, kunhan joku vain kertoisi mitä. Asemalla
        notkuu yleensä joku, jolla on asiaa.
      </p>
    );
  }
  return (
    <ul className="quest-list">
      {active.map(([id]) => (
        <li key={id}>› {id}</li>
      ))}
    </ul>
  );
}
