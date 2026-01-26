/**
 * Image optimization configuration
 * Used by scripts/optimize-images.js for build-time optimization
 */
module.exports = {
  // Source directory for theme images
  sourceDir: 'themes/chris-theme/assets/images',

  // Output formats
  formats: {
    webp: { quality: 82 },
    // Keep original format as fallback (jpg/png)
    original: { quality: 85 }
  },

  // Context-specific settings
  // Each context defines sizes and quality for different use cases
  contexts: {
    // Hero/banner images - large, high quality
    hero: {
      pattern: '**/hero-*',
      sizes: [640, 1280, 1920, 2560],
      quality: { webp: 85, original: 90 }
    },

    // Card/thumbnail images - medium sizes
    cards: {
      pattern: '**/card-*',
      sizes: [400, 800, 1200],
      quality: { webp: 80, original: 85 }
    },

    // Project/portfolio images
    projects: {
      pattern: '**/project-*',
      sizes: [400, 800, 1200, 1600],
      quality: { webp: 82, original: 87 }
    },

    // Default for uncategorized images
    default: {
      pattern: '**/*',
      sizes: [640, 1280, 1920],
      quality: { webp: 82, original: 85 }
    }
  },

  // Files/patterns to ignore
  ignore: [
    '**/.*',           // Hidden files
    '**/*.webp',       // Already optimized
    '**/optimized/**', // Output directory
    '**/*-optimized.*' // Already processed
  ],

  // Output structure
  // true = flat (image-640.webp), false = nested (size/w640/image.webp)
  flatOutput: true,

  // Skip processing if output newer than source
  incrementalBuild: true,

  // Report savings after optimization
  reportSavings: true
};
