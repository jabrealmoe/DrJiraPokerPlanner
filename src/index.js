import Resolver from '@forge/resolver';
import { storage, route, asUser } from '@forge/api';

const resolver = new Resolver();

// Key Generation
const getSessionKey = (issueId) => `poker_session_v1_${issueId}`;

// Helper to reliably get Issue ID from context
// Helper to reliably get Issue ID from context or payload
const getIssueId = (req) => {
  return req.payload?.issueId || req.context.extension?.issue?.id || req.context.extension?.issueId;
};

// New Resolver: Lookup Issue by Key
resolver.define('lookupIssue', async (req) => {
    const { issueKey } = req.payload;
    if (!issueKey) return null;
    
    // Use the asUser method imported at top level
    try {
        const response = await asUser().requestJira(route`/rest/api/3/issue/${issueKey}?fields=summary`);
        if (!response.ok) {
           console.warn(`Lookup failed: ${response.status}`);
           return null;
        }
        
        const data = await response.json();
        return {
            id: data.id,
            key: data.key,
            summary: data.fields.summary
        };
    } catch (e) {
        console.error("Lookup failed", e);
        return null;
    }
});

// --- JIRA API HELPERS ---
const fetchIssueDetails = async (issueIdOrKey) => {
    try {
        const response = await asUser().requestJira(route`/rest/api/3/issue/${issueIdOrKey}?fields=summary,description,status`);
        if (!response.ok) return null;
        return await response.json();
    } catch (e) { return null; }
};

// --- RESOLVERS ---

// 1. BACKLOG & PROJ MANAGEMENT
resolver.define('getBacklog', async (req) => {
    let { projectKey, nextPageToken } = req.payload;

    if (!projectKey) {
        console.warn("[getBacklog] No projectKey provided.");
        return { issues: [], total: 0 };
    }

    // Robustness: If user entered an Issue Key (e.g. GS-123), extract 'GS'
    if (projectKey.includes('-')) {
        projectKey = projectKey.split('-')[0];
    }
    
    if (projectKey.includes('-')) {
        projectKey = projectKey.split('-')[0];
    }
    
    console.log(`[getBacklog] ENTERING function. projectKey: ${projectKey}`);
    console.log(`[getBacklog] Context AccountId: ${req.context.accountId}`);

    console.log(`[getBacklog] Fetching for ${projectKey}, nextPageToken: ${nextPageToken || 'initial'}`);

    try {
        const jql = `project = "${projectKey}" AND statusCategory != Done ORDER BY rank ASC`;
        console.log(`[getBacklog] JQL: ${jql}`);
        
        // Build request body - only include nextPageToken if it exists
        const requestBody = {
            jql: jql,
            maxResults: 20,
            fields: ['summary', 'status', 'issuetype', 'customfield_10016'] // customfield_10016 is typically Story Points
        };
        
        if (nextPageToken) {
            requestBody.nextPageToken = nextPageToken;
        }
        
        const response = await asUser().requestJira(route`/rest/api/3/search/jql`, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });
        
        console.log(`[getBacklog] Response status: ${response.status}`);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[getBacklog] JQL failed: ${response.status} ${errorText}`);
            throw new Error(`Jira API Error: ${response.status}`);
        }
        
        const data = await response.json();
        console.log(`[getBacklog] Issues found: ${data.issues?.length}, has more: ${!!data.nextPageToken}`);
        
        const mappedIssues = data.issues.map(i => ({
            id: i.id,
            key: i.key,
            summary: i.fields.summary,
            status: i.fields.status.name,
            icon: i.fields.issuetype.iconUrl,
            storyPoints: i.fields.customfield_10016 || null // Story Points estimate
        }));
        
        return {
            issues: mappedIssues,
            total: data.total,
            nextPageToken: data.nextPageToken // Return token for next page
        };

    } catch (e) {
        console.error("[getBacklog] Exception caught:", e);
        return { issues: [], total: 0, error: e.message || "Unknown error" };
    }
});

resolver.define('updateIssue', async (req) => {
    const { issueId, summary, description } = req.payload;
    
    const body = { fields: {} };
    if (summary !== undefined) body.fields.summary = summary;
    
    // Convert plain text description to ADF format
    if (description !== undefined) {
        // Split by newlines and create a paragraph for each non-empty line
        const paragraphs = description
            .split('\n')
            .filter(line => line.trim())
            .map(line => ({
                type: 'paragraph',
                content: [{
                    type: 'text',
                    text: line
                }]
            }));
        
        body.fields.description = {
            type: 'doc',
            version: 1,
            content: paragraphs.length > 0 ? paragraphs : [{
                type: 'paragraph',
                content: []
            }]
        };
    }

    try {
        const response = await asUser().requestJira(route`/rest/api/3/issue/${issueId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        return { success: response.ok };
    } catch (e) {
        return { success: false, error: e };
    }
});

// 2. SESSION / ROOM LOGIC
// We now support "Room Mode" where the key is the Project Key.
// If roomKey is generic, we use `poker_room_${key}`.

const getRoomKey = (key) => `poker_v2_room_${key}`;

resolver.define('joinSession', async (req) => {
  console.log(`[joinSession] ENTERING function. AccountId: ${req.context.accountId}`);
  const { accountId } = req.context;
  const { displayName, avatarUrl, roomKey, issueId } = req.payload;
  
  // Backwards compatibility: if issueId provided, roomKey = issueId (Issue Panel Mode)
  const actualRoomKey = roomKey || issueId;
  if (!actualRoomKey) throw new Error("Room Key or Issue ID required");

  const storageKey = getRoomKey(actualRoomKey);
  let session = await storage.get(storageKey);

  // Initialize
  if (!session) {
    // 1. Fetch Global Config
    console.log(`[joinSession] Session not found for ${actualRoomKey}, creating new session.`);
    const config = await storage.get('poker-app-config');
    console.log(`[joinSession] Fetched global config: ${JSON.stringify(config)}`);
    
    const deckType = config ? config.deckType : 'FIBONACCI';
    const customDeck = config ? config.customDeck : null;
    console.log(`[joinSession] Using deckType: ${deckType}`);

    session = {
      version: 1,
      roomKey: actualRoomKey,
      activeIssueId: issueId || null, 
      status: 'VOTING',
      participants: {},
      deckType: deckType,
      customDeck: customDeck,
      updatedAt: Date.now(),
      moderatorId: accountId, // Creator is Moderator
      timer: {
          startTime: null,
          duration: 60, 
          status: 'STOPPED' 
      }
    };
  } else {
      console.log(`[joinSession] Found existing session for ${actualRoomKey} with deckType: ${session.deckType}`);
  }
  
  // Claim Mod if empty
  if (!session.moderatorId) {
      session.moderatorId = accountId;
  }

  // Add Participant
  if (!session.participants[accountId]) {
     session.participants[accountId] = {
       displayName,
       avatarUrl,
       vote: null,
       hasVoted: false,
       joinedAt: Date.now(),
       isModerator: session.moderatorId === accountId
     };
     await storage.set(storageKey, session);
  } else {
     // Ensure isModerator is up to date (in case keys changed or re-claim)
     if (session.participants[accountId].isModerator !== (session.moderatorId === accountId)) {
         session.participants[accountId].isModerator = (session.moderatorId === accountId);
         await storage.set(storageKey, session);
     }
  }

  return session;
});

resolver.define('getSessionState', async (req) => {
  const { roomKey, issueId } = req.payload;
  // Fallback for Issue Panel context
  const contextIssueId = req.context.extension?.issue?.id;
  
  const actualKey = roomKey || issueId || contextIssueId;
  if (!actualKey) return null;

  const storageKey = getRoomKey(actualKey);
  return await storage.get(storageKey);
});

resolver.define('setActiveIssue', async (req) => {
    const { roomKey, issueId } = req.payload;
    const storageKey = getRoomKey(roomKey);
    let session = await storage.get(storageKey);
    
    if (session) {
        session.activeIssueId = issueId;
        session.status = 'VOTING'; // Reset status
        session.version += 1;
        // Reset votes when switching issues
        Object.keys(session.participants).forEach(p => {
            session.participants[p].vote = null;
            session.participants[p].hasVoted = false;
        });
        await storage.set(storageKey, session);
    }
    return session;
});

resolver.define('submitVote', async (req) => {
  const { accountId } = req.context;
  const { vote, roomKey, issueId } = req.payload; // issueId is legacy param, use roomKey

  const actualKey = roomKey || issueId; 
  const storageKey = getRoomKey(actualKey);
  let session = await storage.get(storageKey);

  if (session && session.status === 'VOTING') {
      if (session.participants[accountId]) {
          session.participants[accountId].vote = vote;
          session.participants[accountId].hasVoted = vote !== null && vote !== undefined;
          session.updatedAt = Date.now();
          await storage.set(storageKey, session);
      }
  }
  return session;
});

resolver.define('revealVotes', async (req) => {
  const { roomKey, issueId } = req.payload;
  const actualKey = roomKey || issueId; 
  const storageKey = getRoomKey(actualKey);
  let session = await storage.get(storageKey);

  if (session) {
      session.status = 'REVEALED';
      await storage.set(storageKey, session);
  }
  return session;
});

resolver.define('startTimer', async (req) => {
    const { roomKey, issueId, duration } = req.payload;
    const actualKey = roomKey || issueId;
    const storageKey = getRoomKey(actualKey);
    let session = await storage.get(storageKey);

    if (session) {
        session.timer = {
            startTime: Date.now(),
            duration: duration || 60,
            status: 'RUNNING'
        };
        session.updatedAt = Date.now();
        await storage.set(storageKey, session);
    }
    return session;
});

resolver.define('resetRound', async (req) => {
  const { roomKey, issueId } = req.payload;
  const actualKey = roomKey || issueId; 
  const storageKey = getRoomKey(actualKey);
  let session = await storage.get(storageKey);

  if (session) {
      session.status = 'VOTING';
      Object.keys(session.participants).forEach(pid => {
          session.participants[pid].vote = null;
          session.participants[pid].hasVoted = false;
      });
      session.timer = { startTime: null, duration: 60, status: 'STOPPED' };
      await storage.set(storageKey, session);
  }
  return session;
});

// --- ADMIN RESOLVERS ---

resolver.define('getAppConfig', async () => {
    return await storage.get('poker-app-config');
});

resolver.define('saveAppConfig', async (req) => {
    const { config } = req.payload;
    console.log(`[saveAppConfig] Received config: ${JSON.stringify(config)}`);

    if (!config) throw new Error("No config provided");
    
    // Basic server-side validation
    if (config.deckType === 'CUSTOM' && !config.customDeck) {
        throw new Error("Custom deck values required");
    }
    
    await storage.set('poker-app-config', config);
    console.log(`[saveAppConfig] Config saved successfully.`);
    return { success: true };
});

resolver.define('logMessage', async (req) => {
    const { message, data } = req.payload;
    // Log prominently
    console.log(`\n--- [CLIENT] ${message} ---\n`, data ? JSON.stringify(data, null, 2) : '', '\n--------------------------\n');
    return null;
});

resolver.define('leaveSession', async (req) => {
    const { accountId } = req.context;
    const { roomKey, issueId } = req.payload;
    
    const actualKey = roomKey || issueId;
    const storageKey = getRoomKey(actualKey);
    let session = await storage.get(storageKey);
    
    if (session && session.participants[accountId]) {
        // Remove participant
        delete session.participants[accountId];
        
        // If Mod left, reassign
        if (session.moderatorId === accountId) {
            const nextModId = Object.keys(session.participants)[0];
            session.moderatorId = nextModId || null;
            if (nextModId) {
                session.participants[nextModId].isModerator = true;
            }
        }
        
        await storage.set(storageKey, session);
    }
    return { success: true };
});

resolver.define('clearAllSessions', async () => {
   // Use cursor to iterate and delete. 
   // Note: In a real prod app with thousands of keys, this might hit timeout.
   // We will implement a simplified batch delete for now (first 20 matches).
   // A proper solution requires a background job or repeated calls from client.
   
   let cursor = undefined;
   let deletedCount = 0;
   
   // Safety cap of 50 to prevent timeout loop
   const limit = 50; 
   const query = storage.query().where('key', key => key.startsWith('poker_session_v1_')).limit(20);
   
   const results = await query.getMany();
   
   for (const result of results.results) {
       await storage.delete(result.key);
       deletedCount++;
   }

   return { count: deletedCount };
});

export const handler = resolver.getDefinitions();
