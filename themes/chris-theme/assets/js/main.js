// Chris Theme - Main JavaScript
// Lenis smooth scroll + GSAP ScrollTrigger integration

(function() {
    'use strict';

    // Check for reduced motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isMobile = window.innerWidth <= 768;

    // Store references globally for scene scripts to access
    window.ChrisTheme = {
        lenis: null,
        prefersReducedMotion: prefersReducedMotion,
        gsap: typeof gsap !== 'undefined' ? gsap : null,
        ScrollTrigger: typeof ScrollTrigger !== 'undefined' ? ScrollTrigger : null
    };

    // Skip smooth scroll initialization if user prefers reduced motion
    if (prefersReducedMotion) {
        console.log('Chris Theme: Reduced motion preference detected, smooth scroll disabled');
        document.documentElement.classList.add('reduced-motion');
        // Still show hero content
        showHeroContent();
        // Still provide scroll parallax at full intensity
        // IMPORTANT: Do NOT reduce intensity - parallax should be consistent everywhere
        document.addEventListener('DOMContentLoaded', () => initScrollParallax());
        return;
    }

    // Initialize Lenis smooth scroll
    function initLenis() {
        if (typeof Lenis === 'undefined') {
            console.warn('Chris Theme: Lenis not loaded');
            return null;
        }

        const lenis = new Lenis({
            duration: 1.2,
            easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), // easeOutExpo
            orientation: 'vertical',
            gestureOrientation: 'vertical',
            smoothWheel: true,
            wheelMultiplier: 1,
            touchMultiplier: 2,
            infinite: false,
        });

        return lenis;
    }

    // Initialize GSAP ScrollTrigger and sync with Lenis
    function initScrollTrigger(lenis) {
        if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') {
            console.warn('Chris Theme: GSAP/ScrollTrigger not loaded');
            return;
        }

        // Register ScrollTrigger plugin
        gsap.registerPlugin(ScrollTrigger);

        // Sync Lenis scroll with ScrollTrigger
        lenis.on('scroll', ScrollTrigger.update);

        // Use GSAP ticker for smooth RAF loop
        gsap.ticker.add((time) => {
            lenis.raf(time * 1000);
        });

        // Disable GSAP lag smoothing for consistent performance
        gsap.ticker.lagSmoothing(0);

        console.log('Chris Theme: ScrollTrigger synced with Lenis');
    }

    // Show hero content without animation (for reduced motion)
    function showHeroContent() {
        const hero = document.querySelector('.hero--parallax');
        if (hero) {
            // Ensure hero is fully visible (no clip-path)
            hero.style.clipPath = 'none';
        }
        const heroElements = document.querySelectorAll('.hero--parallax [data-animate]');
        heroElements.forEach(el => {
            el.style.opacity = '1';
            el.style.transform = 'none';
        });
    }

    // ========================================
    // UNIVERSAL SCROLL PARALLAX
    // ========================================
    // Subtle X/Y movement on scroll for images
    // Works on ALL devices and fallback modes - this is the baseline experience
    // that users always get, even when fancier effects fail
    //
    // IMPORTANT: Do NOT reduce intensity for mobile or reduced motion.
    // This effect should be consistent across all devices and modes.
    // The parallax values are already tuned per-element via data attributes.
    function initScrollParallax() {
        const parallaxElements = document.querySelectorAll('[data-scroll-parallax]');
        if (parallaxElements.length === 0) return;

        // Try GSAP ScrollTrigger first (best integration with Lenis)
        if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
            gsap.registerPlugin(ScrollTrigger);

            parallaxElements.forEach(el => {
                // Get custom values from data attributes or use defaults
                // Default values should be PRONOUNCED - clearly visible parallax
                const xAmount = parseFloat(el.dataset.scrollParallaxX) || 25;
                const yAmount = parseFloat(el.dataset.scrollParallaxY) || 50;

                // Set initial scale (image slightly larger to allow movement without gaps)
                gsap.set(el, { scale: 1.15 });

                // Create the scroll-driven parallax animation
                gsap.to(el, {
                    x: xAmount,
                    y: -yAmount, // Negative = moves up as you scroll down
                    scale: 1.15, // Maintain scale during animation
                    ease: 'none',
                    scrollTrigger: {
                        trigger: el,
                        start: 'top bottom',
                        end: 'bottom top',
                        scrub: 0.5, // Smooth but responsive
                    }
                });
            });

            console.log('Chris Theme: Scroll parallax initialized (GSAP)', parallaxElements.length, 'elements');
        } else {
            // Vanilla JS fallback - works without any libraries
            initScrollParallaxFallback(parallaxElements);
        }
    }

    // Vanilla JS scroll parallax fallback
    // IMPORTANT: Do NOT add intensity multipliers here - keep full effect
    function initScrollParallaxFallback(elements) {
        let ticking = false;

        function updateParallax() {
            const viewportHeight = window.innerHeight;

            elements.forEach(el => {
                const rect = el.getBoundingClientRect();
                const elementCenter = rect.top + rect.height / 2;

                // Progress: -1 when element at bottom of viewport, 1 when at top
                const progress = (1 - (elementCenter / viewportHeight)) * 2 - 1;

                // Default values should be PRONOUNCED - clearly visible parallax
                const xAmount = parseFloat(el.dataset.scrollParallaxX) || 25;
                const yAmount = parseFloat(el.dataset.scrollParallaxY) || 50;

                // Full intensity - progress maps to half the configured amount at extremes
                const x = progress * xAmount * 0.5;
                const y = progress * -yAmount * 0.5;

                // Include scale to prevent gaps during movement
                el.style.transform = `translate3d(${x}px, ${y}px, 0) scale(1.15)`;
            });

            ticking = false;
        }

        window.addEventListener('scroll', () => {
            if (!ticking) {
                requestAnimationFrame(updateParallax);
                ticking = true;
            }
        }, { passive: true });

        // Initial update
        updateParallax();
        console.log('Chris Theme: Scroll parallax initialized (fallback)', elements.length, 'elements');
    }

    // ========================================
    // SCROLL-CAPTURED CHOREOGRAPHY SYSTEM
    // ========================================
    // This is the FOUNDATION for all motion work.
    // Key concepts:
    //   - pin: true = page doesn't move during sequence
    //   - scrub: 1 = scroll position drives animation progress
    //   - Timeline = choreographed sequence of element animations
    //
    // See LANDING_PAGE_SKETCH.md "CRITICAL: Scroll-Captured Choreography"

    function initHeroParallax() {
        const hero = document.querySelector('.hero--parallax');
        if (!hero || typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') {
            showHeroContent();
            return;
        }

        // Elements for choreography
        const heroTitle = hero.querySelector('.hero__title');
        const heroSubtitle = hero.querySelector('.hero__subtitle');
        const heroCta = hero.querySelector('.hero__cta');
        const heroContent = hero.querySelector('.hero__content');
        const scrollIndicator = hero.querySelector('.hero__scroll-indicator');
        const layers = hero.querySelectorAll('.hero__layer[data-parallax-speed]');

        // Parallax speed multiplier (reduce on mobile for better UX)
        const parallaxMultiplier = isMobile ? 0.5 : 1;

        // Set initial states for choreographed elements
        gsap.set([heroTitle, heroSubtitle, heroCta], {
            opacity: 0,
            y: 50
        });
        if (scrollIndicator) {
            gsap.set(scrollIndicator, { opacity: 0, y: 20 });
        }

        // ========================================
        // PINNED HERO CHOREOGRAPHY TIMELINE
        // ========================================
        // User scrolls ~2000px but hero stays PINNED
        // Scroll progress (0-100%) maps to animation phases:
        //   0-15%:  Title fades/slides in
        //   15-30%: Subtitle fades/slides in
        //   30-45%: CTA buttons fade/slide in
        //   45-55%: Scroll indicator appears, hold moment
        //   55-75%: Content holds (user reads)
        //   75-100%: Hero slides UP and OUT, unpin

        // Set hero content visible IMMEDIATELY on load
        // User wants content "there on load" - no entry animation needed
        gsap.set([heroTitle, heroSubtitle, heroCta], {
            opacity: 1,
            y: 0
        });
        if (scrollIndicator) {
            gsap.set(scrollIndicator, { opacity: 1, y: 0 });
        }

        // ═══════════════════════════════════════════════════════════════════════════
        // 🚨 CRITICAL FIX: HERO SCROLL-BACK VISIBILITY 🚨
        // ═══════════════════════════════════════════════════════════════════════════
        // This fix has been reverted multiple times. DO NOT CHANGE without understanding:
        //
        // PROBLEM: When user scrolls down past Hero, then scrolls back to top,
        //          the "Chris Dilger" content stays hidden (clipPath: inset(0 0 100% 0))
        //
        // ROOT CAUSES (all three must be addressed):
        //
        // 1. scrub: true (NOT scrub: 1)
        //    - scrub: 1 adds 1-second smoothing delay, causing desync on rapid scroll
        //    - scrub: true = immediate sync, reliable reversal
        //    - ❌ WRONG: scrub: 1   ✅ CORRECT: scrub: true
        //
        // 2. onLeaveBack callback (REQUIRED)
        //    - Without this, GSAP doesn't reset clipPath when scrolling back past trigger
        //    - This callback explicitly resets hero to visible state
        //    - ❌ WRONG: no onLeaveBack   ✅ CORRECT: onLeaveBack resets clipPath
        //
        // 3. fromTo() with explicit start value (NOT to())
        //    - to() only defines end state; GSAP guesses start state on reversal
        //    - fromTo() explicitly defines both states for reliable reversal
        //    - ❌ WRONG: .to(hero, {clipPath: '...'})
        //    - ✅ CORRECT: .fromTo(hero, {clipPath: '0%'}, {clipPath: '100%'})
        //
        // TEST: Scroll to bottom of page, then scroll back to top.
        //       "Chris Dilger" title MUST be visible.
        // ═══════════════════════════════════════════════════════════════════════════

        // Set explicit initial clipPath so GSAP can properly reverse
        gsap.set(hero, { clipPath: 'inset(0 0 0% 0)' });

        const heroTimeline = gsap.timeline({
            scrollTrigger: {
                trigger: hero,
                start: 'top top',
                end: '+=800',   // Compressed: 800px of scroll (was 2000)
                pin: true,      // 🔥 NON-NEGOTIABLE: Page stays fixed

                // 🚨 CRITICAL: Must be `true`, NOT a number like `1`
                // scrub: 1 adds smoothing delay that breaks scroll-back reversal
                scrub: true,

                anticipatePin: 1, // Smoother pin initiation
                invalidateOnRefresh: true, // Recalculate on resize/refresh

                // 🚨 CRITICAL: onUpdate ensures hero is visible when scrolling back
                // This handles edge cases where onLeaveBack might not fire correctly
                // (e.g., rapid scrolling from bottom of page back to top)
                onUpdate: (self) => {
                    // When progress is near 0 (at or near start), ensure hero is fully visible
                    if (self.progress < 0.05) {
                        gsap.set(hero, { clipPath: 'inset(0 0 0% 0)' });
                        if (scrollIndicator) {
                            gsap.set(scrollIndicator, { opacity: 1 });
                        }
                    }
                },

                // 🚨 CRITICAL: This callback is REQUIRED for scroll-back to work
                // Without it, hero stays clipped (hidden) when returning to top
                onLeaveBack: () => {
                    gsap.set(hero, { clipPath: 'inset(0 0 0% 0)' });
                    if (scrollIndicator) {
                        gsap.set(scrollIndicator, { opacity: 1 });
                    }
                },
            }
        });

        // Content is already visible - brief hold (40% = 320px)
        // User can read, then we get moving
        heroTimeline.to({}, { duration: 0.40 });

        // Scroll indicator fades out (65% - 70% = 1300-1400px)
        if (scrollIndicator) {
            heroTimeline.to(scrollIndicator, {
                opacity: 0,
                duration: 0.05,
                ease: 'power2.in'
            });
        }

        // Hero content slides UP and exits (70% - 100% = 1400-2000px)
        // Using clip-path for a "peel away" effect
        //
        // 🚨 CRITICAL: Must use fromTo() NOT to()
        // to() only defines end state; GSAP guesses start on reversal (often wrong)
        // fromTo() explicitly defines both states = reliable reversal
        heroTimeline.fromTo(hero,
            { clipPath: 'inset(0 0 0% 0)' },   // Start: fully visible
            { clipPath: 'inset(0 0 100% 0)', duration: 0.30, ease: 'power2.inOut' }  // End: clipped away
        );

        // ========================================
        // PARALLAX LAYERS (runs alongside main timeline)
        // ========================================
        // Layers move at different speeds during the pinned sequence
        layers.forEach(layer => {
            const speed = parseFloat(layer.dataset.parallaxSpeed) * parallaxMultiplier;
            if (speed === 0) return;

            gsap.to(layer, {
                yPercent: speed * -30,
                ease: 'none',
                scrollTrigger: {
                    trigger: hero,
                    start: 'top top',
                    end: '+=800',  // Match compressed hero timeline
                    scrub: true,
                }
            });
        });

        console.log('Chris Theme: Hero scroll-captured choreography initialized (pin: true, scrub: 1)');
    }

    // ========================================
    // CODER SECTION CHOREOGRAPHY (PINNED)
    // ========================================
    // Like Hero, this section is PINNED - page doesn't scroll, scroll drives animation.
    // Timeline:
    //   0-20%:  Header slides in from left
    //   10-40%: Content elements slide in from right (staggered)
    //   20-30%: White overlay fades in (for text readability)
    //   40-65%: Hold - user reads content
    //   65-70%: White overlay fades out
    //   70-100%: Content exits, preparing for windswept transition
    function initCoderChoreography() {
        const coderSection = document.querySelector('.scene--coder');
        if (!coderSection || typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') {
            return;
        }

        const header = coderSection.querySelector('.scene__header');
        const content = coderSection.querySelector('.coder__content');

        if (!header || !content) {
            return;
        }

        // Get all content elements
        const keyboard = content.querySelector('.coder__keyboard');
        const codeWindow = content.querySelector('.coder__code');
        const github = content.querySelector('.coder__github');
        const contentElements = [keyboard, codeWindow, github].filter(Boolean);

        // Set initial states (hidden)
        gsap.set(header, { opacity: 0, x: -80, y: 0 });
        gsap.set(content, { y: 0, opacity: 1 }); // Content container for scroll-up
        gsap.set(contentElements, { opacity: 0, x: 100 });

        // Create white overlay for readability (like Claude Codes dark overlay)
        let whiteOverlay = coderSection.querySelector('.coder__overlay');
        if (!whiteOverlay) {
            whiteOverlay = document.createElement('div');
            whiteOverlay.className = 'coder__overlay';
            coderSection.appendChild(whiteOverlay);
        }
        gsap.set(whiteOverlay, { opacity: 0 });

        // ========================================
        // PINNED SCROLL-CAPTURED TIMELINE
        // ========================================
        // Track if we've exited forward (to prevent re-showing on scroll back from below)
        let hasExitedForward = false;

        // Use shorter scroll distance on mobile since content is simplified
        const isMobile = window.innerWidth <= 768;
        const scrollDistance = isMobile ? 1000 : 1500;

        const coderTimeline = gsap.timeline({
            scrollTrigger: {
                trigger: coderSection,
                start: 'top top',
                end: `+=${scrollDistance}`,  // Responsive scroll distance
                pin: true,      // 🔥 PAGE STAYS FIXED
                scrub: true,    // 🔥 SCROLL DRIVES TIMELINE (true = immediate, no smoothing)
                anticipatePin: 1,

                // When exiting forward (scrolling down past section)
                onLeave: () => {
                    hasExitedForward = true;
                    // Ensure content stays hidden at exit position
                    gsap.set(header, { opacity: 0, x: -120, y: -170 });
                    gsap.set(content, { opacity: 0, y: -200 });
                    gsap.set(contentElements, { opacity: 0 });
                    gsap.set(whiteOverlay, { opacity: 0 });
                },

                // When scrolling back UP into section from below
                onEnterBack: () => {
                    // Content should already be at exit state from onLeave
                    // Timeline will animate it as user scrolls back
                },

                // When scrolling back UP past the start (returning to Hero)
                onLeaveBack: () => {
                    hasExitedForward = false;
                    // Reset to initial hidden state
                    gsap.set(header, { opacity: 0, x: -80, y: 0 });
                    gsap.set(content, { y: 0, opacity: 1 });
                    gsap.set(contentElements, { opacity: 0, x: 100 });
                    gsap.set(whiteOverlay, { opacity: 0 });
                },
            }
        });

        // Phase 1: Header enters from left (0% - 20%)
        coderTimeline.to(header, {
            opacity: 1,
            x: 0,
            duration: 0.2,
            ease: 'power2.out',
        }, 0);

        // Phase 2: Content enters from right with stagger (10% - 40%)
        coderTimeline.to(contentElements, {
            opacity: 1,
            x: 0,
            duration: 0.25,
            ease: 'power2.out',
            stagger: 0.05,
        }, 0.1); // Start at 10%

        // Phase 2b: White overlay fades in AFTER text starts showing (20% - 30%)
        // Subtle opacity for text depth/readability - behind all content
        coderTimeline.to(whiteOverlay, {
            opacity: 0.5,  // Subtle white tint (very light)
            duration: 0.10,
            ease: 'power2.out',
        }, 0.20);

        // Phase 3: Content scrolls UP to reveal GitHub section (40% - 70%)
        // This ensures GitHub Activity is visible on all aspect ratios
        const scrollUpAmount = isMobile ? 0 : -120; // Only scroll on desktop (mobile already shows GitHub)
        coderTimeline.to(content, {
            y: scrollUpAmount,
            duration: 0.30,
            ease: 'power2.inOut',
        }, 0.40);

        // Also scroll header up to keep alignment
        coderTimeline.to(header, {
            y: scrollUpAmount,
            duration: 0.30,
            ease: 'power2.inOut',
        }, 0.40);

        // Phase 3b: White overlay fades out BEFORE content exits (85% - 90%)
        coderTimeline.to(whiteOverlay, {
            opacity: 0,
            duration: 0.05,
            ease: 'power2.in',
        }, 0.85);

        // Phase 4: Content exits - header out left, content fades (90% - 100%)
        coderTimeline.to(header, {
            opacity: 0,
            x: -120,
            y: scrollUpAmount - 50, // Continue upward motion
            duration: 0.10,
            ease: 'power2.in',
        }, 0.90);

        coderTimeline.to(content, {
            opacity: 0,
            y: scrollUpAmount - 80, // Continue upward motion
            duration: 0.10,
            ease: 'power2.in',
        }, 0.90);

        console.log('Chris Theme: Coder section choreography initialized (pin: true, scrub: true, with onLeave/onLeaveBack)');
    }

    // ========================================
    // CLAUDE CODES SECTION CHOREOGRAPHY (PINNED)
    // ========================================
    // Like Hero and Coder, this section is PINNED.
    // Timeline:
    //   0-5%:   Dark overlay fades in (for readability)
    //   0-8%:   Header fades in
    //   8-30%:  Terminals spawn in with stagger
    //   28-35%: CTA appears
    //   35-45%: Hold - view full section
    //   45-60%: Terminals scroll UP behind header, CTA stays prominent
    //   60-70%: Hold - CTA prominently visible
    //   70-80%: Exit - content fades out, terminals fly back
    //   80-95%: CRT shutdown effect
    //   95-100%: Transition to Speaker
    function initClaudeCodesChoreography() {
        const claudeCodesSection = document.querySelector('.scene--claude-codes');
        if (!claudeCodesSection || typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') {
            return;
        }

        const header = claudeCodesSection.querySelector('.scene__header');
        const terminalGrid = claudeCodesSection.querySelector('.terminal-grid');
        const terminals = claudeCodesSection.querySelectorAll('.terminal');
        const cta = claudeCodesSection.querySelector('.claude-codes__cta');
        const speakerSection = document.getElementById('speaker');

        if (!header || !terminalGrid) {
            return;
        }

        // Create dark overlay for readability
        let darkOverlay = claudeCodesSection.querySelector('.claude-codes__overlay');
        if (!darkOverlay) {
            darkOverlay = document.createElement('div');
            darkOverlay.className = 'claude-codes__overlay';
            claudeCodesSection.appendChild(darkOverlay);
        }

        // Create CRT shutdown overlay
        let crtOverlay = claudeCodesSection.querySelector('.crt-shutdown-overlay');
        if (!crtOverlay) {
            crtOverlay = document.createElement('div');
            crtOverlay.className = 'crt-shutdown-overlay';
            crtOverlay.innerHTML = '<div class="crt-line"></div>';
            claudeCodesSection.appendChild(crtOverlay);
        }

        // Set initial states (hidden)
        gsap.set(darkOverlay, { opacity: 0 });
        gsap.set(crtOverlay, { opacity: 0 });
        gsap.set(header, { opacity: 0, y: 30 });
        gsap.set(terminalGrid, { y: 0 }); // Track grid position for scroll-up
        gsap.set(terminals, { opacity: 0, scale: 0.8, y: 50 });
        if (cta) gsap.set(cta, { opacity: 0, y: 20 });

        // ========================================
        // PINNED SCROLL-CAPTURED TIMELINE
        // ========================================
        // Track if CRT kick has been triggered (prevent multiple triggers)
        let crtKickTriggered = false;

        // Use shorter scroll distance on mobile (fewer terminals, simpler layout)
        const isMobile = window.innerWidth <= 768;
        const scrollDistance = isMobile ? 1500 : 2500;

        const claudeCodesTimeline = gsap.timeline({
            scrollTrigger: {
                trigger: claudeCodesSection,
                start: 'top top',
                end: `+=${scrollDistance}`,  // Responsive scroll distance
                pin: true,      // 🔥 PAGE STAYS FIXED
                scrub: true,    // 🔥 SCROLL DRIVES TIMELINE (true = immediate sync, no smoothing)
                anticipatePin: 1,
                onUpdate: (self) => {
                    // CRT "kick" - when animation reaches 90%, auto-scroll to next section
                    // This creates the effect of the CRT turning off and "launching" you forward
                    if (self.progress >= 0.90 && !crtKickTriggered && self.direction === 1) {
                        crtKickTriggered = true;

                        // Smooth scroll kick to Speaker section
                        if (speakerSection && window.ChrisTheme?.lenis) {
                            window.ChrisTheme.lenis.scrollTo(speakerSection, {
                                duration: 0.6,
                                easing: (t) => 1 - Math.pow(1 - t, 3) // ease-out-cubic
                            });
                        }
                    }

                    // Reset kick flag when scrolling back (allows re-trigger)
                    if (self.progress < 0.85 && crtKickTriggered) {
                        crtKickTriggered = false;
                    }
                },
                onLeave: () => {
                    // Pause typing animation when leaving section
                    if (window.ChrisTheme?.pauseChaosTyping) {
                        window.ChrisTheme.pauseChaosTyping();
                    }

                    // Ensure content stays hidden after exiting forward
                    gsap.set(header, { opacity: 0, y: -400 });
                    gsap.set(terminals, { opacity: 0, scale: 0.8 });
                    gsap.set(terminalGrid, { y: -400 });
                    if (cta) gsap.set(cta, { opacity: 0 });
                    gsap.set(darkOverlay, { opacity: 0 });
                    gsap.set(crtOverlay, { opacity: 0 });

                    // Backup: ensure we reach Speaker if kick didn't fire
                    if (speakerSection && window.ChrisTheme?.lenis) {
                        window.ChrisTheme.lenis.scrollTo(speakerSection, {
                            duration: 0.3,
                            easing: (t) => 1 - Math.pow(1 - t, 3)
                        });
                    }
                },
                onEnterBack: () => {
                    // Resume typing animation when scrolling back into section
                    if (window.ChrisTheme?.resumeChaosTyping) {
                        window.ChrisTheme.resumeChaosTyping();
                    }
                },
                onLeaveBack: () => {
                    // Pause typing animation when leaving section backwards
                    if (window.ChrisTheme?.pauseChaosTyping) {
                        window.ChrisTheme.pauseChaosTyping();
                    }

                    // Reset to initial hidden state when scrolling back past start
                    crtKickTriggered = false;
                    gsap.set(darkOverlay, { opacity: 0 });
                    gsap.set(crtOverlay, { opacity: 0 });
                    gsap.set(header, { opacity: 0, y: 30 });
                    gsap.set(terminalGrid, { y: 0 });
                    gsap.set(terminals, { opacity: 0, scale: 0.8, y: 50 });
                    if (cta) gsap.set(cta, { opacity: 0, y: 20 });
                }
            }
        });

        // Phase 1a: Dark overlay fades in FIRST (0% - 5%)
        claudeCodesTimeline.to(darkOverlay, {
            opacity: 1,
            duration: 0.05,
            ease: 'power2.out',
        }, 0);

        // Phase 1b: Header enters (0% - 8%)
        claudeCodesTimeline.to(header, {
            opacity: 1,
            y: 0,
            duration: 0.08,
            ease: 'power2.out',
        }, 0);

        // Phase 2: Terminals spawn with stagger (8% - 30%)
        // NOTE: Terminal typing animation is triggered when this completes
        claudeCodesTimeline.to(terminals, {
            opacity: 1,
            scale: 1,
            y: 0,
            duration: 0.20,
            ease: 'back.out(1.4)',
            stagger: 0.02,
            onComplete: () => {
                // Start the chaos terminal typing animation once terminals are visible
                if (window.ChrisTheme?.startChaosTyping) {
                    window.ChrisTheme.startChaosTyping();
                }
            }
        }, 0.08);

        // Phase 3: CTA appears (28% - 35%)
        if (cta) {
            claudeCodesTimeline.to(cta, {
                opacity: 1,
                y: 0,
                duration: 0.07,
                ease: 'power2.out',
            }, 0.28);
        }

        // Phase 4: Hold for viewing chaos animation and CTA (35% - 55%)
        // Extended hold to ensure CTA is visible on all screen sizes before scroll-up
        claudeCodesTimeline.to({}, { duration: 0.20 });

        // Phase 5: ALL CONTENT scrolls UP together (55% - 75%)
        // Header, terminals, and CTA all move up as a unified scroll effect
        // This continues until the TV close animation
        const scrollUpDistance = -400; // Total scroll distance
        const scrollUpDuration = 0.20; // 55% to 75%
        const scrollUpStart = 0.55;

        // Terminal grid scrolls up
        claudeCodesTimeline.to(terminalGrid, {
            y: scrollUpDistance,
            duration: scrollUpDuration,
            ease: 'power1.inOut',
        }, scrollUpStart);

        // Header scrolls up at the same time
        claudeCodesTimeline.to(header, {
            y: scrollUpDistance,
            duration: scrollUpDuration,
            ease: 'power1.inOut',
        }, scrollUpStart);

        // CTA scrolls up at the same time
        if (cta) {
            claudeCodesTimeline.to(cta, {
                y: scrollUpDistance,
                duration: scrollUpDuration,
                ease: 'power1.inOut',
            }, scrollUpStart);
        }

        // Phase 6: Content fades out while still scrolled up (75% - 80%)
        claudeCodesTimeline.to([header, cta].filter(Boolean), {
            opacity: 0,
            duration: 0.05,
            ease: 'power2.in',
        }, 0.75);

        // Terminals fade out (75% - 80%)
        claudeCodesTimeline.to(terminals, {
            opacity: 0,
            scale: 0.8,
            duration: 0.05,
            ease: 'power2.in',
            stagger: 0.005,
        }, 0.75);

        // Phase 7: Dark overlay fades out as CRT begins (80% - 83%)
        claudeCodesTimeline.to(darkOverlay, {
            opacity: 0,
            duration: 0.03,
            ease: 'power2.in',
        }, 0.80);

        // Phase 8: CRT shutdown effect (80% - 92%)
        claudeCodesTimeline.to(crtOverlay, {
            opacity: 1,
            duration: 0.03,
        }, 0.80);

        claudeCodesTimeline.to(crtOverlay.querySelector('.crt-line'), {
            scaleY: 0,
            duration: 0.12,
            ease: 'power2.in',
        }, 0.80);

        // Hold at black briefly (92% - 95%)
        claudeCodesTimeline.to({}, { duration: 0.03 }, 0.92);

        // CRT overlay fades out (95% - 100%)
        claudeCodesTimeline.to(crtOverlay, {
            opacity: 0,
            duration: 0.05,
        }, 0.95);

        console.log('Chris Theme: Claude Codes section choreography initialized (pin: true, scrub: true, with onLeave/onLeaveBack)');
    }

    // Initialize scene scroll animations (Speaker, Projects, etc.)
    function initSceneAnimations() {
        if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') {
            // Show all animated content immediately
            document.querySelectorAll('[data-animate]').forEach(el => {
                el.style.opacity = '1';
                el.style.transform = 'none';
            });
            return;
        }

        // Generic fade-up animation for elements with data-animate="fade-up"
        // EXCLUDE elements in pinned sections (Hero, Coder, Claude Codes) - they have their own choreography
        const fadeUpElements = document.querySelectorAll('[data-animate="fade-up"]:not(.hero--parallax [data-animate]):not(.scene--coder [data-animate]):not(.scene--claude-codes [data-animate])');

        fadeUpElements.forEach(el => {
            const delay = parseFloat(el.dataset.animateDelay) || 0;

            gsap.fromTo(el,
                {
                    opacity: 0,
                    y: 30,
                },
                {
                    opacity: 1,
                    y: 0,
                    duration: 0.6,
                    ease: 'power2.out',
                    delay: delay,
                    scrollTrigger: {
                        trigger: el,
                        start: 'top 85%',
                        toggleActions: 'play none none none',
                    }
                }
            );
        });

        // Speaker gallery staggered animation
        const speakerGallery = document.querySelector('.speaker__gallery[data-animate="stagger"]');
        if (speakerGallery) {
            const photos = speakerGallery.querySelectorAll('.speaker__photo');

            gsap.fromTo(photos,
                {
                    opacity: 0,
                    y: 30,
                    rotation: () => gsap.utils.random(-3, 3), // Random slight rotation
                },
                {
                    opacity: 1,
                    y: 0,
                    rotation: 0,
                    duration: 0.6,
                    ease: 'power2.out',
                    stagger: 0.15,
                    scrollTrigger: {
                        trigger: speakerGallery,
                        start: 'top 80%',
                        toggleActions: 'play none none none',
                    }
                }
            );
        }

        // Project cards staggered animation
        const projectCards = document.querySelectorAll('.project-card[data-animate="fade-up"]');
        if (projectCards.length > 0) {
            gsap.fromTo(projectCards,
                {
                    opacity: 0,
                    y: 30,
                },
                {
                    opacity: 1,
                    y: 0,
                    duration: 0.6,
                    ease: 'power2.out',
                    stagger: 0.1,
                    scrollTrigger: {
                        trigger: projectCards[0].closest('.projects-grid'),
                        start: 'top 80%',
                        toggleActions: 'play none none none',
                    }
                }
            );
        }

        // Terminal grid - CHAOS TERMINAL ANIMATION (8 Claude Codes scene)
        // Typing effect, rotating focus, never-ending loop, active chaos energy
        const terminalGrid = document.querySelector('.terminal-grid[data-animate="stagger"]');
        if (terminalGrid) {
            initChaosTerminals(terminalGrid);
        }

        // Code lines staggered animation - SKIP for pinned Coder section
        // The Coder section now has pinned choreography that animates the whole code window
        // Individual code lines are visible once the window appears

        // Content Creator 3D YouTube embed animation
        // Classic TV turn-on effect: horizontal line → expand → flash → reveal
        const youtube3dContainer = document.querySelector('.youtube-3d-container');
        if (youtube3dContainer) {
            const embed = youtube3dContainer.querySelector('lite-youtube');
            const wrapper = youtube3dContainer.querySelector('.embed--3d');

            if (embed && wrapper) {
                // Check for reduced motion preference
                const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

                if (prefersReducedMotion) {
                    // Reduced motion: just show the video instantly, no animation
                    youtube3dContainer.classList.add('animation-complete');
                    return; // Skip animation setup entirely
                }

                // Create minimal effect elements for TV turn-on
                const flash = document.createElement('div');
                flash.className = 'youtube-flash';

                const scanlines = document.createElement('div');
                scanlines.className = 'youtube-scanlines';

                const glare = document.createElement('div');
                glare.className = 'youtube-glare';

                // Append elements
                embed.appendChild(flash);
                embed.appendChild(scanlines);
                embed.appendChild(glare);

                // Set initial state: thin horizontal line (scaleY very small)
                gsap.set(embed, {
                    scaleY: 0.01,      // Thin horizontal line
                    scaleX: 0.8,       // Slightly narrower
                    opacity: 0,
                    filter: 'brightness(2)',
                    transformPerspective: 1500,
                    transformOrigin: 'center center',
                });

                // Simple TV turn-on timeline
                const tl = gsap.timeline({
                    scrollTrigger: {
                        trigger: youtube3dContainer,
                        start: 'top 80%',
                        toggleActions: 'play none none none',
                    },
                    onComplete: () => {
                        youtube3dContainer.classList.add('animation-complete');
                    }
                });

                // STAGE 1: Thin horizontal line appears (CRT power-on start)
                tl.to(embed, {
                    opacity: 1,
                    filter: 'brightness(3)',
                    duration: 0.1,
                    ease: 'power2.in',
                })

                // STAGE 2: Line expands vertically (classic TV effect)
                .to(embed, {
                    scaleY: 1,
                    scaleX: 1,
                    filter: 'brightness(1.5)',
                    duration: 0.25,
                    ease: 'power2.out',
                })

                // STAGE 3: Brief white flash
                .to(flash, {
                    opacity: 0.7,
                    duration: 0.05,
                })
                .to(flash, {
                    opacity: 0,
                    duration: 0.15,
                    ease: 'power2.out',
                })

                // STAGE 4: Color normalizes, scanlines appear briefly
                .to(embed, {
                    filter: 'brightness(1)',
                    duration: 0.2,
                    ease: 'power1.out',
                }, '-=0.1')

                .to(scanlines, {
                    opacity: 0.3,
                    duration: 0.1,
                }, '-=0.15')
                .to(glare, {
                    opacity: 1,
                    duration: 0.15,
                }, '-=0.1')

                // STAGE 5: Scanlines fade to subtle, glare stays
                .to(scanlines, {
                    opacity: 0.08,
                    duration: 0.4,
                    ease: 'power1.out',
                })
                // STAGE 6: Smoothly transition to final CSS transform
                // Must match CSS: transform: perspective(1500px) translateZ(0)
                .to(embed, {
                    transform: 'perspective(1500px) translateZ(0)',
                    filter: 'none',
                    duration: 0.4,
                    ease: 'power2.out',
                    onComplete: () => {
                        // Clear GSAP inline styles so CSS takes over
                        gsap.set(embed, { clearProps: 'transform,filter' });
                    }
                });
            }
        }

        // Dev Playground tiles staggered animation
        const playgroundTiles = document.querySelectorAll('.playground-tile[data-animate="fade-up"]');
        if (playgroundTiles.length > 0) {
            gsap.fromTo(playgroundTiles,
                {
                    opacity: 0,
                    y: 20,
                },
                {
                    opacity: 1,
                    y: 0,
                    duration: 0.4,
                    ease: 'power2.out',
                    stagger: 0.08,
                    scrollTrigger: {
                        trigger: playgroundTiles[0].closest('.playground-grid'),
                        start: 'top 85%',
                        toggleActions: 'play none none none',
                    }
                }
            );
        }

        console.log('Chris Theme: Scene animations initialized');
    }

    // Generate GitHub contribution graph
    function generateGitHubGraph() {
        const graphGrid = document.querySelector('[data-github-graph]');
        if (!graphGrid) return;

        // Generate 20 weeks x 7 days = 140 cells
        const weeks = 20;
        const days = 7;
        const totalCells = weeks * days;

        // Clear existing content
        graphGrid.innerHTML = '';

        // Generate cells with random contribution levels
        for (let i = 0; i < totalCells; i++) {
            const cell = document.createElement('span');
            cell.className = 'github-graph__cell';

            // Random contribution level (0-4), weighted toward lower values
            const rand = Math.random();
            let level;
            if (rand < 0.3) level = 0;
            else if (rand < 0.55) level = 1;
            else if (rand < 0.75) level = 2;
            else if (rand < 0.9) level = 3;
            else level = 4;

            if (level > 0) {
                cell.classList.add(`github-graph__cell--${level}`);
            }

            graphGrid.appendChild(cell);
        }

        // Animate cells on scroll if GSAP is available
        if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
            const cells = graphGrid.querySelectorAll('.github-graph__cell');
            gsap.fromTo(cells,
                {
                    scale: 0,
                    opacity: 0,
                },
                {
                    scale: 1,
                    opacity: 1,
                    duration: 0.3,
                    ease: 'back.out(2)',
                    stagger: {
                        amount: 0.8,
                        grid: [days, weeks],
                        from: 'start',
                    },
                    scrollTrigger: {
                        trigger: graphGrid,
                        start: 'top 85%',
                        toggleActions: 'play none none none',
                    }
                }
            );
        }

        console.log('Chris Theme: GitHub graph generated');
    }

    // Initialize project card video previews
    function initProjectVideos() {
        const projectCards = document.querySelectorAll('.project-card');

        projectCards.forEach(card => {
            const video = card.querySelector('.project-card__video');
            if (!video) return;

            // Play video on hover
            card.addEventListener('mouseenter', () => {
                video.play().catch(() => {
                    // Autoplay might be blocked, ignore error
                });
            });

            // Pause video when mouse leaves
            card.addEventListener('mouseleave', () => {
                video.pause();
                video.currentTime = 0;
            });
        });

        console.log('Chris Theme: Project video previews initialized');
    }

    // Initialize mobile accelerometer tilt effect for project cards
    function initAccelerometerTilt() {
        // Only run on touch devices
        if (!('DeviceOrientationEvent' in window) || !isMobile) return;

        const projectCards = document.querySelectorAll('.project-card');
        if (projectCards.length === 0) return;

        // Check if permission is needed (iOS 13+)
        if (typeof DeviceOrientationEvent.requestPermission === 'function') {
            // Need to request permission on user interaction
            const enableTilt = () => {
                DeviceOrientationEvent.requestPermission()
                    .then(permission => {
                        if (permission === 'granted') {
                            attachTiltHandler(projectCards);
                        }
                    })
                    .catch(console.error);
                document.removeEventListener('touchstart', enableTilt, { once: true });
            };
            document.addEventListener('touchstart', enableTilt, { once: true });
        } else {
            // Android or older iOS - no permission needed
            attachTiltHandler(projectCards);
        }

        console.log('Chris Theme: Accelerometer tilt initialized');
    }

    function attachTiltHandler(cards) {
        let isActive = false;

        // Use Intersection Observer to only apply tilt when cards are visible
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    isActive = true;
                } else {
                    isActive = false;
                    // Reset transform when not visible
                    cards.forEach(card => {
                        card.style.transform = '';
                    });
                }
            });
        }, { threshold: 0.1 });

        const projectsGrid = document.querySelector('.projects-grid');
        if (projectsGrid) {
            observer.observe(projectsGrid);
        }

        window.addEventListener('deviceorientation', (e) => {
            if (!isActive || prefersReducedMotion) return;

            // gamma: left-right tilt (-90 to 90)
            // beta: front-back tilt (-180 to 180)
            const tiltX = Math.max(-15, Math.min(15, e.gamma || 0)) / 15; // -1 to 1
            const tiltY = Math.max(-15, Math.min(15, (e.beta || 0) - 45)) / 15; // -1 to 1, offset for holding angle

            cards.forEach(card => {
                card.style.transform = `perspective(1000px) rotateX(${tiltY * 3}deg) rotateY(${tiltX * 3}deg)`;
            });
        }, { passive: true });
    }

    // Fetch GitHub repo data and populate cards
    function initGitHubRepoCards() {
        const repoCards = document.querySelectorAll('[data-github-repo]');
        if (repoCards.length === 0) return;

        // Language colors from GitHub's linguist
        const languageColors = {
            'JavaScript': '#f1e05a',
            'TypeScript': '#3178c6',
            'Python': '#3572A5',
            'Go': '#00ADD8',
            'Rust': '#dea584',
            'Swift': '#F05138',
            'Kotlin': '#A97BFF',
            'Java': '#b07219',
            'Ruby': '#701516',
            'CSS': '#563d7c',
            'HTML': '#e34c26',
            'Shell': '#89e051',
            'C': '#555555',
            'C++': '#f34b7d',
            'C#': '#178600',
        };

        repoCards.forEach(async (card) => {
            const repoPath = card.dataset.githubRepo;
            if (!repoPath) return;

            try {
                const response = await fetch(`https://api.github.com/repos/${repoPath}`);
                if (!response.ok) return;

                const data = await response.json();

                // Update description if placeholder exists
                const descEl = card.querySelector('[data-github-description]');
                if (descEl && data.description) {
                    descEl.textContent = data.description;
                }

                // Update stars
                const starsEl = card.querySelector('[data-github-stars] span:last-child');
                if (starsEl && data.stargazers_count !== undefined) {
                    starsEl.textContent = formatNumber(data.stargazers_count);
                }

                // Update forks
                const forksEl = card.querySelector('[data-github-forks] span:last-child');
                if (forksEl && data.forks_count !== undefined) {
                    forksEl.textContent = formatNumber(data.forks_count);
                }

                // Add language if not already present
                if (data.language) {
                    const existingLang = card.querySelector('.github-repo-card__stat--language');
                    if (!existingLang) {
                        const statsEl = card.querySelector('.github-repo-card__stats');
                        if (statsEl) {
                            const langStat = document.createElement('span');
                            langStat.className = 'github-repo-card__stat github-repo-card__stat--language';
                            const color = languageColors[data.language] || '#858585';
                            langStat.innerHTML = `<span class="github-repo-card__lang-dot" style="background-color: ${color}"></span>${data.language}`;
                            statsEl.appendChild(langStat);
                        }
                    }
                }

            } catch (error) {
                console.warn(`Failed to fetch GitHub repo data for ${repoPath}:`, error);
            }
        });

        console.log('Chris Theme: GitHub repo cards initialized');
    }

    // Format number with K/M suffix
    function formatNumber(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        }
        if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toString();
    }

    // Initialize reel navigator - circular article wheel
    function initReelNavigator() {
        const section = document.querySelector('.reel-navigator');
        const wheel = document.querySelector('.reel-navigator__wheel');
        const cards = document.querySelectorAll('.reel-card');
        const video = document.querySelector('.reel-navigator__video');

        if (!section || !wheel || cards.length === 0) return;

        // Skip animation for reduced motion - CSS handles grid fallback
        if (prefersReducedMotion) {
            console.log('Chris Theme: Reel navigator disabled (reduced motion)');
            return;
        }

        // Configuration for top-down wheel view
        const config = {
            radius: isMobile ? 280 : 380,           // Distance from center
            anglePerCard: 360 / cards.length,       // Angle between cards
            scrollMultiplier: isMobile ? 0.12 : 0.08, // Scroll sensitivity
            perspectiveCompression: 0.35            // Y-axis compression for top-down look
        };

        let currentRotation = 0;
        let targetRotation = 0;
        let velocity = 0;
        let isActive = false;
        let animationId = null;

        // Position cards around the wheel (top-down view)
        function positionCards() {
            cards.forEach((card, index) => {
                const angle = (config.anglePerCard * index) + currentRotation;
                const radian = (angle * Math.PI) / 180;

                // Polar to Cartesian for top-down view
                const x = Math.sin(radian) * config.radius;
                const y = Math.cos(radian) * config.radius;

                // Y position compressed for perspective (top-down look)
                const yCompressed = -y * config.perspectiveCompression;

                // Scale: larger at front (y > 0), smaller at back (y < 0)
                const normalizedY = (y + config.radius) / (config.radius * 2); // 0 to 1
                const scale = 0.5 + normalizedY * 0.5; // 0.5 to 1.0

                // Opacity: brighter at front, dimmer at back
                const opacity = 0.3 + normalizedY * 0.7; // 0.3 to 1.0

                // Z-index: front cards on top
                const zIndex = Math.round(normalizedY * 100);

                // Apply transforms
                card.style.transform = `
                    translateX(${x}px)
                    translateY(${yCompressed}px)
                    scale(${scale})
                `;
                card.style.opacity = opacity;
                card.style.zIndex = zIndex;
            });
        }

        // Animation loop with smooth easing
        function animate() {
            // Ease toward target
            const diff = targetRotation - currentRotation;
            currentRotation += diff * 0.1;

            // Apply velocity with friction/decay
            if (Math.abs(velocity) > 0.05) {
                targetRotation += velocity;
                velocity *= 0.94; // Friction - smooth mechanical feel
            }

            positionCards();
            animationId = requestAnimationFrame(animate);
        }

        // Scroll handler - rotate wheel
        function handleWheel(e) {
            if (!isActive) return;

            const delta = e.deltaY || e.deltaX || 0;
            velocity += delta * config.scrollMultiplier;
        }

        // Touch handling for mobile
        let touchStartX = 0;
        let touchStartY = 0;
        let touchStartTime = 0;
        let lastTouchX = 0;

        function handleTouchStart(e) {
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
            lastTouchX = touchStartX;
            touchStartTime = Date.now();
            velocity = 0; // Stop momentum
        }

        function handleTouchMove(e) {
            if (!isActive) return;

            const touchX = e.touches[0].clientX;
            const deltaX = lastTouchX - touchX;
            lastTouchX = touchX;

            // Rotate based on horizontal swipe
            targetRotation += deltaX * config.scrollMultiplier * 2.5;
        }

        function handleTouchEnd(e) {
            const touchEndX = e.changedTouches[0].clientX;
            const elapsed = Date.now() - touchStartTime;
            const distance = touchStartX - touchEndX;

            // Fast swipe = add momentum
            if (elapsed < 300 && Math.abs(distance) > 40) {
                velocity = (distance / elapsed) * 8;
            }
        }

        // Keyboard navigation
        function handleKeyboard(e) {
            if (!isActive) return;

            if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                targetRotation += config.anglePerCard;
                e.preventDefault();
            } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                targetRotation -= config.anglePerCard;
                e.preventDefault();
            }
        }

        // Intersection Observer for activation
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                isActive = entry.isIntersecting && entry.intersectionRatio > 0.2;

                // Manage video playback
                if (video) {
                    if (entry.isIntersecting) {
                        video.play().catch(() => {});
                    } else {
                        video.pause();
                    }
                }
            });
        }, {
            threshold: [0, 0.2, 0.5, 0.8, 1]
        });

        observer.observe(section);

        // Set video playback rate for cinematic effect
        if (video) {
            video.playbackRate = 0.5;
        }

        // Event listeners
        section.addEventListener('wheel', handleWheel, { passive: true });
        section.addEventListener('touchstart', handleTouchStart, { passive: true });
        section.addEventListener('touchmove', handleTouchMove, { passive: true });
        section.addEventListener('touchend', handleTouchEnd, { passive: true });
        document.addEventListener('keydown', handleKeyboard);

        // Initial position and start animation
        positionCards();
        animate();

        console.log('Chris Theme: Reel navigator initialized with', cards.length, 'cards');
    }

    // Main initialization
    function init() {
        const lenis = initLenis();

        if (lenis) {
            window.ChrisTheme.lenis = lenis;
            initScrollTrigger(lenis);

            // Add class to indicate smooth scroll is active
            document.documentElement.classList.add('smooth-scroll');

            console.log('Chris Theme: Smooth scroll initialized');
        }

        // Initialize hero parallax (works with or without Lenis)
        initHeroParallax();

        // Initialize coder section choreography (pinned scroll-captured)
        initCoderChoreography();

        // Initialize claude codes section choreography (pinned scroll-captured)
        initClaudeCodesChoreography();

        // Initialize universal scroll parallax for marked images
        // This provides baseline depth even when camera/depth effects fail
        initScrollParallax();

        // Initialize scene scroll animations
        initSceneAnimations();

        // Generate GitHub contribution graph
        generateGitHubGraph();

        // Initialize GitHub repo cards (fetch API data)
        initGitHubRepoCards();

        // Initialize project video previews
        initProjectVideos();

        // Initialize mobile accelerometer tilt
        initAccelerometerTilt();

        // Reel navigator (circular article wheel) is now handled by projection-carousel.js
        // initReelNavigator();
    }

    // ========================================
    // CHAOS TERMINALS - 8 Claude Codes Animation
    // ========================================
    // Typing effect, rotating focus, perpetual chaos loop
    function initChaosTerminals(terminalGrid) {
        const terminals = terminalGrid.querySelectorAll('.terminal');
        if (terminals.length === 0) return;

        // Terminal scripts - each terminal has unique content
        const terminalScripts = [
            { // Terminal 1: Feature
                title: 'claude-1: spec',
                lines: [
                    { type: 'prompt', text: 'claude -p "write spec"' },
                    { type: 'output', text: 'Reading requirements...' },
                    { type: 'output', text: 'Analyzing codebase' },
                    { type: 'output', text: 'Drafting PRD sections' },
                    { type: 'success', text: '✓ Spec v2 complete' },
                ]
            },
            { // Terminal 2: Implement 1
                title: 'claude-2: impl',
                lines: [
                    { type: 'prompt', text: 'claude -p "auth module"' },
                    { type: 'output', text: 'Creating middleware...' },
                    { type: 'output', text: 'JWT validation logic' },
                    { type: 'output', text: 'Session management' },
                    { type: 'success', text: '✓ Auth shipped' },
                ]
            },
            { // Terminal 3: Implement 2
                title: 'claude-3: impl',
                lines: [
                    { type: 'prompt', text: 'claude -p "api routes"' },
                    { type: 'output', text: 'Scaffolding endpoints' },
                    { type: 'output', text: 'Adding validation' },
                    { type: 'output', text: 'Rate limiting done' },
                    { type: 'success', text: '✓ Routes complete' },
                ]
            },
            { // Terminal 4: Implement 3
                title: 'claude-4: impl',
                lines: [
                    { type: 'prompt', text: 'claude -p "ui components"' },
                    { type: 'output', text: 'Building components' },
                    { type: 'output', text: 'Styling dark mode' },
                    { type: 'output', text: 'Adding animations' },
                    { type: 'success', text: '✓ UI polished' },
                ]
            },
            { // Terminal 5: Research 1
                title: 'claude-5: research',
                lines: [
                    { type: 'prompt', text: 'claude -p "perf analysis"' },
                    { type: 'output', text: 'Profiling hot paths' },
                    { type: 'output', text: 'Memory leak found' },
                    { type: 'output', text: 'Optimization plan' },
                    { type: 'success', text: '✓ Report ready' },
                ]
            },
            { // Terminal 6: Research 2
                title: 'claude-6: research',
                lines: [
                    { type: 'prompt', text: 'claude -p "security audit"' },
                    { type: 'output', text: 'Scanning deps...' },
                    { type: 'output', text: 'OWASP checklist' },
                    { type: 'output', text: '2 CVEs patched' },
                    { type: 'success', text: '✓ Audit passed' },
                ]
            },
            { // Terminal 7: Review
                title: 'claude-7: review',
                lines: [
                    { type: 'prompt', text: 'claude -p "code review"' },
                    { type: 'output', text: 'Reading 47 files...' },
                    { type: 'output', text: 'Checking patterns' },
                    { type: 'output', text: '12 suggestions' },
                    { type: 'success', text: '✓ LGTM' },
                ]
            },
            { // Terminal 8: Deploy
                title: 'claude-8: deploy',
                lines: [
                    { type: 'prompt', text: 'claude -p "deploy prod"' },
                    { type: 'output', text: 'Building bundle...' },
                    { type: 'output', text: 'Running smoke tests' },
                    { type: 'output', text: 'Deploying v2.3.1' },
                    { type: 'success', text: '✓ Live!' },
                ]
            }
        ];

        // State tracking
        let focusedTerminal = 0;
        let isAnimating = false;
        let animationPaused = false;
        const terminalStates = terminals.length > 0 ? Array(terminals.length).fill(null).map(() => ({
            lineIndex: 0,
            charIndex: 0,
            isTyping: false,
            element: null,
            scrollEl: null,
            typedContent: []
        })) : [];

        // Initialize terminal DOM - clear existing content and prepare for animation
        function initTerminalDOM() {
            terminals.forEach((terminal, i) => {
                const script = terminalScripts[i];
                const titleEl = terminal.querySelector('.terminal__title');
                const scrollEl = terminal.querySelector('.terminal__scroll');

                if (titleEl) titleEl.textContent = script.title;
                if (scrollEl) {
                    scrollEl.innerHTML = '';
                    scrollEl.style.animation = 'none'; // Disable CSS scroll animation
                }

                terminalStates[i].element = terminal;
                terminalStates[i].scrollEl = scrollEl;

                // Add focus class tracking
                terminal.classList.remove('terminal--focused', 'terminal--active');
            });
        }

        // Create a line element
        function createLineElement(line, showCursor = false) {
            const lineEl = document.createElement('code');
            lineEl.className = 'terminal__line';

            if (line.type === 'prompt') {
                lineEl.innerHTML = `<span class="terminal__prompt">$</span> <span class="terminal__text"></span>${showCursor ? '<span class="terminal__cursor">▋</span>' : ''}`;
            } else if (line.type === 'success') {
                lineEl.className += ' terminal__line--success';
                lineEl.innerHTML = `<span class="terminal__text"></span>`;
            } else {
                lineEl.className += ' terminal__line--output';
                lineEl.innerHTML = `<span class="terminal__text"></span>`;
            }

            return lineEl;
        }

        // Type a single character
        function typeChar(terminalIndex, callback) {
            const state = terminalStates[terminalIndex];
            const script = terminalScripts[terminalIndex];

            if (!state.scrollEl || state.lineIndex >= script.lines.length) {
                callback && callback();
                return;
            }

            const currentLine = script.lines[state.lineIndex];
            const textToType = currentLine.type === 'prompt' ? currentLine.text : currentLine.text;

            // Create new line if needed
            if (state.charIndex === 0) {
                const lineEl = createLineElement(currentLine, terminalIndex === focusedTerminal);
                state.scrollEl.appendChild(lineEl);
                state.typedContent.push({ el: lineEl, line: currentLine });
            }

            const lineEl = state.typedContent[state.lineIndex]?.el;
            const textSpan = lineEl?.querySelector('.terminal__text');

            if (textSpan && state.charIndex < textToType.length) {
                textSpan.textContent = textToType.substring(0, state.charIndex + 1);
                state.charIndex++;

                // Scroll to bottom
                state.scrollEl.scrollTop = state.scrollEl.scrollHeight;

                // Typing speed varies by terminal to create chaos
                const baseSpeed = terminalIndex === focusedTerminal ? 35 : 15;
                const variance = Math.random() * 20;

                if (!animationPaused) {
                    setTimeout(() => typeChar(terminalIndex, callback), baseSpeed + variance);
                }
            } else {
                // Line complete, move to next
                state.lineIndex++;
                state.charIndex = 0;

                // Remove cursor from completed line
                const cursor = lineEl?.querySelector('.terminal__cursor');
                if (cursor) cursor.remove();

                // Brief pause between lines
                const pauseDuration = currentLine.type === 'success' ? 800 : 200;
                if (!animationPaused) {
                    setTimeout(() => callback && callback(), pauseDuration);
                }
            }
        }

        // Type all lines for a terminal
        function typeTerminal(terminalIndex, onComplete) {
            const state = terminalStates[terminalIndex];
            const script = terminalScripts[terminalIndex];

            if (state.lineIndex >= script.lines.length) {
                onComplete && onComplete();
                return;
            }

            state.isTyping = true;
            typeChar(terminalIndex, () => {
                if (state.lineIndex < script.lines.length) {
                    typeTerminal(terminalIndex, onComplete);
                } else {
                    state.isTyping = false;
                    onComplete && onComplete();
                }
            });
        }

        // Set focused terminal with visual emphasis
        function setFocusedTerminal(index) {
            focusedTerminal = index;

            terminals.forEach((terminal, i) => {
                if (i === index) {
                    terminal.classList.add('terminal--focused');
                    terminal.classList.add('terminal--active');
                    gsap.to(terminal, {
                        scale: 1.02,
                        boxShadow: '0 0 30px rgba(39, 201, 63, 0.3)',
                        duration: 0.3,
                        ease: 'power2.out'
                    });
                } else {
                    terminal.classList.remove('terminal--focused');
                    gsap.to(terminal, {
                        scale: 1,
                        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
                        duration: 0.3,
                        ease: 'power2.out'
                    });
                }
            });
        }

        // Reset a terminal for the next loop
        function resetTerminal(terminalIndex) {
            const state = terminalStates[terminalIndex];
            if (state.scrollEl) {
                state.scrollEl.innerHTML = '';
            }
            state.lineIndex = 0;
            state.charIndex = 0;
            state.isTyping = false;
            state.typedContent = [];
        }

        // The chaos loop - runs forever, rotating focus
        function chaosLoop() {
            if (animationPaused) {
                setTimeout(chaosLoop, 500);
                return;
            }

            // Pick next terminal to focus on
            const nextFocus = (focusedTerminal + 1) % terminals.length;
            setFocusedTerminal(nextFocus);

            // Reset the newly focused terminal
            resetTerminal(nextFocus);

            // Start typing on focused terminal
            typeTerminal(nextFocus, () => {
                // After typing completes, wait then rotate
                setTimeout(chaosLoop, 1500 + Math.random() * 1000);
            });

            // Also advance other terminals at random intervals (background activity)
            terminals.forEach((_, i) => {
                if (i !== nextFocus && Math.random() > 0.5) {
                    const state = terminalStates[i];
                    if (!state.isTyping && state.lineIndex >= terminalScripts[i].lines.length) {
                        // Reset and start background typing
                        resetTerminal(i);
                        setTimeout(() => {
                            if (!animationPaused) typeTerminal(i);
                        }, Math.random() * 2000);
                    }
                }
            });
        }

        // Initialize DOM and start typing chaos
        // NOTE: Visual spawn animation is handled by terminal-spawn.js
        function startAnimation() {
            if (isAnimating) return;
            isAnimating = true;

            // Initialize DOM (terminal-spawn.js handles visual animation)
            initTerminalDOM();

            // Start all terminals with staggered delays for initial chaos
            terminals.forEach((_, i) => {
                setTimeout(() => {
                    if (!animationPaused) typeTerminal(i);
                }, i * 400 + Math.random() * 500);
            });

            // Start focus rotation after initial typing settles
            setTimeout(chaosLoop, 3000);
        }

        // Expose startAnimation so the pinned choreography can trigger it
        // The Claude Codes section is pinned, so we can't rely on ScrollTrigger position
        window.ChrisTheme = window.ChrisTheme || {};
        window.ChrisTheme.startChaosTyping = () => {
            animationPaused = false;
            startAnimation();
        };
        window.ChrisTheme.pauseChaosTyping = () => {
            animationPaused = true;
        };
        window.ChrisTheme.resumeChaosTyping = () => {
            animationPaused = false;
        };

        console.log('Chris Theme: Chaos terminals initialized (waiting for choreography trigger)');
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
