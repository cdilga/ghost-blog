/**
 * Windswept Mask Transition - Noise-Distorted Shapes
 *
 * Creates organic, irregular shapes using noise-displaced polygons.
 * Achieves the "hand-drawn/ink-splatter" look without SVG filters
 * (which don't work with clipPath on canvas elements).
 *
 * Key technique: Generate blob shapes by displacing polygon vertices
 * with multi-octave noise, creating organic, flame-like edges.
 */
(function() {
    'use strict';

    if (window.__windsweptMaskInitialized) {
        return;
    }
    window.__windsweptMaskInitialized = true;

    // Configuration
    const CONFIG = {
        // Transition zone: 20% of viewport width for seam coverage
        transitionWidth: 0.22,

        // Blob shape settings - all extend LEFT from edge to create unified front
        blobs: {
            // Large blobs - deep fingers extending left
            large: { count: 8, radiusMin: 0.12, radiusMax: 0.22, vertexCount: 20 },
            // Medium blobs - fill coverage
            medium: { count: 12, radiusMin: 0.08, radiusMax: 0.14, vertexCount: 16 },
            // Small accent blobs - edge detail
            small: { count: 16, radiusMin: 0.04, radiusMax: 0.08, vertexCount: 12 },
            // Edge blobs - ensure no gaps along the edge
            edge: { count: 24, radiusMin: 0.05, radiusMax: 0.10, vertexCount: 14 }
        },

        // Noise settings for shape distortion
        noise: {
            displacement: 0.4,
            frequency: 2.5,
            octaves: 3
        },

        // Animation - faster wave motion for wind feel
        waveAmplitude: 35,
        waveFrequency: 1.2,
        wobbleAmplitude: 25,
        wobbleFrequency: 0.8,
        // Velocity multiplier - animation speeds up with scroll speed
        velocityMultiplier: 3.0,

        // Exit animation
        exitDuration: 800,
        exitAcceleration: 5
    };

    // State
    let viewportWidth = window.innerWidth;
    let viewportHeight = window.innerHeight;
    let svgElement = null;
    let clipPathElement = null;
    let maskRect = null;
    let blobShapes = [];
    let animationId = null;
    let isAnimating = false;
    let isExiting = false;
    let exitStartTime = 0;
    let animationStartTime = 0;
    let currentProgress = 0;
    let lastProgress = 0;
    let scrollVelocity = 0;
    let maskInitialized = false;

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

        // Fractal brownian motion - layered noise
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
            return value / maxValue;
        }
    };

    /**
     * Generate a noise-distorted blob path
     * Uses fixed noise offset per blob - no time-based animation for stability
     */
    function generateBlobPath(cx, cy, baseRadius, vertexCount, noiseOffset) {
        const points = [];
        const { displacement, frequency, octaves } = CONFIG.noise;

        for (let i = 0; i < vertexCount; i++) {
            const angle = (i / vertexCount) * Math.PI * 2;

            // Sample noise at this angle - fixed per blob, no time animation
            const nx = Math.cos(angle) * frequency + noiseOffset;
            const ny = Math.sin(angle) * frequency + noiseOffset * 0.7;
            const noiseVal = Noise.fbm(nx, ny, octaves);

            // Displace radius by noise (-0.5 to 0.5 range, scaled by displacement)
            const radiusOffset = (noiseVal - 0.5) * displacement * baseRadius;
            const r = baseRadius + radiusOffset;

            points.push({
                x: cx + Math.cos(angle) * r,
                y: cy + Math.sin(angle) * r
            });
        }

        // Create smooth path using quadratic bezier curves
        let d = `M ${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`;

        for (let i = 0; i < points.length; i++) {
            const p0 = points[i];
            const p1 = points[(i + 1) % points.length];

            // Control point at midpoint
            const midX = (p0.x + p1.x) / 2;
            const midY = (p0.y + p1.y) / 2;

            d += ` Q ${p0.x.toFixed(1)},${p0.y.toFixed(1)} ${midX.toFixed(1)},${midY.toFixed(1)}`;
        }

        d += ' Z';
        return d;
    }

    /**
     * Create blob shape data
     * CRITICAL: All blobs extend LEFT from edge (negative xOffset) to ensure unified front
     */
    function createBlob(type, config, index, total) {
        const radius = (config.radiusMin + Math.random() * (config.radiusMax - config.radiusMin)) *
                      Math.min(viewportWidth, viewportHeight);

        // Position based on type - ALL xOffsets are NEGATIVE (extend left only)
        let xOffset, yPos;
        const transitionZone = viewportWidth * CONFIG.transitionWidth;

        if (type === 'edge') {
            // Edge blobs - evenly distributed vertically, hug the edge
            yPos = (index / total) * viewportHeight * 1.2 - viewportHeight * 0.1;
            // Small negative offset - these blobs overlap the edge
            xOffset = -Math.random() * transitionZone * 0.3;
        } else if (type === 'large') {
            // Large blobs - deep fingers extending left
            yPos = Math.random() * viewportHeight;
            xOffset = -Math.random() * transitionZone * 1.5 - radius * 0.3;
        } else if (type === 'medium') {
            // Medium blobs - fill the transition zone
            yPos = Math.random() * viewportHeight;
            xOffset = -Math.random() * transitionZone * 1.0 - radius * 0.2;
        } else {
            // Small blobs - scattered in transition zone
            yPos = Math.random() * viewportHeight;
            xOffset = -Math.random() * transitionZone * 0.8;
        }

        // Create SVG path element
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('fill', 'white'); // Not used in clipPath but good practice

        return {
            element: path,
            type,
            radius,
            vertexCount: config.vertexCount,
            baseXOffset: xOffset,
            baseY: yPos,
            noiseOffset: Math.random() * 100, // Unique noise sample per blob
            driftPhase: Math.random() * Math.PI * 2,
            waveAmp: CONFIG.waveAmplitude * (0.5 + Math.random()),
            waveFreq: CONFIG.waveFrequency * (0.8 + Math.random() * 0.4),
            wobbleAmp: CONFIG.wobbleAmplitude * (0.5 + Math.random()),
            wobbleFreq: CONFIG.wobbleFrequency * (0.8 + Math.random() * 0.4)
        };
    }

    /**
     * Create SVG with clipPath
     */
    function createMaskSVG() {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', '0');
        svg.setAttribute('height', '0');
        svg.style.cssText = 'position: absolute; pointer-events: none;';

        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');

        // Create clipPath
        const clipPath = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath');
        clipPath.setAttribute('id', 'windswept-mask');
        clipPath.setAttribute('clipPathUnits', 'userSpaceOnUse');

        // Main rect
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', '0');
        rect.setAttribute('y', '0');
        rect.setAttribute('width', String(viewportWidth));
        rect.setAttribute('height', String(viewportHeight));
        clipPath.appendChild(rect);
        maskRect = rect;

        // Create blobs
        const blobs = [];
        for (let i = 0; i < CONFIG.blobs.large.count; i++) {
            blobs.push(createBlob('large', CONFIG.blobs.large, i, CONFIG.blobs.large.count));
        }
        for (let i = 0; i < CONFIG.blobs.medium.count; i++) {
            blobs.push(createBlob('medium', CONFIG.blobs.medium, i, CONFIG.blobs.medium.count));
        }
        for (let i = 0; i < CONFIG.blobs.small.count; i++) {
            blobs.push(createBlob('small', CONFIG.blobs.small, i, CONFIG.blobs.small.count));
        }
        for (let i = 0; i < CONFIG.blobs.edge.count; i++) {
            blobs.push(createBlob('edge', CONFIG.blobs.edge, i, CONFIG.blobs.edge.count));
        }

        blobs.forEach(blob => {
            clipPath.appendChild(blob.element);
            blobShapes.push(blob);
        });

        defs.appendChild(clipPath);
        svg.appendChild(defs);
        clipPathElement = clipPath;

        return svg;
    }

    /**
     * Update all blob shapes
     * Blobs stay anchored to the transition edge with velocity-scaled wave + wobble
     */
    function updateBlobShapes(time, progress) {
        const edgeX = progress * viewportWidth;

        // Animation speed scales with scroll velocity for wind feel
        const velocityBoost = 1 + scrollVelocity * CONFIG.velocityMultiplier;

        // During exit: drift blobs off to the RIGHT (continuing transition direction)
        let exitDrift = 0;
        if (isExiting) {
            const exitTime = time - exitStartTime;
            exitDrift = exitTime * exitTime * viewportWidth * CONFIG.exitAcceleration;
        }

        blobShapes.forEach(blob => {
            // Velocity-scaled animation time for wind effect
            const animTime = time * velocityBoost;

            // Vertical wave motion - faster when scrolling
            const wave = Math.sin(animTime * blob.waveFreq + blob.driftPhase) * blob.waveAmp;
            // Horizontal wobble - faster when scrolling
            const wobble = Math.sin(animTime * blob.wobbleFreq + blob.driftPhase + Math.PI * 0.5) * blob.wobbleAmp;

            // Position anchored to transition edge with wobble, plus exit drift to move RIGHT
            const cx = edgeX + blob.baseXOffset + wobble + exitDrift;
            const cy = blob.baseY + wave;

            // Generate noise-distorted path (fixed shape per blob)
            const pathData = generateBlobPath(
                cx, cy,
                blob.radius,
                blob.vertexCount,
                blob.noiseOffset
            );

            blob.element.setAttribute('d', pathData);
        });
    }

    /**
     * Update mask rect position
     */
    function updateMaskRect(progress) {
        const rectX = progress * viewportWidth;
        maskRect.setAttribute('x', String(rectX));
    }

    function isExitComplete(time) {
        if (!isExiting) return false;
        return (time - exitStartTime) * 1000 > CONFIG.exitDuration;
    }

    function animationLoop(timestamp) {
        if (!isAnimating) return;

        const time = (timestamp - animationStartTime) / 1000;

        updateMaskRect(currentProgress);
        updateBlobShapes(time, currentProgress);

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
        // Immediately update positions to current progress before first frame
        // This prevents flash of wrong positions when scrolling back
        updateMaskRect(currentProgress);
        updateBlobShapes(0, currentProgress);
        animationId = requestAnimationFrame(animationLoop);
    }

    function stopAnimation() {
        isAnimating = false;
        isExiting = false;
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

    function updateMaskPosition(progress) {
        // Track scroll velocity for animation speed
        const deltaProgress = Math.abs(progress - lastProgress);
        scrollVelocity = Math.min(1, deltaProgress * 10); // Normalize to 0-1
        lastProgress = progress;

        currentProgress = progress;
        if (!isAnimating) {
            updateMaskRect(progress);
            updateBlobShapes(0, progress);
        }
    }

    function resetMask() {
        currentProgress = 0;
        isExiting = false;
        updateMaskRect(0);
        updateBlobShapes(0, 0);
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

        // Initialize noise
        Noise.init();

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
                maskRect.setAttribute('width', String(viewportWidth));
                maskRect.setAttribute('height', String(viewportHeight));
            }, 100);
        });

        // Scroll trigger
        const transitionTrigger = ScrollTrigger.create({
            trigger: coderSection,
            start: 'bottom 80%',
            end: () => `+=${window.innerHeight * 0.8}`,
            scrub: 1,
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
                // Reset exit state before showing canvas
                isExiting = false;
                // Set progress to current scroll position (should be ~1 when entering back)
                currentProgress = transitionTrigger.progress;
                // Update positions immediately before showing canvas
                updateMaskRect(currentProgress);
                updateBlobShapes(0, currentProgress);
                // Now show canvases
                positionForTransition(heroCoderCanvas, claudeCodesCanvas, true);
                heroCoderCanvas.style.opacity = '1';
                claudeCodesCanvas.style.opacity = '1';
                startAnimation();
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
            maskRect,
            blobs: blobShapes,
            reset: resetMask,
            setProgress: updateMaskPosition,
            startAnimation,
            stopAnimation,
            startExitAnimation,
            isAnimating: () => isAnimating,
            isExiting: () => isExiting,
            config: CONFIG,
            noise: Noise
        };

        const total = CONFIG.blobs.large.count + CONFIG.blobs.medium.count +
                     CONFIG.blobs.small.count + CONFIG.blobs.edge.count;
        console.log('[windswept-mask] Initialized with', total, 'noise-distorted blobs');
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
