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

    // Motion control UI for mobile
    let motionButton = null;
    let motionStatus = null;

    function createMotionUI() {
        if (!isMobile) return;

        // Create container
        const container = document.createElement('div');
        container.className = 'hero-motion-ui';
        container.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 99999;
            text-align: center;
        `;

        // Create button
        motionButton = document.createElement('button');
        motionButton.style.cssText = `
            background: linear-gradient(135deg, #FF6B35 0%, #F7931E 100%);
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 25px;
            font-size: 14px;
            font-weight: 600;
            font-family: inherit;
            cursor: pointer;
            box-shadow: 0 4px 15px rgba(255, 107, 53, 0.4);
            display: flex;
            align-items: center;
            gap: 8px;
        `;
        motionButton.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 2L12 6M12 18L12 22M2 12L6 12M18 12L22 12"/>
                <circle cx="12" cy="12" r="4"/>
            </svg>
            Enable tilt control
        `;

        // Create status text
        motionStatus = document.createElement('div');
        motionStatus.style.cssText = `
            margin-top: 8px;
            font-size: 12px;
            color: rgba(255,255,255,0.7);
            text-shadow: 0 1px 3px rgba(0,0,0,0.5);
        `;

        container.appendChild(motionButton);
        container.appendChild(motionStatus);
        document.body.appendChild(container);

        return container;
    }

    function hideMotionButton() {
        if (motionButton) {
            motionButton.style.display = 'none';
        }
    }

    function showRetryButton(message) {
        if (motionButton) {
            motionButton.style.display = 'flex';
            motionButton.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M1 4v6h6M23 20v-6h-6"/>
                    <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/>
                </svg>
                Retry tilt control
            `;
            motionButton.onclick = () => {
                hideMotionButton();
                showMotionStatus('Retrying tilt sensors...');
                // Reset counters and try again
                gyroEventCount = 0;
                gyroValidEvents = 0;
                attachGyroHandler();
            };
        }
        showMotionStatus(message, true);
    }

    function showMotionStatus(message, isError = false) {
        if (motionStatus) {
            motionStatus.textContent = message;
            motionStatus.style.color = isError ? '#ff6b6b' : 'rgba(255,255,255,0.7)';
        }
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

    // Insert canvas container, hiding original images
    heroLayer.appendChild(container);
    heroImage.style.visibility = 'hidden';

    // Also hide the sky layer - we only want the dunes with depth effect
    const skyLayer = document.querySelector('.hero__layer--sky');
    if (skyLayer) {
        skyLayer.style.visibility = 'hidden';
    }

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

            // Ensure canvas fills container
            app.canvas.style.width = '100%';
            app.canvas.style.height = '100%';
            app.canvas.style.display = 'block';

            // Load the main image
            const mainTexture = await PIXI.Assets.load(imageSrc);
            const mainSprite = new PIXI.Sprite(mainTexture);

            // Scale sprite to cover container (object-fit: cover behavior)
            const scaleX = app.screen.width / mainSprite.width;
            const scaleY = app.screen.height / mainSprite.height;
            const scale = Math.max(scaleX, scaleY);
            mainSprite.scale.set(scale);

            // Center the sprite
            mainSprite.anchor.set(0.5);
            mainSprite.x = app.screen.width / 2;
            mainSprite.y = app.screen.height / 2;

            // Load depth map
            const depthTexture = await PIXI.Assets.load(depthMapSrc);
            displacementSprite = new PIXI.Sprite(depthTexture);
            displacementSprite.texture.source.addressMode = 'repeat';

            // IMPORTANT: Displacement sprite must cover FULL screen for effect to work everywhere
            // Scale it independently to ensure it fills the viewport completely
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
            createMotionUI();

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
            showMotionStatus('Tilt control not available');
            hideMotionButton();
            initTouchTracking();
            return;
        }

        // Request permission on iOS 13+
        if (typeof DeviceOrientationEvent.requestPermission === 'function') {
            console.log('Hero Depth: iOS detected, using button for permission');
            showMotionStatus('Tap button to enable tilt parallax');

            if (motionButton) {
                motionButton.onclick = () => {
                    console.log('Hero Depth: Button clicked, requesting gyro permission...');
                    DeviceOrientationEvent.requestPermission()
                        .then(permission => {
                            console.log('Hero Depth: Permission result:', permission);
                            if (permission === 'granted') {
                                hideMotionButton();
                                showMotionStatus('Tilt control enabled ✓');
                                setTimeout(() => { if (motionStatus) motionStatus.style.display = 'none'; }, 2000);
                                attachGyroHandler();
                            } else {
                                console.log('Hero Depth: Permission denied, using touch tracking');
                                showMotionStatus('Permission denied - using touch instead', true);
                                hideMotionButton();
                                initTouchTracking();
                            }
                        })
                        .catch((err) => {
                            console.error('Hero Depth: Permission error:', err);
                            showMotionStatus('Error requesting permission', true);
                            hideMotionButton();
                            initTouchTracking();
                        });
                };
            }
        } else {
            // Android/other - no permission needed, but may be blocked
            console.log('Hero Depth: Android/other, attaching gyro handler directly');
            hideMotionButton();
            showMotionStatus('Detecting tilt sensors...');
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
                window.removeEventListener('deviceorientation', handler);

                // Detect Brave browser and show retry option
                const isBrave = navigator.brave !== undefined || navigator.userAgent.includes('Brave');
                if (isBrave) {
                    showRetryButton('Brave blocks tilt. Enable in shield settings, then retry →');
                } else {
                    showRetryButton('Tilt sensors blocked. Check browser settings, then retry →');
                }
                initTouchTracking();
            } else {
                console.log('Hero Depth: Gyroscope working with', gyroValidEvents, 'valid events');
                showMotionStatus('Tilt control active ✓');
                setTimeout(() => { if (motionStatus) motionStatus.style.display = 'none'; }, 2000);
            }
        }, 2000);
    }

    let touchEventCount = 0;

    function initTouchTracking() {
        console.log('Hero Depth: Touch tracking fallback initialized');

        const heroSection = document.querySelector('.hero');
        if (!heroSection) {
            console.error('Hero Depth: .hero section not found!');
            return;
        }

        // Use document-level touch tracking for better capture
        document.addEventListener('touchmove', (e) => {
            if (e.touches.length === 0) return;

            const touch = e.touches[0];
            const rect = heroSection.getBoundingClientRect();

            // Only respond if touch is within hero bounds
            if (touch.clientY < rect.top || touch.clientY > rect.bottom) return;

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

        // PixiJS handles resize via resizeTo, but we need to re-scale and re-center sprites
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
            // Displacement sprite must also scale to cover full screen
            const depthScale = Math.max(
                app.screen.width / displacementSprite.texture.width,
                app.screen.height / displacementSprite.texture.height
            );
            displacementSprite.scale.set(depthScale);
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
