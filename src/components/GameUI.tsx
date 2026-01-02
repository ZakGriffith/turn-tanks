import { GameState } from '../game/types';
import './GameUI.css';

interface GameUIProps {
  state: GameState;
  onSetActionType: (type: 'move' | 'shoot') => void;
  onClearQueue: () => void;
  onExecute: () => void;
  isMyTurn?: boolean;
  localPlayerIndex?: number;
}

export function GameUI({ state, onSetActionType, onClearQueue, onExecute, isMyTurn = true, localPlayerIndex }: GameUIProps) {
  const currentTank = state.tanks[state.currentPlayerIndex];
  const localTank = localPlayerIndex !== undefined ? state.tanks[localPlayerIndex] : null;
  const isPlanning = state.phase === 'planning';
  const canExecute = state.actionQueue.length > 0 && isPlanning && isMyTurn;

  const isLocalPlayerTurn = localPlayerIndex !== undefined ? state.currentPlayerIndex === localPlayerIndex : true;

  return (
    <div className="game-ui">
      {/* Current Player */}
      <div className="game-ui__player">
        <div 
          className="game-ui__player-indicator"
          style={{ '--color': `#${currentTank.color.toString(16).padStart(6, '0')}` } as React.CSSProperties}
        />
        <div className="game-ui__player-info">
          <span className="game-ui__player-name">
            {currentTank.name}
            {isLocalPlayerTurn && localTank && <span className="game-ui__you-badge"> (You)</span>}
          </span>
          <span className="game-ui__player-turn">
            {isPlanning 
              ? (isLocalPlayerTurn ? 'Your Turn - Plan Your Move' : "Opponent's Turn") 
              : 'Executing...'}
          </span>
        </div>
      </div>

      {/* Action Queue Status */}
      <div className="game-ui__queue">
        <span className="game-ui__queue-label">Actions</span>
        <div className="game-ui__queue-dots">
          {Array.from({ length: state.actionsPerTurn }).map((_, i) => (
            <div
              key={i}
              className={`game-ui__queue-dot ${i < state.actionQueue.length ? 'game-ui__queue-dot--filled' : ''}`}
            >
              {i < state.actionQueue.length && (
                <span className="game-ui__queue-dot-icon">
                  {state.actionQueue[i].type === 'move' ? '→' : '💥'}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Action Buttons */}
      {isPlanning && isMyTurn && (
        <div className="game-ui__actions">
          <button
            className={`game-ui__action-btn game-ui__action-btn--move ${state.selectedActionType === 'move' ? 'game-ui__action-btn--active' : ''}`}
            onClick={() => onSetActionType('move')}
          >
            <span className="game-ui__action-icon">⟶</span>
            <span className="game-ui__action-label">Move</span>
          </button>
          <button
            className={`game-ui__action-btn game-ui__action-btn--shoot ${state.selectedActionType === 'shoot' ? 'game-ui__action-btn--active' : ''}`}
            onClick={() => onSetActionType('shoot')}
          >
            <span className="game-ui__action-icon">◎</span>
            <span className="game-ui__action-label">Fire</span>
          </button>
        </div>
      )}

      {/* Control Buttons */}
      {isPlanning && isMyTurn && (
        <div className="game-ui__controls">
          <button
            className="game-ui__btn game-ui__btn--clear"
            onClick={onClearQueue}
            disabled={state.actionQueue.length === 0}
          >
            Clear
          </button>
          <button
            className="game-ui__btn game-ui__btn--execute"
            onClick={onExecute}
            disabled={!canExecute}
          >
            <span className="game-ui__btn-text">Execute</span>
            <span className="game-ui__btn-arrow">▶</span>
          </button>
        </div>
      )}

      {/* Executing Indicator */}
      {state.phase === 'executing' && (
        <div className="game-ui__executing">
          <div className="game-ui__executing-spinner" />
          <span>Executing orders...</span>
        </div>
      )}

      {/* Instructions */}
      {isPlanning && isMyTurn && state.actionQueue.length < state.actionsPerTurn && (
        <div className="game-ui__hint">
          Click on the battlefield to queue a{' '}
          <strong>{state.selectedActionType === 'move' ? 'movement' : 'shot'}</strong>
        </div>
      )}

      {/* Waiting for opponent */}
      {isPlanning && !isMyTurn && (
        <div className="game-ui__waiting">
          Waiting for opponent...
        </div>
      )}
    </div>
  );
}

