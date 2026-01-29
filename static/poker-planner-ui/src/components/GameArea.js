import React, { useState, useEffect, useRef } from 'react';
import Timer from './Timer';
import TableSeats from './TableSeats';

const GameArea = ({ session, accountId, onReveal, onReset }) => {
  // Use session.moderatorAccountId to check permissions.
  // For now, allow anyone to act as moderator if they are the moderator.
  // Fallback: If no moderator set? The backend sets the first joiner.
  
  const [timerDuration, setTimerDuration] = useState(60);
  
  const isModerator = session.moderatorId === accountId;
  const revealed = session.status === 'REVEALED';

  // Derived Timer State
  const timer = session.timer || { status: 'STOPPED', duration: 60 };
  const timerActive = timer.status === 'RUNNING';

  // Audio Logic
  const audioRef = useRef(null);

  useEffect(() => {
    // Initialize audio object once
    if (!audioRef.current) {
        audioRef.current = new Audio('/jeopardy.mp3');
        audioRef.current.loop = true; // Loop if timer is longer than song
        audioRef.current.volume = 0.3; // Be subtle
    }

    if (timerActive && !revealed) {
        // Play
        audioRef.current.play().catch(e => console.log('Audio play block:', e));
    } else {
        // Pause and Reset
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
        }
    }
    
    // Cleanup
    return () => {
        if (audioRef.current) {
            audioRef.current.pause();
        }
    };
  }, [timerActive, revealed]);
  
  // Calculate Average
  const votes = Object.values(session.participants)
     .map(p => p.vote)
     .filter(v => typeof v === 'number');
     
  const average = votes.length > 0 ? (votes.reduce((a,b)=>a+b,0) / votes.length).toFixed(1) : 0;

  const handleTimerComplete = () => {
    // Optionally auto-reveal when timer completes
    if (isModerator && !revealed) {
      onReveal();
    }
  };

  const handleStartTimer = async () => {
      // Invoke backend to start timer for everyone
      await import('@forge/bridge').then(bridge => {
          bridge.invoke('startTimer', { 
              roomKey: session.roomKey, 
              issueId: session.issueId, 
              duration: timerDuration 
          });
      });
  };

  const handleResetRound = () => {
    onReset();
  };

  return (
    <div className="table-surface" style={{ position: 'relative' }}>
       {/* Countdown Timer */}
       <Timer 
         duration={timer.duration}
         startTime={timer.startTime}
         isActive={timerActive && !revealed}
         onComplete={handleTimerComplete}
       />
       
       {/* Players seated around the table */}
       <TableSeats 
         participants={session.participants} 
         revealed={revealed} 
         currentAccountId={accountId}
       />
       
       <div className="table-felt">
          {revealed ? (
             <div style={{ textAlign: 'center', animation: 'fadeIn 0.5s' }}>
                <h2 style={{ fontSize: '2rem', margin: '0 0 10px 0' }}>Average: {average}</h2>
                <div style={{ margin: '20px 0' }}>
                   {/* Histogram could go here */}
                </div>
                {isModerator ? (
                  <button className="reveal-btn" onClick={handleResetRound}>Start Next Round ➡️</button>
                ) : (
                  <div style={{ opacity: 0.7 }}>Waiting for moderator...</div>
                )}
             </div>
          ) : (
             <div style={{ textAlign: 'center' }}>
                <h3 style={{ opacity: 0.6, fontWeight: 400 }}>
                   {Object.values(session.participants).filter(p => p.hasVoted).length} / {Object.keys(session.participants).length} Voted
                </h3>
                {isModerator && (
                   <div style={{ display: 'flex', gap: 12, justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
                      <button className="reveal-btn" onClick={onReveal}>Reveal Cards 🃏</button>
                      
                      {!timerActive && (
                        <>
                          <input 
                            type="number" 
                            value={timerDuration} 
                            onChange={(e) => setTimerDuration(Math.max(5, parseInt(e.target.value) || 60))}
                            min="5"
                            max="300"
                            style={{
                              width: '60px',
                              padding: '8px',
                              borderRadius: '6px',
                              border: '1px solid rgba(255,255,255,0.2)',
                              background: 'rgba(255,255,255,0.1)',
                              color: 'white',
                              fontSize: '0.9rem',
                              textAlign: 'center'
                            }}
                          />
                          <button 
                            className="reveal-btn" 
                            onClick={handleStartTimer}
                            style={{ background: '#10b981' }}
                          >
                            Start Timer ⏱️
                          </button>
                        </>
                      )}
                   </div>
                )}
             </div>
          )}
       </div>
    </div>
  );
};
export default GameArea;
