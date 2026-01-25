#!/usr/bin/env node
/**
 * Migration script for existing Ghost images
 *
 * Processes all existing images in Ghost's content/images directory
 * and generates optimized WebP versions + responsive sizes.
 *
 * Usage:
 *   node scripts/migrate-existing-images.js [options]
 *
 * Options:
 *   --dry-run         Show what would be done without making changes
 *   --content-path    Override content/images path (default: /var/www/ghost/content/images)
 *   --verbose         Show detailed output
 *   --skip-responsive Skip generating responsive sizes (only create WebP)
 *
 * Examples:
 *   # Dry run on production
 *   node scripts/migrate-existing-images.js --dry-run
 *
 *   # Run migration
 *   node scripts/migrate-existing-images.js
 *
 *   # Custom path for local testing
 *   node scripts/migrate-existing-images.js --content-path ./test-images
 */

const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const { glob } = require('glob');

// Configuration
const DEFAULT_CONTENT_PATH = '/var/www/ghost/content/images';
const SIZES = [600, 1000, 1600, 2000];
const QUALITY = 82;

// Parse CLI arguments
const args = process.argv.slice(2);
const options = {
  dryRun: args.includes('--dry-run'),
  verbose: args.includes('--verbose'),
  skipResponsive: args.includes('--skip-responsive'),
  contentPath: getArgValue('--content-path') || DEFAULT_CONTENT_PATH
};

function getArgValue(flag) {
  const index = args.indexOf(flag);
  if (index !== -1 && args[index + 1]) {
    return args[index + 1];
  }
  return null;
}

// Stats tracking
const stats = {
  found: 0,
  processed: 0,
  skipped: 0,
  errors: 0,
  totalSourceBytes: 0,
  totalOutputBytes: 0
};

function log(message, level = 'info') {
  if (level === 'verbose' && !options.verbose) return;
  const prefix = {
    info: '\x1b[36mℹ\x1b[0m',
    success: '\x1b[32m✓\x1b[0m',
    warning: '\x1b[33m⚠\x1b[0m',
    error: '\x1b[31m✗\x1b[0m',
    verbose: '\x1b[90m·\x1b[0m',
    progress: '\x1b[35m→\x1b[0m'
  }[level] || '';
  console.log(`${prefix} ${message}`);
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

async function processImage(imagePath) {
  const dir = path.dirname(imagePath);
  const ext = path.extname(imagePath);
  const base = path.basename(imagePath, ext);
  const sourceSize = fs.statSync(imagePath).size;
  stats.totalSourceBytes += sourceSize;

  log(`Processing: ${path.relative(options.contentPath, imagePath)}`, 'progress');

  // Get image metadata to avoid enlarging small images
  let metadata;
  try {
    metadata = await sharp(imagePath).metadata();
  } catch (err) {
    log(`  Could not read metadata: ${err.message}`, 'warning');
    stats.errors++;
    return;
  }

  // Generate full-size WebP
  const webpPath = path.join(dir, `${base}.webp`);
  if (!fs.existsSync(webpPath)) {
    if (!options.dryRun) {
      try {
        await sharp(imagePath)
          .webp({ quality: QUALITY })
          .toFile(webpPath);

        const outSize = fs.statSync(webpPath).size;
        stats.totalOutputBytes += outSize;
        log(`  Created: ${base}.webp (${formatBytes(outSize)})`, 'verbose');
        stats.processed++;
      } catch (err) {
        log(`  Error creating WebP: ${err.message}`, 'error');
        stats.errors++;
      }
    } else {
      log(`  Would create: ${base}.webp`, 'verbose');
      stats.processed++;
    }
  } else {
    log(`  Skipped: ${base}.webp (exists)`, 'verbose');
    stats.skipped++;
  }

  // Generate responsive sizes
  if (!options.skipResponsive) {
    for (const width of SIZES) {
      // Skip if width is larger than original
      if (width >= metadata.width) {
        log(`  Skipped: w${width} (source is ${metadata.width}px wide)`, 'verbose');
        continue;
      }

      const sizeDir = path.join(dir, 'size', `w${width}`);
      const sizePath = path.join(sizeDir, `${base}.webp`);

      if (!fs.existsSync(sizePath)) {
        if (!options.dryRun) {
          try {
            // Ensure directory exists
            if (!fs.existsSync(sizeDir)) {
              fs.mkdirSync(sizeDir, { recursive: true });
            }

            await sharp(imagePath)
              .resize(width, null, { withoutEnlargement: true })
              .webp({ quality: QUALITY })
              .toFile(sizePath);

            const outSize = fs.statSync(sizePath).size;
            stats.totalOutputBytes += outSize;
            log(`  Created: size/w${width}/${base}.webp (${formatBytes(outSize)})`, 'verbose');
            stats.processed++;
          } catch (err) {
            log(`  Error creating w${width}: ${err.message}`, 'error');
            stats.errors++;
          }
        } else {
          log(`  Would create: size/w${width}/${base}.webp`, 'verbose');
          stats.processed++;
        }
      } else {
        log(`  Skipped: w${width} (exists)`, 'verbose');
        stats.skipped++;
      }
    }
  }
}

async function main() {
  console.log('\n\x1b[1mGhost Image Migration\x1b[0m');
  console.log('─'.repeat(50));

  if (options.dryRun) {
    log('Dry run mode - no files will be modified', 'warning');
  }

  log(`Content path: ${options.contentPath}`, 'info');
  log(`Sizes: ${SIZES.join(', ')}`, 'info');
  log(`Quality: ${QUALITY}`, 'info');

  // Check if content path exists
  if (!fs.existsSync(options.contentPath)) {
    log(`Content path not found: ${options.contentPath}`, 'error');
    log('Use --content-path to specify a different path', 'info');
    process.exit(1);
  }

  // Find all source images (include uppercase extensions)
  const patterns = ['**/*.jpg', '**/*.jpeg', '**/*.png', '**/*.JPG', '**/*.JPEG', '**/*.PNG'];
  const ignorePatterns = [
    '**/size/**',      // Skip already-resized images
    '**/*.webp'        // Skip WebP files
  ];

  let sourceFiles = [];
  for (const pattern of patterns) {
    const matches = await glob(pattern, {
      cwd: options.contentPath,
      ignore: ignorePatterns,
      nodir: true,
      absolute: true
    });
    sourceFiles.push(...matches);
  }

  // Deduplicate and sort
  sourceFiles = [...new Set(sourceFiles)].sort();
  stats.found = sourceFiles.length;

  if (sourceFiles.length === 0) {
    log('No source images found to migrate', 'info');
    return;
  }

  console.log('─'.repeat(50));
  log(`Found ${sourceFiles.length} source image(s) to process`, 'info');
  console.log('─'.repeat(50));

  // Process each image
  let count = 0;
  for (const file of sourceFiles) {
    count++;
    if (!options.verbose) {
      process.stdout.write(`\r  Processing ${count}/${sourceFiles.length}...`);
    }
    try {
      await processImage(file);
    } catch (err) {
      log(`Error processing ${file}: ${err.message}`, 'error');
      stats.errors++;
    }
  }

  if (!options.verbose) {
    process.stdout.write('\r' + ' '.repeat(50) + '\r');
  }

  // Summary
  console.log('─'.repeat(50));
  log(`Found: ${stats.found} source image(s)`, 'info');

  if (stats.processed > 0) {
    log(`${options.dryRun ? 'Would process' : 'Processed'}: ${stats.processed} file(s)`, 'success');
  }
  if (stats.skipped > 0) {
    log(`Skipped: ${stats.skipped} file(s) (already exist)`, 'info');
  }
  if (stats.errors > 0) {
    log(`Errors: ${stats.errors}`, 'error');
  }

  if (!options.dryRun && stats.totalSourceBytes > 0 && stats.totalOutputBytes > 0) {
    const savings = stats.totalSourceBytes - stats.totalOutputBytes;
    if (savings > 0) {
      const percent = ((savings / stats.totalSourceBytes) * 100).toFixed(1);
      log(`Storage used by new files: ${formatBytes(stats.totalOutputBytes)}`, 'info');
    }
  }

  console.log();

  if (options.dryRun) {
    log('Run without --dry-run to apply changes', 'info');
  }

  // Exit with error code if there were errors
  if (stats.errors > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  log(`Fatal error: ${err.message}`, 'error');
  process.exit(1);
});
