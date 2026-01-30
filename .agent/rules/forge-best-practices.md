# Atlassian Forge Best Practices

## Forge-Specific Constraints

### Runtime Limitations

1. **Execution Timeout: 25 seconds**
   - Keep resolver functions fast
   - Use async/await properly
   - Implement pagination for large datasets

2. **Memory Limits**
   - Current allocation: 256MB (consider reducing to 128MB)
   - Monitor memory usage in production
   - Clean up large objects after use

3. **Invocation Limits**
   - Free tier: 200 invocations/minute
   - Standard: 1,000 invocations/minute
   - Implement caching to stay within limits

### Storage Best Practices

#### Key Design

```javascript
// ✅ GOOD: Versioned, environment-aware, descriptive
const key = `${ENV}_poker_session_v3_${roomKey}`;

// ❌ BAD: No version, no environment, generic
const key = `session_${id}`;
```

#### Query Efficiently

```javascript
// ✅ GOOD: Specific query with limit
const query = storage
  .query()
  .where("key", (k) => k.startsWith("dev_poker_session_v3_"))
  .where("value.updatedAt", ">", cutoffTime)
  .limit(20);

// ❌ BAD: No filtering, unbounded
const query = storage.query();
```

#### Implement Cleanup

```javascript
// Add scheduled cleanup function
export async function cleanupStaleSessions() {
  const ONE_DAY = 24 * 60 * 60 * 1000;
  const cutoff = Date.now() - ONE_DAY;

  const query = storage
    .query()
    .where("key", (k) => k.startsWith(`${ENV}_poker_session_`))
    .where("value.updatedAt", "<", cutoff)
    .limit(50);

  const results = await query.getMany();

  for (const result of results.results) {
    await storage.delete(result.key);
  }
}
```

### Jira API Best Practices

#### Use Field Filtering

```javascript
// ✅ GOOD: Only fetch needed fields
const response = await asUser().requestJira(
  route`/rest/api/3/issue/${issueId}?fields=summary,status,assignee`,
);

// ❌ BAD: Fetches all fields (slow, expensive)
const response = await asUser().requestJira(
  route`/rest/api/3/issue/${issueId}`,
);
```

#### Batch Requests

```javascript
// ✅ GOOD: Fetch multiple issues in one call
const jql = `key in (${issueKeys.join(",")})`;
const response = await asUser().requestJira(route`/rest/api/3/search/jql`, {
  method: "POST",
  body: JSON.stringify({ jql, fields: ["summary", "status"] }),
});

// ❌ BAD: N+1 queries
for (const key of issueKeys) {
  await asUser().requestJira(route`/rest/api/3/issue/${key}`);
}
```

#### Handle Rate Limits

```javascript
async function fetchWithRetry(url, options, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    const response = await asUser().requestJira(url, options);

    if (response.status === 429) {
      // Rate limited - wait and retry
      const retryAfter = response.headers.get("Retry-After") || 5;
      await sleep(retryAfter * 1000);
      continue;
    }

    return response;
  }

  throw new Error("Max retries exceeded");
}
```

## Custom UI Best Practices

### Bridge Communication

```typescript
// ✅ GOOD: Centralized service with error handling
// services/forgeService.ts
import { invoke } from "@forge/bridge";

export async function getSessionState(roomKey: string): Promise<Session> {
  try {
    const session = await invoke("getSessionState", { roomKey });
    if (!session) {
      throw new Error("Session not found");
    }
    return session;
  } catch (error) {
    console.error("Failed to fetch session:", error);
    throw new Error("Unable to load session");
  }
}

// ❌ BAD: Direct invoke calls in components
const session = await invoke("getSessionState", { roomKey });
```

### Context API Usage

```typescript
// ✅ GOOD: Get context once, pass down
import { view } from "@forge/bridge";

const context = await view.getContext();
const { accountId, extension } = context;

// ❌ BAD: Calling getContext repeatedly
const context1 = await view.getContext();
// ... later ...
const context2 = await view.getContext();
```

### Polling Strategy

```typescript
// ✅ GOOD: Smart polling with backoff
const useSmartPolling = (roomKey: string) => {
  const [session, setSession] = useState<Session | null>(null);
  const [pollInterval, setPollInterval] = useState(2000);

  useEffect(() => {
    if (!document.hidden) {
      const interval = setInterval(async () => {
        const newSession = await getSessionState(roomKey);

        // If nothing changed, slow down polling
        if (JSON.stringify(newSession) === JSON.stringify(session)) {
          setPollInterval((prev) => Math.min(prev * 1.2, 10000));
        } else {
          setPollInterval(2000); // Reset on change
        }

        setSession(newSession);
      }, pollInterval);

      return () => clearInterval(interval);
    }
  }, [roomKey, pollInterval]);

  return session;
};

// ❌ BAD: Constant polling regardless of activity
setInterval(() => fetchSession(), 2000);
```

## Deployment Best Practices

### Environment Strategy

1. **Development** - For active development and testing
2. **Staging** - For pre-production validation (optional)
3. **Production** - For end users

### Manifest Configuration

```yaml
# ✅ GOOD: Specific permissions
permissions:
  scopes:
    - read:jira-work
    - write:jira-work
    - storage:app

# ❌ BAD: Overly broad permissions
permissions:
  scopes:
    - read:jira-work
    - write:jira-work
    - admin
```

### Version Management

- Use semantic versioning: `MAJOR.MINOR.PATCH`
- Increment PATCH for bug fixes
- Increment MINOR for new features
- Increment MAJOR for breaking changes

### Pre-Deployment Checklist

```bash
# 1. Run all tests
npm test

# 2. Type check
cd static/poker-planner-ui && npx tsc --noEmit

# 3. Lint
npm run lint

# 4. Build
npm run build

# 5. Test in tunnel mode
forge tunnel -e development

# 6. Deploy to development first
forge deploy -e development

# 7. Verify in development
# ... manual testing ...

# 8. Deploy to production
git push origin main  # Triggers CI/CD
```

## Performance Optimization

### Caching Strategy

```javascript
// Three-tier caching
const cache = {
  // Tier 1: In-memory (5 seconds)
  memory: new Map(),

  // Tier 2: Browser localStorage (5 minutes)
  local: {
    get: (key) => {
      const item = localStorage.getItem(key);
      if (!item) return null;
      const { data, expiry } = JSON.parse(item);
      return Date.now() < expiry ? data : null;
    },
    set: (key, data, ttl = 300000) => {
      localStorage.setItem(
        key,
        JSON.stringify({
          data,
          expiry: Date.now() + ttl,
        }),
      );
    },
  },

  // Tier 3: Forge Storage (source of truth)
  async forge(key) {
    return await storage.get(key);
  },
};
```

### Lazy Loading

```typescript
// ✅ GOOD: Lazy load heavy components
const DonkeyKongJr = React.lazy(() => import('./components/DonkeyKongJr'));

// Use with Suspense
<Suspense fallback={<Spinner />}>
  <DonkeyKongJr />
</Suspense>
```

## Debugging Tips

### Logging Best Practices

```javascript
// ✅ GOOD: Structured logging with context
console.log("[SessionService.joinSession]", {
  accountId,
  roomKey,
  timestamp: new Date().toISOString(),
});

// ❌ BAD: Unclear logging
console.log("joining", accountId);
```

### Using Forge Tunnel

```bash
# Start tunnel for live debugging
forge tunnel -e development

# In another terminal, watch logs
forge logs -e development --follow
```

### Error Tracking

```javascript
// Add error boundaries in React
class ErrorBoundary extends React.Component {
  componentDidCatch(error, errorInfo) {
    console.error("React Error:", error, errorInfo);
    // Could send to external logging service
  }

  render() {
    return this.props.children;
  }
}
```

## Security Considerations

1. **Never expose API tokens** - Use Forge secrets
2. **Validate all inputs** - Don't trust client data
3. **Use asUser() for API calls** - Respect user permissions
4. **Sanitize user content** - Prevent XSS in descriptions
5. **Implement rate limiting** - Prevent abuse

## Cost Optimization

### Reduce Invocations

1. Implement smart polling (visibility detection)
2. Use conditional updates (version checking)
3. Batch multiple resolver calls
4. Cache frequently accessed data

### Optimize Storage

1. Implement automatic cleanup
2. Use efficient data structures
3. Compress large values if needed
4. Delete obsolete data

### Right-Size Resources

1. Monitor actual memory usage
2. Reduce memory allocation if possible
3. Optimize cold start time
4. Use ARM architecture (cheaper)

## Common Pitfalls to Avoid

1. **Don't use setInterval in resolvers** - Resolvers are stateless
2. **Don't store large files in Storage** - Use external storage
3. **Don't make synchronous calls** - Always use async/await
4. **Don't ignore error responses** - Always check response.ok
5. **Don't hardcode site URLs** - Use context.siteUrl
6. **Don't share state between invocations** - Each invocation is isolated
7. **Don't use process.env in frontend** - Use build-time variables

## Resources

- [Forge Documentation](https://developer.atlassian.com/platform/forge/)
- [Forge Community](https://community.developer.atlassian.com/)
- [Jira REST API](https://developer.atlassian.com/cloud/jira/platform/rest/v3/)
- [Atlassian Design System](https://atlassian.design/)
