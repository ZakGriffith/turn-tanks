import { useGame } from '../context/GameContext';
import './GameOver.css';

export function GameOver() {
  const { state, resetGame } = useGame();

  if (state.phase !== 'game-over') return null;

  return (
    <div className="game-over-overlay">
      <div className="game-over">
        <h2 className="game-over__title">Game Over!</h2>
        <p className="game-over__winner">{state.winner} Wins!</p>
        <button className="game-over__button" onClick={resetGame}>
          Play Again
        </button>
      </div>
    </div>
  );
}

