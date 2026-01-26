/**
 * Windswept Wisp Mask Transition
 *
 * Creates an SVG mask with flowing bezier curve "wisps" that feel like
 * windblown smoke/sand. Uses variable-thickness paths rendered as filled
 * polygons for organic, flowing transitions.
 *
 * Uses:
 * - SVG clipPath with path elements (binary mask, works with canvas)
 * - Cubic bezier curves for smooth flowing shapes
 * - Variable thickness via filled polygons (tapered ends)
 * - Exit animation when scroll completes
 */
(function() {
    'use strict';

    // Prevent multiple initializations
    if (window.__windsweptMaskInitialized) {
        return;
    }
    window.__windsweptMaskInitialized = true;

    // Configuration
    const CONFIG = {
        // Wisp distribution - fewer but MUCH bigger wisps
        wisps: {
            // Big flowing fingers that extend far
            long: { count: 6, lengthMin: 350, lengthMax: 600, thicknessMin: 50, thicknessMax: 90 },
            // Medium wisps for variety
            medium: { count: 10, lengthMin: 180, lengthMax: 350, thicknessMin: 35, thicknessMax: 65 },
            // Edge coverage - MANY thick wisps overlapping to completely hide the line
            edge: { count: 50, lengthMin: 120, lengthMax: 250, thicknessMin: 60, thicknessMax: 100 }
        },

        // Scatter width from mask edge (px)
        scatterWidth: 400,

        // Animation parameters - slower for bigger wisps
        driftSpeed: { min: 15, max: 40 },      // px/s (slower)
        waveAmplitude: { min: 20, max: 50 },   // px
        waveFrequency: { min: 0.2, max: 0.5 }, // Hz (slower)

        // Bezier curve segments (polygon vertices)
        segmentCount: 12, // More segments for smoother curves

        // Exit animation
        exitAcceleration: 3.0,
        exitDuration: 1.5, // seconds

        // Noise field for organic movement
        noise: {
            scale: 0.002,
            speed: 0.3,
            strength: 30
        }
    };

    // State
    let viewportWidth = window.innerWidth;
    let viewportHeight = window.innerHeight;
    let wisps = [];
    let wispElements = [];
    let animationId = null;
    let isAnimating = false;
    let isExiting = false;
    let exitStartTime = 0;
    let animationStartTime = 0;
    let currentProgress = 0;
    let lastTime = 0;
    let maskInitialized = false;

    // Simple 2D noise implementation (value noise with smoothing)
    const NoiseGenerator = {
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
            ) * 0.5 + 0.5;
        },

        fbm(x, y, octaves = 3) {
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

    // Bezier math helpers
    function cubicBezierPoint(p0, p1, p2, p3, t) {
        const mt = 1 - t;
        const mt2 = mt * mt;
        const mt3 = mt2 * mt;
        const t2 = t * t;
        const t3 = t2 * t;

        return {
            x: mt3 * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t3 * p3.x,
            y: mt3 * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t3 * p3.y
        };
    }

    function cubicBezierTangent(p0, p1, p2, p3, t) {
        const mt = 1 - t;
        const mt2 = mt * mt;
        const t2 = t * t;

        // Derivative of cubic bezier
        const dx = 3 * mt2 * (p1.x - p0.x) + 6 * mt * t * (p2.x - p1.x) + 3 * t2 * (p3.x - p2.x);
        const dy = 3 * mt2 * (p1.y - p0.y) + 6 * mt * t * (p2.y - p1.y) + 3 * t2 * (p3.y - p2.y);

        // Normalize
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        return { x: dx / len, y: dy / len };
    }

    function randRange(range) {
        return range.min + Math.random() * (range.max - range.min);
    }

    /**
     * Create a wisp with bezier control points
     */
    function createWisp(type, config, index, total) {
        const length = config.lengthMin + Math.random() * (config.lengthMax - config.lengthMin);
        const thickness = config.thicknessMin + Math.random() * (config.thicknessMax - config.thicknessMin);

        // Starting position (y is 0-1 relative to viewport)
        let yPosition;
        if (type === 'edge') {
            // Edge wisps are evenly distributed vertically with heavy overlap for FULL coverage
            // Multiple passes ensure no gaps
            yPosition = (index / total) * 1.4 - 0.2; // Generous overflow top/bottom
        } else {
            yPosition = Math.random();
        }

        // X offset from mask edge
        let xOffset;
        if (type === 'edge') {
            // Edge wisps: heads positioned INTO the visible area (positive offset)
            // so their bodies extend back and COVER the edge line
            // Since wisps extend leftward, head at +0.15 to +0.4 means body covers edge
            xOffset = 0.1 + Math.random() * 0.35;
        } else if (type === 'medium') {
            xOffset = (Math.random() - 0.5) * 1.0;
        } else {
            // Long wisps extend further out
            xOffset = (Math.random() - 0.5) * 1.5;
        }

        return {
            type,
            baseLength: length,
            maxThickness: thickness,

            // Animation parameters - edge wisps move VERY slowly to maintain coverage
            driftSpeed: type === 'edge'
                ? randRange({ min: 3, max: 10 })
                : randRange(CONFIG.driftSpeed),
            waveAmplitude: type === 'edge'
                ? randRange({ min: 8, max: 15 })  // Less wave for edge
                : randRange(CONFIG.waveAmplitude),
            waveFrequency: randRange(CONFIG.waveFrequency),
            wavePhase: Math.random() * Math.PI * 2,
            noiseOffset: Math.random() * 1000,

            // Position
            yPosition,
            xOffset,

            // Bezier curve angle/curvature - edge wisps are flatter
            curvature: type === 'edge'
                ? (Math.random() - 0.5) * 0.3
                : (Math.random() - 0.5) * 0.6,
            angle: type === 'edge'
                ? (Math.random() - 0.5) * 0.15  // More horizontal
                : (Math.random() - 0.5) * 0.4,

            // Exit animation state
            isExiting: false,
            exitThicknessMultiplier: 1
        };
    }

    /**
     * Initialize all wisps
     */
    function initWisps() {
        wisps = [];

        // Create wisps of each type
        for (let i = 0; i < CONFIG.wisps.long.count; i++) {
            wisps.push(createWisp('long', CONFIG.wisps.long, i, CONFIG.wisps.long.count));
        }
        for (let i = 0; i < CONFIG.wisps.medium.count; i++) {
            wisps.push(createWisp('medium', CONFIG.wisps.medium, i, CONFIG.wisps.medium.count));
        }
        // Edge wisps - evenly distributed for full coverage
        for (let i = 0; i < CONFIG.wisps.edge.count; i++) {
            wisps.push(createWisp('edge', CONFIG.wisps.edge, i, CONFIG.wisps.edge.count));
        }
    }

    /**
     * Calculate wisp's 4 bezier control points at given time
     */
    function getWispControlPoints(wisp, time, edgeX) {
        // Calculate drift with wrapping (wisps cycle back when they drift too far)
        // Cycle period is based on scatter width - wisps wrap around every ~scatterWidth pixels
        const cycleWidth = CONFIG.scatterWidth * 2;
        let driftOffset = time * wisp.driftSpeed * (wisp.isExiting ? CONFIG.exitAcceleration : 1);

        // When not exiting, wrap the drift to keep wisps near the edge
        if (!wisp.isExiting) {
            driftOffset = driftOffset % cycleWidth;
        }

        // Base position with xOffset distributed across the scatter zone
        const baseX = edgeX + (wisp.xOffset * CONFIG.scatterWidth) - driftOffset;
        const baseY = wisp.yPosition * viewportHeight;

        // Wave motion
        const waveOffset = Math.sin(time * wisp.waveFrequency * Math.PI * 2 + wisp.wavePhase) * wisp.waveAmplitude;

        // Noise displacement for organic movement
        const noiseX = (NoiseGenerator.fbm(
            (baseX + wisp.noiseOffset) * CONFIG.noise.scale,
            baseY * CONFIG.noise.scale + time * CONFIG.noise.speed
        ) - 0.5) * CONFIG.noise.strength * 2;

        const noiseY = (NoiseGenerator.fbm(
            (baseX + wisp.noiseOffset + 100) * CONFIG.noise.scale,
            baseY * CONFIG.noise.scale + time * CONFIG.noise.speed
        ) - 0.5) * CONFIG.noise.strength * 2;

        // Head position (P0)
        const p0 = {
            x: baseX + noiseX,
            y: baseY + waveOffset + noiseY
        };

        // Calculate curve direction (angled, flowing left)
        const angle = wisp.angle + Math.sin(time * 0.3 + wisp.wavePhase) * 0.1;
        const dirX = -Math.cos(angle);
        const dirY = Math.sin(angle);

        // Control points along the curve
        const len = wisp.baseLength;
        const curve = wisp.curvature * len;

        // P1: First control point (influences head curvature)
        const p1 = {
            x: p0.x + dirX * len * 0.33 + curve * dirY * 0.5,
            y: p0.y + dirY * len * 0.33 - curve * dirX * 0.5
        };

        // P2: Second control point (influences tail curvature)
        const p2 = {
            x: p0.x + dirX * len * 0.66 - curve * dirY * 0.5,
            y: p0.y + dirY * len * 0.66 + curve * dirX * 0.5
        };

        // P3: Tail position
        const p3 = {
            x: p0.x + dirX * len,
            y: p0.y + dirY * len
        };

        return [p0, p1, p2, p3];
    }

    /**
     * Generate SVG path data for a wisp as a filled polygon
     * (Variable thickness by offsetting points along normals)
     */
    function wispToPolygonPath(wisp, time, edgeX) {
        const [p0, p1, p2, p3] = getWispControlPoints(wisp, time, edgeX);
        const segments = CONFIG.segmentCount;

        // Calculate thickness multiplier for exit animation
        const thicknessMult = wisp.isExiting ? wisp.exitThicknessMultiplier : 1;
        if (thicknessMult <= 0) return '';

        // Sample points along the curve
        const topPoints = [];
        const bottomPoints = [];

        for (let i = 0; i <= segments; i++) {
            const t = i / segments;

            // Point on curve
            const point = cubicBezierPoint(p0, p1, p2, p3, t);

            // Tangent at this point
            const tangent = cubicBezierTangent(p0, p1, p2, p3, t);

            // Normal (perpendicular to tangent)
            const normal = { x: -tangent.y, y: tangent.x };

            // Thickness at this point (tapers at ends)
            // sin(π * t) gives 0 at ends, 1 at middle
            const thickness = wisp.maxThickness * Math.sin(Math.PI * t) * thicknessMult;
            const halfThickness = thickness / 2;

            // Offset points
            topPoints.push({
                x: point.x + normal.x * halfThickness,
                y: point.y + normal.y * halfThickness
            });
            bottomPoints.push({
                x: point.x - normal.x * halfThickness,
                y: point.y - normal.y * halfThickness
            });
        }

        // Build path: top edge forward, bottom edge backward (closed polygon)
        let d = `M ${topPoints[0].x.toFixed(1)},${topPoints[0].y.toFixed(1)}`;

        // Top edge
        for (let i = 1; i < topPoints.length; i++) {
            d += ` L ${topPoints[i].x.toFixed(1)},${topPoints[i].y.toFixed(1)}`;
        }

        // Bottom edge (reversed)
        for (let i = bottomPoints.length - 1; i >= 0; i--) {
            d += ` L ${bottomPoints[i].x.toFixed(1)},${bottomPoints[i].y.toFixed(1)}`;
        }

        d += ' Z';
        return d;
    }

    /**
     * Create the SVG clipPath element
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

        // Main rect covering visible area
        const maskRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        maskRect.setAttribute('x', '0');
        maskRect.setAttribute('y', '0');
        maskRect.setAttribute('width', String(viewportWidth));
        maskRect.setAttribute('height', String(viewportHeight));
        clipPath.appendChild(maskRect);

        // Create path elements for wisps
        const paths = [];
        const totalWisps = CONFIG.wisps.long.count + CONFIG.wisps.medium.count + CONFIG.wisps.edge.count;

        for (let i = 0; i < totalWisps; i++) {
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', '');
            clipPath.appendChild(path);
            paths.push(path);
        }

        defs.appendChild(clipPath);
        svg.appendChild(defs);

        return { svg, clipPath, maskRect, paths };
    }

    /**
     * Update all wisp positions
     */
    function updateWispPositions(time) {
        const edgeX = currentProgress * viewportWidth;

        wisps.forEach((wisp, i) => {
            if (wispElements[i]) {
                const pathData = wispToPolygonPath(wisp, time, edgeX);
                wispElements[i].setAttribute('d', pathData);
            }
        });
    }

    /**
     * Check if all wisps have exited the viewport
     */
    function allWispsExited(time) {
        const edgeX = currentProgress * viewportWidth;

        return wisps.every(wisp => {
            const [p0] = getWispControlPoints(wisp, time, edgeX);
            // Wisp is exited if its head is off the left edge
            return p0.x < -wisp.baseLength - 100;
        });
    }

    /**
     * Start exit animation
     */
    function startExitAnimation() {
        if (isExiting) return;

        isExiting = true;
        // Use relative time from animation start
        exitStartTime = (performance.now() - animationStartTime) / 1000;

        // Mark all wisps as exiting
        wisps.forEach(wisp => {
            wisp.isExiting = true;
        });
    }

    /**
     * Update exit animation state
     */
    function updateExitAnimation(time) {
        if (!isExiting) return false;

        const elapsed = time - exitStartTime;
        const progress = Math.min(1, elapsed / CONFIG.exitDuration);

        // Fade thickness during exit
        wisps.forEach(wisp => {
            wisp.exitThicknessMultiplier = 1 - progress * 0.7; // Don't fully fade, just thin out
        });

        // Check if exit is complete
        if (allWispsExited(time)) {
            return true; // Exit complete
        }

        return false; // Still exiting
    }

    function animationLoop(timestamp) {
        if (!isAnimating) return;

        // Use relative time from animation start (not absolute page time)
        const time = (timestamp - animationStartTime) / 1000;
        lastTime = time;

        const maskRect = window.ChrisTheme?.windsweptMask?.maskRect;
        if (maskRect) {
            const rectX = currentProgress * viewportWidth;
            maskRect.setAttribute('x', String(rectX));
            updateWispPositions(time);

            // Handle exit animation
            if (isExiting) {
                const exitComplete = updateExitAnimation(time);
                if (exitComplete) {
                    // Exit animation done - hide canvas and stop
                    const heroCoderCanvas = document.getElementById('depth-canvas-hero-coder');
                    if (heroCoderCanvas) {
                        heroCoderCanvas.style.opacity = '0';
                    }
                    stopAnimation();
                    return;
                }
            }
        }

        animationId = requestAnimationFrame(animationLoop);
    }

    function startAnimation() {
        if (isAnimating) return;
        isAnimating = true;
        isExiting = false;
        lastTime = 0;
        animationStartTime = performance.now();

        // Reset exit state
        wisps.forEach(wisp => {
            wisp.isExiting = false;
            wisp.exitThicknessMultiplier = 1;
        });

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

    function updateMaskPosition(progress, maskRect) {
        currentProgress = progress;
        if (!isAnimating) {
            const rectX = progress * viewportWidth;
            maskRect.setAttribute('x', String(rectX));
            updateWispPositions(0);
        }
    }

    function resetMask(maskRect) {
        maskRect.setAttribute('x', '0');
        currentProgress = 0;
        isExiting = false;
        wisps.forEach(wisp => {
            wisp.isExiting = false;
            wisp.exitThicknessMultiplier = 1;
        });
        updateWispPositions(0);
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
        const claudeCodesSection = document.querySelector('.scene--claude-codes');

        if (!heroCoderCanvas || !claudeCodesCanvas || !coderSection || !claudeCodesSection) {
            console.warn('[windswept-mask] Missing required elements');
            return;
        }

        // Check for reduced motion preference
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
        NoiseGenerator.init();

        // Initialize wisps
        initWisps();

        // Create the SVG mask
        const { svg, maskRect, paths } = createMaskSVG();
        document.body.appendChild(svg);
        wispElements = paths;

        // Apply clipPath to the Hero+Coder canvas
        heroCoderCanvas.style.clipPath = 'url(#windswept-mask)';
        heroCoderCanvas.style.webkitClipPath = 'url(#windswept-mask)';

        // Handle window resize
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

        // Create the transition zone
        const transitionTrigger = ScrollTrigger.create({
            trigger: coderSection,
            start: 'bottom 80%',
            end: () => `+=${window.innerHeight * 0.8}`,
            scrub: 1,
            onUpdate: (self) => {
                updateMaskPosition(self.progress, maskRect);
            },
            onEnter: () => {
                positionForTransition(heroCoderCanvas, claudeCodesCanvas, true);
                startAnimation();
            },
            onLeave: () => {
                // Don't hide immediately - start exit animation
                startExitAnimation();
            },
            onEnterBack: () => {
                positionForTransition(heroCoderCanvas, claudeCodesCanvas, true);
                heroCoderCanvas.style.opacity = '1';
                claudeCodesCanvas.style.opacity = '1';
                startAnimation();
            },
            onLeaveBack: () => {
                claudeCodesCanvas.style.opacity = '0';
                resetMask(maskRect);
                stopAnimation();
            }
        });

        // Expose for debugging
        window.ChrisTheme.windsweptMask = {
            trigger: transitionTrigger,
            svg,
            maskRect,
            wisps,
            reset: () => resetMask(maskRect),
            setProgress: (p) => updateMaskPosition(p, maskRect),
            startAnimation,
            stopAnimation,
            startExitAnimation,
            isAnimating: () => isAnimating,
            isExiting: () => isExiting,
            noise: NoiseGenerator
        };

        const totalWisps = CONFIG.wisps.long.count + CONFIG.wisps.medium.count + CONFIG.wisps.edge.count;
        console.log('[windswept-mask] Initialized with', totalWisps, 'wisps (bezier curves)');
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
            } else {
                console.warn('[windswept-mask] Dependencies not available after', maxAttempts, 'attempts');
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
