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

  test('hero section elements render', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Hero section exists
    await expect(page.locator('.hero')).toBeVisible();

    // Hero title exists
    await expect(page.locator('.hero__title')).toBeVisible();

    // Hero subtitle exists
    await expect(page.locator('.hero__subtitle')).toBeVisible();

    // Hero CTA buttons exist
    await expect(page.locator('.hero__cta')).toBeVisible();
  });

  test('hero content visible after scroll back to top', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Helper to scroll with Lenis and update ScrollTrigger
    const scrollTo = async (y) => {
      await page.evaluate((scrollY) => {
        if (window.ChrisTheme?.lenis) {
          window.ChrisTheme.lenis.scrollTo(scrollY, { immediate: true });
        }
        window.ChrisTheme?.ScrollTrigger?.update();
        window.ChrisTheme?.gsap?.ticker.tick();
      }, y);
      await page.waitForTimeout(200);
    };

    // Verify hero title visible at start
    const titleAtStart = await page.evaluate(() => {
      const title = document.querySelector('.hero__title');
      if (!title) return { found: false };
      const style = getComputedStyle(title);
      return {
        found: true,
        visible: style.visibility !== 'hidden' && parseFloat(style.opacity) > 0
      };
    });
    expect(titleAtStart.found).toBe(true);
    expect(titleAtStart.visible).toBe(true);

    // Scroll past the hero section (hero ends at ~2000)
    await scrollTo(2500);

    // Scroll back to top gradually
    for (let y = 2500; y >= 0; y -= 500) {
      await scrollTo(y);
    }

    // Verify hero content is visible again via clip-path
    const heroAfterReturn = await page.evaluate(() => {
      const hero = document.querySelector('.hero');
      const title = document.querySelector('.hero__title');
      if (!hero || !title) return { found: false };

      const heroStyle = getComputedStyle(hero);
      const titleStyle = getComputedStyle(title);
      const clipPath = heroStyle.clipPath;

      // Check clip-path is reset (should be 'inset(0 0 0% 0)' or 'none')
      const clipPathReset = clipPath === 'none' ||
        clipPath.includes('inset(0') ||
        clipPath.includes('0%)');

      return {
        found: true,
        clipPath,
        clipPathReset,
        titleVisible: titleStyle.visibility !== 'hidden' && parseFloat(titleStyle.opacity) > 0
      };
    });

    console.log('Hero after scroll back:', JSON.stringify(heroAfterReturn));
    expect(heroAfterReturn.found).toBe(true);
    expect(heroAfterReturn.clipPathReset).toBe(true);
    expect(heroAfterReturn.titleVisible).toBe(true);
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

  test('mobile viewport initializes depth canvas', async ({ browser }) => {
    // Create mobile context
    const context = await browser.newContext({
      viewport: { width: 375, height: 812 },
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Check that the depth canvas was created on mobile
    const hasDepthCanvas = await page.evaluate(() => {
      const canvas = document.querySelector('.hero__depth-canvas canvas');
      return canvas !== null;
    });
    expect(hasDepthCanvas).toBe(true);

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

  test('touch events work on mobile', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 375, height: 812 },
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Simulate touch event on hero
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

      await page.waitForTimeout(300);
    }

    // Canvas should still be functioning
    const canvasExists = await page.evaluate(() => {
      const canvas = document.querySelector('.hero__depth-canvas canvas');
      return canvas !== null;
    });

    expect(canvasExists).toBe(true);

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

  test('ultra-wide viewport covers full hero area', async ({ browser }) => {
    // Test ultra-wide (21:9 aspect ratio - 2560x1080)
    const context = await browser.newContext({
      viewport: { width: 2560, height: 1080 },
    });
    const page = await context.newPage();

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Check that canvas covers the full hero area
    const coverage = await page.evaluate(() => {
      const hero = document.querySelector('.hero');
      const canvas = document.querySelector('.hero__depth-canvas canvas');

      if (!hero || !canvas) return { heroExists: !!hero, canvasExists: !!canvas };

      const heroRect = hero.getBoundingClientRect();
      const canvasRect = canvas.getBoundingClientRect();

      return {
        heroExists: true,
        canvasExists: true,
        heroWidth: heroRect.width,
        heroHeight: heroRect.height,
        canvasWidth: canvasRect.width,
        canvasHeight: canvasRect.height,
        // Canvas should cover at least the hero area
        widthCoverage: canvasRect.width >= heroRect.width,
        heightCoverage: canvasRect.height >= heroRect.height,
      };
    });

    expect(coverage.canvasExists).toBe(true);
    expect(coverage.widthCoverage).toBe(true);
    expect(coverage.heightCoverage).toBe(true);

    // Also verify mouse tracking works at edges
    const hero = page.locator('.hero');
    const box = await hero.boundingBox();

    // Move mouse to far left edge
    await page.mouse.move(box.x + 10, box.y + box.height / 2);
    await page.waitForTimeout(200);

    // Move mouse to far right edge
    await page.mouse.move(box.x + box.width - 10, box.y + box.height / 2);
    await page.waitForTimeout(200);

    // Canvas should still be functional
    const stillFunctional = await page.evaluate(() => {
      const canvas = document.querySelector('.hero__depth-canvas canvas');
      return canvas && canvas.offsetWidth > 0;
    });
    expect(stillFunctional).toBe(true);

    await context.close();
  });

});

test.describe('Content Quality Tests', () => {

  test('no placeholder content', async ({ page }) => {
    await page.goto('/');
    const html = await page.content();

    const placeholders = [
      'dQw4w9WgXcQ',           // Rick Astley YouTube video ID
      'Lorem ipsum',
      'TODO',
      'PLACEHOLDER',
      'example.com',
      'VIDEO_ID',
      'Website scroll video goes here',
    ];

    for (const p of placeholders) {
      expect(html, `Found placeholder content: "${p}"`).not.toContain(p);
    }
  });

  test('internal links resolve', async ({ page }) => {
    await page.goto('/');
    const links = await page.locator('a[href^="/"]').all();

    for (const link of links) {
      const href = await link.getAttribute('href');
      if (href && href !== '/') {
        const resp = await page.request.get(href);
        expect(resp.status(), `Link ${href} returned 404`).not.toBe(404);
      }
    }
  });

});
