# GymMD — Obsidian Workout Tracker

A markdown-native Obsidian plugin for logging gym workouts. All data is stored as
plain, human-editable markdown with structured YAML frontmatter, so it stays
queryable by Dataview/Bases and readable by an AI coach. See [`PLAN.md`](PLAN.md)
for the full design and [`CLAUDE.md`](CLAUDE.md) for the architecture.

- **Exercises**, **Templates**, and **Workouts** are separate, stably-linked files.
- Live "Active Workout" view with a stopwatch and an all-sets editor (dark, gym-friendly).
- A workout in progress survives closing/reopening Obsidian.
- Works on desktop **and mobile** (`isDesktopOnly: false`).

---

## 1. Test it locally (desktop)

You need Node.js 18+ (`node --version`).

### a. Install dependencies & build

```bash
cd /Users/mike/src/gymmd
npm install
npm run dev      # watch mode: rebuilds main.js on every change
```

`npm run dev` keeps running and recompiles `src/` → `main.js` whenever you save.
Use `npm run build` for a one-off production build, and `npm run lint` to check it.

### b. Make the repo visible to your dev vault

Obsidian loads a plugin from `<Vault>/.obsidian/plugins/<plugin-id>/`. The plugin
id is **`gymmd`**. The cleanest dev setup is a **symlink** so the `main.js` you
build lands in the vault automatically:

```bash
ln -s /Users/mike/src/gymmd \
  "/Users/mike/obsidian/dev_vault/dev_vault/.obsidian/plugins/gymmd"
```

(Obsidian reads `manifest.json`, `main.js`, and `styles.css` from the folder root
and ignores `node_modules/`, `src/`, etc.)

Prefer not to symlink? Copy the three release files instead, and re-copy after each
build:

```bash
DEST="/Users/mike/obsidian/dev_vault/dev_vault/.obsidian/plugins/gymmd"
mkdir -p "$DEST"
cp main.js manifest.json styles.css "$DEST"/
```

### c. Enable and run

1. Open the dev vault in Obsidian.
2. **Settings → Community plugins** → turn off **Restricted mode** if it's on.
3. Click the refresh icon next to "Installed plugins", then enable **GymMD — Workout Tracker**.
4. Use the **dumbbell** ribbon icon, or the command palette (commands are listed
   under **GymMD — Workout Tracker**):
   - Open workout templates
   - Open exercises
   - Open active workout
   - Open workout history

After each code change: `npm run dev` rebuilds `main.js`, then **reload the plugin**
(disable/enable it, or reload Obsidian with `Cmd+R`). For a faster loop, install the
community [**Hot-Reload**](https://github.com/pjeby/hot-reload) plugin, which
auto-reloads any plugin when its `main.js` changes.

### d. First run

The folders (`Workouts/Exercises`, `Templates`, `Active`, `Completed`, `Abandoned`)
are created automatically the first time you add data. Start by creating a couple of
exercises, then a template, then press **Start** on the template.

---

## 2. Publish to GitHub (for yourself)

You don't need to submit to the official community catalog to use this on your own
devices. Pushing to a GitHub repo + creating releases is enough — and it's what
[BRAT](#3-install-on-your-phone-via-brat) reads from.

### Best practices

- **Never commit `main.js`** — it's a build artifact (already in `.gitignore`).
  Build it in CI instead (workflow included below).
- **Releases carry the binaries.** Each GitHub release must attach `manifest.json`,
  `main.js`, and `styles.css` as individual files.
- **Tag = version, no `v` prefix.** The git tag must exactly match `version` in
  `manifest.json` (e.g. `0.1.0`, not `v0.1.0`).
- **Keep `manifest.json` in the repo root too** (not only in the release).
- **Bump versions with the script:** edit `minAppVersion` if needed, then
  `npm version patch|minor|major` — it updates `manifest.json`, `package.json`, and
  `versions.json`, and stages them.

### Push it

```bash
cd /Users/mike/src/gymmd
git add .
git commit -m "GymMD v0.1.0"
gh repo create gymmd --private --source=. --push   # or create the repo in the UI
```

### Cut a release

This repo includes `.github/workflows/release.yml`. Pushing a tag triggers it: it
runs `npm ci && npm run build` and creates a GitHub release with the three files
attached.

```bash
git tag 0.1.0      # must match manifest.json "version"
git push origin 0.1.0
```

Watch it with `gh run watch`, then confirm the release has `main.js`,
`manifest.json`, and `styles.css` attached.

> Doing releases by hand instead? Run `npm run build`, then
> `gh release create 0.1.0 --title 0.1.0 main.js manifest.json styles.css`.

---

## 3. Install on your phone (via BRAT)

[BRAT](https://github.com/TfTHacker/obsidian42-brat) ("Beta Reviewer's Auto-update
Tool") installs and updates plugins straight from a GitHub repo — no app store, no
manual file copying — and it works on iOS and Android.

1. On your phone, open Obsidian in the **same vault** (or any vault you want it in).
2. **Settings → Community plugins** → **Browse** → search **BRAT** → Install → Enable.
3. Open the command palette → **BRAT: Add a beta plugin for testing**.
4. Enter your repo: `your-github-username/gymmd`.
   - Leave the version blank to track the latest release, or pin a specific one.
5. BRAT downloads the release files and installs the plugin. Enable **GymMD —
   Workout Tracker** under Community plugins.

**Updating later:** publish a new release (bump version, push tag), then on the phone
run **BRAT: Check for updates to all beta plugins** (or let BRAT auto-update on
startup, which is the default).

> Private repo? BRAT supports private repos via a GitHub personal access token in its
> settings. A public repo is simpler if the code isn't sensitive.

### Alternative: Obsidian Sync

If you pay for Obsidian Sync, enable **Settings → Sync → Installed community
plugins**. Your enabled plugins (including this one once installed on desktop) sync to
mobile automatically. This skips BRAT entirely but requires a subscription and the
plugin to be installed somewhere first.

### Alternative: manual copy

You can also drop `main.js`, `manifest.json`, and `styles.css` into
`<Vault>/.obsidian/plugins/gymmd/` on the device. Easy on Android (file manager),
awkward on iOS — BRAT is the better path on phones.

---

## 4. Next steps / roadmap

- **Add tests.** The serializer (`src/services/serializer.ts`) and the template diff
  (`src/services/diff.ts`) are pure functions and the highest-value first targets
  (PLAN.md §10.1). Vitest is a good fit; no test runner is wired up yet.
- **Smoke-test the full loop** in a real vault: create exercises → template → run a
  workout → finish with a template diff → check the file in `Completed/`.
- **Submit to the community catalog** (optional): follow the
  [plugin guidelines](https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines)
  and open a PR at [obsidianmd/obsidian-releases](https://github.com/obsidianmd/obsidian-releases).
  Not required for personal use via BRAT.
- **v2 ideas** from the plan: in-plugin "Exercise Progress" view, bodyweight
  tracking, AI-coach export helpers.

## Commands & scripts

| Command | What it does |
|---|---|
| `npm run dev` | Watch-build `main.js` for development |
| `npm run build` | Type-check + production bundle |
| `npm run lint` | ESLint with `eslint-plugin-obsidianmd` |
| `npm version patch` | Bump version across manifest/package/versions |

## License

MIT
