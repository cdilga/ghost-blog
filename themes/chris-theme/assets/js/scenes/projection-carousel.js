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
        radius: 500,                    // Distance from center to cards
        radiusMobile: 320,              // Mobile radius
        numVisibleCards: 7,             // How many cards to show in the arc
        scrollPerCard: 100,             // Scroll pixels per card

        // Detent (snap) settings
        detentStrength: 0.85,
        detentFriction: 0.92,

        // Visual
        activeScale: 1.0,
        inactiveScale: 0.55,
        activeOpacity: 1.0,
        inactiveOpacity: 0.25,

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

        // Center below the bottom of the container
        // This makes the top of the wheel (the arc) visible
        centerY = rect.height + 100;

        // Responsive radius
        radius = window.innerWidth <= 768 ? CONFIG.radiusMobile : CONFIG.radius;

        // Angle between cards - spread them across 180 degrees (the visible arc)
        const numCards = Math.max(cards.length, CONFIG.numVisibleCards);
        anglePerCard = 180 / Math.max(1, numCards - 1);
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

            // Card rotation - cards point outward from center
            // At 90° (top), card should be upright (rotation = 0)
            // At 0° (right), card should tilt right (rotation = -90)
            // At 180° (left), card should tilt left (rotation = +90)
            const cardRotation = angle - 90;

            // Normalize angle to figure out visibility and styling
            let normAngle = ((angle % 360) + 360) % 360;
            if (normAngle > 270) normAngle -= 360;

            // Distance from the active position (90°)
            // 0 = at active, 1 = at the edges (0° or 180°)
            const distFromActive = Math.min(1, Math.abs(normAngle - 90) / 90);

            // Scale and opacity based on distance from active
            const scale = CONFIG.activeScale - distFromActive * (CONFIG.activeScale - CONFIG.inactiveScale);
            const opacity = CONFIG.activeOpacity - distFromActive * (CONFIG.activeOpacity - CONFIG.inactiveOpacity);

            // Z-index: cards closer to active are on top
            const zIndex = Math.round((1 - distFromActive) * 100);

            // Only show cards in the visible semicircle (roughly -20° to 200°)
            const isVisible = normAngle >= -25 && normAngle <= 205;

            // Apply the transform
            if (isVisible) {
                card.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) rotate(${cardRotation}deg) scale(${scale})`;
                card.style.opacity = opacity;
                card.style.zIndex = zIndex;
                card.style.visibility = 'visible';
            } else {
                card.style.visibility = 'hidden';
            }

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

        // Apply detent snapping when not dragging
        if (!isDragging) {
            const nearestDetent = Math.round(wheelAngle / anglePerCard) * anglePerCard;
            const distToDetent = nearestDetent - wheelAngle;

            if (Math.abs(velocity) < 2 && Math.abs(distToDetent) < anglePerCard * 0.4) {
                velocity += distToDetent * CONFIG.detentStrength * 0.12;
            }
        }

        // Apply friction
        velocity *= CONFIG.detentFriction;

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
            config: CONFIG
        };

        console.log('[carousel] Ready with', cards.length, 'cards');
    }

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
