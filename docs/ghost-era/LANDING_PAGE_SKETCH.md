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
│                                                                 │
│  DESKTOP: GLASSMORPHISM SECTION SIDEBAR (Left)                  │
│  ┌────┐                                                         │
│  │ ◇  │ ← Thin line icon, expands to "The Coder" on hover      │
│  │ ⊞  │ ← "8 Claude Codes"                                     │
│  │ ▷  │ ← "Content Creator"                                    │
│  │🚗 │ ← Triton "you are here" (moves within section slot)     │
│  │ 🎤 │ ← "The Speaker"                                        │
│  │ 🏢 │ ← "The Consultant"                                     │
│  │ 👨‍🏫 │ ← "The Teacher"                                        │
│  │ ◈  │ ← "Projects"                                           │
│  │ 📰 │ ← "All My Writing"                                     │
│  └────┘                                                         │
│  - Glassmorphism: backdrop-filter blur, low opacity             │
│  - Frosted glass with depth (Apple Liquid Glass style)          │
│  - Icons expand on hover to show full section title             │
│  - Ultra low opacity when idle, increases on hover              │
│  - Triton indicator morphs between up/down based on scroll dir  │
│  - Progress: Triton moves vertically within section slot        │
│                                                                 │
│  MOBILE: BOTTOM SECTION NAV (Fixed, ~48-56px)                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  •   •   •  🚗  •   •   •   •   •                        │   │
│  └─────────────────────────────────────────────────────────┘   │
│  - Dots expand on touch to show full section title              │
│  - Touch + timeout for mobile interactions                       │
│  - Triton uses left/right icons (horizontal scroll metaphor)    │
│  - Fixed to viewport bottom, glassy/transparent                 │
│                                                                 │
│  PAGE LINKS: Hero buttons → "Articles", Footer has all links    │
│                                                                 │
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

## Section Navigation System (Landing Page Only)

> **This is a custom navigation for the scrollytelling landing page.**
> Other pages (blog, articles) use standard Ghost navigation.

### Desktop: Glassmorphism Sidebar (Left)

**Visual Design:**
- Position: Fixed left side of viewport
- Style: Glassmorphism / Apple Liquid Glass aesthetic
- `backdrop-filter: blur()` + low opacity background
- Frosted glass with depth and subtle refraction
- Ultra-low opacity when idle (~15-20%)
- Increases opacity on hover (~60-80%)
- Glass textures allow background content to show through

**Section Indicators:**
- Thin, minimal line-based icons for each section
- Icons designed as a pro designer would - elegant, consistent stroke weight
- On hover: icon expands smoothly to reveal full section title
- Sections: Coder, 8 Claudes, Content Creator, Speaker, Consultant, Teacher, Projects, All My Writing

**Icon Design (Thin Line Style):**
| Section | Icon Concept |
|---------|-------------|
| The Coder | Minimal code brackets `</>` or terminal cursor |
| 8 Claude Codes | Grid of 8 small squares or terminal windows |
| Content Creator | Play triangle or video camera outline |
| The Speaker | Microphone or podium outline |
| The Consultant | Building or briefcase outline |
| The Teacher | Graduation cap or chalkboard |
| Projects | Diamond/gem or folder outline |
| All My Writing | Document or pen outline |

**"You Are Here" Indicator - Triton Icon:**
- Mitsubishi Triton ute icon marks current section
- Moves vertically within the section's slot (subtle, single-pixel movements)
- Morphs/blends between up-facing and down-facing variants based on scroll direction:
  - Scrolling DOWN the page → Triton faces DOWN (forward/into page)
  - Scrolling UP the page → Triton faces UP (back toward top)
- Keep unobtrusive - may be replaced with a simple circle if too complex
- Assets: `triton-up-navbar-icon.png`, `triton-down-navbar-icon.png`
- **Preprocessing required:** Trim alpha padding around icon edges

**Click Behavior:**
- Click section → smooth scroll (fast) to section start
- "Start" = the point where all section content has animated in (after choreography completes)
- NOT the raw DOM position, but the "ready to view" state

### Mobile: Bottom Section Nav

**Visual Design:**
- Fixed to viewport bottom, ~48-56px height
- Glassy/transparent, matching desktop aesthetic
- Horizontal row of section indicators

**Section Indicators:**
- Small dots representing each section
- On touch: dot expands to show full section title
- Touch interactions with appropriate timeouts for mobile UX
- Expansion animates smoothly, collapses after timeout

**"You Are Here" Indicator - Triton Icon (Mobile):**
- Uses LEFT/RIGHT facing variants (horizontal scroll metaphor)
- Scrolling DOWN → Triton faces RIGHT (forward)
- Scrolling UP → Triton faces LEFT (back)
- Assets: `triton-left-navbar-icon.png`, `triton-right-navbar-icon.png`
- **Preprocessing required:** Trim alpha padding, visual check needed

### Entry Animation (Scroll-Driven)

**Timing:** Animates in during hero sequence, immediately AFTER main text and buttons have appeared.

**Choreography:**
1. Elements enter one-by-one (progressive composition)
2. Direction: from bottom-left of screen
3. Each element animated smoothly and elegantly
4. Goal: Draw attention to this unique UI element initially
5. After entry: becomes very subtle and unobtrusive
6. Final animation phase: add depth effect, then transition to idle state
7. Entire entry sequence is scroll-driven (not time-based)

**Post-Entry States:**
- **Idle:** Very low opacity, minimal visual presence
- **Hover:** Increased opacity, depth effects, icon expansion
- Standard hover/off-hover transitions (CSS, not scroll-driven)

### Page Links Strategy

- **Hero section:** Buttons repurposed to include "Articles" link
- **Footer:** Contains all standard Ghost navigation links
- **Contact:** Remains in footer
- Section nav is ONLY for landing page sections, not site-wide navigation

### Accessibility & Fallbacks

- `prefers-reduced-motion`: Skip entry animation, show nav immediately at idle state
- Keyboard navigation: Tab through sections, Enter to navigate
- Screen readers: Announce as "Page section navigation"
- Touch targets: Minimum 44x44px on mobile

### Testing Requirements

Tests must validate:
- [ ] Entry animation triggers at correct scroll position (after hero buttons)
- [ ] All section icons render correctly
- [ ] Hover expansion shows full title
- [ ] Triton morphs between up/down (desktop) or left/right (mobile) based on scroll direction
- [ ] Triton position updates within section slot during scroll
- [ ] Click navigates to correct section "start" position
- [ ] Mobile touch interactions work with appropriate timeouts
- [ ] Glassmorphism renders correctly (backdrop-filter support)
- [ ] Fallback for browsers without backdrop-filter
- [ ] Reduced motion preference respected
- [ ] Icon alpha preprocessing completed (no visual artifacts)

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
| **Section Nav** | Stagger, Fade, Dimension | Transform/Morph | Glassmorphism sidebar, scroll-driven entry, Triton morph |
| **Hero** | Parallax, Masking, Easing | Fade, Dimension | Entry: mask reveal, depth-map canvas #1 |
| **Coder** | Parallax, Fade | Dimension | Shares depth-map canvas #1 with Hero |
| **Scene Transition** | Masking, Parallax | Dimension | SVG particle mask, dual depth-maps visible |
| **8 Claude Codes** | Transform, Stagger, Easing | Dimension, Parallax | Dock-spawn from navbar, depth-map canvas #2 |
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

### ⚠️ PARALLAX INTENSITY REQUIREMENTS (DO NOT REDUCE)

**Motion-based depth parallax** (camera/mouse tracking):
- Desktop SENSITIVITY: 700+ (motion-input.js)
- Mobile SENSITIVITY: 220+ (motion-input.js)
- Desktop displacementScale: 55+ (hero-depth.js)
- Mobile displacementScale: 50+ (hero-depth.js)

**Scroll-based parallax** (all images):
- Do NOT add intensity multipliers
- Do NOT reduce values for mobile or reduced-motion
- Keep full effect everywhere - values are tuned per-element via data attributes
- Default: X=25px, Y=50px offset range (MUST be visible!)
- Typical range: X=15-35px, Y=30-60px for noticeable effect

**Rationale**: The parallax effect is a key differentiator. It should be clearly visible and pronounced, not subtle. Users should immediately notice the depth effect when moving their device or scrolling.

---

## 🎬 Dual Depth-Map Scene Transition System

> **Advanced motion design**: Persistent depth-map backgrounds with SVG windswept mask transition between scenes.

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│  HERO + CODER (Sections 1-2) - UNIFIED DEPTH-MAP CANVAS                  │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  DEPTH-MAP CANVAS #1: desert_dune_tufts_big_red                 │    │
│  │  (PixiJS DisplacementFilter, controlled by MotionInput)         │    │
│  │  Persists through both Hero AND Coder sections                  │    │
│  └─────────────────────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────────────────────┤
│  TRANSITION ZONE (SVG Windswept Particle Mask)                           │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  ←←←←←←←←←←←←←← WIND DIRECTION (right to left) ←←←←←←←←←←←←←←  │    │
│  │                                                                  │    │
│  │  Mask edge: Particle-style (many small circles like sand grains) │    │
│  │  At 50%: BOTH depth-maps visible, BOTH responding to mouse/gyro │    │
│  │  Canvas #1 exits left ←  |  → Canvas #2 reveals from right      │    │
│  │                                                                  │    │
│  │  Scroll-captured: user can pause mid-transition, see both       │    │
│  └─────────────────────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────────────────────┤
│  8 CLAUDE CODES (Section 3) - NEW DEPTH-MAP CANVAS                       │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  DEPTH-MAP CANVAS #2: desert_ground_from_top_of_big_red         │    │
│  │  (Same PixiJS + MotionInput architecture as Canvas #1)          │    │
│  │                                                                  │    │
│  │  ┌──┐ ┌──┐ ┌──┐ ┌──┐   Terminals spawn from navbar center       │    │
│  │  │T1│ │T2│ │T3│ │T4│   (macOS dock-launch style)                │    │
│  │  └──┘ └──┘ └──┘ └──┘                                             │    │
│  │  ┌──┐ ┌──┐ ┌──┐ ┌──┐   Scroll-triggered, time-completed         │    │
│  │  │T5│ │T6│ │T7│ │T8│   (can pause between spawns)               │    │
│  │  └──┘ └──┘ └──┘ └──┘                                             │    │
│  └─────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
```

### Depth-Map Assets

| Canvas | Image | Depth Map | Sections |
|--------|-------|-----------|----------|
| #1 | `desert_dune_tufts_big_red.jpg` | `desert_dune_tufts_big_red_depth_anything_2_greyscale.png` | Hero, Coder |
| #2 | `desert_ground_from_top_of_big_red.jpg` | `desert_ground_from_top_of_big_red_depth_anything_2_greyscale.png` | 8 Claude Codes |

### Shared Motion Controller

Both depth-map canvases connect to the same `MotionInput` system:
- **Desktop**: Mouse position drives parallax
- **Mobile**: Gyroscope/accelerometer (with baseline calibration)
- **Fallback**: Face tracking via camera (opt-in)

During the mask transition, BOTH canvases render simultaneously and BOTH respond to the same input. This creates a seamless "looking through" effect where the viewer can see depth in both scenes at once.

### SVG Windswept Particle Mask

**Edge style**: Organic particle/sand-grain effect (NOT a simple diagonal line)

```
MASK EDGE VISUALIZATION (zoomed in):

    Canvas #1 (exiting)  │  Canvas #2 (revealing)
                         │
    ████████████░░░ ○    │    ○ ░░░░░░░░░░░░░░░░
    ██████████░░ ○ ○ ○   │   ○ ○ ░░░░░░░░░░░░░░░
    █████████░ ○ ○   ○   │  ○   ○ ░░░░░░░░░░░░░░
    ███████░░ ○   ○ ○ ○  │ ○ ○ ○   ░░░░░░░░░░░░░
    ██████░ ○ ○ ○    ○   │   ○    ○ ░░░░░░░░░░░░
    ████░░░ ○   ○ ○ ○ ○  │ ○ ○ ○ ○   ░░░░░░░░░░░
                         │
    ← Wind direction ←←←←│←←←← (right to left)
```

**Implementation approach**:
- SVG `<clipPath>` with many small `<circle>` elements
- Circles distributed along a slightly curved/organic baseline
- Random size variation (2-8px radius)
- Random spacing (clustered, not uniform)
- GSAP animates the entire clipPath position from right to left
- Individual circles may have subtle secondary animation (turbulence)

**SVG structure** (conceptual):
```svg
<clipPath id="windswept-mask">
  <rect x="-100%" y="0" width="100%" height="100%" /> <!-- Solid revealed area -->
  <!-- Particle edge (hundreds of small circles) -->
  <circle cx="0%" cy="10%" r="4" />
  <circle cx="1%" cy="12%" r="6" />
  <circle cx="-1%" cy="15%" r="3" />
  <!-- ... hundreds more, procedurally generated -->
</clipPath>
```

**Scroll behavior**: Mask position is scroll-captured (scrubbed). User can pause at any point and both backgrounds remain visible and interactive.

### Terminal Dock-Spawn Animation

**Spawn origin**: Navbar center (horizontal center of viewport, at navbar Y position)

**Animation style**: macOS dock window launch
- Terminals start at scale(0.1) at navbar center
- Scale up to scale(1.0) while translating to final grid position
- Elastic/spring easing for natural "pop" feel
- Each terminal is independent - once triggered, animation completes

**Trigger model**: Scroll-TRIGGERED, NOT scroll-SCRUBBED

| Aspect | Behavior |
|--------|----------|
| **What scroll controls** | WHEN each terminal starts spawning |
| **What scroll does NOT control** | The spawn animation progress (runs to completion) |
| **Can user pause mid-spawn?** | NO - individual spawn animations are atomic |
| **Can user pause between spawns?** | YES - can have 3 terminals, scroll more → 5 more spawn |

**Think of it like**: Launching apps from macOS dock. You can launch 3 apps (each animates fully), pause, then launch 5 more. You can't pause an app mid-launch-animation.

**Spawn choreography**:
```
Scroll 0-12.5%  → Terminal 1 triggers (spawns from navbar center)
Scroll 12.5-25% → Terminal 2 triggers
Scroll 25-37.5% → Terminal 3 triggers
...
Scroll 87.5-100% → Terminal 8 triggers

Each spawn animation: 400-500ms duration, elastic easing
Overlap: Previous spawn ~70% complete when next triggers (natural cascade)
```

**Spawn animation keyframes** (per terminal):
```javascript
{
  // Start state (at navbar center)
  scale: 0.1,
  x: navbarCenterX - terminalFinalX,
  y: navbarY - terminalFinalY,
  opacity: 0,

  // End state (grid position)
  scale: 1.0,
  x: 0,
  y: 0,
  opacity: 1,

  duration: 0.45,
  ease: 'elastic.out(1, 0.5)'  // Spring/bounce feel
}
```

### Motion Principles Applied

| Effect | Principles | Notes |
|--------|-----------|-------|
| Dual depth-maps | **Parallax, Dimension** | Both canvases respond to shared MotionInput |
| SVG mask transition | **Masking, Easing** | Particle edge, scroll-captured scrub |
| Terminal spawn | **Transform, Stagger, Easing** | Dock-launch style, scroll-triggered |
| Overlap visibility | **Dimension** | Depth visible in both scenes during transition |

### Testing Requirements

- [ ] Canvas #1 covers Hero + Coder with no seam
- [ ] Canvas #2 loads correctly with depth map
- [ ] Both canvases respond to mouse movement during transition
- [ ] SVG mask edge has visible particle effect (not sharp line)
- [ ] Mask transition is fully scroll-captured (pausable at 50%)
- [ ] Terminals spawn from navbar center
- [ ] Individual spawn animations complete smoothly (not scrubbed)
- [ ] User can pause between terminal spawns
- [ ] All 8 terminals spawn by 100% scroll progress
- [ ] Reduced motion: skip animations, show content immediately
- [ ] Mobile gyroscope works on both canvases

---

## 🚨 CRITICAL: Scroll-Captured Choreography (The Missing Layer)

> **THIS IS THE CORE CONCEPT.** Everything else is implementation detail.
> If you only read one section, read this one.

### What This IS vs What It's NOT

| ❌ NOT This (Scroll-Triggered) | ✅ THIS (Scroll-Captured) |
|-------------------------------|---------------------------|
| Page scrolls normally | Page is **PINNED** (doesn't move) |
| Elements fade in when visible | Scroll **DRIVES** animation frame-by-frame |
| Scroll moves viewport | Scroll controls **TIMELINE PROGRESS** |
| Each section independent | Sections **CHOREOGRAPHED** as sequences |

**Think Apple product pages**: You scroll, but the page doesn't move. Instead, scroll progress controls a cinematic animation sequence. Only when the sequence completes does the next section become available.

### The Orchestration Model

```
┌─────────────────────────────────────────────────────────────────┐
│                     SCROLL POSITION                              │
│  0%                    50%                    100%               │
│  ├──────────────────────┼──────────────────────┤                │
└─────────────────────────────────────────────────────────────────┘
                              ↓ MAPS TO ↓
┌─────────────────────────────────────────────────────────────────┐
│                    ANIMATION TIMELINE                            │
│                                                                  │
│  0-15%:   "CHRIS DILGER" fades/slides in                        │
│  15-30%:  "Makes things work." fades/slides in                  │
│  30-45%:  Buttons fade/slide in                                 │
│  45-70%:  Hero slides UP and OUT                                │
│  70-85%:  Coder section slides IN from bottom                   │
│  85-100%: Coder elements stagger in (keyboard, code, github)    │
│                                                                  │
│  [100%: PIN RELEASED - normal scroll resumes]                   │
└─────────────────────────────────────────────────────────────────┘
```

### How Pinning Works

```javascript
// THE KEY CONCEPT: pin + scrub
ScrollTrigger.create({
  trigger: '.hero',
  start: 'top top',
  end: '+=2000',        // 2000px of scroll = animation duration
  pin: true,            // 🔥 PAGE DOESN'T MOVE
  scrub: 1,             // 🔥 SCROLL CONTROLS TIMELINE
  onUpdate: (self) => {
    // self.progress = 0 to 1 based on scroll position
    updateAnimation(self.progress);
  }
});
```

**`pin: true`** = The section stays fixed in viewport while user scrolls
**`scrub: 1`** = Scroll position directly controls animation progress (1 = smooth)
**`end: '+=2000'`** = User must scroll 2000px to complete the sequence

### Hero Sequence Choreography (REQUIRED)

```javascript
// Create a timeline for the hero sequence
const heroTimeline = gsap.timeline({
  scrollTrigger: {
    trigger: '.hero',
    start: 'top top',
    end: '+=2500',      // Scroll distance for full sequence
    pin: true,
    scrub: 1,
  }
});

// Choreograph each element
heroTimeline
  // Phase 1: Name enters (0% - 15% of scroll)
  .from('.hero__title', {
    opacity: 0,
    y: 50,
    duration: 0.15
  })
  // Phase 2: Tagline enters (15% - 30%)
  .from('.hero__subtitle', {
    opacity: 0,
    y: 30,
    duration: 0.15
  })
  // Phase 3: Buttons enter (30% - 45%)
  .from('.hero__cta', {
    opacity: 0,
    y: 20,
    duration: 0.15
  })
  // Phase 4: Hold for a moment (45% - 55%)
  .to({}, { duration: 0.1 })
  // Phase 5: Hero exits UP (55% - 75%)
  .to('.hero', {
    yPercent: -100,
    duration: 0.2,
    ease: 'power2.inOut'
  })
  // Phase 6: Coder section elements enter (75% - 100%)
  .from('.scene--coder .scene__header', {
    opacity: 0,
    y: 50,
    duration: 0.1
  })
  .from('.coder__keyboard', {
    opacity: 0,
    x: -50,
    duration: 0.1
  }, '-=0.05')
  .from('.coder__code', {
    opacity: 0,
    x: 50,
    duration: 0.1
  }, '-=0.08')
  .from('.coder__github', {
    opacity: 0,
    y: 30,
    duration: 0.1
  }, '-=0.05');
```

### Section-to-Section Transitions

Each scene should have its own pinned sequence:

```
HERO (pinned, 2500px scroll)
  └── Elements enter → Hold → Exit up
        ↓
CODER (pinned, 1500px scroll)
  └── Elements enter from edges → Hold → Exit
        ↓
8 CLAUDE CODES (pinned, 1500px scroll)
  └── Terminals stagger in → Activity animations → Exit
        ↓
... and so on
```

### Common Mistakes to AVOID

1. **❌ Using IntersectionObserver for choreography**
   - IO triggers when element enters viewport
   - Cannot control animation progress with scroll
   - Use for lazy loading, NOT choreography

2. **❌ Animating on scroll WITHOUT pinning**
   - Elements animate but page also moves
   - Creates disconnected, unintentional feel
   - Always pin during choreographed sequences

3. **❌ Using `animation-timeline: scroll()` alone**
   - CSS scroll-timeline doesn't support pinning
   - Use GSAP ScrollTrigger for pinned sequences

4. **❌ Linear scroll = linear animation**
   - Each element should have its own easing
   - The SEQUENCE is linear (scroll-mapped)
   - Individual ELEMENTS use cubic-bezier easing

### Reduced Motion Fallback

```javascript
if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  // Skip pinning, show all content immediately
  // Or: very fast, simplified sequence
  ScrollTrigger.getAll().forEach(st => st.kill());
}
```

### Reference: Apple-Style Scroll Capture

- [Apple AirPods Pro page](https://www.apple.com/airpods-pro/)
- [Apple iPhone page](https://www.apple.com/iphone/)
- [motion.zajno.com](https://motion.zajno.com/) - our research source

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

**🚨 CRITICAL:** The setup above is just the foundation. You MUST implement **pinned scroll-captured choreography** as described in the section above. Without `pin: true` and `scrub`, you're just doing basic scroll-triggered fades.

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
