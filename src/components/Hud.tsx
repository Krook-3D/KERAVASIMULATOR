import type { Player } from '../types/game';
import { levelFromXp, levelProgress } from '../game/xp/xp';
import type { GraphicsQuality } from '../services/settings';
import { toggleMute, useAudioSettings } from '../audio';
import { AURA_COLORS, AURA_NAMES, auraTier } from '../game/shop/shop';

interface HudProps {
  player: Player;
  graphics: GraphicsQuality;
  onToggleGraphics: () => void;
  onMenu?: () => void;
}

export function Hud({ player, graphics, onToggleGraphics, onMenu }: HudProps) {
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
        <div className="hud__chip">💰 {Number.isInteger(player.money) ? player.money : player.money.toFixed(2).replace('.', ',')} €</div>
        <KarmaChip karma={player.karma ?? 0} />
        <div className="hud__chip">⚡ {player.energy}</div>
      </div>
      <div className="hud__right">
        <SoundChip />
        <button type="button" className="hud__chip hud__gfx" onClick={onToggleGraphics} title="Vaihda grafiikan laatu">
          🎨 {graphics === 'high' ? 'Korkea' : 'Kevyt'}
        </button>
        {onMenu && (
          <button type="button" className="hud__chip hud__gfx" onClick={onMenu} title="Päävalikko">
            ☰
          </button>
        )}
      </div>
    </header>
  );
}

/** Karma bar from -100 to 100 with the aura name. */
function KarmaChip({ karma }: { karma: number }) {
  const tier = auraTier(karma);
  const pos = (karma + 100) / 2;
  return (
    <div className="hud__chip karma-chip" title={`Karma ${karma} · aura: ${AURA_NAMES[tier]}. Varastaminen laskee karmaa, kiinni jääminen kolminkertaisesti.`}>
      <span className="karma-chip__orb" style={{ background: AURA_COLORS[tier], boxShadow: `0 0 10px ${AURA_COLORS[tier]}` }} />
      <div className="karma-chip__bar">
        <div className="karma-chip__mid" />
        <div className="karma-chip__fill" style={karma >= 0 ? { left: '50%', width: `${pos - 50}%`, background: '#5ee07a' } : { left: `${pos}%`, width: `${50 - pos}%`, background: '#c84a6a' }} />
      </div>
      <span className="hud__label">{karma > 0 ? `+${karma}` : karma}</span>
    </div>
  );
}

/** Mute toggle (also the M key). */
function SoundChip() {
  const a = useAudioSettings();
  return (
    <button type="button" className="hud__chip hud__gfx" onClick={toggleMute} title={a.muted ? 'Äänet pois päältä (M)' : 'Mykistä äänet (M)'} aria-pressed={a.muted}>
      {a.muted ? '🔇' : '🔊'}
    </button>
  );
}
