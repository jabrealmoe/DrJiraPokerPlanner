# DrJiraPokerPlanner Refactoring Plan

## Objective

Refactor the DrJiraPokerPlanner app to reduce developer entropy, improve scalability, and optimize for performance and cost.

## Current State Analysis

### Issues Identified

1. **Developer Entropy (7/10):**
   - Monolithic `src/index.js` (426 lines, 15+ resolvers)
   - No backend type safety
   - Duplicated storage key logic
   - Inconsistent naming (`issueId`, `roomKey`, `actualKey`)

2. **Scaling Limitations:**
   - Constant polling (every 2s) → 900 requests/min for 30 users
   - Breaking point: ~20 concurrent users on free tier
   - No caching layer
   - Inefficient `clearAllSessions` (only deletes 20 items)

3. **Fragile Abstractions:**
   - No environment prefixing on storage keys
   - Hardcoded version strings
   - Direct Jira API coupling
   - No storage migration strategy

4. **Cost Inefficiencies:**
   - High invocation costs from polling
   - 256MB memory allocation (likely overkill)
   - Uncached Jira API calls
   - No session cleanup

## Refactoring Strategy

### Phase 1: Quick Wins (Week 1) - Cost Reduction

**Goal:** Reduce costs by 60% with minimal code changes

#### 1.1 Implement Smart Polling (Priority: P0)

- **Effort:** 4 hours
- **Impact:** 70-80% invocation reduction
- **Files:** `static/poker-planner-ui/src/App.tsx`

**Tasks:**

- [ ] Add visibility detection (`document.hidden`)
- [ ] Implement conditional polling based on session status
- [ ] Add exponential backoff for idle sessions

**Code:**

```typescript
// Add to App.tsx
useEffect(() => {
  const handleVisibilityChange = () => {
    if (document.hidden) {
      clearInterval(pollIntervalRef.current);
    } else {
      startPolling();
    }
  };

  document.addEventListener("visibilitychange", handleVisibilityChange);
  return () =>
    document.removeEventListener("visibilitychange", handleVisibilityChange);
}, []);
```

#### 1.2 Add Session Cleanup (Priority: P0)

- **Effort:** 3 hours
- **Impact:** Prevents storage bloat
- **Files:** `src/cleanup.js`, `manifest.yml`

**Tasks:**

- [ ] Create `src/cleanup.js` with scheduled function
- [ ] Add cron schedule to `manifest.yml`
- [ ] Test cleanup logic locally

**Code:**

```javascript
// src/cleanup.js
import { storage } from "@forge/api";

export async function handler() {
  const RETENTION_PERIOD = 24 * 60 * 60 * 1000;
  const cutoff = Date.now() - RETENTION_PERIOD;

  let cursor = storage
    .query()
    .where("key", (k) => k.startsWith("poker_v2_room_"));
  let deletedCount = 0;

  while (cursor) {
    const results = await cursor.getMany();

    for (const result of results.results) {
      if (result.value.updatedAt < cutoff) {
        await storage.delete(result.key);
        deletedCount++;
      }
    }

    cursor = results.nextCursor;
  }

  console.log(`Cleaned up ${deletedCount} stale sessions`);
  return { deletedCount };
}
```

```yaml
# Add to manifest.yml
function:
  - key: cleanup-sessions
    handler: cleanup.handler
    schedule:
      - cron: "0 * * * *" # Every hour
```

#### 1.3 Right-Size Memory (Priority: P1)

- **Effort:** 1 hour
- **Impact:** 50% compute cost reduction
- **Files:** `manifest.yml`, `src/index.js`

**Tasks:**

- [ ] Add memory logging to resolvers
- [ ] Deploy and monitor memory usage
- [ ] Adjust `memoryMB` in manifest

**Code:**

```javascript
// Add to each resolver temporarily
const used = process.memoryUsage();
console.log(
  `[${resolverName}] Memory: ${Math.round(used.heapUsed / 1024 / 1024)}MB`,
);
```

```yaml
# Update manifest.yml after measuring
app:
  runtime:
    memoryMB: 128 # Reduce from 256MB
```

### Phase 2: Backend Modularization (Week 2) - Developer Entropy

**Goal:** Reduce cognitive load by 60%, improve maintainability

#### 2.1 Create Utility Modules (Priority: P1)

- **Effort:** 4 hours
- **Impact:** Centralized logic, easier to maintain

**Tasks:**

- [ ] Create `src/utils/storageKeys.js`
- [ ] Create `src/utils/validation.js`
- [ ] Create `src/utils/errors.js`

**Files to create:**

```javascript
// src/utils/storageKeys.js
const ENV = process.env.FORGE_ENV || "development";
const VERSION = "v3";

export function getStorageKeys() {
  return {
    session: (id) => `${ENV}_poker_session_${VERSION}_${id}`,
    room: (id) => `${ENV}_poker_room_${VERSION}_${id}`,
    config: () => `${ENV}_poker_config_${VERSION}`,
  };
}
```

```javascript
// src/utils/validation.js
export function validateVote(vote) {
  if (!vote) {
    throw new Error("Vote value is required");
  }
  return true;
}

export function validateRoomKey(roomKey, issueId) {
  if (!roomKey && !issueId) {
    throw new Error("roomKey or issueId required");
  }
  return true;
}
```

```javascript
// src/utils/errors.js
export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ValidationError";
  }
}

export class JiraApiError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.name = "JiraApiError";
    this.statusCode = statusCode;
  }
}
```

#### 2.2 Create Service Modules (Priority: P1)

- **Effort:** 2 days
- **Impact:** Clear separation of concerns

**Tasks:**

- [ ] Create `src/services/CacheService.js`
- [ ] Create `src/services/SessionService.js`
- [ ] Create `src/services/VotingService.js`
- [ ] Create `src/services/BacklogService.js`
- [ ] Create `src/services/IssueService.js`
- [ ] Create `src/services/ConfigService.js`
- [ ] Create `src/services/JiraApiService.js`

**Service Structure:**

```javascript
// src/services/CacheService.js
export class CacheService {
  constructor(ttl = 5000) {
    this.cache = new Map();
    this.ttl = ttl;
  }

  async get(key) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.ttl) {
      return cached.data;
    }
    return null;
  }

  set(key, data) {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  invalidate(key) {
    this.cache.delete(key);
  }

  clear() {
    this.cache.clear();
  }
}
```

```javascript
// src/services/SessionService.js
import { storage } from "@forge/api";
import { getStorageKeys } from "../utils/storageKeys";
import { CacheService } from "./CacheService";
import { validateRoomKey } from "../utils/validation";

export class SessionService {
  constructor() {
    this.cache = new CacheService(5000);
  }

  async join(req) {
    const { roomKey, issueId } = req.payload;
    const { accountId } = req.context;

    validateRoomKey(roomKey, issueId);

    const key = getStorageKeys().room(roomKey || issueId);
    let session = await this.cache.get(key);

    if (!session) {
      session =
        (await storage.get(key)) || this.createSession(roomKey || issueId);
    }

    if (!session.participants.some((p) => p.accountId === accountId)) {
      session.participants.push({ accountId, joinedAt: Date.now() });
      session.updatedAt = Date.now();
      await storage.set(key, session);
      this.cache.invalidate(key);
    }

    return { success: true, session };
  }

  async leave(req) {
    const { roomKey, issueId } = req.payload;
    const { accountId } = req.context;

    const key = getStorageKeys().room(roomKey || issueId);
    const session = await storage.get(key);

    if (session) {
      session.participants = session.participants.filter(
        (p) => p.accountId !== accountId,
      );
      session.updatedAt = Date.now();
      await storage.set(key, session);
      this.cache.invalidate(key);
    }

    return { success: true };
  }

  async getState(req) {
    const { roomKey, issueId } = req.payload;
    const key = getStorageKeys().room(roomKey || issueId);

    let session = await this.cache.get(key);

    if (!session) {
      session = await storage.get(key);
      if (session) {
        this.cache.set(key, session);
      }
    }

    return session;
  }

  createSession(id) {
    return {
      roomKey: id,
      participants: [],
      votes: {},
      status: "WAITING",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }
}
```

```javascript
// src/services/VotingService.js
import { storage } from "@forge/api";
import { getStorageKeys } from "../utils/storageKeys";
import { CacheService } from "./CacheService";
import { validateVote } from "../utils/validation";

export class VotingService {
  constructor() {
    this.cache = new CacheService(5000);
  }

  async submit(req) {
    const { vote, roomKey, issueId } = req.payload;
    const { accountId } = req.context;

    validateVote(vote);

    const key = getStorageKeys().room(roomKey || issueId);
    const session = await storage.get(key);

    if (!session) {
      throw new Error("Session not found");
    }

    session.votes[accountId] = vote;
    session.updatedAt = Date.now();
    await storage.set(key, session);
    this.cache.invalidate(key);

    return { success: true, session };
  }

  async reveal(req) {
    const { roomKey, issueId } = req.payload;
    const key = getStorageKeys().room(roomKey || issueId);
    const session = await storage.get(key);

    if (!session) {
      throw new Error("Session not found");
    }

    session.status = "REVEALED";
    session.updatedAt = Date.now();
    await storage.set(key, session);
    this.cache.invalidate(key);

    return { success: true, session };
  }

  async reset(req) {
    const { roomKey, issueId } = req.payload;
    const key = getStorageKeys().room(roomKey || issueId);
    const session = await storage.get(key);

    if (!session) {
      throw new Error("Session not found");
    }

    session.votes = {};
    session.status = "VOTING";
    session.updatedAt = Date.now();
    await storage.set(key, session);
    this.cache.invalidate(key);

    return { success: true, session };
  }
}
```

#### 2.3 Refactor Main Resolver (Priority: P1)

- **Effort:** 4 hours
- **Impact:** Clean, maintainable entry point

**Tasks:**

- [ ] Update `src/index.js` to use services
- [ ] Remove duplicated logic
- [ ] Add error handling

**Code:**

```javascript
// src/index.js - Refactored
import Resolver from "@forge/resolver";
import { SessionService } from "./services/SessionService";
import { VotingService } from "./services/VotingService";
import { BacklogService } from "./services/BacklogService";
import { IssueService } from "./services/IssueService";
import { ConfigService } from "./services/ConfigService";

const resolver = new Resolver();

// Initialize services
const sessionService = new SessionService();
const votingService = new VotingService();
const backlogService = new BacklogService();
const issueService = new IssueService();
const configService = new ConfigService();

// Session management
resolver.define("joinSession", async (req) => {
  try {
    return await sessionService.join(req);
  } catch (error) {
    console.error("[joinSession] Error:", error);
    return { success: false, error: error.message };
  }
});

resolver.define("leaveSession", async (req) => {
  try {
    return await sessionService.leave(req);
  } catch (error) {
    console.error("[leaveSession] Error:", error);
    return { success: false, error: error.message };
  }
});

resolver.define("getSessionState", async (req) => {
  try {
    return await sessionService.getState(req);
  } catch (error) {
    console.error("[getSessionState] Error:", error);
    return null;
  }
});

// Voting
resolver.define("submitVote", async (req) => {
  try {
    return await votingService.submit(req);
  } catch (error) {
    console.error("[submitVote] Error:", error);
    return { success: false, error: error.message };
  }
});

resolver.define("revealVotes", async (req) => {
  try {
    return await votingService.reveal(req);
  } catch (error) {
    console.error("[revealVotes] Error:", error);
    return { success: false, error: error.message };
  }
});

resolver.define("resetRound", async (req) => {
  try {
    return await votingService.reset(req);
  } catch (error) {
    console.error("[resetRound] Error:", error);
    return { success: false, error: error.message };
  }
});

// Backlog
resolver.define("getBacklog", async (req) => {
  try {
    return await backlogService.get(req);
  } catch (error) {
    console.error("[getBacklog] Error:", error);
    return { issues: [], error: error.message };
  }
});

// Issues
resolver.define("updateIssue", async (req) => {
  try {
    return await issueService.update(req);
  } catch (error) {
    console.error("[updateIssue] Error:", error);
    return { success: false, error: error.message };
  }
});

resolver.define("fetchIssueDetails", async (req) => {
  try {
    return await issueService.fetchDetails(req);
  } catch (error) {
    console.error("[fetchIssueDetails] Error:", error);
    return null;
  }
});

// Config
resolver.define("getAppConfig", async (req) => {
  try {
    return await configService.get(req);
  } catch (error) {
    console.error("[getAppConfig] Error:", error);
    return {};
  }
});

resolver.define("saveAppConfig", async (req) => {
  try {
    return await configService.save(req);
  } catch (error) {
    console.error("[saveAppConfig] Error:", error);
    return { success: false, error: error.message };
  }
});

// Logging (keep for debugging)
resolver.define("logMessage", async (req) => {
  const { message, data } = req.payload;
  console.log(`[Client Log] ${message}`, data);
  return { logged: true };
});

export const handler = resolver.getDefinitions();
```

### Phase 3: Frontend Optimization (Week 3) - Performance

**Goal:** Reduce frontend invocations, improve UX

#### 3.1 Create Frontend Service Layer (Priority: P1)

- **Effort:** 1 day
- **Impact:** Centralized API calls, easier caching

**Tasks:**

- [ ] Create `static/poker-planner-ui/src/services/api.ts`
- [ ] Create `static/poker-planner-ui/src/services/cache.ts`
- [ ] Update components to use service layer

**Code:**

```typescript
// static/poker-planner-ui/src/services/cache.ts
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export class CacheService {
  get(key: string): any | null {
    const item = localStorage.getItem(key);
    if (!item) return null;

    const { data, expiry } = JSON.parse(item);
    return Date.now() < expiry ? data : null;
  }

  set(key: string, data: any, ttl: number = CACHE_TTL): void {
    localStorage.setItem(
      key,
      JSON.stringify({
        data,
        expiry: Date.now() + ttl,
      }),
    );
  }

  invalidate(key: string): void {
    localStorage.removeItem(key);
  }

  clear(): void {
    localStorage.clear();
  }
}

export const cache = new CacheService();
```

```typescript
// static/poker-planner-ui/src/services/api.ts
import { invoke } from "@forge/bridge";
import { cache } from "./cache";

export class ApiService {
  async getSessionState(roomKey: string, useCache = true) {
    const cacheKey = `session:${roomKey}`;

    if (useCache) {
      const cached = cache.get(cacheKey);
      if (cached) return cached;
    }

    const session = await invoke("getSessionState", { roomKey });
    cache.set(cacheKey, session, 2000); // 2 second cache
    return session;
  }

  async joinSession(roomKey: string, issueId?: string) {
    const result = await invoke("joinSession", { roomKey, issueId });
    cache.invalidate(`session:${roomKey}`);
    return result;
  }

  async submitVote(vote: string, roomKey: string, issueId: string) {
    const result = await invoke("submitVote", { vote, roomKey, issueId });
    cache.invalidate(`session:${roomKey}`);
    return result;
  }

  async getBacklog(projectKey: string, useCache = true) {
    const cacheKey = `backlog:${projectKey}`;

    if (useCache) {
      const cached = cache.get(cacheKey);
      if (cached) return cached;
    }

    const backlog = await invoke("getBacklog", { projectKey });
    cache.set(cacheKey, backlog, 5 * 60 * 1000); // 5 minute cache
    return backlog;
  }
}

export const api = new ApiService();
```

#### 3.2 Implement Smart Polling Hook (Priority: P1)

- **Effort:** 4 hours
- **Impact:** 70% invocation reduction

**Tasks:**

- [ ] Create `static/poker-planner-ui/src/hooks/useSmartPolling.ts`
- [ ] Update `App.tsx` to use hook

**Code:**

```typescript
// static/poker-planner-ui/src/hooks/useSmartPolling.ts
import { useEffect, useState, useRef } from "react";
import { api } from "../services/api";

export function useSmartPolling(roomKey: string | null) {
  const [session, setSession] = useState<any>(null);
  const [pollInterval, setPollInterval] = useState(2000);
  const intervalRef = useRef<number | null>(null);
  const [isActive, setIsActive] = useState(!document.hidden);

  // Handle visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsActive(!document.hidden);
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  // Polling logic
  useEffect(() => {
    if (!isActive || !roomKey) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    const poll = async () => {
      try {
        const data = await api.getSessionState(roomKey, false);
        setSession(data);

        // Adjust polling based on session status
        if (data?.status === "VOTING") {
          setPollInterval(2000); // Fast during voting
        } else if (data?.status === "REVEALED") {
          setPollInterval(5000); // Slower when revealed
        } else {
          setPollInterval(10000); // Very slow when idle
        }
      } catch (error) {
        console.error("Polling error:", error);
      }
    };

    // Initial poll
    poll();

    // Set up interval
    intervalRef.current = window.setInterval(poll, pollInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [roomKey, pollInterval, isActive]);

  return { session, refresh: () => api.getSessionState(roomKey!, false) };
}
```

### Phase 4: Testing & Deployment (Week 4)

#### 4.1 Add Unit Tests (Priority: P2)

- **Effort:** 2 days
- **Impact:** Confidence in refactoring

**Tasks:**

- [ ] Add tests for `CacheService`
- [ ] Add tests for `SessionService`
- [ ] Add tests for `VotingService`
- [ ] Add tests for utility functions

#### 4.2 Deploy and Monitor (Priority: P0)

- **Effort:** 1 day
- **Impact:** Validate improvements

**Tasks:**

- [ ] Deploy to development
- [ ] Monitor invocation counts
- [ ] Monitor memory usage
- [ ] Monitor error rates
- [ ] Deploy to production

## Success Metrics

### Before Refactoring

- Invocations: ~900/min for 30 users
- Memory usage: 256MB
- Backend file size: 426 lines
- Storage cleanup: Manual
- Cache hit rate: 0%

### After Refactoring (Target)

- Invocations: ~200/min for 30 users (78% reduction)
- Memory usage: 128MB (50% reduction)
- Backend file size: <100 lines per service
- Storage cleanup: Automated (hourly)
- Cache hit rate: 80%

### Cost Savings

- Invocation costs: $5-10/month savings
- Compute costs: $2-3/month savings
- Storage costs: Stay within free tier
- **Total: $7-13/month savings**

## Implementation Order

1. **Day 1-2:** Phase 1 (Quick Wins)
   - Smart polling
   - Session cleanup
   - Memory right-sizing

2. **Day 3-7:** Phase 2 (Backend Modularization)
   - Create utilities
   - Create services
   - Refactor main resolver

3. **Day 8-12:** Phase 3 (Frontend Optimization)
   - Create service layer
   - Implement smart polling hook
   - Update components

4. **Day 13-15:** Phase 4 (Testing & Deployment)
   - Add unit tests
   - Deploy and monitor
   - Validate metrics

## Rollback Plan

If issues arise:

1. Revert to previous git tag
2. Use CI/CD automatic rollback
3. Deploy manually: `forge deploy -e production --non-interactive`

## Next Steps

1. Review this plan
2. Commit plan to repository
3. Create feature branch: `git checkout -b refactor/architecture-improvements`
4. Start with Phase 1 (Quick Wins)
5. Deploy incrementally, monitor metrics
