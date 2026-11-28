import { useState } from 'react';
import { loadGraphicsQuality, saveGraphicsQuality, type GraphicsQuality } from '../services/settings';
import type { Player } from '../types/game';
import { useGame } from '../game/store/GameProvider';
import { GameWorld } from '../components/world/GameWorld';
import { Hud } from '../components/Hud';
import { BottomNav, type PanelId } from '../components/BottomNav';
import { Panel } from '../components/Panel';
import { CharacterPanel } from '../components/panels/CharacterPanel';
import { SkillsPanel } from '../components/panels/SkillsPanel';
import { InventoryPanel } from '../components/panels/InventoryPanel';
import { QuestsPanel } from '../components/panels/QuestsPanel';

const PANEL_TITLES: Record<PanelId, string> = {
  character: 'Hahmo',
  skills: 'Skillit',
  inventory: 'Reppu',
  quests: 'Questit',
};

function PanelContent({ id, player }: { id: PanelId; player: Player }) {
  switch (id) {
    case 'character':
      return <CharacterPanel player={player} />;
    case 'skills':
      return <SkillsPanel player={player} />;
    case 'inventory':
      return <InventoryPanel player={player} />;
    case 'quests':
      return <QuestsPanel player={player} />;
  }
}

export function GamePage({ player, onMenu }: { player: Player; onMenu?: () => void }) {
  const { dispatch } = useGame();
  const [panel, setPanel] = useState<PanelId | null>(null);
  const [gfx, setGfx] = useState<GraphicsQuality>(loadGraphicsQuality);
  const toggleGfx = () => {
    const next = gfx === 'high' ? 'low' : 'high';
    saveGraphicsQuality(next);
    setGfx(next);
  };

  return (
    <div className="game">
      <GameWorld
        start={player.position}
        color={player.color}
        playerName={player.name}
        introDone={!!player.introDone}
        onIntroDone={(position) => dispatch({ type: 'finishIntro', position })}
        highQuality={gfx === 'high'}
        onMove={(position) => dispatch({ type: 'movePlayer', position })}
      />
      {player.introDone && <Hud player={player} graphics={gfx} onToggleGraphics={toggleGfx} onMenu={onMenu} />}
      {!player.introDone ? null : panel ? (
        <Panel title={PANEL_TITLES[panel]} onClose={() => setPanel(null)}>
          <PanelContent id={panel} player={player} />
        </Panel>
      ) : (
        <div className="hint">Klikkaa: lukitse hiiri · nuolet/WASD liikkuu · E käyttää · oikea nappi: toiminnot · Esc vapauttaa</div>
      )}
      {player.introDone && <BottomNav active={panel} onSelect={setPanel} />}
    </div>
  );
}
