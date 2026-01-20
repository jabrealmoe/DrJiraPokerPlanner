# Dr. Jira Poker Planner - Implementation Design

## 1. High-Level Architecture

The application acts as a digital card table embedded directly within a Jira Issue.

- **Frontend**: A Single Page Application (SPA) built with React (Forge Custom UI). It renders the game interface, handles user interactions, and polls the backend for state changes.
- **Backend**: Forge FaaS (Function-as-a-Service) Resolvers. These handle business logic (voting, revealing, resetting) and persist data to Forge Storage.
- **Database**: Forge Storage (Key-Value Store). We store one state object per Jira Issue.
- **Real-time Communication**: Polling. The Frontend requests the current state state every 1-2 seconds.

### Data Flow

1.  **User acts** (Votes): Frontend calls `invoke('submitVote', { value })`.
2.  **Resolver executes**: Reads current state, updates the vote map, increments version, writes to Storage.
3.  **Polling**: Other clients poll `invoke('getSessionState')` and receive the new state.
4.  **Re-render**: React updates the UI to show the card face-down (or face-up if revealed).

---

## 2. Storage Schema Design

We will use a single key per issue to store the entire session state.
Key format: `poker-session-${issueId}`.

**JSON Document Structure:**

```typescript
interface PokerSessionState {
  version: number; // For optimistic locking (concurrency control)
  issueKey: string;
  status: "VOTING" | "REVEALED";
  moderatorAccountId: string; // The user who typically started the session
  deckType: "FIBONACCI" | "TSHIRT" | "CUSTOM";
  deckValues: (number | string)[]; // e.g., [0, 1, 2, 3, 5...] or ['XS', 'S'...]

  // Map of accountId to their session data
  participants: {
    [accountId: string]: {
      displayName: string;
      avatarUrl: string;
      vote: string | number | null; // null represents "no vote yet"
      hasVoted: boolean; // Computed helper for UI privacy
      joinedAt: number;
    };
  };

  // Optional: Queue for future refinements
  storyQueue: string[]; // List of Issue Keys
  lastUpdated: number; // Timestamp
}
```

---

## 3. Resolver Functions (Backend API)

These functions function as our API points. They must be registered in the `manifest.yml`.

### `getSessionState`

- **Input**: `{ issueId }` (Context automatically provided)
- **Logic**: Reads `poker-session-${issueId}`. If missing, allows the client to initialize.
- **Returns**: `PokerSessionState`

### `joinSession`

- **Input**: `void` (Uses `context.accountId`)
- **Logic**:
  1.  Fetch state.
  2.  Add `participants[accountId]`.
  3.  If first participant, set as moderator.
  4.  Save state.

### `submitVote`

- **Input**: `{ voteValue: string | number }`
- **Logic**:
  1.  Fetch state.
  2.  Check if `status` is 'VOTING'.
  3.  Update `participants[accountId].vote = voteValue`.
  4.  Update `participants[accountId].hasVoted = true`.
  5.  Save state.

### `revealVotes`

- **Input**: `void`
- **Logic**:
  1.  Fetch state.
  2.  **Constraint**: Only moderator or any user (depending on lax rules) can reveal.
  3.  Set `status = 'REVEALED'`.
  4.  Save state.

### `resetRound`

- **Input**: `void`
- **Logic**:
  1.  Fetch state.
  2.  Set `status = 'VOTING'`.
  3.  Iterate `participants` and set all `vote` to `null`.
  4.  Increment `version`.
  5.  Save state.

---

## 4. React Component Structure

```text
src/
  components/
    ActiveIssue/
      ActiveIssuePanel.jsx       <-- Top Section
      IssueDetails.jsx           <-- Renders markdown description
    Participants/
      PlayerList.jsx             <-- Right Pane
      PlayerAvatar.jsx           <-- Individual user circle (shows status)
    Deck/
      VotingDeck.jsx             <-- Bottom Section
      Card.jsx                   <-- Clickable card component
    Controls/
      GameControls.jsx           <-- Reveal / Reset buttons (Moderator only)
    Layout/
      GameLayout.jsx             <-- CSS Grid/Flex layout wrapper
  hooks/
    usePokerSession.js           <-- Encapsulates Polling & Resolver calls
  App.jsx                        <-- Main Entry point
```

### Key Component: `usePokerSession` Hook

This is the "Brain" of the client-side.

```javascript
// Pseudo-code implementation guidance
const usePokerSession = () => {
  const [state, setState] = useState(null);

  // Polling Effect
  useEffect(() => {
    const fetchState = async () => {
      const data = await invoke('getSessionState');
      setState(data);
    };

    // Poll every 1.5 seconds
    const interval = setInterval(fetchState, 1500);

    return () => clearInterval(interval);
  }, []);

  const sendVote = async (value) => {
    // Optimistic Update (optional, or just wait for poll)
    await invoke('submitVote', { value });
    // Trigger immediate fetch to feel snappy
    const data = await invoke('getSessionState');
    setState(data);
  };

  return { state, sendVote, reveal: ..., reset: ... };
}
```

---

## 5. Polling Strategy & UX Considerations

Since we rely on polling, we need to balance **server load** vs **user perceived latency**.

- **Interval**: 1500ms (1.5 seconds) is the sweet spot.
- **Jitter**: Not strictly necessary for 5-10 users, but good practice to add slight random delay if scaling up.
- **Stale Data Visualization**:
  - When a user clicks a card, immediately highlight it visually as "Selected" in local component state (`selectedCard`), even if the confirmed server state hasn't come back yet.
  - Once the poll returns the updated participants list showing the current user has voted, sync the local state.

## 6. Trade-offs

1.  **Concurrency (Race Conditions)**:
    - _Problem_: Two users voting at the exact same millisecond.
    - _Solution_: Forge Storage `set` is atomic for the write, but the read-modify-write pattern isn't transactionally safe without checks.
    - _Real-world_: For <10 users, collisions are rare. We will implement **Version Checking**. If `submitVote` reads version 5, but when writing the version in DB is 6, the write fails and the client must retry. The simpler approach for an MPV is "Last Write Wins" on the `participants` map, which is usually fine provided we merge user objects carefully.

2.  **Polling vs WebSockets**:
    - _Tradeoff_: Polling adds network overhead.
    - _Decision_: Forge constraints force polling. We minimize payload size by only storing essential state.

3.  **Storage Limits**:
    - Forge Storage has quotas. Storing a large history of past estimates is risky.
    - _Decision_: We only store the _current_ active issue state. Past history should be written to Jira (e.g., as a Comment or updating the Story Points field) rather than kept in the session object forever.

---

## 7. Mockup / Layout (Mental Model)

```
+-------------------------------------------------------+
|  [ TOP: ACTIVE ISSUE ]                                |
|  PROJ-123: As a user, I want to login...              |
|  (Description rendered here...)                       |
+------------------------------------------+------------+
|                                          | [ R ]      |
|  [ CENTER: TABLE AREA ]                  | Participants|
|                                          |            |
|       (Hidden)    (Hidden)    (8)        |  User A    |
|      [User A]    [User B]   [User C]     |  User B    |
|                                          |  User C    |
|                                          |            |
|   STATUS: VOTING...                      |            |
+------------------------------------------+------------+
|  [ BOTTOM: DECK ]                                     |
|  [0]  [1]  [2]  [3]  [5]  [8]  [13]  [?]              |
+-------------------------------------------------------+
```
