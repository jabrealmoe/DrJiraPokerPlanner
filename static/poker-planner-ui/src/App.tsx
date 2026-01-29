import React, { useState, useEffect } from 'react';
import { invoke, view, requestJira } from '@forge/bridge';
import ActiveIssue from './components/ActiveIssue';
import ParticipantList from './components/ParticipantList';
import VotingDeck from './components/VotingDeck';
import GameArea from './components/GameArea';
import './App.css';
import Button from '@atlaskit/button';
import ChevronLeftIcon from '@atlaskit/icon/glyph/chevron-left';
import ChevronRightIcon from '@atlaskit/icon/glyph/chevron-right';
import RefreshIcon from '@atlaskit/icon/glyph/refresh';
import AdminPage from './components/AdminPage';

interface BacklogIssue {
    id: string;
    key: string;
    summary: string;
    icon: string;
    storyPoints?: number;
}

interface BacklogInfo {
    total: number;
    nextPageToken: string | null;
}

interface Session {
    roomKey: string;
    issueId: string;
    moderatorId: string;
    activeIssueId: string;
    status: 'VOTING' | 'REVEALED';
    deckType: string;
    customDeck?: string[];
    participants: {
        [accountId: string]: {
            name: string;
            vote: string | null;
            avatarUrl?: string; // Add other participant fields if known
        };
    };
}

interface ForgeContext {
    accountId: string;
    moduleKey: string;
    extension?: {
        issue?: {
            id: string;
            key?: string;
        }
    }
}

function App() {
  const [context, setContext] = useState<ForgeContext | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  // State for Lobby (Global Page)
  const [lobbyProjectKey, setLobbyProjectKey] = useState(''); 
  const [backlog, setBacklog] = useState<BacklogIssue[]>([]);
  const [backlogInfo, setBacklogInfo] = useState<BacklogInfo>({ total: 0, nextPageToken: null });
  const [isEditing, setIsEditing] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [editForm, setEditForm] = useState({ summary: '', description: '' });
  const [showBacklog, setShowBacklog] = useState(true); // Backlog visibility toggle
  const [backlogError, setBacklogError] = useState<string | null>(null);

  // Initialize Context & Check Local Storage
  useEffect(() => {
     // Enable Theme Sync
     view.theme.enable();

     // @ts-ignore - view.getContext returns generic Promise<any> often, explicitly casting via state
     view.getContext().then((ctx: any) => {
         setContext(ctx);
         setAccountId(ctx.accountId);

         // Check for active session in localStorage
         const savedSession = localStorage.getItem('dr_jira_poker_session');
         if (savedSession) {
             try {
                 const { projectKey, timestamp } = JSON.parse(savedSession);
                 const now = Date.now();
                 // 15 minutes = 900,000 ms
                 if (projectKey && (now - timestamp < 900000)) {
                     console.log('Restoring session for:', projectKey);
                     setLobbyProjectKey(projectKey);
                     // Auto-join if context is ready
                     startGame(projectKey, null, true);
                 } else {
                     console.log('Session expired, clearing.');
                     localStorage.removeItem('dr_jira_poker_session');
                 }
             } catch (e) {
                 console.error('Error parsing saved session', e);
             }
         }
     });
  }, []);

  // Backlog Fetcher
  const updateBacklog = async (key: string, nextPageToken: string | null = null, append = false) => {
      setBacklogError(null);
      try {
        const payload: any = { projectKey: key };
        if (nextPageToken) {
            payload.nextPageToken = nextPageToken;
        }
        
        const res: any = await invoke('getBacklog', payload);
        
        if (res.error) {
            throw new Error(res.error);
        }

        // Handle both old array format (fallback) and new object format
        const issues = Array.isArray(res) ? res : (res.issues || []);
        const total = res.total || 0;
        
        if (append) {
            setBacklog(prev => [...prev, ...issues]);
        } else {
            setBacklog(issues);
        }

        // Store next page token
        setBacklogInfo({
            total,
            nextPageToken: res.nextPageToken || null
        });
        
      } catch (e: any) {
          console.error("Backlog fetch error", e);
          await invoke('logMessage', { message: 'updateBacklog FAILED', data: { error: e.message } });
          setBacklogError(e.message || "Failed to load backlog");
      }
  };

  // START GAME (Shared Logic)
  const startGame = async (targetKey: string, explicitUser: any = null, isProject = false) => {
      // Clear any existing poll to avoid duplicates
      if ((window as any).pokerInterval) clearInterval((window as any).pokerInterval);

      setIsJoining(true); 
      await invoke('logMessage', { message: 'startGame initiated', data: { targetKey, isProject } });
      try {
        let currentAccountId = accountId;
        if (!currentAccountId && context) {
            currentAccountId = context.accountId;
            setAccountId(currentAccountId); 
        }

        // Fetch user
        if (!explicitUser) {
             const userRes = await requestJira('/rest/api/3/myself');
             explicitUser = await userRes.json();
        }

        // Join
        const payload: any = {
            displayName: explicitUser.displayName, 
            avatarUrl: explicitUser.avatarUrls['48x48'],
        };
        if (isProject) payload.roomKey = targetKey;
        else payload.issueId = targetKey;

        await invoke('logMessage', { message: 'Invoking joinSession', data: payload });
        await invoke('joinSession', payload);

        // Fetch Backlog if Project Mode
        if (isProject) {
            await invoke('logMessage', { message: 'Calling updateBacklog' });
            await updateBacklog(targetKey, null, false);
            // Save to localStorage
            localStorage.setItem('dr_jira_poker_session', JSON.stringify({
                projectKey: targetKey,
                timestamp: Date.now()
            }));
        }

        // Polling
        const poll = async () => {
           const pollPayload = isProject ? { roomKey: targetKey } : { issueId: targetKey };
           const data: any = await invoke('getSessionState', pollPayload);
           setSession(data);
           if (data) {
               setIsJoining(false);
               // Keep session alive
               if (isProject) {
                   localStorage.setItem('dr_jira_poker_session', JSON.stringify({
                        projectKey: targetKey,
                        timestamp: Date.now()
                   }));
               }
           }
        };
        poll();
        (window as any).pokerInterval = setInterval(poll, 1500);

      } catch (e: any) {
          console.error("Failed to start game", e);
          await invoke('logMessage', { message: 'startGame FAILED', data: { error: e.message, stack: e.stack } });
          setIsJoining(false);
      }
  };

  // Auto-Start for Issue Panel
  useEffect(() => {
    if (context && context.extension && context.extension.issue) {
        startGame(context.extension.issue.id, null, false);
    }
  }, [context]);

  const handleLobbySubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      await invoke('logMessage', { message: 'User clicked Open Room', data: { lobbyProjectKey } });
      // Join as Project Room
      await startGame(lobbyProjectKey, null, true);
  };

  const handleActivateIssue = async (issue: BacklogIssue) => {
      if (!session) return;
      // Mod Only
      if (session.moderatorId !== (accountId || context?.accountId)) return;

      // Switch active issue
      await invoke('setActiveIssue', { 
          roomKey: session.roomKey, 
          issueId: issue.id 
      });
      // Force refresh
      const data: any = await invoke('getSessionState', { roomKey: session.roomKey });
      setSession(data);
  };

  const handleLeaveRoom = async () => {
      if (!session) return;
      
      const confirmLeave = window.confirm("Are you sure you want to leave the room?");
      if (!confirmLeave) return;

      // Stop polling immediately
      if ((window as any).pokerInterval) {
          clearInterval((window as any).pokerInterval);
          (window as any).pokerInterval = null;
      }

      try {
          await invoke('leaveSession', { 
              roomKey: session.roomKey,
              issueId: session.issueId 
          });
      } catch(e) { console.error(e); }

      localStorage.removeItem('dr_jira_poker_session');
      setSession(null);
      setIsJoining(false); // Show Lobby
      setLobbyProjectKey(''); 
  };

  const handleUpdateIssue = async () => {
      if (!session || !session.activeIssueId) return;
      await invoke('updateIssue', { 
          issueId: session.activeIssueId,
          summary: editForm.summary,
          description: editForm.description
      });
      setIsEditing(false);
      // Wait for poll to update UI or optimistically update?
      // For now, let's just close edit mode. The active issue component handles re-fetching.
  };

  // Helper to sync edit form when active issue loads
  // Note: ActiveIssue component usually fetches its own data. 
  // We might want to lift that state up or pass a ref. 
  // For simplicity, we will let ActiveIssue handle display, and add an "Edit" button there.

  if (!context) return <div style={{ padding: 20 }}>Loading...</div>;

  // ROUTING
  if (context.moduleKey === 'poker-app-admin-page') return <AdminPage />;

  // LOBBY
  if (!session) {
      if (isJoining) {
          return (
             <div className="app-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                 <div style={{ textAlign:'center', color: 'var(--text-muted)' }}>
                    <h2 style={{color:'var(--primary)'}}>Entering Poker Room... ♣️</h2>
                    <p style={{marginTop:8}}>Shuffling the deck...</p>
                 </div>
             </div>
          );
      }
      // Issue Panel Loading
      if (context.moduleKey === 'poker-app-main-panel') return <div style={{ padding: 20 }}>Connecting...</div>;
      
      // Global Lobby
      return (
          <div className="app-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div className="lobby-card">
                  <h1 style={{ marginTop: 0 }}>Dr. Jira Poker Hub 👑</h1>
                  <p style={{ color: 'var(--text-muted)' }}>Enter a <strong>Project Key</strong> to open a Planning Room.</p>
                  
                  <form onSubmit={handleLobbySubmit} style={{ marginTop: 24 }}>
                      <input 
                        type="text" 
                        placeholder="e.g. GS" 
                        value={lobbyProjectKey}
                        onChange={e => setLobbyProjectKey(e.target.value.toUpperCase())}
                        style={{ padding: '12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--ds-background-input, #fff)', color: 'var(--text-main)', fontSize: '1.2rem', width: '120px', textAlign: 'center' }}
                      />
                      <br/>
                      <button 
                        type="submit" 
                        disabled={!lobbyProjectKey}
                        className="reveal-btn"
                        style={{ marginTop: 16, width: '100%' }}
                      >
                         Open Room
                      </button>
                  </form>
              </div>
          </div>
      );
  }

  // GAME UI
  return (
    <div className="app-container" style={{ 
        gridTemplateColumns: showBacklog ? '300px 1fr 250px' : '0px 1fr 250px', 
        gridTemplateRows: '1fr', 
        gap: 0, 
        padding: 0, 
        height: '100vh',
        position: 'relative',
        transition: 'grid-template-columns 0.3s ease'
    }}>
      
      {/* Show Backlog Button (when hidden) */}
      {!showBacklog && (
        <div style={{
            position: 'absolute',
            left: '0px',
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 1000
        }}>
          <Button
            appearance="primary"
            iconBefore={<ChevronRightIcon label="Show" />}
            onClick={() => setShowBacklog(true)}
            spacing="compact"
          />
        </div>
      )}
      
      {/* 1. BACKLOG PANE (Left) */}
      <div style={{ 
          background: 'var(--surface-raised)', 
          borderRight: 'var(--border)', 
          padding: showBacklog ? 16 : 0, 
          overflowY: 'auto', 
          height: '100vh',
          width: showBacklog ? '300px' : '0px',
          opacity: showBacklog ? 1 : 0,
          transition: 'all 0.3s ease',
          overflow: showBacklog ? 'auto' : 'hidden'
      }}>
          {/* Title with Toggle Button */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <h3 style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Backlog</h3>
                  <Button 
                    appearance="subtle" 
                    iconBefore={<RefreshIcon label="Refresh" size="small" />} 
                    onClick={() => updateBacklog(lobbyProjectKey || session.roomKey, null, false)}
                    spacing="compact"
                  />
              </div>
              <Button
                appearance="subtle"
                iconBefore={<ChevronLeftIcon label="Hide" />}
                onClick={() => setShowBacklog(false)}
                spacing="compact"
              />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 24 }}>
              {backlogError && (
                  <div style={{ padding: 12, borderRadius: 6, background: 'var(--ds-background-danger-bold, #FFEBE6)', color: 'var(--ds-text-danger, #DE350B)', fontSize: '0.9rem' }}>
                      <p style={{ margin: '0 0 8px 0' }}><strong>Error:</strong> {backlogError}</p>
                      <p style={{ margin: '0 0 8px 0' }}>Has the user granted access?</p>
                      <button 
                        onClick={() => updateBacklog(lobbyProjectKey || session.roomKey, null, false)}
                        style={{ background: 'transparent', border: '1px solid currentColor', borderRadius: 4, padding: '4px 8px', color: 'inherit', cursor: 'pointer' }}
                      >
                          Try Again
                      </button>
                  </div>
              )}
              {!backlogError && backlog.length === 0 && <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>No issues found in backlog.</p>}
              {backlog.map(issue => {
                  const isActive = session.activeIssueId === issue.id;
                  return (
                      <div 
                        key={issue.id}
                        onClick={() => handleActivateIssue(issue)}
                        style={{
                            padding: '12px',
                            borderRadius: '8px',
                            background: isActive 
                                ? 'var(--ds-background-selected, rgba(0, 82, 204, 0.1))' 
                                : 'var(--ds-surface-raised, #ffffff)',
                            border: isActive 
                                ? '2px solid var(--ds-border-selected, #0052cc)' 
                                : '1px solid var(--ds-border, #dfe1e6)',
                            boxShadow: isActive 
                                ? '0 4px 12px rgba(0,0,0,0.15)' 
                                : '0 1px 3px rgba(0,0,0,0.1)',
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px',
                            transition: 'all 0.2s ease',
                            transform: isActive ? 'scale(1.02)' : 'scale(1)',
                            opacity: isActive ? 1 : 0.85,
                            position: 'relative',
                            overflow: 'hidden'
                        }}
                        onMouseEnter={(e) => {
                            if (!isActive) {
                                e.currentTarget.style.transform = 'translateY(-2px) scale(1.01)';
                                e.currentTarget.style.boxShadow = '0 8px 16px rgba(0,0,0,0.12)';
                                e.currentTarget.style.borderColor = 'var(--ds-border-focused, #4c9aff)';
                                e.currentTarget.style.opacity = '1';
                            }
                        }}
                        onMouseLeave={(e) => {
                            if (!isActive) {
                                e.currentTarget.style.transform = 'translateY(0) scale(1)';
                                e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
                                e.currentTarget.style.borderColor = 'var(--ds-border, #dfe1e6)';
                                e.currentTarget.style.opacity = '0.85';
                            }
                        }}
                      >
                          {/* Active Stripe */}
                          {isActive && <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: 'var(--ds-border-selected, #0052cc)' }} />}

                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingLeft: isActive ? 6 : 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <img src={issue.icon} width="16" height="16" alt="" style={{ borderRadius: 2 }} />
                                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--ds-text, #172b4d)' }}>{issue.key}</span>
                              </div>
                              <div style={{ display: 'flex', gap: 4 }}>
                                  {issue.storyPoints && (
                                      <span style={{ 
                                          fontSize: '0.75rem', 
                                          fontWeight: 'bold',
                                          background: 'var(--ds-background-neutral, #e0e0e0)',
                                          color: 'var(--ds-text, #172b4d)',
                                          padding: '2px 6px',
                                          borderRadius: 4,
                                          border: '1px solid var(--ds-border, #ccc)'
                                      }}>
                                          {issue.storyPoints}
                                      </span>
                                  )}
                              </div>
                          </div>
                          <div style={{ 
                              fontSize: '0.9rem', 
                              color: 'var(--ds-text-subtle, #505f79)',
                              lineHeight: '1.4',
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                              paddingLeft: isActive ? 6 : 0 
                          }}>
                              {issue.summary}
                          </div>
                      </div>
                  );
              })}
              
              {/* Pagination Button */}
              {backlogInfo.nextPageToken && (
                  <button 
                    onClick={() => updateBacklog(lobbyProjectKey || session.roomKey, backlogInfo.nextPageToken, true)}
                    style={{ 
                        marginTop: 12, 
                        padding: '10px 20px', 
                        background: 'transparent', 
                        border: '1px solid var(--border)', 
                        borderRadius: 8, 
                        color: 'var(--primary)', 
                        cursor: 'pointer',
                        fontSize: '0.9rem',
                        fontWeight: 600,
                        alignSelf: 'center',
                        transition: 'all 0.2s ease',
                        width: '100%'
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'var(--primary)';
                        e.currentTarget.style.color = 'var(--primary-text)';
                        e.currentTarget.style.transform = 'scale(1.02)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.color = 'var(--primary)';
                        e.currentTarget.style.transform = 'scale(1)';
                    }}
                  >
                    Load More
                  </button>
              )}
          </div>
      </div>

      {/* 2. CENTER STAGE (Active Issue + Table) */}
      <div style={{ display: 'grid', gridTemplateRows: 'auto 1fr auto', position: 'relative', background: 'var(--bg-gradient)' }}>
         
         {/* Top: Active Issue */}
         <div style={{ padding: 24, paddingBottom: 0 }}>
             
             {/* @ts-ignore */}
             <ActiveIssue 
                session={session} 
                isEditable={session.moderatorId === (accountId || context?.accountId)} 
                updateIssue={invoke}
             />
         </div>

         {/* Middle: Poker Table */}
         <div className="game-area" style={{ gridTemplateColumns: '1fr', padding: 24, overflow: 'visible' }}>
            {/* @ts-ignore */}
            <GameArea 
                session={session} 
                accountId={accountId || context.accountId} 
                onReveal={() => invoke('revealVotes', { roomKey: session.roomKey, issueId: session.issueId })} 
                onReset={() => invoke('resetRound', { roomKey: session.roomKey, issueId: session.issueId })} 
            />
         </div>

         {/* Bottom: Deck */}
         <div style={{ padding: 24 }}>
            {/* @ts-ignore */}
            <VotingDeck 
                selectedValue={session.participants[accountId || context.accountId]?.vote} 
                onVote={(val: any) => invoke('submitVote', { vote: val, roomKey: session.roomKey, issueId: session.issueId })}
                disabled={session.status === 'REVEALED'}
                deckType={session.deckType}
                customValues={session.customDeck}
            />
         </div>
      </div>

      {/* 3. PARTICIPANTS PANE (Right) */}
      <div style={{ background: 'var(--surface-raised)', borderLeft: 'var(--border)', padding: 16, overflowY: 'auto', height: '100vh' }}>
          <h3 style={{ marginTop: 0, color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Players</h3>
          {/* @ts-ignore */}
          <ParticipantList 
              participants={session.participants} 
              revealed={session.status === 'REVEALED'} 
          />
          
          <button 
            onClick={handleLeaveRoom}
            style={{
                marginTop: 20,
                width: '100%',
                padding: '10px',
                background: 'rgba(239, 68, 68, 0.1)', 
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#ef4444', 
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: '0.9rem',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                transition: 'all 0.2s'
            }}
            onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
            }}
            onMouseLeave={e => {
                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
            }}
          >
            🚪 Leave Room
          </button>
      </div>

    </div>
  );
}

export default App;

