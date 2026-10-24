# Browser preview

Runs the real GymMD UI in a plain browser — no Obsidian needed — styled with
Obsidian's own `app.css` (extracted from your local Obsidian install into
`vendor/`, never committed) and laid out like Obsidian mobile on a phone.

- `obsidian-stub.ts` — minimal stand-in for the `obsidian` module (in-memory
  vault, modal, setting, view shell) mirroring Obsidian's DOM structure.
- `boot.ts` — seeds a sample vault and boots the real plugin (`onload` → `openApp`).
- `shoot.mjs` — Playwright: screenshots every screen and flags horizontal overflow
  and console errors.

```bash
npm run preview                 # build dev/preview/dist
open "dev/preview/index.html?route=journal"   # then Chrome DevTools → device toolbar
npm run preview:watch           # rebuild on change
npm run preview:shoot           # dark, iPhone 13 → dev/preview/out/dark/
node dev/preview/shoot.mjs journal --light --small   # filter + light theme + iPhone SE
node dev/preview/shoot.mjs --desktop                 # desktop pane
```

URL params: `route=<screen>`, `theme=dark|light`, `seed=full|empty`, `active=1`
(in-progress workout), `desktop=1`.

If Obsidian isn't installed in the default location, set
`OBSIDIAN_ASAR=/path/to/obsidian.asar`. First Playwright run: `npx playwright install chromium`.

It's a close approximation, not the real app: native iOS controls (time/date
pickers) render as Chromium's, and the stub only implements the API GymMD uses.
