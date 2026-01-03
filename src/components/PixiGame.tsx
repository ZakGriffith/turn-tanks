import { useEffect, useRef, useState, useCallback } from 'react';
import { GameEngine } from '../game/GameEngine';
import { GameState } from '../game/types';
import { UseMultiplayerReturn } from '../hooks/useMultiplayer';
import { GameUI } from './GameUI';
import { VolumeControl } from './VolumeControl';
import './PixiGame.css';

const GAME_WIDTH = 900;
const GAME_HEIGHT = 600;

// Message types for multiplayer sync (simplified for simultaneous turns)
type GameMessage = 
  | { type: 'action'; action: 'reset' }
  | { type: 'stateSync'; state: GameState };

interface PixiGameProps {
  onBackToMenu: () => void;
  multiplayer: UseMultiplayerReturn;
}

export function PixiGame({ onBackToMenu, multiplayer }: PixiGameProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const initedRef = useRef(false);
  const blockStateSyncRef = useRef(false); // Block state syncs during remote execution
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [waitingForHost, setWaitingForHost] = useState(!multiplayer.state.isHost);

  // Extract multiplayer state and methods
  const { isHost } = multiplayer.state;
  const { sendMessage, onMessage } = multiplayer;

  // Determine which player number this client is (0 = Blue/host, 1 = Red/guest)
  const localPlayerIndex = isHost ? 0 : 1;

  // Sync state to remote player (both players send their state for simultaneous turns)
  const syncStateToRemote = useCallback((state: GameState) => {
    // Both players sync their state so opponent can see ready status
    sendMessage(state);
  }, [sendMessage]);

  // Handle state changes from game engine
  const handleStateChange = useCallback((state: GameState) => {
    setGameState(state);
    syncStateToRemote(state);
  }, [syncStateToRemote]);

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
          handleStateChange
        );
        
        engineRef.current = engine;
        setIsLoading(false);

        // Set which player index this client is (for simultaneous turns)
        engine.setLocalPlayerIndex(localPlayerIndex);

        // If host, send initial state to guest after a short delay
        // to ensure guest has time to set up their message handler
        if (isHost && engine) {
          const hostEngine = engine; // Capture for closure
          setTimeout(() => {
            const initialState = hostEngine.getState();
            console.log('[PixiGame] Host sending initial state');
            sendMessage(initialState);
          }, 500);
        }
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
  }, [handleStateChange, isHost, sendMessage]);

  // Set up message handler for receiving remote actions
  useEffect(() => {
    onMessage((data: unknown) => {
      const message = data as GameMessage & { state?: unknown };
      console.log('[PixiGame] Received message type:', message.type, 'isHost:', isHost);
      
      // Debug: log if state has a nested type
      if (message.state && typeof message.state === 'object' && 'type' in (message.state as object)) {
        console.log('[PixiGame] Nested message type:', (message.state as { type: string }).type);
      }
      
      if (message.type === 'stateSync') {
        // Both players receive state updates from each other
        // Skip if currently animating
        if (blockStateSyncRef.current || engineRef.current?.isAnimating()) {
          console.log('[PixiGame] Skipping stateSync - animations in progress');
          return;
        }
        
        const innerData = message.state as { type?: string; state?: GameState } | GameState;
        
        console.log('[PixiGame] Processing stateSync');
        setWaitingForHost(false);
        
        // The state might be wrapped or direct - handle both cases
        const gameState = (innerData && typeof innerData === 'object' && 'tanks' in innerData)
          ? innerData as GameState
          : null;
        
        if (gameState) {
          engineRef.current?.syncFromRemote(gameState);
        }
      } else if (message.type === 'action' && isHost) {
        // Host receives action syncs from guest
        const engine = engineRef.current;
        if (!engine) return;
        
        const actionMessage = message as GameMessage;
        if ('action' in actionMessage) {
          switch (actionMessage.action) {
            case 'reset':
              engine.resetGame();
              break;
            // Other actions are handled locally by the guest now
            // and synced via stateSync
          }
        }
      }
    });
  }, [isHost, onMessage]);

  // With simultaneous turns, both players handle their own actions locally
  // State sync happens automatically via handleStateChange
  const handleSetActionType = useCallback((type: 'move' | 'shoot') => {
    engineRef.current?.setActionType(type);
  }, []);

  const handleClearQueue = useCallback(() => {
    engineRef.current?.clearQueue();
  }, []);

  const handleExecute = useCallback(() => {
    // "Execute" now means "Submit Turn" - mark this player as ready
    engineRef.current?.executeActions(); // This calls submitTurn internally
    
    // Sync the ready state
    const currentState = engineRef.current?.getState();
    if (currentState) {
      sendMessage({ type: 'stateSync', state: currentState });
    }
  }, [sendMessage]);

  const handleRematch = useCallback(() => {
    // Request rematch - both players must agree
    engineRef.current?.requestRematch();
    
    // Sync the rematch state
    const currentState = engineRef.current?.getState();
    if (currentState) {
      sendMessage({ type: 'stateSync', state: currentState });
    }
  }, [sendMessage]);

  // Note: Canvas clicks are handled directly by PixiJS in the GameEngine
  // Both players now handle their own clicks locally

  return (
    <div className="pixi-game">
      <header className="pixi-game__header">
        <button className="pixi-game__back-btn" onClick={onBackToMenu}>
          ← Menu
        </button>
        <p className="pixi-game__subtitle">TURN TANKS</p>
        <VolumeControl />
      </header>

      <div 
        className="pixi-game__container" 
        ref={containerRef}
      >
        {isLoading && (
          <div className="pixi-game__overlay">
            <div className="pixi-game__loading">
              <div className="pixi-game__loading-spinner" />
              <span>Loading...</span>
            </div>
          </div>
        )}

        {waitingForHost && !isLoading && (
          <div className="pixi-game__overlay">
            <div className="pixi-game__loading">
              <div className="pixi-game__loading-spinner" />
              <span>Waiting for host...</span>
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
              
              {/* Rematch status */}
              <div className="pixi-game__rematch-status">
                <div className={`pixi-game__rematch-player ${gameState.playersWantRematch?.[0] ? 'ready' : ''}`}>
                  <span className="pixi-game__rematch-indicator" style={{ background: '#3b82f6' }} />
                  <span>{gameState.tanks[0]?.name || 'Player 1'}</span>
                  <span className="pixi-game__rematch-check">
                    {gameState.playersWantRematch?.[0] ? '✓ Ready' : 'Waiting...'}
                  </span>
                </div>
                <div className={`pixi-game__rematch-player ${gameState.playersWantRematch?.[1] ? 'ready' : ''}`}>
                  <span className="pixi-game__rematch-indicator" style={{ background: '#ef4444' }} />
                  <span>{gameState.tanks[1]?.name || 'Player 2'}</span>
                  <span className="pixi-game__rematch-check">
                    {gameState.playersWantRematch?.[1] ? '✓ Ready' : 'Waiting...'}
                  </span>
                </div>
              </div>
              
              <div className="pixi-game__game-over-buttons">
                <button 
                  onClick={handleRematch}
                  disabled={gameState.playersWantRematch?.[localPlayerIndex]}
                  className={gameState.playersWantRematch?.[localPlayerIndex] ? 'pixi-game__btn-ready' : ''}
                >
                  {gameState.playersWantRematch?.[localPlayerIndex] ? '✓ Waiting for opponent...' : 'Play Again'}
                </button>
                <button className="pixi-game__menu-btn" onClick={onBackToMenu}>Main Menu</button>
              </div>
            </div>
          </div>
        )}

      </div>

      {gameState && !isLoading && !error && !waitingForHost && (
        <GameUI
          state={gameState}
          onSetActionType={handleSetActionType}
          onClearQueue={handleClearQueue}
          onExecute={handleExecute}
          localPlayerIndex={localPlayerIndex}
        />
      )}
    </div>
  );
}
