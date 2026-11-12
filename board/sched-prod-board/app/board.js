// Pure helpers for the board: no DOM, no network, so they can be unit-tested in Node.

/** An incident time in the viewer's own zone and date order (R5). locale/timeZone default to the viewer's. */
export function formatLocal(iso, locale, timeZone) {
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
    timeZoneName: 'short',
  }).format(new Date(iso));
}

/** Newest first by openedAt (R1). Returns a new array. */
export function sortNewestFirst(incidents) {
  return [...incidents].sort((a, b) => Date.parse(b.openedAt) - Date.parse(a.openedAt));
}

export function escapeHtml(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
