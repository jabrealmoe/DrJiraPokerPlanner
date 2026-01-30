import Resolver from '@forge/resolver';
import { storage, route, asUser } from '@forge/api';
import { SessionService } from './services/SessionService';
import { VotingService } from './services/VotingService';
import { BacklogService } from './services/BacklogService';
import { getStorageKeys } from './utils/storageKeys';

const resolver = new Resolver();

// Initialize services
const sessionService = new SessionService();
const votingService = new VotingService();
const backlogService = new BacklogService();

// ============================================================================
// SESSION MANAGEMENT
// ============================================================================

resolver.define('joinSession', async (req) => {
  try {
    return await sessionService.join(req);
  } catch (error) {
    console.error('[joinSession] Error:', error);
    return { success: false, error: error.message };
  }
});

resolver.define('leaveSession', async (req) => {
  try {
    return await sessionService.leave(req);
  } catch (error) {
    console.error('[leaveSession] Error:', error);
    return { success: false, error: error.message };
  }
});

resolver.define('getSessionState', async (req) => {
  try {
    return await sessionService.getState(req);
  } catch (error) {
    console.error('[getSessionState] Error:', error);
    return null;
  }
});

resolver.define('setActiveIssue', async (req) => {
  try {
    return await sessionService.setActiveIssue(req);
  } catch (error) {
    console.error('[setActiveIssue] Error:', error);
    return { success: false, error: error.message };
  }
});

resolver.define('clearAllSessions', async (req) => {
  try {
    return await sessionService.clearAll();
  } catch (error) {
    console.error('[clearAllSessions] Error:', error);
    return { success: false, error: error.message };
  }
});

// ============================================================================
// VOTING
// ============================================================================

resolver.define('submitVote', async (req) => {
  try {
    return await votingService.submit(req);
  } catch (error) {
    console.error('[submitVote] Error:', error);
    return { success: false, error: error.message };
  }
});

resolver.define('revealVotes', async (req) => {
  try {
    return await votingService.reveal(req);
  } catch (error) {
    console.error('[revealVotes] Error:', error);
    return { success: false, error: error.message };
  }
});

resolver.define('resetRound', async (req) => {
  try {
    return await votingService.reset(req);
  } catch (error) {
    console.error('[resetRound] Error:', error);
    return { success: false, error: error.message };
  }
});

resolver.define('startTimer', async (req) => {
  try {
    return await votingService.startTimer(req);
  } catch (error) {
    console.error('[startTimer] Error:', error);
    return { success: false, error: error.message };
  }
});

// ============================================================================
// BACKLOG
// ============================================================================

resolver.define('getBacklog', async (req) => {
  try {
    return await backlogService.get(req);
  } catch (error) {
    console.error('[getBacklog] Error:', error);
    return { issues: [], total: 0, error: error.message };
  }
});

// ============================================================================
// BATCH OPERATIONS (Critical Change #4)
// ============================================================================

resolver.define('getBatchData', async (req) => {
  try {
    const { roomKey, projectKey } = req.payload;

    // Fetch all data in parallel
    const [session, backlog, config] = await Promise.all([
      roomKey ? sessionService.getState({ payload: { roomKey }, context: req.context }) : null,
      projectKey ? backlogService.get({ payload: { projectKey }, context: req.context }) : null,
      storage.get(getStorageKeys().config())
    ]);

    return {
      session,
      backlog,
      config: config || {}
    };
  } catch (error) {
    console.error('[getBatchData] Error:', error);
    return { error: error.message };
  }
});

// ============================================================================
// ISSUE MANAGEMENT
// ============================================================================

resolver.define('fetchIssueDetails', async (req) => {
  const { issueId } = req.payload;
  
  try {
    const response = await asUser().requestJira(
      route`/rest/api/3/issue/${issueId}?fields=summary,description,status`
    );
    
    if (!response.ok) {
      return null;
    }
    
    return await response.json();
  } catch (error) {
    console.error('[fetchIssueDetails] Error:', error);
    return null;
  }
});

resolver.define('updateIssue', async (req) => {
  const { issueId, summary, description } = req.payload;
  
  try {
    const updateBody = { fields: {} };
    
    if (summary) updateBody.fields.summary = summary;
    if (description) updateBody.fields.description = description;

    const response = await asUser().requestJira(route`/rest/api/3/issue/${issueId}`, {
      method: 'PUT',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updateBody)
    });

    if (!response.ok) {
      throw new Error(`Jira API error: ${response.status}`);
    }

    // Invalidate backlog cache since issue was updated
    const issue = await asUser().requestJira(
      route`/rest/api/3/issue/${issueId}?fields=project`
    );
    const issueData = await issue.json();
    const projectKey = issueData.fields?.project?.key;
    
    if (projectKey) {
      backlogService.invalidateCache(projectKey);
    }

    return { success: true };
  } catch (error) {
    console.error('[updateIssue] Error:', error);
    return { success: false, error: error.message };
  }
});

resolver.define('lookupIssue', async (req) => {
  const { issueKey } = req.payload;
  
  if (!issueKey) {
    return null;
  }
  
  try {
    const response = await asUser().requestJira(
      route`/rest/api/3/issue/${issueKey}?fields=summary`
    );
    
    if (!response.ok) {
      console.warn(`[lookupIssue] Failed: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    return {
      id: data.id,
      key: data.key,
      summary: data.fields.summary
    };
  } catch (error) {
    console.error('[lookupIssue] Error:', error);
    return null;
  }
});

// ============================================================================
// CONFIGURATION
// ============================================================================

resolver.define('getAppConfig', async (req) => {
  try {
    const config = await storage.get(getStorageKeys().config());
    return config || {};
  } catch (error) {
    console.error('[getAppConfig] Error:', error);
    return {};
  }
});

resolver.define('saveAppConfig', async (req) => {
  try {
    const { config } = req.payload;
    await storage.set(getStorageKeys().config(), config);
    return { success: true };
  } catch (error) {
    console.error('[saveAppConfig] Error:', error);
    return { success: false, error: error.message };
  }
});

// ============================================================================
// LOGGING (Development/Debugging)
// ============================================================================

resolver.define('logMessage', async (req) => {
  const { message, data } = req.payload;
  console.log(`[Client Log] ${message}`, data || '');
  return { logged: true };
});

// ============================================================================
// EXPORT
// ============================================================================

export const handler = resolver.getDefinitions();
