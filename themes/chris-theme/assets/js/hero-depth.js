// Hero Depth Map Parallax Effect
// Uses PixiJS DisplacementFilter for depth-based parallax
// Input methods: Face tracking (camera), Gyroscope (iOS), Mouse/Touch (fallback)

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
        // Smoothing factor (0-1, lower = smoother)
        smoothing: 0.08,
        // Face tracking settings
        faceTracking: {
            enabled: true,
            sensitivity: 2.0
        },
        // Gyroscope settings (iOS only - Android browsers block it)
        gyroscope: {
            enabled: true,
            sensitivity: 1.2
        }
    };

    const isMobile = window.innerWidth <= 768;
    const maxDisplacement = isMobile ? CONFIG.displacementScale.mobile : CONFIG.displacementScale.desktop;

    // Current and target displacement values (for smoothing)
    let currentX = 0;
    let currentY = 0;
    let targetX = 0;
    let targetY = 0;

    // Active input method tracking
    let activeInputMethod = null;

    // DOM elements
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

    // Hide sky layer - we only want dunes with depth effect
    const skyLayer = document.querySelector('.hero__layer--sky');
    if (skyLayer) {
        skyLayer.style.visibility = 'hidden';
    }

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

            console.log('Hero Depth: Initialized successfully');

            // Initialize input methods
            initInputMethods();

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
    // Input Method Chain: Face Tracking -> Gyroscope (iOS) -> Mouse/Touch
    // =========================================================================

    async function initInputMethods() {
        // Try face tracking first (works everywhere with camera permission)
        if (CONFIG.faceTracking.enabled) {
            const faceTrackingWorked = await initFaceTracking();
            if (faceTrackingWorked) return;
        }

        // Try gyroscope on mobile (only works on iOS Safari with permission)
        if (isMobile && CONFIG.gyroscope.enabled) {
            const gyroWorked = await initGyroscope();
            if (gyroWorked) return;
        }

        // Fall back to mouse/touch
        if (isMobile) {
            initTouchTracking();
        } else {
            initMouseTracking();
        }
    }

    // =========================================================================
    // Face Tracking (Camera-based head position detection)
    // =========================================================================

    let faceDetector = null;
    let videoElement = null;
    let faceTrackingActive = false;
    let faceBaseline = null;

    async function initFaceTracking() {
        // Check if TensorFlow.js face detection is available
        if (typeof tf === 'undefined' || typeof faceDetection === 'undefined') {
            console.log('Hero Depth: Face detection not loaded, skipping');
            return false;
        }

        try {
            // Request camera permission
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'user',
                    width: { ideal: 320 },
                    height: { ideal: 240 }
                }
            });

            // Create hidden video element
            videoElement = document.createElement('video');
            videoElement.srcObject = stream;
            videoElement.autoplay = true;
            videoElement.playsInline = true;
            videoElement.muted = true;
            videoElement.style.cssText = 'position:absolute;opacity:0;pointer-events:none;width:1px;height:1px;';
            document.body.appendChild(videoElement);

            await videoElement.play();

            // Initialize face detector
            const model = faceDetection.SupportedModels.MediaPipeFaceDetector;
            faceDetector = await faceDetection.createDetector(model, {
                runtime: 'tfjs',
                maxFaces: 1
            });

            faceTrackingActive = true;
            activeInputMethod = 'face';
            trackFace();

            console.log('Hero Depth: Face tracking enabled');
            return true;

        } catch (error) {
            console.log('Hero Depth: Face tracking unavailable -', error.message);
            return false;
        }
    }

    async function trackFace() {
        if (!faceTrackingActive || !faceDetector || !videoElement) return;

        try {
            const faces = await faceDetector.estimateFaces(videoElement);

            if (faces.length > 0) {
                const face = faces[0];
                const box = face.box;

                // Calculate face center (normalized 0-1)
                const faceCenterX = (box.xMin + box.width / 2) / videoElement.videoWidth;
                const faceCenterY = (box.yMin + box.height / 2) / videoElement.videoHeight;

                // Set baseline on first detection
                if (!faceBaseline) {
                    faceBaseline = { x: faceCenterX, y: faceCenterY };
                    console.log('Hero Depth: Face baseline set');
                }

                // Calculate delta (invert X because camera is mirrored)
                const deltaX = -(faceCenterX - faceBaseline.x);
                const deltaY = faceCenterY - faceBaseline.y;

                // Scale to -1 to 1 range
                targetX = Math.max(-1, Math.min(1, deltaX * CONFIG.faceTracking.sensitivity * 4));
                targetY = Math.max(-1, Math.min(1, deltaY * CONFIG.faceTracking.sensitivity * 4));
            }
        } catch (error) {
            // Silently continue on detection errors
        }

        // Continue tracking at ~30fps
        requestAnimationFrame(trackFace);
    }

    // =========================================================================
    // Gyroscope (iOS Safari only - Android browsers block this)
    // =========================================================================

    let gyroBaseline = null;

    async function initGyroscope() {
        return new Promise((resolve) => {
            if (!('DeviceOrientationEvent' in window)) {
                console.log('Hero Depth: DeviceOrientationEvent not supported');
                resolve(false);
                return;
            }

            // iOS 13+ requires permission via user gesture
            if (typeof DeviceOrientationEvent.requestPermission === 'function') {
                // We need a user gesture - create a one-time touch handler
                const requestOnTouch = async () => {
                    document.removeEventListener('touchstart', requestOnTouch);
                    try {
                        const permission = await DeviceOrientationEvent.requestPermission();
                        if (permission === 'granted') {
                            attachGyroHandler();
                            activeInputMethod = 'gyroscope';
                            console.log('Hero Depth: Gyroscope enabled (iOS)');
                            resolve(true);
                        } else {
                            console.log('Hero Depth: Gyroscope permission denied');
                            resolve(false);
                        }
                    } catch (err) {
                        console.log('Hero Depth: Gyroscope permission error');
                        resolve(false);
                    }
                };

                // iOS Safari - wait for first touch to request permission
                document.addEventListener('touchstart', requestOnTouch, { once: true });
                console.log('Hero Depth: Waiting for touch to request gyro permission (iOS)');

                // Don't block - resolve false for now, touch handler will enable it later
                resolve(false);
                return;
            }

            // Android/other - try direct attach, but it's likely blocked
            let validEvents = 0;
            const handler = (e) => {
                if (e.gamma !== null && e.beta !== null) {
                    validEvents++;

                    if (!gyroBaseline) {
                        gyroBaseline = { beta: e.beta, gamma: e.gamma };
                    }

                    const deltaGamma = e.gamma - gyroBaseline.gamma;
                    const deltaBeta = e.beta - gyroBaseline.beta;
                    const tiltRange = 15;

                    targetX = Math.max(-1, Math.min(1, deltaGamma / tiltRange)) * CONFIG.gyroscope.sensitivity;
                    targetY = Math.max(-1, Math.min(1, deltaBeta / tiltRange)) * CONFIG.gyroscope.sensitivity;
                }
            };

            window.addEventListener('deviceorientation', handler, { passive: true });

            // Check if we get valid data within 1.5 seconds
            setTimeout(() => {
                if (validEvents > 0) {
                    activeInputMethod = 'gyroscope';
                    console.log('Hero Depth: Gyroscope enabled');
                    resolve(true);
                } else {
                    window.removeEventListener('deviceorientation', handler);
                    console.log('Hero Depth: Gyroscope blocked (likely Brave/privacy browser)');
                    resolve(false);
                }
            }, 1500);
        });
    }

    function attachGyroHandler() {
        window.addEventListener('deviceorientation', (e) => {
            if (e.gamma === null || e.beta === null) return;

            if (!gyroBaseline) {
                gyroBaseline = { beta: e.beta, gamma: e.gamma };
                console.log('Hero Depth: Gyro baseline calibrated');
            }

            const deltaGamma = e.gamma - gyroBaseline.gamma;
            const deltaBeta = e.beta - gyroBaseline.beta;
            const tiltRange = 15;

            targetX = Math.max(-1, Math.min(1, deltaGamma / tiltRange)) * CONFIG.gyroscope.sensitivity;
            targetY = Math.max(-1, Math.min(1, deltaBeta / tiltRange)) * CONFIG.gyroscope.sensitivity;
        }, { passive: true });
    }

    // =========================================================================
    // Mouse Tracking (Desktop)
    // =========================================================================

    function initMouseTracking() {
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

        activeInputMethod = 'mouse';
        console.log('Hero Depth: Mouse tracking enabled');
    }

    // =========================================================================
    // Touch Tracking (Mobile fallback)
    // =========================================================================

    function initTouchTracking() {
        const heroSection = document.querySelector('.hero');
        if (!heroSection) return;

        document.addEventListener('touchmove', (e) => {
            if (e.touches.length === 0) return;

            const touch = e.touches[0];
            const rect = heroSection.getBoundingClientRect();

            if (touch.clientY < rect.top || touch.clientY > rect.bottom) return;

            targetX = ((touch.clientX - rect.left) / rect.width - 0.5) * 2;
            targetY = ((touch.clientY - rect.top) / rect.height - 0.5) * 2;
        }, { passive: true });

        document.addEventListener('touchend', () => {
            targetX = 0;
            targetY = 0;
        });

        activeInputMethod = 'touch';
        console.log('Hero Depth: Touch tracking enabled');
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
