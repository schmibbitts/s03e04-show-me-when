import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatLocal, sortNewestFirst, escapeHtml } from '../app/board.js';

const iso = '2026-11-12T03:03:00.000Z';

test('Auckland viewer sees NZ local time, day before month', () => {
  // 03:03Z on 12 Nov = 16:03 NZDT (UTC+13) on 12 Nov
  const s = formatLocal(iso, 'en-NZ', 'Pacific/Auckland');
  assert.match(s, /12\/11\/2026/);
  assert.match(s, /4:03|16:03/);
});

test('Berlin viewer sees CET local time, day before month', () => {
  // 03:03Z = 04:03 CET (UTC+1)
  const s = formatLocal(iso, 'de-DE', 'Europe/Berlin');
  assert.match(s, /12\.11\.2026/);
  assert.match(s, /04:03/);
});

test('UTC midnight crossing shifts the local day', () => {
  // 23:30Z on 11 Nov = 12 Nov in Auckland
  const s = formatLocal('2026-11-11T23:30:00.000Z', 'en-NZ', 'Pacific/Auckland');
  assert.match(s, /12\/11\/2026/);
});

test('local time never prints the raw UTC string', () => {
  assert.ok(!formatLocal(iso, 'en-GB', 'Europe/London').includes('T03:03'));
});

test('sortNewestFirst orders by openedAt, newest first, without mutating input', () => {
  const input = [
    { id: 'A', openedAt: '2026-11-11T03:11:00.000Z' },
    { id: 'B', openedAt: '2026-11-12T12:24:47.761Z' },
    { id: 'C', openedAt: '2026-11-12T11:43:02.939Z' },
  ];
  assert.deepEqual(sortNewestFirst(input).map((i) => i.id), ['B', 'C', 'A']);
  assert.equal(input[0].id, 'A');
});

test('escapeHtml neutralises markup in incident text', () => {
  assert.equal(escapeHtml('<img src=x onerror=1> & "q"'), '&lt;img src=x onerror=1&gt; &amp; &quot;q&quot;');
});
