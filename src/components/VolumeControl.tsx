import { useState, useEffect } from 'react';
import { SoundManager } from '../game/SoundManager';
import './VolumeControl.css';

export function VolumeControl() {
  const [volume, setVolume] = useState(SoundManager.getMasterVolume() * 100);
  const [isMuted, setIsMuted] = useState(!SoundManager.isEnabled());

  useEffect(() => {
    SoundManager.setMasterVolume(volume / 100);
  }, [volume]);

  useEffect(() => {
    SoundManager.setEnabled(!isMuted);
  }, [isMuted]);

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseInt(e.target.value, 10);
    setVolume(newVolume);
    if (newVolume > 0 && isMuted) {
      setIsMuted(false);
    }
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  return (
    <div className="volume-control">
      <button 
        className="volume-control__mute-btn" 
        onClick={toggleMute}
        title={isMuted ? 'Unmute' : 'Mute'}
      >
        {isMuted ? '🔇' : volume > 50 ? '🔊' : volume > 0 ? '🔉' : '🔈'}
      </button>
      <input
        type="range"
        min="0"
        max="100"
        value={volume}
        onChange={handleVolumeChange}
        className="volume-control__slider"
        title={`Volume: ${volume}%`}
      />
      <span className="volume-control__value">{volume}%</span>
    </div>
  );
}

