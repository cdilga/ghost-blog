/**
 * Motion Input System
 * Ultra-lightweight camera optical flow for parallax effects
 * 32x32 camera feed, ~1KB processing per frame
 *
 * Usage:
 *   MotionInput.subscribe((x, y) => { ... });
 *   MotionInput.unsubscribe(callback);
 */

(function() {
    'use strict';

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        window.MotionInput = { subscribe: () => {}, unsubscribe: () => {}, enabled: false };
        return;
    }

    const isMobile = /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
        || window.innerWidth <= 768;

    const CONFIG = isMobile ? {
        SIZE: 32, SENSITIVITY: 144, DEAD_ZONE: 0.001, DECAY: 0.95,
        INPUT_MIX: 0.12, RAW_SMOOTH: 0.55, BETA: 2.0, MIN_CUTOFF: 0.05,
        X_ONLY: false, MIX_MOUSE: false
    } : {
        SIZE: 32, SENSITIVITY: 500, DEAD_ZONE: 0.0004, DECAY: 0.99,
        INPUT_MIX: 0.01, RAW_SMOOTH: 0.9, BETA: 4.3, MIN_CUTOFF: 0.05,
        X_ONLY: true, MIX_MOUSE: true, MOUSE_WEIGHT: 0.7, CAMERA_WEIGHT: 0.3
    };

    // One-Euro Filter - adaptive low-pass for noisy signals
    class OneEuroFilter {
        constructor(freq, minCutoff, beta, dCutoff = 1.0) {
            this.freq = freq;
            this.minCutoff = minCutoff;
            this.beta = beta;
            this.dCutoff = dCutoff;
            this.x = null;
            this.dx = 0;
        }

        alpha(cutoff) {
            const tau = 1.0 / (2 * Math.PI * cutoff);
            return 1.0 / (1.0 + tau * this.freq);
        }

        filter(x) {
            if (this.x === null) {
                this.x = x;
                return x;
            }
            const dx = (x - this.x) * this.freq;
            const edx = this.alpha(this.dCutoff) * dx + (1 - this.alpha(this.dCutoff)) * this.dx;
            this.dx = edx;
            const cutoff = this.minCutoff + this.beta * Math.abs(edx);
            const a = this.alpha(cutoff);
            this.x = a * x + (1 - a) * this.x;
            return this.x;
        }
    }

    let video = null, canvas = null, ctx = null, previousGray = null;
    let animationId = null, isRunning = false, permissionGranted = false;

    const filterX = new OneEuroFilter(60, CONFIG.MIN_CUTOFF, CONFIG.BETA);
    const filterY = new OneEuroFilter(60, CONFIG.MIN_CUTOFF, CONFIG.BETA);

    let cameraX = 0, cameraY = 0, mouseX = 0, mouseY = 0;
    let smoothFlowX = 0, smoothFlowY = 0;

    const subscribers = new Set();

    if (CONFIG.MIX_MOUSE) {
        document.addEventListener('mousemove', (e) => {
            mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
            mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
        });
    }

    function sobelEdges(gray, width, height) {
        const edges = new Float32Array(width * height);
        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const idx = y * width + x;
                const gx =
                    -gray[(y-1)*width + (x-1)] + gray[(y-1)*width + (x+1)] +
                    -2*gray[y*width + (x-1)] + 2*gray[y*width + (x+1)] +
                    -gray[(y+1)*width + (x-1)] + gray[(y+1)*width + (x+1)];
                const gy =
                    -gray[(y-1)*width + (x-1)] - 2*gray[(y-1)*width + x] - gray[(y-1)*width + (x+1)] +
                    gray[(y+1)*width + (x-1)] + 2*gray[(y+1)*width + x] + gray[(y+1)*width + (x+1)];
                edges[idx] = Math.sqrt(gx*gx + gy*gy);
            }
        }
        return edges;
    }

    function calculateOpticalFlow(prev, curr, edges, width, height) {
        let sumDx = 0, sumDy = 0, sumWeight = 0;
        const step = 2, searchRadius = 3;

        for (let y = searchRadius; y < height - searchRadius; y += step) {
            for (let x = searchRadius; x < width - searchRadius; x += step) {
                const idx = y * width + x;
                const weight = edges[idx];
                if (weight < 0.05) continue;

                const prevVal = prev[idx];
                let bestDx = 0, bestDy = 0, bestDiff = Infinity;

                for (let dy = -searchRadius; dy <= searchRadius; dy++) {
                    for (let dx = -searchRadius; dx <= searchRadius; dx++) {
                        const searchIdx = (y + dy) * width + (x + dx);
                        const diff = Math.abs(curr[searchIdx] - prevVal);
                        if (diff < bestDiff) {
                            bestDiff = diff;
                            bestDx = dx;
                            bestDy = dy;
                        }
                    }
                }

                sumDx += bestDx * weight;
                sumDy += bestDy * weight;
                sumWeight += weight;
            }
        }

        return sumWeight > 0.1
            ? { x: sumDx / sumWeight / width, y: sumDy / sumWeight / height }
            : { x: 0, y: 0 };
    }

    function track() {
        if (!isRunning || !video || !ctx) return;

        ctx.drawImage(video, 0, 0, CONFIG.SIZE, CONFIG.SIZE);
        const frame = ctx.getImageData(0, 0, CONFIG.SIZE, CONFIG.SIZE);

        const gray = new Float32Array(CONFIG.SIZE * CONFIG.SIZE);
        for (let i = 0; i < CONFIG.SIZE * CONFIG.SIZE; i++) {
            const idx = i * 4;
            gray[i] = (frame.data[idx] * 0.299 + frame.data[idx+1] * 0.587 + frame.data[idx+2] * 0.114) / 255;
        }

        const edges = sobelEdges(gray, CONFIG.SIZE, CONFIG.SIZE);

        if (previousGray) {
            const flow = calculateOpticalFlow(previousGray, gray, edges, CONFIG.SIZE, CONFIG.SIZE);

            smoothFlowX = smoothFlowX * (1 - CONFIG.RAW_SMOOTH) + flow.x * CONFIG.RAW_SMOOTH;
            smoothFlowY = smoothFlowY * (1 - CONFIG.RAW_SMOOTH) + flow.y * CONFIG.RAW_SMOOTH;

            let filteredX = filterX.filter(smoothFlowX);
            let filteredY = filterY.filter(smoothFlowY);

            if (Math.abs(filteredX) < CONFIG.DEAD_ZONE) filteredX = 0;
            if (Math.abs(filteredY) < CONFIG.DEAD_ZONE) filteredY = 0;

            cameraX = cameraX * CONFIG.DECAY + filteredX * CONFIG.SENSITIVITY * CONFIG.INPUT_MIX;
            if (!CONFIG.X_ONLY) {
                cameraY = cameraY * CONFIG.DECAY + filteredY * CONFIG.SENSITIVITY * CONFIG.INPUT_MIX;
            }

            cameraX = Math.max(-1, Math.min(1, cameraX));
            cameraY = Math.max(-1, Math.min(1, cameraY));

            let finalX, finalY;
            if (CONFIG.MIX_MOUSE) {
                finalX = cameraX * CONFIG.CAMERA_WEIGHT + mouseX * CONFIG.MOUSE_WEIGHT;
                finalY = CONFIG.X_ONLY ? (mouseY * CONFIG.MOUSE_WEIGHT) : (cameraY * CONFIG.CAMERA_WEIGHT + mouseY * CONFIG.MOUSE_WEIGHT);
            } else {
                finalX = cameraX;
                finalY = cameraY;
            }

            finalX = Math.max(-1, Math.min(1, finalX));
            finalY = Math.max(-1, Math.min(1, finalY));

            subscribers.forEach(cb => { try { cb(finalX, finalY); } catch (e) {} });
        }

        previousGray = gray;
        animationId = requestAnimationFrame(track);
    }

    async function init() {
        if (isRunning) return true;

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'user', width: { ideal: 64 }, height: { ideal: 64 } }
            });

            video = document.createElement('video');
            video.srcObject = stream;
            video.autoplay = true;
            video.playsInline = true;
            video.muted = true;
            await video.play();

            canvas = document.createElement('canvas');
            canvas.width = CONFIG.SIZE;
            canvas.height = CONFIG.SIZE;
            ctx = canvas.getContext('2d', { willReadFrequently: true });

            isRunning = true;
            permissionGranted = true;
            animationId = requestAnimationFrame(track);
            return true;
        } catch (err) {
            return false;
        }
    }

    function stop() {
        isRunning = false;
        if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }
        if (video && video.srcObject) {
            video.srcObject.getTracks().forEach(track => track.stop());
            video = null;
        }
    }

    window.MotionInput = {
        subscribe(callback) {
            subscribers.add(callback);
            if (subscribers.size === 1 && !isRunning) init();
        },

        unsubscribe(callback) {
            subscribers.delete(callback);
            if (subscribers.size === 0 && isRunning) stop();
        },

        get enabled() { return permissionGranted && isRunning; },

        async requestPermission() { return await init(); },

        get position() {
            if (CONFIG.MIX_MOUSE) {
                return {
                    x: Math.max(-1, Math.min(1, cameraX * CONFIG.CAMERA_WEIGHT + mouseX * CONFIG.MOUSE_WEIGHT)),
                    y: Math.max(-1, Math.min(1, CONFIG.X_ONLY ? mouseY * CONFIG.MOUSE_WEIGHT : cameraY * CONFIG.CAMERA_WEIGHT + mouseY * CONFIG.MOUSE_WEIGHT))
                };
            }
            return { x: cameraX, y: cameraY };
        },

        get isMobile() { return isMobile; }
    };

    // Info button - shows when motion tracking is active
    function createInfoButton() {
        const btn = document.createElement('button');
        btn.className = 'motion-info-btn';
        btn.innerHTML = '?';
        btn.setAttribute('aria-label', 'How does motion tracking work?');
        btn.style.cssText = `
            position: fixed; bottom: 20px; right: 20px;
            width: 40px; height: 40px; border-radius: 50%;
            border: 2px solid rgba(255,255,255,0.3);
            background: rgba(0,0,0,0.5); color: white;
            font-size: 18px; font-weight: bold; cursor: pointer;
            z-index: 9999; opacity: 0;
            transition: opacity 0.3s, transform 0.2s;
            backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
        `;

        const tooltip = document.createElement('div');
        tooltip.className = 'motion-info-tooltip';
        tooltip.innerHTML = `
            <strong>Motion Tracking</strong><br><br>
            This site uses your camera to create parallax effects based on your movement.<br><br>
            <em>How it works:</em><br>
            • 32×32 pixel camera feed (ultra low-res)<br>
            • Optical flow detects motion direction<br>
            • One-Euro filter smooths the signal<br>
            • No images are stored or transmitted<br><br>
            ${isMobile ? '<small>Mobile: Full head tracking</small>' : '<small>Desktop: Camera + mouse mixed</small>'}
        `;
        tooltip.style.cssText = `
            position: fixed; bottom: 70px; right: 20px;
            width: 280px; padding: 15px;
            background: rgba(0,0,0,0.9); color: white;
            font-size: 13px; line-height: 1.5; border-radius: 8px;
            z-index: 9998; opacity: 0; transform: translateY(10px);
            transition: opacity 0.3s, transform 0.3s;
            pointer-events: none;
            backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
        `;

        btn.addEventListener('mouseenter', () => {
            tooltip.style.opacity = '1';
            tooltip.style.transform = 'translateY(0)';
        });

        btn.addEventListener('mouseleave', () => {
            tooltip.style.opacity = '0';
            tooltip.style.transform = 'translateY(10px)';
        });

        btn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const isVisible = tooltip.style.opacity === '1';
            tooltip.style.opacity = isVisible ? '0' : '1';
            tooltip.style.transform = isVisible ? 'translateY(10px)' : 'translateY(0)';
        });

        const checkActive = setInterval(() => {
            if (permissionGranted) {
                btn.style.opacity = '1';
                clearInterval(checkActive);
            }
        }, 500);

        document.body.appendChild(tooltip);
        document.body.appendChild(btn);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', createInfoButton);
    } else {
        createInfoButton();
    }

})();
