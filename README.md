```
         ██████╗██╗      █████╗ ██╗   ██╗██████╗ ███████╗     ██████╗ ██████╗ ██████╗ ███████╗██████╗
        ██╔════╝██║     ██╔══██╗██║   ██║██╔══██╗██╔════╝    ██╔════╝██╔═══██╗██╔══██╗██╔════╝██╔══██╗
        ██║     ██║     ███████║██║   ██║██║  ██║█████╗      ██║     ██║   ██║██║  ██║█████╗  ██║  ██║
        ██║     ██║     ██╔══██║██║   ██║██║  ██║██╔══╝      ██║     ██║   ██║██║  ██║██╔══╝  ██║  ██║
        ╚██████╗███████╗██║  ██║╚██████╔╝██████╔╝███████╗    ╚██████╗╚██████╔╝██████╔╝███████╗██████╔╝
         ╚═════╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚═════╝ ╚══════╝     ╚═════╝ ╚═════╝ ╚═════╝ ╚══════╝╚═════╝
```

<div align="center">

# chris.dilger.me

### A production blog built entirely by AI agents. Zero human-written code.

[![Ghost](https://img.shields.io/badge/Ghost-5.x-738A94?style=for-the-badge&logo=ghost&logoColor=white)](https://ghost.org)
[![Claude](https://img.shields.io/badge/Claude-Opus%204.5-D97757?style=for-the-badge&logo=anthropic&logoColor=white)](https://claude.ai)
[![Deploy](https://img.shields.io/badge/Deploy-GitHub%20Actions-2088FF?style=for-the-badge&logo=github-actions&logoColor=white)](https://github.com/features/actions)

---

**[Live Site](https://chris.dilger.me)** · **[View Commits](../../commits/main)** · **[Deployment Pipeline](.github/workflows/deploy.yml)**

</div>

---

## The Experiment

> *"What if you never touched a keyboard, and AI agents built your entire production website?"*

This repository is the answer. **13,615 lines of code** across a custom Ghost theme, WebGL effects, CI/CD pipelines, image optimization infrastructure, and E2E tests—all generated through conversation with Claude.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│    HUMAN-WRITTEN CODE:    0 lines                                           │
│    AI-GENERATED CODE:     13,615 lines                                      │
│                                                                             │
│    HUMAN-WRITTEN CONTENT: 100%    (all blog posts & articles)               │
│    AI-GENERATED CONTENT:  0%                                                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

The code is AI. The thoughts are mine.

---

## By The Numbers

```
╔════════════════════════════════════════════════════════════════════════════╗
║                         RESOURCE CONSUMPTION                               ║
╠════════════════════════════════════════════════════════════════════════════╣
║                                                                            ║
║    Tokens Consumed         899.48M tokens                                  ║
║    API Equivalent Cost     $607.49                                         ║
║    Claude Max Plan Usage   ~80% of $200/week limit                         ║
║                                                                            ║
║    Parallel Agents         Up to 8 concurrent                              ║
║    Git Worktrees           Up to 3 simultaneous                            ║
║    Total Commits           130                                             ║
║                                                                            ║
║    Time to Ship            1 weekend (with tweaks through the week)        ║
║                                                                            ║
╚════════════════════════════════════════════════════════════════════════════╝

    Measured with ccusage (github.com/ryoppippi/ccusage)
```

---

## What Got Built

### Custom Ghost Theme

A scrollytelling portfolio with WebGL depth effects, smooth scroll animations, and a desert-inspired design system.

```
themes/chris-theme/
├── assets/
│   ├── js/
│   │   ├── main.js                 # Animation orchestration
│   │   ├── hero-depth.js           # PixiJS depth displacement
│   │   ├── claude-codes-depth.js   # WebGL showcase effects
│   │   ├── projection-carousel.js  # 3D perspective carousel
│   │   ├── terminal-spawn.js       # Terminal typing animations
│   │   ├── windswept-mask.js       # Scroll-triggered masks
│   │   └── inline-depth.js         # Content depth mapping
│   └── css/
│       └── style.css               # Design system (4000+ lines)
├── partials/                       # Handlebars components
└── *.hbs                           # Page templates
```

**Key Features:**
- **Lenis + GSAP ScrollTrigger** — Buttery 60fps scrolling with precise animation triggers
- **PixiJS WebGL** — GPU-accelerated depth displacement using greyscale depth maps
- **Reduced-motion support** — Full accessibility compliance without sacrificing visual impact
- **Fluid typography** — Single `clamp()` scale that adapts from mobile to 4K
- **Accelerometer parallax** — Mobile device tilt affects depth layers

### Image Optimization Pipeline

Three-stage optimization that runs at build time, upload time, and migration time:

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  BUILD TIME  │     │ UPLOAD TIME  │     │  MIGRATION   │
│              │     │              │     │              │
│  Sharp-based │     │   Custom     │     │   Batch      │
│  WebP gen    │────▶│   Storage    │────▶│   Legacy     │
│  Responsive  │     │   Adapter    │     │   Convert    │
│  Sizing      │     │              │     │              │
└──────────────┘     └──────────────┘     └──────────────┘
     │                     │                    │
     ▼                     ▼                    ▼
  Theme images      Every upload         Existing content
  optimized at      auto-generates       migrated to WebP
  4 breakpoints     WebP + sizes         with DB updates
```

### CI/CD Pipeline

Production-grade deployment with intelligent change detection:

```yaml
# Simplified view of deploy.yml (233 lines)

detect-changes ──▶ dorny/paths-filter identifies what changed
       │
       ├──▶ test ──────────▶ gscan validation + Playwright E2E
       │
       ├──▶ deploy-theme ──▶ rsync + MySQL theme activation
       │
       ├──▶ deploy-storage ─▶ Custom adapter + npm install
       │
       └──▶ restart-ghost ──▶ 60-second health check
```

**Resilience features:** SSH retry with exponential backoff, pre-deployment backups, database-driven theme activation, health verification.

### Testing Infrastructure

```javascript
// tests/smoke.spec.js - Catches the bugs that matter

test('hero scroll cycle maintains visibility', async () => {
  // This test caught a z-index stacking bug that would have
  // made the hero disappear after scrolling back up.
  //
  // It scrolls to bottom, back to top, and pixel-diffs
  // against the initial state with 1% tolerance.
});
```

**Coverage:**
- Theme validation (gscan)
- Console error detection
- Scroll system initialization
- Visual regression testing
- Storage adapter unit tests

---

## Architecture Decisions

A few choices that might interest you:

| Decision | Why |
|----------|-----|
| **Database-driven theme activation** | Ghost CLI has permission complexity. Raw SQL update to `settings` table is atomic and reliable. |
| **Custom storage adapter over plugins** | Full control over the optimization pipeline. WebP URLs returned by default. |
| **Flat image naming** (`hero-1280.webp`) | Easier glob patterns, simpler template references than nested directories. |
| **Depth maps over CSS transforms** | GPU-accelerated displacement creates parallax that CSS can't match. |
| **Reduced-motion keeps parallax** | Accessibility doesn't mean boring—static parallax layers still work. |

---

## Local Development

```bash
# Prerequisites: Docker, Node.js 20+

# Start Ghost locally
npm start              # Spins up Docker Compose

# Run the full test suite
npm test               # Validates theme + runs Playwright

# Package theme for manual upload
npm run package        # Creates theme.zip
```

The Docker setup mounts the theme directory for live reloading. Edit, save, refresh.

---

## The Tech Stack

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                │
├─────────────────────────────────────────────────────────────────┤
│  Ghost 5           │  Headless CMS with Handlebars templating   │
│  PixiJS            │  WebGL rendering for depth effects         │
│  GSAP              │  Animation timeline & ScrollTrigger        │
│  Lenis             │  Smooth scroll virtualization              │
│  Lite-YouTube      │  Lazy-loaded video embeds                  │
├─────────────────────────────────────────────────────────────────┤
│                        TOOLING                                  │
├─────────────────────────────────────────────────────────────────┤
│  Sharp             │  High-performance image processing         │
│  Playwright        │  E2E testing & visual regression           │
│  gscan             │  Ghost theme validation                    │
│  Docker Compose    │  Local development environment             │
├─────────────────────────────────────────────────────────────────┤
│                       DEPLOYMENT                                │
├─────────────────────────────────────────────────────────────────┤
│  GitHub Actions    │  CI/CD with selective deployment           │
│  rsync over SSH    │  Atomic file transfers                     │
│  MySQL             │  Production database                       │
│  Self-hosted VPS   │  Full infrastructure control               │
└─────────────────────────────────────────────────────────────────┘
```

---

## Reading The Commit Log

The [commit history](../../commits/main) tells the story of iterative AI development:

```
9d60370 Initial commit: documentation files
    │
    ├── Motion research phase
    │   34895a2 Add motion design principles
    │   6947ce1 Add Lenis + GSAP ScrollTrigger foundation
    │
    ├── Feature development
    │   c8e7a2d Implement dual depth-map canvas system
    │   4e4788c feat(motion): implement terminal dock-spawn animation
    │
    ├── Bug fixing (the real work)
    │   6fb2a1a fix(hero): add z-index to hero-parallax for proper stacking
    │   b2057de fix(depth): prevent edge gaps on unusual aspect ratios
    │
    └── 70e6a62 fix(ci): activate theme after deployment (latest)
```

Every commit is AI-generated. Every bug was AI-diagnosed and AI-fixed through conversation.

---

## Why This Exists

I wanted to test a hypothesis: **Can AI agents ship production software if you're specific enough about what you want?**

The answer is yes—with caveats:
- You still need taste (design direction, UX decisions)
- You still need domain knowledge (Ghost, WebGL, CI/CD patterns)
- You still need to review (AI makes confident mistakes)

But the keyboard? Optional.

---

## FAQ

**Q: Is this sustainable for larger projects?**
900M tokens for a blog is expensive at API rates. The Claude Max plan ($200/week) made this feasible. For production teams, the economics depend heavily on velocity gains vs. token costs.

**Q: What about the articles themselves?**
All editorial content is human-written. The AI built the house; I write what goes inside.

**Q: Would you do this again?**
Absolutely. The parallel agent workflow (8 agents across 3 worktrees) is genuinely faster than traditional development for this type of project.

**Q: What's the catch?**
Context windows. Long debugging sessions require careful prompt engineering to keep the AI focused. The [CLAUDE.md](CLAUDE.md) file exists specifically to maintain context across sessions.

---

<div align="center">

## License

MIT — Do what you want.

---

*Built with [Claude Code](https://claude.ai/code) over one very productive weekend.*

*If you made it this far, you might enjoy the [actual blog](https://chris.dilger.me).*

```
        ┌──────────────────────────────────────────────────────────┐
        │                                                          │
        │   "The best code is the code you didn't have to write"   │
        │                                                          │
        │                    — taken literally                     │
        │                                                          │
        └──────────────────────────────────────────────────────────┘
```

</div>
