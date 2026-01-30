import { asUser, route } from '@forge/api';
import { getGlobalCache } from './CacheService';

/**
 * Backlog Service - Handles Jira backlog queries
 * 
 * Responsibilities:
 * - Fetch backlog with caching
 * - Batch operations
 * - Field filtering for performance
 */
export class BacklogService {
  constructor() {
    this.cache = getGlobalCache(30000); // 30 second cache for backlog
  }

  /**
   * Get backlog for a project
   * @param {Object} req - Forge request object
   * @returns {Object} Backlog data with pagination
   */
  async get(req) {
    const { projectKey, nextPageToken } = req.payload;

    if (!projectKey) {
      throw new Error('projectKey is required');
    }

    // Create cache key
    const cacheKey = `backlog:${projectKey}:${nextPageToken || 'initial'}`;

    // Try cache first
    const cached = this.cache.get(cacheKey);
    if (cached) {
      console.log(`[BacklogService] Cache hit for ${projectKey}`);
      return cached;
    }

    console.log(`[BacklogService] Cache miss for ${projectKey}, fetching from Jira`);

    try {
      // Build JQL query
      const jql = `project = "${projectKey}" AND statusCategory != Done ORDER BY rank ASC`;

      // Use field filtering to reduce payload size
      const fields = ['summary', 'status', 'issuetype', 'customfield_10016']; // customfield_10016 is typically Story Points

      // Build query params
      const params = new URLSearchParams({
        jql,
        fields: fields.join(','),
        maxResults: '50'
      });

      if (nextPageToken) {
        params.append('startAt', nextPageToken);
      }

      const response = await asUser().requestJira(
        route`/rest/api/3/search?${params.toString()}`
      );

      if (!response.ok) {
        throw new Error(`Jira API error: ${response.status}`);
      }

      const data = await response.json();

      // Transform issues
      const issues = data.issues.map(issue => ({
        id: issue.id,
        key: issue.key,
        summary: issue.fields.summary,
        status: issue.fields.status?.name || 'Unknown',
        icon: issue.fields.issuetype?.iconUrl || '',
        storyPoints: issue.fields.customfield_10016 || null
      }));

      const result = {
        issues,
        total: data.total,
        nextPageToken: data.startAt + data.maxResults < data.total 
          ? data.startAt + data.maxResults 
          : null
      };

      // Cache the result
      this.cache.set(cacheKey, result);

      console.log(`[BacklogService] Fetched ${issues.length} issues for ${projectKey}`);

      return result;
    } catch (error) {
      console.error('[BacklogService] Error fetching backlog:', error);
      throw error;
    }
  }

  /**
   * Invalidate backlog cache for a project
   * @param {string} projectKey - Project key
   */
  invalidateCache(projectKey) {
    this.cache.invalidatePattern(`backlog:${projectKey}`);
  }
}
