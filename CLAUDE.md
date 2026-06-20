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
  commands/            # addCommand() registrations
  ui/
    views/             # ItemView subclasses (Active Workout, Exercise List, History)
    modals/            # Modal subclasses (Finish Workout diff, Exercise Picker)
    components/        # Reusable React components
  services/            # Vault I/O, markdown parsing, business logic
  utils/               # ID generation, date helpers, pure utilities
manifest.json          # Plugin metadata — never change `id` after release
versions.json          # Maps plugin version → minimum Obsidian app version
styles.css             # Plugin-scoped CSS (dark gym-UI theme lives here)
esbuild.config.mjs     # Build config — jsx:automatic, outfile:main.js
tsconfig.json          # jsx:react-jsx, moduleResolution:bundler, strict:true
```

## Obsidian plugin conventions

- Entry point is `src/main.ts` → compiled to `main.js` at repo root
- `manifest.json` `id` field (`"gymmd"`) must match the plugin folder name in the vault
- All commands need stable IDs — never rename after first release
- Register every listener via `this.registerEvent / registerDomEvent / registerInterval` so they're cleaned up on plugin unload
- Settings persist via `this.loadData()` / `this.saveData()`

## Data model summary (see PLAN.md §1–5 for full spec)

Three entity types, each a separate markdown file with structured frontmatter:

| Entity | Folder | Key ID field |
|---|---|---|
| Exercise | `Workouts/Exercises/` | `exercise_id` (e.g. `ex-3f9a2b`) |
| Template | `Workouts/Templates/` | `template_id` (e.g. `tpl-7c1d`) |
| Workout | `Workouts/Active/`, `Workouts/Completed/`, or `Workouts/Abandoned/` | `workout_id` (e.g. `wkt-a91f3`) |

IDs are stable short strings — entities reference each other by ID, never by filename, so renames never break links. Exercises are archived (not deleted) to keep historical data intact.

Core invariants (see PLAN.md §11):
- **Frontmatter is the only source of truth; body tables are generated, write-only output** — never parse the table back into data. Hand edits go in the YAML.
- **Every workout starts from a template** — there is no "from scratch" creation. To add an exercise, edit a template first.
- **Workout `status` drives folder placement** — `in_progress` → `Active/`, `completed` → `Completed/`, `abandoned` → `Abandoned/`, moved via `fileManager.renameFile()`.
- **Timestamps are quoted ISO-8601 strings**; timer state derives from the stored `current_phase_started`, never a running interval.
- **Active Workout UI is dark-theme-only**, scoped via CSS class, independent of the vault theme.

## Build order (from PLAN.md §10)

1. Markdown parser/serializer (`src/services/` — highest risk, test first)
2. Exercise CRUD
3. Template builder UI
4. Workout creation from template
5. Active Workout view (stopwatch Tab 1 + all-sets Tab 2)
6. Finish flow (diff against template, modal, file move)
7. History view
8. Settings UI
