import { Tank as TankType } from '../types/game';
import './Tank.css';

interface TankProps {
  tank: TankType;
  isActive: boolean;
  isAnimating?: boolean;
  animatedPosition?: { x: number; y: number };
}

export function Tank({ tank, isActive, isAnimating, animatedPosition }: TankProps) {
  const position = animatedPosition || tank.position;

  return (
    <div
      className={`tank ${isActive ? 'tank--active' : ''} ${isAnimating ? 'tank--animating' : ''}`}
      style={{
        '--tank-color': tank.color,
        '--tank-x': `${position.x}%`,
        '--tank-y': `${position.y}%`,
        '--tank-rotation': `${tank.rotation}deg`,
      } as React.CSSProperties}
    >
      <div className="tank__body">
        <div className="tank__tread tank__tread--left" />
        <div className="tank__tread tank__tread--right" />
        <div className="tank__hull" />
        <div className="tank__turret">
          <div className="tank__barrel" />
        </div>
      </div>
      <div className="tank__health">
        {Array.from({ length: tank.health }).map((_, i) => (
          <span key={i} className="tank__health-pip" />
        ))}
      </div>
      {isActive && <div className="tank__indicator" />}
    </div>
  );
}
