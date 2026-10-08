# Looping Video Stabilization Guide

A guide for creating seamlessly looping, tripod-stable video from handheld footage using ffmpeg and vidstab.

## The Problem

When stabilizing video for seamless loops, standard approaches fail because:
1. **Loop discontinuity**: Stabilization algorithms have no context at video boundaries, causing visible jumps
2. **Edge artifacts**: Frame shifting creates black bars or interpolation artifacts
3. **Dynamic zoom**: Auto-zoom features cause distracting in/out movement
4. **Particle confusion**: Dust, sand, or small moving elements confuse motion tracking

## The Solution: Doubled Video Technique

The key insight: **duplicate the video before stabilization, then extract the middle portion**.

```
Original:     [====A====]
Doubled:      [====A====][====A====]
After stab:   [====A'===][====A'===]
Extract:          [====MIDDLE====]
```

This works because:
1. The original loop point is now in the **middle** of the doubled video
2. Stabilization algorithms have full context on both sides of the loop point
3. Extracting the middle gives you a video where transitions were stabilized optimally

## Prerequisites

Install ffmpeg with vidstab support:

```bash
# macOS (Homebrew)
brew tap homebrew-ffmpeg/ffmpeg
brew install homebrew-ffmpeg/ffmpeg/ffmpeg --with-libvidstab

# Verify installation
ffmpeg -filters 2>&1 | grep vidstab
# Should show: vidstabdetect, vidstabtransform
```

## Complete Pipeline

### Step 1: Analyze Source for Stable Segments (Optional)

If your source has varying stability, find the most stable segment:

```python
import cv2
import numpy as np

cap = cv2.VideoCapture('source.mp4')
fps = cap.get(cv2.CAP_PROP_FPS)
scores = []
prev_frame = None

while True:
    ret, frame = cap.read()
    if not ret:
        break
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    gray_small = cv2.resize(gray, (320, 180))

    if prev_frame is not None:
        diff = np.mean(np.abs(gray_small.astype(float) - prev_frame.astype(float)))
        scores.append(diff)
    prev_frame = gray_small

cap.release()

# Find most stable 5-second window
window = int(5 * fps)
best_start = min(range(len(scores) - window),
                 key=lambda i: sum(scores[i:i+window]))
print(f"Most stable segment: {best_start/fps:.1f}s - {(best_start+window)/fps:.1f}s")
```

### Step 2: Trim to Desired Segment

```bash
ffmpeg -y -i source.mp4 -ss 4.4 -t 5 \
  -c:v libx264 -crf 16 -preset slow \
  /tmp/trimmed.mp4
```

### Step 3: Create Doubled Video

```bash
# Create concat list
cat > /tmp/double_list.txt << 'EOF'
file '/tmp/trimmed.mp4'
file '/tmp/trimmed.mp4'
EOF

# Concatenate
ffmpeg -y -f concat -safe 0 -i /tmp/double_list.txt \
  -c:v libx264 -crf 16 -preset slow \
  /tmp/doubled.mp4
```

### Step 4: Vidstab Pass 1 - Detect Motion

```bash
ffmpeg -y -i /tmp/doubled.mp4 \
  -vf "vidstabdetect=shakiness=8:accuracy=15:result=/tmp/transforms.trf" \
  -f null -
```

**Key parameters:**
- `shakiness=8`: Expected shake level (1-10, higher = more aggressive detection)
- `accuracy=15`: Analysis accuracy (1-15, higher = better but slower)

### Step 5: Vidstab Pass 2 - Apply Stabilization

```bash
ffmpeg -y -i /tmp/doubled.mp4 \
  -vf "vidstabtransform=input=/tmp/transforms.trf:smoothing=0:optzoom=0:zoom=0:interpol=bicubic:crop=keep" \
  -c:v libx264 -crf 16 -preset slow \
  /tmp/stabilized.mp4
```

**Critical settings to avoid artifacts:**

| Setting | Value | Why |
|---------|-------|-----|
| `smoothing=0` | 0 | Locks frame instantly; non-zero causes drift over time |
| `optzoom=0` | 0 | Disables dynamic zoom; prevents in/out movement |
| `zoom=0` | 0 | No fixed zoom (or use small value like 2-5 if needed) |
| `interpol=bicubic` | bicubic | Better quality than default bilinear |
| `crop=keep` | keep | Mirrors edges instead of black bars |

### Step 6: Extract Middle Portion

```bash
# For a 5-second source (doubled = 10s), extract middle 5s
ffmpeg -y -i /tmp/stabilized.mp4 \
  -ss 2.5 -t 5 \
  -c:v libx264 -crf 18 -preset slow \
  output.mp4
```

### Step 7: Create WebM Version (Optional)

```bash
ffmpeg -y -i output.mp4 \
  -c:v libvpx-vp9 -crf 24 -b:v 0 \
  output.webm
```

**Note:** WebM/VP9 supports alpha channel if needed; H.264/MP4 does not.

## Common Pitfalls & Solutions

### Black Bars at Edges

**Cause:** Stabilization shifts frames, leaving black borders.

**Solutions:**
- Use `crop=keep` to mirror edges
- Add fixed zoom with `zoom=5` (5% crop)
- Avoid `crop=black` which shows the black bars

### Dynamic Zoom (In/Out Movement)

**Cause:** `optzoom=2` adjusts zoom per-frame to fill the frame.

**Solution:** Use `optzoom=0` with fixed or no zoom.

### Blocky Artifacts on Detailed Areas

**Cause:** Frame interpolation when shifting.

**Solutions:**
- Use `interpol=bicubic` (better than default)
- Use `crop=keep` instead of zoom-based cropping
- Reduce stabilization aggressiveness

### Stabilization Drift Over Time

**Cause:** Non-zero smoothing allows gradual position shift.

**Solution:** Use `smoothing=0` to lock each frame instantly.

### Visible Loop Jump

**Cause:** Stabilization has no context at video boundaries.

**Solution:** Use the doubled video technique described above.

### Dust/Particles Confusing Tracking

**Cause:** Small moving elements (dust, sand, rain) detected as camera motion.

**Solutions:**
- Accept some limitation here
- Doubled video technique minimizes impact at loop point
- Higher `shakiness` value may help distinguish camera shake from particles

## Quality Settings Reference

### CRF (Constant Rate Factor)

Lower = better quality, larger file:
- `crf 16-18`: High quality, good for source/intermediate
- `crf 20-23`: Good quality, reasonable file size
- `crf 24-28`: Acceptable quality, smaller files

### Presets

Slower = better compression, same quality:
- `preset slow`: Good balance for final output
- `preset medium`: Faster encoding, slightly larger files
- `preset veryslow`: Best compression, very slow

## Example: Full Pipeline Script

```bash
#!/bin/bash
set -e

INPUT="$1"
OUTPUT="${2:-stabilized.mp4}"
DURATION="${3:-5}"

# Temp directory
TMP=$(mktemp -d)
trap "rm -rf $TMP" EXIT

echo "Step 1: Trimming to ${DURATION}s..."
ffmpeg -y -i "$INPUT" -t "$DURATION" \
  -c:v libx264 -crf 16 -preset slow \
  "$TMP/trimmed.mp4"

echo "Step 2: Creating doubled video..."
cat > "$TMP/list.txt" << EOF
file '$TMP/trimmed.mp4'
file '$TMP/trimmed.mp4'
EOF
ffmpeg -y -f concat -safe 0 -i "$TMP/list.txt" \
  -c:v libx264 -crf 16 "$TMP/doubled.mp4"

echo "Step 3: Vidstab pass 1 - detecting motion..."
ffmpeg -y -i "$TMP/doubled.mp4" \
  -vf "vidstabdetect=shakiness=8:accuracy=15:result=$TMP/transforms.trf" \
  -f null -

echo "Step 4: Vidstab pass 2 - applying stabilization..."
ffmpeg -y -i "$TMP/doubled.mp4" \
  -vf "vidstabtransform=input=$TMP/transforms.trf:smoothing=0:optzoom=0:zoom=0:interpol=bicubic:crop=keep" \
  -c:v libx264 -crf 16 -preset slow \
  "$TMP/stabilized.mp4"

echo "Step 5: Extracting middle portion..."
HALF=$(echo "$DURATION / 2" | bc -l)
ffmpeg -y -i "$TMP/stabilized.mp4" \
  -ss "$HALF" -t "$DURATION" \
  -c:v libx264 -crf 18 -preset slow \
  "$OUTPUT"

echo "Done: $OUTPUT"
```

Usage:
```bash
./stabilize-loop.sh input.mp4 output.mp4 5
```

## Alternative: Light Deshake (Simpler, Less Powerful)

For minor shake, single-pass deshake may suffice:

```bash
ffmpeg -y -i input.mp4 \
  -vf "deshake=rx=32:ry=32:edge=1" \
  -c:v libx264 -crf 18 \
  output.mp4
```

**Settings:**
- `rx/ry`: Max shift in pixels (32 is moderate)
- `edge=1`: Mirror edges (avoids black bars)

**Tradeoff:** Less powerful stabilization, but fewer artifacts.

## Credits

Developed through iterative experimentation for the chris.dilger.me Ghost blog windswept video section.
