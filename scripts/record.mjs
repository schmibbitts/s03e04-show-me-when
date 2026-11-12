// Records the board in use: open-board, watch-board (a new incident arrives live), ack-incident.
// Usage: node scripts/record.mjs <board url> [--wait-new-min 10] [--locale en-NZ] [--tz Pacific/Auckland]
// Writes recordings/<name>.mp4 and recordings/<name>.json (moments as mm:ss from video start, ack receipts).
import { chromium } from 'playwright';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const args = process.argv.slice(2);
const url = args[0];
const opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const waitNewMin = Number(opt('--wait-new-min', '10'));
const locale = opt('--locale', 'en-NZ');
const timezoneId = opt('--tz', 'Pacific/Auckland');
const name = opt('--name', `board-${Date.now()}`);
if (!url) throw new Error('board url required');

const frameDir = `recordings/frames-${name}`;
rmSync(frameDir, { recursive: true, force: true });
mkdirSync(frameDir, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge' });
const context = await browser.newContext({
  locale,
  timezoneId,
  viewport: { width: 1100, height: 640 },
});
const page = await context.newPage();
// Video = page screenshots stitched by the system ffmpeg (no Playwright ffmpeg download).
const t0 = Date.now();
const frames = [];
let recording = true;
const grab = (async () => {
  while (recording) {
    const t = Date.now() - t0;
    const file = `${frameDir}/${String(frames.length).padStart(6, '0')}.png`;
    try { await page.screenshot({ path: file }); frames.push({ file, t }); } catch {}
    await new Promise((r) => setTimeout(r, Math.max(0, 200 - (Date.now() - t0 - t))));
  }
})();
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

recording = false;
await grab;
await context.close();
await browser.close();
writeFileSync(`recordings/${name}.json`, JSON.stringify({ url, locale, timezoneId, moments, acks }, null, 2));
// ffconcat with each frame held until the next one, so video time == wall time since t0.
const end = Date.now() - t0;
let list = 'ffconcat version 1.0\n';
frames.forEach((f, i) => {
  const next = i + 1 < frames.length ? frames[i + 1].t : end;
  const dur = (i === 0 ? next : next - f.t) / 1000; // first frame also covers 0..t
  list += `file '${f.file.split('/').pop()}'\nduration ${dur.toFixed(3)}\n`;
});
list += `file '${frames.at(-1).file.split('/').pop()}'\n`;
writeFileSync(`${frameDir}/list.txt`, list);
const out = `recordings/${name}.mp4`;
execFileSync('ffmpeg', ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', `${frameDir}/list.txt`,
  '-vf', 'fps=10,format=yuv420p', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '28', '-movflags', '+faststart', out]);
rmSync(frameDir, { recursive: true, force: true });
console.log('video', out);
