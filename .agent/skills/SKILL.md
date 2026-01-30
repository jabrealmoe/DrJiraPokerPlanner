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
