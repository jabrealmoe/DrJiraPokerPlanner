import React from 'react';

const TableSeats = ({ participants, revealed, currentAccountId }) => {
  const list = Object.entries(participants || {})
    .filter(([id]) => id !== currentAccountId)
    .map(([id, data]) => ({ ...data, accountId: id }));
  
  // Calculate positions around the elliptical table
  const getPosition = (index, total) => {
    // Distribute players around an ellipse
    const angle = (index / total) * 2 * Math.PI - Math.PI / 2; // Start from top
    const radiusX = 42; // Horizontal radius percentage
    const radiusY = 32; // Vertical radius percentage
    
    const x = 50 + radiusX * Math.cos(angle);
    const y = 50 + radiusY * Math.sin(angle);
    
    return { x, y, angle };
  };

  return (
    <>
      {list.map((participant, index) => {
        const { x, y, angle } = getPosition(index, list.length);
        const cardRotation = (angle * 180 / Math.PI) + 90; // Rotate card to face center
        
        return (
          <div
            key={participant.accountId}
            style={{
              position: 'absolute',
              left: `${x}%`,
              top: `${y}%`,
              transform: 'translate(-50%, -50%)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
              zIndex: 10
            }}
          >
            {/* Player Avatar */}
            <div style={{
              width: 50,
              height: 50,
              borderRadius: '50%',
              overflow: 'hidden',
              border: participant.hasVoted ? '3px solid #10b981' : '3px solid rgba(255,255,255,0.3)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              background: '#1f2937'
            }}>
              <img 
                src={participant.avatarUrl} 
                alt={participant.displayName}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>
            
            {/* Player Name */}
            <div style={{
              background: 'rgba(0,0,0,0.8)',
              color: 'white',
              padding: '4px 8px',
              borderRadius: 6,
              fontSize: '0.75rem',
              fontWeight: 600,
              whiteSpace: 'nowrap',
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
            }}>
              {participant.displayName.split(' ')[0]}
            </div>
            
            {/* Player's Card (face down or revealed) */}
            {participant.hasVoted && (
              <div
                style={{
                  width: 50,
                  height: 70,
                  background: revealed 
                    ? 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)'
                    : 'linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%)',
                  border: revealed ? '2px solid #e5e7eb' : '2px solid #1e3a8a',
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: revealed ? '1.5rem' : '1rem',
                  fontWeight: 'bold',
                  color: revealed ? '#1f2937' : '#60a5fa',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                  transform: `rotate(${cardRotation}deg)`,
                  transition: 'all 0.3s ease',
                  position: 'relative'
                }}
              >
                {revealed ? (
                  participant.vote !== null ? participant.vote : '?'
                ) : (
                  '🃏'
                )}
                
                {/* Card back pattern */}
                {!revealed && (
                  <div style={{
                    position: 'absolute',
                    inset: 4,
                    border: '1px solid rgba(96, 165, 250, 0.3)',
                    borderRadius: 6,
                    background: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(96, 165, 250, 0.1) 10px, rgba(96, 165, 250, 0.1) 20px)'
                  }} />
                )}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
};

export default TableSeats;
