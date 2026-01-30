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
    // Try cache first
    const cacheKey = `backlog:${projectKey}:${nextPageToken || 'initial'}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      console.log(`[BacklogService] Cache hit for ${projectKey}`);
      return cached;
    }

    console.log(`[BacklogService] Cache miss for ${projectKey}, fetching from Jira`);

    try {
      // Primary JQL: Unresolved issues ordered by Rank
      let jql = `project = "${projectKey}" AND resolution = Unresolved ORDER BY Rank ASC`;
      
      // Attempt fetch
      let data = await this.fetchIssues(jql, nextPageToken);

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
      console.error(`[BacklogService] Error fetching backlog for ${projectKey}:`, error);
      
      // Fallback: If "Rank" field doesn't exist, try without it
      if (error.message.includes("Rank") || error.message.includes("does not exist")) {
        console.log('[BacklogService] Retrying without ORDER BY Rank...');
        try {
          const fallbackJql = `project = "${projectKey}" AND resolution = Unresolved ORDER BY created DESC`;
          const data = await this.fetchIssues(fallbackJql, nextPageToken);
          
          // Transform and return (similar logic)
          const issues = data.issues.map(issue => ({
            id: issue.id,
            key: issue.key,
            summary: issue.fields.summary,
            status: issue.fields.status?.name || 'Unknown',
            icon: issue.fields.issuetype?.iconUrl || '',
            storyPoints: issue.fields.customfield_10016 || null
          }));
          
          return {
             issues,
             total: data.total,
             nextPageToken: data.startAt + data.maxResults < data.total ? data.startAt + data.maxResults : null
          };
        } catch (retryError) {
          console.error('[BacklogService] Retry failed:', retryError);
          throw retryError;
        }
      }

      throw error;
    }
  }

  /**
   * Helper to fetch issues from Jira
   */
  async fetchIssues(jql, startAt) {
      const fields = ['summary', 'status', 'issuetype', 'customfield_10016'];
      
      const params = new URLSearchParams({
        jql,
        fields: fields.join(','),
        maxResults: '50'
      });

      if (startAt) {
        params.append('startAt', startAt);
      }

      // Note: We use route interpolated string carefully
      const response = await asUser().requestJira(
        route`/rest/api/3/search?${params.toString()}`
      );

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Jira API error ${response.status}: ${text}`);
      }

      return await response.json();
  }
  invalidateCache(projectKey) {
    this.cache.invalidatePattern(`backlog:${projectKey}`);
  }
}
