'use strict';

const path = require('path');
const fs = require('fs').promises;
const { existsSync, createReadStream, mkdirSync } = require('fs');
const sharp = require('sharp');
const crypto = require('crypto');
const StorageBase = require('ghost-storage-base');

/**
 * Ghost storage adapter with Sharp-based image optimization
 *
 * Generates optimized WebP versions and responsive sizes on upload.
 * Keeps original for fallback.
 */
class OptimizedLocalStorage extends StorageBase {
  constructor(config = {}) {
    super(config);

    // Base storage path (typically /var/lib/ghost/content/images in container)
    this.storagePath = config.storagePath || path.join(process.cwd(), 'content', 'images');

    // Responsive sizes to generate
    this.sizes = config.sizes || [600, 1000, 1600, 2000];

    // WebP quality (0-100, 80-85 is good balance)
    this.quality = config.quality || 82;

    // Whether to keep original file
    this.keepOriginal = config.keepOriginal !== false;

    // Image extensions we can optimize
    this.optimizableExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.tiff', '.webp'];

    // Ensure storage directory exists
    if (!existsSync(this.storagePath)) {
      mkdirSync(this.storagePath, { recursive: true });
    }
  }

  /**
   * Check if file is an image we can optimize
   */
  isOptimizable(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return this.optimizableExtensions.includes(ext);
  }

  /**
   * Generate a unique filename to avoid collisions
   */
  getUniqueFileName(originalName) {
    const ext = path.extname(originalName);
    const base = path.basename(originalName, ext);
    const timestamp = Date.now();
    const random = crypto.randomBytes(4).toString('hex');
    return `${base}-${timestamp}-${random}${ext}`;
  }

  /**
   * Get the target directory for a given date
   * Returns format: YYYY/MM
   */
  getTargetDir(targetDir) {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return targetDir || `${year}/${month}`;
  }

  /**
   * Save uploaded file with optimization
   */
  async save(file, targetDir) {
    const dir = this.getTargetDir(targetDir);
    const uniqueName = this.getUniqueFileName(file.name);
    const fullDir = path.join(this.storagePath, dir);
    const fullPath = path.join(fullDir, uniqueName);

    // Ensure directory exists
    await fs.mkdir(fullDir, { recursive: true });

    // Read the uploaded file
    const buffer = await fs.readFile(file.path);

    // Always save original
    if (this.keepOriginal) {
      await fs.writeFile(fullPath, buffer);
    }

    // Generate optimized versions if it's an image
    if (this.isOptimizable(file.name)) {
      try {
        await this.generateOptimizedVersions(buffer, fullDir, uniqueName);
        // Return WebP URL for optimized images
        const ext = path.extname(uniqueName);
        const base = path.basename(uniqueName, ext);
        return `/content/images/${dir}/${base}.webp`;
      } catch (err) {
        console.error('Error optimizing image:', err.message);
        // Fall through to return original URL if optimization fails
      }
    }

    // Return original URL for non-optimizable files or if optimization failed
    return `/content/images/${dir}/${uniqueName}`;
  }

  /**
   * Generate WebP and responsive sizes
   */
  async generateOptimizedVersions(buffer, dir, filename) {
    const ext = path.extname(filename);
    const base = path.basename(filename, ext);

    // Get image metadata to avoid enlarging
    const metadata = await sharp(buffer).metadata();

    // Generate full-size WebP
    const webpPath = path.join(dir, `${base}.webp`);
    await sharp(buffer)
      .webp({ quality: this.quality })
      .toFile(webpPath);

    // Generate responsive sizes
    const sizesDir = path.join(dir, 'size');
    await fs.mkdir(sizesDir, { recursive: true });

    for (const width of this.sizes) {
      // Skip sizes larger than original
      if (width >= metadata.width) continue;

      const sizeDir = path.join(sizesDir, `w${width}`);
      await fs.mkdir(sizeDir, { recursive: true });

      // Generate WebP at this size
      const sizePath = path.join(sizeDir, `${base}.webp`);
      await sharp(buffer)
        .resize(width, null, { withoutEnlargement: true })
        .webp({ quality: this.quality })
        .toFile(sizePath);
    }
  }

  /**
   * Check if a file exists
   */
  async exists(fileName, targetDir) {
    const dir = this.getTargetDir(targetDir);
    const filePath = path.join(this.storagePath, dir, fileName);

    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get a readable stream for serving files
   * Automatically serves WebP when browser supports it
   */
  serve() {
    return (req, res, next) => {
      // URL-decode and remove leading slash
      let filePath = decodeURIComponent(req.path);
      if (filePath.startsWith('/')) {
        filePath = filePath.slice(1);
      }

      const ext = path.extname(filePath).toLowerCase();
      const base = path.basename(filePath, ext);
      const dir = path.dirname(filePath);

      // Check if browser supports WebP
      const acceptsWebP = req.headers.accept && req.headers.accept.includes('image/webp');

      // For images that can be optimized, try to serve WebP if browser supports it
      if (acceptsWebP && this.optimizableExtensions.includes(ext) && ext !== '.webp') {
        const webpPath = path.join(this.storagePath, dir, `${base}.webp`);
        if (existsSync(webpPath)) {
          res.setHeader('Content-Type', 'image/webp');
          res.setHeader('Vary', 'Accept'); // Important for caching
          const stream = createReadStream(webpPath);
          return stream.pipe(res);
        }
      }

      // Serve original file
      const fullPath = path.join(this.storagePath, filePath);

      if (existsSync(fullPath)) {
        const mimeTypes = {
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.png': 'image/png',
          '.gif': 'image/gif',
          '.webp': 'image/webp',
          '.svg': 'image/svg+xml'
        };
        if (mimeTypes[ext]) {
          res.setHeader('Content-Type', mimeTypes[ext]);
        }

        const stream = createReadStream(fullPath);
        stream.pipe(res);
      } else {
        next();
      }
    };
  }

  /**
   * Read file contents
   */
  async read(options = {}) {
    const filePath = path.join(this.storagePath, options.path);

    try {
      return await fs.readFile(filePath);
    } catch (err) {
      return Promise.reject(new Error(`Could not read file: ${options.path}`));
    }
  }

  /**
   * Delete a file and its optimized versions
   */
  async delete(fileName, targetDir) {
    const dir = this.getTargetDir(targetDir);
    const basePath = path.join(this.storagePath, dir);
    const ext = path.extname(fileName);
    const base = path.basename(fileName, ext);

    // Delete original
    const originalPath = path.join(basePath, fileName);
    if (existsSync(originalPath)) {
      await fs.unlink(originalPath);
    }

    // Delete WebP version
    const webpPath = path.join(basePath, `${base}.webp`);
    if (existsSync(webpPath)) {
      await fs.unlink(webpPath);
    }

    // Delete responsive sizes
    for (const width of this.sizes) {
      const sizePath = path.join(basePath, 'size', `w${width}`, `${base}.webp`);
      if (existsSync(sizePath)) {
        await fs.unlink(sizePath);
      }
    }

    return true;
  }
}

module.exports = OptimizedLocalStorage;
