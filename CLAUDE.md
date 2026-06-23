# GymMD — Obsidian Workout Tracker Plugin

## What this is

An Obsidian community plugin that logs gym workouts as plain markdown files. All data lives in human-editable frontmatter so Dataview/Bases can query it without parsing markdown tables. The full design spec is in `PLAN.md`.

## Key stack decisions

- **Bundler**: esbuild (outputs `main.js` to repo root — Obsidian requires the artifact there)
- **Language**: TypeScript 5.9 with `strict: true`, JSX via `react-jsx` automatic transform
- **UI**: React 19 (bundled into `main.js` — Obsidian does not provide React)
- **No test runner yet** — the highest-risk piece (markdown parser/serializer) should get unit tests first

## Dev workflow

```bash
npm run dev        # watch mode — rebuilds main.js on change
npm run build      # type-check + production bundle
npm run lint       # ESLint with eslint-plugin-obsidianmd rules
npm run version    # bump version in manifest.json + versions.json
```

To test in Obsidian: copy (or symlink) the repo into:
```
<Vault>/.obsidian/plugins/gymmd/
```
Then enable **Settings → Community plugins → GymMD**. Obsidian loads `main.js` + `manifest.json` + `styles.css` from the plugin root.

`main.js` is gitignored (build artifact). Never commit it.

## Repository layout

```
src/
  main.ts              # Plugin entry — onload/onunload only, no feature logic
  settings.ts          # PluginSettings interface + DEFAULT_SETTINGS
  types.ts             # Exercise, Template, Workout TypeScript types
  ui/
    context.ts         # React PluginContext + usePlugin()
    views/             # ReactItemView subclasses (exercises, templates, active, history)
    modals/            # React modal base, prompts, template editor, finish flow
    hooks/             # useActiveWorkout (autosave), useNow (ticking clock)
  services/            # Vault I/O, serializer/parser, stores, summary, diff
  utils/               # ID generation, date helpers, constants
manifest.json          # Plugin metadata — never change `id` after release
versions.json          # Maps plugin version → minimum Obsidian app version
styles.css             # Plugin CSS, built on Obsidian's theme variables
esbuild.config.mjs     # Build config — jsx:automatic, outfile:main.js
tsconfig.json          # jsx:react-jsx, moduleResolution:bundler, strict:true
```

## Obsidian plugin conventions

- Entry point is `src/main.ts` → compiled to `main.js` at repo root
- `manifest.json` `id` field (`"gymmd"`) must match the plugin folder name in the vault; `minAppVersion` is `1.13.0` (uses `revealLeaf`, `trashFile`, `setDestructive`)
- All commands need stable IDs — never rename after first release
- Register every listener via `this.registerEvent / registerDomEvent / registerInterval` so they're cleaned up on plugin unload
- Settings persist via `this.loadData()` / `this.saveData()`

## Data model summary (see PLAN.md §1–5 for full spec)

Three entity types, each a separate markdown file with structured frontmatter:

| Entity | Folder | Key ID field |
|---|---|---|
| Exercise | `workouts/exercises/` | `exercise_id` (e.g. `ex-3f9a2b`) |
| Template | `workouts/templates/` | `template_id` (e.g. `tpl-7c1d`) |
| Workout | `workouts/active/`, `workouts/completed/`, or `workouts/abandoned/` | `workout_id` (e.g. `wkt-a91f3`) |

IDs are stable short strings — entities reference each other by ID, never by filename, so renames never break links. Exercises are archived (not deleted) to keep historical data intact.

Each exercise *entry* inside a template/workout also has a per-entry `uid` (e.g. `e-7a2c91`), distinct from `exercise_id`. This allows the same exercise to appear multiple times (circuits/supersets) and is the join key the finish-diff uses to match a workout entry to its template entry. `uid` is copied template → workout at creation. React lists key on `uid`, not `exercise_id`.

Core invariants (see PLAN.md §11):
- **Frontmatter is the only source of truth; body tables are generated, write-only output** — never parse the table back into data. Hand edits go in the YAML.
- **Every workout starts from a template** — there is no "from scratch" creation. To add an exercise, edit a template first.
- **Workout `status` drives folder placement** — `in_progress` → `active/`, `completed` → `completed/`, `abandoned` → `abandoned/`, moved via `fileManager.renameFile()`.
- **Timestamps are quoted ISO-8601 strings**; timer state derives from the stored `current_phase_started`, never a running interval.
- **UI is styled with Obsidian CSS variables** (`var(--interactive-accent)`, `var(--background-secondary)`, `var(--text-muted)`, `var(--size-4-*)`, `var(--radius-*)`, …) so it follows the user's theme. No hardcoded colors / no forced dark mode.

## Implementation status

All build-order steps from PLAN.md §10 are implemented (v0.1.0):

1. ✅ Serializer + body renderer (`services/serializer.ts`) + frontmatter reader (`services/parse.ts`) — write-only body, no table parsing
2. ✅ Exercise CRUD (`ui/views/exercise-list-view.tsx`, `services/exercise-store.ts`)
3. ✅ Template builder (`ui/modals/template-editor.tsx`, `services/template-store.ts`)
4. ✅ Workout creation from template (`main.startWorkout`, `services/workout-store.ts`) with resume/abandon prompt
5. ✅ Active Workout view (`ui/views/active-workout-view.tsx`) — stopwatch + all-sets tabs, debounced autosave
6. ✅ Finish flow (`ui/modals/finish-flow.ts`, `services/diff.ts`)
7. ✅ History view (`ui/views/history-view.tsx`)
8. ✅ Settings (`settings.ts`)

Not yet done: unit tests (the serializer/diff are pure and the obvious first targets); manual testing inside an Obsidian vault.

## Build commands

`npm run build` runs `tsc -noEmit` then esbuild (both must stay green). `npm run lint` runs eslint with `eslint-plugin-obsidianmd`. Both pass clean as of v0.1.0.
