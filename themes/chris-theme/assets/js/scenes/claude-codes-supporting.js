/**
 * Coder Section Supporting Elements Animation
 *
 * Animates the main.ts window, GitHub activity, and keyboard
 * in the CODER section to feel "pushed/pulled" by the windswept mask
 * as it transitions to the Claude Codes section.
 */
(function() {
    'use strict';

    // Prevent double initialization
    if (window.__coderSupportingAnimInitialized) {
        return;
    }
    window.__coderSupportingAnimInitialized = true;

    /**
     * Initialize supporting elements animation
     */
    function initSupportingAnimation() {
        const { gsap, ScrollTrigger } = window.ChrisTheme || {};

        if (!gsap || !ScrollTrigger) {
            console.warn('[coder-supporting] GSAP or ScrollTrigger not available');
            return;
        }

        // Get the existing elements in the Coder section
        const coderSection = document.querySelector('.scene--coder');
        const mainWindow = document.querySelector('.coder__code');
        const github = document.querySelector('.coder__github');
        const keyboard = document.querySelector('.coder__keyboard');

        if (!coderSection) {
            console.warn('[coder-supporting] Coder section not found');
            return;
        }

        // Check reduced motion preference
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            console.log('[coder-supporting] Reduced motion - skipping animation');
            return;
        }

        // Create exit animation timeline (triggered as windswept mask progresses)
        // Elements should feel "pushed" by the wind from right to left
        const exitTimeline = gsap.timeline({ paused: true });

        // GitHub slides out to the left (pushed by wind)
        if (github) {
            exitTimeline.to(github,
                {
                    opacity: 0,
                    x: -150,
                    duration: 0.8,
                    ease: 'power2.in'
                },
                0
            );
        }

        // Main window slides out to the right (carried by wind)
        if (mainWindow) {
            exitTimeline.to(mainWindow,
                {
                    opacity: 0,
                    x: 200,
                    duration: 0.9,
                    ease: 'power2.in'
                },
                0.05
            );
        }

        // Keyboard slides out to the right (carried by wind)
        if (keyboard) {
            exitTimeline.to(keyboard,
                {
                    opacity: 0,
                    x: 150,
                    duration: 0.8,
                    ease: 'power2.in'
                },
                0.1
            );
        }

        // Connect to windswept mask transition trigger
        // This matches the same trigger as windswept-mask.js
        ScrollTrigger.create({
            trigger: coderSection,
            start: 'bottom 80%',
            end: () => `+=${window.innerHeight * 0.8}`,
            scrub: 1,
            onUpdate: (self) => {
                // Progress the exit animation based on scroll
                exitTimeline.progress(self.progress);
            }
            // NOTE: No onLeaveBack handler - the coder choreography (main.js)
            // manages element visibility during its pinned timeline.
            // Resetting props here would conflict with the coder's exit state.
        });

        // Expose API for debugging
        window.ChrisTheme.coderSupportingAnim = {
            exitTimeline,
            elements: { mainWindow, github, keyboard }
        };

        console.log('[coder-supporting] Initialized - elements will animate with windswept mask');
    }

    /**
     * Wait for ChrisTheme to be available
     */
    function waitForChrisTheme(callback, maxAttempts = 30) {
        let attempts = 0;
        const check = () => {
            if (window.ChrisTheme?.gsap && window.ChrisTheme?.ScrollTrigger) {
                callback();
                return;
            }
            if (attempts++ < maxAttempts) {
                requestAnimationFrame(check);
            }
        };
        check();
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => waitForChrisTheme(initSupportingAnimation));
    } else {
        waitForChrisTheme(initSupportingAnimation);
    }
})();
