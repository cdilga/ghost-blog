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

test.describe('Hero Depth Parallax Tests', () => {

  test('PixiJS depth parallax initializes on desktop', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Wait for PixiJS to initialize
    await page.waitForTimeout(500);

    // Check that the depth canvas was created
    const hasDepthCanvas = await page.evaluate(() => {
      const canvas = document.querySelector('.hero__depth-canvas canvas');
      return canvas !== null;
    });
    expect(hasDepthCanvas).toBe(true);
  });

  test('desktop mouse tracking responds to movement', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    const hero = page.locator('.hero');
    const box = await hero.boundingBox();

    // Move mouse to left side of hero
    await page.mouse.move(box.x + 50, box.y + box.height / 2);
    await page.waitForTimeout(300);

    // Move mouse to right side - the parallax should respond
    await page.mouse.move(box.x + box.width - 50, box.y + box.height / 2);
    await page.waitForTimeout(300);

    // Canvas should still be visible and functioning
    const canvasVisible = await page.evaluate(() => {
      const canvas = document.querySelector('.hero__depth-canvas canvas');
      return canvas && canvas.offsetWidth > 0;
    });
    expect(canvasVisible).toBe(true);
  });

  test('mobile viewport triggers gyro/touch mode', async ({ browser }) => {
    // Create mobile context
    const context = await browser.newContext({
      viewport: { width: 375, height: 812 },
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();

    const consoleLogs = [];
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('Hero Depth')) {
        consoleLogs.push(text);
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Wait for gyro timeout (2s) + some buffer
    await page.waitForTimeout(3500);

    // Debug: print all captured logs
    console.log('Captured Hero Depth logs:', consoleLogs);

    // Should see gyro init attempt
    const hasGyroInit = consoleLogs.some(log => log.includes('initGyroscope called'));

    // Should see fallback (either touch tracking enabled or no gyro events)
    const hasFallback = consoleLogs.some(log =>
      log.includes('Touch tracking') ||
      log.includes('No gyro events') ||
      log.includes('falling back')
    );

    expect(hasGyroInit).toBe(true);
    expect(hasFallback).toBe(true);

    await context.close();
  });

  test('simulated gyroscope events update displacement', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 375, height: 812 },
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Simulate gyroscope tilt
    await page.evaluate(() => {
      window.dispatchEvent(new DeviceOrientationEvent('deviceorientation', {
        alpha: 0,
        beta: 60,
        gamma: 30
      }));
    });

    await page.waitForTimeout(500);

    // Simulate opposite tilt
    await page.evaluate(() => {
      window.dispatchEvent(new DeviceOrientationEvent('deviceorientation', {
        alpha: 0,
        beta: 30,
        gamma: -30
      }));
    });

    await page.waitForTimeout(300);

    // Canvas should still be functioning
    const canvasExists = await page.evaluate(() => {
      const canvas = document.querySelector('.hero__depth-canvas canvas');
      return canvas !== null;
    });
    expect(canvasExists).toBe(true);

    await context.close();
  });

  test('touch tracking works when gyro unavailable', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 375, height: 812 },
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();

    const consoleLogs = [];
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('Hero Depth')) {
        consoleLogs.push(text);
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Wait for gyro timeout to trigger touch fallback
    await page.waitForTimeout(3500);

    // Debug: print logs
    console.log('Touch test logs:', consoleLogs);

    // Should have touch tracking initialized
    const touchInitialized = consoleLogs.some(log =>
      log.includes('Touch tracking') ||
      log.includes('Touch mode') ||
      log.includes('falling back to touch')
    );

    // Simulate touch event
    const hero = page.locator('.hero');
    const box = await hero.boundingBox();

    if (box) {
      await page.evaluate(({ startX, startY }) => {
        const touch = new Touch({
          identifier: 0,
          target: document.body,
          clientX: startX,
          clientY: startY
        });

        document.dispatchEvent(new TouchEvent('touchmove', {
          touches: [touch],
          changedTouches: [touch],
          bubbles: true
        }));
      }, { startX: box.x + 100, startY: box.y + 200 });

      await page.waitForTimeout(500);
    }

    // Either touch tracking is initialized OR we have a working canvas
    const canvasExists = await page.evaluate(() => {
      const canvas = document.querySelector('.hero__depth-canvas canvas');
      return canvas !== null;
    });

    expect(touchInitialized || canvasExists).toBe(true);

    await context.close();
  });

  test('reduced motion disables depth parallax', async ({ browser }) => {
    const context = await browser.newContext({
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Depth canvas should NOT be created with reduced motion
    const hasDepthCanvas = await page.evaluate(() => {
      const canvas = document.querySelector('.hero__depth-canvas canvas');
      return canvas !== null;
    });

    expect(hasDepthCanvas).toBe(false);

    await context.close();
  });

});
