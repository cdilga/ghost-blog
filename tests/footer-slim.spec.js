// @ts-check
const { test, expect } = require('@playwright/test');

const BASE_URL = 'http://localhost:2369';

test.describe('Slim Footer Design', () => {
    test('desktop footer is visibly slimmer', async ({ page }) => {
        await page.goto(BASE_URL);

        // Wait for footer to be visible
        const footer = page.locator('.social-footer');
        await expect(footer).toBeVisible();

        // Get footer bounding box
        const box = await footer.boundingBox();

        // Footer should be slim - height should be less than 100px on desktop
        // (original was ~96px with space-8 padding, now should be ~60px or less)
        expect(box.height).toBeLessThan(100);
        console.log(`Desktop footer height: ${box.height}px`);

        // Take screenshot for visual verification
        await footer.screenshot({ path: 'test-results/footer-desktop.png' });

        // Verify all links are present
        const links = footer.locator('.social-footer__link');
        await expect(links).toHaveCount(5); // Articles, GitHub, X, LinkedIn, YouTube

        // Verify copyright is present
        const copyright = footer.locator('.social-footer__copyright');
        await expect(copyright).toBeVisible();
    });

    test('mobile footer is significantly slimmer', async ({ page }) => {
        // Set mobile viewport (iPhone 12/13)
        await page.setViewportSize({ width: 375, height: 812 });

        await page.goto(BASE_URL);

        const footer = page.locator('.social-footer');
        await expect(footer).toBeVisible();

        const box = await footer.boundingBox();

        // Mobile footer should be very slim - under 80px including wrap
        console.log(`Mobile footer height: ${box.height}px`);

        // Take screenshot
        await footer.screenshot({ path: 'test-results/footer-mobile.png' });

        // Verify all content is still present
        const links = footer.locator('.social-footer__link');
        await expect(links).toHaveCount(5);

        const copyright = footer.locator('.social-footer__copyright');
        await expect(copyright).toBeVisible();
    });

    test('no horizontal overflow on mobile', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 812 });

        await page.goto(BASE_URL);

        // Check for horizontal scrollbar
        const hasHorizontalScroll = await page.evaluate(() => {
            return document.documentElement.scrollWidth > document.documentElement.clientWidth;
        });

        expect(hasHorizontalScroll).toBe(false);
    });

    test('touch targets are accessible (min 44px)', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 812 });

        await page.goto(BASE_URL);

        const footer = page.locator('.social-footer');
        await expect(footer).toBeVisible();

        // Check each link has minimum 44px touch target
        const links = footer.locator('.social-footer__link');
        const count = await links.count();

        for (let i = 0; i < count; i++) {
            const link = links.nth(i);
            const box = await link.boundingBox();

            // Touch target should be at least 44px in height
            expect(box.height).toBeGreaterThanOrEqual(44);
            console.log(`Link ${i + 1} touch target height: ${box.height}px`);
        }
    });

    test('footer links are functional', async ({ page }) => {
        await page.goto(BASE_URL);

        const footer = page.locator('.social-footer');

        // Verify Articles link points to #all-posts
        const articlesLink = footer.locator('a[href="#all-posts"]');
        await expect(articlesLink).toBeVisible();

        // Verify external links have proper attributes
        const externalLinks = footer.locator('a[target="_blank"]');
        const externalCount = await externalLinks.count();

        for (let i = 0; i < externalCount; i++) {
            const link = externalLinks.nth(i);
            await expect(link).toHaveAttribute('rel', /noopener/);
        }
    });

    test('very small mobile (320px) - no overflow', async ({ page }) => {
        await page.setViewportSize({ width: 320, height: 568 });

        await page.goto(BASE_URL);

        const footer = page.locator('.social-footer');
        await expect(footer).toBeVisible();

        // Take screenshot
        await footer.screenshot({ path: 'test-results/footer-mobile-small.png' });

        // No horizontal overflow
        const hasHorizontalScroll = await page.evaluate(() => {
            return document.documentElement.scrollWidth > document.documentElement.clientWidth;
        });

        expect(hasHorizontalScroll).toBe(false);
    });
});
