// 8 Claude Codes Depth Map Parallax Effect
// Second depth-map canvas for the Claude Codes section
// Uses PixiJS DisplacementFilter with desert_ground_from_top_of_big_red image
// Shares MotionInput with Hero+Coder canvas for synchronized parallax
//
// MOBILE COMPATIBILITY NOTE:
// This script reads image URLs from preloaded <img> elements in the HTML
// (see index.hbs .claude-codes__background-preload). This pattern is REQUIRED
// for mobile devices - constructing URLs from stylesheets fails on real mobile
// even though it works in Chrome's mobile emulation.
//
// The hero-depth.js uses the same pattern (reading from .hero__layer--dunes img)
// which is why the hero canvas works reliably on mobile.

(function() {
    'use strict';

    // Skip if reduced motion preferred
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        return;
    }

    // Wait for PixiJS to load
    if (typeof PIXI === 'undefined') {
        console.warn('Claude Codes Depth: PixiJS not loaded');
        return;
    }

    const CONFIG = {
        displacementScale: {
            desktop: 35,
            mobile: 30
        },
        smoothing: 0.08,
        // Scroll-based parallax intensity (like hero-depth.js)
        scrollIntensity: {
            x: 0.3,
            y: 1.0
        },
        // Asset paths (relative to theme assets)
        imagePath: '/assets/images/desert_ground_from_top_of_big_red.jpg',
        depthMapPath: '/assets/images/desert_ground_from_top_of_big_red_depth_anything_2_greyscale.png'
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

    // DOM elements
    const claudeCodesSection = document.querySelector('.scene--claude-codes');
    if (!claudeCodesSection) {
        return;
    }

    // Get image sources from preloaded <img> elements in HTML (like hero-depth.js pattern)
    // This ensures images are preloaded by browser and URLs are correct
    const bgImage = claudeCodesSection.querySelector('.claude-codes__bg-image');
    const depthImage = claudeCodesSection.querySelector('.claude-codes__depth-image');

    if (!bgImage || !depthImage) {
        console.warn('[claude-codes-depth] Preload images not found, falling back to constructed paths');
        // Fallback to constructed paths if preload elements don't exist
        const stylesheetLink = document.querySelector('link[href*="style.css"]') || document.querySelector('link[href*="screen.css"]');
        const themeAssetsBase = stylesheetLink?.href?.replace(/\/css\/style\.css.*$/, '').replace(/\/css\/screen\.css.*$/, '') || '/assets';
        var imageSrc = themeAssetsBase + '/images/desert_ground_from_top_of_big_red.jpg';
        var depthMapSrc = themeAssetsBase + '/images/desert_ground_from_top_of_big_red_depth_anything_2_greyscale.png';
    } else {
        var imageSrc = bgImage.src;
        var depthMapSrc = depthImage.src;
    }

    console.log('[claude-codes-depth] Init:', { isMobile, imageSrc: imageSrc.substring(imageSrc.lastIndexOf('/') + 1), fromPreload: !!bgImage });

    // Create PixiJS canvas container
    const container = document.createElement('div');
    container.className = 'claude-codes__depth-canvas';
    container.id = 'depth-canvas-claude-codes';
    // Note: position/size/z-index defined in CSS (.claude-codes__depth-canvas)
    // Only set opacity here - CSS handles height with 100lvh for mobile chrome transitions
    container.style.opacity = '0';

    // Insert canvas into body (fixed position, behind content)
    document.body.appendChild(container);

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
            const scale = Math.max(scaleX, scaleY) * 1.15; // 15% buffer for high aspect ratios
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
            const depthScale = Math.max(depthScaleX, depthScaleY) * 1.15; // Match main sprite buffer
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

            // Start animation loop
            app.ticker.add(animate);

            // Handle resize
            window.addEventListener('resize', handleResize);

            // Subscribe to MotionInput (shared with Hero+Coder canvas)
            initMotionInput();

            // Initialize scroll-based parallax
            initScrollParallax();

            // Initially paused until section is visible
            app.ticker.stop();

        } catch (error) {
            console.error('Claude Codes Depth: Failed to initialize', error);
            container.remove();
        }
    }

    function animate() {
        if (!displacementFilter) return;

        // Combine motion/mouse input with scroll offset (like hero-depth.js)
        targetX = motionX + scrollOffsetX;
        targetY = motionY + scrollOffsetY;

        // Smooth interpolation toward target
        currentX += (targetX - currentX) * CONFIG.smoothing;
        currentY += (targetY - currentY) * CONFIG.smoothing;

        // Apply displacement based on combined input
        displacementFilter.scale.x = currentX * maxDisplacement;
        displacementFilter.scale.y = currentY * maxDisplacement;
    }

    // =========================================================================
    // Motion Input Integration (shared with Hero+Coder canvas)
    // =========================================================================

    function initMotionInput() {
        // Check if MotionInput is available - subscribe to same input as Hero canvas
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
        claudeCodesSection.addEventListener('mousemove', (e) => {
            // Use viewport-relative coordinates for consistent effect
            motionX = (e.clientX / window.innerWidth - 0.5) * 2;
            motionY = (e.clientY / window.innerHeight - 0.5) * 2;
        });

        claudeCodesSection.addEventListener('mouseleave', () => {
            motionX = 0;
            motionY = 0;
        });
    }

    // =========================================================================
    // Scroll-Based Parallax (like hero-depth.js)
    // =========================================================================

    function initScrollParallax() {
        function updateScrollOffset() {
            const rect = claudeCodesSection.getBoundingClientRect();
            const viewportHeight = window.innerHeight;

            // Calculate progress based on section position in viewport
            const sectionCenter = rect.top + rect.height / 2;
            const scrollProgress = 1 - (sectionCenter / viewportHeight);
            const clampedProgress = Math.max(0, Math.min(1, scrollProgress));

            // Apply scroll intensity to create displacement offset
            scrollOffsetX = (clampedProgress - 0.5) * CONFIG.scrollIntensity.x * 2;
            scrollOffsetY = clampedProgress * CONFIG.scrollIntensity.y;
        }

        // Check for Lenis in window.ChrisTheme
        const lenisInstance = window.ChrisTheme && window.ChrisTheme.lenis;

        if (lenisInstance && typeof lenisInstance.on === 'function') {
            lenisInstance.on('scroll', updateScrollOffset);
        } else {
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
            ) * 1.15; // 15% buffer for high aspect ratios to prevent edge gaps
            mainSprite.scale.set(scale);
            mainSprite.x = app.screen.width / 2;
            mainSprite.y = app.screen.height / 2;
        }

        if (displacementSprite) {
            const depthScale = Math.max(
                app.screen.width / displacementSprite.texture.width,
                app.screen.height / displacementSprite.texture.height
            ) * 1.15; // Match main sprite buffer
            displacementSprite.scale.set(depthScale);
            displacementSprite.x = app.screen.width / 2;
            displacementSprite.y = app.screen.height / 2;
        }
    }

    // =========================================================================
    // Visibility handling (battery saving)
    // NOTE: Only controls ticker, not opacity. Opacity is controlled by
    // terminal-spawn.js for the CRT exit animation.
    // =========================================================================

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (app) {
                if (entry.isIntersecting) {
                    app.ticker.start();
                    // Show canvas when section enters - opacity controlled here on entry
                    // but exit opacity is handled by terminal-spawn.js CRT animation
                    container.style.opacity = '1';
                } else {
                    app.ticker.stop();
                    // Don't set opacity to 0 here - let terminal-spawn.js CRT animation handle it
                }
            }
        });
    }, { threshold: 0.1 });

    observer.observe(claudeCodesSection);

    // =========================================================================
    // Initialize
    // =========================================================================

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initPixi);
    } else {
        initPixi();
    }

})();
