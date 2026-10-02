/**
 * Search & filter — free-text search (park, state, state code or region)
 * plus the All / Visited switch.
 */
(function (NPT) {
  'use strict';

  const { normalize } = NPT.utils;

  /** Does a park match the query? Every word must appear; "UT" style codes match exactly. */
  function matches(park, query) {
    const q = normalize(query);
    if (!q) return true;
    if (/^[a-z]{2}$/.test(q) && NPT.data.isStateCode(q)) {
      return park.codes.some((code) => code.toLowerCase() === q);
    }
    return q.split(' ').every((word) => park.searchText.includes(word));
  }

  function create({ input, clearButton, datalist, statusInputs, suggestions, onChange }) {
    // Start from whatever the markup says is checked (Visited by default).
    const checked = [...statusInputs].find((radio) => radio.checked);
    const state = { query: input.value, status: checked ? checked.value : 'all' };

    datalist.replaceChildren(...[...new Set(suggestions)].map((value) => {
      const option = document.createElement('option');
      option.value = value;
      return option;
    }));

    function emit() {
      onChange({ ...state });
    }

    function setQuery(value) {
      input.value = value;
      state.query = value;
      emit();
    }

    input.addEventListener('input', () => {
      state.query = input.value;
      emit();
    });

    input.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && input.value) {
        event.preventDefault();
        setQuery('');
      }
    });

    clearButton.addEventListener('click', () => {
      setQuery('');
      input.focus();
    });

    statusInputs.forEach((radio) => {
      radio.addEventListener('change', () => {
        if (!radio.checked) return;
        state.status = radio.value;
        emit();
      });
    });

    return {
      getState: () => ({ ...state }),
      setQuery,
      focus: () => input.focus(),
    };
  }

  NPT.Search = Object.freeze({ create, matches });
})(window.NPT = window.NPT || {});
