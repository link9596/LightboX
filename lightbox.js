(function (global) {
    'use strict';

    const STYLE_ID = 'lightbox-style';
    const STYLE_CSS = `
.lightbox-overlay.lightbox-overlay{position:fixed!important;inset:0!important;margin:0!important;padding:0!important;z-index:10000!important;-webkit-tap-highlight-color:transparent!important;touch-action:none!important;user-select:none!important;-webkit-user-select:none!important;overflow:hidden!important;box-sizing:border-box!important;background:transparent!important;border:0!important;outline:0!important}
.lightbox-overlay.lightbox-overlay *,.lightbox-overlay.lightbox-overlay *::before,.lightbox-overlay.lightbox-overlay *::after{box-sizing:border-box!important}
.lightbox-overlay.lightbox-overlay .lightbox-blur{position:absolute!important;inset:0!important;-webkit-backdrop-filter:blur(12px)!important;backdrop-filter:blur(12px)!important;opacity:0;transition:opacity .35s ease;pointer-events:none!important;will-change:opacity;z-index:1}
.lightbox-overlay.lightbox-overlay .lightbox-dim{position:absolute!important;inset:0!important;background:rgba(0,0,0,.78)!important;opacity:0;transition:opacity .35s ease;pointer-events:none!important;will-change:opacity;z-index:2}
.lightbox-overlay.lightbox-overlay.is-open .lightbox-blur,.lightbox-overlay.lightbox-overlay.is-open .lightbox-dim{opacity:1}
.lightbox-overlay.lightbox-overlay .lightbox-clone{position:fixed!important;margin:0!important;padding:0!important;z-index:10001!important;opacity:1;overflow:hidden!important;background:#1a1a1c!important;border:0!important;outline:0!important;border-radius:12px;object-fit:cover!important;display:block!important;cursor:pointer;user-select:none!important;-webkit-user-select:none!important;transform-origin:center center;will-change:transform}
.lightbox-overlay.lightbox-overlay .lightbox-clone.zoomed{cursor:grab!important}
.lightbox-overlay.lightbox-overlay .lightbox-clone.dragging{cursor:grabbing!important}
.lightbox-overlay.lightbox-overlay .lightbox-close-btn{position:fixed!important;top:20px!important;right:20px!important;z-index:10002!important;width:40px!important;height:40px!important;border-radius:50%!important;background:rgba(0,0,0,.5)!important;-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,.1)!important;color:#fff!important;display:flex!important;align-items:center!important;justify-content:center!important;cursor:pointer;opacity:0;transition:opacity .25s ease,transform .2s ease;padding:0!important;margin:0!important;-webkit-tap-highlight-color:transparent!important;box-shadow:0 4px 12px rgba(0,0,0,.2)}
.lightbox-overlay.lightbox-overlay.is-open .lightbox-close-btn{opacity:1}
.lightbox-overlay.lightbox-overlay .lightbox-close-btn:hover{transform:scale(1.08)}
.lightbox-overlay.lightbox-overlay .lightbox-close-btn:active{transform:scale(.96)}
.lightbox-overlay.lightbox-overlay .lightbox-close-btn svg{width:18px!important;height:18px!important;display:block!important;fill:none!important;stroke:currentColor!important;stroke-width:2!important;stroke-linecap:round!important;stroke-linejoin:round!important}
`;

    const DURATION = 400;
    const EASING = 'cubic-bezier(0.2, 0.9, 0.4, 1)';
    const GEOM_TRANSITION =
        `left ${DURATION}ms ${EASING}, ` +
        `top ${DURATION}ms ${EASING}, ` +
        `width ${DURATION}ms ${EASING}, ` +
        `height ${DURATION}ms ${EASING}, ` +
        `border-radius ${DURATION}ms ${EASING}`;
    const GEOM_TIMEOUT = DURATION + 120;
    const CLONE_RADIUS_START = '12px';
    const CLONE_RADIUS_END = '10px';
    const MIN_SCALE = 1, MAX_SCALE = 5;
    const ZOOM_TRANSITION = 'transform 0.3s cubic-bezier(0.2, 0.9, 0.4, 1)';

    let lbState = null;

    function injectStyles() {
        if (document.getElementById(STYLE_ID)) return;
        const head = document.head || document.documentElement;
        if (!head) return;
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.type = 'text/css';
        style.textContent = STYLE_CSS;
        head.appendChild(style);
    }
    if (document.head) injectStyles();
    else if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', injectStyles, { once: true });
    } else injectStyles();

    function getRect(el) {
        const r = el.getBoundingClientRect();
        return { left: r.left, top: r.top, width: r.width, height: r.height };
    }
    function getFinalSize(nw, nh, vw, vh) {
        const mw = vw * 0.85, mh = vh * 0.85;
        let w = nw, h = nh;
        if (w > mw) { const r = mw / w; w = mw; h *= r; }
        if (h > mh) { const r = mh / h; h = mh; w *= r; }
        return { width: w, height: h };
    }

    function applyTransform() {
        if (!lbState || !lbState.cloneEl) return;
        lbState.cloneEl.style.transform =
            `translate3d(${lbState.translate.x}px,${lbState.translate.y}px,0) scale(${lbState.scale})`;
    }
    function clampTranslate() {
        if (!lbState || !lbState.baseRect) return;
        const vw = window.innerWidth, vh = window.innerHeight;
        const { width, height } = lbState.baseRect;
        const s = lbState.scale;
        const mx = Math.max(0, (width * s - vw) / 2);
        const my = Math.max(0, (height * s - vh) / 2);
        lbState.translate.x = Math.min(mx, Math.max(-mx, lbState.translate.x));
        lbState.translate.y = Math.min(my, Math.max(-my, lbState.translate.y));
    }
    function zoomAtPoint(ns, cx, cy) {
        if (!lbState) return;
        ns = Math.min(MAX_SCALE, Math.max(MIN_SCALE, ns));
        if (ns === lbState.scale) return;
        const k = ns / lbState.scale;
        const br = lbState.baseRect;
        const ox = br.left + br.width / 2, oy = br.top + br.height / 2;
        lbState.translate.x = (cx - ox) * (1 - k) + k * lbState.translate.x;
        lbState.translate.y = (cy - oy) * (1 - k) + k * lbState.translate.y;
        lbState.scale = ns;
        clampTranslate();
        applyTransform();
        lbState.cloneEl.classList.toggle('zoomed', ns > 1);
    }
    function animateZoomToPoint(ts, cx, cy) {
        if (!lbState || lbState.isZoomAnimating || lbState.isResetting) return;
        ts = Math.min(MAX_SCALE, Math.max(MIN_SCALE, ts));
        if (ts === lbState.scale) return;
        const k = ts / lbState.scale;
        const br = lbState.baseRect;
        const ox = br.left + br.width / 2, oy = br.top + br.height / 2;
        const tx = (cx - ox) * (1 - k) + k * lbState.translate.x;
        const ty = (cy - oy) * (1 - k) + k * lbState.translate.y;
        lbState.isZoomAnimating = true;
        const clone = lbState.cloneEl;
        clone.style.transition = ZOOM_TRANSITION;
        lbState.scale = ts;
        lbState.translate.x = tx;
        lbState.translate.y = ty;
        clampTranslate();
        applyTransform();
        const done = () => {
            clone.removeEventListener('transitionend', done);
            clone.style.transition = '';
            if (!lbState) return;
            lbState.isZoomAnimating = false;
            clone.classList.toggle('zoomed', lbState.scale > 1);
        };
        clone.addEventListener('transitionend', done);
        setTimeout(() => { if (lbState && lbState.isZoomAnimating) done(); }, 350);
    }
    function resetTransform() {
        if (!lbState || lbState.isResetting || lbState.isZoomAnimating) return;
        if (lbState.isDragging) {
            lbState.isDragging = false;
            lbState.cloneEl.classList.remove('dragging');
        }
        if (lbState.scale === 1 && lbState.translate.x === 0 && lbState.translate.y === 0) return;
        lbState.isResetting = true;
        const clone = lbState.cloneEl;
        clone.style.transition = ZOOM_TRANSITION;
        lbState.scale = 1;
        lbState.translate.x = 0;
        lbState.translate.y = 0;
        applyTransform();
        const done = () => {
            clone.removeEventListener('transitionend', done);
            clone.style.transition = '';
            if (!lbState) return;
            lbState.isResetting = false;
            clone.classList.remove('zoomed');
        };
        clone.addEventListener('transitionend', done);
        setTimeout(() => { if (lbState && lbState.isResetting) done(); }, 350);
    }

    function onWheel(e) {
        if (!lbState || lbState.isAnimating || lbState.isResetting || lbState.isZoomAnimating) return;
        e.preventDefault();
        zoomAtPoint(lbState.scale * (e.deltaY > 0 ? 0.9 : 1.1), e.clientX, e.clientY);
    }
    function onPointerDown(e) {
        if (!lbState || lbState.scale === 1) return;
        if (lbState.isAnimating || lbState.isResetting || lbState.isZoomAnimating) return;
        e.preventDefault();
        lbState.isDragging = true;
        const p = e.touches ? e.touches[0] : e;
        lbState.dragStart.x = p.clientX - lbState.translate.x;
        lbState.dragStart.y = p.clientY - lbState.translate.y;
        lbState.cloneEl.classList.add('dragging');
    }
    function onPointerMove(e) {
        if (!lbState || !lbState.isDragging) return;
        e.preventDefault();
        const p = e.touches ? e.touches[0] : e;
        lbState.translate.x = p.clientX - lbState.dragStart.x;
        lbState.translate.y = p.clientY - lbState.dragStart.y;
        clampTranslate();
        applyTransform();
    }
    function onPointerUp() {
        if (!lbState) return;
        lbState.isDragging = false;
        lbState.cloneEl.classList.remove('dragging');
    }
    function onTouchStart(e) {
        if (!lbState || lbState.isResetting || lbState.isZoomAnimating) return;
        if (e.touches.length === 2) {
            if (lbState.tapTimer) { clearTimeout(lbState.tapTimer); lbState.tapTimer = null; }
            lbState.lastTap = 0;
            e.preventDefault();
            const t1 = e.touches[0], t2 = e.touches[1];
            lbState.initialDistance = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
            lbState.initialScale = lbState.scale;
        } else if (e.touches.length === 1) onPointerDown(e);
    }
    function onTouchMove(e) {
        if (!lbState) return;
        if (e.touches.length === 2 && lbState.initialDistance > 0) {
            e.preventDefault();
            const t1 = e.touches[0], t2 = e.touches[1];
            const d = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
            let ns = lbState.initialScale * (d / lbState.initialDistance);
            ns = Math.min(MAX_SCALE, Math.max(MIN_SCALE, ns));
            if (ns !== lbState.scale) {
                zoomAtPoint(ns, (t1.clientX + t2.clientX) / 2, (t1.clientY + t2.clientY) / 2);
            }
        } else if (e.touches.length === 1) onPointerMove(e);
    }
    function onTouchEnd(e) {
        if (!lbState) return;
        if (e.touches.length < 2) lbState.initialDistance = 0;
        if (e.touches.length === 0) onPointerUp();
    }
    function onTouchStartForDoubleTap(e) {
        if (!lbState) return;
        if (e.touches.length !== 1) return;
        if (lbState.isResetting || lbState.isZoomAnimating) return;
        const now = Date.now();
        const dt = now - lbState.lastTap;
        if (dt < 300 && dt > 0) {
            if (e.stopImmediatePropagation) e.stopImmediatePropagation();
            e.preventDefault();
            if (lbState.isDragging) {
                lbState.isDragging = false;
                lbState.cloneEl.classList.remove('dragging');
            }
            const t = e.touches[0];
            if (t) {
                if (lbState.scale === 1) animateZoomToPoint(Math.min(MAX_SCALE, 2), t.clientX, t.clientY);
                else resetTransform();
            }
            lbState.lastTap = 0;
            if (lbState.tapTimer) { clearTimeout(lbState.tapTimer); lbState.tapTimer = null; }
        } else {
            lbState.lastTap = now;
            if (lbState.tapTimer) clearTimeout(lbState.tapTimer);
            lbState.tapTimer = setTimeout(() => { if (lbState) lbState.lastTap = 0; }, 300);
        }
    }
    function onDoubleClick(e) {
        if (!lbState) return;
        e.preventDefault(); e.stopPropagation();
        if (lbState.isResetting || lbState.isZoomAnimating) return;
        if (lbState.scale === 1) animateZoomToPoint(Math.min(MAX_SCALE, 2.5), e.clientX, e.clientY);
        else resetTransform();
    }

    function bindZoomEvents() {
        if (!lbState || !lbState.cloneEl) return;
        const c = lbState.cloneEl;
        c.addEventListener('wheel', onWheel, { passive: false });
        c.addEventListener('mousedown', onPointerDown);
        window.addEventListener('mousemove', onPointerMove);
        window.addEventListener('mouseup', onPointerUp);
        c.addEventListener('touchstart', onTouchStartForDoubleTap, { passive: false });
        c.addEventListener('touchstart', onTouchStart, { passive: false });
        c.addEventListener('touchmove', onTouchMove, { passive: false });
        c.addEventListener('touchend', onTouchEnd);
        c.addEventListener('touchcancel', onTouchEnd);
        c.addEventListener('dblclick', onDoubleClick);
    }
    function unbindZoomEvents() {
        if (!lbState || !lbState.cloneEl) return;
        const c = lbState.cloneEl;
        c.removeEventListener('wheel', onWheel);
        c.removeEventListener('mousedown', onPointerDown);
        window.removeEventListener('mousemove', onPointerMove);
        window.removeEventListener('mouseup', onPointerUp);
        c.removeEventListener('touchstart', onTouchStartForDoubleTap);
        c.removeEventListener('touchstart', onTouchStart);
        c.removeEventListener('touchmove', onTouchMove);
        c.removeEventListener('touchend', onTouchEnd);
        c.removeEventListener('touchcancel', onTouchEnd);
        c.removeEventListener('dblclick', onDoubleClick);
        if (lbState.tapTimer) { clearTimeout(lbState.tapTimer); lbState.tapTimer = null; }
        lbState.lastTap = 0;
    }

    function destroyOverlay() {
        if (!lbState) return;
        if (lbState.resizeHandler) window.removeEventListener('resize', lbState.resizeHandler);
        if (lbState.escHandler) window.removeEventListener('keydown', lbState.escHandler);
        unbindZoomEvents();
        document.body.style.overflow = lbState._bodyOverflow || '';
        document.body.style.paddingRight = lbState._bodyPaddingRight || '';
        if (lbState.overlayEl && lbState.overlayEl.parentNode) {
            lbState.overlayEl.parentNode.removeChild(lbState.overlayEl);
        }
        lbState = null;
    }

    function openLightbox(imgElement) {
        if (lbState) return;
        if (!imgElement || !imgElement.src) return;

        const natW = imgElement.naturalWidth, natH = imgElement.naturalHeight;
        if (!natW || !natH) {
            const onLoad = () => {
                imgElement.removeEventListener('load', onLoad);
                openLightbox(imgElement);
            };
            imgElement.addEventListener('load', onLoad);
            return;
        }

        const startRect = getRect(imgElement);
        if (!startRect.width || !startRect.height) return;

        const vw = window.innerWidth, vh = window.innerHeight;
        const { width: finalW, height: finalH } = getFinalSize(natW, natH, vw, vh);
        const finalLeft = (vw - finalW) / 2;
        const finalTop = (vh - finalH) / 2;

        const overlay = document.createElement('div');
        overlay.className = 'lightbox-overlay';
        overlay.innerHTML =
            '<div class="lightbox-blur"></div>' +
            '<div class="lightbox-dim"></div>' +
            '<img class="lightbox-clone lightbox-clone-img" draggable="false" alt="">' +
            '<div class="lightbox-close-btn" role="button" aria-label="关闭">' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">' +
                    '<path d="M6 6l12 12M18 6L6 18"/>' +
                '</svg>' +
            '</div>';

        const clone = overlay.querySelector('.lightbox-clone');
        clone.src = imgElement.src;
        clone.alt = imgElement.alt || '';
        clone.style.left = startRect.left + 'px';
        clone.style.top = startRect.top + 'px';
        clone.style.width = startRect.width + 'px';
        clone.style.height = startRect.height + 'px';
        clone.style.borderRadius = CLONE_RADIUS_START;

        document.body.appendChild(overlay);

        const bodyOverflow = document.body.style.overflow;
        const bodyPaddingRight = document.body.style.paddingRight;
        const scrollbarW = window.innerWidth - document.documentElement.clientWidth;
        document.body.style.overflow = 'hidden';
        if (scrollbarW > 0) {
            document.body.style.paddingRight =
                (parseFloat(getComputedStyle(document.body).paddingRight) || 0) + scrollbarW + 'px';
        }

        lbState = {
            overlayEl: overlay, cloneEl: clone, originalImg: imgElement,
            baseRect: { left: finalLeft, top: finalTop, width: finalW, height: finalH },
            scale: 1, translate: { x: 0, y: 0 },
            dragStart: { x: 0, y: 0 },
            isDragging: false, isResetting: false, isZoomAnimating: false,
            isAnimating: true,
            initialDistance: 0, initialScale: 1, lastTap: 0, tapTimer: null,
            resizeHandler: null, escHandler: null,
            _bodyOverflow: bodyOverflow, _bodyPaddingRight: bodyPaddingRight
        };

        void clone.offsetWidth;

        clone.style.transition = GEOM_TRANSITION;

        requestAnimationFrame(() => {
            if (!lbState) return;
            overlay.classList.add('is-open');
            clone.style.left = finalLeft + 'px';
            clone.style.top = finalTop + 'px';
            clone.style.width = finalW + 'px';
            clone.style.height = finalH + 'px';
            clone.style.borderRadius = CLONE_RADIUS_END;
        });

        const finishOpen = () => {
            if (!lbState || !lbState.isAnimating) return;
            lbState.isAnimating = false;
            bindZoomEvents();
        };
        const onTE = (e) => {
            if (e.target !== clone || e.propertyName !== 'left') return;
            clone.removeEventListener('transitionend', onTE);
            finishOpen();
        };
        clone.addEventListener('transitionend', onTE);
        setTimeout(() => {
            if (lbState && lbState.isAnimating) {
                clone.removeEventListener('transitionend', onTE);
                finishOpen();
            }
        }, GEOM_TIMEOUT);

        overlay.addEventListener('click', (e) => {
            if (!lbState || lbState.isAnimating) return;
            if (e.target === overlay) { e.stopPropagation(); closeLightbox(false); }
        });
        const closeBtn = overlay.querySelector('.lightbox-close-btn');
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!lbState || lbState.isAnimating) return;
            closeLightbox(false);
        });

        lbState.escHandler = (e) => {
            if (e.key === 'Escape' && lbState && !lbState.isAnimating) {
                e.preventDefault();
                closeLightbox(false);
            }
        };
        window.addEventListener('keydown', lbState.escHandler);

        lbState.resizeHandler = () => {
            if (lbState && !lbState.isAnimating) closeLightbox(true);
        };
        window.addEventListener('resize', lbState.resizeHandler);
    }

    function closeLightbox(skipAnimation) {
        if (!lbState) return;
        if (lbState.isAnimating && !skipAnimation) return;

        const { overlayEl, cloneEl, originalImg } = lbState;

        if (lbState.resizeHandler) { window.removeEventListener('resize', lbState.resizeHandler); lbState.resizeHandler = null; }
        if (lbState.escHandler) { window.removeEventListener('keydown', lbState.escHandler); lbState.escHandler = null; }
        unbindZoomEvents();

        if (skipAnimation || !overlayEl || !cloneEl || !originalImg) {
            destroyOverlay();
            return;
        }

        const startRect = getRect(originalImg);
        if (!startRect.width || !startRect.height) { destroyOverlay(); return; }

        lbState.isAnimating = true;
        overlayEl.classList.remove('is-open');
        cloneEl.classList.remove('zoomed', 'dragging');

        cloneEl.style.transition = 'none';
        cloneEl.style.transform = '';
        void cloneEl.offsetWidth;

        cloneEl.style.transition = GEOM_TRANSITION;

        cloneEl.style.left = startRect.left + 'px';
        cloneEl.style.top = startRect.top + 'px';
        cloneEl.style.width = startRect.width + 'px';
        cloneEl.style.height = startRect.height + 'px';
        cloneEl.style.borderRadius = CLONE_RADIUS_START;

        const onEnd = (e) => {
            if (e.target !== cloneEl || e.propertyName !== 'left') return;
            cloneEl.removeEventListener('transitionend', onEnd);
            destroyOverlay();
        };
        cloneEl.addEventListener('transitionend', onEnd);
        setTimeout(() => { if (lbState) destroyOverlay(); }, GEOM_TIMEOUT);
    }

    function initLightbox(selector = '.lightbox-img') {
        const handle = (e) => {
            if (lbState) return;
            const img = e.target.closest(selector);
            if (img && img.tagName === 'IMG') { e.preventDefault(); openLightbox(img); }
        };
        document.body.addEventListener('click', handle);
        return function destroy() { document.body.removeEventListener('click', handle); };
    }

    global.Lightbox = { init: initLightbox, open: openLightbox, close: closeLightbox };

})(window);
