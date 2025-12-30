import { useRef, useCallback, useEffect, useState } from 'react';
import { useGame } from '../context/GameContext';
import { Tank } from './Tank';
import { Position } from '../types/game';
import './GameMap.css';

export function GameMap() {
  const { state, queueAction, canQueueMore, collidesWithObstacle, TANK_SIZE } = useGame();
  const { tanks, currentTankIndex, obstacles, phase, actionQueue, selectedActionType, executingActionIndex } = state;
  const mapRef = useRef<HTMLDivElement>(null);
  const [animatedPositions, setAnimatedPositions] = useState<Record<string, Position>>({});

  const currentTank = tanks[currentTankIndex];

  // Safety check - if current tank is dead, don't render interactive elements
  if (!currentTank || currentTank.health <= 0) {
    return (
      <div className="game-map-container">
        <div className="game-map">
          <div className="game-map__ground" />
          {obstacles.map((obstacle) => (
            <div
              key={obstacle.id}
              className="game-map__obstacle"
              style={{
                left: `${obstacle.position.x}%`,
                top: `${obstacle.position.y}%`,
                width: `${obstacle.width}%`,
                height: `${obstacle.height}%`,
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  // Handle animation during execution
  useEffect(() => {
    if (phase !== 'executing' || executingActionIndex < 0) {
      setAnimatedPositions({});
      return;
    }

    const currentAction = actionQueue[executingActionIndex];
    if (!currentAction) {
      setAnimatedPositions({});
      return;
    }

    // Calculate current position after all previous moves
    let currentPos = currentTank.position;
    for (let i = 0; i < executingActionIndex; i++) {
      if (actionQueue[i].type === 'move') {
        currentPos = actionQueue[i].targetPosition;
      }
    }

    if (currentAction.type === 'shoot') {
      // For shoot actions, just keep tank at current position
      setAnimatedPositions({
        [currentTank.id]: currentPos,
      });
      return;
    }

    // Animate move action
    const startPos = currentPos;
    const endPos = currentAction.targetPosition;
    const duration = 600;
    const startTime = performance.now();

    const animate = (time: number) => {
      const elapsed = time - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      
      const animatedPos = {
        x: startPos.x + (endPos.x - startPos.x) * eased,
        y: startPos.y + (endPos.y - startPos.y) * eased,
      };

      setAnimatedPositions({
        [currentTank.id]: animatedPos,
      });

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        // Keep the tank at the end position
        setAnimatedPositions({
          [currentTank.id]: endPos,
        });
      }
    };

    requestAnimationFrame(animate);
  }, [phase, executingActionIndex, actionQueue, currentTank.position, currentTank.id]);

  const handleMapClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (phase !== 'planning' || !canQueueMore) return;

    const rect = mapRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    const targetPosition = { x, y };

    // Validate position
    if (collidesWithObstacle(targetPosition)) return;

    // Check bounds (with padding for tank size)
    const padding = TANK_SIZE / 2;
    if (x < padding || x > 100 - padding || y < padding || y > 100 - padding) return;

    queueAction(selectedActionType, targetPosition);
  }, [phase, canQueueMore, selectedActionType, queueAction, collidesWithObstacle, TANK_SIZE]);

  // Build path preview for queued moves
  const pathPoints: Position[] = [];
  if (phase === 'planning') {
    let currentPos = currentTank.position;
    pathPoints.push(currentPos);
    for (const action of actionQueue) {
      if (action.type === 'move') {
        pathPoints.push(action.targetPosition);
        currentPos = action.targetPosition;
      }
    }
  }

  return (
    <div className="game-map-container">
      <div 
        ref={mapRef}
        className={`game-map ${phase === 'planning' ? 'game-map--interactive' : ''}`}
        onClick={handleMapClick}
      >
        {/* Ground pattern */}
        <div className="game-map__ground" />

        {/* Obstacles */}
        {obstacles.map((obstacle) => (
          <div
            key={obstacle.id}
            className="game-map__obstacle"
            style={{
              left: `${obstacle.position.x}%`,
              top: `${obstacle.position.y}%`,
              width: `${obstacle.width}%`,
              height: `${obstacle.height}%`,
            }}
          />
        ))}

        {/* Path preview */}
        {pathPoints.length > 1 && (
          <svg className="game-map__path-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
            <path
              d={pathPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')}
              className="game-map__path-line"
            />
          </svg>
        )}

        {/* Queued action markers */}
        {actionQueue.map((action, index) => (
          <div
            key={action.id}
            className={`game-map__marker game-map__marker--${action.type}`}
            style={{
              left: `${action.targetPosition.x}%`,
              top: `${action.targetPosition.y}%`,
            }}
          >
            <span className="game-map__marker-number">{index + 1}</span>
            <span className="game-map__marker-icon">
              {action.type === 'move' ? '→' : '💥'}
            </span>
          </div>
        ))}

        {/* Shot animation */}
        {phase === 'executing' && executingActionIndex >= 0 && actionQueue[executingActionIndex]?.type === 'shoot' && (() => {
          // Calculate position for the shot (after all previous moves)
          let shotFromPos = currentTank.position;
          for (let i = 0; i < executingActionIndex; i++) {
            if (actionQueue[i].type === 'move') {
              shotFromPos = actionQueue[i].targetPosition;
            }
          }
          return (
            <ShotTrail
              from={shotFromPos}
              to={actionQueue[executingActionIndex].targetPosition}
            />
          );
        })()}

        {/* Tanks */}
        {tanks.map((tank) => {
          if (tank.health <= 0) return null;
          const isActive = tank.id === currentTank.id && phase === 'planning';
          const animPos = animatedPositions[tank.id];
          
          return (
            <Tank
              key={tank.id}
              tank={tank}
              isActive={isActive}
              isAnimating={!!animPos}
              animatedPosition={animPos}
            />
          );
        })}

        {/* Click indicator */}
        {phase === 'planning' && canQueueMore && (
          <div className={`game-map__cursor-hint game-map__cursor-hint--${selectedActionType}`}>
            Click to {selectedActionType}
          </div>
        )}
      </div>
    </div>
  );
}

function ShotTrail({ from, to }: { from: Position; to: Position }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const duration = 300;
    const startTime = performance.now();

    const animate = (time: number) => {
      const elapsed = time - startTime;
      const p = Math.min(elapsed / duration, 1);
      setProgress(p);
      if (p < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, []);

  const currentX = from.x + (to.x - from.x) * progress;
  const currentY = from.y + (to.y - from.y) * progress;

  return (
    <svg className="game-map__shot-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
      <line
        x1={from.x}
        y1={from.y}
        x2={currentX}
        y2={currentY}
        className="game-map__shot-line"
      />
      <circle
        cx={currentX}
        cy={currentY}
        r="1"
        className="game-map__shot-head"
      />
    </svg>
  );
}

