/**
 * Windswept Mask Transition - Single Organic Edge Path
 *
 * Uses a SINGLE path with:
 * - Straight RIGHT edge (no gaps possible)
 * - Organic noise-distorted LEFT edge (bubble-like wisps)
 *
 * This guarantees no gaps since the mask is one continuous shape.
 */
(function() {
    'use strict';

    if (window.__windsweptMaskInitialized) {
        return;
    }
    window.__windsweptMaskInitialized = true;

    // Configuration
    const CONFIG = {
        // Number of points along the organic edge
        edgePoints: 40,

        // How far the organic edge extends left (as fraction of viewport)
        maxDisplacement: 0.18,

        // Noise settings for the organic edge
        noise: {
            frequency: 2.5,
            octaves: 4,
            // How "bubbly" the edge is (0-1)
            amplitude: 0.8
        },

        // Animation
        waveSpeed: 0.8,
        waveAmplitude: 0.03, // Subtle wave as fraction of viewport
        velocityMultiplier: 2.5,

        // Exit/enter animation
        exitDuration: 600,
        enterDuration: 400
    };

    // State
    let viewportWidth = window.innerWidth;
    let viewportHeight = window.innerHeight;
    let svgElement = null;
    let maskPath = null;
    let animationId = null;
    let isAnimating = false;
    let isExiting = false;
    let isEntering = false;
    let exitStartTime = 0;
    let enterStartTime = 0;
    let animationStartTime = 0;
    let currentProgress = 0;
    let lastProgress = 0;
    let scrollVelocity = 0;
    let maskInitialized = false;
    let noiseOffsets = []; // Pre-generated noise offsets for consistent shapes

    // Noise generator
    const Noise = {
        perm: null,

        init() {
            this.perm = new Uint8Array(512);
            for (let i = 0; i < 256; i++) {
                this.perm[i] = this.perm[i + 256] = Math.floor(Math.random() * 256);
            }
        },

        fade(t) {
            return t * t * t * (t * (t * 6 - 15) + 10);
        },

        lerp(a, b, t) {
            return a + t * (b - a);
        },

        grad(hash, x, y) {
            const h = hash & 7;
            const u = h < 4 ? x : y;
            const v = h < 4 ? y : x;
            return ((h & 1) ? -u : u) + ((h & 2) ? -2 * v : 2 * v);
        },

        noise2D(x, y) {
            if (!this.perm) this.init();
            const X = Math.floor(x) & 255;
            const Y = Math.floor(y) & 255;
            x -= Math.floor(x);
            y -= Math.floor(y);
            const u = this.fade(x);
            const v = this.fade(y);
            const A = this.perm[X] + Y;
            const B = this.perm[X + 1] + Y;
            return this.lerp(
                this.lerp(this.grad(this.perm[A], x, y), this.grad(this.perm[B], x - 1, y), u),
                this.lerp(this.grad(this.perm[A + 1], x, y - 1), this.grad(this.perm[B + 1], x - 1, y - 1), u),
                v
            );
        },

        fbm(x, y, octaves = 4) {
            let value = 0;
            let amplitude = 1;
            let frequency = 1;
            let maxValue = 0;
            for (let i = 0; i < octaves; i++) {
                value += amplitude * this.noise2D(x * frequency, y * frequency);
                maxValue += amplitude;
                amplitude *= 0.5;
                frequency *= 2;
            }
            return (value / maxValue + 1) / 2; // Normalize to 0-1
        }
    };

    /**
     * Generate pre-computed noise offsets for consistent edge shape
     */
    function generateNoiseOffsets() {
        noiseOffsets = [];
        for (let i = 0; i <= CONFIG.edgePoints; i++) {
            noiseOffsets.push(Math.random() * 100);
        }
    }

    /**
     * Generate the organic edge path
     * - RIGHT side is a straight vertical line
     * - LEFT side is noise-distorted with bubble-like shapes
     */
    function generateMaskPath(edgeX, time) {
        const { edgePoints, maxDisplacement, noise, waveSpeed, waveAmplitude, velocityMultiplier } = CONFIG;
        const maxDisp = maxDisplacement * viewportWidth;
        const waveAmp = waveAmplitude * viewportWidth;

        // Velocity-scaled time for wind effect
        const velocityBoost = 1 + scrollVelocity * velocityMultiplier;
        const animTime = time * velocityBoost;

        // Generate left edge points (organic, from top to bottom)
        const leftPoints = [];
        for (let i = 0; i <= edgePoints; i++) {
            const t = i / edgePoints;
            const y = t * viewportHeight;

            // Sample noise for this point
            const noiseX = t * noise.frequency + noiseOffsets[i] * 0.1;
            const noiseY = noiseOffsets[i] * 0.1;
            const noiseVal = Noise.fbm(noiseX, noiseY, noise.octaves);

            // Base displacement from noise (creates the bubble shapes)
            const baseDisp = noiseVal * noise.amplitude * maxDisp;

            // Add subtle wave motion
            const wave = Math.sin(animTime * waveSpeed + t * Math.PI * 4) * waveAmp;

            // Left edge X position (edgeX minus the organic displacement)
            const x = edgeX - baseDisp + wave;
            leftPoints.push({ x, y });
        }

        // Build the path:
        // Start at top-left of organic edge, go DOWN the organic edge,
        // then RIGHT along bottom, UP the right edge, LEFT along top, close

        // Start at top of organic edge
        let d = `M ${leftPoints[0].x.toFixed(1)},0`;

        // Go DOWN the organic left edge using quadratic bezier for smoothness
        for (let i = 0; i < leftPoints.length - 1; i++) {
            const p0 = leftPoints[i];
            const p1 = leftPoints[i + 1];
            const midX = (p0.x + p1.x) / 2;
            const midY = (p0.y + p1.y) / 2;
            d += ` Q ${p0.x.toFixed(1)},${p0.y.toFixed(1)} ${midX.toFixed(1)},${midY.toFixed(1)}`;
        }

        // Final point to bottom
        const lastLeft = leftPoints[leftPoints.length - 1];
        d += ` L ${lastLeft.x.toFixed(1)},${viewportHeight}`;

        // Go RIGHT along bottom edge (straight)
        d += ` L ${viewportWidth + 100},${viewportHeight}`;

        // Go UP the right edge (straight) - extend past viewport to ensure coverage
        d += ` L ${viewportWidth + 100},0`;

        // Go LEFT along top edge back to start (straight)
        d += ` L ${leftPoints[0].x.toFixed(1)},0`;

        d += ' Z';
        return d;
    }

    /**
     * Create SVG with clipPath containing single path
     */
    function createMaskSVG() {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', '0');
        svg.setAttribute('height', '0');
        svg.style.cssText = 'position: absolute; pointer-events: none;';

        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');

        const clipPath = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath');
        clipPath.setAttribute('id', 'windswept-mask');
        clipPath.setAttribute('clipPathUnits', 'userSpaceOnUse');

        // Single path element for the entire mask
        // Start with edgeX far enough left that noise/wave can't make it visible
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        const safeOffscreenX = -(CONFIG.maxDisplacement + CONFIG.waveAmplitude + 0.1) * viewportWidth;
        path.setAttribute('d', generateMaskPath(safeOffscreenX, 0));
        clipPath.appendChild(path);
        maskPath = path;

        defs.appendChild(clipPath);
        svg.appendChild(defs);

        return svg;
    }

    /**
     * Update the mask path position
     */
    function updateMask(time, progress) {
        // Calculate edge position based on progress
        // Ensure edge stays off-screen when progress is 0 by accounting for noise/wave displacement
        // At progress=0: edgeX = -safeOffset (off-screen)
        // At progress=1: edgeX = viewportWidth (fully revealed)
        const safeOffset = (CONFIG.maxDisplacement + CONFIG.waveAmplitude + 0.1) * viewportWidth;
        let edgeX = -safeOffset + progress * (viewportWidth + safeOffset);

        // During exit: continue moving right past the viewport
        if (isExiting) {
            const exitTime = time - exitStartTime;
            const exitProgress = Math.min(1, exitTime / (CONFIG.exitDuration / 1000));
            // Ease out
            const eased = 1 - Math.pow(1 - exitProgress, 2);
            edgeX = viewportWidth + eased * viewportWidth * 0.3;
        }

        // During enter (from right): animate in from right
        if (isEntering) {
            const enterTime = time - enterStartTime;
            const enterProgress = Math.min(1, enterTime / (CONFIG.enterDuration / 1000));
            // Ease out
            const eased = 1 - Math.pow(1 - enterProgress, 2);
            // Start from right edge, animate to current progress position
            const startX = viewportWidth * 1.2;
            const endX = progress * viewportWidth;
            edgeX = startX + (endX - startX) * eased;

            if (enterProgress >= 1) {
                isEntering = false;
            }
        }

        const pathData = generateMaskPath(edgeX, time);
        maskPath.setAttribute('d', pathData);
    }

    function isExitComplete(time) {
        if (!isExiting) return false;
        return (time - exitStartTime) * 1000 > CONFIG.exitDuration;
    }

    function animationLoop(timestamp) {
        if (!isAnimating) return;

        const time = (timestamp - animationStartTime) / 1000;

        updateMask(time, currentProgress);

        if (isExiting && isExitComplete(time)) {
            const heroCoderCanvas = document.getElementById('depth-canvas-hero-coder');
            if (heroCoderCanvas) {
                heroCoderCanvas.style.opacity = '0';
            }
            stopAnimation();
            return;
        }

        animationId = requestAnimationFrame(animationLoop);
    }

    function startAnimation() {
        if (isAnimating) return;
        isAnimating = true;
        isExiting = false;
        animationStartTime = performance.now();
        updateMask(0, currentProgress);
        animationId = requestAnimationFrame(animationLoop);
    }

    function stopAnimation() {
        isAnimating = false;
        isExiting = false;
        isEntering = false;
        if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }
    }

    function startExitAnimation() {
        if (isExiting) return;
        isExiting = true;
        exitStartTime = (performance.now() - animationStartTime) / 1000;
    }

    function startEnterAnimation() {
        isEntering = true;
        enterStartTime = (performance.now() - animationStartTime) / 1000;
    }

    function updateMaskPosition(progress) {
        // Track scroll velocity
        const deltaProgress = Math.abs(progress - lastProgress);
        scrollVelocity = Math.min(1, deltaProgress * 15);
        lastProgress = progress;

        currentProgress = progress;
        if (!isAnimating) {
            updateMask(0, progress);
        }
    }

    function resetMask() {
        currentProgress = 0;
        isExiting = false;
        isEntering = false;
        updateMask(0, 0);
    }

    function positionForTransition(heroCoderCanvas, claudeCodesCanvas, forTransition) {
        if (forTransition) {
            claudeCodesCanvas.style.zIndex = '-1';
            claudeCodesCanvas.style.opacity = '1';
            heroCoderCanvas.style.zIndex = '0';
        } else {
            heroCoderCanvas.style.zIndex = '-1';
            claudeCodesCanvas.style.zIndex = '-1';
        }
    }

    function initWindsweptMask() {
        if (maskInitialized) return;
        maskInitialized = true;

        const { gsap, ScrollTrigger } = window.ChrisTheme || {};
        if (!gsap || !ScrollTrigger) {
            console.warn('[windswept-mask] GSAP or ScrollTrigger not available');
            maskInitialized = false;
            return;
        }

        const heroCoderCanvas = document.getElementById('depth-canvas-hero-coder');
        const claudeCodesCanvas = document.getElementById('depth-canvas-claude-codes');
        const coderSection = document.querySelector('.scene--coder');

        if (!heroCoderCanvas || !claudeCodesCanvas || !coderSection) {
            console.warn('[windswept-mask] Missing required elements');
            return;
        }

        // Reduced motion
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            console.log('[windswept-mask] Reduced motion - using instant transition');
            ScrollTrigger.create({
                trigger: coderSection,
                start: 'bottom center',
                onEnter: () => {
                    heroCoderCanvas.style.opacity = '0';
                    claudeCodesCanvas.style.opacity = '1';
                },
                onLeaveBack: () => {
                    heroCoderCanvas.style.opacity = '1';
                    claudeCodesCanvas.style.opacity = '0';
                }
            });
            return;
        }

        // Initialize
        Noise.init();
        generateNoiseOffsets();

        // Create SVG
        svgElement = createMaskSVG();
        document.body.appendChild(svgElement);

        // Apply clipPath
        heroCoderCanvas.style.clipPath = 'url(#windswept-mask)';
        heroCoderCanvas.style.webkitClipPath = 'url(#windswept-mask)';

        // Resize handler
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                viewportWidth = window.innerWidth;
                viewportHeight = window.innerHeight;
                updateMask(0, currentProgress);
            }, 100);
        });

        // Scroll trigger
        // NOTE: Using scrub: true for immediate sync (no smoothing delay)
        // This ensures the mask position matches scroll position precisely
        const transitionTrigger = ScrollTrigger.create({
            trigger: coderSection,
            start: 'bottom 80%',
            end: () => `+=${window.innerHeight * 0.8}`,
            scrub: true,
            onUpdate: (self) => {
                updateMaskPosition(self.progress);
            },
            onEnter: () => {
                positionForTransition(heroCoderCanvas, claudeCodesCanvas, true);
                startAnimation();
            },
            onLeave: () => {
                startExitAnimation();
            },
            onEnterBack: () => {
                // Coming back from below - animate in from right
                isExiting = false;
                currentProgress = transitionTrigger.progress;
                positionForTransition(heroCoderCanvas, claudeCodesCanvas, true);
                heroCoderCanvas.style.opacity = '1';
                claudeCodesCanvas.style.opacity = '1';

                if (!isAnimating) {
                    startAnimation();
                }
                startEnterAnimation();
            },
            onLeaveBack: () => {
                claudeCodesCanvas.style.opacity = '0';
                resetMask();
                stopAnimation();
            }
        });

        // Debug API
        window.ChrisTheme.windsweptMask = {
            trigger: transitionTrigger,
            svg: svgElement,
            path: maskPath,
            reset: resetMask,
            setProgress: updateMaskPosition,
            startAnimation,
            stopAnimation,
            startExitAnimation,
            startEnterAnimation,
            isAnimating: () => isAnimating,
            isExiting: () => isExiting,
            isEntering: () => isEntering,
            config: CONFIG,
            noise: Noise
        };

        console.log('[windswept-mask] Initialized with single organic edge path');
    }

    function waitForChrisTheme(callback, maxAttempts = 30) {
        let attempts = 0;
        const check = () => {
            if (window.ChrisTheme?.gsap && window.ChrisTheme?.ScrollTrigger) {
                const heroCoderCanvas = document.getElementById('depth-canvas-hero-coder');
                const claudeCodesCanvas = document.getElementById('depth-canvas-claude-codes');
                if (heroCoderCanvas && claudeCodesCanvas) {
                    callback();
                    return;
                }
            }
            if (attempts++ < maxAttempts) {
                requestAnimationFrame(check);
            }
        };
        check();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => waitForChrisTheme(initWindsweptMask));
    } else {
        waitForChrisTheme(initWindsweptMask);
    }
})();
