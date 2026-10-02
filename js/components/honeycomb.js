/**
 * Honeycomb — renders pointy-top hexagon tiles and lays them out.
 *
 * Wide screens:   one big hexagon. The 61 parks in U.S. states fill a
 *                 radius-4 hexagon exactly (rows 5·6·7·8·9·8·7·6·5). Any other
 *                 count still works: leftovers flank the middle rows in pairs.
 * Narrow screens: a centered honeycomb that alternates rows of N and N-1,
 *                 so tiles stay big enough to read and tap.
 */
(function (NPT) {
  'use strict';

  const SQRT3 = Math.sqrt(3);
  const CONFIG = Object.freeze({
    gap: 6,            // px between neighbouring hexagons
    minHexTile: 84,    // smallest tile width allowed in the big-hexagon layout
    minFlowTile: 104,  // smallest tile width in the narrow-screen layout
    maxTile: 150,      // tiles never grow past this
  });

  /* ---------- Layout maths (pure functions) ---------- */

  /** Row lengths for the big hexagon, with leftovers added in pairs around the middle row. */
  function bigHexagonRows(count) {
    if (count <= 0) return [];
    let radius = 0;
    while (3 * (radius + 1) * (radius + 2) + 1 <= count) radius += 1;

    const rows = [];
    for (let r = -radius; r <= radius; r += 1) rows.push(2 * radius + 1 - Math.abs(r));

    // Middle row first, then rows moving outward: middle, middle-1, middle+1, …
    const order = [radius];
    for (let d = 1; d <= radius; d += 1) order.push(radius - d, radius + d);

    let extra = count - (3 * radius * (radius + 1) + 1);
    for (let k = 0; extra > 0; k += 1) {
      const add = Math.min(2, extra);
      rows[order[k % order.length]] += add;
      extra -= add;
    }
    return rows;
  }

  /** Alternating N / N-1 rows for narrow screens. */
  function flowRows(count, cols) {
    const rows = [];
    for (let left = count, long = true; left > 0; long = !long) {
      const n = Math.min(left, long ? cols : cols - 1);
      rows.push(n);
      left -= n;
    }
    return rows;
  }

  /**
   * Turn row lengths into slots {x, row}. x is measured in tile steps and is
   * centered on 0. Neighbouring rows must sit half a step apart, so a row whose
   * parity would collide with the previous one is nudged by half a step.
   */
  function rowsToSlots(rows) {
    const slots = [];
    let prevHalf = null;
    rows.forEach((n, row) => {
      let start = -(n - 1) / 2;
      let half = Math.abs(start % 1) === 0.5;
      if (prevHalf !== null && half === prevHalf) {
        start += 0.5;
        half = !half;
      }
      for (let i = 0; i < n; i += 1) slots.push({ x: start + i, row });
      prevHalf = half;
    });
    return slots;
  }

  function extent(slots) {
    let min = Infinity;
    let max = -Infinity;
    for (const { x } of slots) {
      if (x < min) min = x;
      if (x > max) max = x;
    }
    return { min, span: max - min };
  }

  /** Width of a tile when `span + 1` tiles must fit `available` px. */
  function tileFor(available, span) {
    return (available - span * CONFIG.gap) / (span + 1);
  }

  function computeLayout(count, available) {
    const hexSlots = rowsToSlots(bigHexagonRows(count));
    const hex = extent(hexSlots);
    const hexTile = tileFor(available, hex.span);
    if (hexTile >= CONFIG.minHexTile) {
      return { mode: 'hexagon', slots: hexSlots, minX: hex.min, tile: Math.min(hexTile, CONFIG.maxTile) };
    }

    const cols = Math.max(2, Math.floor((available + CONFIG.gap) / (CONFIG.minFlowTile + CONFIG.gap)));
    const flowSlots = rowsToSlots(flowRows(count, cols));
    const flow = extent(flowSlots);
    return {
      mode: 'flow',
      slots: flowSlots,
      minX: flow.min,
      tile: Math.min(tileFor(available, flow.span), CONFIG.maxTile),
    };
  }

  /* ---------- Component ---------- */

  /**
   * @param {HTMLElement} listEl  the <ul> to render into
   * @param {Array} parks
   * @param {object} options
   *   isVisited(id), onSelect(id)
   *   layout: 'auto' (default) positions tiles as a honeycomb and publishes
   *           --tile-w / --tile-h on the parent so other lists can match;
   *           'row' renders a simple centered row that inherits that size.
   */
  function create(listEl, parks, { isVisited, onSelect, layout: layoutMode = 'auto' }) {
    const container = listEl.parentElement;
    const tiles = new Map(); // id → { li, button, park }

    function label(park, visited) {
      const where = NPT.utils.formatList(park.states);
      return `${park.name} National Park, ${where}${visited ? ' — visited' : ''}`;
    }

    // Build tiles once; layout and state changes only touch classes/variables.
    const frag = document.createDocumentFragment();
    parks.forEach((park, index) => {
      const li = document.createElement('li');
      li.className = 'hex-tile';
      li.style.setProperty('--i', index);

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'hex';
      button.dataset.id = park.id;
      button.setAttribute('aria-haspopup', 'dialog');
      button.innerHTML =
        '<span class="hex__img" aria-hidden="true"></span>' +
        '<span class="hex__shade" aria-hidden="true"></span>' +
        '<span class="hex__name" aria-hidden="true"></span>' +
        '<span class="stamp stamp--tile" aria-hidden="true"><span class="stamp__label">Visited</span></span>';
      // The placeholder sits underneath, so a missing photo still shows something.
      button.querySelector('.hex__img').style.backgroundImage =
        `url("${park.thumb}"), url("${NPT.data.placeholder}")`;
      button.querySelector('.hex__name').textContent = park.name;

      li.append(button);
      frag.append(li);
      tiles.set(park.id, { li, button, park });
      setVisited(park.id, isVisited(park.id));
    });
    listEl.append(frag);

    listEl.addEventListener('click', (event) => {
      const button = event.target.closest('.hex');
      if (button) onSelect(button.dataset.id);
    });

    /* Layout */
    let lastWidth = -1;
    function layout() {
      const width = Math.floor(container.clientWidth);
      if (!width || width === lastWidth) return;
      lastWidth = width;

      const { slots, minX, tile, mode } = computeLayout(parks.length, width);
      const gap = CONFIG.gap;
      const h = (tile * 2) / SQRT3;
      const stepX = tile + gap;
      const stepY = ((tile + gap) * SQRT3) / 2;
      let maxX = 0;
      let maxRow = 0;

      parks.forEach((park, i) => {
        const slot = slots[i];
        const x = (slot.x - minX) * stepX;
        const y = slot.row * stepY;
        maxX = Math.max(maxX, x);
        maxRow = Math.max(maxRow, slot.row);
        const { li } = tiles.get(park.id);
        li.style.setProperty('--x', `${x.toFixed(2)}px`);
        li.style.setProperty('--y', `${y.toFixed(2)}px`);
      });

      listEl.dataset.layout = mode;
      // Tile size goes on the container so sibling lists (territories) match it.
      container.style.setProperty('--tile-w', `${tile.toFixed(2)}px`);
      container.style.setProperty('--tile-h', `${h.toFixed(2)}px`);
      listEl.style.setProperty('--hc-w', `${(maxX + tile).toFixed(2)}px`);
      listEl.style.setProperty('--hc-h', `${(maxRow * stepY + h).toFixed(2)}px`);
    }

    if (layoutMode === 'row') {
      listEl.classList.add('honeycomb--row');
    } else {
      let frame = 0;
      new ResizeObserver(() => {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(layout);
      }).observe(container);
      layout();
      // Enable position transitions only after the first paint, so tiles don't fly in from 0,0.
      requestAnimationFrame(() => requestAnimationFrame(() => listEl.classList.add('is-ready')));
    }

    /* Public API */
    function setVisited(id, visited) {
      const tile = tiles.get(id);
      if (!tile) return;
      tile.li.classList.toggle('is-visited', visited);
      tile.button.setAttribute('aria-label', label(tile.park, visited));
    }

    function applyFilter(matchIds) {
      tiles.forEach(({ li }, id) => {
        li.classList.toggle('is-dimmed', matchIds !== null && !matchIds.has(id));
      });
      listEl.classList.toggle('is-filtering', matchIds !== null);
    }

    function has(id) {
      return tiles.has(id);
    }

    function focusTile(id) {
      tiles.get(id)?.button.focus({ preventScroll: false });
    }

    return { setVisited, applyFilter, focusTile, has };
  }

  NPT.Honeycomb = Object.freeze({ create, computeLayout, bigHexagonRows });
})(window.NPT = window.NPT || {});
