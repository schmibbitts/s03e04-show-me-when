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

/**
 * Keyed update plan for the list: which rows to create and which to remove, and the final order
 * (newest first). Rows that stay are kept as they are, so the DOM never drops a row that is still live.
 */
export function reconcile(currentIds, incidents) {
  const order = sortNewestFirst(incidents).map((i) => i.id);
  const have = new Set(currentIds);
  const want = new Set(order);
  return {
    order,
    create: order.filter((id) => !have.has(id)),
    remove: currentIds.filter((id) => !want.has(id)),
  };
}

/** What the Ack confirm says: it names the incident id first, so a moved row cannot be acked unseen. */
export function confirmText(i) {
  return `Ack ${i.id}? ${i.severity} · ${i.service} · ${i.summary}`;
}
