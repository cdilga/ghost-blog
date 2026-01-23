// Chris Theme - Main JavaScript
// Lenis smooth scroll + GSAP ScrollTrigger integration

(function() {
    'use strict';

    // Check for reduced motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
