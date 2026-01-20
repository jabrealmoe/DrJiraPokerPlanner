import React from 'react';

const ParticipantList = ({ participants, revealed }) => {
  const list = Object.values(participants || {});

  return (
    <div className="participants-panel">
      <h3 style={{ margin: '0 0 16px 0', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.7 }}>
        Participants ({list.length})
      </h3>
      {list.map((p, i) => (
        <div key={i} className="participant-row" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
           {/* Avatar */}
           <div style={{ position: 'relative' }}>
               <img 
                   src={p.avatarUrl} 
                   alt={p.displayName} 
                   style={{ 
                       width: 36, 
                       height: 36, 
                       borderRadius: '50%',
                       border: p.hasVoted && !revealed ? '2px solid #10b981' : '2px solid transparent',
                       transition: 'border-color 0.3s'
                   }} 
               />
               {/* Mini Status Dot (absolute for avatar badge) or separate column? - Let's do separate column as requested */}
           </div>

           {/* Name */}
           <div className="p-info" style={{ flex: 1, minWidth: 0 }}>
             <div style={{ 
                 fontWeight: 600, 
                 fontSize: '0.95rem', 
                 whiteSpace: 'nowrap', 
                 overflow: 'hidden', 
                 textOverflow: 'ellipsis',
                 color: 'var(--text-main)'
             }}>
                 {p.displayName}
             </div>
           </div>
           
           {/* Light/Status Indicator */}
           <div className="status-indicator" style={{ minWidth: 40, display: 'flex', justifyContent: 'flex-end' }}>
              {revealed ? (
                 <span style={{ 
                     fontWeight: 'bold', 
                     fontSize: '1.2rem', 
                     color: p.vote !== null ? 'var(--primary)' : 'var(--text-muted)' 
                 }}>
                    {p.vote !== null ? p.vote : '-'}
                 </span>
              ) : (
                 <div 
                    title={p.hasVoted ? "Ready" : "Thinking"} 
                    style={{
                        width: 14,
                        height: 14,
                        borderRadius: '50%',
                        background: p.hasVoted ? '#10b981' : '#f59e0b', // Green or Amber
                        boxShadow: p.hasVoted ? '0 0 10px rgba(16, 185, 129, 0.6)' : 'none',
                        border: '2px solid var(--surface)', // clear separation
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                    }} 
                 />
              )}
           </div>
        </div>
      ))}
    </div>
  );
};
export default ParticipantList;
