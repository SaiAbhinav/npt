/**
 * Visit store — remembers which parks are visited (and when) in localStorage,
 * and notifies subscribers on every change. Also syncs across open tabs.
 */
(function (NPT) {
  'use strict';

  const KEY = 'npt.visits.v1';
  const listeners = new Set();
  let visits = read(); // { [parkId]: ISO date string }

  function read() {
    try {
      const data = JSON.parse(localStorage.getItem(KEY) || '{}');
      return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
    } catch {
      return {};
    }
  }

  function write() {
    try {
      localStorage.setItem(KEY, JSON.stringify(visits));
    } catch {
      /* Storage can be blocked (private mode); visits still work for this session. */
    }
  }

  function emit(id) {
    listeners.forEach((fn) => fn(id));
  }

  const store = {
    isVisited: (id) => Object.prototype.hasOwnProperty.call(visits, id),
    visitedOn: (id) => visits[id] || null,
    count: () => Object.keys(visits).length,

    setVisited(id, visited) {
      if (visited === store.isVisited(id)) return;
      if (visited) visits[id] = new Date().toISOString();
      else delete visits[id];
      write();
      emit(id);
    },

    toggle(id) {
      store.setVisited(id, !store.isVisited(id));
    },

    /** fn(id) — id is null when everything may have changed (another tab). */
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };

  window.addEventListener('storage', (event) => {
    if (event.key !== KEY) return;
    visits = read();
    emit(null);
  });

  NPT.store = Object.freeze(store);
})(window.NPT = window.NPT || {});
