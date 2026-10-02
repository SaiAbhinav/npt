/**
 * Park dialog — fills the native <dialog> with one park's details,
 * handles the visited toggle and previous/next browsing.
 *
 * Prev / Next cycle through the list passed to open() — the parks matching the
 * current filter — so browsing stays inside what the user is looking at.
 */
(function (NPT) {
  'use strict';

  function create(dialog, { parks, store, onClose }) {
    const card = dialog.querySelector('.park-card');
    const field = (name) => dialog.querySelector(`[data-field="${name}"]`);
    const refs = {
      image: field('image'),
      region: field('region'),
      name: field('name'),
      established: field('established'),
      age: field('age'),
      statesLabel: field('states-label'),
      states: field('states'),
      toggleLabel: field('toggle-label'),
      position: field('position'),
      prev: dialog.querySelector('[data-action="prev"]'),
      next: dialog.querySelector('[data-action="next"]'),
    };

    let list = parks; // the parks Prev / Next move through
    let index = -1;
    const current = () => list[index];

    function render() {
      const park = current();
      if (!park) return;
      const visited = store.isVisited(park.id);
      const years = new Date().getFullYear() - park.established;

      card.classList.toggle('is-visited', visited);
      card.dataset.park = park.id;

      if (refs.image.dataset.park !== park.id) {
        refs.image.dataset.park = park.id;
        refs.image.classList.add('is-loading');
        // Show the already-cached tile photo instantly, then swap in the large one.
        refs.image.src = park.thumb;
        const full = new Image();
        full.onload = () => {
          if (refs.image.dataset.park !== park.id) return;
          refs.image.src = park.image;
          refs.image.classList.remove('is-loading');
        };
        full.onerror = () => refs.image.classList.remove('is-loading');
        full.src = park.image;
      }
      refs.image.alt = `${park.name} National Park`;

      refs.region.textContent = park.region;
      refs.name.textContent = park.name;
      refs.established.textContent = park.established;
      refs.age.textContent = `· ${years} year${years === 1 ? '' : 's'} ago`;

      refs.statesLabel.textContent = park.isTerritory
        ? 'Territory'
        : park.states.length > 1 ? 'States' : 'State';
      refs.states.replaceChildren(...park.states.map((state, i) => {
        const li = document.createElement('li');
        const code = park.codes[i];
        if (code) {
          const abbr = document.createElement('abbr');
          abbr.title = state;
          abbr.textContent = code;
          abbr.setAttribute('aria-hidden', 'true');
          li.append(abbr);
        }
        li.append(state);
        return li;
      }));

      refs.toggleLabel.textContent = visited ? 'Mark as unvisited' : 'Mark as visited';
      refs.position.textContent = `${index + 1} of ${list.length}`;
      const single = list.length < 2;
      refs.prev.disabled = single;
      refs.next.disabled = single;
    }

    /**
     * @param {string} id      park to show
     * @param {Array} [browse] parks to cycle through; falls back to all parks
     *                         when omitted or when it doesn't include `id`.
     *                         It's a snapshot, so marking/unmarking a park while
     *                         the dialog is open doesn't reshuffle the order.
     */
    function open(id, browse) {
      list = browse && browse.some((p) => p.id === id) ? [...browse] : parks;
      const next = list.findIndex((p) => p.id === id);
      if (next < 0) return;
      index = next;
      render();
      if (!dialog.open) dialog.showModal();
    }

    function step(delta) {
      if (list.length < 2) return;
      index = (index + delta + list.length) % list.length;
      render();
    }

    dialog.addEventListener('click', (event) => {
      // A click on the dialog element itself is a click on the backdrop.
      if (event.target === dialog) return dialog.close();
      const action = event.target.closest('[data-action]')?.dataset.action;
      if (action === 'close') dialog.close();
      else if (action === 'toggle') store.toggle(current().id);
      else if (action === 'prev') step(-1);
      else if (action === 'next') step(1);
    });

    dialog.addEventListener('keydown', (event) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.key === 'ArrowLeft') { event.preventDefault(); step(-1); }
      if (event.key === 'ArrowRight') { event.preventDefault(); step(1); }
    });

    // A missing photo falls back to the placeholder.
    refs.image.addEventListener('error', () => {
      if (!refs.image.src.endsWith(NPT.data.placeholder)) refs.image.src = NPT.data.placeholder;
    });

    dialog.addEventListener('close', () => onClose?.(current()?.id));

    return {
      open,
      refresh: () => { if (dialog.open) render(); },
    };
  }

  NPT.ParkModal = Object.freeze({ create });
})(window.NPT = window.NPT || {});
