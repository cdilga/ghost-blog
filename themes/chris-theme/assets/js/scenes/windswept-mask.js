/**
 * Windswept Particle Mask Transition
 *
 * Creates an SVG-based mask with organic particle/sand-grain edge that
 * transitions between two depth-map backgrounds.
 *
 * - Mask moves right-to-left (wind direction)
 * - Edge is made of many small circles (sand grains)
 * - Scroll-captured: user can pause at any progress point
 * - Both backgrounds respond to MotionInput during transition
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
        // Number of particles along the mask edge
        particleCount: 400,
        // Particle size range (px)
        particleSizeMin: 2,
        particleSizeMax: 25,
        // How far particles scatter from the baseline (px)
        // Needs to be wide enough to be visually obvious
        scatterWidth: 250,
        // Bias toward leading edge (0.5 = symmetric, 0.8 = 80% on leading side)
        leadingBias: 0.75,
        // Vertical clustering zones (creates organic distribution)
        clusterCount: 25,

        // Animation parameters
        animation: {
            // Wobble amplitude range (px) - how far particles drift from base position
            wobbleAmplitudeX: { min: 5, max: 25 },
            wobbleAmplitudeY: { min: 3, max: 15 },
            // Wobble frequency range (cycles per second)
            wobbleFrequencyX: { min: 0.2, max: 0.8 },
            wobbleFrequencyY: { min: 0.3, max: 1.0 },
            // Size pulsing (multiplier range around base size)
            sizePulseAmount: 0.15, // ±15% size variation
            sizePulseFrequency: { min: 0.5, max: 1.5 },
            // Wind drift - constant slow movement in wind direction
            windDriftSpeed: 8, // px per second
            windDriftVariation: 0.4, // ±40% variation per particle
            // Gust effect - occasional stronger bursts
            gustFrequency: 0.1, // cycles per second
            gustStrength: 20 // additional px displacement during gusts
        }
    };

    // Store viewport dimensions and particle data
    let viewportWidth = window.innerWidth;
    let viewportHeight = window.innerHeight;
    let particleData = [];

    // Animation state
    let animationId = null;
    let isAnimating = false;
    let currentProgress = 0;
    let animationStartTime = 0;

    let maskInitialized = false;

    function initWindsweptMask() {
        // Prevent multiple initializations (inner guard)
        if (maskInitialized) {
            return;
        }
        maskInitialized = true;

        const { gsap, ScrollTrigger } = window.ChrisTheme || {};
        if (!gsap || !ScrollTrigger) {
            console.warn('[windswept-mask] GSAP or ScrollTrigger not available');
            maskInitialized = false;
            return;
        }

        // Get required elements
        const heroCoderCanvas = document.getElementById('depth-canvas-hero-coder');
        const claudeCodesCanvas = document.getElementById('depth-canvas-claude-codes');
        const coderSection = document.querySelector('.scene--coder');
        const claudeCodesSection = document.querySelector('.scene--claude-codes');

        if (!heroCoderCanvas || !claudeCodesCanvas || !coderSection || !claudeCodesSection) {
            console.warn('[windswept-mask] Missing required elements');
            return;
        }

        // Check for reduced motion preference
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        if (prefersReducedMotion) {
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

        // Generate particle data (relative positions 0-1)
        particleData = generateParticleData();

        // Create the SVG mask with pixel coordinates
        const { svg, clipPath, maskRect, circles } = createMaskSVG();
        document.body.appendChild(svg);

        // Initial particle positions
        updateParticlePositions(circles, 0);

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
                // Update mask dimensions
                maskRect.setAttribute('width', String(viewportWidth));
                maskRect.setAttribute('height', String(viewportHeight));
                // Update current state
                const currentProgress = window.ChrisTheme?.windsweptMask?.trigger?.progress || 0;
                updateMaskPosition(currentProgress, maskRect, circles);
            }, 100);
        });

        // Create the transition zone
        const transitionTrigger = ScrollTrigger.create({
            trigger: coderSection,
            start: 'bottom 80%',
            end: () => `+=${window.innerHeight * 0.8}`,
            scrub: 1,
            onUpdate: (self) => {
                updateMaskPosition(self.progress, maskRect, circles);
            },
            onEnter: () => {
                positionForTransition(heroCoderCanvas, claudeCodesCanvas, true);
                startAnimation();
            },
            onLeave: () => {
                // Hide hero canvas - claude stays visible behind
                heroCoderCanvas.style.opacity = '0';
                stopAnimation();
            },
            onEnterBack: () => {
                positionForTransition(heroCoderCanvas, claudeCodesCanvas, true);
                heroCoderCanvas.style.opacity = '1';
                // Ensure claude codes canvas is visible during reverse transition
                claudeCodesCanvas.style.opacity = '1';
                startAnimation();
            },
            onLeaveBack: () => {
                // Hide claude canvas FIRST to prevent flash
                claudeCodesCanvas.style.opacity = '0';
                // Reset mask position (hero fully visible through mask)
                resetMask(maskRect, circles);
                stopAnimation();
            }
        });

        // Expose for debugging
        window.ChrisTheme.windsweptMask = {
            trigger: transitionTrigger,
            svg,
            maskRect,
            circles,
            reset: () => resetMask(maskRect, circles),
            setProgress: (p) => updateMaskPosition(p, maskRect, circles),
            startAnimation,
            stopAnimation,
            isAnimating: () => isAnimating
        };

        console.log('[windswept-mask] Initialized with', CONFIG.particleCount, 'particles');
    }

    /**
     * Create the SVG mask element using userSpaceOnUse (pixel coordinates)
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

        // Main rect covering full viewport
        const maskRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        maskRect.setAttribute('x', '0');
        maskRect.setAttribute('y', '0');
        maskRect.setAttribute('width', String(viewportWidth));
        maskRect.setAttribute('height', String(viewportHeight));

        clipPath.appendChild(maskRect);

        // Create circle elements DIRECTLY in clipPath (not in a <g> - groups don't work in clipPath)
        // Store references for later updates
        const circles = [];
        for (let i = 0; i < CONFIG.particleCount; i++) {
            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', '0');
            circle.setAttribute('cy', '0');
            circle.setAttribute('r', '0');
            clipPath.appendChild(circle);
            circles.push(circle);
        }
        defs.appendChild(clipPath);
        svg.appendChild(defs);

        return { svg, clipPath, maskRect, circles };
    }

    /**
     * Generate particle data with organic clustering (relative positions 0-1)
     * Particles are biased toward the "leading" edge (left side, into hidden area)
     * to create visible organic scatter as the mask reveals
     * Each particle also gets unique animation parameters for organic movement
     */
    function generateParticleData() {
        const particles = [];
        const { particleCount, particleSizeMin, particleSizeMax, clusterCount, leadingBias, animation } = CONFIG;

        // Helper to get random value in range
        const randRange = (range) => range.min + Math.random() * (range.max - range.min);

        // Create cluster centers spread across viewport height
        const clusters = [];
        for (let i = 0; i < clusterCount; i++) {
            clusters.push({
                y: Math.random(),
                density: 0.5 + Math.random() * 0.5
            });
        }

        for (let i = 0; i < particleCount; i++) {
            const clusterIndex = Math.floor(Math.random() * clusterCount);
            const cluster = clusters[clusterIndex];

            // Y position relative (0-1)
            const yScatter = (Math.random() - 0.5) * (2 / clusterCount);
            let y = cluster.y + yScatter;
            y = Math.max(0, Math.min(1, y));

            // X offset from edge - BIASED toward leading edge (negative = left of rect edge)
            // Leading particles extend the visible area into the "hidden" zone
            // This creates the organic sand-grain effect
            let offsetX;
            if (Math.random() < leadingBias) {
                // Leading particle: extends LEFT of the edge (negative offset)
                // Use exponential distribution for natural falloff
                offsetX = -Math.random() * Math.random(); // Range: -1 to 0, clustered near 0
            } else {
                // Trailing particle: RIGHT of the edge (inside visible area)
                offsetX = Math.random() * 0.3; // Range: 0 to 0.3, shallow trailing
            }

            // Size - larger particles further from edge for depth
            const sizeRange = particleSizeMax - particleSizeMin;
            const distanceFactor = Math.abs(offsetX);
            const r = particleSizeMin + (sizeRange * (0.3 + 0.7 * distanceFactor * Math.random()));

            // Animation parameters - unique per particle for organic feel
            const anim = {
                // Random phase offsets (0 to 2π) so particles don't move in sync
                phaseX: Math.random() * Math.PI * 2,
                phaseY: Math.random() * Math.PI * 2,
                phaseSize: Math.random() * Math.PI * 2,
                // Wobble parameters
                wobbleAmpX: randRange(animation.wobbleAmplitudeX),
                wobbleAmpY: randRange(animation.wobbleAmplitudeY),
                wobbleFreqX: randRange(animation.wobbleFrequencyX),
                wobbleFreqY: randRange(animation.wobbleFrequencyY),
                // Size pulse
                sizeFreq: randRange(animation.sizePulseFrequency),
                // Wind drift multiplier (some particles drift faster/slower)
                driftMultiplier: 1 + (Math.random() - 0.5) * 2 * animation.windDriftVariation
            };

            particles.push({ y, offsetX, r, anim });
        }

        return particles;
    }

    /**
     * Update particle positions based on progress and time (for animation)
     * @param {Array} circles - SVG circle elements
     * @param {number} progress - Scroll progress 0-1
     * @param {number} time - Current time in seconds (for animation)
     */
    function updateParticlePositions(circles, progress, time = 0) {
        const edgeX = progress * viewportWidth; // The revealing edge position
        const { animation } = CONFIG;

        // Global gust effect - affects all particles
        const gustPhase = time * animation.gustFrequency * Math.PI * 2;
        const gustOffset = Math.sin(gustPhase) * Math.max(0, Math.sin(gustPhase)) * animation.gustStrength;

        circles.forEach((circle, i) => {
            const p = particleData[i];
            if (!p) return;

            const { anim } = p;

            // Base position
            let cx = edgeX + (p.offsetX * CONFIG.scatterWidth);
            let cy = p.y * viewportHeight;

            // Animated wobble offsets (sine waves with unique phase/frequency)
            const wobbleX = Math.sin(time * anim.wobbleFreqX * Math.PI * 2 + anim.phaseX) * anim.wobbleAmpX;
            const wobbleY = Math.sin(time * anim.wobbleFreqY * Math.PI * 2 + anim.phaseY) * anim.wobbleAmpY;

            // Wind drift - constant movement in wind direction (leftward, negative X)
            // Wraps around based on scatter width to create continuous flow
            const driftOffset = (time * animation.windDriftSpeed * anim.driftMultiplier) % (CONFIG.scatterWidth * 0.5);

            // Apply animated offsets
            cx += wobbleX - driftOffset + gustOffset * anim.driftMultiplier;
            cy += wobbleY;

            // Animated size pulsing
            const sizePulse = 1 + Math.sin(time * anim.sizeFreq * Math.PI * 2 + anim.phaseSize) * animation.sizePulseAmount;
            const r = p.r * sizePulse;

            circle.setAttribute('cx', String(cx));
            circle.setAttribute('cy', String(cy));
            circle.setAttribute('r', String(Math.max(1, r)));
        });
    }

    /**
     * Animation loop - runs continuously when in transition zone
     */
    function animationLoop(timestamp) {
        if (!isAnimating) return;

        // Convert to seconds since animation start
        const time = (timestamp - animationStartTime) / 1000;

        // Get current circles reference
        const circles = window.ChrisTheme?.windsweptMask?.circles;
        const maskRect = window.ChrisTheme?.windsweptMask?.maskRect;

        if (circles && maskRect) {
            // Update rect position based on progress
            const rectX = currentProgress * viewportWidth;
            maskRect.setAttribute('x', String(rectX));

            // Update particles with animation
            updateParticlePositions(circles, currentProgress, time);
        }

        animationId = requestAnimationFrame(animationLoop);
    }

    /**
     * Start the animation loop
     */
    function startAnimation() {
        if (isAnimating) return;
        isAnimating = true;
        animationStartTime = performance.now();
        animationId = requestAnimationFrame(animationLoop);
    }

    /**
     * Stop the animation loop
     */
    function stopAnimation() {
        isAnimating = false;
        if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }
    }

    /**
     * Update mask position based on scroll progress
     * progress: 0 = Hero+Coder fully visible, 1 = fully hidden (Claude Codes visible)
     *
     * Wind blows right-to-left: mask rect moves to the right, revealing from left
     * Note: When animation is running, this just updates currentProgress
     * and the animation loop handles the actual updates
     */
    function updateMaskPosition(progress, maskRect, circles) {
        currentProgress = progress;

        // If animation is running, it will handle updates
        // Otherwise, update immediately (for non-animated states)
        if (!isAnimating) {
            const rectX = progress * viewportWidth;
            maskRect.setAttribute('x', String(rectX));
            updateParticlePositions(circles, progress, 0);
        }
    }

    /**
     * Reset mask to initial state (fully visible)
     */
    function resetMask(maskRect, circles) {
        maskRect.setAttribute('x', '0');
        updateParticlePositions(circles, 0);
    }

    /**
     * Position both canvases for transition
     * Both canvases are now fixed-positioned full viewport backgrounds.
     * During transition:
     * - Claude Codes canvas at z-index -1 (revealed as background)
     * - Hero+Coder canvas at z-index 0 (foreground with clip-path mask)
     * After transition:
     * - Hero+Coder canvas hidden (opacity 0)
     * - Claude Codes canvas becomes the visible background
     */
    function positionForTransition(heroCoderCanvas, claudeCodesCanvas, forTransition) {
        if (forTransition) {
            // Both canvases are already fixed-positioned at z-index: -1
            // During transition, show Claude Codes behind, Hero+Coder in front with mask
            claudeCodesCanvas.style.zIndex = '-1';
            claudeCodesCanvas.style.opacity = '1';

            // Hero+Coder in front with clip-path mask applied
            heroCoderCanvas.style.zIndex = '0';
        } else {
            // Reset z-indices to default
            heroCoderCanvas.style.zIndex = '-1';
            claudeCodesCanvas.style.zIndex = '-1';
        }
    }

    // Wait for dependencies
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
            if (attempts < maxAttempts) {
                attempts++;
                requestAnimationFrame(check);
            } else {
                console.warn('[windswept-mask] Dependencies not available after', maxAttempts, 'attempts');
            }
        };
        check();
    }

    // Initialize
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => waitForChrisTheme(initWindsweptMask));
    } else {
        waitForChrisTheme(initWindsweptMask);
    }
})();
