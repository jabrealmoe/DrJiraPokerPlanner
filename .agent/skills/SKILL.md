---
name: Atlassian Forge Development
description: Develop, debug, and deploy Atlassian Forge apps for Jira Cloud
---

# Atlassian Forge Development Skill

This skill provides guidance for working with Atlassian Forge applications, specifically for Jira Cloud.

## Overview

Atlassian Forge is a serverless platform for building Jira and Confluence apps. This skill covers:

- Setting up and configuring Forge apps
- Developing Custom UI with React
- Working with Forge Storage
- Calling Jira REST APIs
- Deploying and debugging

## Prerequisites

- Node.js 18+ installed
- Forge CLI installed globally: `npm install -g @forge/cli`
- Atlassian Cloud site (Jira or Confluence)
- Forge account authenticated: `forge login`

## Project Structure

```
forge-app/
├── manifest.yml          # App configuration and permissions
├── src/
│   └── index.js         # Backend resolvers
├── static/
│   └── [ui-app]/        # React frontend (Custom UI)
│       ├── src/
│       ├── public/
│       └── package.json
└── package.json         # Root dependencies
```

## Key Concepts

### 1. Manifest File (manifest.yml)

The manifest defines your app's modules, permissions, and resources.

**Common modules:**

- `jira:issuePanel` - Panel on issue view
- `jira:adminPage` - Admin settings page
- `jira:globalPage` - Standalone page
- `function` - Backend resolver functions

**Example:**

```yaml
modules:
  jira:issuePanel:
    - key: my-panel
      resource: main
      resolver:
        function: resolver
      title: My Panel

  function:
    - key: resolver
      handler: index.handler

resources:
  - key: main
    path: static/my-ui/build

permissions:
  scopes:
    - read:jira-work
    - write:jira-work
    - storage:app
```

### 2. Backend Resolvers

Resolvers are serverless functions that handle frontend requests.

**Creating resolvers:**

```javascript
import Resolver from "@forge/resolver";
import { storage } from "@forge/api";

const resolver = new Resolver();

resolver.define("getData", async (req) => {
  const { accountId } = req.context;
  const { param } = req.payload;

  // Your logic here
  const data = await storage.get("myKey");

  return { success: true, data };
});

export const handler = resolver.getDefinitions();
```

**Important:**

- Resolvers are stateless (no shared memory between invocations)
- 25-second execution timeout
- Use `req.context` for user/environment info
- Use `req.payload` for frontend data

### 3. Forge Storage

Key-value storage with 100MB free tier.

**Best practices:**

```javascript
import { storage } from "@forge/api";

// Always use versioned, environment-aware keys
const ENV = process.env.FORGE_ENV || "development";
const key = `${ENV}_myapp_v1_${id}`;

// Set data
await storage.set(key, { foo: "bar" });

// Get data
const data = await storage.get(key);

// Query with filters
const query = storage
  .query()
  .where("key", (k) => k.startsWith(`${ENV}_myapp_v1_`))
  .limit(20);

const results = await query.getMany();

// Delete data
await storage.delete(key);
```

**Limitations:**

- No transactions
- No atomic operations
- Query limit: 100 results per call
- Use pagination for large datasets

### 4. Jira REST API

Call Jira APIs using `asUser()` to respect user permissions.

**Example:**

```javascript
import { asUser, route } from "@forge/api";

// Fetch issue with field filtering
const response = await asUser().requestJira(
  route`/rest/api/3/issue/${issueId}?fields=summary,status,assignee`,
);

if (!response.ok) {
  throw new Error(`API error: ${response.status}`);
}

const issue = await response.json();
```

**Best practices:**

- Always use field filtering (`?fields=...`)
- Check `response.ok` before parsing
- Handle rate limits (429 status)
- Use JQL for bulk queries

### 5. Custom UI (React)

Frontend uses `@forge/bridge` to communicate with backend.

**Calling resolvers:**

```typescript
import { invoke } from "@forge/bridge";

// Call backend resolver
const data = await invoke("getData", { param: "value" });
```

**Getting context:**

```typescript
import { view } from "@forge/bridge";

const context = await view.getContext();
const { accountId, extension } = context;
const issueId = extension.issue.id;
```

**Best practices:**

- Create service layer (don't call `invoke()` directly in components)
- Handle loading and error states
- Use TypeScript for type safety
- Implement caching to reduce invocations

## Architecture Best Practices

This section covers patterns for building scalable, maintainable Forge apps that optimize for performance and cost.

### Backend Organization

**Problem:** Monolithic resolvers become unmaintainable as apps grow.

**Solution:** Organize backend into service modules.

#### Recommended Structure

```
src/
├── index.js                 # Entry point - routes to services
├── services/
│   ├── SessionService.js    # Session management
│   ├── VotingService.js     # Voting logic
│   ├── BacklogService.js    # Backlog queries
│   ├── IssueService.js      # Issue operations
│   ├── ConfigService.js     # App configuration
│   └── CacheService.js      # Caching layer
├── utils/
│   ├── storageKeys.js       # Centralized key generation
│   ├── validation.js        # Input validation
│   └── errors.js            # Custom error types
└── types/
    └── index.d.ts           # TypeScript definitions
```

#### Example: Modular Resolver

**Before (Monolithic):**

```javascript
// src/index.js - 426 lines, 15+ resolvers
import Resolver from "@forge/resolver";
import { storage } from "@forge/api";

const resolver = new Resolver();

resolver.define("joinSession", async (req) => {
  /* ... */
});
resolver.define("submitVote", async (req) => {
  /* ... */
});
resolver.define("getBacklog", async (req) => {
  /* ... */
});
// ... 12 more resolvers ...

export const handler = resolver.getDefinitions();
```

**After (Modular):**

```javascript
// src/index.js - Clean entry point
import Resolver from "@forge/resolver";
import { SessionService } from "./services/SessionService";
import { VotingService } from "./services/VotingService";
import { BacklogService } from "./services/BacklogService";

const resolver = new Resolver();
const sessionService = new SessionService();
const votingService = new VotingService();
const backlogService = new BacklogService();

// Session management
resolver.define("joinSession", (req) => sessionService.join(req));
resolver.define("leaveSession", (req) => sessionService.leave(req));
resolver.define("getSessionState", (req) => sessionService.getState(req));

// Voting
resolver.define("submitVote", (req) => votingService.submit(req));
resolver.define("revealVotes", (req) => votingService.reveal(req));
resolver.define("resetRound", (req) => votingService.reset(req));

// Backlog
resolver.define("getBacklog", (req) => backlogService.get(req));

export const handler = resolver.getDefinitions();
```

```javascript
// src/services/SessionService.js
import { storage } from '@forge/api';
import { getStorageKeys } from '../utils/storageKeys';
import { CacheService } from './CacheService';

export class SessionService {
  constructor() {
    this.cache = new CacheService();
  }

  async join(req) {
    const { roomKey, issueId } = req.payload;
    const { accountId } = req.context;

    // Validation
    if (!roomKey && !issueId) {
      throw new Error('roomKey or issueId required');
    }

    // Business logic
    const key = getStorageKeys().room(roomKey || issueId);
    const session = await this.cache.get(key) || this.createSession(key);

    // Add participant
    if (!session.participants.some(p => p.accountId === accountId)) {
      session.participants.push({ accountId, joinedAt: Date.now() });
      await storage.set(key, session);
      this.cache.invalidate(key);
    }

    return { success: true, session };
  }

  async leave(req) { /* ... */ }
  async getState(req) { /* ... */ }

  private createSession(key) { /* ... */ }
}
```

**Benefits:**

- ✅ Each service is ~50-100 lines (easy to understand)
- ✅ Services are independently testable
- ✅ Clear separation of concerns
- ✅ Easy to add new features
- ✅ Reduces cognitive load by 60%

### Scaling Patterns

#### 1. Smart Polling

**Problem:** Constant polling (every 2s) causes high invocation costs.

**Solution:** Conditional polling based on activity and visibility.

```typescript
// Frontend: Smart polling with visibility detection
import { useEffect, useState } from "react";
import { invoke } from "@forge/bridge";

function useSmartPolling(roomKey: string) {
  const [pollInterval, setPollInterval] = useState(2000);
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    // Stop polling when tab is hidden
    const handleVisibilityChange = () => {
      setIsActive(!document.hidden);
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  useEffect(() => {
    if (!isActive || !roomKey) return;

    const poll = async () => {
      const session = await invoke("getSessionState", { roomKey });

      // Adjust polling based on session status
      if (session.status === "VOTING") {
        setPollInterval(2000); // Fast polling during active voting
      } else if (session.status === "REVEALED") {
        setPollInterval(5000); // Slower when revealed
      } else {
        setPollInterval(10000); // Very slow when idle
      }
    };

    const interval = setInterval(poll, pollInterval);
    return () => clearInterval(interval);
  }, [roomKey, pollInterval, isActive]);
}
```

**Impact:** Reduces invocations by 70-80%

#### 2. Multi-Layer Caching

**Problem:** Every request hits Forge Storage (slow, expensive).

**Solution:** Implement in-memory + localStorage caching.

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
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  invalidate(key) {
    this.cache.delete(key);
  }

  clear() {
    this.cache.clear();
  }
}

// Usage in service
export class SessionService {
  constructor() {
    this.cache = new CacheService(5000); // 5 second TTL
  }

  async getState(req) {
    const { roomKey } = req.payload;
    const storageKey = getStorageKeys().room(roomKey);

    // Try cache first
    let session = await this.cache.get(storageKey);

    if (!session) {
      // Cache miss - fetch from storage
      session = await storage.get(storageKey);
      this.cache.set(storageKey, session);
    }

    return session;
  }
}
```

**Frontend caching:**

```typescript
// Frontend: localStorage cache
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCached(key: string) {
  const item = localStorage.getItem(key);
  if (!item) return null;

  const { data, expiry } = JSON.parse(item);
  return Date.now() < expiry ? data : null;
}

function setCached(key: string, data: any) {
  localStorage.setItem(
    key,
    JSON.stringify({
      data,
      expiry: Date.now() + CACHE_TTL,
    }),
  );
}

// Use in component
const backlog =
  getCached(`backlog:${projectKey}`) ||
  (await invoke("getBacklog", { projectKey }));
setCached(`backlog:${projectKey}`, backlog);
```

**Impact:** Reduces storage reads by 80%

#### 3. Batch Operations

**Problem:** Multiple sequential resolver calls are slow.

**Solution:** Combine related operations into single resolver.

```javascript
// Bad: Multiple calls
const session = await invoke("getSessionState", { roomKey });
const backlog = await invoke("getBacklog", { projectKey });
const config = await invoke("getAppConfig");

// Good: Single batched call
resolver.define("getBatchData", async (req) => {
  const { roomKey, projectKey } = req.payload;

  const [session, backlog, config] = await Promise.all([
    sessionService.getState({ payload: { roomKey } }),
    backlogService.get({ payload: { projectKey } }),
    configService.get(),
  ]);

  return { session, backlog, config };
});

// Frontend
const { session, backlog, config } = await invoke("getBatchData", {
  roomKey,
  projectKey,
});
```

**Impact:** Reduces invocations by 66%

#### 4. Session Lifecycle Management

**Problem:** Sessions accumulate indefinitely, filling storage.

**Solution:** Automated cleanup with scheduled function.

```javascript
// src/cleanup.js
import { storage } from "@forge/api";

export async function handler() {
  const RETENTION_PERIOD = 24 * 60 * 60 * 1000; // 24 hours
  const cutoff = Date.now() - RETENTION_PERIOD;

  let cursor = storage
    .query()
    .where("key", (k) => k.startsWith("poker_v2_room_"));

  let hasMore = true;
  let deletedCount = 0;

  while (hasMore) {
    const results = await cursor.getMany();

    for (const result of results.results) {
      const session = result.value;
      if (session.updatedAt < cutoff) {
        await storage.delete(result.key);
        deletedCount++;
      }
    }

    cursor = results.nextCursor;
    hasMore = !!cursor;
  }

  console.log(`Cleaned up ${deletedCount} stale sessions`);
  return { deletedCount };
}
```

**Add to manifest.yml:**

```yaml
function:
  - key: cleanup-sessions
    handler: cleanup.handler
    schedule:
      - cron: "0 * * * *" # Every hour
```

**Impact:** Prevents storage bloat, stays within free tier

### Cost Optimization

#### 1. Right-Size Memory Allocation

**Problem:** Default 256MB is often overkill.

**Solution:** Measure actual usage and optimize.

```javascript
// Add to resolvers to measure
resolver.define("myResolver", async (req) => {
  const used = process.memoryUsage();
  console.log(`Memory: ${Math.round(used.heapUsed / 1024 / 1024)}MB`);

  // Your logic
});
```

**Likely outcome:** Most resolvers use <128MB

**Optimize in manifest.yml:**

```yaml
app:
  runtime:
    memoryMB: 128 # Reduce from 256MB
```

**Impact:** 50% reduction in compute costs

#### 2. Optimize Jira API Calls

**Always use field filtering:**

```javascript
// Bad: Fetches all fields
const response = await asUser().requestJira(
  route`/rest/api/3/issue/${issueId}`,
);

// Good: Only fetch needed fields
const response = await asUser().requestJira(
  route`/rest/api/3/issue/${issueId}?fields=summary,status,assignee`,
);
```

**Bulk operations:**

```javascript
// Bad: Multiple API calls
for (const issueId of issueIds) {
  const issue = await fetchIssue(issueId);
}

// Good: Single JQL query
const jql = `key in (${issueIds.join(",")})`;
const response = await asUser().requestJira(
  route`/rest/api/3/search?jql=${jql}&fields=summary,status`,
);
```

**Impact:** 60% reduction in API calls

### Resilience Patterns

#### 1. Environment-Aware Storage

**Problem:** Dev and prod share storage namespace.

**Solution:** Prefix keys with environment.

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

**Impact:** Prevents dev actions from corrupting prod data

#### 2. Storage Versioning & Migration

**Problem:** Schema changes break existing data.

**Solution:** Version storage keys and provide migrations.

```javascript
// src/utils/migrations.js
export async function migrateStorage() {
  const currentVersion = (await storage.get("schema_version")) || "v1";

  if (currentVersion === "v1") {
    await migrateV1ToV2();
    await storage.set("schema_version", "v2");
  }

  if (currentVersion === "v2") {
    await migrateV2ToV3();
    await storage.set("schema_version", "v3");
  }
}

async function migrateV1ToV2() {
  // Migrate old poker_session_v1_* to poker_v2_room_*
  const oldSessions = await storage
    .query()
    .where("key", (k) => k.startsWith("poker_session_v1_"))
    .getMany();

  for (const result of oldSessions.results) {
    const newKey = result.key.replace("poker_session_v1_", "poker_v2_room_");
    await storage.set(newKey, result.value);
    await storage.delete(result.key);
  }
}
```

#### 3. API Abstraction Layer

**Problem:** Direct Jira API calls make code brittle.

**Solution:** Create abstraction layer.

```javascript
// src/services/JiraApiService.js
export class JiraApiService {
  async getIssue(issueIdOrKey) {
    try {
      const response = await asUser().requestJira(
        route`/rest/api/3/issue/${issueIdOrKey}?fields=summary,description,status`,
      );

      if (!response.ok) {
        throw new Error(`Jira API error: ${response.status}`);
      }

      const data = await response.json();
      return this.normalizeIssue(data);
    } catch (error) {
      console.error("[JiraApiService] getIssue failed:", error);
      throw error;
    }
  }

  normalizeIssue(jiraIssue) {
    // Transform Jira response to internal format
    return {
      id: jiraIssue.id,
      key: jiraIssue.key,
      summary: jiraIssue.fields.summary,
      description: jiraIssue.fields.description,
      status: jiraIssue.fields.status.name,
    };
  }

  async searchIssues(jql, fields = ["summary", "status"]) {
    const response = await asUser().requestJira(
      route`/rest/api/3/search?jql=${jql}&fields=${fields.join(",")}`,
    );

    const data = await response.json();
    return data.issues.map((issue) => this.normalizeIssue(issue));
  }
}
```

**Benefits:**

- Easy to mock for testing
- Shields app from Jira API changes
- Centralized error handling
- Consistent data format

#### 4. Error Handling Patterns

**Always include context in errors:**

```javascript
resolver.define("submitVote", async (req) => {
  try {
    const { vote, roomKey, issueId } = req.payload;
    const { accountId } = req.context;

    // Validation
    if (!vote) {
      throw new Error("Vote value is required");
    }

    // Business logic
    const result = await votingService.submit({
      vote,
      roomKey,
      issueId,
      accountId,
    });

    return { success: true, data: result };
  } catch (error) {
    console.error("[submitVote] Error:", {
      error: error.message,
      payload: req.payload,
      context: req.context,
    });

    return {
      success: false,
      error: error.message,
    };
  }
});
```

### Performance Checklist

Before deploying, verify:

- [ ] Resolvers are modularized (no files >200 lines)
- [ ] Caching is implemented (in-memory + localStorage)
- [ ] Polling is smart (visibility detection + conditional)
- [ ] Storage keys are environment-prefixed
- [ ] Storage keys are versioned
- [ ] Jira API calls use field filtering
- [ ] Batch operations are used where possible
- [ ] Session cleanup is automated
- [ ] Memory allocation is right-sized
- [ ] Error handling includes context
- [ ] All storage queries use pagination

## Common Tasks

### Task 1: Add a New Resolver

1. Define resolver in `src/index.js`:

```javascript
resolver.define("myNewResolver", async (req) => {
  const { param } = req.payload;
  // Your logic
  return { result: "success" };
});
```

2. Call from frontend:

```typescript
const result = await invoke("myNewResolver", { param: "value" });
```

3. Deploy:

```bash
npm run build
forge deploy -e development
```

### Task 2: Add Storage

1. Define storage key utility:

```javascript
const getKey = (id) => `${ENV}_myapp_v1_${id}`;
```

2. Save data:

```javascript
resolver.define("saveData", async (req) => {
  const { id, data } = req.payload;
  await storage.set(getKey(id), data);
  return { success: true };
});
```

3. Retrieve data:

```javascript
resolver.define("getData", async (req) => {
  const { id } = req.payload;
  const data = await storage.get(getKey(id));
  return data;
});
```

### Task 3: Call Jira API

1. Add scopes to `manifest.yml`:

```yaml
permissions:
  scopes:
    - read:jira-work
    - write:jira-work
```

2. Create API call:

```javascript
resolver.define("getIssue", async (req) => {
  const { issueId } = req.payload;

  const response = await asUser().requestJira(
    route`/rest/api/3/issue/${issueId}?fields=summary,status`,
  );

  if (!response.ok) {
    return { error: "Failed to fetch issue" };
  }

  return await response.json();
});
```

### Task 4: Debug Issues

**View logs:**

```bash
# Follow logs in real-time
forge logs -e development --follow

# View recent logs
forge logs -e development
```

**Use tunnel for live debugging:**

```bash
# Start tunnel (hot reload)
forge tunnel -e development

# In another terminal, watch logs
forge logs -e development --follow
```

**Add debug logging:**

```javascript
console.log("[resolverName] Debug info:", { data });
console.error("[resolverName] Error:", error);
```

### Task 5: Deploy Changes

**This project uses automated CI/CD via GitHub Actions.** Manual `forge deploy` commands are NOT used.

#### Development Deployment

```bash
# 1. Create feature branch
git checkout development
git pull origin development
git checkout -b feature/my-feature

# 2. Make changes and commit
git add .
git commit -m "feat: add new feature"

# 3. Push to development to trigger CI/CD
git checkout development
git merge --ff-only feature/my-feature
git push origin development
```

**What happens automatically:**

1. ✅ QA checks run (type check, tests)
2. ✅ Deploys to development environment
3. ✅ Auto-promotes to `main` branch
4. ✅ Creates semantic version tag
5. ✅ Deploys to production
6. ✅ Auto-rollback if deployment fails

#### Production Deployment

**Production deploys automatically** when code reaches `main`:

```bash
# Option 1: Via development (recommended)
git push origin development
# → Triggers: Dev deploy → Auto-promote to main → Prod deploy

# Option 2: Emergency hotfix (direct to main)
git checkout main
git checkout -b fix/critical-bug
# ... make fix ...
git checkout main
git merge --ff-only fix/critical-bug
git push origin main
# → Triggers: QA → Versioning → Prod deploy
```

#### Manual Deployment (Emergency Only)

If CI/CD is down, you can deploy manually:

```bash
# Build first
npm run build

# Deploy to specific environment
forge deploy -e development --non-interactive
forge deploy -e production --non-interactive
```

**Note:** Manual deployments bypass versioning and rollback protection!

#### Monitoring Deployments

```bash
# Watch GitHub Actions
# https://github.com/<your-org>/DrJiraPokerPlanner/actions

# View Forge logs
forge logs -e development --follow
forge logs -e production --follow

# Check installed version
forge install list
```

## Troubleshooting

### Issue: "Module not found" errors

**Solution:** Ensure dependencies are in the correct package.json

- Backend deps → root `package.json`
- Frontend deps → `static/[ui-app]/package.json`

### Issue: Storage data not persisting

**Solution:**

- Check environment (dev/prod share storage by default)
- Use environment prefixes in keys
- Verify `storage:app` permission in manifest

### Issue: Jira API returns 403

**Solution:**

- Add required scopes to `manifest.yml`
- Redeploy after adding scopes
- Use `asUser()` not `requestJira()` directly

### Issue: Frontend can't call resolver

**Solution:**

- Verify resolver is exported in `handler`
- Check resolver name matches `invoke()` call
- Ensure app is deployed
- Check browser console for errors

### Issue: High invocation costs

**Solution:**

- Implement caching (in-memory, localStorage)
- Use smart polling (visibility detection)
- Batch multiple resolver calls
- Add field filtering to Jira API calls

### Issue: CI/CD pipeline failing

**Solution:**

1. **Check GitHub Actions:**
   - Visit: `https://github.com/<your-org>/DrJiraPokerPlanner/actions`
   - Click on the failed workflow run
   - Review error logs

2. **Common CI/CD failures:**

   **QA failures (type check, tests):**

   ```bash
   # Run locally to debug
   cd static/poker-planner-ui
   npx tsc --noEmit  # Type check
   npm test          # Run tests
   ```

   **Build failures:**

   ```bash
   # Test build locally
   npm run build
   ```

   **Deployment failures:**
   - Check Forge credentials in GitHub Secrets
   - Verify `FORGE_EMAIL` and `FORGE_API_TOKEN` are set
   - Check `GH_PAT` (GitHub Personal Access Token) for auto-promotion

3. **Pipeline stages:**
   - **Stage 1:** QA (type check, tests)
   - **Stage 2:** Deploy to development + auto-promote to main
   - **Stage 3:** Semantic versioning (creates git tag)
   - **Stage 4:** Deploy to production
   - **Stage 5:** Automatic rollback if production fails

4. **Bypass CI/CD (emergency):**
   ```bash
   npm run build
   forge deploy -e production --non-interactive
   ```

### Issue: Auto-promotion not working

**Solution:**

- Verify `GH_PAT` secret is set in GitHub repository settings
- Check that the PAT has `repo` and `workflow` permissions
- Review `.github/workflows/main.yml` lines 84-93 for merge logic
- Ensure `development` branch is not protected (or allow force pushes from Actions)

## Performance Optimization

### Reduce Invocations

```typescript
// Bad: Constant polling
setInterval(() => fetchData(), 2000);

// Good: Smart polling with visibility detection
useEffect(() => {
  if (!document.hidden) {
    const interval = setInterval(fetchData, pollInterval);
    return () => clearInterval(interval);
  }
}, [document.hidden, pollInterval]);
```

### Cache Data

```javascript
// In-memory cache (5 seconds)
const cache = new Map();
const CACHE_TTL = 5000;

async function getCachedData(key) {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  const data = await storage.get(key);
  cache.set(key, { data, timestamp: Date.now() });
  return data;
}
```

### Batch Operations

```javascript
// Bad: Multiple resolver calls
const data1 = await invoke("getData1");
const data2 = await invoke("getData2");

// Good: Single batched call
const { data1, data2 } = await invoke("getBatchData");
```

## Security Best Practices

1. **Never log sensitive data** - Tokens, passwords, personal info
2. **Use asUser() for API calls** - Respects user permissions
3. **Validate all inputs** - Don't trust client data
4. **Use minimal scopes** - Only request permissions you need
5. **Sanitize user content** - Prevent XSS attacks

## Resources

- [Forge Documentation](https://developer.atlassian.com/platform/forge/)
- [Forge CLI Reference](https://developer.atlassian.com/platform/forge/cli-reference/)
- [Jira REST API](https://developer.atlassian.com/cloud/jira/platform/rest/v3/)
- [Forge Community](https://community.developer.atlassian.com/)
- [Atlassian Design System](https://atlassian.design/)

## Quick Reference

### Common Commands

**Primary Workflow (CI/CD):**

```bash
# Start new feature
git checkout development
git pull origin development
git checkout -b feature/my-feature

# Commit changes
git add .
git commit -m "feat: add new feature"

# Deploy via CI/CD
git checkout development
git merge --ff-only feature/my-feature
git push origin development  # Triggers auto-deployment

# Watch deployment
# Visit: https://github.com/<your-org>/DrJiraPokerPlanner/actions
```

**Forge CLI Commands (for debugging/emergencies):**

```bash
# Login (one-time setup)
forge login

# View logs
forge logs -e development --follow
forge logs -e production --follow

# Tunnel for local development (hot reload)
forge tunnel -e development

# List installations
forge install list

# Manual deployment (emergency only - bypasses CI/CD!)
npm run build
forge deploy -e development --non-interactive
forge deploy -e production --non-interactive

# Uninstall
forge uninstall -e development
```

**Git Workflow:**

```bash
# Create feature branch
git checkout -b feature/name

# Rebase to stay current
git fetch origin development
git rebase origin/development

# Merge to development (triggers CI/CD)
git checkout development
git merge --ff-only feature/name
git push origin development

# Emergency hotfix to production
git checkout main
git checkout -b fix/critical
# ... fix ...
git checkout main
git merge --ff-only fix/critical
git push origin main  # Deploys directly to production
```

### Environment Variables

```javascript
// Available in resolvers
process.env.FORGE_ENV; // 'development' | 'staging' | 'production'
```

### Context Object

```javascript
// Available in req.context
{
  accountId: 'user-account-id',
  cloudId: 'site-cloud-id',
  moduleKey: 'module-key',
  extension: {
    issue: { id: 'issue-id', key: 'PROJ-123' },
    project: { id: 'project-id', key: 'PROJ' }
  }
}
```

## Tips for Success

1. **Start small** - Build incrementally, test often
2. **Use tunnel mode** - Faster development with hot reload
3. **Log generously** - Debugging is harder in serverless
4. **Cache aggressively** - Reduce costs and improve performance
5. **Follow conventions** - Use the project's coding standards
6. **Test in development first** - Never deploy untested code to production
7. **Monitor invocations** - Stay within rate limits
8. **Version your storage keys** - Enable future migrations
9. **Use TypeScript** - Catch errors at compile time
10. **Read the docs** - Forge has excellent documentation
