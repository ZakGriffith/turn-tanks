import { useGame } from '../context/GameContext';
import './Controls.css';

export function Controls() {
  const { state, setActionType, clearQueue, executeActions } = useGame();
  const { tanks, currentTankIndex, phase, actionQueue, selectedActionType, actionsPerTurn } = state;

  const currentTank = tanks[currentTankIndex];
  const canExecute = actionQueue.length > 0 && phase === 'planning';
  const isExecuting = phase === 'executing';

  // Safety check - if current tank is dead, show minimal UI
  if (!currentTank || currentTank.health <= 0) {
    return (
      <div className="controls">
        <div className="controls__executing">
          <span>Switching to next player...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="controls">
      <div className="controls__turn-info">
        <div
          className="controls__current-player"
          style={{ '--player-color': currentTank.color } as React.CSSProperties}
        >
          <span className="controls__player-indicator" />
          <span className="controls__player-name">{currentTank.name}'s Turn</span>
        </div>
        <div className="controls__queue-info">
          <span className="controls__queue-label">Actions Queued:</span>
          <div className="controls__queue-pips">
            {Array.from({ length: actionsPerTurn }).map((_, i) => (
              <span
                key={i}
                className={`controls__queue-pip ${i < actionQueue.length ? 'controls__queue-pip--filled' : ''}`}
              />
            ))}
          </div>
        </div>
      </div>

      {phase === 'planning' && (
        <>
          <div className="controls__action-selector">
            <button
              className={`controls__action-btn ${selectedActionType === 'move' ? 'controls__action-btn--active' : ''}`}
              onClick={() => setActionType('move')}
            >
              <span className="controls__action-icon">↔</span>
              <span className="controls__action-label">Move</span>
            </button>
            <button
              className={`controls__action-btn controls__action-btn--shoot ${selectedActionType === 'shoot' ? 'controls__action-btn--active' : ''}`}
              onClick={() => setActionType('shoot')}
            >
              <span className="controls__action-icon">💥</span>
              <span className="controls__action-label">Shoot</span>
            </button>
          </div>

          <div className="controls__queue-display">
            {actionQueue.length === 0 ? (
              <p className="controls__queue-empty">Click on the map to queue actions</p>
            ) : (
              <div className="controls__queue-list">
                {actionQueue.map((action, i) => (
                  <div key={action.id} className={`controls__queued-action controls__queued-action--${action.type}`}>
                    <span className="controls__queued-number">{i + 1}</span>
                    <span className="controls__queued-type">
                      {action.type === 'move' ? 'Move' : 'Shoot'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="controls__buttons">
            <button
              className="controls__button controls__button--clear"
              onClick={clearQueue}
              disabled={actionQueue.length === 0}
            >
              Clear
            </button>
            <button
              className="controls__button controls__button--execute"
              onClick={executeActions}
              disabled={!canExecute}
            >
              Execute Turn
            </button>
          </div>
        </>
      )}

      {isExecuting && (
        <div className="controls__executing">
          <div className="controls__executing-spinner" />
          <span>Executing actions...</span>
        </div>
      )}
    </div>
  );
}
