/**
 * App — wires the data and components together.
 * Visited parks come from data/visited.js; nothing is saved in the browser.
 */
(function (NPT) {
  'use strict';

  function init() {
    const { parks, states } = NPT.data;
    const { utils } = NPT;
    const isVisited = (id) => parks.some((p) => p.id === id && p.visited);
    const $ = (selector) => document.querySelector(selector);

    // Parks in the 50 states form the big hexagon; territories get their own row.
    const stateParks = parks.filter((p) => !p.isTerritory);
    const territoryParks = parks.filter((p) => p.isTerritory);
    const ordered = [...stateParks, ...territoryParks]; // display order, used for Prev / Next
    const total = parks.length;

    const els = {
      statsLine: $('#stats-line'),
      visitedCount: $('#visited-count'),
      totalCount: $('#total-count'),
      bar: $('#visited-bar'),
      results: $('#results'),
      search: $('#park-search'),
      dialog: $('#park-dialog'),
      territoriesCount: $('#territories-count'),
    };

    let filters = { query: '', status: 'all' };
    let browseList = ordered; // parks matching the current filter, in display order

    /* Components */
    const modal = NPT.ParkModal.create(els.dialog, {
      parks: ordered,
      // Return focus to the tile of the park last shown (it may differ after Prev/Next).
      onClose: (id) => id && boards.forEach((b) => b.has(id) && b.focusTile(id)),
    });

    const onSelect = (id) => modal.open(id, browseList);
    const boards = [
      NPT.Honeycomb.create($('#honeycomb'), stateParks, { isVisited, onSelect }),
      NPT.Honeycomb.create($('#territories'), territoryParks, { isVisited, onSelect, layout: 'row' }),
    ];

    const search = NPT.Search.create({
      input: els.search,
      clearButton: $('.searchbar__clear'),
      datalist: $('#search-suggestions'),
      statusInputs: document.querySelectorAll('input[name="status"]'),
      suggestions: [...parks.map((p) => p.name), ...states],
      onChange: (next) => {
        filters = next;
        applyFilters();
      },
    });

    filters = search.getState();

    /* Filtering */
    function applyFilters() {
      const query = filters.query.trim();
      const active = Boolean(query) || filters.status !== 'all';
      const matched = parks.filter((p) =>
        NPT.Search.matches(p, query) && (filters.status === 'all' || p.visited));
      const ids = active ? new Set(matched.map((p) => p.id)) : null;
      browseList = ids ? ordered.filter((p) => ids.has(p.id)) : ordered;

      boards.forEach((b) => b.applyFilter(ids));
      els.results.innerHTML = describe(matched.length, query);
    }

    function describe(count, query) {
      const escape = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
      const visitedOnly = filters.status === 'visited';
      const noun = `${visitedOnly ? 'visited ' : ''}park${count === 1 ? '' : 's'}`;

      if (!query && !visitedOnly) return `Showing all <strong>${total}</strong> parks`;
      if (count === 0) {
        return query
          ? `No ${visitedOnly ? 'visited ' : ''}parks match “${escape(query)}”.`
          : NPT.data.visitedFileOk
            ? 'No visited parks yet. Add parks to data/visited.js to stamp them.'
            : 'Couldn’t read data/visited.js. Check it for a missing comma or quote, then reload.';
      }
      return query
        ? `<strong>${count}</strong> ${noun} ${count === 1 ? 'matches' : 'match'} “${escape(query)}”`
        : `<strong>${count}</strong> ${noun}`;
    }

    /* Progress */
    function updateProgress() {
      const visited = parks.filter((p) => p.visited).length;
      els.visitedCount.textContent = visited;
      els.bar.setAttribute('aria-valuenow', visited);
      els.bar.setAttribute('aria-valuetext', `${utils.plural(visited, 'park')} of ${total} visited`);
      els.bar.style.setProperty('--progress', `${(visited / total) * 100}%`);
    }

    /* "/" jumps to search */
    document.addEventListener('keydown', (event) => {
      const typing = event.target.closest('input, textarea, [contenteditable]');
      if (event.key === '/' && !typing && !els.dialog.open) {
        event.preventDefault();
        search.focus();
      }
    });

    /* Static counts, derived from the data */
    const stateCount = new Set(stateParks.flatMap((p) => p.states)).size;
    const territoryCount = new Set(territoryParks.flatMap((p) => p.states)).size;
    els.statsLine.textContent = [
      utils.plural(total, 'park'),
      utils.plural(stateCount, 'state'),
      territoryCount === 1 ? '1 territory' : `${territoryCount} territories`,
    ].join(' · ');
    els.territoriesCount.textContent = utils.plural(territoryParks.length, 'park');
    els.totalCount.textContent = total;
    els.bar.setAttribute('aria-valuemax', total);

    updateProgress();
    applyFilters();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window.NPT = window.NPT || {});
