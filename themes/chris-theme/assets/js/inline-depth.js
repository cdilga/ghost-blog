// Inline Image Depth Effect
// Applies PixiJS depth displacement to individual images within sections
// Uses data-depth-map attribute to specify the depth map path
// Includes scroll-based parallax like hero-depth.js

(function() {
    'use strict';

    // Prevent multiple initializations
    if (window.__inlineDepthInitialized) {
        return;
    }
    window.__inlineDepthInitialized = true;

    // Skip if reduced motion preferred
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        return;
    }

    // Wait for PixiJS to load
    if (typeof PIXI === 'undefined') {
        console.warn('Inline Depth: PixiJS not loaded');
        return;
    }

    const CONFIG = {
        displacementScale: {
            desktop: 25,
            mobile: 20
        },
        smoothing: 0.1,
        // Scroll-based parallax intensity (like hero-depth.js)
        scrollIntensity: {
            x: 0.3,  // Horizontal shift based on scroll
            y: 0.8   // Vertical shift - primary scroll effect
        }
    };

    const isMobile = window.innerWidth <= 768;
    const maxDisplacement = isMobile ? CONFIG.displacementScale.mobile : CONFIG.displacementScale.desktop;

    // Find all images with depth maps
    const depthImages = document.querySelectorAll('img[data-depth-map]');
    if (depthImages.length === 0) {
        return;
    }

    // Initialize each depth image
    depthImages.forEach(initDepthImage);

    async function initDepthImage(img) {
        const depthMapPath = img.dataset.depthMap;
        if (!depthMapPath) return;

        // Skip if already initialized or currently initializing
        if (img.dataset.depthInitialized) return;
        img.dataset.depthInitialized = 'pending';

        // For lazy-loaded images that haven't started loading yet,
        // use IntersectionObserver to wait until they're in viewport
        if (img.loading === 'lazy' && !img.complete && img.naturalWidth === 0) {
            await new Promise((resolve) => {
                const visibilityObserver = new IntersectionObserver((entries, obs) => {
                    if (entries[0].isIntersecting) {
                        obs.disconnect();
                        resolve();
                    }
                }, { threshold: 0.1 });
                visibilityObserver.observe(img);
            });
        }

        // Wait for image to load (triggered by lazy loading when in viewport)
        if (!img.complete || img.naturalWidth === 0) {
            await new Promise((resolve) => {
                img.addEventListener('load', resolve, { once: true });
                img.addEventListener('error', resolve, { once: true });
            });
        }

        // Skip if image failed to load
        if (img.naturalWidth === 0) {
            console.warn('Inline Depth: Image failed to load', img.src);
            img.dataset.depthInitialized = '';
            return;
        }

        const imageSrc = img.src;
        const container = img.parentElement;

        // Create canvas container
        const canvasContainer = document.createElement('div');
        canvasContainer.className = 'inline-depth-canvas';
        canvasContainer.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
        `;

        // State
        let app = null;
        let displacementFilter = null;
        let currentX = 0;
        let currentY = 0;
        let targetX = 0;
        let targetY = 0;
        let isVisible = false;

        // Scroll-based offset (added to motion/mouse input)
        let scrollOffsetX = 0;
        let scrollOffsetY = 0;

        // Motion/mouse input (separate from scroll)
        let motionX = 0;
        let motionY = 0;

        try {
            app = new PIXI.Application();
            await app.init({
                width: img.offsetWidth || 400,
                height: img.offsetHeight || 300,
                backgroundAlpha: 0,
                antialias: true,
                resolution: window.devicePixelRatio || 1,
                autoDensity: true
            });

            canvasContainer.appendChild(app.canvas);
            app.canvas.style.width = '100%';
            app.canvas.style.height = '100%';
            app.canvas.style.display = 'block';

            // Load main image
            const mainTexture = await PIXI.Assets.load(imageSrc);
            const mainSprite = new PIXI.Sprite(mainTexture);

            // Scale to cover with buffer to prevent edge gaps
            const scaleX = app.screen.width / mainSprite.width;
            const scaleY = app.screen.height / mainSprite.height;
            const scale = Math.max(scaleX, scaleY) * 1.05; // 5% buffer
            mainSprite.scale.set(scale);
            mainSprite.anchor.set(0.5);
            mainSprite.x = app.screen.width / 2;
            mainSprite.y = app.screen.height / 2;

            // Load depth map
            const depthTexture = await PIXI.Assets.load(depthMapPath);
            const displacementSprite = new PIXI.Sprite(depthTexture);
            displacementSprite.texture.source.addressMode = 'clamp-to-edge';

            // Scale depth map with buffer
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

            // Insert canvas and hide original image
            container.style.position = 'relative';
            container.appendChild(canvasContainer);
            img.style.visibility = 'hidden';

            // Animation loop - combines motion/mouse input with scroll offset
            app.ticker.add(() => {
                if (!displacementFilter || !isVisible) return;

                // Combine motion/mouse input with scroll offset (like hero-depth.js)
                targetX = motionX + scrollOffsetX;
                targetY = motionY + scrollOffsetY;

                currentX += (targetX - currentX) * CONFIG.smoothing;
                currentY += (targetY - currentY) * CONFIG.smoothing;

                displacementFilter.scale.x = currentX * maxDisplacement;
                displacementFilter.scale.y = currentY * maxDisplacement;
            });

            // Mouse tracking on parent container
            container.addEventListener('mousemove', (e) => {
                const rect = container.getBoundingClientRect();
                motionX = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
                motionY = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
            });

            container.addEventListener('mouseleave', () => {
                motionX = 0;
                motionY = 0;
            });

            // MotionInput integration if available
            if (typeof MotionInput !== 'undefined') {
                MotionInput.subscribe((x, y) => {
                    motionX = x * 0.5;
                    motionY = y * 0.5;
                });
            }

            // Scroll-based parallax (like hero-depth.js)
            function updateScrollOffset() {
                const rect = container.getBoundingClientRect();
                const viewportHeight = window.innerHeight;

                // Calculate progress based on element position in viewport
                // 0 when element enters viewport from bottom, 1 when it exits top
                const elementCenter = rect.top + rect.height / 2;
                const scrollProgress = 1 - (elementCenter / viewportHeight);
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

            // Visibility tracking
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    isVisible = entry.isIntersecting;
                    if (isVisible) {
                        app.ticker.start();
                    } else {
                        app.ticker.stop();
                    }
                });
            }, { threshold: 0.1 });

            observer.observe(container);

            // Handle resize
            const resizeObserver = new ResizeObserver(() => {
                if (!app) return;
                app.renderer.resize(container.offsetWidth, container.offsetHeight);

                // Rescale sprites
                const newScaleX = app.screen.width / mainSprite.texture.width;
                const newScaleY = app.screen.height / mainSprite.texture.height;
                const newScale = Math.max(newScaleX, newScaleY);
                mainSprite.scale.set(newScale);
                mainSprite.x = app.screen.width / 2;
                mainSprite.y = app.screen.height / 2;

                const newDepthScale = Math.max(
                    app.screen.width / displacementSprite.texture.width,
                    app.screen.height / displacementSprite.texture.height
                );
                displacementSprite.scale.set(newDepthScale);
                displacementSprite.x = app.screen.width / 2;
                displacementSprite.y = app.screen.height / 2;
            });

            resizeObserver.observe(container);

            // Mark as successfully initialized
            img.dataset.depthInitialized = 'true';
            console.log('Inline Depth: Initialized for', img.alt || 'image');

        } catch (error) {
            console.error('Inline Depth: Failed to initialize', error);
            img.style.visibility = 'visible';
            img.dataset.depthInitialized = '';
            canvasContainer.remove();
        }
    }

})();
