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
        particleCount: 300,
        // Particle size range (px)
        particleSizeMin: 3,
        particleSizeMax: 12,
        // How far particles scatter from the baseline (px)
        scatterWidth: 60,
        // Vertical clustering zones (creates organic distribution)
        clusterCount: 20
    };

    // Store viewport dimensions and particle data
    let viewportWidth = window.innerWidth;
    let viewportHeight = window.innerHeight;
    let particleData = [];

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
        const { svg, clipPath, maskRect, maskGroup } = createMaskSVG();
        document.body.appendChild(svg);

        // Initial particle positions
        updateParticlePositions(maskGroup, 0);

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
                updateMaskPosition(currentProgress, maskRect, maskGroup);
            }, 100);
        });

        // Create the transition zone
        const transitionTrigger = ScrollTrigger.create({
            trigger: coderSection,
            start: 'bottom 80%',
            end: () => `+=${window.innerHeight * 0.8}`,
            scrub: 1,
            onUpdate: (self) => {
                updateMaskPosition(self.progress, maskRect, maskGroup);
            },
            onEnter: () => {
                positionForTransition(heroCoderCanvas, claudeCodesCanvas, true);
            },
            onLeave: () => {
                // Hide hero canvas - claude stays visible behind
                heroCoderCanvas.style.opacity = '0';
                // Keep z-indices as-is (hero in front but hidden, claude behind visible)
            },
            onEnterBack: () => {
                positionForTransition(heroCoderCanvas, claudeCodesCanvas, true);
                heroCoderCanvas.style.opacity = '1';
                // Ensure claude codes canvas is visible during reverse transition
                claudeCodesCanvas.style.opacity = '1';
            },
            onLeaveBack: () => {
                // Hide claude canvas FIRST to prevent flash
                claudeCodesCanvas.style.opacity = '0';
                // Reset mask position (hero fully visible through mask)
                resetMask(maskRect, maskGroup);
                // Keep hero in front - no z-index change needed
            }
        });

        // Expose for debugging
        window.ChrisTheme.windsweptMask = {
            trigger: transitionTrigger,
            svg,
            maskRect,
            maskGroup,
            reset: () => resetMask(maskRect, maskGroup),
            setProgress: (p) => updateMaskPosition(p, maskRect, maskGroup)
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

        // Group for particles along the revealing edge
        const maskGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');

        // Create circle elements (positions set in updateParticlePositions)
        for (let i = 0; i < CONFIG.particleCount; i++) {
            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', '0');
            circle.setAttribute('cy', '0');
            circle.setAttribute('r', '0');
            maskGroup.appendChild(circle);
        }

        clipPath.appendChild(maskRect);
        clipPath.appendChild(maskGroup);
        defs.appendChild(clipPath);
        svg.appendChild(defs);

        return { svg, clipPath, maskRect, maskGroup };
    }

    /**
     * Generate particle data with organic clustering (relative positions 0-1)
     */
    function generateParticleData() {
        const particles = [];
        const { particleCount, particleSizeMin, particleSizeMax, clusterCount } = CONFIG;

        // Create cluster centers
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

            // X offset from edge (normalized, will be multiplied by scatterWidth)
            // Centered around 0, range roughly -1 to 1
            const offsetX = (Math.random() - 0.5) * 2;

            // Size
            const sizeRange = particleSizeMax - particleSizeMin;
            const r = particleSizeMin + Math.random() * sizeRange;

            particles.push({ y, offsetX, r });
        }

        return particles;
    }

    /**
     * Update particle positions based on progress
     */
    function updateParticlePositions(maskGroup, progress) {
        const circles = maskGroup.querySelectorAll('circle');
        const edgeX = progress * viewportWidth; // The revealing edge position

        circles.forEach((circle, i) => {
            const p = particleData[i];
            if (!p) return;

            // Position particles along the edge
            const cx = edgeX + (p.offsetX * CONFIG.scatterWidth);
            const cy = p.y * viewportHeight;

            circle.setAttribute('cx', String(cx));
            circle.setAttribute('cy', String(cy));
            circle.setAttribute('r', String(p.r));
        });
    }

    /**
     * Update mask position based on scroll progress
     * progress: 0 = Hero+Coder fully visible, 1 = fully hidden (Claude Codes visible)
     *
     * Wind blows right-to-left: mask rect moves to the right, revealing from left
     */
    function updateMaskPosition(progress, maskRect, maskGroup) {
        // Move rect to the right as progress increases
        // At progress 0: x=0 (covers full viewport)
        // At progress 1: x=viewportWidth (moved off right, nothing visible)
        const rectX = progress * viewportWidth;
        maskRect.setAttribute('x', String(rectX));

        // Update particle positions along the left edge of the rect
        updateParticlePositions(maskGroup, progress);
    }

    /**
     * Reset mask to initial state (fully visible)
     */
    function resetMask(maskRect, maskGroup) {
        maskRect.setAttribute('x', '0');
        updateParticlePositions(maskGroup, 0);
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
