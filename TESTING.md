# Testing Dr. Jira Poker Planner

This project uses **Playwright** for End-to-End (E2E) testing. Since the app runs inside an iframe within Jira, testing requires authenticating with a real Jira account and navigating through the host product.

## Prerequisites

1.  **Install Playwright**:

    ```bash
    npm install -D @playwright/test
    npx playwright install chromium
    ```

2.  **Environment Variables**:
    Create a `.env.test` file (do NOT commit this) with:
    ```
    JIRA_SITE_URL=https://your-domain.atlassian.net
    JIRA_USERNAME=your-email@example.com
    JIRA_PASSWORD=your-api-token-or-password
    ```

## Running Tests

```bash
# Run all tests
npx playwright test

# Run in UI mode (visual debugger)
npx playwright test --ui
```

## Strategy for Forge Apps

Testing Forge apps is unique because:

1.  **Authentication**: You must log in to Jira first.
2.  **Iframes**: The app lives inside an `iframe`. You cannot select elements directly from the main page; you must switch context to the iframe.

### Example Test (`tests/poker-flow.spec.ts`)

```typescript
import { test, expect } from "@playwright/test";

test("User can open Poker Room from Issue", async ({ page }) => {
  // 1. Login to Jira
  await page.goto(process.env.JIRA_SITE_URL!);
  await page.fill("#username", process.env.JIRA_USERNAME!);
  await page.click("#login-submit");
  await page.fill("#password", process.env.JIRA_PASSWORD!);
  await page.click("#login-submit");

  // 2. Navigate to an Issue
  await page.goto(`${process.env.JIRA_SITE_URL}/browse/TEST-1`);

  // 3. Open the App Panel
  // Note: Selectors vary by Jira version. Wait for the app frame.
  const frameElement = await page.waitForSelector('iframe[id*="forge-app"]');
  const frame = await frameElement.contentFrame();

  // 4. Interact with App
  if (frame) {
    await frame.waitForSelector("text=Dr. Jira Poker Hub");

    // Enter Project Key
    await frame.fill('input[placeholder="e.g. GS"]', "TEST");
    await frame.click('button:has-text("Open Room")');

    // Verification
    await expect(frame.locator(".table-surface")).toBeVisible();
  }
});
```

## Mocking (Integration Tests)

For faster, non-E2E tests, it is recommended to test the `static/poker-planner-ui` React app in isolation by mocking the `@forge/bridge` API.

1.  Run the React app locally (`npm start`).
2.  Mock `window.bridge` in your test setup to return fake data for `invoke('getBacklog')`, etc.
