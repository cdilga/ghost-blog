# Optimized Local Storage Adapter for Ghost

A Ghost storage adapter that automatically optimizes uploaded images using Sharp.

## Features

- Generates WebP versions of uploaded images
- Creates responsive sizes (600, 1000, 1600, 2000px widths)
- Keeps original files for fallback
- Skips sizes larger than the original image
- Compatible with Ghost 5.x

## Installation

### Production (VPS)

1. Copy the adapter to Ghost's content directory:

```bash
cp -r ghost/adapters/storage/optimized-local /var/www/ghost/content/adapters/storage/
```

2. Install dependencies:

```bash
cd /var/www/ghost/content/adapters/storage/optimized-local
npm install
```

3. Configure Ghost in `config.production.json`:

```json
{
  "storage": {
    "active": "optimized-local",
    "optimized-local": {
      "storagePath": "/var/www/ghost/content/images",
      "sizes": [600, 1000, 1600, 2000],
      "quality": 82,
      "keepOriginal": true
    }
  }
}
```

4. Restart Ghost:

```bash
ghost restart
```

### Local Development (Docker)

1. Mount the adapter in docker-compose.yml:

```yaml
volumes:
  - ./ghost/adapters/storage/optimized-local:/var/lib/ghost/content/adapters/storage/optimized-local
```

2. Add Ghost configuration via environment:

```yaml
environment:
  storage__active: optimized-local
  storage__optimized-local__storagePath: /var/lib/ghost/content/images
```

3. Install dependencies in container:

```bash
docker compose exec ghost sh -c "cd /var/lib/ghost/content/adapters/storage/optimized-local && npm install"
```

4. Restart Ghost:

```bash
docker compose restart ghost
```

## Configuration Options

| Option | Default | Description |
|--------|---------|-------------|
| `storagePath` | `/content/images` | Base path for image storage |
| `sizes` | `[600, 1000, 1600, 2000]` | Responsive widths to generate |
| `quality` | `82` | WebP quality (0-100) |
| `keepOriginal` | `true` | Keep original uploaded file |

## Output Structure

When you upload `photo.jpg`, the adapter creates:

```
content/images/2026/01/
├── photo-1706123456-abc123.jpg     # Original
├── photo-1706123456-abc123.webp    # Full-size WebP
└── size/
    ├── w600/photo-1706123456-abc123.webp
    ├── w1000/photo-1706123456-abc123.webp
    ├── w1600/photo-1706123456-abc123.webp
    └── w2000/photo-1706123456-abc123.webp
```

## Using Responsive Images in Theme

In your Ghost theme templates:

```handlebars
<picture>
  <source
    srcset="/content/images/{{img_url feature_image size='w600'}} 600w,
            /content/images/{{img_url feature_image size='w1000'}} 1000w,
            /content/images/{{img_url feature_image size='w1600'}} 1600w"
    sizes="(max-width: 600px) 600px, (max-width: 1000px) 1000px, 1600px"
    type="image/webp">
  <img src="{{feature_image}}" alt="{{title}}" loading="lazy">
</picture>
```

## Troubleshooting

### Sharp installation fails

Sharp requires native dependencies. On Alpine Linux:

```bash
apk add --no-cache vips-dev
```

On Ubuntu/Debian:

```bash
apt-get install -y libvips-dev
```

### Images not optimizing

Check Ghost logs for errors:

```bash
ghost log
# or for Docker
docker compose logs ghost
```

### Permission issues

Ensure the content directory is writable:

```bash
chown -R ghost:ghost /var/www/ghost/content
```
