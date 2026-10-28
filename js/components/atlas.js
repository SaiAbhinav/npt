/**
 * Atlas — the Map view: every park on one map of the U.S., with Alaska,
 * Hawaii and the territories in their usual insets. Two ways to show parks:
 *
 *   Tiles  each park's photo tile on a hex grid, as close to the park's real
 *          location as the grid allows (a hex map). Tiles grow as you zoom
 *          in, and names appear once there's room.
 *   Pins   each park's boundary and a pin at its real location: filled for
 *          visited parks, an open ring for the rest.
 *
 * Parks outside the current filter fade. Searching zooms to the matching
 * parks. Zoom and pan come from NPT.Viewport.
 */
(function (NPT) {
  'use strict';

  const LABEL_LIMIT = 10;    // label every match when a search finds this many or fewer
  const LABEL_ZOOM = 4;      // ...or when zoomed in at least this far (pins)
  const CELL = 37;           // hex tile width in map units (the map is 960 × 600)
  const TILE_GAP = 4;        // px between tiles
  const TILE_MAX = 200;      // px; tiles stop growing past this when zoomed far in
  const NAME_MIN = 46;       // px; below this tiles show names only on hover
  const STAMP_MIN = 32;      // px; below this the visited stamp is hidden (visited tiles stay bright)
  const SQ3 = Math.sqrt(3);

  /**
   * Give every park its own hex cell, as near its real position as possible:
   * consider every (park, nearby cell) pair, nearest first, and take each
   * pair whose park and cell are both still free.
   */
  function assignCells(items) {
    const row = CELL * SQ3 / 2;
    const centre = (r, c) => [c * CELL + (r & 1 ? CELL / 2 : 0), r * row];
    const pairs = [];
    items.forEach((item) => {
      const [px, py] = item.info.pin;
      const r0 = Math.round(py / row);
      for (let r = r0 - 6; r <= r0 + 6; r += 1) {
        const c0 = Math.round((px - (r & 1 ? CELL / 2 : 0)) / CELL);
        for (let c = c0 - 6; c <= c0 + 6; c += 1) {
          const [x, y] = centre(r, c);
          pairs.push([Math.hypot(x - px, y - py), item, `${r},${c}`, x, y]);
        }
      }
    });
    pairs.sort((a, b) => a[0] - b[0]);
    const taken = new Set();
    for (const [, item, key, x, y] of pairs) {
      if (item.cell || taken.has(key)) continue;
      taken.add(key);
      item.cell = [x, y];
    }
  }

  function create(el, parks, { onSelect }) {
    const data = window.NPT_MAP;
    if (!data) {
      el.innerHTML = '<p class="atlas__missing">The map data (js/data/us-map.js) didn’t load.</p>';
      return { applyFilter() {}, activate() {}, focusItem() {}, has: () => false };
    }

    el.setAttribute('role', 'group');
    el.setAttribute('aria-roledescription', 'map');
    el.setAttribute('aria-label', 'Map of all national parks. Use plus and minus to zoom, arrow keys to move, and 0 to reset. Tab to reach each park.');
    el.dataset.mode = 'tiles';
    el.innerHTML =
      '<svg class="map-svg" aria-hidden="true" preserveAspectRatio="xMidYMid meet">' +
        '<g class="atlas__states"></g><g class="atlas__areas"></g>' +
      '</svg>' +
      '<div class="atlas__tiles"></div>' +
      '<div class="atlas__pins"></div>' +
      '<fieldset class="map-ui atlas__mode">' +
        '<legend class="visually-hidden">Show parks as</legend>' +
        '<label><input type="radio" name="atlas-mode" value="tiles" checked><span>Tiles</span></label>' +
        '<label><input type="radio" name="atlas-mode" value="pins"><span>Pins</span></label>' +
      '</fieldset>' +
      '<p class="atlas__legend" aria-hidden="true">' +
        '<span class="atlas__key atlas__key--visited"></span><span data-count="visited"></span>' +
        '<span class="atlas__key"></span><span data-count="left"></span>' +
      '</p>';

    const svg = el.querySelector('svg');
    const statesLayer = svg.querySelector('.atlas__states');
    const areasLayer = svg.querySelector('.atlas__areas');
    const tilesLayer = el.querySelector('.atlas__tiles');
    const pinsLayer = el.querySelector('.atlas__pins');

    Object.keys(data.groups).forEach((g) => NPT.ParkMap.drawStates(statesLayer, data, g));

    const label = (park) => `${park.name} National Park, ${NPT.utils.formatList(park.states)}${park.visited ? ', visited' : ''}`;
    const items = new Map(); // id → { park, info, pin, area, tile, cell }
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
      pin.setAttribute('aria-label', label(park));
      pin.innerHTML = '<span class="map-pin__dot" aria-hidden="true"></span><span class="map-pin__label" aria-hidden="true"></span>';
      pin.lastChild.textContent = park.name;
      pinsLayer.append(pin);

      const tile = document.createElement('button');
      tile.type = 'button';
      tile.className = 'map-tile';
      tile.classList.toggle('is-visited', park.visited);
      tile.dataset.id = park.id;
      tile.setAttribute('aria-haspopup', 'dialog');
      tile.setAttribute('aria-label', label(park));
      tile.innerHTML =
        '<span class="map-tile__hex" aria-hidden="true"></span>' +
        '<span class="map-tile__name" aria-hidden="true"></span>' +
        '<span class="stamp stamp--tile" aria-hidden="true"><span class="stamp__label">Visited</span></span>';
      tile.firstChild.style.backgroundImage = `url("${park.thumb}"), url("${NPT.data.placeholder}")`;
      tile.querySelector('.map-tile__name').textContent = park.name;
      tilesLayer.append(tile);

      items.set(park.id, { park, info, pin, area, tile, cell: null });
    });
    assignCells([...items.values()]);

    const visited = parks.filter((p) => p.visited).length;
    el.querySelector('[data-count="visited"]').textContent = `${visited} visited`;
    el.querySelector('[data-count="left"]').textContent = `${parks.length - visited} to go`;

    let labelAll = false;
    const mode = () => el.dataset.mode;
    const home = [0, 0, data.width, data.height];
    const vp = NPT.Viewport.create(el, {
      maxZoomIn: 14,
      onRender(view) {
        svg.setAttribute('viewBox', view.join(' '));
        if (mode() === 'tiles') {
          const k = el.clientWidth / view[2];           // px per map unit
          const w = Math.min(TILE_MAX, CELL * k - TILE_GAP);
          tilesLayer.style.setProperty('--w', `${w}px`);
          tilesLayer.classList.toggle('is-small', w < NAME_MIN);
          tilesLayer.classList.toggle('is-tiny', w < STAMP_MIN);
          items.forEach(({ cell, tile }) => {
            tile.style.left = `${((cell[0] - view[0]) / view[2]) * 100}%`;
            tile.style.top = `${((cell[1] - view[1]) / view[3]) * 100}%`;
          });
        } else {
          const zoomed = data.width / view[2] >= LABEL_ZOOM;
          items.forEach(({ info, pin }) => {
            NPT.placePin(pin, info.pin, view);
            pin.classList.toggle('show-label', (labelAll || zoomed) && !pin.classList.contains('is-dimmed'));
          });
        }
      },
    });
    vp.setLimits({ home, area: home });
    new ResizeObserver(() => vp.redraw()).observe(el);

    el.addEventListener('click', (event) => {
      const target = event.target.closest('.atlas__pin, .map-tile');
      if (target) onSelect(target.dataset.id);
    });

    el.querySelectorAll('input[name="atlas-mode"]').forEach((input) => {
      input.addEventListener('change', () => {
        if (!input.checked) return;
        el.dataset.mode = input.value;
        vp.redraw();
      });
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
      const grow = (x0, y0, x1, y1) => {
        box = [Math.min(box[0], x0), Math.min(box[1], y0), Math.max(box[2], x1), Math.max(box[3], y1)];
      };
      matches.forEach((id) => {
        const item = items.get(id);
        if (!item) return;
        const v = item.info.view;
        grow(v[0], v[1], v[0] + v[2], v[1] + v[3]);
        const [cx, cy] = item.cell;
        grow(cx - CELL, cy - CELL, cx + CELL, cy + CELL);
      });
      vp.fit(box, { pad: 0.05, minWidth: mode() === 'tiles' ? 220 : 110, ms: isShown() ? 480 : 0 });
    }

    return {
      /** @param {Set|null} ids  parks to keep bright; @param {string} q  the search text */
      applyFilter(ids, q = '') {
        const queryChanged = q.trim() !== query;
        matches = ids;
        query = q.trim();
        labelAll = Boolean(query) && ids !== null && ids.size > 0 && ids.size <= LABEL_LIMIT;
        items.forEach(({ pin, area, tile }, id) => {
          const dim = ids !== null && !ids.has(id);
          pin.classList.toggle('is-dimmed', dim);
          area.classList.toggle('is-dimmed', dim);
          tile.classList.toggle('is-dimmed', dim);
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
      focusItem(id) {
        const item = items.get(id);
        (mode() === 'tiles' ? item?.tile : item?.pin)?.focus();
      },
      has: (id) => items.has(id),
    };
  }

  NPT.Atlas = Object.freeze({ create });
})(window.NPT = window.NPT || {});
