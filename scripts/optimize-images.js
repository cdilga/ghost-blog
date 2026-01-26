#!/usr/bin/env node
/**
 * Theme image build-time optimization script
 * Generates WebP and responsive sizes for all theme images using Sharp
 *
 * Usage:
 *   node scripts/optimize-images.js [options]
 *
 * Options:
 *   --dry-run     Show what would be done without making changes
 *   --force       Regenerate all images even if up to date
 *   --verbose     Show detailed output
 */

const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const { glob } = require('glob');
const { minimatch } = require('minimatch');

// Load configuration
const configPath = path.join(process.cwd(), 'optimize.config.js');
const config = fs.existsSync(configPath)
  ? require(configPath)
  : getDefaultConfig();

// Parse CLI arguments
const args = process.argv.slice(2);
const options = {
  dryRun: args.includes('--dry-run'),
  force: args.includes('--force'),
  verbose: args.includes('--verbose')
};

// Stats tracking
const stats = {
  processed: 0,
  skipped: 0,
  errors: 0,
  totalSourceBytes: 0,
  totalOutputBytes: 0
};

function getDefaultConfig() {
  return {
    sourceDir: 'themes/chris-theme/assets/images',
    formats: { webp: { quality: 82 } },
    contexts: {
      default: {
        pattern: '**/*',
        sizes: [640, 1280, 1920],
        quality: { webp: 82, original: 85 }
      }
    },
    ignore: ['**/.*', '**/*.webp'],
    flatOutput: true,
    incrementalBuild: true,
    reportSavings: true
  };
}

function log(message, level = 'info') {
  if (level === 'verbose' && !options.verbose) return;
  const prefix = {
    info: '\x1b[36mℹ\x1b[0m',
    success: '\x1b[32m✓\x1b[0m',
    warning: '\x1b[33m⚠\x1b[0m',
    error: '\x1b[31m✗\x1b[0m',
    verbose: '\x1b[90m·\x1b[0m'
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

function getContextForFile(filename) {
  for (const [name, ctx] of Object.entries(config.contexts)) {
    if (name === 'default') continue;
    if (minimatch(filename, ctx.pattern)) {
      return { name, ...ctx };
    }
  }
  return { name: 'default', ...config.contexts.default };
}

function getOutputPath(sourcePath, size, format) {
  const dir = path.dirname(sourcePath);
  const ext = path.extname(sourcePath);
  const name = path.basename(sourcePath, ext);

  if (config.flatOutput) {
    // image.jpg -> image-1280.webp
    const suffix = size ? `-${size}` : '';
    const newExt = format === 'webp' ? '.webp' : ext;
    return path.join(dir, `${name}${suffix}${newExt}`);
  } else {
    // image.jpg -> size/w1280/image.webp
    const sizeDir = size ? path.join(dir, 'size', `w${size}`) : dir;
    const newExt = format === 'webp' ? '.webp' : ext;
    return path.join(sizeDir, `${name}${newExt}`);
  }
}

function shouldSkip(sourcePath, outputPath) {
  if (options.force) return false;
  if (!config.incrementalBuild) return false;
  if (!fs.existsSync(outputPath)) return false;

  const sourceStat = fs.statSync(sourcePath);
  const outputStat = fs.statSync(outputPath);
  return outputStat.mtime > sourceStat.mtime;
}

async function processImage(sourcePath) {
  const relPath = path.relative(config.sourceDir, sourcePath);
  const context = getContextForFile(relPath);
  const sourceSize = fs.statSync(sourcePath).size;
  stats.totalSourceBytes += sourceSize;

  log(`Processing: ${relPath} (${context.name} context)`, 'verbose');

  const sourceExt = path.extname(sourcePath).toLowerCase();
  const isJpeg = ['.jpg', '.jpeg'].includes(sourceExt);
  const isPng = sourceExt === '.png';

  // Generate WebP version at original size
  const webpPath = getOutputPath(sourcePath, null, 'webp');
  if (!shouldSkip(sourcePath, webpPath)) {
    if (!options.dryRun) {
      const dir = path.dirname(webpPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      await sharp(sourcePath)
        .webp({ quality: context.quality?.webp || config.formats.webp.quality })
        .toFile(webpPath);

      const outSize = fs.statSync(webpPath).size;
      stats.totalOutputBytes += outSize;
      log(`  Created: ${path.basename(webpPath)} (${formatBytes(outSize)})`, 'verbose');
    } else {
      log(`  Would create: ${path.basename(webpPath)}`, 'verbose');
    }
    stats.processed++;
  } else {
    stats.skipped++;
    log(`  Skipped: ${path.basename(webpPath)} (up to date)`, 'verbose');
  }

  // Generate responsive sizes
  for (const width of context.sizes) {
    // WebP at this size
    const sizedWebpPath = getOutputPath(sourcePath, width, 'webp');
    if (!shouldSkip(sourcePath, sizedWebpPath)) {
      if (!options.dryRun) {
        const dir = path.dirname(sizedWebpPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        await sharp(sourcePath)
          .resize(width, null, { withoutEnlargement: true })
          .webp({ quality: context.quality?.webp || config.formats.webp.quality })
          .toFile(sizedWebpPath);

        const outSize = fs.statSync(sizedWebpPath).size;
        stats.totalOutputBytes += outSize;
        log(`  Created: ${path.basename(sizedWebpPath)} (${formatBytes(outSize)})`, 'verbose');
      } else {
        log(`  Would create: ${path.basename(sizedWebpPath)}`, 'verbose');
      }
      stats.processed++;
    } else {
      stats.skipped++;
    }
  }
}

async function main() {
  console.log('\n\x1b[1mTheme Image Optimization\x1b[0m');
  console.log('─'.repeat(40));

  if (options.dryRun) {
    log('Dry run mode - no files will be modified', 'warning');
  }

  // Check if source directory exists
  if (!fs.existsSync(config.sourceDir)) {
    log(`Source directory not found: ${config.sourceDir}`, 'warning');
    log('Creating directory...', 'info');
    if (!options.dryRun) {
      fs.mkdirSync(config.sourceDir, { recursive: true });
    }
    log('No images to process. Add images to get started.', 'info');
    return;
  }

  // Find source images
  const patterns = ['**/*.jpg', '**/*.jpeg', '**/*.png'];
  const ignorePatterns = config.ignore || [];

  let sourceFiles = [];
  for (const pattern of patterns) {
    const matches = await glob(pattern, {
      cwd: config.sourceDir,
      ignore: ignorePatterns,
      nodir: true
    });
    sourceFiles.push(...matches.map(f => path.join(config.sourceDir, f)));
  }

  // Deduplicate
  sourceFiles = [...new Set(sourceFiles)];

  if (sourceFiles.length === 0) {
    log('No source images found', 'info');
    log(`Add jpg/png images to: ${config.sourceDir}`, 'info');
    return;
  }

  log(`Found ${sourceFiles.length} source image(s)`, 'info');

  // Process each image
  for (const file of sourceFiles) {
    try {
      await processImage(file);
    } catch (err) {
      log(`Error processing ${file}: ${err.message}`, 'error');
      stats.errors++;
    }
  }

  // Report
  console.log('─'.repeat(40));

  if (stats.processed > 0) {
    log(`Processed: ${stats.processed} file(s)`, 'success');
  }
  if (stats.skipped > 0) {
    log(`Skipped: ${stats.skipped} file(s) (already up to date)`, 'info');
  }
  if (stats.errors > 0) {
    log(`Errors: ${stats.errors}`, 'error');
  }

  if (config.reportSavings && stats.totalSourceBytes > 0 && stats.totalOutputBytes > 0) {
    const savings = stats.totalSourceBytes - stats.totalOutputBytes;
    const percent = ((savings / stats.totalSourceBytes) * 100).toFixed(1);
    if (savings > 0) {
      log(`Size reduction: ${formatBytes(savings)} saved (${percent}% smaller)`, 'success');
    }
  }

  console.log();

  // Exit with error code if there were errors
  if (stats.errors > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  log(`Fatal error: ${err.message}`, 'error');
  process.exit(1);
});
