// Hero + Coder Unified Depth Map Parallax Effect
// Uses PixiJS DisplacementFilter for depth-based parallax
// Covers both Hero AND Coder sections as one continuous background
// Input: MotionInput system (optical flow camera + mouse) + SCROLL

(function() {
    'use strict';

    // Skip if reduced motion preferred
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        return;
    }

    // Wait for PixiJS to load
    if (typeof PIXI === 'undefined') {
        console.warn('Hero Depth: PixiJS not loaded');
        return;
    }

    // IMPORTANT: Keep displacement HIGH - we want pronounced depth parallax
    // Do NOT reduce these values - the effect should be clearly visible
    const CONFIG = {
        displacementScale: {
            desktop: 55,
            mobile: 50
        },
        smoothing: 0.08,
        // Scroll-based parallax intensity (adds to motion/mouse input)
        // IMPORTANT: Keep these values HIGH for visible scroll parallax
        // These values create pronounced parallax as user scrolls past
        scrollIntensity: {
            x: 0.5,  // Horizontal shift based on scroll
            y: 1.5   // Vertical shift - primary scroll effect (MORE PRONOUNCED)
        }
    };

    const isMobile = window.innerWidth <= 768;
    const maxDisplacement = isMobile ? CONFIG.displacementScale.mobile : CONFIG.displacementScale.desktop;

    // Current and target displacement values
    let currentX = 0;
    let currentY = 0;
    let targetX = 0;
    let targetY = 0;

    // Scroll-based offset (added to motion/mouse input)
    let scrollOffsetX = 0;
    let scrollOffsetY = 0;

    // Motion/mouse input (separate from scroll)
    let motionX = 0;
    let motionY = 0;

    // DOM elements - Hero and Coder sections
    const heroSection = document.querySelector('.hero');
    const coderSection = document.querySelector('.scene--coder');
    const heroLayer = document.querySelector('.hero__layer--dunes');

    if (!heroLayer || !heroSection) {
        return;
    }

    const heroImage = heroLayer.querySelector('img');
    if (!heroImage) {
        return;
    }

    // Get image sources
    const imageSrc = heroImage.src;
    const imageBaseName = imageSrc.replace(/\.[^/.]+$/, '');
    const depthMapSrc = imageBaseName + '_depth_anything_2_greyscale.png';

    // Create PixiJS canvas container - position fixed to cover viewport during scroll
    // z-index: -1 places canvas between html background and body content
    const container = document.createElement('div');
    container.className = 'hero__depth-canvas';
    container.id = 'depth-canvas-hero-coder';
    // Note: position/size/z-index defined in CSS (.hero__depth-canvas)
    // Only set opacity here - CSS handles height with 100lvh for mobile chrome transitions
    container.style.opacity = '1';
    document.body.appendChild(container);

    // Get sky layer reference for later hiding
    const skyLayer = document.querySelector('.hero__layer--sky');

    // PixiJS setup
    let app = null;
    let displacementSprite = null;
    let displacementFilter = null;

    async function initPixi() {
        try {
            app = new PIXI.Application();
            await app.init({
                width: container.clientWidth,
                height: container.clientHeight,
                backgroundAlpha: 0,
                resizeTo: container,
                antialias: true,
                resolution: window.devicePixelRatio || 1,
                autoDensity: true
            });

            container.appendChild(app.canvas);
            app.canvas.style.width = '100%';
            app.canvas.style.height = '100%';
            app.canvas.style.display = 'block';

            // Load main image
            const mainTexture = await PIXI.Assets.load(imageSrc);
            const mainSprite = new PIXI.Sprite(mainTexture);

            // Scale to cover container with buffer to prevent edge gaps on unusual aspect ratios
            const scaleX = app.screen.width / mainSprite.width;
            const scaleY = app.screen.height / mainSprite.height;
            const scale = Math.max(scaleX, scaleY) * 1.05; // 5% buffer
            mainSprite.scale.set(scale);
            mainSprite.anchor.set(0.5);
            mainSprite.x = app.screen.width / 2;
            mainSprite.y = app.screen.height / 2;

            // Load depth map
            const depthTexture = await PIXI.Assets.load(depthMapSrc);
            displacementSprite = new PIXI.Sprite(depthTexture);
            displacementSprite.texture.source.addressMode = 'clamp-to-edge';

            // Displacement sprite must cover full screen with buffer
            const depthScaleX = app.screen.width / displacementSprite.width;
            const depthScaleY = app.screen.height / displacementSprite.height;
            const depthScale = Math.max(depthScaleX, depthScaleY) * 1.05; // Match main sprite buffer
            displacementSprite.scale.set(depthScale);
            displacementSprite.anchor.set(0.5);
            displacementSprite.x = app.screen.width / 2;
            displacementSprite.y = app.screen.height / 2;

            // Create displacement filter
            displacementFilter = new PIXI.DisplacementFilter({
                sprite: displacementSprite,
                scale: { x: 0, y: 0 }
            });

            mainSprite.filters = [displacementFilter];
            app.stage.addChild(displacementSprite);
            app.stage.addChild(mainSprite);

            // NOW hide the original images (PixiJS canvas is ready)
            heroImage.style.visibility = 'hidden';
            if (skyLayer) {
                skyLayer.style.visibility = 'hidden';
            }

            // Start animation loop
            app.ticker.add(animate);

            // Handle resize
            window.addEventListener('resize', handleResize);

            // Subscribe to MotionInput
            initMotionInput();

            // Initialize scroll-based parallax
            initScrollParallax();

        } catch (error) {
            console.error('Hero Depth: Failed to initialize', error);
            heroImage.style.visibility = 'visible';
            container.remove();
        }
    }

    function animate() {
        if (!displacementFilter) return;

        // Combine motion/mouse input with scroll offset
        // Both sources contribute to the final displacement
        targetX = motionX + scrollOffsetX;
        targetY = motionY + scrollOffsetY;

        currentX += (targetX - currentX) * CONFIG.smoothing;
        currentY += (targetY - currentY) * CONFIG.smoothing;

        displacementFilter.scale.x = currentX * maxDisplacement;
        displacementFilter.scale.y = currentY * maxDisplacement;
    }

    // =========================================================================
    // Motion Input Integration
    // =========================================================================

    function initMotionInput() {
        // Check if MotionInput is available
        if (typeof MotionInput !== 'undefined') {
            MotionInput.subscribe((x, y) => {
                motionX = x;
                motionY = y;
            });
        } else {
            // Fallback to mouse-only if MotionInput not loaded
            initMouseFallback();
        }
    }

    function initMouseFallback() {
        // Mouse tracking works globally when over Hero or Coder sections
        const sections = [heroSection, coderSection].filter(Boolean);

        sections.forEach(section => {
            section.addEventListener('mousemove', (e) => {
                // Use viewport-relative coordinates for consistent effect
                motionX = (e.clientX / window.innerWidth - 0.5) * 2;
                motionY = (e.clientY / window.innerHeight - 0.5) * 2;
            });

            section.addEventListener('mouseleave', () => {
                motionX = 0;
                motionY = 0;
            });
        });
    }

    // =========================================================================
    // Scroll-Based Parallax
    // This ensures parallax effect even when quickly scrolling past
    // =========================================================================

    function initScrollParallax() {
        // Calculate scroll-based displacement offset
        // Uses the scroll position relative to the hero/coder sections
        function updateScrollOffset() {
            const scrollY = window.scrollY || window.pageYOffset;
            const viewportHeight = window.innerHeight;

            // Normalize scroll position: 0 at top, increases as we scroll down
            // Effect is strongest in first ~2 viewport heights
            const scrollProgress = Math.min(scrollY / (viewportHeight * 2), 1);

            // Apply scroll intensity to create displacement offset
            // Positive Y = image shifts down relative to depth, creating parallax
            scrollOffsetX = (scrollProgress - 0.5) * CONFIG.scrollIntensity.x * 2;
            scrollOffsetY = scrollProgress * CONFIG.scrollIntensity.y;
        }

        // Check for Lenis in window.ChrisTheme (how main.js exposes it)
        const lenisInstance = window.ChrisTheme && window.ChrisTheme.lenis;

        if (lenisInstance && typeof lenisInstance.on === 'function') {
            // Sync with Lenis smooth scroll for best results
            lenisInstance.on('scroll', updateScrollOffset);
        } else {
            // Fallback to native scroll with passive listener for performance
            window.addEventListener('scroll', updateScrollOffset, { passive: true });
        }

        // Initial calculation
        updateScrollOffset();
    }

    // =========================================================================
    // Resize handling
    // =========================================================================

    function handleResize() {
        if (!app) return;

        const mainSprite = app.stage.children[1];
        if (mainSprite) {
            const scale = Math.max(
                app.screen.width / mainSprite.texture.width,
                app.screen.height / mainSprite.texture.height
            ) * 1.05; // 5% buffer to prevent edge gaps
            mainSprite.scale.set(scale);
            mainSprite.x = app.screen.width / 2;
            mainSprite.y = app.screen.height / 2;
        }

        if (displacementSprite) {
            const depthScale = Math.max(
                app.screen.width / displacementSprite.texture.width,
                app.screen.height / displacementSprite.texture.height
            ) * 1.05; // Match main sprite buffer
            displacementSprite.scale.set(depthScale);
            displacementSprite.x = app.screen.width / 2;
            displacementSprite.y = app.screen.height / 2;
        }
    }

    // =========================================================================
    // Visibility handling (battery saving)
    // Canvas stays active while EITHER Hero OR Coder section is visible
    // =========================================================================

    let heroVisible = false;
    let coderVisible = false;

    function updateCanvasVisibility() {
        if (!app) return;

        const shouldBeActive = heroVisible || coderVisible;

        if (shouldBeActive) {
            app.ticker.start();
            container.style.opacity = '1';
        } else {
            app.ticker.stop();
            container.style.opacity = '0';
        }
    }

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.target === heroSection) {
                heroVisible = entry.isIntersecting;
            } else if (entry.target === coderSection) {
                coderVisible = entry.isIntersecting;
            }
        });
        updateCanvasVisibility();
    }, { threshold: 0 });

    // Observe both Hero and Coder sections
    if (heroSection) {
        observer.observe(heroSection);
    }
    if (coderSection) {
        observer.observe(coderSection);
    }

    // =========================================================================
    // Initialize
    // =========================================================================

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initPixi);
    } else {
        initPixi();
    }

})();
