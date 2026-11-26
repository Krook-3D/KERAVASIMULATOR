import type { Player } from '../types/game';
import { levelFromXp, levelProgress } from '../game/xp/xp';

export function Hud({ player }: { player: Player }) {
  const level = levelFromXp(player.xp);
  const progress = levelProgress(player.xp);

  return (
    <header className="hud">
      <div className="hud__logo">
        KERAVA<span>SIMULATOR</span>
      </div>
      <div className="hud__stats">
        <div className="hud__chip hud__chip--name">{player.name}</div>
        <div className="hud__chip">
          <span className="hud__label">LV {level}</span>
          <div className="hud__bar" aria-label={`XP ${Math.round(progress * 100)} %`}>
            <div className="hud__bar-fill" style={{ width: `${progress * 100}%` }} />
          </div>
        </div>
        <div className="hud__chip">💰 {player.money} €</div>
        <div className="hud__chip">⚡ {player.energy}</div>
      </div>
    </header>
  );
}
