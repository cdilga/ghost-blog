// Hero Depth Map Parallax Effect
// Uses PixiJS DisplacementFilter for depth-based parallax
// Input: MotionInput system (optical flow camera + mouse)

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

    const CONFIG = {
        displacementScale: {
            desktop: 38,
            mobile: 35
        },
        smoothing: 0.08
    };

    const isMobile = window.innerWidth <= 768;
    const maxDisplacement = isMobile ? CONFIG.displacementScale.mobile : CONFIG.displacementScale.desktop;

    // Current and target displacement values
    let currentX = 0;
    let currentY = 0;
    let targetX = 0;
    let targetY = 0;

    // DOM elements
    const heroLayer = document.querySelector('.hero__layer--dunes');
    if (!heroLayer) {
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

    // Create PixiJS canvas container
    const container = document.createElement('div');
    container.className = 'hero__depth-canvas';
    container.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 1;
    `;
    heroLayer.appendChild(container);

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

        } catch (error) {
            console.error('Hero Depth: Failed to initialize', error);
            heroImage.style.visibility = 'visible';
            container.remove();
        }
    }

    function animate() {
        if (!displacementFilter) return;

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
                targetX = x;
                targetY = y;
            });
        } else {
            // Fallback to mouse-only if MotionInput not loaded
            initMouseFallback();
        }
    }

    function initMouseFallback() {
        const heroSection = document.querySelector('.hero');
        if (!heroSection) return;

        heroSection.addEventListener('mousemove', (e) => {
            const rect = heroSection.getBoundingClientRect();
            targetX = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
            targetY = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
        });

        heroSection.addEventListener('mouseleave', () => {
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
    // =========================================================================

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (app) {
                if (entry.isIntersecting) {
                    app.ticker.start();
                } else {
                    app.ticker.stop();
                }
            }
        });
    }, { threshold: 0.1 });

    const heroSection = document.querySelector('.hero');
    if (heroSection) {
        observer.observe(heroSection);
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
