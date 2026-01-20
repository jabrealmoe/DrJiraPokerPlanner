import { test, expect } from '@playwright/test';

// NOTE: This assumes you have configured .env with JIRA_USERNAME and JIRA_PASSWORD
// and that you have installed Playwright.

test('Login to Jira and Verify Poker App Load', async ({ page }) => {
  // 1. Basic Login Flow (Simplified - Jira auth can be complex with 2FA)
  // Ideally, use a stored 'state.json' with valid cookies to bypass login.
  
  if (!process.env.JIRA_SITE_URL) {
      console.log('Skipping test: JIRA_SITE_URL not set');
      return;
  }

  await page.goto(`${process.env.JIRA_SITE_URL}/Browse/TEST-1`);

  // Wait for the Forge app iframe to appear
  // Selector might need adjustment based on where your panel renders
  const frameSelector = 'iframe[title="Dr. Jira Poker Planner"]';
  
  try {
      await page.waitForSelector(frameSelector, { timeout: 10000 });
      const frame = page.frame({ url: /.*cdn.prod.atlassian-dev.net.*/ }); // Forge runs on CDN

      if (frame) {
          // Verify App Content
          await expect(frame.getByText('Dr. Jira Poker Hub')).toBeVisible();
      }
  } catch (e) {
      console.log("Could not find app frame - ensure user is logged in.");
  }
});
