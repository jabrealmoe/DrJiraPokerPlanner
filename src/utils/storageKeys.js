/**
 * Centralized storage key generation with environment prefixing and versioning
 * 
 * This prevents dev/staging/prod data from mixing and enables safe schema migrations.
 */

const ENV = process.env.FORGE_ENV || 'development';
const VERSION = 'v3';

/**
 * Get storage keys with environment and version prefixes
 * @returns {Object} Storage key generators
 */
export function getStorageKeys() {
  return {
    /**
     * Session key (legacy v1 format)
     * @param {string} issueId - Issue ID
     * @returns {string} Storage key
     */
    session: (issueId) => `${ENV}_poker_session_${VERSION}_${issueId}`,
    
    /**
     * Room key (v2+ format, supports both issues and projects)
     * @param {string} key - Room key (issue ID or project key)
     * @returns {string} Storage key
     */
    room: (key) => `${ENV}_poker_room_${VERSION}_${key}`,
    
    /**
     * App configuration key
     * @returns {string} Storage key
     */
    config: () => `${ENV}_poker_config_${VERSION}`,
    
    /**
     * Schema version tracking key
     * @returns {string} Storage key
     */
    schemaVersion: () => `${ENV}_schema_version`
  };
}

/**
 * Get legacy storage keys (for migration purposes)
 * @returns {Object} Legacy storage key generators
 */
export function getLegacyStorageKeys() {
  return {
    sessionV1: (issueId) => `poker_session_v1_${issueId}`,
    roomV2: (key) => `poker_v2_room_${key}`,
    config: () => 'poker_config'
  };
}

/**
 * Get current environment
 * @returns {string} Current environment (development, staging, production)
 */
export function getCurrentEnvironment() {
  return ENV;
}

/**
 * Get current schema version
 * @returns {string} Current schema version
 */
export function getCurrentVersion() {
  return VERSION;
}
