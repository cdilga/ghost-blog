#!/usr/bin/env node
/**
 * Migration script for existing Ghost images
 *
 * Processes all existing images in Ghost's content/images directory,
 * generates optimized WebP versions + responsive sizes, and optionally
 * updates the Ghost database to reference the new WebP files.
 *
 * Usage:
 *   node scripts/migrate-existing-images.js [options]
 *
 * Options:
 *   --dry-run           Show what would be done without making changes
 *   --content-path      Override content/images path (default: /var/www/ghost/content/images)
 *   --verbose           Show detailed output
 *   --skip-responsive   Skip generating responsive sizes (only create WebP)
 *   --update-database   Update Ghost database to use WebP paths
 *   --db-host           MySQL host (default: 127.0.0.1)
 *   --db-user           MySQL user (required for --update-database)
 *   --db-password       MySQL password (required for --update-database)
 *   --db-name           MySQL database name (default: ghost_prod)
 *
 * Examples:
 *   # Dry run - preview file changes
 *   node scripts/migrate-existing-images.js --dry-run
 *
 *   # Create WebP files only (no database changes)
 *   node scripts/migrate-existing-images.js --content-path /var/www/ghost/content/images
 *
 *   # Full migration with database update
 *   node scripts/migrate-existing-images.js \
 *     --content-path /var/www/ghost/content/images \
 *     --update-database \
 *     --db-user ghost-508 \
 *     --db-password "yourpassword" \
 *     --db-name ghost_prod
 *
 *   # Dry run with database preview
 *   node scripts/migrate-existing-images.js --dry-run --update-database --db-user ghost --db-password pass
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
  updateDatabase: args.includes('--update-database'),
  contentPath: getArgValue('--content-path') || DEFAULT_CONTENT_PATH,
  dbHost: getArgValue('--db-host') || '127.0.0.1',
  dbUser: getArgValue('--db-user'),
  dbPassword: getArgValue('--db-password'),
  dbName: getArgValue('--db-name') || 'ghost_prod'
};

function getArgValue(flag) {
  const index = args.indexOf(flag);
  if (index !== -1 && args[index + 1] && !args[index + 1].startsWith('--')) {
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
  dbUpdates: 0,
  totalSourceBytes: 0,
  totalOutputBytes: 0
};

// Track created WebP files for database update
const createdWebpFiles = new Map(); // originalPath -> webpPath

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

/**
 * Convert an image path to its WebP equivalent
 * /content/images/2019/09/photo.jpg -> /content/images/2019/09/photo.webp
 */
function toWebpPath(imagePath) {
  return imagePath.replace(/\.(jpg|jpeg|png)$/i, '.webp');
}

/**
 * Check if a WebP version exists for a given image path
 */
function webpExists(contentPath, relativePath) {
  const webpRelative = toWebpPath(relativePath);
  const fullPath = path.join(contentPath, webpRelative);
  return fs.existsSync(fullPath);
}

async function processImage(imagePath) {
  const dir = path.dirname(imagePath);
  const ext = path.extname(imagePath);
  const base = path.basename(imagePath, ext);
  const sourceSize = fs.statSync(imagePath).size;
  stats.totalSourceBytes += sourceSize;

  // Track relative path for database update
  const relativePath = path.relative(options.contentPath, imagePath);

  log(`Processing: ${relativePath}`, 'progress');

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

        // Track for database update
        createdWebpFiles.set(relativePath, toWebpPath(relativePath));
      } catch (err) {
        log(`  Error creating WebP: ${err.message}`, 'error');
        stats.errors++;
      }
    } else {
      log(`  Would create: ${base}.webp`, 'verbose');
      stats.processed++;
      createdWebpFiles.set(relativePath, toWebpPath(relativePath));
    }
  } else {
    log(`  Skipped: ${base}.webp (exists)`, 'verbose');
    stats.skipped++;
    // Still track existing WebP for database update
    createdWebpFiles.set(relativePath, toWebpPath(relativePath));
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

/**
 * Update Ghost database to use WebP paths
 * Uses safe, individual updates instead of regex replace
 */
async function updateDatabase() {
  if (!options.dbUser || !options.dbPassword) {
    log('Database credentials required for --update-database', 'error');
    log('Use --db-user and --db-password flags', 'info');
    process.exit(1);
  }

  let mysql;
  try {
    mysql = require('mysql2/promise');
  } catch (err) {
    log('mysql2 package required for database updates', 'error');
    log('Run: npm install mysql2', 'info');
    process.exit(1);
  }

  console.log('─'.repeat(50));
  log('Updating Ghost database...', 'info');

  const conn = await mysql.createConnection({
    host: options.dbHost,
    user: options.dbUser,
    password: options.dbPassword,
    database: options.dbName
  });

  try {
    // Build list of path replacements we can safely make
    // Only replace paths where we verified WebP exists
    const replacements = [];

    for (const [original, webp] of createdWebpFiles) {
      // Skip if WebP doesn't actually exist (safety check)
      const webpFullPath = path.join(options.contentPath, webp);
      if (!options.dryRun && !fs.existsSync(webpFullPath)) {
        log(`  Skipping ${original}: WebP not found`, 'verbose');
        continue;
      }

      // Build the content/images paths (what's stored in DB)
      const originalDbPath = `/content/images/${original}`;
      const webpDbPath = `/content/images/${webp}`;

      replacements.push({ original: originalDbPath, webp: webpDbPath });
    }

    log(`Found ${replacements.length} paths to update`, 'info');

    // Update posts table - feature_image
    for (const { original, webp } of replacements) {
      const [result] = await conn.execute(
        'UPDATE posts SET feature_image = REPLACE(feature_image, ?, ?) WHERE feature_image LIKE ?',
        [original, webp, `%${original}%`]
      );
      if (result.affectedRows > 0) {
        log(`  Updated feature_image: ${original} -> ${webp} (${result.affectedRows} rows)`, 'verbose');
        stats.dbUpdates += result.affectedRows;
      }
    }

    // Update posts table - html content
    // Do this carefully, one path at a time
    for (const { original, webp } of replacements) {
      if (!options.dryRun) {
        const [result] = await conn.execute(
          'UPDATE posts SET html = REPLACE(html, ?, ?) WHERE html LIKE ?',
          [original, webp, `%${original}%`]
        );
        if (result.affectedRows > 0) {
          log(`  Updated html: ${path.basename(original)} (${result.affectedRows} rows)`, 'verbose');
          stats.dbUpdates += result.affectedRows;
        }
      }
    }

    // Update posts table - mobiledoc content
    for (const { original, webp } of replacements) {
      if (!options.dryRun) {
        const [result] = await conn.execute(
          'UPDATE posts SET mobiledoc = REPLACE(mobiledoc, ?, ?) WHERE mobiledoc LIKE ?',
          [original, webp, `%${original}%`]
        );
        if (result.affectedRows > 0) {
          log(`  Updated mobiledoc: ${path.basename(original)} (${result.affectedRows} rows)`, 'verbose');
          stats.dbUpdates += result.affectedRows;
        }
      }
    }

    // Update settings table - cover_image, og_image, twitter_image
    // But NOT icon/favicon (keep as PNG for browser compatibility)
    for (const { original, webp } of replacements) {
      if (!options.dryRun) {
        const [result] = await conn.execute(
          `UPDATE settings SET value = REPLACE(value, ?, ?)
           WHERE \`key\` IN ('cover_image', 'og_image', 'twitter_image')
           AND value LIKE ?`,
          [original, webp, `%${original}%`]
        );
        if (result.affectedRows > 0) {
          log(`  Updated settings: ${path.basename(original)}`, 'verbose');
          stats.dbUpdates += result.affectedRows;
        }
      }
    }

    if (options.dryRun) {
      log(`Would update ${replacements.length} image paths in database`, 'info');
    } else {
      log(`Database updates complete: ${stats.dbUpdates} total changes`, 'success');
    }

  } finally {
    await conn.end();
  }
}

async function main() {
  console.log('\n\x1b[1mGhost Image Migration\x1b[0m');
  console.log('─'.repeat(50));

  if (options.dryRun) {
    log('Dry run mode - no changes will be made', 'warning');
  }

  log(`Content path: ${options.contentPath}`, 'info');
  log(`Sizes: ${SIZES.join(', ')}`, 'info');
  log(`Quality: ${QUALITY}`, 'info');
  if (options.updateDatabase) {
    log(`Database: ${options.dbName}@${options.dbHost}`, 'info');
  }

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

  // Process each image (create WebP files)
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

  // Summary for file processing
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
    log(`Storage used by new files: ${formatBytes(stats.totalOutputBytes)}`, 'info');
  }

  // Update database if requested
  if (options.updateDatabase) {
    await updateDatabase();
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
