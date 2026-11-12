import { fetchIncidents, ack } from './api.js';
import { formatLocal, sortNewestFirst, escapeHtml } from './board.js';

const REFRESH_MS = 2000; // R4

const board = document.querySelector('[data-testid="board"]');
const list = document.querySelector('[data-testid="incident-list"]');
const loader = document.querySelector('[data-testid="loader"]');
const empty = document.querySelector('[data-testid="empty"]');
const status = document.querySelector('.status');

const acked = new Map(); // id -> ackedAt, survives every refresh
const pending = new Set(); // ids with an ack in flight

function rowHtml(i) {
  const id = escapeHtml(i.id);
  const isAcked = acked.has(i.id);
  const action = isAcked
    ? `<span data-testid="acked" class="acked">acked</span>`
    : `<button type="button" data-testid="ack" data-id="${id}"${pending.has(i.id) ? ' disabled' : ''}>Ack</button>`;
  return `<li data-testid="incident-row" data-id="${id}" class="row ${escapeHtml(i.severity)}${isAcked ? ' is-acked' : ''}">
    <span class="id">${id}</span>
    <span class="sev">${escapeHtml(i.severity)}</span>
    <span class="what">${escapeHtml(i.service)} · ${escapeHtml(i.region)} · ${escapeHtml(i.summary)}</span>
    <time datetime="${escapeHtml(i.openedAt)}" title="${escapeHtml(i.openedAt)}">${escapeHtml(formatLocal(i.openedAt))}</time>
    <span class="action">${action}</span>
  </li>`;
}

let latest = [];
function render(incidents) {
  latest = sortNewestFirst(incidents);
  list.innerHTML = latest.map(rowHtml).join('');
  empty.hidden = latest.length > 0;
  list.hidden = latest.length === 0;
}

// Ack by the id on the clicked button, never by row position (R2).
list.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-testid="ack"]');
  if (!btn) return;
  const id = btn.dataset.id;
  pending.add(id);
  btn.disabled = true;
  try {
    const reply = await ack(id);
    acked.set(id, reply.ackedAt);
  } catch (err) {
    console.error(err);
    status.textContent = `Ack failed for ${id}. Try again.`;
  } finally {
    pending.delete(id);
    render(latest);
  }
});

async function refresh() {
  try {
    const page = await fetchIncidents();
    render(page.incidents);
    loader.hidden = true; // R3: gone once incidents are on screen
    board.setAttribute('aria-busy', 'false');
    status.textContent = `Updated ${formatLocal(page.updatedAt)}`;
  } catch (err) {
    console.error(err);
    status.textContent = 'Could not reach the incident API. Retrying…';
  } finally {
    setTimeout(refresh, REFRESH_MS); // R4: one request at a time, every 2 s
  }
}

refresh();
