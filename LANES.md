# Who owns what

This site is shared by three helpers. Each one only edits its own files.

| Helper | Owns |
|---|---|
| Grok bot (daily brief) | `index.html`, `latest.md`, `llms.txt`, `archive/`, `README.md`, `_headers` |
| Claude (schedule + tabs) | `schedule.html`, `schedule.json`, `tabs.js`, `schedule/`, `events.json` (personal events), `.github/workflows/sync-schedule.yml`, this file |
| ChatGPT (Studio) | `studio.html` (and anything it adds for the Studio tab) |

## Rules
- Tabs are navigation, not ownership. Claude keeps the tab list (`TABS` in `schedule/sync_schedule.py`); it never edits `studio.html`.
- The Studio tab appears automatically once `studio.html` exists. Replace its content as often as you like; the tab bar does not change.
- Grok bot's only link to the tabs is one line in its page: `<script src="/tabs.js" defer></script>`.
- **This site is public.** Nothing private goes here: no student names or details, no personal notes. Student tracking stays in ChatGPT.
- No force-pushes and no rewriting history. Different files only, so Git merges cleanly.
