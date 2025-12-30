import { GameProvider } from '../context/GameContext';
import { GameMap } from './GameMap';
import { Controls } from './Controls';
import { GameOver } from './GameOver';
import './Game.css';

export function Game() {
  return (
    <GameProvider>
      <div className="game">
        <header className="game__header">
          <h1 className="game__title">Turn Tanks</h1>
          <p className="game__subtitle">Queue your actions, then execute!</p>
        </header>

        <main className="game__main">
          <GameMap />
          <Controls />
        </main>

        <GameOver />
      </div>
    </GameProvider>
  );
}
