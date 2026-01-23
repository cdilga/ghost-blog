// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Theme Smoke Tests', () => {

  test('homepage loads without console errors', async ({ page }) => {
    const consoleErrors = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    page.on('pageerror', err => {
      consoleErrors.push(err.message);
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Filter out known acceptable errors (like favicon 404s)
    const realErrors = consoleErrors.filter(err =>
      !err.includes('favicon') &&
      !err.includes('404')
    );

    expect(realErrors).toEqual([]);
  });

  test('smooth scroll initializes correctly', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Check ChrisTheme global exists
    const hasChrisTheme = await page.evaluate(() => {
      return typeof window.ChrisTheme !== 'undefined';
    });
    expect(hasChrisTheme).toBe(true);

    // Check Lenis initialized (unless reduced motion)
    const scrollState = await page.evaluate(() => {
      const theme = window.ChrisTheme;
      return {
        hasLenis: theme.lenis !== null,
        prefersReducedMotion: theme.prefersReducedMotion,
        hasGsap: theme.gsap !== null,
        hasScrollTrigger: theme.ScrollTrigger !== null
      };
    });

    // If reduced motion, Lenis should be null, otherwise should be initialized
    if (!scrollState.prefersReducedMotion) {
      expect(scrollState.hasLenis).toBe(true);
      expect(scrollState.hasGsap).toBe(true);
      expect(scrollState.hasScrollTrigger).toBe(true);
    }
  });

  test('core page elements render', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Header exists
    await expect(page.locator('.site-header')).toBeVisible();

    // Main content area exists
    await expect(page.locator('.site-main')).toBeVisible();

    // Footer exists
    await expect(page.locator('.site-footer')).toBeVisible();

    // Site title link exists
    await expect(page.locator('.site-title')).toBeVisible();
  });

  test('page is scrollable', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Get initial scroll position
    const initialScroll = await page.evaluate(() => window.scrollY);

    // Scroll down
    await page.evaluate(() => window.scrollTo(0, 200));
    await page.waitForTimeout(500); // Wait for smooth scroll

    // Check we actually scrolled (or page is short)
    const pageHeight = await page.evaluate(() => document.body.scrollHeight);
    const viewportHeight = await page.evaluate(() => window.innerHeight);

    if (pageHeight > viewportHeight) {
      const newScroll = await page.evaluate(() => window.scrollY);
      expect(newScroll).toBeGreaterThan(initialScroll);
    }
  });

});
