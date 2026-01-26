// 8 Claude Codes Depth Map Parallax Effect
// Second depth-map canvas for the Claude Codes section
// Uses PixiJS DisplacementFilter with desert_ground_from_top_of_big_red image
// Shares MotionInput with Hero+Coder canvas for synchronized parallax

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

    // DOM elements
    const claudeCodesSection = document.querySelector('.scene--claude-codes');
    if (!claudeCodesSection) {
        return;
    }

    // Resolve asset paths using Ghost theme assets
    const themeAssetsBase = document.querySelector('link[href*="screen.css"]')?.href?.replace(/\/css\/screen\.css.*$/, '') || '/assets';
    const imageSrc = themeAssetsBase + '/images/desert_ground_from_top_of_big_red.jpg';
    const depthMapSrc = themeAssetsBase + '/images/desert_ground_from_top_of_big_red_depth_anything_2_greyscale.png';

    // Create PixiJS canvas container
    const container = document.createElement('div');
    container.className = 'claude-codes__depth-canvas';
    container.id = 'depth-canvas-claude-codes';
    container.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 0;
        opacity: 0;
        transition: opacity 0.5s ease;
    `;

    // Insert canvas into section (at the beginning, behind content)
    claudeCodesSection.style.position = 'relative';
    claudeCodesSection.insertBefore(container, claudeCodesSection.firstChild);

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

            // Scale to cover container
            const scaleX = app.screen.width / mainSprite.width;
            const scaleY = app.screen.height / mainSprite.height;
            const scale = Math.max(scaleX, scaleY);
            mainSprite.scale.set(scale);
            mainSprite.anchor.set(0.5);
            mainSprite.x = app.screen.width / 2;
            mainSprite.y = app.screen.height / 2;

            // Load depth map
            const depthTexture = await PIXI.Assets.load(depthMapSrc);
            displacementSprite = new PIXI.Sprite(depthTexture);
            displacementSprite.texture.source.addressMode = 'repeat';

            // Displacement sprite must cover full screen
            const depthScaleX = app.screen.width / displacementSprite.width;
            const depthScaleY = app.screen.height / displacementSprite.height;
            const depthScale = Math.max(depthScaleX, depthScaleY);
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

            // Initially paused until section is visible
            app.ticker.stop();

        } catch (error) {
            console.error('Claude Codes Depth: Failed to initialize', error);
            container.remove();
        }
    }

    function animate() {
        if (!displacementFilter) return;

        // STATIC MODE: No displacement, just show the depth-mapped image
        // The depth effect is baked into the image itself
        displacementFilter.scale.x = 0;
        displacementFilter.scale.y = 0;
    }

    // =========================================================================
    // Motion Input Integration (shared with Hero+Coder canvas)
    // =========================================================================

    function initMotionInput() {
        // Check if MotionInput is available - subscribe to same input as Hero canvas
        if (typeof MotionInput !== 'undefined') {
            MotionInput.subscribe((x, y) => {
                targetX = x;
                targetY = y;
            });
        } else {
            // Fallback to mouse-only if MotionInput not loaded
            initMouseFallback();
        }
    }

    function initMouseFallback() {
        claudeCodesSection.addEventListener('mousemove', (e) => {
            // Use viewport-relative coordinates for consistent effect
            targetX = (e.clientX / window.innerWidth - 0.5) * 2;
            targetY = (e.clientY / window.innerHeight - 0.5) * 2;
        });

        claudeCodesSection.addEventListener('mouseleave', () => {
            targetX = 0;
            targetY = 0;
        });
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
            );
            mainSprite.scale.set(scale);
            mainSprite.x = app.screen.width / 2;
            mainSprite.y = app.screen.height / 2;
        }

        if (displacementSprite) {
            const depthScale = Math.max(
                app.screen.width / displacementSprite.texture.width,
                app.screen.height / displacementSprite.texture.height
            );
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
