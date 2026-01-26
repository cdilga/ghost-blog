/**
 * Windswept Dust Mask Transition
 *
 * Creates an SVG mask with animated dust/sand particles that form
 * organic "fingers" - elongated streaks that naturally spawn and migrate.
 *
 * Uses:
 * - SVG mask (not clipPath) for alpha/transparency support
 * - Gaussian blur filter for soft dust edges
 * - Simplex-like noise for organic flow field
 * - Finger system: particles cluster into migrating streams
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
        // Total particle count (fingers + loose + edge)
        // Will be calculated: fingers.count * fingers.particlesPerFinger + looseParticles.count + edgeParticles.count
        particleCount: 1025,  // 15*35 + 100 + 400 = 1025

        // Particle size range (px) - smaller for dust effect
        particleSizeMin: 1,
        particleSizeMax: 8,

        // Scatter width from mask edge (px)
        scatterWidth: 300,

        // Blur amount for soft edges (px)
        blurAmount: 3,

        // Finger system - elongated dust streams
        fingers: {
            count: 15,              // Number of active fingers
            lengthMin: 80,          // Min finger length (px)
            lengthMax: 250,         // Max finger length (px)
            widthMin: 20,           // Min finger width (px)
            widthMax: 60,           // Max finger width (px)
            particlesPerFinger: 35, // Particles in each finger
            spawnRate: 0.3,         // New fingers per second
            lifespan: { min: 4, max: 10 }, // Finger lifetime (seconds)
            driftSpeed: { min: 15, max: 40 }, // Horizontal drift (px/s)
            waveAmplitude: 30,      // Vertical wave amplitude
            waveFrequency: 0.5      // Wave cycles per second
        },

        // Loose particles (not in fingers)
        looseParticles: {
            count: 100,
            driftSpeed: { min: 5, max: 20 }
        },

        // Edge particles - dedicated to completely obscuring the hard rect edge
        edgeParticles: {
            count: 400,              // Very dense coverage along the edge
            sizeMin: 10,             // Large enough to overlap
            sizeMax: 30,
            scatterWidth: 25,        // Tight scatter right on the edge
            wobbleAmount: 8,         // Small wobble to stay on edge
            verticalOverlap: 2.0     // Double coverage to ensure no gaps
        },

        // Noise field for organic movement
        noise: {
            scale: 0.003,           // Spatial scale (smaller = larger features)
            speed: 0.5,             // Time evolution speed
            strength: 25            // Displacement strength (px)
        }
    };

    // State
    let viewportWidth = window.innerWidth;
    let viewportHeight = window.innerHeight;
    let fingers = [];
    let looseParticles = [];
    let edgeParticles = [];
    let particleElements = [];
    let animationId = null;
    let isAnimating = false;
    let currentProgress = 0;
    let lastTime = 0;
    let maskInitialized = false;

    // Simple 2D noise implementation (value noise with smoothing)
    const NoiseGenerator = {
        // Permutation table
        perm: null,

        init() {
            this.perm = new Uint8Array(512);
            for (let i = 0; i < 256; i++) {
                this.perm[i] = this.perm[i + 256] = Math.floor(Math.random() * 256);
            }
        },

        // Smoothstep interpolation
        fade(t) {
            return t * t * t * (t * (t * 6 - 15) + 10);
        },

        // Linear interpolation
        lerp(a, b, t) {
            return a + t * (b - a);
        },

        // 2D gradient
        grad(hash, x, y) {
            const h = hash & 7;
            const u = h < 4 ? x : y;
            const v = h < 4 ? y : x;
            return ((h & 1) ? -u : u) + ((h & 2) ? -2 * v : 2 * v);
        },

        // 2D noise function (returns -1 to 1)
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
            ) * 0.5 + 0.5; // Normalize to 0-1
        },

        // Fractal brownian motion for more organic noise
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

    /**
     * Create a new finger (elongated dust stream)
     */
    function createFinger(time) {
        const { fingers: cfg } = CONFIG;
        const randRange = (r) => r.min + Math.random() * (r.max - r.min);

        return {
            // Position (y is 0-1 relative to viewport)
            y: Math.random(),
            offsetX: -Math.random() * 0.8, // Start mostly on leading edge

            // Dimensions
            length: randRange({ min: cfg.lengthMin, max: cfg.lengthMax }),
            width: randRange({ min: cfg.widthMin, max: cfg.widthMax }),

            // Movement
            driftSpeed: randRange(cfg.driftSpeed),
            wavePhase: Math.random() * Math.PI * 2,

            // Lifetime
            birthTime: time,
            lifespan: randRange(cfg.lifespan),

            // Particles in this finger (indices into particleElements)
            particleIndices: [],

            // Visual properties
            baseAlpha: 0.6 + Math.random() * 0.4
        };
    }

    /**
     * Create a loose particle (not in a finger)
     */
    function createLooseParticle() {
        const { looseParticles: cfg, particleSizeMin, particleSizeMax } = CONFIG;
        const randRange = (r) => r.min + Math.random() * (r.max - r.min);

        return {
            y: Math.random(),
            offsetX: (Math.random() - 0.5) * 2, // Full scatter range
            size: particleSizeMin + Math.random() * (particleSizeMax - particleSizeMin),
            driftSpeed: randRange(cfg.driftSpeed),
            phase: Math.random() * Math.PI * 2,
            alpha: 0.3 + Math.random() * 0.5
        };
    }

    /**
     * Create an edge particle - these hug the rect edge to completely obscure it
     * Distributed with heavy overlap along the full height to guarantee no gaps
     */
    function createEdgeParticle(index, total) {
        const { edgeParticles: cfg } = CONFIG;

        // Distribute with overlap - more particles than strictly needed
        // This ensures complete coverage even with movement
        const baseY = (index / total) * cfg.verticalOverlap;
        const yJitter = (Math.random() - 0.5) * (4 / total);

        return {
            y: Math.max(-0.1, Math.min(1.1, baseY + yJitter)), // Allow overflow top/bottom
            // Center on edge with small scatter - MUST cover the line
            offsetX: (Math.random() - 0.5), // -0.5 to 0.5, centered on edge
            size: cfg.sizeMin + Math.random() * (cfg.sizeMax - cfg.sizeMin),
            phase: Math.random() * Math.PI * 2,
            wobblePhase: Math.random() * Math.PI * 2,
            // Vary wobble frequency per particle
            wobbleFreq: 0.5 + Math.random() * 1.5
        };
    }

    /**
     * Initialize the finger system
     */
    function initFingerSystem(time) {
        fingers = [];
        looseParticles = [];
        edgeParticles = [];

        // Create initial fingers
        for (let i = 0; i < CONFIG.fingers.count; i++) {
            const finger = createFinger(time - Math.random() * CONFIG.fingers.lifespan.max);
            fingers.push(finger);
        }

        // Create loose particles
        for (let i = 0; i < CONFIG.looseParticles.count; i++) {
            looseParticles.push(createLooseParticle());
        }

        // Create edge particles - evenly distributed to guarantee full coverage
        for (let i = 0; i < CONFIG.edgeParticles.count; i++) {
            edgeParticles.push(createEdgeParticle(i, CONFIG.edgeParticles.count));
        }

        // Assign particles to fingers
        assignParticlesToFingers();
    }

    /**
     * Assign particle elements to fingers
     */
    function assignParticlesToFingers() {
        let particleIndex = 0;

        // Assign particles to fingers
        fingers.forEach(finger => {
            finger.particleIndices = [];
            for (let i = 0; i < CONFIG.fingers.particlesPerFinger && particleIndex < particleElements.length; i++) {
                finger.particleIndices.push(particleIndex++);
            }
        });

        // Remaining particles are loose
        // (loose particles use their own indices, starting after finger particles)
    }

    /**
     * Update finger system (spawn/despawn fingers)
     */
    function updateFingerSystem(time, dt) {
        const { fingers: cfg } = CONFIG;

        // Check for dead fingers and respawn
        fingers.forEach((finger, i) => {
            const age = time - finger.birthTime;
            if (age > finger.lifespan) {
                // Respawn finger
                fingers[i] = createFinger(time);
                fingers[i].particleIndices = finger.particleIndices; // Reuse particle slots
            }
        });
    }

    /**
     * Get finger particle positions at given time
     */
    function getFingerParticlePositions(finger, time, edgeX) {
        const age = time - finger.birthTime;
        const lifeProgress = age / finger.lifespan;

        // Fade in/out
        const fadeIn = Math.min(1, age * 2);
        const fadeOut = Math.max(0, 1 - (lifeProgress - 0.7) / 0.3);
        const alpha = finger.baseAlpha * fadeIn * fadeOut;

        // Finger base position with drift
        const driftOffset = age * finger.driftSpeed;
        const baseX = edgeX + (finger.offsetX * CONFIG.scatterWidth) - driftOffset;

        // Wave motion
        const waveY = Math.sin(time * CONFIG.fingers.waveFrequency * Math.PI * 2 + finger.wavePhase)
                     * CONFIG.fingers.waveAmplitude;
        const baseY = finger.y * viewportHeight + waveY;

        // Generate particles along the finger
        const positions = [];
        const count = finger.particleIndices.length;

        for (let i = 0; i < count; i++) {
            const t = i / (count - 1); // 0 to 1 along finger

            // Position along finger axis (angled slightly)
            const angle = -0.2 + NoiseGenerator.fbm(finger.y * 10, time * 0.5) * 0.4;
            const alongX = t * finger.length;
            const alongY = t * finger.length * Math.tan(angle);

            // Scatter within finger width
            const scatter = (NoiseGenerator.noise2D(i * 0.5, time + finger.wavePhase) - 0.5) * finger.width;

            // Noise displacement
            const noiseX = (NoiseGenerator.fbm(baseX * CONFIG.noise.scale, baseY * CONFIG.noise.scale + time * CONFIG.noise.speed) - 0.5)
                          * CONFIG.noise.strength * 2;
            const noiseY = (NoiseGenerator.fbm(baseX * CONFIG.noise.scale + 100, baseY * CONFIG.noise.scale + time * CONFIG.noise.speed) - 0.5)
                          * CONFIG.noise.strength * 2;

            // Size varies along finger (larger at head)
            const sizeFactor = 0.5 + (1 - t) * 0.5;
            const size = (CONFIG.particleSizeMin + Math.random() * (CONFIG.particleSizeMax - CONFIG.particleSizeMin)) * sizeFactor;

            // Alpha varies (denser at center of finger)
            const centerDist = Math.abs(scatter) / (finger.width * 0.5);
            const particleAlpha = alpha * (1 - centerDist * 0.5);

            positions.push({
                x: baseX - alongX + noiseX,
                y: baseY + alongY + scatter + noiseY,
                size: size,
                alpha: Math.max(0, Math.min(1, particleAlpha))
            });
        }

        return positions;
    }

    /**
     * Get loose particle position
     */
    function getLooseParticlePosition(particle, time, edgeX) {
        const driftOffset = time * particle.driftSpeed;

        // Base position
        let x = edgeX + (particle.offsetX * CONFIG.scatterWidth) - driftOffset;
        let y = particle.y * viewportHeight;

        // Noise displacement
        const noiseX = (NoiseGenerator.fbm(x * CONFIG.noise.scale, y * CONFIG.noise.scale + time * CONFIG.noise.speed) - 0.5)
                      * CONFIG.noise.strength;
        const noiseY = (NoiseGenerator.fbm(x * CONFIG.noise.scale + 50, y * CONFIG.noise.scale + time * CONFIG.noise.speed) - 0.5)
                      * CONFIG.noise.strength;

        // Gentle wobble
        const wobbleX = Math.sin(time * 1.5 + particle.phase) * 5;
        const wobbleY = Math.sin(time * 2 + particle.phase + 1) * 3;

        return {
            x: x + noiseX + wobbleX,
            y: y + noiseY + wobbleY,
            size: particle.size,
            alpha: particle.alpha
        };
    }

    /**
     * Get edge particle position - these always hug the rect edge
     * to completely obscure the hard line with organic movement
     */
    function getEdgeParticlePosition(particle, time, edgeX) {
        const { edgeParticles: cfg } = CONFIG;

        // Base position - distributed along the edge
        const baseY = particle.y * viewportHeight;

        // Wobble to add organic feel while maintaining coverage
        const wobbleX = Math.sin(time * particle.wobbleFreq + particle.wobblePhase) * cfg.wobbleAmount;
        const wobbleY = Math.sin(time * (particle.wobbleFreq * 0.7) + particle.phase) * (cfg.wobbleAmount * 0.6);

        // Scatter around edge
        const scatterX = particle.offsetX * cfg.scatterWidth;

        // Noise for organic movement
        const noiseOffset = (NoiseGenerator.noise2D(particle.y * 5, time * 0.5) - 0.5) * 15;

        return {
            x: edgeX + scatterX + wobbleX + noiseOffset,
            y: baseY + wobbleY,
            size: particle.size
        };
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

        // Create the SVG mask
        const { svg, mask, maskRect, particles } = createMaskSVG();
        document.body.appendChild(svg);
        particleElements = particles;

        // Initialize finger system
        initFingerSystem(0);

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
                heroCoderCanvas.style.opacity = '0';
                stopAnimation();
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
            particles: particleElements,
            fingers,
            reset: () => resetMask(maskRect),
            setProgress: (p) => updateMaskPosition(p, maskRect),
            startAnimation,
            stopAnimation,
            isAnimating: () => isAnimating,
            noise: NoiseGenerator
        };

        console.log('[windswept-mask] Initialized with', CONFIG.particleCount, 'particles,', CONFIG.fingers.count, 'fingers');
    }

    /**
     * Create the SVG clipPath element
     * Note: clipPath is binary (visible/hidden) - no alpha support
     * but works reliably with canvas elements
     */
    function createMaskSVG() {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', '0');
        svg.setAttribute('height', '0');
        svg.style.cssText = 'position: absolute; pointer-events: none;';

        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');

        // Create clipPath (binary mask - works reliably with canvas)
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

        // Create particle circles directly in clipPath
        // (groups don't work in clipPath - must add circles directly)
        const particles = [];
        for (let i = 0; i < CONFIG.particleCount; i++) {
            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', '0');
            circle.setAttribute('cy', '0');
            circle.setAttribute('r', '0');
            clipPath.appendChild(circle);
            particles.push(circle);
        }

        defs.appendChild(clipPath);
        svg.appendChild(defs);

        return { svg, clipPath, maskRect, particles };
    }

    /**
     * Update all particle positions
     * Note: Using clipPath (binary) - no alpha support, particles are fully visible or not
     */
    function updateParticlePositions(time) {
        const edgeX = currentProgress * viewportWidth;

        // Update finger system
        updateFingerSystem(time, 1/60);

        // Update finger particles
        fingers.forEach(finger => {
            const positions = getFingerParticlePositions(finger, time, edgeX);

            positions.forEach((pos, i) => {
                const idx = finger.particleIndices[i];
                if (idx !== undefined && particleElements[idx]) {
                    const circle = particleElements[idx];
                    circle.setAttribute('cx', String(pos.x));
                    circle.setAttribute('cy', String(pos.y));
                    circle.setAttribute('r', String(Math.max(0.5, pos.size)));
                }
            });
        });

        // Update loose particles
        const looseStartIdx = CONFIG.fingers.count * CONFIG.fingers.particlesPerFinger;
        looseParticles.forEach((particle, i) => {
            const idx = looseStartIdx + i;
            if (particleElements[idx]) {
                const pos = getLooseParticlePosition(particle, time, edgeX);
                const circle = particleElements[idx];
                circle.setAttribute('cx', String(pos.x));
                circle.setAttribute('cy', String(pos.y));
                circle.setAttribute('r', String(Math.max(0.5, pos.size)));
            }
        });

        // Update edge particles - these must always completely cover the rect edge
        const edgeStartIdx = looseStartIdx + CONFIG.looseParticles.count;
        edgeParticles.forEach((particle, i) => {
            const idx = edgeStartIdx + i;
            if (particleElements[idx]) {
                const pos = getEdgeParticlePosition(particle, time, edgeX);
                const circle = particleElements[idx];
                circle.setAttribute('cx', String(pos.x));
                circle.setAttribute('cy', String(pos.y));
                circle.setAttribute('r', String(Math.max(0.5, pos.size)));
            }
        });
    }

    function animationLoop(timestamp) {
        if (!isAnimating) return;

        const time = timestamp / 1000;
        const dt = lastTime ? time - lastTime : 1/60;
        lastTime = time;

        const maskRect = window.ChrisTheme?.windsweptMask?.maskRect;
        if (maskRect) {
            const rectX = currentProgress * viewportWidth;
            maskRect.setAttribute('x', String(rectX));
            updateParticlePositions(time);
        }

        animationId = requestAnimationFrame(animationLoop);
    }

    function startAnimation() {
        if (isAnimating) return;
        isAnimating = true;
        lastTime = 0;
        animationId = requestAnimationFrame(animationLoop);
    }

    function stopAnimation() {
        isAnimating = false;
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
            updateParticlePositions(0);
        }
    }

    function resetMask(maskRect) {
        maskRect.setAttribute('x', '0');
        currentProgress = 0;
        updateParticlePositions(0);
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
