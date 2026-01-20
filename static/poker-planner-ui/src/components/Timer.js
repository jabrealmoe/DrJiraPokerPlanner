import React, { useState, useEffect } from 'react';

const Timer = ({ duration = 60, startTime, onComplete, isActive }) => {
  const [timeLeft, setTimeLeft] = useState(duration);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!isActive || !startTime) {
       setIsVisible(false);
       return;
    }

    setIsVisible(true);

    const tick = () => {
        const now = Date.now();
        const elapsedSeconds = Math.floor((now - startTime) / 1000);
        const remaining = Math.max(0, duration - elapsedSeconds);
        
        setTimeLeft(remaining);
        
        if (remaining <= 0) {
            if (onComplete) onComplete();
        }
        return remaining;
    };

    tick(); // Update immediately
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [isActive, startTime, duration, onComplete]);

  const percentage = (timeLeft / duration) * 100;
  const isWarning = timeLeft <= 10;
  const isCritical = timeLeft <= 5;

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isVisible) return null;

  return (
    <div style={{
      position: 'absolute',
      top: isActive ? '20px' : '-100px',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 999,
      transition: 'top 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55)',
      background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
      borderRadius: '16px',
      padding: '16px 24px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      border: '2px solid rgba(255,255,255,0.1)',
      minWidth: '200px'
    }}>
      {/* Timer Display */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16
      }}>
        {/* Stopwatch Icon */}
        <div style={{
          fontSize: '2rem',
          animation: isCritical ? 'pulse 0.5s infinite' : 'none'
        }}>
          ⏱️
        </div>

        {/* Time Display */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 4
        }}>
          <div style={{
            fontSize: '2rem',
            fontWeight: 'bold',
            color: isCritical ? '#ef4444' : isWarning ? '#f59e0b' : '#10b981',
            fontFamily: 'monospace',
            letterSpacing: '2px'
          }}>
            {formatTime(timeLeft)}
          </div>
          
          {/* Progress Bar */}
          <div style={{
            width: '100%',
            height: '6px',
            background: 'rgba(255,255,255,0.1)',
            borderRadius: '3px',
            overflow: 'hidden'
          }}>
            <div style={{
              width: `${percentage}%`,
              height: '100%',
              background: isCritical 
                ? 'linear-gradient(90deg, #ef4444, #dc2626)' 
                : isWarning 
                  ? 'linear-gradient(90deg, #f59e0b, #d97706)'
                  : 'linear-gradient(90deg, #10b981, #059669)',
              transition: 'width 1s linear',
              borderRadius: '3px'
            }} />
          </div>
        </div>
      </div>

      {/* Pulse animation for critical state */}
      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }
      `}</style>
    </div>
  );
};

export default Timer;
