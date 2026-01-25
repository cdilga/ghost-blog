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
    // Input Method Chain: Mouse/Touch first (instant), then upgrade to Face/Gyro
    // =========================================================================

    async function initInputMethods() {
        // INSTANT: Start with mouse/touch immediately (no loading delay)
        if (isMobile) {
            initTouchTracking();
            // Try gyroscope on iOS (will upgrade from touch if permission granted)
            if (CONFIG.gyroscope.enabled) {
                initGyroscope(); // Non-blocking, upgrades on success
            }
        } else {
            initMouseTracking();
        }

        // DEFERRED: Load face tracking in background (doesn't block first paint)
        if (CONFIG.faceTracking.enabled) {
            loadFaceTrackingAsync();
        }
    }

    // Dynamically load TensorFlow.js after initial render
    async function loadFaceTrackingAsync() {
        // Wait for idle time to avoid blocking main thread
        if ('requestIdleCallback' in window) {
            requestIdleCallback(() => doLoadFaceTracking(), { timeout: 5000 });
        } else {
            setTimeout(doLoadFaceTracking, 2000);
        }
    }

    async function doLoadFaceTracking() {
        try {
            console.log('Hero Depth: Loading face tracking libraries...');

            // Dynamically load TensorFlow.js
            await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.17.0/dist/tf.min.js');
            await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow-models/face-detection@1.0.2/dist/face-detection.min.js');

            console.log('Hero Depth: Face tracking libraries loaded');

            // Now try to initialize face tracking
            const success = await initFaceTracking();
            if (success) {
                console.log('Hero Depth: Upgraded to face tracking');
            }
        } catch (error) {
            console.log('Hero Depth: Face tracking load failed -', error.message);
        }
    }

    function loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
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

            // Create hidden video element (needs real dimensions for face detection)
            videoElement = document.createElement('video');
            videoElement.srcObject = stream;
            videoElement.autoplay = true;
            videoElement.playsInline = true;
            videoElement.muted = true;
            // Position off-screen but with real dimensions (some detectors need actual size)
            videoElement.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:320px;height:240px;';
            document.body.appendChild(videoElement);

            await videoElement.play();

            // Wait for video dimensions to be available
            await new Promise((resolve) => {
                if (videoElement.videoWidth > 0 && videoElement.videoHeight > 0) {
                    resolve();
                } else {
                    videoElement.addEventListener('loadedmetadata', resolve, { once: true });
                }
            });

            console.log('Hero Depth: Video ready, dimensions:', videoElement.videoWidth, 'x', videoElement.videoHeight);
            console.log('Hero Depth: Video readyState:', videoElement.readyState, '(4 = ready)');
            console.log('Hero Depth: TensorFlow.js backend:', tf.getBackend());

            // Initialize face detector
            const model = faceDetection.SupportedModels.MediaPipeFaceDetector;
            console.log('Hero Depth: Creating face detector (MediaPipeFaceDetector/tfjs)...');
            faceDetector = await faceDetection.createDetector(model, {
                runtime: 'tfjs',
                modelType: 'short', // 'short' for faces within 2m (selfie range)
                maxFaces: 1
            });
            console.log('Hero Depth: Face detector created successfully');

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

    let faceTrackingFrameCount = 0;
    let lastFaceLog = 0;
    let isDetecting = false; // Prevent overlapping detections

    async function trackFace() {
        if (!faceTrackingActive || !faceDetector || !videoElement) return;
        if (isDetecting) {
            requestAnimationFrame(trackFace);
            return;
        }

        faceTrackingFrameCount++;
        isDetecting = true;

        try {
            const faces = await faceDetector.estimateFaces(videoElement);

            // Log periodically for debugging
            const now = Date.now();
            if (now - lastFaceLog > 2000) {
                console.log('Hero Depth: Frame', faceTrackingFrameCount,
                    '- video.currentTime:', videoElement.currentTime.toFixed(2),
                    '- Faces:', faces.length,
                    faces.length > 0 ? JSON.stringify(faces[0].box) : '(none)');
                lastFaceLog = now;
            }

            if (faces.length > 0) {
                const face = faces[0];
                // TensorFlow.js face-detection returns boundingBox with xMin, yMin, width, height
                // or box depending on version - handle both
                const box = face.box || face.boundingBox;

                if (!box) {
                    console.log('Hero Depth: Face detected but no bounding box', JSON.stringify(face));
                    requestAnimationFrame(trackFace);
                    return;
                }

                // Handle both API formats (xMin/yMin vs x/y)
                const xMin = box.xMin !== undefined ? box.xMin : box.x;
                const yMin = box.yMin !== undefined ? box.yMin : box.y;
                const width = box.width;
                const height = box.height;

                // Calculate face center (normalized 0-1)
                const faceCenterX = (xMin + width / 2) / videoElement.videoWidth;
                const faceCenterY = (yMin + height / 2) / videoElement.videoHeight;

                // Set baseline on first detection
                if (!faceBaseline) {
                    faceBaseline = { x: faceCenterX, y: faceCenterY };
                    console.log('Hero Depth: Face baseline set at', faceCenterX.toFixed(2), faceCenterY.toFixed(2));
                    console.log('Hero Depth: Box raw values - xMin:', xMin, 'yMin:', yMin, 'width:', width, 'height:', height);
                }

                // Calculate delta (invert X because camera is mirrored)
                const deltaX = -(faceCenterX - faceBaseline.x);
                const deltaY = faceCenterY - faceBaseline.y;

                // Scale to -1 to 1 range
                const newTargetX = Math.max(-1, Math.min(1, deltaX * CONFIG.faceTracking.sensitivity * 4));
                const newTargetY = Math.max(-1, Math.min(1, deltaY * CONFIG.faceTracking.sensitivity * 4));

                // Log significant movements
                if (Math.abs(newTargetX - targetX) > 0.05 || Math.abs(newTargetY - targetY) > 0.05) {
                    console.log('Hero Depth: Target updated:', newTargetX.toFixed(2), newTargetY.toFixed(2));
                }

                targetX = newTargetX;
                targetY = newTargetY;
            }
        } catch (error) {
            console.log('Hero Depth: Face tracking error -', error.message);
        }

        isDetecting = false;

        // Continue tracking at ~30fps
        requestAnimationFrame(trackFace);
    }

    // =========================================================================
    // Gyroscope (iOS Safari only - Android browsers block this)
    // Non-blocking: upgrades from touch if available
    // =========================================================================

    let gyroBaseline = null;

    function initGyroscope() {
        if (!('DeviceOrientationEvent' in window)) {
            console.log('Hero Depth: DeviceOrientationEvent not supported');
            return;
        }

        // iOS 13+ requires permission via user gesture
        if (typeof DeviceOrientationEvent.requestPermission === 'function') {
            // Wait for first touch to request permission (non-blocking)
            const requestOnTouch = async () => {
                document.removeEventListener('touchstart', requestOnTouch);
                try {
                    const permission = await DeviceOrientationEvent.requestPermission();
                    if (permission === 'granted') {
                        attachGyroHandler();
                        activeInputMethod = 'gyroscope';
                        console.log('Hero Depth: Upgraded to gyroscope (iOS)');
                    } else {
                        console.log('Hero Depth: Gyroscope permission denied');
                    }
                } catch (err) {
                    console.log('Hero Depth: Gyroscope permission error');
                }
            };

            document.addEventListener('touchstart', requestOnTouch, { once: true });
            console.log('Hero Depth: Tap to enable gyroscope (iOS)');
            return;
        }

        // Android/other - try direct attach, but likely blocked by Brave etc.
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

        // Check if we get valid data - if so, upgrade from touch
        setTimeout(() => {
            if (validEvents > 0) {
                activeInputMethod = 'gyroscope';
                console.log('Hero Depth: Upgraded to gyroscope');
            } else {
                window.removeEventListener('deviceorientation', handler);
                console.log('Hero Depth: Gyroscope blocked (likely Brave/privacy browser)');
            }
        }, 1500);
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
