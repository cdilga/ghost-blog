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
