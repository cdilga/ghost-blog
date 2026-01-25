# Theme Image Workflow

This document covers how to work with images in the Ghost theme.

## Overview

The project uses Sharp for image optimization at multiple stages:
- **Theme images**: Optimized at build time before deployment
- **Ghost uploads**: Optimized on upload via custom storage adapter
- **Existing images**: One-time migration for legacy content

## Adding Theme Images

Theme images are static assets bundled with the theme (logos, icons, decorative images).

### Workflow

1. Add source image (jpg/png) to `themes/chris-theme/assets/images/`
2. Run `npm run images:optimize`
3. Optimized versions are generated automatically
4. Commit **both** source and optimized files

### Naming Conventions

Use prefixes to get context-specific optimization:

| Prefix | Use Case | Generated Sizes |
|--------|----------|-----------------|
| `hero-*` | Hero/banner images | 640, 1280, 1920, 2560 |
| `card-*` | Card thumbnails | 400, 800, 1200 |
| `project-*` | Portfolio images | 400, 800, 1200, 1600 |
| Other | Default settings | 640, 1280, 1920 |

### Example

```bash
# Add a hero image
cp ~/photos/banner.jpg themes/chris-theme/assets/images/hero-landing.jpg

# Optimize
npm run images:optimize

# Check output
ls themes/chris-theme/assets/images/hero-landing*
# hero-landing.jpg       (original)
# hero-landing.webp      (full-size WebP)
# hero-landing-640.webp  (responsive)
# hero-landing-1280.webp
# hero-landing-1920.webp
# hero-landing-2560.webp
```

## Using Images in Templates

### With picture element (recommended)

```handlebars
<picture>
  <source srcset="{{asset 'images/hero-landing-1920.webp'}} 1920w,
                  {{asset 'images/hero-landing-1280.webp'}} 1280w,
                  {{asset 'images/hero-landing-640.webp'}} 640w"
          sizes="100vw"
          type="image/webp">
  <img src="{{asset 'images/hero-landing.jpg'}}"
       alt="Landing hero"
       loading="lazy">
</picture>
```

### Simple usage (WebP only)

```handlebars
<img src="{{asset 'images/card-feature.webp'}}"
     alt="Feature card"
     loading="lazy">
```

### With sizes attribute

```handlebars
<picture>
  <source srcset="{{asset 'images/card-project-800.webp'}} 800w,
                  {{asset 'images/card-project-400.webp'}} 400w"
          sizes="(max-width: 768px) 100vw, 400px"
          type="image/webp">
  <img src="{{asset 'images/card-project.jpg'}}" alt="Project">
</picture>
```

## Available Commands

| Command | Description |
|---------|-------------|
| `npm run images:optimize` | Optimize all theme images |
| `npm run images:optimize:verbose` | Optimize with detailed output |
| `npm run images:optimize:force` | Force regenerate all (ignore cache) |
| `npm run images:dry-run` | Preview changes without modifying files |

## Configuration

Edit `optimize.config.js` to customize:

```javascript
module.exports = {
  // Source directory
  sourceDir: 'themes/chris-theme/assets/images',

  // Context-specific settings
  contexts: {
    hero: {
      pattern: '**/hero-*',
      sizes: [640, 1280, 1920, 2560],
      quality: { webp: 85, original: 90 }
    },
    cards: {
      pattern: '**/card-*',
      sizes: [400, 800, 1200],
      quality: { webp: 80, original: 85 }
    },
    // ...
  },

  // Files to ignore
  ignore: ['**/.*', '**/*.webp'],

  // Skip unchanged files
  incrementalBuild: true
};
```

### Quality Settings Rationale

| Quality | Use Case | Notes |
|---------|----------|-------|
| 80-82 | Cards, thumbnails | Smaller files, less detail needed |
| 85 | Hero images | Balance of quality and size |
| 90 | High-detail photos | When quality is critical |

WebP typically achieves 25-35% smaller files than JPEG at equivalent quality.

## Ghost Uploads (Editor Images)

Images uploaded through the Ghost editor are automatically optimized by the custom storage adapter (when deployed).

### Output Structure

When you upload `photo.jpg`:

```
content/images/2026/01/
├── photo-1706xxx-abc.jpg      # Original
├── photo-1706xxx-abc.webp     # Full-size WebP
└── size/
    ├── w600/photo-1706xxx-abc.webp
    ├── w1000/photo-1706xxx-abc.webp
    ├── w1600/photo-1706xxx-abc.webp
    └── w2000/photo-1706xxx-abc.webp
```

### Storage Adapter Deployment

See `ghost/adapters/storage/optimized-local/README.md` for deployment instructions.

## Migrating Existing Images

For existing Ghost images that weren't optimized on upload:

```bash
# Preview changes
npm run images:migrate:dry-run

# Run migration (on server)
node scripts/migrate-existing-images.js --content-path /var/www/ghost/content/images
```

### Safety Notes

- Non-destructive: originals are preserved
- Idempotent: safe to run multiple times
- Skips already-processed images

## Troubleshooting

### Sharp Installation Issues

On Alpine Linux (Docker):
```bash
apk add --no-cache vips-dev
```

On Ubuntu/Debian:
```bash
apt-get install -y libvips-dev
```

On macOS:
```bash
brew install vips
```

### Images Not Generating

1. Check source format is jpg/jpeg/png
2. Check file isn't in ignore patterns
3. Run with `--verbose` to see details
4. Check file permissions

### WebP Not Supported in Browser

The `<picture>` element automatically falls back to the original format when WebP isn't supported. Always include the original as the `<img>` fallback.

## CI/CD Integration

Image optimization runs automatically:
- `prepackage` hook optimizes before `npm run package`
- No additional CI configuration needed

For production deployment:
1. Theme images are optimized locally before commit
2. Storage adapter handles new uploads on the server
3. Migration script is run once on existing content
