import { GameState } from '../game/types';
import './GameUI.css';

interface GameUIProps {
  state: GameState;
  onSetActionType: (type: 'move' | 'shoot') => void;
  onClearQueue: () => void;
  onExecute: () => void;
  localPlayerIndex: number;
}

export function GameUI({ state, onSetActionType, onClearQueue, onExecute, localPlayerIndex }: GameUIProps) {
  const opponentIndex = localPlayerIndex === 0 ? 1 : 0;
  
  const isPlanning = state.phase === 'planning';
  const myQueue = state.playerActionQueues?.[localPlayerIndex] || [];
  const mySelectedAction = state.playerSelectedActions?.[localPlayerIndex] || 'move';
  const imReady = state.playersReady?.[localPlayerIndex] || false;
  const opponentReady = state.playersReady?.[opponentIndex] || false;
  
  const canSubmit = myQueue.length > 0 && isPlanning && !imReady;
  const canAddActions = myQueue.length < state.actionsPerTurn && !imReady;

  return (
    <div className="game-ui">
      {/* Player Status - Both Players */}
      <div className="game-ui__players">
        <div className={`game-ui__player-card ${localPlayerIndex === 0 ? 'game-ui__player-card--you' : ''}`}>
          <div 
            className="game-ui__player-indicator"
            style={{ '--color': `#${state.tanks[0].color.toString(16).padStart(6, '0')}` } as React.CSSProperties}
          />
          <span className="game-ui__player-name">
            {state.tanks[0].name}
            {localPlayerIndex === 0 && ' (You)'}
          </span>
          <span className={`game-ui__ready-badge ${state.playersReady?.[0] ? 'game-ui__ready-badge--ready' : ''}`}>
            {state.playersReady?.[0] ? '✓ Ready' : 'Planning...'}
          </span>
        </div>
        
        <span className="game-ui__vs">VS</span>
        
        <div className={`game-ui__player-card ${localPlayerIndex === 1 ? 'game-ui__player-card--you' : ''}`}>
          <div 
            className="game-ui__player-indicator"
            style={{ '--color': `#${state.tanks[1].color.toString(16).padStart(6, '0')}` } as React.CSSProperties}
          />
          <span className="game-ui__player-name">
            {state.tanks[1].name}
            {localPlayerIndex === 1 && ' (You)'}
          </span>
          <span className={`game-ui__ready-badge ${state.playersReady?.[1] ? 'game-ui__ready-badge--ready' : ''}`}>
            {state.playersReady?.[1] ? '✓ Ready' : 'Planning...'}
          </span>
        </div>
      </div>

      {/* Action Queue Status */}
      <div className="game-ui__queue">
        <span className="game-ui__queue-label">Your Actions ({myQueue.length}/{state.actionsPerTurn})</span>
        <div className="game-ui__queue-dots">
          {Array.from({ length: state.actionsPerTurn }).map((_, i) => (
            <div
              key={i}
              className={`game-ui__queue-dot ${i < myQueue.length ? 'game-ui__queue-dot--filled' : ''}`}
            >
              {i < myQueue.length && (
                <span className="game-ui__queue-dot-icon">
                  {myQueue[i].type === 'move' ? '→' : '💥'}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Action Buttons - Only show if not submitted */}
      {isPlanning && !imReady && (
        <div className="game-ui__actions">
          <button
            className={`game-ui__action-btn game-ui__action-btn--move ${mySelectedAction === 'move' ? 'game-ui__action-btn--active' : ''}`}
            onClick={() => onSetActionType('move')}
          >
            <span className="game-ui__action-icon">⟶</span>
            <span className="game-ui__action-label">Move</span>
          </button>
          <button
            className={`game-ui__action-btn game-ui__action-btn--shoot ${mySelectedAction === 'shoot' ? 'game-ui__action-btn--active' : ''}`}
            onClick={() => onSetActionType('shoot')}
          >
            <span className="game-ui__action-icon">◎</span>
            <span className="game-ui__action-label">Fire</span>
          </button>
        </div>
      )}

      {/* Control Buttons */}
      {isPlanning && !imReady && (
        <div className="game-ui__controls">
          <button
            className="game-ui__btn game-ui__btn--clear"
            onClick={onClearQueue}
            disabled={myQueue.length === 0}
          >
            Clear
          </button>
          <button
            className="game-ui__btn game-ui__btn--execute"
            onClick={onExecute}
            disabled={!canSubmit}
          >
            <span className="game-ui__btn-text">Submit Turn</span>
            <span className="game-ui__btn-arrow">▶</span>
          </button>
        </div>
      )}

      {/* Submitted - Waiting for opponent */}
      {isPlanning && imReady && !opponentReady && (
        <div className="game-ui__waiting">
          <div className="game-ui__waiting-spinner" />
          <span>Turn submitted! Waiting for opponent...</span>
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
      {isPlanning && !imReady && canAddActions && (
        <div className="game-ui__hint">
          Click on the battlefield to queue a{' '}
          <strong>{mySelectedAction === 'move' ? 'movement' : 'shot'}</strong>
          {' '}({myQueue.length}/{state.actionsPerTurn})
        </div>
      )}
      
      {isPlanning && !imReady && !canAddActions && myQueue.length >= state.actionsPerTurn && (
        <div className="game-ui__hint game-ui__hint--ready">
          All {state.actionsPerTurn} actions queued! Click <strong>Submit Turn</strong> when ready.
        </div>
      )}
    </div>
  );
}
