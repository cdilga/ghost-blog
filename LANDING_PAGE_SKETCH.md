# Landing Page PRD (Product Requirements Document)

> **This is the canonical source of truth.** All implementation should match this spec.
> Reference: research/motion-zajno-analysis.md for motion design principles.

## Design System
- **Theme**: Australian Desert / Outdoors
- **Accent Color**: Orange (#FF6B35)
- **Style**: Ultra clean, minimal, high-performance
- **Target**: 120fps CSS/GPU rendering, "WOW" factor on first load
- **Approach**: CSS 3D transforms + GSAP (NO WebGL) - proven by motion.zajno.com research
- **Motion**: ALL 8 motion principles required (Easing, Stagger, Fade, Transform/Morph, Masking, Dimension, Parallax, Zoom) - see research/motion-zajno-analysis.md

---

## Performance Requirements (Non-Negotiable)

### Smoothness
- **Frame rate**: 60fps minimum, 120fps target on capable devices
- **Scroll**: Buttery smooth, no jank or stuttering
- **Animations**: Hardware-accelerated (GPU), use `transform` and `opacity`
- **Transitions**: Eased, natural feeling (no linear/robotic motion)
- **No layout thrashing**: Avoid reflows during animations

### Loading (ULTRA OPTIMIZED)
- **First Paint**: INSTANT - milliseconds, not seconds. Static content displays immediately.
- **LCP**: < 2.5s (Largest Contentful Paint)
- **FID**: < 100ms (First Input Delay)
- **CLS**: < 0.1 (Cumulative Layout Shift)
- **Progressive enhancement**: Core content works without JS, fancy features enhance
- **Lazy loading**: Below-fold content, videos, heavy assets
- **Priority loading**: Features load in scroll order (hero first, footer last)
- **Non-blocking**: All fancy features (face tracking, animations, etc.) load async/deferred
- **Critical CSS**: Inline above-fold styles, defer the rest

### Graceful Degradation
- Reduce motion for `prefers-reduced-motion`
- Fallback to simpler animations on low-end devices
- CSS-only approach means broad browser support

---

## Mobile Requirements (Non-Negotiable)

### Responsive Design
- **Mobile-first**: Design for mobile, enhance for desktop
- **Breakpoints**: 375px (mobile), 768px (tablet), 1024px+ (desktop)
- **Touch targets**: Minimum 44x44px for interactive elements
- **No horizontal scroll**: Content fits viewport width

### Touch Interactions
- **Swipe**: Natural scroll, swipe gestures where appropriate
- **Tap**: Responsive feedback on tap (no 300ms delay)
- **Pinch-zoom**: Don't disable, ensure it works cleanly
- **Accelerometer**: Project cards tilt with device (optional enhancement)

### Performance on Mobile
- **Battery conscious**: Pause animations when tab not visible
- **Data conscious**: Lazy load videos, offer lower-res options
- **Memory conscious**: Limit active animations, use Intersection Observer

### Testing Targets
- iPhone SE (small screen baseline)
- iPhone 14/15 Pro (modern iOS)
- Pixel 7 (modern Android)
- iPad (tablet layout)

---

## Page Structure

```
┌─────────────────────────────────────────────────────────────────┐
│                           HEADER                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  CHRIS DILGER          [Home] [About] [Projects] [Blog] │   │
│  └─────────────────────────────────────────────────────────┘   │
│  - Transparent overlay on hero, solid on scroll                 │
│  - Mobile: hamburger menu with Transform/Morph animation        │
│  - Sticky on desktop, hide-on-scroll-down on mobile            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│                    HERO / SCROLLYTELLING                        │
│                    (Full CSS 3D Experience)                     │
│                                                                 │
│    ┌─────────────────────────────────────────────────────┐     │
│    │                                                     │     │
│    │         Desert landscape / nature backdrop          │     │
│    │              with parallax depth                    │     │
│    │                                                     │     │
│    │    ┌───────────────────────────────────────┐       │     │
│    │    │                                       │       │     │
│    │    │      "CHRIS DILGER"                   │       │     │
│    │    │       Software Engineer               │       │     │
│    │    │                                       │       │     │
│    │    └───────────────────────────────────────┘       │     │
│    │                                                     │     │
│    └─────────────────────────────────────────────────────┘     │
│                                                                 │
│                        ↓ SCROLL ↓                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  SCROLLYTELLING SCENES (as user scrolls)                        │
│                                                                 │
│  Scene 1: THE CODER                                             │
│  ┌──────────────────────────────────────┐                      │
│  │  ⌨️ Animated typing keyboard          │ → Links to X.com    │
│  │  Code flowing on screen              │                      │
│  │  GitHub activity visualization       │                      │
│  └──────────────────────────────────────┘                      │
│                                                                 │
│  Scene 2: 8 CLAUDE CODES                                        │
│  ┌──────────────────────────────────────┐                      │
│  │  ┌──┐ ┌──┐ ┌──┐ ┌──┐                │                      │
│  │  │CC│ │CC│ │CC│ │CC│  (terminals    │                      │
│  │  └──┘ └──┘ └──┘ └──┘   working in   │                      │
│  │  ┌──┐ ┌──┐ ┌──┐ ┌──┐   parallel)    │                      │
│  │  │CC│ │CC│ │CC│ │CC│                │                      │
│  │  └──┘ └──┘ └──┘ └──┘                │                      │
│  └──────────────────────────────────────┘                      │
│                                                                 │
│  Scene 3: THE CONTENT CREATOR                                   │
│  ┌──────────────────────────────────────┐                      │
│  │  📹 3D YouTube embed (actual video)  │ → Clickable embed   │
│  │  Floating/tilted with perspective    │                      │
│  │  Recent video playing                │                      │
│  └──────────────────────────────────────┘                      │
│                                                                 │
│  Scene 4: THE SPEAKER                                           │
│  ┌──────────────────────────────────────┐                      │
│  │  🎤 Photos/clips of talks            │                      │
│  │  Conference logos                    │                      │
│  │  "Available for speaking"            │                      │
│  └──────────────────────────────────────┘                      │
│                                                                 │
│  Scene 5: THE CONSULTANT                                        │
│  ┌──────────────────────────────────────┐                      │
│  │  🏢 Enterprise consulting work       │                      │
│  │  Real experience (from LinkedIn)     │                      │
│  │  Problem → Solution narrative        │                      │
│  └──────────────────────────────────────┘                      │
│                                                                 │
│  Scene 6: THE TEACHER                                           │
│  ┌──────────────────────────────────────┐                      │
│  │  👨‍🏫 Teaching/mentoring showcase     │                      │
│  │  Data Engineering Bootcamp exp       │                      │
│  │  Generic Zoom meeting visual         │                      │
│  │  "Available for tutoring" CTA        │                      │
│  └──────────────────────────────────────┘                      │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│                      PROJECTS SECTION                           │
│                                                                 │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐           │
│   │ ░░░░░░░░░░░ │  │ ░░░░░░░░░░░ │  │ ░░░░░░░░░░░ │           │
│   │ ░ PROJECT ░ │  │ ░ PROJECT ░ │  │ ░ PROJECT ░ │           │
│   │ ░░░░░░░░░░░ │  │ ░░░░░░░░░░░ │  │ ░░░░░░░░░░░ │           │
│   │             │  │             │  │             │           │
│   │  Title      │  │  Title      │  │  Title      │           │
│   │  [GH] [Live]│  │  [GH] [Live]│  │  [YT] [Live]│           │
│   └─────────────┘  └─────────────┘  └─────────────┘           │
│                                                                 │
│   Features:                                                     │
│   - Hover: Preview animations                                   │
│   - Mobile: Accelerometer-driven movement                       │
│   - Config-driven (GitHub sourced)                              │
│   - Links: Code repo / Live site / YouTube demo                 │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│                    TOP ARTICLES SECTION                         │
│                                                                 │
│   ┌─────────────────────────────────────────────────────┐      │
│   │                                                     │      │
│   │  📝 Featured Article                                │      │
│   │  ──────────────────────────────────────────────    │      │
│   │  Title of the article                               │      │
│   │  Brief excerpt...                                   │      │
│   │                                                     │      │
│   │  [▶ YouTube] [𝕏 Thread] [GitHub]                   │      │
│   │                                                     │      │
│   └─────────────────────────────────────────────────────┘      │
│                                                                 │
│   ┌────────────────┐  ┌────────────────┐                       │
│   │ Article Card   │  │ Article Card   │                       │
│   │ + YouTube      │  │ + X.com embed  │                       │
│   │ + GitHub embed │  │ + Rich preview │                       │
│   └────────────────┘  └────────────────┘                       │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│                     DEV PLAYGROUND                              │
│                     (*.dev projects)                            │
│                                                                 │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│   │ project  │  │ project  │  │ project  │  │ project  │      │
│   │ .dev     │  │ .dev     │  │ .dev     │  │ .dev     │      │
│   └──────────┘  └──────────┘  └──────────┘  └──────────┘      │
│                                                                 │
│   "Experiments & works in progress"                             │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│                    SOCIAL / CONNECT                             │
│                                                                 │
│        [𝕏 Twitter]  [YouTube]  [LinkedIn]  [GitHub]            │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│              INFINITE BLOG CAROUSEL (Scroll-Hijack)             │
│                      "All My Writing"                           │
│                                                                 │
│   Visual: Circular wheel of blog posts rotating horizontally    │
│                                                                 │
│      ░░░                                                  ░░░   │
│     ░░░░░    ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ░░░░░  │
│    ░░░░░░░   │ POST 1 │ │ POST 2 │ │ POST 3 │ │ POST 4 │░░░░░░░ │
│   FADE←      │  ───   │ │  ───   │ │  ───   │ │  ───   │  →FADE │
│    ░░░░░░░   │ title  │ │ title  │ │ title  │ │ title  │░░░░░░░ │
│     ░░░░░    │ excerpt│ │ excerpt│ │ excerpt│ │ excerpt│ ░░░░░  │
│      ░░░     └────────┘ └────────┘ └────────┘ └────────┘  ░░░   │
│                                                                 │
│              ◄──── SCROLL TO ROTATE WHEEL ────►                 │
│                                                                 │
│   Behavior:                                                     │
│   - Scroll-hijack: vertical scroll → horizontal carousel        │
│   - Infinite loop: posts wrap seamlessly                        │
│   - Velocity-based: fast scroll = fast spin, momentum decay     │
│   - Click-through: tap any card to read full post               │
│   - Mobile: swipe gestures, touch velocity tracking             │
│                                                                 │
│   Visual Effects:                                               │
│   - Curved 3D perspective (posts on a cylinder)                 │
│   - Edge fade: 30% opacity gradient on left/right               │
│   - Center focus: active card slightly larger, full opacity     │
│   - Smooth easing on start/stop                                 │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│                    AMBIENT VIDEO FOOTER                         │
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │  │
│   │  ░░░░░░░░░ WINDSWEPT SAND DUNE VIDEO ░░░░░░░░░░░░░░░░░  │  │
│   │  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │  │
│   └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│   - Ultra slow motion (playbackRate: 0.5)                       │
│   - Ambient, subtle background                                  │
│   - Autoplay, muted, loop                                       │
│   - Lazy load, pause when off-screen                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Content Specification (Required)

### Social Links
All platforms use username: **cdilga**
- X/Twitter: https://x.com/cdilga
- YouTube: https://youtube.com/@cdilga
- LinkedIn: https://linkedin.com/in/cdilga
- GitHub: https://github.com/cdilga

### YouTube Embed (Scene 3)
- Channel: youtube.com/@cdilga
- Video: Use featured/pinned video (fallback: uVwReaMfQSQ)
- NOT: dQw4w9WgXcQ (placeholder)

### Projects to Feature
Source: github.com/cdilga (polished repos only)
- **multiplayer-racer** - Multiplayer racing game
- **ladder-logic-editor** - PLC ladder logic editor
- **exquisite-corpse** - Collaborative drawing game
- **checkface.me** - (sunset project, feature at end)

NOT to feature:
- chris.dilger.me (this IS the site)
- Unfinished/WIP repos

### Consultant Content
Source from LinkedIn (linkedin.com/in/cdilga):
- Real consulting experience
- Actual technologies used
- NOT generic "DevOps transformation" clichés

### Teacher Content
- Data Engineering Bootcamp experience
- Use generic Zoom meeting placeholder (no bootcamp assets)

---

## Target Audiences & Funnels

| Visitor Type | What They See | Conversion Goal |
|--------------|---------------|-----------------|
| **Recruiter** | Hero + Projects + Skills | "Wow, cool programmer" → Contact |
| **Talk Organizer** | Speaker section + Talks | "This guy presents well" → Book |
| **Client** | Consulting + Projects | "Can fix my problem" → Hire |
| **Dev Community** | Projects + Dev Playground | "Cool project" → Follow/Star |

---

## Motion Design Requirements

> Reference: research/motion-zajno-analysis.md for detailed implementation

### 8 Motion Principles (from research)
1. **Easing** - Natural acceleration/deceleration (cubic-bezier)
2. **Stagger** - Sequential element appearance (0.1s offsets)
3. **Fade** - Always paired with transform, never alone
4. **Transform/Morph** - Shape transitions (hamburger → X)
5. **Masking** - Reveal effects via clip-path
6. **Dimension** - Depth via shadows, perspective, lift
7. **Parallax** - Layered movement at different speeds
8. **Zoom** - Scale transitions for focus/detail

### Section-Specific Requirements

| Section | Primary Principles | Secondary | Notes |
|---------|-------------------|-----------|-------|
| **Header** | Transform/Morph | Fade | Hamburger icon animation |
| **Hero** | Parallax, Masking, Easing | Fade, Dimension | Entry: mask reveal (clip-path expanding) |
| **8 Claude Codes** | Stagger, Fade | Dimension | 0.1s stagger between terminals |
| **Content Creator** | **Zoom, Masking** | Dimension | NOT just static rotation - needs zoom + reveal |
| **Speaker** | Fade, Stagger, Dimension | Parallax | Photo gallery stagger |
| **Consultant** | Fade, Transform | Easing | Problem → Solution flow |
| **Teacher** | Fade, Stagger | Dimension | Similar to Speaker |
| **Projects** | Dimension, Zoom, Stagger | Transform, Masking | 3D hover lift |
| **Blog Carousel** | 3D Cylinder | Velocity-based | Scroll-hijack rotation |
| **Footer Video** | Parallax | - | Slow ambient movement |

### Critical Motion Fixes Needed
1. **YouTube embed**: Currently just static rotation. MUST implement Zoom + Masking:
   - Entry: scale(0.5) → scale(1) with clip-path reveal
   - Hover: scale up, shadow deepen, "lifted" feel
   - Click: zoom toward viewer

2. **Hero entry**: Currently fades in. MUST add mask reveal:
   - clip-path: circle(0%) → circle(100%) on load

3. **Hamburger menu**: MUST add Transform/Morph animation

---

## Technical Decisions ✅

### 1. Scrollytelling Implementation ✅
**Decision:** Lenis + GSAP ScrollTrigger (hybrid approach)

```javascript
// Core setup
import Lenis from 'lenis'           // ~3KB smooth scroll
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

const lenis = new Lenis()
lenis.on('scroll', ScrollTrigger.update)
gsap.ticker.add((time) => lenis.raf(time * 1000))
```

**Rationale:** Research shows motion.zajno.com achieves excellent results without WebGL. This stack stays in S/A performance tier.

### 2. Asset Pipeline ✅
| Asset Type | Approach |
|------------|----------|
| **3D effects** | CSS transforms + perspective (no WebGL) |
| **Parallax layers** | 3-4 PNG/WebP layers, GSAP ScrollTrigger |
| **Videos** | Lazy load via Intersection Observer, autoplay on hover |
| **Images** | Responsive srcset, WebP with JPEG fallback |

**Desert parallax layers:**
1. Sky gradient (CSS or static)
2. Distant mountains (slow scroll: -20%)
3. Mid-ground dunes (medium: -35%)
4. Foreground elements (fast: -50%)

### 3. Project Cards ✅
**Decision:** JSON config file + GitHub API

```json
// projects.json
{
  "projects": [
    {
      "name": "Project Name",
      "github": "cdilga/repo",
      "live": "https://project.dev",
      "youtube": "VIDEO_ID",
      "thumbnail": "/assets/projects/thumb.webp",
      "video": "/assets/projects/preview.mp4"
    }
  ]
}
```

**Features:**
- [x] JSON config (simpler than Ghost custom types)
- [x] GitHub API for live stars/forks
- [x] Accelerometer API on mobile (DeviceOrientationEvent)
- [x] CSS perspective + rotateX/Y for 3D hover effect

### 4. Content Embeds ✅
| Platform | Approach | Rationale |
|----------|----------|-----------|
| **X.com** | Static preview image + link | Official embeds slow, hurt LCP |
| **GitHub** | Custom renderer | Better performance, matches design system |
| **YouTube** | Lite-youtube-embed + CSS 3D | Fast loading, CSS perspective for 3D effect |

**YouTube 3D effect (CSS-first):**
```css
.youtube-embed {
  transform: perspective(1000px) rotateY(-5deg) rotateX(2deg);
  transition: transform 0.4s ease;
}
.youtube-embed:hover {
  transform: perspective(1000px) rotateY(0deg) rotateX(0deg);
}
```

### 5. Infinite Blog Carousel ⏳
**Decision:** GSAP ScrollTrigger + CSS 3D transforms (scroll-hijack pattern)

**Core Mechanics:**
```javascript
// Scroll-hijack carousel setup
const carousel = document.querySelector('.blog-carousel');
const cards = gsap.utils.toArray('.blog-card');

// Pin the section and convert vertical scroll to horizontal rotation
ScrollTrigger.create({
  trigger: '.carousel-section',
  start: 'top top',
  end: () => `+=${cards.length * 300}`,  // Scroll distance = cards × offset
  pin: true,
  scrub: 1,  // Smooth 1:1 scroll-to-animation
  onUpdate: (self) => {
    // Map scroll progress to rotation angle
    const rotation = self.progress * 360 * (cards.length / visibleCards);
    updateCarouselRotation(rotation);
  }
});
```

**3D Cylinder Effect:**
```css
.carousel-track {
  transform-style: preserve-3d;
  perspective: 1200px;
}

.blog-card {
  position: absolute;
  transform-origin: center center -400px;  /* Radius of cylinder */
  backface-visibility: hidden;
}

/* Distribute cards around cylinder */
.blog-card:nth-child(1) { transform: rotateY(0deg) translateZ(400px); }
.blog-card:nth-child(2) { transform: rotateY(30deg) translateZ(400px); }
/* ... dynamically calculated via JS */
```

**Edge Fade Effect:**
```css
.carousel-container {
  mask-image: linear-gradient(
    to right,
    transparent 0%,
    black 15%,
    black 85%,
    transparent 100%
  );
  -webkit-mask-image: /* same */;
}
```

**Data Source:** Ghost Content API
```javascript
// Fetch all posts from Ghost
const posts = await ghost.posts.browse({
  limit: 'all',
  fields: 'title,slug,excerpt,feature_image,published_at'
});
```

**Mobile Optimizations:**
- Touch velocity tracking for natural swipe-to-spin
- Reduced card count (6-8 visible vs 12 on desktop)
- Larger touch targets (full card is tappable)
- `will-change: transform` for GPU compositing
- Intersection Observer to pause when off-screen

**Accessibility:**
- `prefers-reduced-motion`: disable scroll-hijack, show static grid
- Keyboard navigation: arrow keys rotate carousel
- Screen readers: carousel announces as list of articles

---

## Inspiration Reference
- Lando Norris website (high-performance, wow factor)
- motion.zajno.com (CSS-only motion design excellence)
- DHH's blog (no paid pressure, authentic voice)

---

## Success Metrics
1. ✨ Wow factor on first load
2. ⚡ Fast (120fps target, quick LCP)
3. 🎤 Converts to speaking opportunities
4. 🚀 Drives traffic to main projects
5. 📝 Surfaces top articles naturally
6. 🔗 Connects to social presence

---

## Color Palette (Desert Theme)

```
Primary:      #FF6B35  (Orange - accent)
Background:   #F5F0E8  (Sand/cream)
Dark:         #2D2D2D  (Charcoal)
Warm:         #D4A574  (Sandstone)
Sky:          #87CEEB  (Outback sky blue)
Earth:        #8B4513  (Red earth)
```

---

## Asset Sourcing Plan

### Hero Parallax Layers (Priority: HIGH)
| Asset | Spec | Source |
|-------|------|--------|
| `desert-sky.webp` | 1920x600, gradient or photo | AI generate or Unsplash |
| `desert-mountains.png` | 1920x600, transparent | AI generate, then trace to vector |
| `desert-dunes-mid.png` | 1920x400, transparent | AI generate, then trace to vector |
| `desert-foreground.png` | 1920x300, transparent, sparse vegetation | AI generate or stock |

**Approach:** Generate with AI (Midjourney/DALL-E), then vectorize key elements for crisp scaling. WebP with JPEG fallback.

### Scene Assets
| Scene | Assets Needed | Source |
|-------|--------------|--------|
| **Coder** | Keyboard SVG, code snippets | Design manually, real code samples |
| **8 Claudes** | Terminal frame CSS/SVG, 8 code outputs | CSS-only, real terminal output |
| **Content Creator** | YouTube thumbnail, video ID (cdilga) | youtube.com/@cdilga |
| **Speaker** | 3-5 talk photos, conference logos | Personal photos, request logos |
| **Consultant** | Case study icons, professional photo | LinkedIn experience |
| **Teacher** | Generic Zoom meeting screenshot | Stock/placeholder (no bootcamp assets) |

### Footer Video Asset
| Asset | Spec | Source |
|-------|------|--------|
| **windswept_video.mp4** | Slow-mo sand dune, ambient | Existing asset |

### Project Assets
| Asset | Spec | Source |
|-------|------|--------|
| Thumbnails | 600x400 WebP per project | Screenshots + design polish |
| Preview videos | 10s MP4 loop, 720p, ~2MB each | Screen record, compress |
| `projects.json` | Config file | Create manually |

### Embed Assets
| Component | Assets | Source |
|-----------|--------|--------|
| YouTube | lite-youtube-embed CSS | npm package |
| GitHub | Language color map, icons | GitHub API, custom SVGs |
| X.com | Preview screenshot workflow | Puppeteer script or manual |

### Icon Set
- YouTube play icon
- X.com/Twitter icon
- GitHub icon
- LinkedIn icon
- External link icon
- Copy code icon

**Source:** Lucide icons (MIT license) or custom SVG

### Fonts
| Font | Usage | Source |
|------|-------|--------|
| Inter | Headings, body | Google Fonts (variable) |
| JetBrains Mono | Code blocks | Google Fonts |

**Optimization:** Subset to used characters, preload critical weights.

---

## Implementation Phases

### Phase 1: Foundation
1. Design System CSS (colors, typography, spacing)
2. Lenis + GSAP setup
3. Basic page structure

### Phase 2: Hero
1. Source/create parallax assets
2. Implement hero with parallax
3. Entry animations

### Phase 3: Scenes
1. Build each scene component
2. ScrollTrigger integration
3. Scene-specific animations

### Phase 4: Sections
1. Projects section + JSON config
2. Top Articles + Ghost integration
3. Embed components

### Phase 5: Blog Carousel
1. Ghost Content API integration
2. Carousel scroll-hijack mechanics
3. 3D cylinder effect + edge fades
4. Mobile swipe gestures
5. Infinite loop logic

### Phase 6: Polish
1. Mobile optimization
2. Performance audit
3. Reduced motion support
4. Final asset optimization
