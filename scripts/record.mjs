// Records the board in use: open-board, watch-board (a new incident arrives live), ack-incident.
// Usage: node scripts/record.mjs <board url> [--wait-new-min 10] [--locale en-NZ] [--tz Pacific/Auckland]
// Writes recordings/<name>.webm and recordings/<name>.json (moments as mm:ss from video start, ack receipts).
import { chromium } from 'playwright';
import { mkdirSync, renameSync, writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const url = args[0];
const opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const waitNewMin = Number(opt('--wait-new-min', '10'));
const locale = opt('--locale', 'en-NZ');
const timezoneId = opt('--tz', 'Pacific/Auckland');
const name = opt('--name', `board-${Date.now()}`);
if (!url) throw new Error('board url required');

mkdirSync('recordings/tmp', { recursive: true });
const browser = await chromium.launch({ channel: 'msedge' });
const context = await browser.newContext({
  locale,
  timezoneId,
  viewport: { width: 1100, height: 640 },
  recordVideo: { dir: 'recordings/tmp', size: { width: 1100, height: 640 } },
});
const t0 = Date.now(); // video starts with the context's first page
const page = await context.newPage();
const at = () => {
  const s = Math.floor((Date.now() - t0) / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};
const moments = [];
const mark = (flow, what, extra = {}) => {
  const m = { flow, at: at(), what, ...extra };
  moments.push(m);
  console.log(JSON.stringify(m));
};
const acks = [];
page.on('response', async (r) => {
  if (r.url().includes('/ack?')) {
    try { acks.push({ at: at(), status: r.status(), body: await r.json() }); } catch {}
  }
});

await page.goto(url);
mark('open-board', 'page opened; loader visible', { loader: await page.getByTestId('loader').isVisible() });
await page.getByTestId('incident-row').first().waitFor();
const firstIds = await page.getByTestId('incident-row').evaluateAll((rs) => rs.map((r) => r.dataset.id));
mark('open-board', 'incidents on screen; loader gone', {
  loader: await page.getByTestId('loader').isVisible(),
  rows: firstIds.length,
  top: firstIds[0],
  sha: await page.getByTestId('build-sha').textContent(),
});

// watch-board: keep it open until a new incident lands on top, without a reload.
const deadline = Date.now() + waitNewMin * 60_000;
let newTop = null;
while (Date.now() < deadline) {
  const top = await page.getByTestId('incident-row').first().getAttribute('data-id');
  if (top !== firstIds[0]) { newTop = top; break; }
  await page.waitForTimeout(500);
}
if (newTop) {
  mark('watch-board', 'new incident appeared on top without reload', { id: newTop, rows: await page.getByTestId('incident-row').count() });
} else {
  mark('watch-board', `no new incident within ${waitNewMin} min`);
}

// ack-incident: ack the top row.
await page.waitForTimeout(2000);
const row = page.getByTestId('incident-row').first();
const id = await row.getAttribute('data-id');
const btn = row.getByTestId('ack');
await btn.hover();
await page.waitForTimeout(800);
const ackResp = page.waitForResponse((r) => r.url().includes('/ack?'));
mark('ack-incident', 'Ack clicked', { id });
await btn.click();
await ackResp;
await page.locator(`[data-testid="incident-row"][data-id="${id}"] [data-testid="acked"]`).waitFor();
mark('ack-incident', 'row shows acked', { id });

// Still acked after a few refreshes.
await page.waitForTimeout(6000);
mark('ack-incident', 'still acked after refreshes', {
  id,
  acked: await page.locator(`[data-testid="incident-row"][data-id="${id}"] [data-testid="acked"]`).isVisible(),
});
await page.waitForTimeout(2000);

const video = page.video();
await context.close();
await browser.close();
const out = `recordings/${name}.webm`;
renameSync(await video.path(), out);
writeFileSync(`recordings/${name}.json`, JSON.stringify({ url, locale, timezoneId, moments, acks }, null, 2));
console.log('video', out);
