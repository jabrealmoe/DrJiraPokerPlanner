import { storage } from '@forge/api';
import { getStorageKeys } from '../utils/storageKeys';
import { getGlobalCache } from './CacheService';

/**
 * Voting Service - Handles poker voting logic
 * 
 * Responsibilities:
 * - Submit votes
 * - Reveal votes
 * - Reset rounds
 * - Start timer
 */
export class VotingService {
  constructor() {
    this.cache = getGlobalCache(5000); // 5 second cache
  }

  /**
   * Submit a vote
   * @param {Object} req - Forge request object
   * @returns {Object} Updated session
   */
  async submit(req) {
    const { vote, roomKey, issueId } = req.payload;
    const { accountId } = req.context;

    // Validate input
    if (!vote && vote !== 0) {
      throw new Error('Vote value is required');
    }

    const actualKey = roomKey || issueId;
    const storageKey = getStorageKeys().room(actualKey);

    const session = await storage.get(storageKey);

    if (!session) {
      throw new Error('Session not found');
    }

    // Update vote
    if (!session.participants) {
      session.participants = {};
    }

    if (session.participants[accountId]) {
      session.participants[accountId].vote = vote;
    }

    session.updatedAt = Date.now();

    await storage.set(storageKey, session);
    this.cache.invalidate(storageKey);

    console.log(`[VotingService] User ${accountId} voted ${vote} in session ${actualKey}`);

    return session;
  }

  /**
   * Reveal all votes
   * @param {Object} req - Forge request object
   * @returns {Object} Updated session
   */
  async reveal(req) {
    const { roomKey, issueId } = req.payload;
    const { accountId } = req.context;

    const actualKey = roomKey || issueId;
    const storageKey = getStorageKeys().room(actualKey);

    const session = await storage.get(storageKey);

    if (!session) {
      throw new Error('Session not found');
    }

    // Only moderator can reveal
    if (session.moderatorId !== accountId) {
      throw new Error('Only moderator can reveal votes');
    }

    session.status = 'REVEALED';
    session.updatedAt = Date.now();

    await storage.set(storageKey, session);
    this.cache.invalidate(storageKey);

    console.log(`[VotingService] Votes revealed in session ${actualKey}`);

    return session;
  }

  /**
   * Reset voting round
   * @param {Object} req - Forge request object
   * @returns {Object} Updated session
   */
  async reset(req) {
    const { roomKey, issueId } = req.payload;
    const { accountId } = req.context;

    const actualKey = roomKey || issueId;
    const storageKey = getStorageKeys().room(actualKey);

    const session = await storage.get(storageKey);

    if (!session) {
      throw new Error('Session not found');
    }

    // Only moderator can reset
    if (session.moderatorId !== accountId) {
      throw new Error('Only moderator can reset round');
    }

    // Reset all votes
    if (session.participants) {
      Object.keys(session.participants).forEach(participantId => {
        session.participants[participantId].vote = null;
      });
    }

    session.status = 'VOTING';
    session.updatedAt = Date.now();

    await storage.set(storageKey, session);
    this.cache.invalidate(storageKey);

    console.log(`[VotingService] Round reset in session ${actualKey}`);

    return session;
  }

  /**
   * Start timer for voting
   * @param {Object} req - Forge request object
   * @returns {Object} Timer info
   */
  async startTimer(req) {
    const { roomKey, issueId, duration } = req.payload;

    const actualKey = roomKey || issueId;
    const storageKey = getStorageKeys().room(actualKey);

    const session = await storage.get(storageKey);

    if (!session) {
      throw new Error('Session not found');
    }

    const timerEnd = Date.now() + (duration * 1000);

    session.timerEnd = timerEnd;
    session.timerDuration = duration;
    session.updatedAt = Date.now();

    await storage.set(storageKey, session);
    this.cache.invalidate(storageKey);

    console.log(`[VotingService] Timer started for ${duration}s in session ${actualKey}`);

    return {
      timerEnd,
      duration,
      remainingSeconds: duration
    };
  }
}
