import { useEffect, useRef, useState, useCallback } from 'react';
import { GameEngine } from '../game/GameEngine';
import { GameState } from '../game/types';
import { SoundManager } from '../game/SoundManager';
import { UseMultiplayerReturn } from '../hooks/useMultiplayer';
import { GameUI } from './GameUI';
import { VolumeControl } from './VolumeControl';
import './PixiGame.css';

const GAME_WIDTH = 900;
const GAME_HEIGHT = 600;

// Message types for multiplayer sync
type GameMessage = 
  | { type: 'action'; action: 'setActionType'; payload: 'move' | 'shoot' }
  | { type: 'action'; action: 'click'; payload: { x: number; y: number } }
  | { type: 'action'; action: 'clearQueue' }
  | { type: 'action'; action: 'execute' }
  | { type: 'action'; action: 'reset' }
  | { type: 'stateSync'; state: GameState }
  | { type: 'executeActions'; state: GameState }; // Broadcast to trigger animations on guest

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

  // Determine which player number this client is (1 = Blue/host, 2 = Red/guest)
  const localPlayerIndex = isHost ? 0 : 1;

  // Check if it's this player's turn
  const isMyTurn = gameState ? gameState.currentPlayerIndex === localPlayerIndex : false;

  // Sync state to remote player (host sends state updates)
  const syncStateToRemote = useCallback((state: GameState) => {
    if (isHost) {
      // Send just the game state - useMultiplayer will wrap it for the server
      sendMessage(state);
    }
  }, [isHost, sendMessage]);

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

        // Set initial input state - host (Player 1) goes first
        engine.setLocalInputEnabled(isHost);

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
      
      if (message.type === 'stateSync' && !isHost) {
        // Guest receives state updates from host
        // The state might be a special command (executeActions) or regular game state
        const innerData = message.state as { type?: string; state?: GameState } | GameState;
        
        // Check if this is an executeActions command wrapped in stateSync
        if (innerData && typeof innerData === 'object' && 'type' in innerData && innerData.type === 'executeActions') {
          console.log('[PixiGame] Guest received executeActions command');
          setWaitingForHost(false);
          const gameState = innerData.state as GameState;
          console.log('[PixiGame] Action queue length:', gameState?.actionQueue?.length);
          if (gameState && engineRef.current) {
            // Block state syncs while we execute animations
            blockStateSyncRef.current = true;
            
            // Only sync the action queue - DON'T move tanks (so animations can play)
            engineRef.current.syncForExecution(gameState);
            console.log('[PixiGame] Calling executeActions on guest engine');
            engineRef.current.executeActions().then(() => {
              console.log('[PixiGame] Guest animations complete');
              blockStateSyncRef.current = false;
            });
          } else {
            console.log('[PixiGame] Missing gameState or engine:', { gameState: !!gameState, engine: !!engineRef.current });
          }
          return;
        }
        
        // Skip regular state syncs if currently animating or blocked
        if (blockStateSyncRef.current || engineRef.current?.isAnimating()) {
          console.log('[PixiGame] Skipping stateSync - animations in progress or blocked');
          return;
        }
        
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
        // Host receives actions from guest and executes them
        const engine = engineRef.current;
        if (!engine) return;
        
        const actionMessage = message as GameMessage;
        if ('action' in actionMessage) {
          switch (actionMessage.action) {
            case 'setActionType':
              engine.setActionType(actionMessage.payload as 'move' | 'shoot');
              break;
            case 'click':
              const payload = actionMessage.payload as { x: number; y: number };
              engine.handleRemoteClick(payload.x, payload.y);
              break;
            case 'clearQueue':
              engine.clearQueue();
              break;
            case 'execute':
              // Broadcast state with action queue to guest so they can animate too
              const currentState = engine.getState();
              sendMessage({ type: 'executeActions', state: currentState });
              engine.executeActions();
              break;
            case 'reset':
              engine.resetGame();
              break;
          }
        }
      }
    });
  }, [isHost, onMessage]);

  // Update engine's local input enabled state when turn changes
  // ONLY host should have direct engine input - guest sends messages via React onClick
  useEffect(() => {
    if (engineRef.current) {
      // Host: enable input on their turn
      // Guest: NEVER enable direct input (they use React onClick to send to host)
      engineRef.current.setLocalInputEnabled(isHost && isMyTurn);
    }
  }, [isHost, isMyTurn]);

  const handleSetActionType = useCallback((type: 'move' | 'shoot') => {
    if (!isMyTurn) return;
    
    if (isHost) {
      engineRef.current?.setActionType(type);
    } else {
      // Guest sends action to host
      sendMessage({ type: 'action', action: 'setActionType', payload: type } as GameMessage);
    }
  }, [isMyTurn, isHost, sendMessage]);

  const handleClearQueue = useCallback(() => {
    if (!isMyTurn) return;
    
    if (isHost) {
      engineRef.current?.clearQueue();
    } else {
      sendMessage({ type: 'action', action: 'clearQueue' } as GameMessage);
    }
  }, [isMyTurn, isHost, sendMessage]);

  const handleExecute = useCallback(() => {
    if (!isMyTurn) return;
    
    if (isHost) {
      // Broadcast state with action queue to guest so they can animate too
      const currentState = engineRef.current?.getState();
      if (currentState) {
        sendMessage({ type: 'executeActions', state: currentState });
      }
      engineRef.current?.executeActions();
    } else {
      sendMessage({ type: 'action', action: 'execute' } as GameMessage);
    }
  }, [isMyTurn, isHost, sendMessage]);

  const handleReset = useCallback(() => {
    if (isHost) {
      engineRef.current?.resetGame();
    } else {
      sendMessage({ type: 'action', action: 'reset' } as GameMessage);
    }
  }, [isHost, sendMessage]);

  // Handle clicks on the game canvas
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!isMyTurn || !gameState || gameState.phase !== 'planning') return;
    if (gameState.actionQueue.length >= gameState.actionsPerTurn) return;
    
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    if (!isHost) {
      // Guest sends click to host - play sound locally for immediate feedback
      SoundManager.play('actionQueue');
      sendMessage({ type: 'action', action: 'click', payload: { x, y } } as GameMessage);
    }
    // Host clicks are handled by the engine directly (which plays the sound)
  }, [isMyTurn, gameState, isHost, sendMessage]);

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
        onClick={handleCanvasClick}
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
              <div className="pixi-game__game-over-buttons">
                <button onClick={handleReset}>Play Again</button>
                <button className="pixi-game__menu-btn" onClick={onBackToMenu}>Main Menu</button>
              </div>
            </div>
          </div>
        )}

        {/* Turn indicator overlay */}
        {gameState && gameState.phase === 'planning' && !isMyTurn && (
          <div className="pixi-game__turn-overlay">
            <span>Opponent's Turn</span>
          </div>
        )}
      </div>

      {gameState && !isLoading && !error && !waitingForHost && (
        <GameUI
          state={gameState}
          onSetActionType={handleSetActionType}
          onClearQueue={handleClearQueue}
          onExecute={handleExecute}
          isMyTurn={isMyTurn}
          localPlayerIndex={localPlayerIndex}
        />
      )}
    </div>
  );
}
