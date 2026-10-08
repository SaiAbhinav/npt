/**
 * Park list — the List view: one row per park with its photo, name, region,
 * states, year established and visited stamp. Parks that don't match the
 * current filter are hidden. Clicking a row opens the park dialog.
 */
(function (NPT) {
  'use strict';

  function create(listEl, parks, { onSelect }) {
    const rows = new Map(); // id → { li, button }

    const frag = document.createDocumentFragment();
    parks.forEach((park) => {
      const li = document.createElement('li');
      li.className = 'park-row';
      li.classList.toggle('is-visited', park.visited);

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'park-row__btn';
      button.dataset.id = park.id;
      button.setAttribute('aria-haspopup', 'dialog');
      button.setAttribute('aria-label',
        `${park.name} National Park, ${NPT.utils.formatList(park.states)}, established ${park.established}${park.visited ? ', visited' : ''}`);

      const thumb = document.createElement('span');
      thumb.className = 'park-row__thumb';
      thumb.setAttribute('aria-hidden', 'true');
      thumb.style.backgroundImage = `url("${park.thumb}"), url("${NPT.data.placeholder}")`;

      const main = document.createElement('span');
      main.className = 'park-row__main';
      main.innerHTML = '<span class="park-row__name"></span><span class="park-row__region"></span>';
      main.firstChild.textContent = park.name;
      main.lastChild.textContent = park.region;

      const states = document.createElement('span');
      states.className = 'park-row__states tags';
      park.states.forEach((state, i) => {
        const pill = document.createElement('span');
        pill.className = 'tag';
        if (park.codes[i]) {
          const abbr = document.createElement('abbr');
          abbr.textContent = park.codes[i];
          pill.append(abbr);
        }
        pill.append(state);
        states.append(pill);
      });

      const year = document.createElement('span');
      year.className = 'park-row__year';
      year.textContent = park.established;

      const status = document.createElement('span');
      status.className = 'park-row__status';
      status.innerHTML = '<span class="stamp stamp--row"><span class="stamp__label">Visited</span></span>';

      button.append(thumb, main, states, year, status);
      li.append(button);
      frag.append(li);
      rows.set(park.id, { li, button });
    });
    listEl.append(frag);

    listEl.addEventListener('click', (event) => {
      const button = event.target.closest('.park-row__btn');
      if (button) onSelect(button.dataset.id);
    });

    return {
      applyFilter(matchIds) {
        rows.forEach(({ li }, id) => { li.hidden = matchIds !== null && !matchIds.has(id); });
      },
      focusItem(id) { rows.get(id)?.button.focus(); },
      has: (id) => rows.has(id),
    };
  }

  NPT.ParkList = Object.freeze({ create });
})(window.NPT = window.NPT || {});
