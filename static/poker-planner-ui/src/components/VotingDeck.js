import React, { useMemo } from 'react';

const DECKS = {
    FIBONACCI: [0, 1, 2, 3, 5, 8, 13, 21, '?'],
    TSHIRT: ['XS', 'S', 'M', 'L', 'XL', '?']
};
const SUITS = ['♠️', '♥️', '♣️', '♦️'];

const VotingDeck = ({ selectedValue, onVote, disabled, deckType = 'FIBONACCI', customValues }) => {
  
  const currentDeck = useMemo(() => {
     if (deckType === 'CUSTOM' && customValues) {
         return customValues.split(',').map(s => s.trim());
     }
     return DECKS[deckType] || DECKS.FIBONACCI;
  }, [deckType, customValues]);

  // Assign a random suite to each card value, stable across re-renders (and deck changes)
  const cardSuites = useMemo(() => {
    return currentDeck.reduce((acc, val) => {
      acc[val] = SUITS[Math.floor(Math.random() * SUITS.length)];
      return acc;
    }, {});
  }, [currentDeck]);

  const getSuiteColor = (suite) => {
    return (suite === '♥️' || suite === '♦️') ? '#ef4444' : '#1f2937';
  };

  const hasSelection = selectedValue !== null && selectedValue !== undefined;

  return (
    <div className="deck-area" style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', padding: '24px' }}>
      {currentDeck.map(val => {
         const suite = cardSuites[val];
         const isSelected = selectedValue === val;
         const isFaceDown = hasSelection && !isSelected;
         const suiteColor = getSuiteColor(suite);
         
         return (
         <div 
           key={val} 
           className={`card ${isSelected ? 'selected' : ''} ${isFaceDown ? 'face-down' : ''}`}
           onClick={() => {
               if (disabled) return;
               if (isFaceDown) return; // Must unselect first
               onVote(isSelected ? null : val);
           }}
           onMouseEnter={(e) => {
               if (!disabled && !isFaceDown) {
                   e.currentTarget.style.transform = 'translateY(-8px) rotate(0deg)';
                   e.currentTarget.style.boxShadow = '0 12px 24px rgba(0,0,0,0.3)';
               }
           }}
           onMouseLeave={(e) => {
               if (isFaceDown) return;
               e.currentTarget.style.transform = 'translateY(0) rotate(0deg)';
               e.currentTarget.style.boxShadow = isSelected 
                   ? '0 8px 16px rgba(251, 191, 36, 0.4), 0 0 20px rgba(251, 191, 36, 0.3)'
                   : '0 4px 8px rgba(0,0,0,0.15)';
           }}
           style={{ 
             width: '80px',
             height: '110px',
             background: isFaceDown 
                ? 'repeating-linear-gradient(45deg, #172b4d, #172b4d 10px, #091e42 10px, #091e42 20px)'
                : 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
             border: isSelected ? '3px solid #fbbf24' : (isFaceDown ? '2px solid #fff' : '2px solid #e5e7eb'),
             borderRadius: '12px',
             display: 'flex',
             alignItems: 'center',
             justifyContent: 'center',
             fontSize: '2rem',
             fontWeight: 'bold',
             color: isSelected ? '#fbbf24' : '#1f2937',
             cursor: (disabled || isFaceDown) ? 'default' : 'pointer',
             opacity: disabled ? 0.5 : 1,
             transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
             boxShadow: isSelected 
                 ? '0 8px 16px rgba(251, 191, 36, 0.4), 0 0 20px rgba(251, 191, 36, 0.3)'
                 : '0 4px 8px rgba(0,0,0,0.15)',
             transform: 'translateY(0) rotate(0deg)',
             position: 'relative',
             userSelect: 'none',
             WebkitUserSelect: 'none'
           }}
         >
           {!isFaceDown && (
            <>
               {/* Top-left Corner Suite */}
               <div style={{
                   position: 'absolute',
                   top: '6px',
                   left: '6px',
                   fontSize: '1rem',
                   lineHeight: 1,
                   color: isSelected ? '#fbbf24' : suiteColor
               }}>
                   {suite}
               </div>
               
               {/* Bottom-right Corner Suite (Rotated) */}
               <div style={{
                   position: 'absolute',
                   bottom: '6px',
                   right: '6px',
                   fontSize: '1rem',
                   lineHeight: 1,
                   color: isSelected ? '#fbbf24' : suiteColor,
                   transform: 'rotate(180deg)'
               }}>
                   {suite}
               </div>
               
               {/* Center value */}
               <span style={{ fontSize: '2.5rem', color: isSelected ? '#fbbf24' : suiteColor }}>{val}</span>
            </>
           )}
         </div>
      )})}
    </div>
  );
};
export default VotingDeck;
