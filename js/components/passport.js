/**
 * Passport — the Passport view: every park as an entry in a park passport,
 * with a round photo, its name, state and year established. Visited parks get
 * the red stamp. Parks outside the current filter fade. Clicking an entry
 * opens the park dialog.
 */
(function (NPT) {
  'use strict';

  const NEW_SINCE = new Date().getFullYear() - 1; // parks established last year or this year get a "New" tag

  function create(gridEl, parks, { onSelect }) {
    const entries = new Map(); // id → { li, button }

    const frag = document.createDocumentFragment();
    parks.forEach((park) => {
      const li = document.createElement('li');
      li.className = 'pp';
      li.classList.toggle('is-visited', park.visited);

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'pp__btn';
      button.dataset.id = park.id;
      button.setAttribute('aria-haspopup', 'dialog');
      button.setAttribute('aria-label',
        `${park.name} National Park, ${NPT.utils.formatList(park.states)}, established ${park.established}${park.visited ? ', visited' : ''}`);

      const isNew = park.established >= NEW_SINCE;
      button.innerHTML =
        '<span class="pp__photo" aria-hidden="true"></span>' +
        '<span class="pp__name" aria-hidden="true"></span>' +
        '<span class="pp__meta" aria-hidden="true"></span>' +
        (isNew ? `<span class="pp__new" aria-hidden="true">New in ${park.established}</span>` : '') +
        '<span class="stamp stamp--passport" aria-hidden="true"><span class="stamp__label">Visited</span></span>';
      button.querySelector('.pp__photo').style.backgroundImage =
        `url("${park.thumb}"), url("${NPT.data.placeholder}")`;
      button.querySelector('.pp__name').textContent = park.name;
      button.querySelector('.pp__meta').textContent =
        `${park.codes.length ? park.codes.join(' · ') : park.states[0]} · Est. ${park.established}`;

      li.append(button);
      frag.append(li);
      entries.set(park.id, { li, button });
    });
    gridEl.append(frag);

    gridEl.addEventListener('click', (event) => {
      const button = event.target.closest('.pp__btn');
      if (button) onSelect(button.dataset.id);
    });

    return {
      applyFilter(matchIds) {
        entries.forEach(({ li }, id) => li.classList.toggle('is-dimmed', matchIds !== null && !matchIds.has(id)));
      },
      focusItem(id) { entries.get(id)?.button.focus(); },
      has: (id) => entries.has(id),
    };
  }

  NPT.Passport = Object.freeze({ create });
})(window.NPT = window.NPT || {});
