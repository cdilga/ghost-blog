// @ts-check
const { test, expect } = require('@playwright/test');

const BASE_URL = 'http://localhost:2370';

test.describe('Carousel Fixes Verification', () => {
    test('carousel initializes with correct angle calculation', async ({ page }) => {
        await page.goto(BASE_URL);

        // Scroll to the reel-navigator section
        await page.evaluate(() => {
            const section = document.querySelector('.reel-navigator');
            if (section) section.scrollIntoView({ behavior: 'instant' });
        });

        // Wait for carousel to initialize
        await page.waitForTimeout(2000);

        // Get carousel state from debug API
        const state = await page.evaluate(() => {
            if (window.ChrisTheme?.projectionCarousel) {
                return window.ChrisTheme.projectionCarousel.getState();
            }
            return null;
        });

        console.log('Carousel state:', JSON.stringify(state, null, 2));

        expect(state).not.toBeNull();

        if (state) {
            // With 120° arc: anglePerCard should be 120 / (numCards - 1)
            // For 10 cards: 120 / 9 = 13.3°
            // For 7 cards: 120 / 6 = 20°
            expect(state.anglePerCard).toBeLessThanOrEqual(20);
            expect(state.anglePerCard).toBeGreaterThan(5);
            console.log(`✓ anglePerCard: ${state.anglePerCard.toFixed(1)}° (120° arc)`);

            // Verify reduced radius
            expect(state.radius).toBeLessThanOrEqual(400);
            console.log(`✓ radius: ${state.radius}px`);
        }

        // Take screenshot of the carousel
        await page.screenshot({ path: 'test-results/carousel-full.png', fullPage: false });
    });

    test('footer is visible inside reel-navigator section', async ({ page }) => {
        await page.goto(BASE_URL);

        // Scroll to reel-navigator
        await page.evaluate(() => {
            const section = document.querySelector('.reel-navigator');
            if (section) section.scrollIntoView({ behavior: 'instant' });
        });

        await page.waitForTimeout(1000);

        // Check footer exists inside reel-navigator
        const footer = page.locator('.reel-navigator .social-footer');
        await expect(footer).toBeVisible();

        console.log('✓ Footer is visible inside reel-navigator');

        // Screenshot showing footer
        await page.locator('.reel-navigator').screenshot({ path: 'test-results/carousel-with-footer.png' });
    });

    test('section height is reduced to ~60%', async ({ page }) => {
        await page.goto(BASE_URL);

        const sectionBox = await page.locator('.reel-navigator').boundingBox();
        const viewportHeight = await page.evaluate(() => window.innerHeight);

        const sectionPercent = (sectionBox.height / viewportHeight) * 100;
        console.log(`Section height: ${sectionBox.height}px`);
        console.log(`Viewport height: ${viewportHeight}px`);
        console.log(`Section as % of viewport: ${sectionPercent.toFixed(1)}%`);

        // Section should be around 60-75% of viewport (not 100%)
        expect(sectionPercent).toBeLessThan(85);
        expect(sectionPercent).toBeGreaterThan(50);

        console.log('✓ Section height is reduced');
    });

    test('cards have gentler rotation (max ~60°)', async ({ page }) => {
        await page.goto(BASE_URL);

        // Scroll to carousel
        await page.evaluate(() => {
            const section = document.querySelector('.reel-navigator');
            if (section) section.scrollIntoView({ behavior: 'instant' });
        });

        await page.waitForTimeout(2000);

        // Get rotation of all visible cards
        const cardRotations = await page.evaluate(() => {
            const cards = document.querySelectorAll('.reel-card');
            const rotations = [];
            cards.forEach((card, i) => {
                const style = card.style.transform;
                const match = style.match(/rotate\(([^)]+)deg\)/);
                if (match && card.style.visibility !== 'hidden') {
                    rotations.push({
                        index: i,
                        rotation: parseFloat(match[1]),
                        visible: card.style.visibility !== 'hidden'
                    });
                }
            });
            return rotations;
        });

        console.log('Card rotations:', cardRotations);

        // Check that no visible card is rotated more than ~65° (with some tolerance)
        for (const card of cardRotations) {
            expect(Math.abs(card.rotation)).toBeLessThanOrEqual(70);
        }

        console.log('✓ All cards have rotation ≤ 70°');
    });

    test('visual comparison screenshot', async ({ page }) => {
        await page.goto(BASE_URL);

        // Scroll past hero to carousel
        await page.evaluate(() => {
            window.scrollTo(0, window.innerHeight * 3);
        });

        await page.waitForTimeout(2000);

        // Take a viewport screenshot showing the carousel
        await page.screenshot({ path: 'test-results/carousel-viewport.png' });

        console.log('✓ Screenshot saved: test-results/carousel-viewport.png');
    });
});
