// Hero Depth Map Parallax Effect
// Uses PixiJS DisplacementFilter for depth-based parallax

(function() {
    'use strict';

    // Skip if reduced motion preferred
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        console.log('Hero Depth: Disabled (reduced motion)');
        return;
    }

    // Wait for PixiJS to load
    if (typeof PIXI === 'undefined') {
        console.warn('Hero Depth: PixiJS not loaded');
        return;
    }

    const CONFIG = {
        // Displacement intensity (higher = more movement)
        displacementScale: {
            desktop: 38,
            mobile: 35
        },
        // Smoothing factor for mouse tracking (0-1, lower = smoother)
        smoothing: 0.08,
        // Whether to use gyroscope on mobile
        useGyroscope: true,
        // Gyroscope sensitivity (1.0 = full range, higher = more responsive)
        gyroSensitivity: 1.5
    };

    const isMobile = window.innerWidth <= 768;
    const maxDisplacement = isMobile ? CONFIG.displacementScale.mobile : CONFIG.displacementScale.desktop;

    // Debug indicator (visible on mobile for testing)
    let debugIndicator = null;
    function showDebugStatus(message, color = '#FF6B35') {
        if (!isMobile) return; // Only show on mobile
        if (!debugIndicator) {
            debugIndicator = document.createElement('div');
            debugIndicator.style.cssText = `
                position: fixed;
                top: 10px;
                left: 10px;
                background: ${color};
                color: white;
                padding: 8px 12px;
                border-radius: 4px;
                font-size: 12px;
                font-family: monospace;
                z-index: 99999;
                pointer-events: none;
            `;
            document.body.appendChild(debugIndicator);
        }
        debugIndicator.textContent = message;
        debugIndicator.style.background = color;
    }

    // Image paths - using Ghost's asset helper via data attributes
    const heroLayer = document.querySelector('.hero__layer--dunes');
    if (!heroLayer) {
        console.warn('Hero Depth: Hero layer not found');
        return;
    }

    const heroImage = heroLayer.querySelector('img');
    if (!heroImage) {
        console.warn('Hero Depth: Hero image not found');
        return;
    }

    // Get image sources
    const imageSrc = heroImage.src;
    // Construct depth map path (same name with _depth_anything_2_greyscale suffix)
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

    // Insert canvas container, hiding original image
    heroLayer.appendChild(container);
    heroImage.style.visibility = 'hidden';

    // Current and target displacement values (for smoothing)
    let currentX = 0;
    let currentY = 0;
    let targetX = 0;
    let targetY = 0;

    // PixiJS setup
    let app = null;
    let displacementSprite = null;
    let displacementFilter = null;

    async function initPixi() {
        try {
            // Create PixiJS application
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

            // Load the main image
            const mainTexture = await PIXI.Assets.load(imageSrc);
            const mainSprite = new PIXI.Sprite(mainTexture);

            // Scale sprite to cover container
            const scale = Math.max(
                app.screen.width / mainSprite.width,
                app.screen.height / mainSprite.height
            );
            mainSprite.scale.set(scale);

            // Center the sprite
            mainSprite.anchor.set(0.5);
            mainSprite.x = app.screen.width / 2;
            mainSprite.y = app.screen.height / 2;

            // Load depth map
            const depthTexture = await PIXI.Assets.load(depthMapSrc);
            displacementSprite = new PIXI.Sprite(depthTexture);
            displacementSprite.texture.source.addressMode = 'repeat';

            // Scale depth map to match main image
            displacementSprite.scale.set(scale);
            displacementSprite.anchor.set(0.5);
            displacementSprite.x = app.screen.width / 2;
            displacementSprite.y = app.screen.height / 2;

            // Create displacement filter
            displacementFilter = new PIXI.DisplacementFilter({
                sprite: displacementSprite,
                scale: { x: 0, y: 0 }
            });

            // Apply filter to main sprite
            mainSprite.filters = [displacementFilter];

            // Add sprites to stage
            app.stage.addChild(displacementSprite);
            app.stage.addChild(mainSprite);

            // Start animation loop
            app.ticker.add(animate);

            // Set up input handlers
            if (isMobile && CONFIG.useGyroscope) {
                initGyroscope();
            } else {
                initMouseTracking();
            }

            // Handle resize
            window.addEventListener('resize', handleResize);

            console.log('Hero Depth: Initialized successfully');
            showDebugStatus('PixiJS ready', '#4CAF50');

        } catch (error) {
            console.error('Hero Depth: Failed to initialize', error);
            // Show original image on error
            heroImage.style.visibility = 'visible';
            container.remove();
        }
    }

    let animateLogCount = 0;
    function animate() {
        if (!displacementFilter) return;

        // Smooth interpolation toward target
        currentX += (targetX - currentX) * CONFIG.smoothing;
        currentY += (targetY - currentY) * CONFIG.smoothing;

        // Apply displacement
        displacementFilter.scale.x = currentX * maxDisplacement;
        displacementFilter.scale.y = currentY * maxDisplacement;

        // Log occasionally when there's actual movement
        if (animateLogCount < 5 && (Math.abs(targetX) > 0.1 || Math.abs(targetY) > 0.1)) {
            console.log('Hero Depth: Animate - target:', targetX.toFixed(2), targetY.toFixed(2), 'scale:', displacementFilter.scale.x.toFixed(1), displacementFilter.scale.y.toFixed(1));
            animateLogCount++;
        }
    }

    function initMouseTracking() {
        const heroSection = document.querySelector('.hero');
        if (!heroSection) return;

        heroSection.addEventListener('mousemove', (e) => {
            const rect = heroSection.getBoundingClientRect();
            // Normalize to -1 to 1 range
            targetX = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
            targetY = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
        });

        heroSection.addEventListener('mouseleave', () => {
            // Return to center when mouse leaves
            targetX = 0;
            targetY = 0;
        });

        console.log('Hero Depth: Mouse tracking enabled');
    }

    function initGyroscope() {
        console.log('Hero Depth: initGyroscope called');
        console.log('Hero Depth: DeviceOrientationEvent exists:', 'DeviceOrientationEvent' in window);
        console.log('Hero Depth: requestPermission exists:', typeof DeviceOrientationEvent?.requestPermission === 'function');

        // Check for gyroscope support
        if (!('DeviceOrientationEvent' in window)) {
            console.log('Hero Depth: No DeviceOrientationEvent, falling back to touch');
            initTouchTracking();
            return;
        }

        // Request permission on iOS 13+
        if (typeof DeviceOrientationEvent.requestPermission === 'function') {
            console.log('Hero Depth: iOS detected, waiting for tap to request permission');
            // Need user interaction to request
            const enableGyro = () => {
                console.log('Hero Depth: Touch detected, requesting gyro permission...');
                DeviceOrientationEvent.requestPermission()
                    .then(permission => {
                        console.log('Hero Depth: Permission result:', permission);
                        if (permission === 'granted') {
                            attachGyroHandler();
                        } else {
                            console.log('Hero Depth: Permission denied, using touch tracking');
                            initTouchTracking();
                        }
                    })
                    .catch((err) => {
                        console.error('Hero Depth: Permission error:', err);
                        initTouchTracking();
                    });
                document.removeEventListener('touchstart', enableGyro, { once: true });
            };
            document.addEventListener('touchstart', enableGyro, { once: true });
        } else {
            // Android - no permission needed
            console.log('Hero Depth: Android/other, attaching gyro handler directly');
            attachGyroHandler();
        }
    }

    let gyroEventCount = 0;
    let gyroValidEvents = 0;
    function attachGyroHandler() {
        let gyroTimeout = null;

        const handler = (e) => {
            // Check if we have VALID gyro data (not null/undefined)
            const hasValidData = e.gamma !== null && e.gamma !== undefined &&
                                 e.beta !== null && e.beta !== undefined;

            // Log first few events for debugging
            if (gyroEventCount < 3) {
                console.log('Hero Depth: Gyro event', gyroEventCount, '- beta:', e.beta, 'gamma:', e.gamma, 'valid:', hasValidData);
                gyroEventCount++;
            }

            if (!hasValidData) {
                // Event fired but no real data - likely blocked browser
                return;
            }

            gyroValidEvents++;

            // gamma: left-right tilt (-90 to 90)
            // beta: front-back tilt (-180 to 180)
            const gamma = e.gamma;
            const beta = e.beta;

            // Normalize to -1 to 1 range, accounting for device being held at ~45 degrees
            targetX = Math.max(-1, Math.min(1, gamma / 45)) * CONFIG.gyroSensitivity;
            targetY = Math.max(-1, Math.min(1, (beta - 45) / 45)) * CONFIG.gyroSensitivity;
        };

        window.addEventListener('deviceorientation', handler, { passive: true });
        console.log('Hero Depth: Gyroscope handler attached');

        // Fallback: if no VALID gyro events after 2 seconds, switch to touch tracking
        gyroTimeout = setTimeout(() => {
            if (gyroValidEvents === 0) {
                console.log('Hero Depth: No valid gyro events received, falling back to touch');
                showDebugStatus('Gyro blocked, using touch...', '#FF9800');
                window.removeEventListener('deviceorientation', handler);
                initTouchTracking();
            } else {
                console.log('Hero Depth: Gyroscope working with', gyroValidEvents, 'valid events');
                showDebugStatus('Gyro active', '#4CAF50');
            }
        }, 2000);
    }

    let touchEventCount = 0;

    function initTouchTracking() {
        console.log('Hero Depth: Touch tracking fallback initialized');
        showDebugStatus('Touch mode active', '#4CAF50');

        const heroSection = document.querySelector('.hero');
        if (!heroSection) {
            console.error('Hero Depth: .hero section not found!');
            showDebugStatus('ERROR: No hero', '#f44336');
            return;
        }

        // Use document-level touch tracking for better capture
        document.addEventListener('touchmove', (e) => {
            if (e.touches.length === 0) return;

            const touch = e.touches[0];
            const rect = heroSection.getBoundingClientRect();

            // Only respond if touch is within hero bounds
            if (touch.clientY < rect.top || touch.clientY > rect.bottom) return;

            // Show touch is being captured
            if (touchEventCount < 10) {
                showDebugStatus(`Touch: ${touch.clientX.toFixed(0)},${touch.clientY.toFixed(0)}`, '#2196F3');
                touchEventCount++;
            }

            targetX = ((touch.clientX - rect.left) / rect.width - 0.5) * 2;
            targetY = ((touch.clientY - rect.top) / rect.height - 0.5) * 2;
        }, { passive: true });

        document.addEventListener('touchend', () => {
            targetX = 0;
            targetY = 0;
        });

        console.log('Hero Depth: Touch tracking enabled on document');
    }

    function handleResize() {
        if (!app) return;

        // PixiJS handles resize via resizeTo, but we may need to re-center sprites
        const mainSprite = app.stage.children[1];
        if (mainSprite) {
            const scale = Math.max(
                app.screen.width / (mainSprite.texture.width),
                app.screen.height / (mainSprite.texture.height)
            );
            mainSprite.scale.set(scale);
            mainSprite.x = app.screen.width / 2;
            mainSprite.y = app.screen.height / 2;
        }

        if (displacementSprite) {
            displacementSprite.x = app.screen.width / 2;
            displacementSprite.y = app.screen.height / 2;
        }
    }

    // Pause when hero is not visible (battery saving)
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

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initPixi);
    } else {
        initPixi();
    }

})();
