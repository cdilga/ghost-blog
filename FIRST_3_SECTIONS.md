# First Three Sections: Architectural Analysis & Implementation Guide

> **Tracking Issue:** `ghost-blog-cog` - SVG windswept particle mask transition system

This document expands upon [LANDING_PAGE_SKETCH.md](LANDING_PAGE_SKETCH.md) to address specific architectural issues in the Hero → Coder → Claude Codes transition sequence.

## Current Problems Identified

| # | Problem | Root Cause |
|---|---------|------------|
| 1 | Particle mask appears as straight line, not organic particles | SVG clipPath particles positioned along edge but merge visually |
| 2 | Depth map issues on 2nd canvas (Claude Codes) | Section CSS covers canvas with solid background |
| 3 | Foreground content scrolls normally, no choreography | Missing pinned scroll-captured timeline for Claude Codes |
| 4 | Content barely readable when appearing | No staging/timing—elements fade simultaneously |
| 5 | Header text has unnecessary black underlay | CSS `.scene__header` styling artifact |

---

## Problem 1: Particle Mask Appears as Straight Line

### Current Implementation (`windswept-mask.js`)

```javascript
// Current particle positioning
const cx = edgeX + (p.offsetX * CONFIG.scatterWidth);  // scatterWidth = 60px
const cy = p.y * viewportHeight;
```

The particles ARE being created (300 circles), but they appear as a straight line because:

1. **Insufficient scatter width**: 60px scatter on a 1920px+ viewport is barely visible
2. **Particles centered on edge**: `offsetX` ranges -1 to 1, centering particles ON the line
3. **No varying particle opacity**: All particles are solid, creating hard edge
4. **Uniform radius distribution**: Particles don't create organic density variation

### Required Fix

The PRD specifies: _"Organic, sand-grain edge with particles naturally varying in density"_

```javascript
// REQUIRED: Particles should extend AHEAD of the edge (into revealed area)
const CONFIG = {
    particleCount: 500,          // MORE particles for organic feel
    particleSizeMin: 2,          // Smaller minimum for fine grain
    particleSizeMax: 20,         // Larger max for variety
    scatterWidth: 150,           // WIDER scatter
    leadingParticles: 80,        // Particles that extend AHEAD of edge
    trailingParticles: 40        // Particles that lag BEHIND edge
};

// Particles should have:
// - Leading particles (cx = edgeX + positive offset) - extend into revealed area
// - Trailing particles (cx = edgeX + negative offset) - blend with unrevealed area
// - Varied opacity based on distance from edge
```

### Visual Reference

```
PRD Specification:
                    ┌─ Leading particles (sand grains blown ahead)
                    │
    ████████████  ○ ○  ○    ← Organic edge
    ████████████ ○  ○ ○ ○
    ████████████  ○○ ○  ○
    ████████████ ○ ○  ○
                    │
                    └─ Edge moves right-to-left (wind direction)

Current Implementation:
    ████████████|            ← Hard vertical line
    ████████████|
    ████████████|
    ████████████|
```

---

## Problem 2: Depth Map Issues on Claude Codes Canvas

### Current Architecture

```
hero-depth.js       → Creates #depth-canvas-hero-coder (fixed, z-index: -1)
claude-codes-depth.js → Creates #depth-canvas-claude-codes (absolute in section)
windswept-mask.js   → Transitions between them
```

### The Problem

The `.scene--claude-codes` section has CSS that covers the depth canvas:

```css
.scene--claude-codes {
    background: var(--color-bg);  /* Solid background COVERS the canvas */
    position: relative;
    min-height: 100vh;
}
```

When `windswept-mask.js` reveals canvas #2, it's hidden BEHIND the section's solid background.

### Required Fix

During the transition, the section background must be transparent:

```javascript
// windswept-mask.js already attempts this:
claudeCodesSection.style.backgroundColor = 'transparent';
```

But the canvas is positioned `absolute` within the section. During transition it needs to be:
- `position: fixed` (viewport-relative)
- `z-index: 1` (above page content, below hero-coder canvas)
- Section background: `transparent`

**After transition completes**, canvas should remain as section background (not switch back to CSS background).

---

## Problem 3: Foreground Content Has No Choreography

### This is the CRITICAL architectural issue

### Current Implementation (`main.js`)

```javascript
function initSceneAnimations() {
    // Basic scroll-triggered fades - NOT choreographed
    ScrollTrigger.create({
        trigger: scene,
        start: 'top 80%',
        end: 'bottom 20%',
        toggleClass: 'in-view',
        toggleActions: 'play none none none'  // ← Fire once, no scrubbing
    });
}
```

### What the PRD Requires

From `LANDING_PAGE_SKETCH.md`:

```
| ❌ NOT This (Scroll-Triggered) | ✅ THIS (Scroll-Captured) |
|-------------------------------|---------------------------|
| Page scrolls normally         | Page is **PINNED** (doesn't move) |
| Elements fade in when visible | Scroll **DRIVES** animation frame-by-frame |
```

### Required Architecture

The Claude Codes section needs **scroll-captured choreography**:

```javascript
// REQUIRED: Pinned scroll-captured timeline
ScrollTrigger.create({
    trigger: '.scene--claude-codes',
    start: 'top top',
    end: '+=200%',           // 2 viewport heights of scroll distance
    pin: true,               // PAGE STAYS PINNED
    scrub: 1,                // Scroll DRIVES animation
    onUpdate: (self) => {
        // self.progress drives the timeline (0 to 1)
        updateClaudeCodesTimeline(self.progress);
    }
});
```

### Content Entry Choreography

Per the PRD, terminals should:

1. **Spawn from navbar** (dock-style animation) ← `terminal-spawn.js` attempts this
2. **Stagger in with easing** (back.out bounce)
3. **Sequential typing animation** starts after spawn completes
4. **Scene header fades in** after terminals are in position

Current issue: `terminal-spawn.js` calculates offsets but the section isn't pinned, so the animation fights with scroll position.

---

## Problem 4: Content Barely Readable

### Root Cause

Elements fade in simultaneously without staging. The PRD specifies:

> "Each piece of content should have its moment"

### Required Staging

```
Timeline Position | Element                    | Animation
------------------|----------------------------|---------------------------
0.0 - 0.3         | Depth canvas #2 revealed   | Windswept mask transition
0.2 - 0.5         | Terminals spawn            | Dock-style with stagger
0.4 - 0.6         | Scene header appears       | Fade + slide up
0.5 - 0.8         | Terminal typing begins     | Sequential per terminal
0.7 - 1.0         | Terminal glow effects      | Pulse animation
```

Each element gets dedicated screen time. Scroll controls pace—user can pause at any point.

---

## Problem 5: Header Black Underlay

### Current CSS (likely)

```css
.scene__header {
    background: linear-gradient(to bottom, rgba(0,0,0,0.8), transparent);
    /* or */
    text-shadow: 0 2px 10px rgba(0,0,0,0.8);
}
```

### Fix

Remove the underlay. The depth-map canvas provides sufficient contrast. If readability is an issue, use subtle text-shadow only:

```css
.scene__header {
    text-shadow: 0 1px 3px rgba(0,0,0,0.3);
    background: transparent;
}
```

---

## Correct Section Architecture

### Section 1: Hero (Current: ✓ Working)

```
┌─────────────────────────────────────────────────────┐
│  [Fixed Canvas #1: depth-canvas-hero-coder]         │
│  z-index: -1                                        │
│  Responds to: MotionInput + Scroll parallax         │
├─────────────────────────────────────────────────────┤
│  Hero Content (logo, tagline, scroll indicator)     │
│  z-index: 1                                         │
│  Animation: Title reveal, parallax layers           │
└─────────────────────────────────────────────────────┘
```

### Section 2: Coder (Current: ✓ Mostly Working)

```
┌─────────────────────────────────────────────────────┐
│  [Same Fixed Canvas #1 continues as background]     │
│  Same depth-map effect                              │
├─────────────────────────────────────────────────────┤
│  Coder Content (keyboard, code, github graph)       │
│  z-index: 1                                         │
│  Animation: Elements stagger in with scroll         │
└─────────────────────────────────────────────────────┘
│                                                     │
│  TRANSITION ZONE (bottom of Coder → top of Claude)  │
│  Windswept mask reveals Canvas #2 beneath Canvas #1 │
│                                                     │
```

### Section 3: Claude Codes (Current: ✗ Broken)

**Required architecture:**

```
┌─────────────────────────────────────────────────────┐
│  [Fixed Canvas #2: depth-canvas-claude-codes]       │
│  z-index: -1 (after transition completes)           │
│  Responds to: MotionInput + Scroll parallax         │
├─────────────────────────────────────────────────────┤
│  PINNED VIEWPORT (scroll drives timeline, not page) │
│                                                     │
│  Timeline:                                          │
│  0.0-0.3: Background fully revealed                 │
│  0.2-0.5: 8 terminals spawn from navbar             │
│  0.4-0.6: Scene header fades in                     │
│  0.5-1.0: Terminal typing animations                │
│                                                     │
│  After pin releases: normal scroll continues        │
└─────────────────────────────────────────────────────┘
```

---

## Implementation Priority

| Priority | Task | Blocks |
|----------|------|--------|
| 1 | Fix section CSS to allow transparent background | All canvas visibility |
| 2 | Implement pinned scroll-captured choreography for Claude Codes | Content staging |
| 3 | Fix particle scatter to create organic edge | Visual polish |
| 4 | Stage terminal spawn within pinned timeline | Readability |
| 5 | Remove header underlay | Visual polish |

---

## Code Changes Required

### 1. `style.css` - Section Background

```css
.scene--claude-codes {
    background: transparent;  /* Canvas provides background */
    position: relative;
    min-height: 100vh;
}

.scene--claude-codes::before {
    /* NO pseudo-element background */
    display: none;
}
```

### 2. `main.js` - Pinned Choreography

Add new function:

```javascript
function initClaudeCodesChoreography() {
    const scene = document.querySelector('.scene--claude-codes');
    const terminals = scene.querySelectorAll('.terminal');
    const header = scene.querySelector('.scene__header');

    // Master timeline - scroll-captured
    const masterTL = gsap.timeline({
        scrollTrigger: {
            trigger: scene,
            start: 'top top',
            end: '+=150%',  // 1.5 viewport heights of scroll
            pin: true,
            scrub: 1,
            anticipatePin: 1
        }
    });

    // Stage 1: Terminals spawn (0.0 - 0.5)
    terminals.forEach((terminal, i) => {
        masterTL.from(terminal, {
            scale: 0.1,
            opacity: 0,
            y: -window.innerHeight * 0.5,
            ease: 'back.out(1.4)',
            duration: 0.08
        }, i * 0.02);
    });

    // Stage 2: Header appears (0.4 - 0.6)
    masterTL.from(header, {
        opacity: 0,
        y: 30,
        duration: 0.2
    }, 0.4);

    // Stage 3: Terminal typing (handled by initChaosTerminals on timeline)
}
```

### 3. `windswept-mask.js` - Organic Particles

```javascript
function generateParticleData() {
    // ... existing code ...

    // Add leading/trailing distribution
    const isLeading = Math.random() > 0.6;  // 40% lead ahead of edge
    const offsetMultiplier = isLeading ? 1.5 : -0.5;
    const offsetX = (Math.random() * offsetMultiplier);

    // Vary opacity based on distance
    const opacity = 1 - (Math.abs(offsetX) / 2);

    particles.push({ y, offsetX, r, opacity });
}
```

---

## Testing Checklist

Before closing related issues:

- [ ] Canvas #2 visible through section (no CSS background covering it)
- [ ] Particle edge has organic, scattered appearance (not straight line)
- [ ] Claude Codes section PINS on scroll (page doesn't move)
- [ ] Terminals spawn sequentially within pinned timeline
- [ ] Header appears after terminals, no black underlay
- [ ] Content has dedicated "moments" - not simultaneous fade
- [ ] Scroll pace controls animation timeline (scrub behavior)
- [ ] `npm test` passes (no console errors)

---

## Reference: Motion Principles Applied

From PRD Section "8 Motion Principles":

| Principle | Application in Claude Codes Section |
|-----------|-------------------------------------|
| Easing | `back.out(1.4)` for terminal spawn bounce |
| Stagger | 0.02s delay between each terminal |
| Fade | Header uses opacity transition |
| Transform | Terminals scale from 0.1 to 1 |
| Masking | Windswept particle edge reveals background |
| Dimension | Depth-map parallax on background canvas |
| Parallax | Canvas responds to MotionInput during section |
| Zoom | Terminal spawn from small to full size |
