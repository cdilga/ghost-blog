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

        const heroTimeline = gsap.timeline({
            scrollTrigger: {
                trigger: hero,
                start: 'top top',
                end: '+=2000',  // 2000px of scroll = full sequence
                pin: true,      // 🔥 NON-NEGOTIABLE: Page stays fixed
                scrub: 1,       // 🔥 NON-NEGOTIABLE: Scroll drives timeline
                anticipatePin: 1, // Smoother pin initiation
            }
        });

        // Content is already visible - hold for first 65% of scroll (0-1300px)
        // This gives user time to read the content
        heroTimeline.to({}, { duration: 0.65 });

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
        heroTimeline.to(hero, {
            clipPath: 'inset(0 0 100% 0)',
            duration: 0.30,
            ease: 'power2.inOut'
        });

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
                    end: '+=2000',
                    scrub: true,
                }
            });
        });

        console.log('Chris Theme: Hero scroll-captured choreography initialized (pin: true, scrub: 1)');
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

        // Terminal grid - CHAOS TERMINAL ANIMATION (8 Claude Codes scene)
        // Typing effect, rotating focus, never-ending loop, active chaos energy
        const terminalGrid = document.querySelector('.terminal-grid[data-animate="stagger"]');
        if (terminalGrid) {
            initChaosTerminals(terminalGrid);
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

        // Content Creator 3D YouTube embed animation
        // WOW FACTOR: TV power-on, particles, chromatic aberration, neon glow
        const youtube3dContainer = document.querySelector('.youtube-3d-container');
        if (youtube3dContainer) {
            const embed = youtube3dContainer.querySelector('lite-youtube');
            const wrapper = youtube3dContainer.querySelector('.embed--3d');

            if (embed && wrapper) {
                // Create all effect elements
                const glow = document.createElement('div');
                glow.className = 'youtube-glow';

                const bloom = document.createElement('div');
                bloom.className = 'youtube-bloom';

                const ring = document.createElement('div');
                ring.className = 'youtube-ring';

                const scanlines = document.createElement('div');
                scanlines.className = 'youtube-scanlines';

                const flicker = document.createElement('div');
                flicker.className = 'youtube-flicker';

                const chromatic = document.createElement('div');
                chromatic.className = 'youtube-chromatic';

                const particles = document.createElement('div');
                particles.className = 'youtube-particles';

                const reflection = document.createElement('div');
                reflection.className = 'youtube-reflection';

                // Create particles (12 particles for burst effect)
                for (let i = 0; i < 12; i++) {
                    const particle = document.createElement('div');
                    particle.className = 'youtube-particle';
                    particles.appendChild(particle);
                }

                // Append all elements
                wrapper.appendChild(glow);
                wrapper.appendChild(bloom);
                wrapper.appendChild(ring);
                embed.appendChild(scanlines);
                embed.appendChild(flicker);
                embed.appendChild(chromatic);
                wrapper.appendChild(particles);
                youtube3dContainer.appendChild(reflection);

                // Position particles around center
                const particleEls = particles.querySelectorAll('.youtube-particle');
                particleEls.forEach((p, i) => {
                    const angle = (i / 12) * Math.PI * 2;
                    gsap.set(p, {
                        left: '50%',
                        top: '50%',
                        xPercent: -50,
                        yPercent: -50,
                    });
                });

                // Set DRAMATIC initial state
                gsap.set(embed, {
                    scale: 0.05,
                    rotateX: 35,
                    rotateY: -20,
                    rotateZ: 5,
                    opacity: 0,
                    filter: 'brightness(3) saturate(0)',
                    transformPerspective: 1500,
                    transformOrigin: 'center center',
                });

                gsap.set([glow, bloom], { opacity: 0, scale: 0.3 });
                gsap.set(ring, { opacity: 0, scale: 0.8 });
                gsap.set(reflection, { opacity: 0 });

                // Epic multi-stage timeline
                const tl = gsap.timeline({
                    scrollTrigger: {
                        trigger: youtube3dContainer,
                        start: 'top 80%',
                        toggleActions: 'play none none none',
                    },
                    onComplete: () => {
                        // Enable floating animation after entrance
                        youtube3dContainer.classList.add('animation-complete');
                    }
                });

                // STAGE 1: Energy gathering - glow and bloom emerge (0.5s)
                tl.to([glow, bloom], {
                    opacity: 1,
                    scale: 1,
                    duration: 0.5,
                    ease: 'power2.out',
                    stagger: 0.1,
                })

                // STAGE 2: TV power-on flash with white burst
                .to(embed, {
                    opacity: 1,
                    scale: 0.15,
                    filter: 'brightness(5) saturate(0)',
                    duration: 0.15,
                    ease: 'power4.in',
                }, '-=0.2')

                // TV flicker effect
                .to(flicker, {
                    opacity: 1,
                    duration: 0.05,
                })
                .to(flicker, {
                    opacity: 0,
                    duration: 0.05,
                })
                .to(flicker, {
                    opacity: 0.5,
                    duration: 0.05,
                })
                .to(flicker, {
                    opacity: 0,
                    duration: 0.1,
                })

                // STAGE 3: Chromatic aberration during expansion
                .to(chromatic, {
                    opacity: 1,
                    duration: 0.1,
                }, '-=0.2')

                // STAGE 4: Main expansion with rotation settle
                .to(embed, {
                    scale: 0.5,
                    rotateX: 15,
                    rotateY: -10,
                    rotateZ: 2,
                    filter: 'brightness(1.5) saturate(0.7)',
                    duration: 0.4,
                    ease: 'power3.out',
                })

                // Enable scanlines during mid-expansion
                .to(scanlines, {
                    opacity: 0.5,
                    duration: 0.2,
                }, '-=0.3')

                // STAGE 5: Full expansion with color restore
                .to(embed, {
                    scale: 1,
                    rotateX: 0,
                    rotateY: 0,
                    rotateZ: 0,
                    filter: 'brightness(1) saturate(1)',
                    duration: 0.8,
                    ease: 'power2.out',
                })

                // Fade chromatic aberration
                .to(chromatic, {
                    opacity: 0,
                    duration: 0.4,
                }, '-=0.6')

                // STAGE 6: Particle burst outward
                .to(particleEls, {
                    opacity: 1,
                    duration: 0.1,
                }, '-=0.5')
                .to(particleEls, {
                    x: (i) => Math.cos((i / 12) * Math.PI * 2) * 150,
                    y: (i) => Math.sin((i / 12) * Math.PI * 2) * 100,
                    opacity: 0,
                    scale: 0,
                    duration: 0.8,
                    ease: 'power2.out',
                    stagger: 0.02,
                }, '-=0.1')

                // STAGE 7: Neon ring sweep
                .to(ring, {
                    opacity: 1,
                    scale: 1,
                    duration: 0.3,
                    ease: 'power2.out',
                }, '-=0.6')
                .to(ring, {
                    opacity: 0,
                    scale: 1.15,
                    duration: 0.4,
                    ease: 'power1.in',
                })

                // STAGE 8: Glow pulse and settle
                .to(glow, {
                    scale: 1.3,
                    opacity: 0.8,
                    duration: 0.3,
                    ease: 'power2.in',
                }, '-=0.5')
                .to(glow, {
                    scale: 1,
                    opacity: 0.4,
                    duration: 0.5,
                    ease: 'power2.out',
                })

                // Bloom fades to subtle ambient
                .to(bloom, {
                    opacity: 0.3,
                    duration: 0.5,
                }, '-=0.5')

                // STAGE 9: Scanlines fade to subtle
                .to(scanlines, {
                    opacity: 0.15,
                    duration: 0.4,
                }, '-=0.3')

                // STAGE 10: Landing shadow punch + reflection reveal
                .to(embed, {
                    boxShadow: '0 50px 100px rgba(0, 0, 0, 0.45), 0 0 120px rgba(247, 147, 26, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.12)',
                    duration: 0.5,
                    ease: 'back.out(1.7)',
                }, '-=0.3')

                .to(reflection, {
                    opacity: 0.4,
                    duration: 0.6,
                    ease: 'power2.out',
                }, '-=0.4');

                // Parallax depth effect on scroll
                ScrollTrigger.create({
                    trigger: youtube3dContainer,
                    start: 'top bottom',
                    end: 'bottom top',
                    scrub: 1,
                    onUpdate: (self) => {
                        if (tl.progress() >= 1) {
                            const progress = self.progress;
                            const tiltX = (progress - 0.5) * 10;
                            const tiltY = Math.sin(progress * Math.PI) * 3;
                            const translateZ = Math.sin(progress * Math.PI) * 40;
                            gsap.set(embed, {
                                rotateX: tiltX,
                                rotateY: tiltY,
                                z: translateZ,
                                transformPerspective: 1500,
                            });
                        }
                    }
                });
            }
        }

        // Top Articles section staggered animation
        const topArticlesGrid = document.querySelector('.top-articles__grid');
        if (topArticlesGrid) {
            const featuredCard = topArticlesGrid.querySelector('.article-card--featured');
            const regularCards = topArticlesGrid.querySelectorAll('.article-card:not(.article-card--featured)');

            // Featured card: scale + fade
            if (featuredCard) {
                gsap.fromTo(featuredCard,
                    {
                        opacity: 0,
                        scale: 0.98,
                        y: 20,
                    },
                    {
                        opacity: 1,
                        scale: 1,
                        y: 0,
                        duration: 0.6,
                        ease: 'power2.out',
                        scrollTrigger: {
                            trigger: topArticlesGrid,
                            start: 'top 80%',
                            toggleActions: 'play none none none',
                        }
                    }
                );
            }

            // Regular cards: staggered fade
            if (regularCards.length > 0) {
                gsap.fromTo(regularCards,
                    {
                        opacity: 0,
                        y: 30,
                    },
                    {
                        opacity: 1,
                        y: 0,
                        duration: 0.5,
                        ease: 'power2.out',
                        stagger: 0.15,
                        scrollTrigger: {
                            trigger: topArticlesGrid,
                            start: 'top 75%',
                            toggleActions: 'play none none none',
                        }
                    }
                );
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

        // Initialize reel navigator (circular article wheel)
        initReelNavigator();
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
                    { type: 'prompt', text: 'claude --task "write spec"' },
                    { type: 'output', text: 'Reading requirements...' },
                    { type: 'output', text: 'Analyzing codebase' },
                    { type: 'output', text: 'Drafting PRD sections' },
                    { type: 'success', text: '✓ Spec v2 complete' },
                ]
            },
            { // Terminal 2: Implement 1
                title: 'claude-2: impl',
                lines: [
                    { type: 'prompt', text: 'claude --task "auth module"' },
                    { type: 'output', text: 'Creating middleware...' },
                    { type: 'output', text: 'JWT validation logic' },
                    { type: 'output', text: 'Session management' },
                    { type: 'success', text: '✓ Auth shipped' },
                ]
            },
            { // Terminal 3: Implement 2
                title: 'claude-3: impl',
                lines: [
                    { type: 'prompt', text: 'claude --task "api routes"' },
                    { type: 'output', text: 'Scaffolding endpoints' },
                    { type: 'output', text: 'Adding validation' },
                    { type: 'output', text: 'Rate limiting done' },
                    { type: 'success', text: '✓ Routes complete' },
                ]
            },
            { // Terminal 4: Implement 3
                title: 'claude-4: impl',
                lines: [
                    { type: 'prompt', text: 'claude --task "ui components"' },
                    { type: 'output', text: 'Building components' },
                    { type: 'output', text: 'Styling dark mode' },
                    { type: 'output', text: 'Adding animations' },
                    { type: 'success', text: '✓ UI polished' },
                ]
            },
            { // Terminal 5: Research 1
                title: 'claude-5: research',
                lines: [
                    { type: 'prompt', text: 'claude --task "perf analysis"' },
                    { type: 'output', text: 'Profiling hot paths' },
                    { type: 'output', text: 'Memory leak found' },
                    { type: 'output', text: 'Optimization plan' },
                    { type: 'success', text: '✓ Report ready' },
                ]
            },
            { // Terminal 6: Research 2
                title: 'claude-6: research',
                lines: [
                    { type: 'prompt', text: 'claude --task "security audit"' },
                    { type: 'output', text: 'Scanning deps...' },
                    { type: 'output', text: 'OWASP checklist' },
                    { type: 'output', text: '2 CVEs patched' },
                    { type: 'success', text: '✓ Audit passed' },
                ]
            },
            { // Terminal 7: Review
                title: 'claude-7: review',
                lines: [
                    { type: 'prompt', text: 'claude --task "code review"' },
                    { type: 'output', text: 'Reading 47 files...' },
                    { type: 'output', text: 'Checking patterns' },
                    { type: 'output', text: '12 suggestions' },
                    { type: 'success', text: '✓ LGTM' },
                ]
            },
            { // Terminal 8: Deploy
                title: 'claude-8: deploy',
                lines: [
                    { type: 'prompt', text: 'claude --task "deploy prod"' },
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

        // ScrollTrigger to start/pause animation based on visibility
        ScrollTrigger.create({
            trigger: terminalGrid,
            start: 'top 85%',
            end: 'bottom 15%',
            onEnter: () => {
                animationPaused = false;
                startAnimation();
            },
            onLeave: () => {
                animationPaused = true;
            },
            onEnterBack: () => {
                animationPaused = false;
            },
            onLeaveBack: () => {
                animationPaused = true;
            }
        });
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
