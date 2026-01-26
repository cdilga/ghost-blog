// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Tests for scroll choreography issues.
 *
 * ScrollTrigger positions (verified):
 * - Hero: 0-2000 (pinned)
 * - Coder: 2720-4220 (pinned)
 * - Windswept mask: 4807-5383
 * - Claude: 5383-7383 (pinned)
 */

async function scrollAndUpdate(page, y) {
  await page.evaluate((scrollY) => {
    if (window.ChrisTheme?.lenis) {
      window.ChrisTheme.lenis.scrollTo(scrollY, { immediate: true });
    }
    window.ChrisTheme?.ScrollTrigger?.update();
    window.ChrisTheme?.gsap?.ticker.tick();
  }, y);
  await page.waitForTimeout(150);
  await page.evaluate(() => {
    window.ChrisTheme?.ScrollTrigger?.update();
    window.ChrisTheme?.gsap?.ticker.tick();
  });
  await page.waitForTimeout(150);
}

// Scroll through intermediate positions (simulates real scrolling)
async function scrollGradually(page, from, to, steps = 5) {
  const step = (to - from) / steps;
  for (let i = 0; i <= steps; i++) {
    await scrollAndUpdate(page, Math.round(from + step * i));
  }
}

test('scroll up reverses coder section animation', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);

  // Scroll to midway through coder (3500)
  await scrollAndUpdate(page, 3500);

  const headerVisibleDown = await page.evaluate(() => {
    const header = document.querySelector('.scene--coder .scene__header');
    if (!header) return { found: false };
    const opacity = parseFloat(getComputedStyle(header).opacity);
    return { found: true, opacity: opacity.toFixed(2), visible: opacity > 0.5 };
  });

  console.log('Coder header at scroll 3500:', JSON.stringify(headerVisibleDown));
  expect(headerVisibleDown.visible).toBe(true);

  // Scroll back gradually
  await scrollGradually(page, 3500, 0);

  const headerHiddenUp = await page.evaluate(() => {
    const header = document.querySelector('.scene--coder .scene__header');
    if (!header) return { found: false };
    const opacity = parseFloat(getComputedStyle(header).opacity);
    return { found: true, opacity: opacity.toFixed(2), hidden: opacity < 0.1 };
  });

  console.log('Coder header at scroll 0:', JSON.stringify(headerHiddenUp));
  expect(headerHiddenUp.hidden).toBe(true);
});

test('wisp mask has organic noise-distorted edge', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // Scroll gradually to transition zone
  await scrollGradually(page, 0, 5100, 8);

  const maskState = await page.evaluate(() => {
    // Check for clipPath with single organic edge path
    const clipPath = document.querySelector('#windswept-mask');
    const path = document.querySelector('#windswept-mask path');

    if (!clipPath || !path) return { exists: false };

    const d = path.getAttribute('d') || '';

    // Check path has substantial data and curves
    const hasCurves = d.includes('Q '); // Quadratic bezier curves for organic edge
    const hasClosedPath = d.includes('Z'); // Path should be closed
    const pathLength = d.length;

    return {
      exists: true,
      hasCurves,
      hasClosedPath,
      pathLength,
      isOrganic: hasCurves && pathLength > 500 // Should have substantial path data
    };
  });

  console.log('Mask state:', JSON.stringify(maskState));
  expect(maskState.exists).toBe(true);
  expect(maskState.hasCurves).toBe(true);
  expect(maskState.hasClosedPath).toBe(true);
  expect(maskState.isOrganic).toBe(true);
});

test('canvas transition: hero visible at top, claude visible after transition', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);

  // At top: hero canvas visible
  const heroAtTop = await page.evaluate(() => {
    const canvas = document.getElementById('depth-canvas-hero-coder');
    if (!canvas) return { found: false };
    return { found: true, visible: parseFloat(getComputedStyle(canvas).opacity) > 0.5 };
  });

  console.log('Hero canvas at top:', JSON.stringify(heroAtTop));
  expect(heroAtTop.visible).toBe(true);

  // Scroll gradually to claude section
  await scrollGradually(page, 0, 5600, 10);

  const claudeAfterTransition = await page.evaluate(() => {
    const claudeCanvas = document.getElementById('depth-canvas-claude-codes');
    return {
      claudeOpacity: claudeCanvas ? parseFloat(getComputedStyle(claudeCanvas).opacity).toFixed(2) : -1,
      claudeVisible: claudeCanvas ? parseFloat(getComputedStyle(claudeCanvas).opacity) > 0.5 : false
    };
  });

  console.log('Canvas state after transition:', JSON.stringify(claudeAfterTransition));
  expect(claudeAfterTransition.claudeVisible).toBe(true);

  // Scroll back gradually to top
  await scrollGradually(page, 5600, 0, 10);

  const afterScrollBack = await page.evaluate(() => {
    const heroCanvas = document.getElementById('depth-canvas-hero-coder');
    const claudeCanvas = document.getElementById('depth-canvas-claude-codes');
    return {
      heroOpacity: heroCanvas ? parseFloat(getComputedStyle(heroCanvas).opacity).toFixed(2) : -1,
      heroVisible: heroCanvas ? parseFloat(getComputedStyle(heroCanvas).opacity) > 0.5 : false,
      claudeOpacity: claudeCanvas ? parseFloat(getComputedStyle(claudeCanvas).opacity).toFixed(2) : -1,
      claudeHidden: claudeCanvas ? parseFloat(getComputedStyle(claudeCanvas).opacity) < 0.5 : true
    };
  });

  console.log('After scroll back to top:', JSON.stringify(afterScrollBack));
  expect(afterScrollBack.heroVisible).toBe(true);
  expect(afterScrollBack.claudeHidden).toBe(true);
});
