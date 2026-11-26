import { useState } from 'react';
import type { LngLat } from './types/game';
import { createPlayer } from './game/player/createPlayer';
import { GameMap } from './components/GameMap';
import { Hud } from './components/Hud';

export default function App() {
  // Phase 1: a default character. Character creation and saving come in phase 3.
  const [player, setPlayer] = useState(() => createPlayer('Keravalainen'));

  const handleMove = (position: LngLat) => setPlayer((p) => ({ ...p, position }));

  return (
    <div className="game">
      <GameMap player={player} onMove={handleMove} />
      <Hud player={player} />
      <div className="hint">Klikkaa karttaa liikkuaksesi</div>
    </div>
  );
}
