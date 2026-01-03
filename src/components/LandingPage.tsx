import { useState, useEffect, useRef } from 'react';
import { UseMultiplayerReturn, ConnectionStatus } from '../hooks/useMultiplayer';
import './LandingPage.css';

interface LandingPageProps {
  multiplayer: UseMultiplayerReturn;
  onStartGame: () => void;
}

export function LandingPage({ multiplayer, onStartGame }: LandingPageProps) {
  const { state, createRoom, joinRoom, disconnect, onMessage } = multiplayer;
  const [joinCode, setJoinCode] = useState('');
  const [showJoinInput, setShowJoinInput] = useState(false);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const gameStartedRef = useRef(false);

  // Listen for game start signal from host (for guests)
  useEffect(() => {
    onMessage((data: unknown) => {
      const message = data as { type: string };
      if (message.type === 'gameStarted' && !gameStartedRef.current) {
        gameStartedRef.current = true;
        onStartGame();
      }
    });
  }, [onMessage, onStartGame]);

  // Check URL for room code on mount - but don't auto-join
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomCode = params.get('room');
    if (roomCode) {
      setInviteCode(roomCode.toUpperCase());
    }
  }, []);

  // Update URL when room is created
  useEffect(() => {
    if (state.roomCode && state.isHost) {
      const url = new URL(window.location.href);
      url.searchParams.set('room', state.roomCode);
      window.history.replaceState({}, '', url.toString());
    }
  }, [state.roomCode, state.isHost]);

  const handleJoinInvite = () => {
    if (inviteCode) {
      joinRoom(inviteCode);
    }
  };

  const handleDeclineInvite = () => {
    setInviteCode(null);
    // Clear the URL parameter
    const url = new URL(window.location.href);
    url.searchParams.delete('room');
    window.history.replaceState({}, '', url.toString());
  };

  const handleCreateRoom = () => {
    createRoom();
  };

  const handleJoinRoom = () => {
    if (joinCode.trim().length >= 4) {
      joinRoom(joinCode.trim());
    }
  };

  const handleStartGame = () => {
    if (canStart) {
      onStartGame();
    }
  };

  const handleCopyLink = () => {
    const url = `${window.location.origin}${window.location.pathname}?room=${state.roomCode}`;
    navigator.clipboard.writeText(url);
  };

  const getStatusMessage = (status: ConnectionStatus): string => {
    switch (status) {
      case 'connecting': return 'Connecting...';
      case 'waiting': return 'Waiting for opponent...';
      case 'connected': return 'Opponent connected!';
      case 'error': return state.error || 'Connection error';
      default: return '';
    }
  };

  const playerSlots = [
    { name: 'Blue Tank', color: '#3b82f6', player: 1 },
    { name: 'Red Tank', color: '#ef4444', player: 2 },
  ];

  // Check if both players are in the room using playersInRoom state
  const hasPlayer1 = state.playersInRoom.includes(1);
  const hasPlayer2 = state.playersInRoom.includes(2);
  const canStart = state.isHost && hasPlayer1 && hasPlayer2;

  return (
    <div className="landing">
      <div className="landing__content">
        <header className="landing__header">
          <h1 className="landing__title">TURN TANKS</h1>
          <p className="landing__tagline">Tactical Tank Combat</p>
        </header>

        {/* Multiplayer Lobby */}
        <div className="landing__lobby">
          <h2 className="landing__lobby-title">Battle Lobby</h2>

          {/* Player Slots */}
          <div className="landing__player-slots">
            {playerSlots.map((slot, index) => {
              const isJoined = state.playersInRoom.includes(slot.player);
              const isYou = state.playerNumber === slot.player;
              let statusText = 'Waiting...';
              
              if (isJoined) {
                statusText = '✓ Ready';
              } else if (state.status === 'connecting' && slot.player === state.playerNumber) {
                statusText = 'Joining...';
              }
              
              return (
                <div 
                  key={index}
                  className={`landing__player-slot ${isJoined ? 'landing__player-slot--joined' : ''}`}
                  style={{ '--slot-color': slot.color } as React.CSSProperties}
                >
                  <div className="landing__player-slot-indicator" />
                  <div className="landing__player-slot-info">
                    <span className="landing__player-slot-name">
                      {slot.name} {isYou && <span className="landing__you-badge">(You)</span>}
                    </span>
                    <span className="landing__player-slot-status">
                      {statusText}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Connection Status */}
          {state.status !== 'disconnected' && (
            <div className={`landing__status landing__status--${state.status}`}>
              {(state.status === 'waiting' || state.status === 'connecting') && (
                <div className="landing__status-spinner" />
              )}
              <span>{getStatusMessage(state.status)}</span>
              {state.status === 'error' && (
                <button className="landing__retry-btn" onClick={disconnect}>
                  Try Again
                </button>
              )}
            </div>
          )}

          {/* Room Code Display - Host */}
          {state.roomCode && state.isHost && state.status !== 'error' && (
            <div className="landing__room-code">
              <span className="landing__room-code-label">Room Code:</span>
              <span className="landing__room-code-value">{state.roomCode}</span>
              <button className="landing__copy-btn" onClick={handleCopyLink}>
                📋 Copy Link
              </button>
            </div>
          )}

          {/* Room Code Display - Guest (joining) */}
          {state.roomCode && !state.isHost && state.status === 'connecting' && (
            <div className="landing__room-code landing__room-code--joining">
              <span className="landing__room-code-label">Joining Room:</span>
              <span className="landing__room-code-value">{state.roomCode}</span>
            </div>
          )}

          {/* Invite Prompt - When opened via shared link */}
          {state.status === 'disconnected' && inviteCode && (
            <div className="landing__invite-prompt">
              <p className="landing__invite-text">You've been invited to join a battle!</p>
              <div className="landing__invite-code">
                <span className="landing__invite-code-label">Room Code:</span>
                <span className="landing__invite-code-value">{inviteCode}</span>
              </div>
              <div className="landing__invite-actions">
                <button className="landing__invite-join-btn" onClick={handleJoinInvite}>
                  <span>🎮</span> Join Battle
                </button>
                <button className="landing__invite-decline-btn" onClick={handleDeclineInvite}>
                  Decline
                </button>
              </div>
            </div>
          )}

          {/* Initial State - Show Create/Join Options (only if no invite) */}
          {state.status === 'disconnected' && !inviteCode && (
            <div className="landing__lobby-actions">
              <button className="landing__create-btn landing__create-btn--primary" onClick={handleCreateRoom}>
                <span className="landing__create-btn-icon">⚔️</span>
                <span className="landing__create-btn-text">Create Room & Fight</span>
              </button>
              
              <div className="landing__divider">
                <span>or</span>
              </div>

              {!showJoinInput ? (
                <button className="landing__join-toggle-btn" onClick={() => setShowJoinInput(true)}>
                  Join with Code
                </button>
              ) : (
                <div className="landing__join-form">
                  <input
                    type="text"
                    className="landing__join-input"
                    placeholder="Enter room code"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    maxLength={6}
                    autoFocus
                  />
                  <button 
                    className="landing__join-submit-btn"
                    onClick={handleJoinRoom}
                    disabled={joinCode.trim().length < 4}
                  >
                    Join
                  </button>
                </div>
              )}
            </div>
          )}
          
          {/* Host waiting for opponent - show Start Fight button */}
          {state.isHost && state.status !== 'disconnected' && state.status !== 'error' && (
            <div className="landing__host-actions">
              <button 
                className={`landing__start-btn-inline ${!canStart ? 'landing__start-btn-inline--disabled' : ''}`}
                onClick={handleStartGame}
                disabled={!canStart}
              >
                <span className="landing__start-btn-icon-inline">⚔️</span>
                <span className="landing__start-btn-text-inline">
                  {canStart ? 'Start Fight!' : 'Waiting for Opponent...'}
                </span>
              </button>
            </div>
          )}

          {/* Connected - Ready Message */}
          {hasPlayer1 && hasPlayer2 && (
            <p className="landing__lobby-ready">Both players connected! Ready to fight!</p>
          )}
        </div>

        {/* Rules */}
        <div className="landing__rules">
          <h2 className="landing__rules-title">How to Play</h2>
          
          <div className="landing__rule-grid">
            <div className="landing__rule">
              <div className="landing__rule-icon">🎯</div>
              <h3>Turn-Based Combat</h3>
              <p>Two tanks face off. Each player takes turns planning and executing their moves.</p>
            </div>

            <div className="landing__rule">
              <div className="landing__rule-icon">⚡</div>
              <h3>2 Actions Per Turn</h3>
              <p>Queue up to 2 actions each turn — any combination of <strong>Move</strong> or <strong>Fire</strong>.</p>
            </div>

            <div className="landing__rule">
              <div className="landing__rule-icon">🚀</div>
              <h3>Free Movement</h3>
              <p>Click anywhere within the green range ring to move. Avoid obstacles and the enemy tank!</p>
            </div>

            <div className="landing__rule">
              <div className="landing__rule-icon">💥</div>
              <h3>Fire at Will</h3>
              <p>Select Fire mode and click to aim. Shots can hit obstacles, so choose your angle wisely.</p>
            </div>

            <div className="landing__rule">
              <div className="landing__rule-icon">❤️</div>
              <h3>3 Hit Points</h3>
              <p>Each tank has 3 HP. Damaged tanks smoke; critically damaged tanks catch fire!</p>
            </div>

            <div className="landing__rule">
              <div className="landing__rule-icon">🏆</div>
              <h3>Last Tank Standing</h3>
              <p>Destroy the enemy tank to win. The battlefield changes every game!</p>
            </div>
          </div>
        </div>

        <footer className="landing__footer">
          <p>Share the room code or link with a friend to battle!</p>
        </footer>
      </div>
    </div>
  );
}
