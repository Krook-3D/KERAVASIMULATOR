import { GameProvider, useGame } from './game/store/GameProvider';
import { CharacterCreatePage } from './pages/CharacterCreatePage';
import { GamePage } from './pages/GamePage';

function Screens() {
  const { state } = useGame();
  // Key by player id so a new character gets a fresh map.
  return state.player ? <GamePage key={state.player.id} player={state.player} /> : <CharacterCreatePage />;
}

export default function App() {
  return (
    <GameProvider>
      <Screens />
    </GameProvider>
  );
}
