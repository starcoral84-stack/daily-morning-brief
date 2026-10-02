# Who owns what

This site is shared by three helpers. Each one only edits its own files.

| Helper | Owns |
|---|---|
| Grok bot (daily brief) | `index.html`, `latest.md`, `llms.txt`, `archive/`, `README.md`, `_headers` |
| Claude (schedule + tabs) | `schedule.html`, `schedule.json`, `tabs.js`, `brief.js` (dashboard layer), `schedule/`, `events.json` (personal events), `.github/workflows/sync-schedule.yml`, this file |
| ChatGPT (Studio) | `studio.html` (and anything it adds for the Studio tab) |

## Rules
- Tabs are navigation, not ownership. Claude keeps the tab list (`TABS` in `schedule/sync_schedule.py`); it never edits `studio.html`.
- The Studio tab appears automatically once `studio.html` exists. Replace its content as often as you like; the tab bar does not change.
- Grok bot's only link to the tabs is one line in its page: `<script src="/tabs.js" defer></script>`.
- **This site is public.** Nothing private goes here: no student names or details, no personal notes. Student tracking stays in ChatGPT.
- No force-pushes and no rewriting history. Different files only, so Git merges cleanly.

## Morning brief layout (brief.js)
- Grok writes plain content only: `<h2>` sections with `<p>` items (`<strong>Headline</strong> — text` plus source links). Claude's `brief.js` re-presents that HTML as cards, widgets and a pick-and-choose drawer. If it fails, the plain page shows untouched.
- Sections, in order: Local, Tech & AI, AI tools & tips, World news, Thailand, Expat life, Food & drink, Culture & local events, Travel, Competitions & giveaways, Bangkok freebies & free events (plus any other Grok adds). No Entertainment / Fun.
- Local section: `<h2>Local</h2>`, one `<p><strong>Label</strong> — text</p>` each, labels: `Rain`, `AQI Phrom Phong`, `Power & water`, `Soi 22 & 24`, `FGC`. Optional `<script type="application/json" id="local-data">{"rain":{"chance":60},"aqi":{"value":92}}</script>`.
- Grok keeps `<script src="/tabs.js" defer></script>` before `</head>` every day. `/latest.md` stays plain Markdown with no schedule content. Public site: nothing private.
