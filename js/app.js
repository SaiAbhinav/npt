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
    const ordered = [...stateParks, ...territoryParks]; // honeycomb order
    const total = parks.length;
    // Prev / Next follow the order of whichever view is showing.
    const ORDER = { honeycomb: ordered, list: parks, map: parks };
    const VIEWS = Object.keys(ORDER);

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
    let matchIds = null;       // Set of matching park ids, or null when nothing is filtered
    let view = 'honeycomb';

    const browseList = () => (matchIds ? ORDER[view].filter((p) => matchIds.has(p.id)) : ORDER[view]);

    /* Components */
    const modal = NPT.ParkModal.create(els.dialog, {
      parks: ordered,
      // Return focus to where the park was opened from (it may differ after Prev/Next).
      onClose: (id) => {
        if (!id) return;
        if (view === 'honeycomb') boards.forEach((b) => b.has(id) && b.focusTile(id));
        else if (view === 'list') list.focusItem(id);
        else atlas.focusItem(id);
      },
    });

    const onSelect = (id) => modal.open(id, browseList());
    const boards = [
      NPT.Honeycomb.create($('#honeycomb'), stateParks, { isVisited, onSelect }),
      NPT.Honeycomb.create($('#territories'), territoryParks, { isVisited, onSelect, layout: 'row' }),
    ];
    const list = NPT.ParkList.create($('#park-list'), parks, { onSelect });
    const atlas = NPT.Atlas.create($('#atlas'), parks, { onSelect });

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
      matchIds = active ? new Set(matched.map((p) => p.id)) : null;

      boards.forEach((b) => b.applyFilter(matchIds));
      list.applyFilter(matchIds);
      atlas.applyFilter(matchIds, query);
      els.results.innerHTML = describe(matched.length, query);
    }

    /* Views: Honeycomb / List / Map. The choice lives in the address
       (#list, #map) so a reload keeps it, without saving anything. */
    const viewInputs = document.querySelectorAll('input[name="view"]');
    const viewPanels = document.querySelectorAll('[data-view]');

    function setView(next, { updateUrl = true } = {}) {
      view = VIEWS.includes(next) ? next : 'honeycomb';
      viewPanels.forEach((panel) => { panel.hidden = panel.dataset.view !== view; });
      viewInputs.forEach((input) => { input.checked = input.value === view; });
      if (view === 'map') atlas.activate();
      if (updateUrl) {
        const hash = view === 'honeycomb' ? '' : `#${view}`;
        if (location.hash !== hash) history.replaceState(null, '', hash || location.pathname + location.search);
      }
    }

    viewInputs.forEach((input) => input.addEventListener('change', () => input.checked && setView(input.value)));
    window.addEventListener('hashchange', () => {
      const hash = location.hash.slice(1);
      if (hash === '' || VIEWS.includes(hash)) setView(hash, { updateUrl: false }); // ignore #parks etc.
    });

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
    setView(location.hash.slice(1), { updateUrl: false });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window.NPT = window.NPT || {});
