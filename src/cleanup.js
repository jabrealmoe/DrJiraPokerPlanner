import { storage } from '@forge/api';

/**
 * Scheduled function to clean up stale poker sessions
 * Runs every hour via cron schedule
 */
export async function handler() {
  const RETENTION_PERIOD = 24 * 60 * 60 * 1000; // 24 hours
  const cutoff = Date.now() - RETENTION_PERIOD;

  console.log('[SessionCleanup] Starting cleanup...');
  console.log(`[SessionCleanup] Cutoff time: ${new Date(cutoff).toISOString()}`);

  let cursor = storage
    .query()
    .where('key', k => k.startsWith('poker_v2_room_'));

  let deletedCount = 0;
  let scannedCount = 0;
  let hasMore = true;

  try {
    while (hasMore) {
      const results = await cursor.getMany();
      
      for (const result of results.results) {
        scannedCount++;
        const session = result.value;
        
        // Check if session has updatedAt field and is older than retention period
        if (session && session.updatedAt && session.updatedAt < cutoff) {
          console.log(`[SessionCleanup] Deleting stale session: ${result.key} (last updated: ${new Date(session.updatedAt).toISOString()})`);
          await storage.delete(result.key);
          deletedCount++;
        }
      }

      cursor = results.nextCursor;
      hasMore = !!cursor;
    }

    console.log(`[SessionCleanup] Cleanup complete. Scanned: ${scannedCount}, Deleted: ${deletedCount}`);
    
    return {
      success: true,
      scannedCount,
      deletedCount,
      cutoffTime: new Date(cutoff).toISOString()
    };
  } catch (error) {
    console.error('[SessionCleanup] Error during cleanup:', error);
    return {
      success: false,
      error: error.message,
      scannedCount,
      deletedCount
    };
  }
}
