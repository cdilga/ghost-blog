/**
 * E2E tests for the optimized-local storage adapter
 *
 * Tests the adapter directly with real image files to verify
 * WebP generation and responsive sizing work correctly.
 */

const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Import the adapter
const OptimizedLocalStorage = require('../ghost/adapters/storage/optimized-local');

test.describe('Storage Adapter', () => {
  let adapter;
  let testDir;

  test.beforeAll(() => {
    // Create a temp directory for test outputs
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ghost-storage-test-'));

    adapter = new OptimizedLocalStorage({
      storagePath: testDir,
      sizes: [400, 800, 1200],
      quality: 80
    });
  });

  test.afterAll(() => {
    // Clean up temp directory
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  test('happy path: JPEG upload creates WebP and responsive sizes', async () => {
    // Create a test image (1600x1200 red rectangle)
    const sharp = require('sharp');
    const testImagePath = path.join(testDir, 'test-input.jpg');

    await sharp({
      create: {
        width: 1600,
        height: 1200,
        channels: 3,
        background: { r: 255, g: 0, b: 0 }
      }
    }).jpeg().toFile(testImagePath);

    // Mock the file object Ghost passes to save()
    const file = {
      name: 'test-image.jpg',
      path: testImagePath
    };

    // Upload via adapter
    const savedPath = await adapter.save(file, '2026/01');

    // Verify the returned path format (includes /content/images/ for Ghost)
    expect(savedPath).toMatch(/^\/content\/images\/2026\/01\/test-image-\d+-[a-f0-9]+\.jpg$/);

    // Extract the actual filename from the path
    const filename = path.basename(savedPath);
    const base = path.basename(filename, '.jpg');
    const outputDir = path.join(testDir, '2026/01');

    // Verify original saved
    expect(fs.existsSync(path.join(outputDir, filename))).toBe(true);

    // Verify WebP created
    expect(fs.existsSync(path.join(outputDir, `${base}.webp`))).toBe(true);

    // Verify responsive sizes created (400, 800, 1200 - all smaller than 1600)
    expect(fs.existsSync(path.join(outputDir, 'size/w400', `${base}.webp`))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, 'size/w800', `${base}.webp`))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, 'size/w1200', `${base}.webp`))).toBe(true);

    // Verify WebP is smaller than original
    const originalSize = fs.statSync(path.join(outputDir, filename)).size;
    const webpSize = fs.statSync(path.join(outputDir, `${base}.webp`)).size;
    expect(webpSize).toBeLessThan(originalSize);
  });

  test('edge case: small image skips larger responsive sizes', async () => {
    // Create a small test image (300x200 - smaller than all responsive sizes)
    const sharp = require('sharp');
    const testImagePath = path.join(testDir, 'test-small.jpg');

    await sharp({
      create: {
        width: 300,
        height: 200,
        channels: 3,
        background: { r: 0, g: 255, b: 0 }
      }
    }).jpeg().toFile(testImagePath);

    const file = {
      name: 'small-image.jpg',
      path: testImagePath
    };

    const savedPath = await adapter.save(file, '2026/02');

    const filename = path.basename(savedPath);
    const base = path.basename(filename, '.jpg');
    const outputDir = path.join(testDir, '2026/02');

    // Verify original and WebP saved
    expect(fs.existsSync(path.join(outputDir, filename))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, `${base}.webp`))).toBe(true);

    // Verify NO responsive sizes created (300px is smaller than 400, 800, 1200)
    expect(fs.existsSync(path.join(outputDir, 'size/w400', `${base}.webp`))).toBe(false);
    expect(fs.existsSync(path.join(outputDir, 'size/w800', `${base}.webp`))).toBe(false);
    expect(fs.existsSync(path.join(outputDir, 'size/w1200', `${base}.webp`))).toBe(false);
  });
});
