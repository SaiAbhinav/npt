/**
 * Viewport — zoom and pan for an SVG map drawn in fixed map units.
 *
 * Owns the current view [x, y, w, h] and handles + / − / reset buttons, the
 * mouse wheel, drag to pan, pinch on touch screens, double-click, and the
 * keyboard (+ − 0 and arrow keys) while the element has focus. Whatever is
 * drawn is up to the caller, which gets `onRender(view)` after every change.
 *
 *   const vp = NPT.Viewport.create(el, { onRender });
 *   vp.setLimits({ home, area });   // starting view, and the area to stay over
 *   vp.reset(0);                    // jump to `home`
 */
(function (NPT) {
  'use strict';

  const ZOOM_STEP = 1.6;      // one button press
  const ZOOM_MS = 240;
  const DRAG_THRESHOLD = 4;   // px of movement before a press becomes a drag

  const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ease = (t) => 1 - Math.pow(1 - t, 3);

  const ICONS = {
    in: '<path d="M12 6v12M6 12h12"/>',
    out: '<path d="M6 12h12"/>',
    reset: '<path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v4h4"/>',
  };
  const button = (action, label) =>
    `<button class="map-btn" type="button" data-zoom="${action}" aria-label="${label}" title="${label}">` +
    `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[action]}</svg></button>`;

  /**
   * @param {HTMLElement} el  the map box; it should keep the same aspect ratio as `home`
   * @param {object} options
   *   onRender(view)  draw for the current view
   *   maxZoomIn       how far past `home` you can zoom in (default 8)
   *   resetLabel      label for the reset button
   */
  function create(el, { onRender, maxZoomIn = 8, resetLabel = 'Reset map' }) {
    el.classList.add('map-surface');
    if (!el.hasAttribute('tabindex')) el.tabIndex = 0;

    const controls = document.createElement('div');
    controls.className = 'map-controls';
    controls.innerHTML = button('in', 'Zoom in') + button('out', 'Zoom out') + button('reset', resetLabel);
    el.append(controls);
    const btn = (a) => controls.querySelector(`[data-zoom="${a}"]`);

    let home = null;   // starting view
    let area = null;   // [x, y, w, h] the view stays over
    let view = null;
    let frame = 0;

    const aspect = () => home[2] / home[3];
    const maxWidth = () => Math.max(home[2], area[2] * 1.15, area[3] * 1.15 * aspect());
    const atHome = () => view && home && view.every((v, i) => Math.abs(v - home[i]) < home[2] * 0.002);

    function clamp(v) {
      const minW = home[2] / maxZoomIn;
      const w = Math.min(maxWidth(), Math.max(minW, v[2]));
      const h = w / aspect();
      const x0 = Math.min(area[0], home[0]);
      const y0 = Math.min(area[1], home[1]);
      const x1 = Math.max(area[0] + area[2], home[0] + home[2]);
      const y1 = Math.max(area[1] + area[3], home[1] + home[3]);
      const cx = Math.min(x1, Math.max(x0, v[0] + v[2] / 2));
      const cy = Math.min(y1, Math.max(y0, v[1] + v[3] / 2));
      return [cx - w / 2, cy - h / 2, w, h];
    }

    function render() {
      btn('in').disabled = home[2] / view[2] >= maxZoomIn * 0.999;
      btn('out').disabled = view[2] >= maxWidth() * 0.999;
      btn('reset').hidden = atHome();
      el.classList.toggle('is-zoomed', !atHome());
      onRender(view);
    }

    /**
     * Animate to `target`. `lift` > 0 zooms out mid-way (for long moves);
     * `onFrame(t)` runs each frame before drawing; `done` runs at the end.
     */
    function animateTo(target, ms = ZOOM_MS, { lift = 0, onFrame, done } = {}) {
      cancelAnimationFrame(frame);
      const from = view;
      if (!from || !ms || reduceMotion()) {
        view = target; onFrame?.(1); render(); done?.();
        return;
      }
      const start = performance.now();
      const step = (now) => {
        const t = ease(Math.min(1, (now - start) / ms));
        const k = 1 + Math.sin(Math.PI * t) * lift;
        const w = (from[2] + (target[2] - from[2]) * t) * k;
        const h = (from[3] + (target[3] - from[3]) * t) * k;
        const cx = from[0] + from[2] / 2 + (target[0] + target[2] / 2 - from[0] - from[2] / 2) * t;
        const cy = from[1] + from[3] / 2 + (target[1] + target[3] / 2 - from[1] - from[3] / 2) * t;
        view = t < 1 ? [cx - w / 2, cy - h / 2, w, h] : target;
        onFrame?.(t);
        render();
        if (t < 1) frame = requestAnimationFrame(step);
        else done?.();
      };
      frame = requestAnimationFrame(step);
    }

    /** Zoom by `factor` (>1 zooms in), keeping the point at (fx, fy) — fractions of the box — still. */
    function zoomBy(factor, fx = 0.5, fy = 0.5, ms = 0) {
      if (!view) return;
      const w = view[2] / factor;
      const h = view[3] / factor;
      const px = view[0] + view[2] * fx;
      const py = view[1] + view[3] * fy;
      const target = clamp([px - w * fx, py - h * fy, w, h]);
      if (ms) animateTo(target, ms);
      else { cancelAnimationFrame(frame); view = target; render(); }
    }

    function panBy(dxFrac, dyFrac) {
      if (!view) return;
      cancelAnimationFrame(frame);
      view = clamp([view[0] - view[2] * dxFrac, view[1] - view[3] * dyFrac, view[2], view[3]]);
      render();
    }

    /** Frame the box [x0, y0, x1, y1] with some padding. */
    function fit([x0, y0, x1, y1], { pad = 0.25, minWidth = 0, ms = 420 } = {}) {
      const a = aspect();
      let w = Math.max((x1 - x0) * (1 + pad * 2), minWidth);
      w = Math.max(w, (y1 - y0) * (1 + pad * 2) * a);
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      animateTo(clamp([cx - w / 2, cy - w / a / 2, w, w / a]), ms);
    }

    /* ---------- Input ---------- */

    controls.addEventListener('click', (event) => {
      const action = event.target.closest('[data-zoom]')?.dataset.zoom;
      if (action === 'in') zoomBy(ZOOM_STEP, 0.5, 0.5, ZOOM_MS);
      if (action === 'out') zoomBy(1 / ZOOM_STEP, 0.5, 0.5, ZOOM_MS);
      if (action === 'reset') animateTo(home, ZOOM_MS * 1.5);
    });

    const fraction = (event) => {
      const r = el.getBoundingClientRect();
      return [(event.clientX - r.left) / r.width, (event.clientY - r.top) / r.height];
    };

    el.addEventListener('wheel', (event) => {
      if (!view) return;
      event.preventDefault();
      const [fx, fy] = fraction(event);
      const delta = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY;
      zoomBy(Math.exp(-delta * 0.0022), fx, fy);
    }, { passive: false });

    el.addEventListener('dblclick', (event) => {
      if (event.target.closest('.map-controls, button, a')) return;
      const [fx, fy] = fraction(event);
      zoomBy(event.shiftKey ? 1 / ZOOM_STEP : ZOOM_STEP, fx, fy, ZOOM_MS);
    });

    // Press-and-drag pans; two fingers pinch. A press that doesn't move stays a
    // click, so pins and other buttons inside the map still work.
    const pointers = new Map();
    let pinch = null;
    let dragged = false;
    el.addEventListener('pointerdown', (event) => {
      if (event.target.closest('.map-controls') || !view) return;
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      pointers.set(event.pointerId, { start: [event.clientX, event.clientY], last: [event.clientX, event.clientY] });
      dragged = false;
      cancelAnimationFrame(frame);
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()].map((p) => p.last);
        pinch = { dist: Math.hypot(a[0] - b[0], a[1] - b[1]) };
      }
    });
    el.addEventListener('pointermove', (event) => {
      const p = pointers.get(event.pointerId);
      if (!p) return;
      const r = el.getBoundingClientRect();
      const cur = [event.clientX, event.clientY];
      if (!dragged && Math.hypot(cur[0] - p.start[0], cur[1] - p.start[1]) < DRAG_THRESHOLD && pointers.size === 1) return;
      if (!dragged) {
        dragged = true;
        el.classList.add('is-dragging');
        el.setPointerCapture(event.pointerId);
      }
      const prev = p.last;
      p.last = cur;
      if (pointers.size === 1) {
        panBy((cur[0] - prev[0]) / r.width, (cur[1] - prev[1]) / r.height);
      } else if (pointers.size === 2 && pinch) {
        const [a, b] = [...pointers.values()].map((q) => q.last);
        const dist = Math.hypot(a[0] - b[0], a[1] - b[1]);
        const mid = [((a[0] + b[0]) / 2 - r.left) / r.width, ((a[1] + b[1]) / 2 - r.top) / r.height];
        if (pinch.dist > 0) zoomBy(dist / pinch.dist, mid[0], mid[1]);
        pinch.dist = dist;
      }
    });
    const release = (event) => {
      pointers.delete(event.pointerId);
      if (pointers.size < 2) pinch = null;
      if (!pointers.size) el.classList.remove('is-dragging');
    };
    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);
    // Swallow the click that ends a drag, so a pan never opens a pin.
    el.addEventListener('click', (event) => {
      if (dragged) { event.stopPropagation(); event.preventDefault(); dragged = false; }
    }, true);

    el.addEventListener('keydown', (event) => {
      if (event.altKey || event.ctrlKey || event.metaKey || !view) return;
      if (event.target !== el && event.key.startsWith('Arrow')) return; // let focused buttons be
      const keys = {
        '+': () => zoomBy(ZOOM_STEP, 0.5, 0.5, ZOOM_MS),
        '=': () => zoomBy(ZOOM_STEP, 0.5, 0.5, ZOOM_MS),
        '-': () => zoomBy(1 / ZOOM_STEP, 0.5, 0.5, ZOOM_MS),
        '_': () => zoomBy(1 / ZOOM_STEP, 0.5, 0.5, ZOOM_MS),
        0: () => animateTo(home, ZOOM_MS * 1.5),
        ArrowLeft: () => panBy(0.15, 0),
        ArrowRight: () => panBy(-0.15, 0),
        ArrowUp: () => panBy(0, 0.15),
        ArrowDown: () => panBy(0, -0.15),
      };
      const run = keys[event.key];
      if (!run) return;
      event.preventDefault();
      event.stopPropagation();
      run();
    });

    return {
      get view() { return view; },
      get home() { return home; },
      setLimits(limits) { home = limits.home; area = limits.area; },
      reset(ms = ZOOM_MS * 1.5) { animateTo(home, ms); },
      animateTo,
      zoomBy,
      fit,
      redraw() { if (view) render(); },
    };
  }

  NPT.Viewport = Object.freeze({ create });
})(window.NPT = window.NPT || {});
