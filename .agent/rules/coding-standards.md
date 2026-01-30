# Coding Standards for DrJiraPokerPlanner

## General Principles

1. **Simplicity over cleverness** - Write code that's easy to understand
2. **Explicit over implicit** - Be clear about intentions
3. **Fail fast** - Validate inputs early and throw meaningful errors
4. **Log generously** - Use console.log for debugging in Forge environment

## TypeScript/JavaScript Standards

### Naming Conventions

- **Files**: `camelCase.ts` or `PascalCase.tsx` for React components
- **Functions**: `camelCase` (e.g., `getSessionState`, `submitVote`)
- **Classes/Components**: `PascalCase` (e.g., `SessionService`, `VotingPanel`)
- **Constants**: `UPPER_SNAKE_CASE` (e.g., `MAX_POLL_INTERVAL`, `CACHE_TTL`)
- **Interfaces/Types**: `PascalCase` with descriptive names (e.g., `SessionState`, `VotePayload`)

### Code Organization

**Backend (src/):**

```
src/
├── index.js              # Entry point - keep minimal
├── services/             # Business logic
├── utils/                # Pure utility functions
└── types/                # TypeScript definitions
```

**Frontend (static/poker-planner-ui/src/):**

```
src/
├── components/           # Reusable UI components
├── pages/                # Route-level components
├── services/             # API calls and business logic
├── hooks/                # Custom React hooks
├── utils/                # Pure utility functions
└── types/                # TypeScript definitions
```

### Function Guidelines

- **Keep functions small** - Max 50 lines (ideally 20-30)
- **Single responsibility** - One function, one job
- **Avoid side effects** - Make side effects explicit
- **Return early** - Use guard clauses

**Good:**

```javascript
async function getSessionState(req) {
  const roomKey = extractRoomKey(req);
  if (!roomKey) return null;

  const storageKey = getRoomKey(roomKey);
  return await storage.get(storageKey);
}
```

**Bad:**

```javascript
async function getSessionState(req) {
  if (
    req.payload?.roomKey ||
    req.payload?.issueId ||
    req.context.extension?.issue?.id
  ) {
    const actualKey =
      req.payload?.roomKey ||
      req.payload?.issueId ||
      req.context.extension?.issue?.id;
    const storageKey = getRoomKey(actualKey);
    const session = await storage.get(storageKey);
    return session;
  } else {
    return null;
  }
}
```

## Forge-Specific Standards

### Resolver Naming

- Use descriptive names that match frontend calls
- Group related resolvers together
- Prefix with action verb: `get`, `set`, `update`, `submit`, `reveal`

**Examples:**

- `getSessionState` ✅
- `submitVote` ✅
- `revealVotes` ✅
- `doStuff` ❌

### Storage Keys

- **Always use centralized key generation** - Never hardcode keys
- **Include version in key** - Enable schema migrations
- **Use environment prefixes** - Separate dev/prod data

**Good:**

```javascript
// utils/storageKeys.js
export const StorageKeys = {
  session: (id) => `${ENV}_poker_session_v3_${id}`,
  config: () => `${ENV}_poker_config_v3`,
};
```

**Bad:**

```javascript
const key = `poker_session_${issueId}`; // Hardcoded, no version, no env
```

### Error Handling

- **Always catch errors** - Forge doesn't show stack traces well
- **Log errors with context** - Include request payload
- **Return user-friendly errors** - Don't expose internals

```javascript
try {
  const result = await riskyOperation();
  return { success: true, data: result };
} catch (error) {
  console.error("[resolverName] Error:", error, "Payload:", req.payload);
  return { success: false, error: "Failed to complete operation" };
}
```

## React/Frontend Standards

### Component Structure

```tsx
// 1. Imports
import React, { useState, useEffect } from "react";
import { invoke } from "@forge/bridge";

// 2. Types/Interfaces
interface VotingPanelProps {
  sessionId: string;
  onVoteSubmit: (vote: string) => void;
}

// 3. Component
export const VotingPanel: React.FC<VotingPanelProps> = ({
  sessionId,
  onVoteSubmit,
}) => {
  // 4. State
  const [selectedVote, setSelectedVote] = useState<string | null>(null);

  // 5. Effects
  useEffect(() => {
    // ...
  }, [sessionId]);

  // 6. Handlers
  const handleVoteClick = (vote: string) => {
    setSelectedVote(vote);
    onVoteSubmit(vote);
  };

  // 7. Render
  return <div>{/* JSX */}</div>;
};
```

### State Management

- **Use local state first** - Don't over-engineer
- **Lift state when needed** - Share between siblings
- **Consider context for global state** - User info, theme, config
- **Avoid prop drilling** - Max 2-3 levels

### API Calls

- **Centralize in services** - Don't call `invoke()` directly in components
- **Handle loading states** - Always show feedback
- **Handle errors gracefully** - Show user-friendly messages
- **Cache when appropriate** - Reduce unnecessary calls

```typescript
// services/sessionService.ts
export async function getSessionState(roomKey: string): Promise<Session> {
  try {
    const session = await invoke("getSessionState", { roomKey });
    return session;
  } catch (error) {
    console.error("Failed to fetch session:", error);
    throw new Error("Unable to load session. Please try again.");
  }
}
```

## Performance Guidelines

### Backend

- **Cache frequently accessed data** - Use in-memory cache (5s TTL)
- **Batch operations** - Combine multiple storage reads
- **Limit query results** - Use pagination
- **Clean up old data** - Implement lifecycle management

### Frontend

- **Debounce user input** - Wait 300ms before API calls
- **Throttle polling** - Max once per 2 seconds
- **Lazy load components** - Use React.lazy() for routes
- **Memoize expensive calculations** - Use useMemo/useCallback

## Testing Standards

### Unit Tests

- **Test business logic** - Not implementation details
- **Use descriptive test names** - Should read like documentation
- **Follow AAA pattern** - Arrange, Act, Assert
- **Mock external dependencies** - Forge API, Jira API

```typescript
describe("SessionService", () => {
  it("should create new session when none exists", async () => {
    // Arrange
    const mockStorage = { get: jest.fn().mockResolvedValue(null) };

    // Act
    const session = await createSession("room-123", mockStorage);

    // Assert
    expect(session.roomKey).toBe("room-123");
    expect(session.status).toBe("VOTING");
  });
});
```

### E2E Tests

- **Test critical user flows** - Voting, revealing, session management
- **Use data-testid attributes** - For reliable selectors
- **Clean up test data** - Reset state between tests
- **Run against development environment** - Not production

## Git Commit Standards

Follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` - New feature
- `fix:` - Bug fix
- `refactor:` - Code refactoring
- `test:` - Test additions/changes
- `docs:` - Documentation
- `chore:` - Build/tooling changes
- `perf:` - Performance improvements

**Examples:**

```
feat: add timer pause functionality
fix: resolve vote reveal race condition
refactor: extract session service from monolithic resolver
test: add E2E tests for voting flow
docs: update README with deployment instructions
chore: upgrade Forge CLI to v7.0
perf: implement in-memory caching for sessions
```

## Documentation Standards

### Code Comments

- **Explain WHY, not WHAT** - Code should be self-documenting
- **Document complex logic** - Help future developers
- **Keep comments up to date** - Outdated comments are worse than none

**Good:**

```javascript
// Forge Storage doesn't support transactions, so we need to
// handle race conditions manually by checking version numbers
if (session.version !== expectedVersion) {
  throw new ConcurrentModificationError();
}
```

**Bad:**

```javascript
// Check version
if (session.version !== expectedVersion) {
  throw new ConcurrentModificationError();
}
```

### JSDoc for Public APIs

```typescript
/**
 * Submits a vote for the current user in the active session.
 *
 * @param roomKey - Unique identifier for the poker session
 * @param vote - The vote value (must match deck configuration)
 * @returns Updated session state with the new vote
 * @throws {SessionNotFoundError} If the session doesn't exist
 * @throws {InvalidVoteError} If vote is not in the configured deck
 */
export async function submitVote(
  roomKey: string,
  vote: string,
): Promise<Session> {
  // ...
}
```

## Security Guidelines

1. **Never log sensitive data** - User tokens, API keys, personal info
2. **Validate all inputs** - Don't trust client data
3. **Use asUser() for Jira API calls** - Respect user permissions
4. **Sanitize user-generated content** - Prevent XSS
5. **Rate limit expensive operations** - Prevent abuse

## Accessibility Standards

1. **Use semantic HTML** - `<button>`, `<nav>`, `<main>`
2. **Add ARIA labels** - For screen readers
3. **Ensure keyboard navigation** - Tab order, focus states
4. **Maintain color contrast** - WCAG AA minimum
5. **Test with screen readers** - VoiceOver, NVDA

## When to Break These Rules

Rules are guidelines, not laws. Break them when:

1. **Performance is critical** - Optimize hot paths
2. **Forge limitations require workarounds** - Document why
3. **Third-party libraries have different conventions** - Be consistent within that context
4. **The rule makes code less readable** - Readability wins

**Always document why you're breaking a rule.**
