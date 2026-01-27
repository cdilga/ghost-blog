/**
 * Projection Carousel - Simple 2D Cog Wheel
 *
 * A simple rotating wheel where cards are fixed at positions around the edge.
 * The wheel center is below the visible area, so we see cards arranged in a
 * semicircular arc at the top.
 *
 * Think of it like a Ferris wheel or Kodak carousel viewed from the side.
 * Cards are bolted to the wheel and rotate with it.
 *
 * NO 3D - just 2D rotation, position, scale, and opacity.
 */
(function() {
    'use strict';

    if (window.__projectionCarouselInitialized) return;
    window.__projectionCarouselInitialized = true;

    // =========================================================================
    // CONFIG
    // =========================================================================
    const CONFIG = {
        radius: 450,                    // Distance from center to cards
        radiusMobile: 280,              // Mobile radius
        numVisibleCards: 7,             // How many cards to show in the arc
        scrollPerCard: 200,             // Scroll pixels per card

        // Detent (snap) settings
        // detentStrength: how hard it snaps (0 = no snap, 1 = instant snap)
        // smoothness: how smooth the movement (0.9 = quick stop, 0.99 = glide)
        detentStrength: 0.05,
        smoothness: 0.96,               // Higher = smoother/longer glide

        // Visual - all cards same scale/opacity for uniform look
        activeScale: 0.65,
        inactiveScale: 0.65,
        activeOpacity: 1.0,
        inactiveOpacity: 1.0,

        // Drag
        dragSensitivity: 0.3,
        maxVelocity: 15,
    };

    // =========================================================================
    // STATE
    // =========================================================================
    let section, wheel, cards, video;
    let gsap, ScrollTrigger, scrollTriggerInstance;

    let wheelAngle = 0;             // Current wheel rotation in degrees
    let velocity = 0;
    let activeIndex = 0;
    let isPinned = false;
    let isAnimating = false;
    let animationId = null;

    let isDragging = false;
    let lastDragX = 0;
    let dragVelocity = 0;

    // Loading
    let isLoading = false;
    let hasMorePosts = true;
    let currentPage = 1;

    // Computed geometry
    let radius;
    let anglePerCard;
    let centerX, centerY;

    // =========================================================================
    // GEOMETRY
    // =========================================================================

    /**
     * Calculate where the wheel center should be.
     * We want the center BELOW the container so we see the top arc.
     */
    function updateGeometry() {
        if (!wheel) return;

        const rect = wheel.getBoundingClientRect();

        // Center horizontally
        centerX = rect.width / 2;

        // Center below the visible area - positioned so the arc of cards
        // appears in the upper portion of the wheel container
        centerY = rect.height + 80;

        // Responsive radius
        radius = window.innerWidth <= 768 ? CONFIG.radiusMobile : CONFIG.radius;

        // Angle between cards - spread them across a 120° arc (not full 180°)
        // This keeps edge cards at max ~60° tilt instead of 90° (horizontal)
        const arcSpan = 120; // degrees
        const numCards = Math.max(cards.length, CONFIG.numVisibleCards);
        anglePerCard = arcSpan / Math.max(1, numCards - 1);
    }

    // =========================================================================
    // CARD POSITIONING
    // =========================================================================

    /**
     * Position all cards based on current wheel angle.
     *
     * Each card has a "slot" on the wheel (its index determines its slot).
     * When the wheel rotates, all cards rotate with it.
     *
     * Slot 0 is at the TOP (12 o'clock, 90°) when wheelAngle = 0.
     * Higher slots are clockwise (toward 3 o'clock).
     *
     * Standard math angles:
     * - 0° = right (3 o'clock)
     * - 90° = top (12 o'clock)
     * - 180° = left (9 o'clock)
     */
    function positionCards() {
        if (!cards.length) return;

        cards.forEach((card, index) => {
            // Card's slot angle (before wheel rotation)
            // Index 0 = 90° (top), index 1 = 90 - anglePerCard, etc.
            const slotAngle = 90 - (index * anglePerCard);

            // Apply wheel rotation (positive = counter-clockwise)
            const angle = slotAngle + wheelAngle;

            // Convert to radians
            const rad = (angle * Math.PI) / 180;

            // Position on the circle
            // x = centerX + radius * cos(angle)
            // y = centerY - radius * sin(angle)  (negative because CSS y is inverted)
            const x = centerX + radius * Math.cos(rad);
            const y = centerY - radius * Math.sin(rad);

            // Card rotation - cards tilt outward from center (like cog teeth)
            // At 90° (top), card should be upright (rotation = 0)
            // At 30° (lower right), card should tilt right (rotation = +60)
            // At 150° (lower left), card should tilt left (rotation = -60)
            const cardRotation = 90 - angle;

            // Normalize angle to figure out visibility and styling
            let normAngle = ((angle % 360) + 360) % 360;
            if (normAngle > 270) normAngle -= 360;

            // Distance from the active position (90°)
            // 0 = at active, 1 = at the edges
            // Use arcSpan/2 for proper scaling with any arc size
            const halfArc = arcSpan / 2;
            const distFromActive = Math.min(1, Math.abs(normAngle - 90) / halfArc);

            // Scale and opacity based on distance from active
            const scale = CONFIG.activeScale - distFromActive * (CONFIG.activeScale - CONFIG.inactiveScale);
            const opacity = CONFIG.activeOpacity - distFromActive * (CONFIG.activeOpacity - CONFIG.inactiveOpacity);

            // Z-index: cards closer to active are on top, but capped low so footer stays above
            const zIndex = Math.round((1 - distFromActive) * 10);

            // Always show cards - they slide under the footer instead of disappearing
            // Only hide if completely behind (angle < -20° or > 200°)
            const isVisible = normAngle >= -20 && normAngle <= 200;

            // Apply the transform - cards are always positioned, visibility controlled by CSS
            card.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) rotate(${cardRotation}deg) scale(${scale})`;
            card.style.opacity = isVisible ? opacity : 0;
            card.style.zIndex = zIndex;
            card.style.visibility = isVisible ? 'visible' : 'hidden';

            // Mark active card
            if (distFromActive < 0.15) {
                card.classList.add('reel-card--active');
                activeIndex = index;
            } else {
                card.classList.remove('reel-card--active');
            }
        });
    }

    // =========================================================================
    // ANIMATION
    // =========================================================================

    function animate() {
        if (!isAnimating) return;

        // Apply detent snapping when not dragging and moving slowly
        if (!isDragging) {
            const nearestDetent = Math.round(wheelAngle / anglePerCard) * anglePerCard;
            const distToDetent = nearestDetent - wheelAngle;

            // Only snap when velocity is low and we're close to a detent
            if (Math.abs(velocity) < 3 && Math.abs(distToDetent) < anglePerCard * 0.5) {
                // Gentle pull toward nearest card position
                velocity += distToDetent * CONFIG.detentStrength;
            }
        }

        // Apply smoothness (higher = smoother/longer glide)
        velocity *= CONFIG.smoothness;

        // Clamp velocity
        velocity = Math.max(-CONFIG.maxVelocity, Math.min(CONFIG.maxVelocity, velocity));

        // Update wheel angle
        wheelAngle += velocity;

        // Clamp wheel angle (0 = newest visible, max = oldest visible)
        const maxAngle = anglePerCard * Math.max(0, cards.length - 1);
        wheelAngle = Math.max(0, Math.min(maxAngle, wheelAngle));

        // Position cards
        positionCards();

        // Check infinite load
        checkInfiniteLoad();

        // Continue animation
        animationId = requestAnimationFrame(animate);
    }

    function startAnimation() {
        if (animationId) return;
        isAnimating = true;
        animate();
    }

    function stopAnimation() {
        isAnimating = false;
        if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }
    }

    // =========================================================================
    // SCROLL CONTROL
    // =========================================================================

    function handleScroll(progress) {
        if (isDragging) return;

        const maxAngle = anglePerCard * Math.max(0, cards.length - 1);
        const targetAngle = progress * maxAngle;
        const diff = targetAngle - wheelAngle;

        if (Math.abs(diff) > 0.5) {
            velocity = diff * 0.1;
        }
    }

    // =========================================================================
    // DRAG
    // =========================================================================

    function startDrag(x) {
        isDragging = true;
        lastDragX = x;
        dragVelocity = 0;
        velocity = 0;
    }

    function moveDrag(x) {
        if (!isDragging) return;

        const dx = x - lastDragX;
        // Drag left = wheel rotates counter-clockwise = positive angle
        dragVelocity = -dx * CONFIG.dragSensitivity;
        wheelAngle += dragVelocity;

        // Clamp
        const maxAngle = anglePerCard * Math.max(0, cards.length - 1);
        wheelAngle = Math.max(0, Math.min(maxAngle, wheelAngle));

        lastDragX = x;
        positionCards();
    }

    function endDrag() {
        if (!isDragging) return;
        isDragging = false;
        velocity = dragVelocity;
    }

    // =========================================================================
    // KEYBOARD
    // =========================================================================

    function handleKey(e) {
        if (!isPinned) return;

        if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
            velocity = -anglePerCard * 0.25;
            e.preventDefault();
        } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
            velocity = anglePerCard * 0.25;
            e.preventDefault();
        }
    }

    // =========================================================================
    // INFINITE LOADING
    // =========================================================================

    function checkInfiniteLoad() {
        if (isLoading || !hasMorePosts) return;

        const currentIndex = Math.round(wheelAngle / anglePerCard);
        if (cards.length - currentIndex < 4) {
            loadMorePosts();
        }
    }

    async function loadMorePosts() {
        if (isLoading || !hasMorePosts) return;
        isLoading = true;

        try {
            const apiKey = document.querySelector('meta[name="ghost-api-key"]')?.content ||
                           window.ghostContentApiKey;

            if (!apiKey) {
                hasMorePosts = false;
                return;
            }

            const nextPage = currentPage + 1;
            const res = await fetch(
                `${location.origin}/ghost/api/content/posts/?key=${apiKey}&limit=10&page=${nextPage}&fields=id,title,slug,feature_image,published_at,url`
            );

            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            const data = await res.json();

            if (data.posts?.length) {
                appendPosts(data.posts);
                currentPage = nextPage;
                updateGeometry();
                updateScrollTrigger();
            }

            hasMorePosts = data.meta?.pagination
                ? data.meta.pagination.page < data.meta.pagination.pages
                : data.posts?.length === 10;

        } catch (e) {
            console.error('[carousel] Load error:', e);
            hasMorePosts = false;
        } finally {
            isLoading = false;
        }
    }

    function appendPosts(posts) {
        posts.forEach((post, i) => {
            const article = document.createElement('article');
            article.className = 'reel-card';
            article.setAttribute('data-index', cards.length + i);

            const date = new Date(post.published_at);
            article.innerHTML = `
                <a href="${post.url}" class="reel-card__link">
                    ${post.feature_image
                        ? `<div class="reel-card__image" style="background-image:url(${post.feature_image})"></div>`
                        : `<div class="reel-card__image reel-card__image--placeholder"></div>`}
                    <div class="reel-card__content">
                        <time class="reel-card__date" datetime="${date.toISOString().split('T')[0]}">${date.toLocaleDateString('en-US', {day:'numeric',month:'short',year:'numeric'})}</time>
                        <h3 class="reel-card__title">${post.title}</h3>
                    </div>
                </a>
            `;

            wheel.appendChild(article);
        });

        cards = Array.from(wheel.querySelectorAll('.reel-card'));
    }

    function updateScrollTrigger() {
        if (!scrollTriggerInstance) return;
        scrollTriggerInstance.vars.end = `+=${CONFIG.scrollPerCard * cards.length}`;
        scrollTriggerInstance.refresh();
    }

    // =========================================================================
    // SETUP
    // =========================================================================

    function setupEvents() {
        // Mouse
        wheel.addEventListener('mousedown', (e) => {
            if (!isPinned) return;
            e.preventDefault();
            startDrag(e.clientX);
        });
        window.addEventListener('mousemove', (e) => moveDrag(e.clientX));
        window.addEventListener('mouseup', endDrag);

        // Touch
        wheel.addEventListener('touchstart', (e) => {
            if (!isPinned) return;
            startDrag(e.touches[0].clientX);
        }, { passive: true });
        wheel.addEventListener('touchmove', (e) => moveDrag(e.touches[0].clientX), { passive: true });
        wheel.addEventListener('touchend', endDrag, { passive: true });

        // Keyboard
        document.addEventListener('keydown', handleKey);

        // Resize
        window.addEventListener('resize', () => {
            updateGeometry();
            positionCards();
        });
    }

    function setupScrollTrigger() {
        scrollTriggerInstance = ScrollTrigger.create({
            trigger: section,
            start: 'top top',
            end: `+=${CONFIG.scrollPerCard * cards.length}`,
            pin: true,
            scrub: 1,
            anticipatePin: 1,
            onUpdate: (self) => handleScroll(self.progress),
            onEnter: () => {
                isPinned = true;
                startAnimation();
                video?.play().catch(() => {});
            },
            onLeave: () => {
                isPinned = false;
                stopAnimation();
            },
            onEnterBack: () => {
                isPinned = true;
                startAnimation();
                video?.play().catch(() => {});
            },
            onLeaveBack: () => {
                isPinned = false;
                stopAnimation();
                video?.pause();
            }
        });
    }

    // =========================================================================
    // INIT
    // =========================================================================

    function init() {
        section = document.querySelector('.reel-navigator');
        wheel = document.querySelector('.reel-navigator__wheel');
        cards = Array.from(document.querySelectorAll('.reel-card'));
        video = document.querySelector('.reel-navigator__video');

        if (!section || !wheel || !cards.length) {
            console.warn('[carousel] Missing elements');
            return;
        }

        const theme = window.ChrisTheme || {};
        gsap = theme.gsap;
        ScrollTrigger = theme.ScrollTrigger;

        if (theme.prefersReducedMotion) {
            console.log('[carousel] Reduced motion - using grid fallback');
            return;
        }

        if (!gsap || !ScrollTrigger) {
            console.warn('[carousel] GSAP not available');
            return;
        }

        // Slow video
        if (video) video.playbackRate = 0.5;

        // Calculate geometry
        updateGeometry();

        // Initial position
        positionCards();

        // Events
        setupEvents();

        // ScrollTrigger
        setupScrollTrigger();

        // Debug API
        window.ChrisTheme.projectionCarousel = {
            getState: () => ({
                wheelAngle, velocity, activeIndex,
                totalPosts: cards.length,
                isPinned, isAnimating, isDragging,
                anglePerCard, centerX, centerY, radius
            }),
            setRotation: (a) => { wheelAngle = a; positionCards(); },
            snap: () => {
                wheelAngle = Math.round(wheelAngle / anglePerCard) * anglePerCard;
                positionCards();
            },
            config: CONFIG,
            updateConfig: (key, value) => {
                if (key in CONFIG) {
                    CONFIG[key] = value;
                    updateGeometry();
                    positionCards();
                }
            },
            showDebugPanel: createDebugPanel
        };

        // Show debug panel if URL has ?debug
        if (window.location.search.includes('debug')) {
            createDebugPanel();
        }

        console.log('[carousel] Ready with', cards.length, 'cards');
    }

    // =========================================================================
    // DEBUG PANEL
    // =========================================================================
    let arcSpan = 200; // Track arc span separately - >180 allows edges to peek under footer

    function createDebugPanel() {
        // Remove existing panel if any
        document.querySelector('.carousel-debug-panel')?.remove();

        const panel = document.createElement('div');
        panel.className = 'carousel-debug-panel';
        panel.innerHTML = `
            <style>
                .carousel-debug-panel {
                    position: fixed;
                    top: 10px;
                    right: 10px;
                    background: rgba(0, 0, 0, 0.9);
                    color: #fff;
                    padding: 15px;
                    border-radius: 8px;
                    font-family: monospace;
                    font-size: 12px;
                    z-index: 99999;
                    min-width: 280px;
                    max-height: 90vh;
                    overflow-y: auto;
                }
                .carousel-debug-panel h4 {
                    margin: 0 0 10px;
                    color: #ff9500;
                    font-size: 14px;
                }
                .carousel-debug-panel .control {
                    margin: 8px 0;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .carousel-debug-panel label {
                    flex: 0 0 100px;
                    color: #aaa;
                }
                .carousel-debug-panel input[type="range"] {
                    flex: 1;
                    accent-color: #ff9500;
                }
                .carousel-debug-panel .value {
                    flex: 0 0 50px;
                    text-align: right;
                    color: #ff9500;
                }
                .carousel-debug-panel hr {
                    border: none;
                    border-top: 1px solid #333;
                    margin: 12px 0;
                }
                .carousel-debug-panel button {
                    background: #ff9500;
                    color: #000;
                    border: none;
                    padding: 6px 12px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-family: inherit;
                    margin-right: 8px;
                }
                .carousel-debug-panel button:hover {
                    background: #ffaa33;
                }
                .carousel-debug-panel .close-btn {
                    position: absolute;
                    top: 8px;
                    right: 8px;
                    background: none;
                    color: #666;
                    font-size: 18px;
                    padding: 0;
                    width: 24px;
                    height: 24px;
                }
            </style>
            <button class="close-btn" onclick="this.parentElement.remove()">×</button>
            <h4>🎡 Carousel Debug</h4>

            <div class="control">
                <label>Arc Span</label>
                <input type="range" id="dbg-arcSpan" min="60" max="240" value="${arcSpan}">
                <span class="value" id="dbg-arcSpan-val">${arcSpan}°</span>
            </div>

            <div class="control">
                <label>Radius</label>
                <input type="range" id="dbg-radius" min="200" max="600" value="${CONFIG.radius}">
                <span class="value" id="dbg-radius-val">${CONFIG.radius}</span>
            </div>

            <div class="control">
                <label>Scroll/Card</label>
                <input type="range" id="dbg-scrollPerCard" min="50" max="300" value="${CONFIG.scrollPerCard}">
                <span class="value" id="dbg-scrollPerCard-val">${CONFIG.scrollPerCard}</span>
            </div>

            <hr>
            <h4>Detent/Snap</h4>

            <div class="control">
                <label>Snap Strength</label>
                <input type="range" id="dbg-detentStrength" min="0" max="50" value="${CONFIG.detentStrength * 100}">
                <span class="value" id="dbg-detentStrength-val">${CONFIG.detentStrength.toFixed(2)}</span>
            </div>

            <div class="control">
                <label>Smoothness</label>
                <input type="range" id="dbg-smoothness" min="90" max="99" value="${CONFIG.smoothness * 100}">
                <span class="value" id="dbg-smoothness-val">${CONFIG.smoothness.toFixed(2)}</span>
            </div>

            <hr>
            <h4>Scale & Opacity</h4>

            <div class="control">
                <label>Active Scale</label>
                <input type="range" id="dbg-activeScale" min="50" max="150" value="${CONFIG.activeScale * 100}">
                <span class="value" id="dbg-activeScale-val">${CONFIG.activeScale.toFixed(2)}</span>
            </div>

            <div class="control">
                <label>Inactive Scale</label>
                <input type="range" id="dbg-inactiveScale" min="20" max="100" value="${CONFIG.inactiveScale * 100}">
                <span class="value" id="dbg-inactiveScale-val">${CONFIG.inactiveScale.toFixed(2)}</span>
            </div>

            <div class="control">
                <label>Active Opacity</label>
                <input type="range" id="dbg-activeOpacity" min="50" max="100" value="${CONFIG.activeOpacity * 100}">
                <span class="value" id="dbg-activeOpacity-val">${CONFIG.activeOpacity.toFixed(2)}</span>
            </div>

            <div class="control">
                <label>Inactive Opacity</label>
                <input type="range" id="dbg-inactiveOpacity" min="5" max="100" value="${CONFIG.inactiveOpacity * 100}">
                <span class="value" id="dbg-inactiveOpacity-val">${CONFIG.inactiveOpacity.toFixed(2)}</span>
            </div>

            <hr>
            <button id="dbg-copy">Copy Config</button>
            <button id="dbg-reset">Reset</button>
        `;

        document.body.appendChild(panel);

        // Wire up controls
        const setupSlider = (id, configKey, transform = v => v, display = v => v) => {
            const input = document.getElementById(id);
            const valSpan = document.getElementById(id + '-val');
            input.addEventListener('input', () => {
                const rawVal = parseFloat(input.value);
                const val = transform(rawVal);
                if (configKey === 'arcSpan') {
                    arcSpan = val;
                    updateGeometry();
                } else {
                    CONFIG[configKey] = val;
                }
                valSpan.textContent = display(val);
                positionCards();
            });
        };

        setupSlider('dbg-arcSpan', 'arcSpan', v => v, v => v + '°');
        setupSlider('dbg-radius', 'radius', v => v, v => v);
        setupSlider('dbg-scrollPerCard', 'scrollPerCard', v => v, v => v);
        setupSlider('dbg-detentStrength', 'detentStrength', v => v / 100, v => v.toFixed(2));
        setupSlider('dbg-smoothness', 'smoothness', v => v / 100, v => v.toFixed(2));
        setupSlider('dbg-activeScale', 'activeScale', v => v / 100, v => v.toFixed(2));
        setupSlider('dbg-inactiveScale', 'inactiveScale', v => v / 100, v => v.toFixed(2));
        setupSlider('dbg-activeOpacity', 'activeOpacity', v => v / 100, v => v.toFixed(2));
        setupSlider('dbg-inactiveOpacity', 'inactiveOpacity', v => v / 100, v => v.toFixed(2));

        // Copy config button
        document.getElementById('dbg-copy').addEventListener('click', () => {
            const config = {
                arcSpan,
                radius: CONFIG.radius,
                radiusMobile: CONFIG.radiusMobile,
                scrollPerCard: CONFIG.scrollPerCard,
                detentStrength: CONFIG.detentStrength,
                smoothness: CONFIG.smoothness,
                activeScale: CONFIG.activeScale,
                inactiveScale: CONFIG.inactiveScale,
                activeOpacity: CONFIG.activeOpacity,
                inactiveOpacity: CONFIG.inactiveOpacity
            };
            navigator.clipboard.writeText(JSON.stringify(config, null, 2));
            alert('Config copied to clipboard!');
        });

        // Reset button
        document.getElementById('dbg-reset').addEventListener('click', () => {
            location.reload();
        });
    }

    // Override updateGeometry to use arcSpan variable
    const originalUpdateGeometry = updateGeometry;
    updateGeometry = function() {
        if (!wheel) return;

        const rect = wheel.getBoundingClientRect();
        centerX = rect.width / 2;
        centerY = rect.height + 80;
        radius = window.innerWidth <= 768 ? CONFIG.radiusMobile : CONFIG.radius;

        // Use arcSpan variable (can be modified by debug panel)
        const numCards = Math.max(cards.length, CONFIG.numVisibleCards);
        anglePerCard = arcSpan / Math.max(1, numCards - 1);
    };

    function waitForTheme(cb, max = 50) {
        let n = 0;
        const check = () => {
            if (window.ChrisTheme?.gsap && window.ChrisTheme?.ScrollTrigger) {
                cb();
            } else if (n++ < max) {
                requestAnimationFrame(check);
            }
        };
        check();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => waitForTheme(init));
    } else {
        waitForTheme(init);
    }

})();
