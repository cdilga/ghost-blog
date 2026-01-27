/**
 * Cog Carousel Tests
 *
 * Tests for the half-circle cog carousel where:
 * - Wheel center is below viewport
 * - Active card at top (90° / 12 o'clock)
 * - Cards tilt outward like cog teeth
 * - Scroll down = anticlockwise rotation
 */
const { test, expect } = require('@playwright/test');

test.describe('Cog Carousel', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:2368/');
        await page.waitForFunction(() => window.ChrisTheme?.projectionCarousel, { timeout: 10000 });
    });

    test('carousel initializes with correct cog geometry', async ({ page }) => {
        const state = await page.evaluate(() => {
            return window.ChrisTheme?.projectionCarousel?.getState();
        });

        // Check state exists
        expect(state).toBeTruthy();
        expect(state.centerX).toBeGreaterThan(0);
        expect(state.centerY).toBeGreaterThan(0);
        expect(state.radius).toBeGreaterThan(200);
        expect(state.totalPosts).toBeGreaterThan(0);

        // Wheel center should be below the wheel container
        const centerBelowContainer = await page.evaluate(() => {
            const wheel = document.querySelector('.reel-navigator__wheel');
            const state = window.ChrisTheme?.projectionCarousel?.getState();
            return state.centerY > wheel.offsetHeight;
        });
        expect(centerBelowContainer).toBe(true);
    });

    test('active card is at top center (90 degrees)', async ({ page }) => {
        // Get card positions
        const cardData = await page.evaluate(() => {
            const cards = Array.from(document.querySelectorAll('.reel-card')).slice(0, 3);
            const state = window.ChrisTheme?.projectionCarousel?.getState();

            return {
                centerX: state.centerX,
                cards: cards.map(card => ({
                    rect: card.getBoundingClientRect(),
                    isActive: card.classList.contains('reel-card--active')
                }))
            };
        });

        // First card should be active
        expect(cardData.cards[0].isActive).toBe(true);

        // Active card should be roughly centered horizontally
        const activeCard = cardData.cards[0];
        const cardCenterX = activeCard.rect.x + activeCard.rect.width / 2;
        const tolerance = 50; // pixels
        expect(Math.abs(cardCenterX - cardData.centerX)).toBeLessThan(tolerance);
    });

    test('cards tilt outward like cog teeth', async ({ page }) => {
        // Card 0 at 90° should have no rotation (upright)
        // Card 1 (clockwise) should tilt right (negative rotation)
        // Card on left (if visible) should tilt left (positive rotation)

        const rotations = await page.evaluate(() => {
            const cards = Array.from(document.querySelectorAll('.reel-card')).slice(0, 3);
            return cards.map(card => {
                const transform = window.getComputedStyle(card).transform;
                if (transform === 'none') return 0;

                // Parse rotation from matrix
                const values = transform.match(/matrix\(([^)]+)\)/)?.[1].split(',').map(Number);
                if (!values) return 0;

                // atan2(b, a) gives rotation in radians
                const rotation = Math.atan2(values[1], values[0]) * (180 / Math.PI);
                return Math.round(rotation);
            });
        });

        console.log('Card rotations:', rotations);

        // Card 0 should be upright (0° rotation)
        expect(Math.abs(rotations[0])).toBeLessThan(5);

        // Card 1 should be tilted right (negative rotation, around -20°)
        expect(rotations[1]).toBeLessThan(-10);
    });

    test('cards scale down toward edges', async ({ page }) => {
        const scales = await page.evaluate(() => {
            const cards = Array.from(document.querySelectorAll('.reel-card')).slice(0, 4);
            return cards.map(card => {
                const transform = window.getComputedStyle(card).transform;
                if (transform === 'none') return 1;

                const values = transform.match(/matrix\(([^)]+)\)/)?.[1].split(',').map(Number);
                if (!values) return 1;

                // Scale is sqrt(a² + b²) for uniform scaling
                return Math.sqrt(values[0] ** 2 + values[1] ** 2);
            });
        });

        console.log('Card scales:', scales);

        // Card 0 (active) should be largest (~1.0)
        expect(scales[0]).toBeGreaterThan(0.95);

        // Cards further from center should be smaller
        expect(scales[1]).toBeLessThan(scales[0]);
        expect(scales[2]).toBeLessThan(scales[1]);
    });

    test('no console errors from carousel code', async ({ page }) => {
        const errors = [];
        page.on('console', msg => {
            if (msg.type() === 'error' && !msg.text().includes('play()') && !msg.text().includes('404')) {
                errors.push(msg.text());
            }
        });

        // Scroll to carousel
        await page.evaluate(() => {
            document.querySelector('#all-posts')?.scrollIntoView();
        });
        await page.waitForTimeout(1000);

        expect(errors.filter(e => e.includes('carousel'))).toHaveLength(0);
    });

    test('reduced motion shows static grid layout', async ({ page, context }) => {
        const reducedMotionPage = await context.newPage();
        await reducedMotionPage.emulateMedia({ reducedMotion: 'reduce' });
        await reducedMotionPage.goto('http://localhost:2368/');
        await reducedMotionPage.waitForLoadState('domcontentloaded');

        // Check if wheel has grid display (CSS fallback)
        const wheelDisplay = await reducedMotionPage.evaluate(() => {
            const wheel = document.querySelector('.reel-navigator__wheel');
            return window.getComputedStyle(wheel).display;
        });

        expect(wheelDisplay).toBe('grid');

        await reducedMotionPage.close();
    });
});
