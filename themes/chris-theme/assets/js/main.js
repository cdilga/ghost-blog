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
        const fadeUpElements = document.querySelectorAll('[data-animate="fade-up"]:not(.hero--parallax [data-animate])');

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

        // Terminal grid staggered animation (8 Claude Codes scene)
        const terminalGrid = document.querySelector('.terminal-grid[data-animate="stagger"]');
        if (terminalGrid) {
            const terminals = terminalGrid.querySelectorAll('.terminal');

            gsap.fromTo(terminals,
                {
                    opacity: 0,
                    y: 20,
                },
                {
                    opacity: 1,
                    y: 0,
                    duration: 0.5,
                    ease: 'power2.out',
                    stagger: 0.1, // 0.1s apart = 0.8s total for 8 terminals
                    scrollTrigger: {
                        trigger: terminalGrid,
                        start: 'top 80%',
                        toggleActions: 'play none none none',
                    }
                }
            );
        }

        // Code lines staggered animation (The Coder scene)
        const codeLines = document.querySelectorAll('.code-line');
        if (codeLines.length > 0) {
            gsap.fromTo(codeLines,
                {
                    opacity: 0,
                    x: -10,
                },
                {
                    opacity: 1,
                    x: 0,
                    duration: 0.4,
                    ease: 'power2.out',
                    stagger: 0.1,
                    scrollTrigger: {
                        trigger: codeLines[0].closest('.coder__code'),
                        start: 'top 80%',
                        toggleActions: 'play none none none',
                    }
                }
            );
        }

        // Terminal grid staggered animation (8 Claude Codes scene)
        const terminalGrid = document.querySelector('.terminal-grid[data-animate="stagger"]');
        if (terminalGrid) {
            const terminals = terminalGrid.querySelectorAll('.terminal');

            gsap.fromTo(terminals,
                {
                    opacity: 0,
                    y: 20,
                },
                {
                    opacity: 1,
                    y: 0,
                    duration: 0.5,
                    ease: 'power2.out',
                    stagger: {
                        amount: 0.8,
                        grid: [2, 4],
                        from: 'start',
                    },
                    scrollTrigger: {
                        trigger: terminalGrid,
                        start: 'top 80%',
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

        // Initialize scene scroll animations
        initSceneAnimations();

        // Generate GitHub contribution graph
        generateGitHubGraph();

        // Initialize project video previews
        initProjectVideos();

        // Initialize mobile accelerometer tilt
        initAccelerometerTilt();
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
