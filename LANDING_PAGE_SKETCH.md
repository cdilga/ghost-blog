# Landing Page Overview Sketch

## Design System
- **Theme**: Australian Desert / Outdoors
- **Accent Color**: Orange
- **Style**: Ultra clean, minimal, high-performance
- **Target**: 120fps WebGL rendering, "WOW" factor on first load

---

## Performance Requirements (Non-Negotiable)

### Smoothness
- **Frame rate**: 60fps minimum, 120fps target on capable devices
- **Scroll**: Buttery smooth, no jank or stuttering
- **Animations**: Hardware-accelerated (GPU), use `transform` and `opacity`
- **Transitions**: Eased, natural feeling (no linear/robotic motion)
- **No layout thrashing**: Avoid reflows during animations

### Loading
- **LCP**: < 2.5s (Largest Contentful Paint)
- **FID**: < 100ms (First Input Delay)
- **CLS**: < 0.1 (Cumulative Layout Shift)
- **Progressive enhancement**: Core content works without JS, animations enhance
- **Lazy loading**: Below-fold content, videos, heavy assets

### Graceful Degradation
- Reduce motion for `prefers-reduced-motion`
- Fallback to simpler animations on low-end devices
- Skip WebGL if not supported, use CSS fallbacks

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
- **Memory conscious**: Clean up WebGL contexts, limit particle counts

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
│                    HERO / SCROLLYTELLING                        │
│                    (Full WebGL Experience)                      │
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
│  │  🏢 Enterprise work showcase         │                      │
│  │  "Big Australian companies"          │                      │
│  │  Problem → Solution narrative        │                      │
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
└─────────────────────────────────────────────────────────────────┘
```

---

## Target Audiences & Funnels

| Visitor Type | What They See | Conversion Goal |
|--------------|---------------|-----------------|
| **Recruiter** | Hero + Projects + Skills | "Wow, cool programmer" → Contact |
| **Talk Organizer** | Speaker section + Talks | "This guy presents well" → Book |
| **Client** | Consulting + Projects | "Can fix my problem" → Hire |
| **Dev Community** | Projects + Dev Playground | "Cool project" → Follow/Star |

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

---

## Inspiration Reference
- Lando Norris website (high-performance WebGL)
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
| **Content Creator** | YouTube thumbnail, video ID | Your actual YouTube channel |
| **Speaker** | 3-5 talk photos, conference logos | Personal photos, request logos |
| **Consultant** | Case study icons, professional photo | Create icons, personal photo |

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

### Phase 5: Polish
1. Mobile optimization
2. Performance audit
3. Reduced motion support
4. Final asset optimization
