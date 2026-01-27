/**
 * Terminal Dock-Spawn Animation with CRT Exit
 *
 * Bi-directional animation:
 * - Entry: Terminals spawn from navbar center (macOS dock style)
 * - Exit: Terminals fly back to navbar, then CRT shutdown effect on desert
 *
 * Pre-calculates offsets at initialization for reliable animation.
 */
(function() {
    'use strict';

    // Prevent multiple initializations (use window for truly global state)
    if (window.__terminalSpawnInitialized) {
        console.log('[terminal-spawn] Already initialized, skipping duplicate');
        return;
    }
    window.__terminalSpawnInitialized = true;

    function initTerminalSpawn() {

        const { gsap, ScrollTrigger } = window.ChrisTheme || {};
        if (!gsap || !ScrollTrigger) {
            console.warn('[terminal-spawn] GSAP or ScrollTrigger not available');
            return;
        }

        const scene = document.querySelector('.scene--claude-codes');
        const terminalGrid = scene?.querySelector('.terminal-grid');
        const terminals = terminalGrid?.querySelectorAll('.terminal');
        const header = document.querySelector('.site-header');
        const depthCanvas = document.getElementById('depth-canvas-claude-codes');

        if (!terminals || terminals.length === 0 || !scene) {
            console.warn('[terminal-spawn] Missing required elements');
            return;
        }

        // Header is optional - use fallback position if not present
        const hasHeader = !!header;

        // Check for reduced motion preference
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        if (prefersReducedMotion) {
            // Reduced motion: show everything immediately
            terminals.forEach(terminal => {
                gsap.set(terminal, { opacity: 1, scale: 1, x: 0, y: 0 });
            });
            if (depthCanvas) {
                depthCanvas.style.opacity = '1';
            }
            console.log('[terminal-spawn] Reduced motion - showing terminals immediately');
            return;
        }

        // Create CRT shutdown overlay element
        const crtOverlay = document.createElement('div');
        crtOverlay.className = 'crt-shutdown-overlay';
        crtOverlay.innerHTML = '<div class="crt-line"></div>';
        scene.appendChild(crtOverlay);

        // Set initial CRT overlay state
        gsap.set(crtOverlay, { opacity: 0 });

        // ========================================
        // PRE-CALCULATE SPAWN OFFSETS
        // Must be done at initialization when terminals are at grid positions
        // ========================================

        // Scroll to scene briefly to ensure correct measurements, then restore
        const originalScroll = window.scrollY;
        const sceneRect = scene.getBoundingClientRect();
        const sceneTop = sceneRect.top + originalScroll;

        // Calculate offsets using document-relative positions (scroll-independent)
        // Use header height if available, otherwise use 60px as fallback (typical navbar height)
        const headerHeight = hasHeader ? header.offsetHeight : 60;
        const navbarCenterX = window.innerWidth / 2;
        const navbarY = headerHeight; // Bottom of header in document coordinates

        // Store pre-calculated offsets for each terminal
        const terminalOffsets = Array.from(terminals).map(terminal => {
            const rect = terminal.getBoundingClientRect();
            // Get terminal position relative to document (not viewport)
            const terminalDocTop = rect.top + originalScroll;
            const terminalDocLeft = rect.left;
            const terminalCenterX = terminalDocLeft + rect.width / 2;
            const terminalCenterY = terminalDocTop + rect.height / 2;

            // Offset to move terminal from its grid position to navbar center
            // Y offset: negative to move UP from grid to navbar
            return {
                x: navbarCenterX - terminalCenterX,
                y: navbarY - (terminalCenterY - sceneTop) // Relative to scene top
            };
        });

        console.log('[terminal-spawn] Pre-calculated offsets:', terminalOffsets);

        // ========================================
        // ENTRY ANIMATION: Terminals spawn from top
        // ========================================

        // Set initial state: terminals START at navbar (hidden)
        // They will animate TO their grid positions (x:0, y:0)
        terminals.forEach((terminal, i) => {
            gsap.set(terminal, {
                opacity: 0,
                scale: 0.1,
                x: terminalOffsets[i].x,
                y: terminalOffsets[i].y
            });
        });

        // Create the entry timeline (scrubbed with scroll)
        const entryTL = gsap.timeline({
            scrollTrigger: {
                trigger: scene,
                start: 'top 90%',
                end: 'top 30%',
                scrub: 0.3
            }
        });

        // Stagger terminals spawning in - animate FROM navbar TO grid position
        terminals.forEach((terminal, index) => {
            entryTL.to(terminal, {
                scale: 1,
                opacity: 1,
                x: 0,
                y: 0,
                ease: 'back.out(1.4)',
                duration: 0.15
            }, index * 0.05);
        });

        // ========================================
        // EXIT ANIMATION: Terminals fly back + CRT shutdown
        // ========================================

        const exitTL = gsap.timeline({
            scrollTrigger: {
                trigger: scene,
                start: 'bottom 70%',
                end: 'bottom 10%',
                scrub: 0.3
            }
        });

        // Terminals fly back to navbar (reverse order)
        const terminalArray = Array.from(terminals);
        terminalArray.reverse().forEach((terminal, index) => {
            const origIndex = terminals.length - 1 - index;
            exitTL.to(terminal, {
                scale: 0.1,
                opacity: 0,
                x: terminalOffsets[origIndex].x,
                y: terminalOffsets[origIndex].y,
                ease: 'back.in(1.2)',
                duration: 0.12
            }, index * 0.04);
        });

        // CRT shutdown effect
        const crtStart = terminalArray.length * 0.04;

        exitTL.to(crtOverlay, {
            opacity: 1,
            duration: 0.1
        }, crtStart);

        exitTL.to(crtOverlay.querySelector('.crt-line'), {
            scaleY: 0,
            duration: 0.3,
            ease: 'power2.in'
        }, crtStart);

        // Fade depth canvas
        if (depthCanvas) {
            exitTL.to(depthCanvas, {
                opacity: 0,
                duration: 0.2
            }, crtStart + 0.15);
        }

        exitTL.to(crtOverlay, {
            opacity: 0,
            duration: 0.15
        }, crtStart + 0.3);

        // Expose for debugging
        window.ChrisTheme.terminalSpawn = {
            entryTL,
            exitTL,
            terminalOffsets,
            reset: () => {
                terminals.forEach(t => gsap.set(t, { opacity: 1, scale: 1, x: 0, y: 0 }));
            }
        };

        console.log('[terminal-spawn] Initialized with', terminals.length, 'terminals');
    }

    // Wait for ChrisTheme to be available
    function waitForChrisTheme(callback, maxAttempts = 20) {
        let attempts = 0;
        const check = () => {
            if (window.ChrisTheme?.gsap && window.ChrisTheme?.ScrollTrigger) {
                callback();
            } else if (attempts < maxAttempts) {
                attempts++;
                requestAnimationFrame(check);
            } else {
                console.warn('[terminal-spawn] ChrisTheme not available after', maxAttempts, 'attempts');
            }
        };
        check();
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => waitForChrisTheme(initTerminalSpawn));
    } else {
        waitForChrisTheme(initTerminalSpawn);
    }
})();
