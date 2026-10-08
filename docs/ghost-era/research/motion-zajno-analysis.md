# Motion Design Research: motion.zajno.com Analysis

**Bead:** ghost-blog-1o7
**Date:** 2026-01-22
**Status:** Complete

## Executive Summary

motion.zajno.com is built on **Webflow** and uses a **lightweight, no-WebGL approach** to achieve impressive motion design. The key insight: **you don't need heavy WebGL for wow factor** - strategic use of CSS animations, Lottie, and smooth scroll libraries delivers excellent results.

## Tech Stack Identified

| Technology | Purpose | Size/Performance |
|------------|---------|------------------|
| **Lenis** | Smooth scroll | ~3KB, high-performance |
| **Lottie** | Complex animations | Vector-based, efficient |
| **Splide** | Carousels/sliders | Lightweight carousel |
| **Webflow Interactions** | Scroll-triggered animations | Native to platform |
| **CSS clip-path** | Masking/reveal effects | GPU-accelerated |

**Key Finding:** No WebGL, Three.js, or heavy 3D libraries detected.

---

## The 8 Motion Design Principles

motion.zajno.com teaches 8 core principles. Here's each one with **specific opportunities for chris.dilger.me**:

### 1. Easing
> "Objects in nature don't move at constant speeds; they accelerate when starting and decelerate when stopping."

| Type | Behavior | Use Case |
|------|----------|----------|
| Linear | Constant speed | Looping animations, progress bars |
| Ease | Slight accel/decel | General UI transitions |
| Ease-in | Slow start → fast | Elements exiting |
| Ease-out | Fast start → slow | Elements entering (most natural) |
| Cubic | Extended curves | Hero animations, dramatic reveals |

**Opportunities:**
- Hero text entrance: `cubic-bezier(0.4, 0, 0.2, 1)` for dramatic feel
- Project cards: `ease-out` for snappy hover response
- Section transitions: longer cubic easing for cinematic feel

### 2. Offset & Delay (Stagger)
> "Staggering the appearance of multiple objects creates softness and directs viewer attention through hierarchy."

**Opportunities:**
- **8 Claude Codes section**: Stagger each terminal appearing (0.1s apart)
- **Project grid**: Cards appear in wave pattern on scroll
- **Hero elements**: Name → title → CTA button in sequence
- **Blog post list**: Stagger article cards

```javascript
// GSAP stagger example
gsap.from('.project-card', {
  opacity: 0,
  y: 30,
  stagger: 0.1,
  ease: 'power2.out'
})
```

### 3. Fade In / Fade Out
> "Most versatile technique for object appearance/disappearance; works best paired with other animation methods."

**Opportunities:**
- **All section entries**: Fade + translate as baseline
- **Image reveals**: Fade in with slight scale
- **Text content**: Fade paragraphs as user scrolls

**Key insight:** Never use fade alone - always pair with transform (translate, scale, or both).

### 4. Transform & Morph
> "One shape smoothly converts into another, maintaining visual continuity."

**Opportunities:**
- **Navigation**: Hamburger → X icon morph
- **Project cards**: Thumbnail morphs into full project view
- **CTA buttons**: Shape morph on hover
- **Logo**: Could morph between states (e.g., typing animation)

```css
/* Icon morph example */
.menu-icon {
  transition: transform 0.3s ease;
}
.menu-icon.open .line1 { transform: rotate(45deg) translate(5px, 5px); }
.menu-icon.open .line2 { opacity: 0; }
.menu-icon.open .line3 { transform: rotate(-45deg) translate(5px, -5px); }
```

### 5. Masking
> "Uses a morphing object as a mask container; internal content can scale, move, or rotate within it."

**Opportunities:**
- **Hero section**: Desert landscape revealed through expanding mask
- **Project previews**: Video plays within masked container
- **Section transitions**: Content revealed through animated clip-path
- **Image hover**: Reveal additional info through mask expansion

```css
/* Mask reveal on scroll */
.hero-image {
  clip-path: circle(0% at 50% 50%);
  transition: clip-path 1.2s cubic-bezier(0.4, 0, 0.2, 1);
}
.hero-image.visible {
  clip-path: circle(100% at 50% 50%);
}
```

### 6. Dimension (Floating Dimensionality)
> "Creates perceived depth, making object interaction intuitive and spatial."

**Opportunities:**
- **Project cards**: Lift on hover with shadow depth
- **Hero layers**: Foreground/background separation
- **Featured content**: "Floating" above the page
- **Mobile accelerometer**: Cards tilt with device movement

```css
/* 3D card lift */
.project-card {
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}
.project-card:hover {
  transform: translateY(-8px) rotateX(2deg);
  box-shadow: 0 20px 40px rgba(0,0,0,0.15);
}
```

### 7. Parallax
> "Layered objects move at different speeds based on distance; farther objects move less."

**Opportunities:**
- **Desert hero**: Sky (slow) → mountains (medium) → foreground (fast)
- **About section**: Background texture moves slower than content
- **Project showcase**: Depth layers on scroll
- **Footer**: Subtle parallax on decorative elements

```javascript
// GSAP ScrollTrigger parallax
gsap.to('.bg-layer', {
  yPercent: -20,
  scrollTrigger: {
    trigger: '.hero',
    scrub: true
  }
})
gsap.to('.fg-layer', {
  yPercent: -50,
  scrollTrigger: {
    trigger: '.hero',
    scrub: true
  }
})
```

### 8. Zoom
> "Provides smooth transitions between interface elements and destinations while communicating depth."

**Opportunities:**
- **Project click**: Zoom into project detail page
- **Image galleries**: Zoom to full-screen view
- **Section focus**: Zoom effect on scroll into section
- **YouTube embed**: Zoom from thumbnail to video player

```javascript
// Zoom transition to detail
gsap.to('.project-card.active', {
  scale: 1.5,
  duration: 0.6,
  ease: 'power2.inOut'
})
```

---

## Principle Application Matrix

| Site Section | Primary Principles | Secondary |
|--------------|-------------------|-----------|
| **Hero** | Parallax, Masking, Easing | Fade, Dimension |
| **8 Claude Codes** | Stagger, Fade | Dimension |
| **Projects** | Dimension, Zoom, Stagger | Transform, Masking |
| **Blog posts** | Fade, Stagger | Easing |
| **YouTube embed** | Zoom, Masking | Dimension |
| **Talks section** | Fade, Stagger, Dimension | Parallax |
| **Footer** | Parallax, Fade | - |

---

## Animation Patterns Catalog

### 1. Page Load Animations
- **Technique:** Staggered fade-in with transforms
- **Implementation:** CSS + Webflow interactions
- **Example:** Hero text fades in with upward translate, elements stagger 0.1-0.2s apart

```css
/* Conceptual approach */
.hero-element {
  opacity: 0;
  transform: translateY(20px);
  animation: fadeInUp 0.6s ease-out forwards;
  animation-delay: var(--stagger);
}
```

### 2. Scroll-Triggered Animations
- **Technique:** Lenis smooth scroll + Intersection Observer
- **Implementation:** Elements animate when entering viewport
- **Key insight:** Lenis preserves native scroll position (unlike Locomotive), works with native scroll APIs

**Recommended setup for our project:**
```javascript
import Lenis from 'lenis'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

const lenis = new Lenis()
lenis.on('scroll', ScrollTrigger.update)
gsap.ticker.add((time) => lenis.raf(time * 1000))
gsap.ticker.lagSmoothing(0)
```

### 3. Hover/Interaction Effects
- **Technique:** CSS transitions (0.3s ease)
- **Implementation:** Transform scale, opacity, underline decoration
- **Example:** Cards scale slightly on hover, underlines slide in

```css
.card-link {
  transition: all 0.3s ease;
}
.card-link:hover {
  transform: scale(1.02);
}
```

### 4. Project Card Animations
- **Technique:** Masked video + hover transforms
- **Implementation:** Thumbnail with video overlay, CSS clip-path reveals
- **3D potential:** Can add `perspective` and `rotateX/Y` on hover without WebGL

**Card structure identified:**
- Thumbnail image (static)
- Video element (plays on hover)
- Hover: slight scale + shadow
- Links to project detail pages

### 5. Section Transitions
- **Technique:** CSS clip-path animations
- **Implementation:** Sections use `clip-path` to create reveal/mask effects
- **Example:** `.section-slide` with animated clip-path

```css
.section-slide {
  clip-path: inset(0 0 100% 0);
  transition: clip-path 0.8s cubic-bezier(0.4, 0, 0.2, 1);
}
.section-slide.visible {
  clip-path: inset(0 0 0 0);
}
```

### 6. Parallax Effects
- **Technique:** Transform translateY at different rates
- **Implementation:** Scroll-linked transforms via GSAP ScrollTrigger
- **No heavy 3D required:** Simple Y-axis translation creates depth

## Key Insights for Our Project

### What We CAN Achieve Without WebGL
1. **Smooth scroll experience** - Lenis (3KB)
2. **Scroll-triggered animations** - GSAP ScrollTrigger
3. **Parallax depth** - CSS transforms
4. **Card hover effects with 3D feel** - CSS perspective + rotateX/Y
5. **Complex illustrations** - Lottie
6. **Reveal/mask effects** - CSS clip-path

### When We WOULD Need WebGL
1. True 3D environments (camera movement through scene)
2. Particle systems with physics
3. Shader effects (ripples, distortions)
4. Real-time 3D model rendering

### Recommendation for chris.dilger.me

Given the BLOG_VISION.md requirements:

| Requirement | Approach | WebGL Needed? |
|-------------|----------|---------------|
| Hero "wow" factor | Lenis + GSAP + CSS transforms | No |
| 8 Claude Codes section | CSS grid + staggered animations | No |
| Project cards with 3D | CSS perspective + rotateX/Y | No |
| YouTube embed with 3D effect | CSS transforms OR simple WebGL | Maybe (can fake it) |
| Desert theme parallax | GSAP ScrollTrigger | No |
| 120fps target | CSS transforms (GPU) | Achievable |

**Bottom line:** Start with Lenis + GSAP + CSS. Add targeted WebGL only for the YouTube 3D effect if CSS faking isn't sufficient.

## Performance Tier (from motion.dev research)

| Tier | Technology | Performance |
|------|------------|-------------|
| S-Tier | CSS animations, Web Animations API | Main thread free |
| A-Tier | GSAP with CSS transforms | Smooth, slight main thread |
| B-Tier | JavaScript-driven (non-transform) | Interruptible |
| C-Tier | Heavy WebGL without optimization | Can cause jank |

**Target:** Stay in S/A tier for most animations.

## Implementation Priority

1. **Phase 1:** Lenis smooth scroll + basic GSAP ScrollTrigger
2. **Phase 2:** Hero parallax with CSS transforms
3. **Phase 3:** Project cards with hover 3D effect
4. **Phase 4:** Section reveals with clip-path
5. **Phase 5:** Evaluate if YouTube needs WebGL or CSS is sufficient

## Sources

- [Lenis GitHub](https://github.com/darkroomengineering/lenis)
- [GSAP ScrollTrigger](https://gsap.com/scroll/)
- [Web Animation Performance Tier List](https://motion.dev/blog/web-animation-performance-tier-list)
- [Lenis + Webflow Integration](https://www.digidop.com/blog/lenis-smooth-scroll)
- [Codrops: 3D Scroll Animations with CSS + GSAP](https://tympanus.net/codrops/2025/11/04/creating-3d-scroll-driven-text-animations-with-css-and-gsap/)
