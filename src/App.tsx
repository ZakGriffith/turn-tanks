import { useState, useEffect } from 'react';
import { LandingPage } from './components/LandingPage';
import { PixiGame } from './components/PixiGame';
import { useMultiplayer } from './hooks/useMultiplayer';
import './App.css';

function App() {
  const [gameStarted, setGameStarted] = useState(false);
  const multiplayer = useMultiplayer();

  // Listen for game start signal from server
  useEffect(() => {
    // When both players are connected and host clicks start, server broadcasts gameStarted
    // This will be handled via the onMessage callback
  }, []);

  const handleBackToMenu = () => {
    multiplayer.disconnect();
    setGameStarted(false);
    // Clear room code from URL
    const url = new URL(window.location.href);
    url.searchParams.delete('room');
    window.history.replaceState({}, '', url.toString());
  };

  if (!gameStarted) {
    return (
      <LandingPage 
        multiplayer={multiplayer}
        onStartGame={() => {
          if (multiplayer.state.isHost) {
            multiplayer.startGame();
          }
          setGameStarted(true);
        }}
      />
    );
  }

  return (
    <PixiGame 
      onBackToMenu={handleBackToMenu}
      multiplayer={multiplayer}
    />
  );
}

export default App;
