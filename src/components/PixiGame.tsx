import { useEffect, useRef, useState, useCallback } from 'react';
import { GameEngine } from '../game/GameEngine';
import { GameState } from '../game/types';
import { GameUI } from './GameUI';
import './PixiGame.css';

const GAME_WIDTH = 900;
const GAME_HEIGHT = 600;

export function PixiGame() {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const initedRef = useRef(false);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Prevent double init in strict mode
    if (initedRef.current) return;
    initedRef.current = true;
    
    const container = containerRef.current;
    if (!container) return;

    let engine: GameEngine | null = null;

    const initGame = async () => {
      try {
        engine = await GameEngine.create(
          container,
          GAME_WIDTH,
          GAME_HEIGHT,
          setGameState
        );
        
        engineRef.current = engine;
        setIsLoading(false);
      } catch (err) {
        console.error('Failed to initialize game:', err);
        setError('Failed to initialize game. Your browser may not support WebGL.');
        setIsLoading(false);
      }
    };

    initGame();

    return () => {
      if (engineRef.current) {
        engineRef.current.destroy();
        engineRef.current = null;
      }
    };
  }, []);

  const handleSetActionType = useCallback((type: 'move' | 'shoot') => {
    engineRef.current?.setActionType(type);
  }, []);

  const handleClearQueue = useCallback(() => {
    engineRef.current?.clearQueue();
  }, []);

  const handleExecute = useCallback(() => {
    engineRef.current?.executeActions();
  }, []);

  const handleReset = useCallback(() => {
    engineRef.current?.resetGame();
  }, []);

  return (
    <div className="pixi-game">
      <header className="pixi-game__header">
        <p className="pixi-game__subtitle">TURN TANKS</p>
      </header>

      <div className="pixi-game__container" ref={containerRef}>
        {isLoading && (
          <div className="pixi-game__overlay">
            <div className="pixi-game__loading">
              <div className="pixi-game__loading-spinner" />
              <span>Loading...</span>
            </div>
          </div>
        )}
        
        {error && (
          <div className="pixi-game__overlay">
            <div className="pixi-game__error">
              <p>{error}</p>
            </div>
          </div>
        )}
        
        {gameState?.phase === 'game-over' && (
          <div className="pixi-game__overlay">
            <div className="pixi-game__game-over">
              <h2>VICTORY</h2>
              <p>{gameState.winner} Wins!</p>
              <button onClick={handleReset}>Play Again</button>
            </div>
          </div>
        )}
      </div>

      {gameState && !isLoading && !error && (
        <GameUI
          state={gameState}
          onSetActionType={handleSetActionType}
          onClearQueue={handleClearQueue}
          onExecute={handleExecute}
        />
      )}
    </div>
  );
}
