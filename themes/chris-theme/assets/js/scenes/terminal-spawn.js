/**
 * Terminal Dock-Spawn Animation Support
 *
 * This module provides support elements (overlay, CRT) for the Claude Codes
 * section choreography in main.js. The main animation timeline is handled
 * by initClaudeCodesChoreography() in main.js.
 *
 * This file handles:
 * - Reduced motion preferences (showing content immediately)
 * - Fallback behavior when main.js choreography is not available
 */
(function() {
    'use strict';

    // Prevent multiple initializations
    if (window.__terminalSpawnInitialized) {
        console.log('[terminal-spawn] Already initialized, skipping duplicate');
        return;
    }
    window.__terminalSpawnInitialized = true;

    function initTerminalSpawn() {
        const { gsap } = window.ChrisTheme || {};
        if (!gsap) {
            console.warn('[terminal-spawn] GSAP not available');
            return;
        }

        const scene = document.querySelector('.scene--claude-codes');
        const terminalGrid = scene?.querySelector('.terminal-grid');
        const terminals = terminalGrid?.querySelectorAll('.terminal');
        const depthCanvas = document.getElementById('depth-canvas-claude-codes');
        const header = scene?.querySelector('.scene__header');
        const cta = scene?.querySelector('.claude-codes__cta');

        if (!terminals || terminals.length === 0 || !scene) {
            console.warn('[terminal-spawn] Missing required elements');
            return;
        }

        // Check for reduced motion preference
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        if (prefersReducedMotion) {
            // Reduced motion: show everything immediately, no animations
            terminals.forEach(terminal => {
                gsap.set(terminal, { opacity: 1, scale: 1, x: 0, y: 0 });
            });
            if (header) gsap.set(header, { opacity: 1, y: 0 });
            if (cta) gsap.set(cta, { opacity: 1, y: 0 });
            if (depthCanvas) {
                depthCanvas.style.opacity = '1';
            }
            // Show overlay at 50% opacity for readability
            const overlay = scene.querySelector('.claude-codes__overlay');
            if (overlay) gsap.set(overlay, { opacity: 0.5 });

            console.log('[terminal-spawn] Reduced motion - showing content immediately');
            return;
        }

        // Expose reset function for debugging
        window.ChrisTheme.terminalSpawn = {
            reset: () => {
                terminals.forEach(t => gsap.set(t, { opacity: 1, scale: 1, x: 0, y: 0 }));
                if (header) gsap.set(header, { opacity: 1, y: 0 });
                if (cta) gsap.set(cta, { opacity: 1, y: 0 });
                const overlay = scene.querySelector('.claude-codes__overlay');
                if (overlay) gsap.set(overlay, { opacity: 0 });
                const crtOverlay = scene.querySelector('.crt-shutdown-overlay');
                if (crtOverlay) gsap.set(crtOverlay, { opacity: 0 });
            }
        };

        console.log('[terminal-spawn] Initialized with', terminals.length, 'terminals (choreography in main.js)');
    }

    // Wait for ChrisTheme to be available
    function waitForChrisTheme(callback, maxAttempts = 20) {
        let attempts = 0;
        const check = () => {
            if (window.ChrisTheme?.gsap) {
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
