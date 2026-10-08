/**
 * Park map — the small, zoomable map in the park dialog.
 *
 * Draws the park's boundary from js/data/us-map.js over the state lines around
 * it, with a pin, the park's name, the state name and a distance scale.
 * Zoom and pan come from NPT.Viewport. Moving between parks glides the view.
 * Nothing is fetched at runtime, so it works from file:// and offline.
 */
(function (NPT) {
  'use strict';

  const GLIDE_MS = 560;
  const DETAIL_MARGIN = 0.08;   // build-map.cjs clips detail this far past the starting view

  const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /** A round distance near `target` miles: 1, 2, 5, 10, 20, 50… */
  function niceMiles(target) {
    const pow = Math.pow(10, Math.floor(Math.log10(target)));
    const n = target / pow;
    return (n >= 5 ? 5 : n >= 2 ? 2 : 1) * pow;
  }

  /** Fill `parent` with one path per state in `group`. */
  function drawStates(parent, data, group) {
    data.states.filter((s) => s.group === group).forEach((s) => {
      parent.append(NPT.svg('path', { d: s.d, class: 'map-state' }));
    });
  }

  function create(container) {
    const data = window.NPT_MAP;
    if (!data) {
      console.warn('js/data/us-map.js did not load; park maps are hidden.');
      return { show() { container.hidden = true; } };
    }

    container.setAttribute('role', 'group');
    container.setAttribute('aria-roledescription', 'map');
    container.innerHTML =
      '<svg class="map-svg" aria-hidden="true" preserveAspectRatio="xMidYMid slice">' +
        '<g class="park-map__base"></g>' +
        '<g class="park-map__detail"><g class="park-map__detail-states"></g></g>' +
      '</svg>' +
      '<span class="park-map__region" aria-hidden="true"></span>' +
      '<span class="map-pin park-map__pin" aria-hidden="true">' +
        '<span class="map-pin__dot"></span>' +
        '<span class="map-pin__label"></span>' +
      '</span>' +
      '<span class="map-scale" aria-hidden="true"><span class="map-scale__bar"></span><span class="map-scale__text"></span></span>';

    const svg = container.querySelector('svg');
    const baseLayer = svg.querySelector('.park-map__base');
    const detailLayer = svg.querySelector('.park-map__detail');
    const detailStates = svg.querySelector('.park-map__detail-states');
    const regionEl = container.querySelector('.park-map__region');
    const pinEl = container.querySelector('.park-map__pin');
    const labelEl = pinEl.querySelector('.map-pin__label');
    const scale = NPT.MapScale(container.querySelector('.map-scale'));

    // Simplified outlines per area (lower 48, Alaska, Hawaii, Caribbean, Samoa).
    // They sit under the detailed layer and show wherever it doesn't reach.
    const groups = new Map();
    function showGroup(name) {
      if (!groups.has(name)) {
        const g = NPT.svg('g', { 'data-group': name });
        drawStates(g, data, name);
        baseLayer.append(g);
        groups.set(name, g);
      }
      groups.forEach((g, key) => { g.style.display = key === name ? '' : 'none'; });
    }

    function drawDetail(park) {
      detailStates.replaceChildren(...park.detail.map((s) => NPT.svg('path', { d: s.d, class: 'map-state' })));
      detailLayer.querySelector('.map-area')?.remove();
      detailLayer.append(NPT.svg('path', { d: park.area, class: 'map-area' }));
    }

    let info = null;
    let detailBox = null;
    let pin = null;
    let group = null;

    const vp = NPT.Viewport.create(container, {
      onRender(view) {
        svg.setAttribute('viewBox', view.join(' '));
        NPT.placePin(pinEl, pin, view);

        // Detailed state lines only cover the park's surroundings; past that,
        // the simplified outlines underneath take over.
        const inside = view[0] >= detailBox[0] && view[1] >= detailBox[1]
          && view[0] + view[2] <= detailBox[0] + detailBox[2]
          && view[1] + view[3] <= detailBox[1] + detailBox[3];
        detailStates.style.display = inside ? '' : 'none';
        scale.update(view, info.unitKm);
      },
    });

    function show(park) {
      const next = data.parks[park.id];
      if (!next) { container.hidden = true; return; }
      container.hidden = false;

      showGroup(next.group);
      const glide = vp.view && group === next.group && !reduceMotion();
      const from = vp.view;
      const fromPin = pin;

      info = next;
      group = next.group;
      const home = next.view;
      const m = home[2] * DETAIL_MARGIN;
      detailBox = [home[0] - m, home[1] - m, home[2] + 2 * m, home[3] + 2 * m];
      vp.setLimits({ home, area: data.groups[next.group] });

      labelEl.textContent = park.name;
      regionEl.textContent = park.states.join(' · ');
      container.setAttribute('aria-label',
        `Map of ${park.name} National Park in ${NPT.utils.formatList(park.states)}. `
        + 'Use plus and minus to zoom, arrow keys to move, and 0 to reset.');

      // Replay the pin's drop-in on every park.
      pinEl.classList.remove('is-dropping');
      void pinEl.offsetWidth;
      pinEl.classList.add('is-dropping');

      if (!glide) {
        pin = next.pin;
        drawDetail(next);
        vp.reset(0);
        return;
      }
      // Glide over the simplified outlines, then fade the new detail in.
      container.classList.add('is-gliding');
      const travel = Math.hypot(home[0] - from[0], home[1] - from[1]) / Math.max(from[2], home[2]);
      vp.animateTo(home, GLIDE_MS, {
        lift: Math.min(1.5, travel * 0.6),
        onFrame: (t) => { pin = fromPin.map((v, i) => v + (next.pin[i] - v) * t); },
        done: () => { drawDetail(next); container.classList.remove('is-gliding'); },
      });
    }

    return { show };
  }

  /* ---------- Small shared helpers (also used by the map view) ---------- */

  NPT.svg = function svg(name, attrs = {}) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', name);
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    return el;
  };

  /** Position an HTML pin over map point `p` for `view`; returns false when it's off screen. */
  NPT.placePin = function placePin(el, p, view) {
    const left = ((p[0] - view[0]) / view[2]) * 100;
    const top = ((p[1] - view[1]) / view[3]) * 100;
    el.style.left = `${left}%`;
    el.style.top = `${top}%`;
    el.classList.toggle('is-left', left > 58);
    const visible = left > -5 && left < 105 && top > -5 && top < 105;
    el.classList.toggle('is-offscreen', !visible);
    return visible;
  };

  /** Distance scale in miles that follows the zoom. */
  NPT.MapScale = function MapScale(el) {
    const bar = el.querySelector('.map-scale__bar');
    const text = el.querySelector('.map-scale__text');
    return {
      update(view, unitKm) {
        const viewMiles = (view[2] * unitKm) / 1.609344;
        const miles = niceMiles(viewMiles * 0.22);
        bar.style.width = `${(miles / viewMiles) * 100}%`;
        text.textContent = `${miles.toLocaleString('en-US')} mi`;
      },
    };
  };

  /** "37.30° N, 113.05° W" */
  function formatCoords(lat, lon) {
    const f = (v, pos, neg) => `${Math.abs(v).toFixed(2)}° ${v >= 0 ? pos : neg}`;
    return `${f(lat, 'N', 'S')}, ${f(lon, 'E', 'W')}`;
  }

  /** Google Maps search for the park itself, not just the coordinates. */
  function mapsUrl(park) {
    const name = park.id === 'american-samoa'
      ? 'National Park of American Samoa'
      : `${park.name} National Park`;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}`;
  }

  /** The park's official page on nps.gov. */
  function npsUrl(park) {
    return park.npsCode ? `https://www.nps.gov/${park.npsCode}/index.htm` : null;
  }

  NPT.ParkMap = Object.freeze({ create, drawStates, formatCoords, mapsUrl, npsUrl });
})(window.NPT = window.NPT || {});
