/**
 * Terminal Dock-Spawn Animation
 *
 * Animates terminals to "spawn" from navbar center like macOS dock window launches.
 * Scroll-TRIGGERED (not scrubbed): individual animations run to completion once triggered.
 */
(function() {
    'use strict';

    function initTerminalSpawn() {
        const { gsap, ScrollTrigger } = window.ChrisTheme || {};
        if (!gsap || !ScrollTrigger) {
            console.warn('[terminal-spawn] GSAP or ScrollTrigger not available');
            return;
        }

        const terminalGrid = document.querySelector('.terminal-grid');
        const terminals = terminalGrid?.querySelectorAll('.terminal');
        const header = document.querySelector('.site-header');

        if (!terminals || terminals.length === 0 || !header) {
            console.warn('[terminal-spawn] Missing required elements');
            return;
        }

        // Check for reduced motion preference
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        // Track which terminals have spawned (prevents re-triggering)
        const spawnedTerminals = new Set();

        // Calculate navbar center position
        function getNavbarCenter() {
            const headerRect = header.getBoundingClientRect();
            return {
                x: window.innerWidth / 2,
                y: headerRect.bottom
            };
        }

        // Get terminal's final position (its natural grid position)
        function getTerminalFinalPosition(terminal) {
            const rect = terminal.getBoundingClientRect();
            return {
                x: rect.left + rect.width / 2,
                y: rect.top + rect.height / 2
            };
        }

        // Spawn a single terminal with elastic animation
        function spawnTerminal(terminal, index) {
            if (spawnedTerminals.has(index)) return;
            spawnedTerminals.add(index);

            // Reduced motion: just show immediately
            if (prefersReducedMotion) {
                gsap.set(terminal, {
                    opacity: 1,
                    scale: 1,
                    x: 0,
                    y: 0
                });
                return;
            }

            const navbarCenter = getNavbarCenter();
            const finalPos = getTerminalFinalPosition(terminal);

            // Calculate offset from final position to navbar center
            const offsetX = navbarCenter.x - finalPos.x;
            const offsetY = navbarCenter.y - finalPos.y;

            // Animate from navbar center to final position
            gsap.fromTo(terminal,
                {
                    scale: 0.1,
                    opacity: 0,
                    x: offsetX,
                    y: offsetY
                },
                {
                    scale: 1,
                    opacity: 1,
                    x: 0,
                    y: 0,
                    duration: 0.5,
                    ease: 'elastic.out(1, 0.5)',
                    onComplete: () => {
                        // Clear transforms after animation completes
                        gsap.set(terminal, { clearProps: 'x,y' });
                    }
                }
            );
        }

        // Initialize: hide all terminals at navbar center position
        function initializeTerminals() {
            if (prefersReducedMotion) {
                // Reduced motion: start visible
                terminals.forEach(terminal => {
                    gsap.set(terminal, { opacity: 1, scale: 1 });
                });
                return;
            }

            const navbarCenter = getNavbarCenter();

            terminals.forEach((terminal, index) => {
                const finalPos = getTerminalFinalPosition(terminal);
                const offsetX = navbarCenter.x - finalPos.x;
                const offsetY = navbarCenter.y - finalPos.y;

                gsap.set(terminal, {
                    scale: 0.1,
                    opacity: 0,
                    x: offsetX,
                    y: offsetY
                });
            });
        }

        // Create ScrollTrigger for spawn choreography
        function createSpawnTrigger() {
            if (prefersReducedMotion) return;

            const scene = terminalGrid.closest('.scene--claude-codes');
            if (!scene) return;

            // Track progress and spawn terminals accordingly
            let lastProgress = 0;

            ScrollTrigger.create({
                trigger: scene,
                start: 'top 60%',  // Start when section enters lower portion
                end: 'top 10%',   // End when section header is near top
                onUpdate: (self) => {
                    const progress = self.progress;

                    // Calculate which terminal should trigger at this progress
                    // 8 terminals spread across the progress range
                    const terminalToTrigger = Math.floor(progress * 8);

                    // Only spawn terminals as we scroll forward
                    if (progress > lastProgress) {
                        for (let i = 0; i <= terminalToTrigger && i < terminals.length; i++) {
                            if (!spawnedTerminals.has(i)) {
                                // Slight delay for natural cascade
                                const delay = (i - (lastProgress * 8)) * 0.05;
                                setTimeout(() => spawnTerminal(terminals[i], i), Math.max(0, delay * 1000));
                            }
                        }
                    }

                    lastProgress = progress;
                },
                onEnter: () => {
                    // Ensure first terminal spawns immediately on enter
                    if (!spawnedTerminals.has(0)) {
                        spawnTerminal(terminals[0], 0);
                    }
                }
            });
        }

        // Initialize
        initializeTerminals();
        createSpawnTrigger();

        // Expose for debugging
        window.ChrisTheme.terminalSpawn = {
            spawnedTerminals,
            spawnTerminal,
            reset: () => {
                spawnedTerminals.clear();
                initializeTerminals();
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
