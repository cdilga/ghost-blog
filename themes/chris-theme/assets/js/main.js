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
        const heroElements = document.querySelectorAll('.hero--parallax [data-animate]');
        heroElements.forEach(el => {
            el.style.opacity = '1';
            el.style.transform = 'none';
        });
    }

    // Initialize hero parallax animations
    function initHeroParallax() {
        const hero = document.querySelector('.hero--parallax');
        if (!hero || typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') {
            showHeroContent();
            return;
        }

        // Parallax speed multiplier (reduce on mobile for better UX)
        const parallaxMultiplier = isMobile ? 0.5 : 1;

        // Get parallax layers
        const layers = hero.querySelectorAll('.hero__layer[data-parallax-speed]');

        layers.forEach(layer => {
            const speed = parseFloat(layer.dataset.parallaxSpeed) * parallaxMultiplier;
            if (speed === 0) return;

            gsap.to(layer, {
                yPercent: speed * -50, // Move up as user scrolls down
                ease: 'none',
                scrollTrigger: {
                    trigger: hero,
                    start: 'top top',
                    end: 'bottom top',
                    scrub: true,
                }
            });
        });

        // Fade-up animations for hero content
        const animatedElements = hero.querySelectorAll('[data-animate="fade-up"]');

        // Hero content entrance animation (on page load)
        gsap.fromTo(animatedElements,
            {
                opacity: 0,
                y: 30,
            },
            {
                opacity: 1,
                y: 0,
                duration: 0.8,
                ease: 'power2.out',
                stagger: 0.1,
                delay: 0.3, // Small delay for page load
            }
        );

        // Clip-path reveal on scroll (hero exits by clipping)
        gsap.to(hero, {
            clipPath: 'inset(0 0 100% 0)',
            ease: 'none',
            scrollTrigger: {
                trigger: hero,
                start: 'center top',
                end: 'bottom top',
                scrub: true,
            }
        });

        // Fade out scroll indicator when user starts scrolling
        const scrollIndicator = hero.querySelector('.hero__scroll-indicator');
        if (scrollIndicator) {
            gsap.to(scrollIndicator, {
                opacity: 0,
                scrollTrigger: {
                    trigger: hero,
                    start: 'top top',
                    end: '10% top',
                    scrub: true,
                }
            });
        }

        console.log('Chris Theme: Hero parallax initialized');
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
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
