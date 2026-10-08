/**
 * Atlas — the Map view: every park on one map of the U.S., with Alaska,
 * Hawaii and the territories in their usual insets.
 *
 * Each park shows its boundary and a pin: filled for visited parks, an open
 * ring for the rest. Parks outside the current filter fade. Searching zooms to
 * the matching parks. Zoom and pan come from NPT.Viewport.
 */
(function (NPT) {
  'use strict';

  const LABEL_LIMIT = 10;   // label every match when a search finds this many or fewer
  const LABEL_ZOOM = 4;     // ...or when zoomed in at least this far

  function create(el, parks, { onSelect }) {
    const data = window.NPT_MAP;
    if (!data) {
      el.innerHTML = '<p class="atlas__missing">The map data (js/data/us-map.js) didn’t load.</p>';
      return { applyFilter() {}, activate() {}, focusItem() {}, has: () => false };
    }

    el.setAttribute('role', 'group');
    el.setAttribute('aria-roledescription', 'map');
    el.setAttribute('aria-label', 'Map of all national parks. Use plus and minus to zoom, arrow keys to move, and 0 to reset. Tab to reach each park.');
    el.innerHTML =
      '<svg class="map-svg" aria-hidden="true" preserveAspectRatio="xMidYMid meet">' +
        '<g class="atlas__states"></g><g class="atlas__areas"></g>' +
      '</svg>' +
      '<div class="atlas__pins"></div>' +
      '<p class="atlas__legend" aria-hidden="true">' +
        '<span class="atlas__key atlas__key--visited"></span><span data-count="visited"></span>' +
        '<span class="atlas__key"></span><span data-count="left"></span>' +
      '</p>';

    const svg = el.querySelector('svg');
    const statesLayer = svg.querySelector('.atlas__states');
    const areasLayer = svg.querySelector('.atlas__areas');
    const pinsLayer = el.querySelector('.atlas__pins');

    Object.keys(data.groups).forEach((g) => NPT.ParkMap.drawStates(statesLayer, data, g));

    const items = new Map(); // id → { park, info, pin, area }
    parks.forEach((park) => {
      const info = data.parks[park.id];
      if (!info) return;
      const area = NPT.svg('path', { d: info.area, class: `map-area atlas__area${park.visited ? ' is-visited' : ''}` });
      areasLayer.append(area);

      const pin = document.createElement('button');
      pin.type = 'button';
      pin.className = 'map-pin atlas__pin';
      pin.classList.toggle('is-visited', park.visited);
      pin.dataset.id = park.id;
      pin.setAttribute('aria-haspopup', 'dialog');
      pin.setAttribute('aria-label',
        `${park.name} National Park, ${NPT.utils.formatList(park.states)}${park.visited ? ', visited' : ''}`);
      pin.innerHTML = '<span class="map-pin__dot" aria-hidden="true"></span><span class="map-pin__label" aria-hidden="true"></span>';
      pin.lastChild.textContent = park.name;
      pinsLayer.append(pin);

      items.set(park.id, { park, info, pin, area });
    });

    const visited = parks.filter((p) => p.visited).length;
    el.querySelector('[data-count="visited"]').textContent = `${visited} visited`;
    el.querySelector('[data-count="left"]').textContent = `${parks.length - visited} to go`;

    let labelAll = false;
    const home = [0, 0, data.width, data.height];
    const vp = NPT.Viewport.create(el, {
      maxZoomIn: 14,
      onRender(view) {
        svg.setAttribute('viewBox', view.join(' '));
        const zoomed = data.width / view[2] >= LABEL_ZOOM;
        items.forEach(({ info, pin }) => {
          NPT.placePin(pin, info.pin, view);
          pin.classList.toggle('show-label', (labelAll || zoomed) && !pin.classList.contains('is-dimmed'));
        });
      },
    });
    vp.setLimits({ home, area: home });

    pinsLayer.addEventListener('click', (event) => {
      const pin = event.target.closest('.atlas__pin');
      if (pin) onSelect(pin.dataset.id);
    });

    let matches = null;   // Set of ids, or null when nothing is filtered
    let query = '';
    let needsFit = true;
    const isShown = () => el.offsetParent !== null;

    /** Zoom to the parks a search found; back out when the search clears. */
    function fitToMatches() {
      needsFit = false;
      if (!query || !matches || !matches.size) { vp.reset(isShown() ? 420 : 0); return; }
      let box = [Infinity, Infinity, -Infinity, -Infinity];
      matches.forEach((id) => {
        const v = items.get(id)?.info.view;
        if (!v) return;
        box = [Math.min(box[0], v[0]), Math.min(box[1], v[1]), Math.max(box[2], v[0] + v[2]), Math.max(box[3], v[1] + v[3])];
      });
      vp.fit(box, { pad: 0.05, minWidth: 90, ms: isShown() ? 480 : 0 });
    }

    return {
      /** @param {Set|null} ids  parks to keep bright; @param {string} q  the search text */
      applyFilter(ids, q = '') {
        const queryChanged = q.trim() !== query;
        matches = ids;
        query = q.trim();
        labelAll = Boolean(query) && ids !== null && ids.size > 0 && ids.size <= LABEL_LIMIT;
        items.forEach(({ pin, area }, id) => {
          const dim = ids !== null && !ids.has(id);
          pin.classList.toggle('is-dimmed', dim);
          area.classList.toggle('is-dimmed', dim);
        });
        if (queryChanged) needsFit = true;
        if (isShown() && needsFit) fitToMatches();
        else vp.redraw();
      },
      /** Call when the Map view becomes visible. */
      activate() {
        if (!vp.view) vp.reset(0);
        if (needsFit) fitToMatches();
        else vp.redraw();
      },
      focusItem(id) { items.get(id)?.pin.focus(); },
      has: (id) => items.has(id),
    };
  }

  NPT.Atlas = Object.freeze({ create });
})(window.NPT = window.NPT || {});
