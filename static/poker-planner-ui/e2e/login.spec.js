import { test, expect } from '@playwright/test';

test.describe('Dr Jira Poker Planner E2E', () => {
    test('loads the application', async ({ page }) => {
        await page.goto('http://localhost:3000');
        // The app renders "Loading..." by default if context isn't ready
        await expect(page.getByText('Loading...')).toBeVisible();
    });
});
