# S03E04 "show me when" — log

## 2026-11-12 start-challenge
- Called list-challenges; S03E04 open, not solved.
- Called start-challenge (c0000000-0000-4000-8000-0000005e03e4). Got session (saved in session.txt, masked here: v1.eyJ…tc_k), expires 2026-11-19T12:30:55Z.
- Task: build 4 ready issues in starter, deploy board to public https, record it, send report (What you checked / When / Where / Options for product + evidence JSON). Step 2 after product answers: rebuild, System Diff, new recording, replay or runUrl.
- Starter: https://hq.mega.dev/media/show-me-when/sched-prod-board-2dff0937.zip
- API: https://hq.mega.dev/challenges/show-me-when/api
- Waiting for human go-ahead.

## Build
- Downloaded starter zip (7712 bytes) to starter-dl/, unzipped to board/sched-prod-board. Baseline commit e686913.
- Probed API: GET /incidents returns the full list every call (with or without since=), new cursor each time. ~1 new incident every 7 min. Probe saved in probe1.json.
- TDD: test/board.test.mjs (6 tests: Auckland/Berlin local time, midnight crossing, no raw UTC, newest-first sort, HTML escape) failed first (no module), then pass after app/board.js.
- Built SCHED-4511..4514 in app/app.js, index.html, style.css; scripts/build.mjs stamps git sha into meta + footer. Commit c4c0d168faf8.
- Local preview (localhost:5175): 8→9 rows, loader hidden, refresh every 2 s (7 incident calls in ~5 s window incl. load), meta/footer sha c4c0d168faf8. No acks sent yet.
