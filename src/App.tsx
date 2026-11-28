import { useState } from 'react';
import { GameProvider, useGame } from './game/store/GameProvider';
import { OnlineProvider } from './game/online/OnlineProvider';
import { CharacterCreatePage } from './pages/CharacterCreatePage';
import { GamePage } from './pages/GamePage';
import { MainMenu } from './pages/MainMenu';

function Screens() {
  const { state } = useGame();
  const [inMenu, setInMenu] = useState(true);
  if (inMenu) return <MainMenu onPlay={() => setInMenu(false)} />;
  // Key by player id so a new character gets a fresh map.
  return state.player ? <GamePage key={state.player.id} player={state.player} onMenu={() => setInMenu(true)} /> : <CharacterCreatePage />;
}

export default function App() {
  return (
    <GameProvider>
      <OnlineProvider>
        <Screens />
      </OnlineProvider>
    </GameProvider>
  );
}
