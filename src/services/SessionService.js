import { storage } from '@forge/api';
import { getStorageKeys } from '../utils/storageKeys';
import { getGlobalCache } from './CacheService';

/**
 * Session Service - Handles poker session management
 * 
 * Responsibilities:
 * - Join/leave sessions
 * - Get session state (with caching)
 * - Set active issue
 * - Clear sessions
 */
export class SessionService {
  constructor() {
    this.cache = getGlobalCache(5000); // 5 second cache
  }

  /**
   * Join a poker session
   * @param {Object} req - Forge request object
   * @returns {Object} Session data
   */
  async join(req) {
    const { roomKey, issueId, displayName, avatarUrl } = req.payload;
    const { accountId } = req.context;

    // Validate input
    if (!roomKey && !issueId) {
      throw new Error('roomKey or issueId required');
    }

    if (!displayName) {
      throw new Error('displayName required');
    }

    const actualKey = roomKey || issueId;
    const storageKey = getStorageKeys().room(actualKey);

    // Get or create session
    let session = await storage.get(storageKey);

    if (!session) {
      session = this.createSession(actualKey, accountId);
    }

    // Add or update participant
    if (!session.participants) {
      session.participants = {};
    }

    session.participants[accountId] = {
      name: displayName,
      vote: null,
      hasVoted: false,
      avatarUrl: avatarUrl || null,
      joinedAt: session.participants[accountId]?.joinedAt || Date.now()
    };

    // Set moderator if first participant
    if (!session.moderatorId) {
      session.moderatorId = accountId;
    }

    session.updatedAt = Date.now();

    await storage.set(storageKey, session);
    this.cache.invalidate(storageKey);

    console.log(`[SessionService] User ${accountId} joined session ${actualKey}`);

    return session;
  }

  /**
   * Leave a poker session
   * @param {Object} req - Forge request object
   * @returns {Object} Success status
   */
  async leave(req) {
    const { roomKey, issueId } = req.payload;
    const { accountId } = req.context;

    const actualKey = roomKey || issueId;
    const storageKey = getStorageKeys().room(actualKey);

    const session = await storage.get(storageKey);

    if (session && session.participants) {
      delete session.participants[accountId];
      session.updatedAt = Date.now();

      await storage.set(storageKey, session);
      this.cache.invalidate(storageKey);

      console.log(`[SessionService] User ${accountId} left session ${actualKey}`);
    }

    return { success: true };
  }

  /**
   * Get session state (with caching)
   * @param {Object} req - Forge request object
   * @returns {Object} Session data
   */
  async getState(req) {
    const { roomKey, issueId } = req.payload;
    const actualKey = roomKey || issueId;

    if (!actualKey) {
      return null;
    }

    const storageKey = getStorageKeys().room(actualKey);

    // Try cache first
    let session = this.cache.get(storageKey);

    if (!session) {
      // Cache miss - fetch from storage
      session = await storage.get(storageKey);
      
      if (session) {
        this.cache.set(storageKey, session);
      }
    }

    return session;
  }

  /**
   * Set active issue in a project room
   * @param {Object} req - Forge request object
   * @returns {Object} Updated session
   */
  async setActiveIssue(req) {
    const { roomKey, issueId } = req.payload;
    const { accountId } = req.context;

    const storageKey = getStorageKeys().room(roomKey);
    const session = await storage.get(storageKey);

    if (!session) {
      throw new Error('Session not found');
    }

    // Only moderator can change active issue
    if (session.moderatorId !== accountId) {
      throw new Error('Only moderator can change active issue');
    }

    session.activeIssueId = issueId;
    session.status = 'VOTING';
    session.votes = {}; // Reset votes
    session.updatedAt = Date.now();

    await storage.set(storageKey, session);
    this.cache.invalidate(storageKey);

    console.log(`[SessionService] Active issue set to ${issueId} in room ${roomKey}`);

    return session;
  }

  /**
   * Clear all sessions (admin function)
   * @returns {Object} Deletion count
   */
  async clearAll() {
    const keys = getStorageKeys();
    let deletedCount = 0;

    // Query all room keys
    let cursor = storage
      .query()
      .where('key', k => k.startsWith(keys.room('')));

    let hasMore = true;

    while (hasMore) {
      const results = await cursor.getMany();
      
      for (const result of results.results) {
        await storage.delete(result.key);
        deletedCount++;
      }

      cursor = results.nextCursor;
      hasMore = !!cursor;
    }

    // Clear cache
    this.cache.clear();

    console.log(`[SessionService] Cleared ${deletedCount} sessions`);

    return { deletedCount };
  }

  /**
   * Create a new session
   * @param {string} key - Room key
   * @param {string} moderatorId - Moderator account ID
   * @returns {Object} New session object
   */
  createSession(key, moderatorId) {
    return {
      roomKey: key,
      moderatorId,
      participants: {},
      votes: {},
      status: 'WAITING',
      deckType: 'fibonacci',
      activeIssueId: null,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
  }
}
