import { fetchIncidents, ack } from './api.js';
import { formatLocal, escapeHtml, reconcile, confirmText } from './board.js';

const REFRESH_MS = 2000; // R4

const board = document.querySelector('[data-testid="board"]');
const list = document.querySelector('[data-testid="incident-list"]');
const loader = document.querySelector('[data-testid="loader"]');
const empty = document.querySelector('[data-testid="empty"]');
const status = document.querySelector('.status');
const confirmBox = document.querySelector('[data-testid="confirm"]');
const confirmMsg = confirmBox.querySelector('.confirm-text');
const confirmAck = confirmBox.querySelector('[data-testid="confirm-ack"]');
const confirmCancel = confirmBox.querySelector('[data-testid="confirm-cancel"]');

const acked = new Map(); // id -> ackedAt, survives every refresh
const pending = new Set(); // ids with an ack in flight
const rows = new Map(); // id -> <li>, keyed so a refresh never rebuilds a live row
const byId = new Map(); // id -> latest incident data

function actionHtml(id) {
  if (acked.has(id)) return `<span data-testid="acked" class="acked">acked</span>`;
  return `<button type="button" data-testid="ack" data-id="${escapeHtml(id)}"${pending.has(id) ? ' disabled' : ''}>Ack</button>`;
}

function fill(li, i) {
  const key = JSON.stringify([i.severity, i.service, i.region, i.summary, i.openedAt]);
  if (li.dataset.key !== key) {
    li.dataset.key = key;
    li.className = `row ${escapeHtml(i.severity)}`;
    li.querySelector('.sev').textContent = i.severity;
    li.querySelector('.what').textContent = `${i.service} · ${i.region} · ${i.summary}`;
    const t = li.querySelector('time');
    t.dateTime = i.openedAt;
    t.title = i.openedAt;
    t.textContent = formatLocal(i.openedAt);
  }
  const state = acked.has(i.id) ? 'acked' : pending.has(i.id) ? 'pending' : 'open';
  if (li.dataset.state !== state) {
    li.dataset.state = state;
    li.classList.toggle('is-acked', state === 'acked');
    li.querySelector('.action').innerHTML = actionHtml(i.id);
  }
}

function createRow(i) {
  const li = document.createElement('li');
  li.setAttribute('data-testid', 'incident-row');
  li.dataset.id = i.id;
  li.innerHTML = `<span class="id"></span><span class="sev"></span><span class="what"></span><time></time><span class="action"></span>`;
  li.querySelector('.id').textContent = i.id;
  return li;
}

// R1: new incidents go in at the top live; rows that stay are updated in place, never rebuilt.
function render(incidents) {
  for (const i of incidents) byId.set(i.id, i);
  const ops = reconcile([...rows.keys()], incidents);
  for (const id of ops.remove) {
    rows.get(id).remove();
    rows.delete(id);
  }
  let at = list.firstElementChild;
  for (const id of ops.order) {
    let li = rows.get(id);
    if (!li) {
      li = createRow(byId.get(id));
      rows.set(id, li);
      list.insertBefore(li, at);
    } else if (li !== at) {
      list.insertBefore(li, at);
    } else {
      at = at.nextElementSibling;
    }
    fill(li, byId.get(id));
  }
  empty.hidden = ops.order.length > 0;
  list.hidden = ops.order.length === 0;
}

function refill(id) {
  const li = rows.get(id);
  if (li && byId.has(id)) fill(li, byId.get(id));
}

// R2 + R7: Ack asks first, and the confirm names the incident id of the row that was clicked.
let asking = null;
let lastFocus = null;
function openConfirm(id) {
  asking = id;
  lastFocus = document.activeElement;
  confirmMsg.textContent = confirmText(byId.get(id));
  confirmBox.dataset.id = id;
  confirmBox.hidden = false;
  confirmCancel.focus(); // the safe choice is the default
}
function closeConfirm() {
  asking = null;
  confirmBox.hidden = true;
  delete confirmBox.dataset.id;
  lastFocus?.focus?.();
}

list.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-testid="ack"]');
  if (!btn || btn.disabled) return;
  openConfirm(btn.dataset.id);
});

confirmCancel.addEventListener('click', closeConfirm);
confirmBox.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeConfirm();
});
confirmBox.addEventListener('click', (e) => {
  if (e.target === confirmBox) closeConfirm(); // click on the backdrop
});
confirmAck.addEventListener('click', async () => {
  const id = asking;
  if (!id) return;
  closeConfirm();
  pending.add(id);
  refill(id);
  try {
    const reply = await ack(id);
    acked.set(id, reply.ackedAt);
  } catch (err) {
    console.error(err);
    status.textContent = `Ack failed for ${id}. Try again.`;
  } finally {
    pending.delete(id);
    refill(id);
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
