/**
 * Shared helpers. Every script attaches to the single window.NPT namespace.
 */
(function (NPT) {
  'use strict';

  // Diacritics plus the Hawaiian ʻokina and apostrophes, so "hawaii" finds "Hawaiʻi".
  const MARKS = /[̀-ͯʻʼ‘’']/g;

  /** Lowercase, accent-free, single-spaced text for matching. */
  function normalize(value) {
    return String(value ?? '')
      .normalize('NFD')
      .replace(MARKS, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  /** "Wrangell–St. Elias" → "wrangell-st-elias" */
  function slugify(value) {
    return normalize(value).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }

  /** ["Wyoming", "Montana", "Idaho"] → "Wyoming, Montana, and Idaho" */
  function formatList(items) {
    try {
      return new Intl.ListFormat('en', { style: 'long', type: 'conjunction' }).format(items);
    } catch {
      return items.join(', ');
    }
  }

  /** ISO string → "Oct 2, 2026" */
  function formatDate(iso) {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function plural(count, word) {
    return `${count} ${word}${count === 1 ? '' : 's'}`;
  }

  NPT.utils = Object.freeze({ normalize, slugify, formatList, formatDate, plural });
})(window.NPT = window.NPT || {});
