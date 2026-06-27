# Obsidian Workout Tracker — Implementation Plan

## 0. Goal

A markdown-native Obsidian plugin for logging gym workouts, where:
- All data is stored as plain, human-editable markdown files in the vault.
- Frontmatter carries the full structured per-set data (and no denormalized summaries) so files stay clean and an AI coach / scripts can read it directly. Derived numbers (counts, volume, duration) are computed on demand, not stored.
- Exercises, Templates, and Workouts are three separate, stably-linked entities.
- A workout in progress survives closing/reopening Obsidian.
- Output is structured enough to be consumed later by an AI coach reading the vault.

---

## 1. Entities

| Entity | Purpose | Lifecycle |
|---|---|---|
| **Exercise** | Named movement with a stable ID | Created once, renamed freely, archived not deleted |
| **Template** | Reusable workout plan (exercises + planned sets) | Created, edited anytime; can be updated from a finished workout if it diverged |
| **Workout** | One performed instance, always created from a template | Created → lives in `active/` while in progress → moved to `completed/` on finish |

Templates and Workouts are **separate files**, not one object with a status field. A Workout may reference the Template it started from, but is independent once created — editing it never silently mutates the template.

---

## 2. File layout

```
VaultRoot/
  workouts/
    exercises/
      Squat.md
      Pull Up.md
      Bench Press.md
    templates/
      Push Day.md
      Leg Day.md
    active/
      2026-06-20 Push Day.md          ← exists only while in_progress (0 or 1 file)
    completed/
      2026-06-18 Push Day.md
      2026-06-15 Leg Day.md
```

- Folder names default to lowercase (`workouts/exercises/…`); all configurable in settings. File names keep their natural casing (`Push Day.md`).

- Base path and sub-folder names configurable in plugin settings; structure above is the default.
- Workout filenames: `YYYY-MM-DD <Template Name>.md`, with `-2`, `-3` suffix for multiple sessions same day.
- One file = one whole workout/template, all exercises and sets nested inside.

---

## 3. Exercise file

`workouts/exercises/Squat.md`
```markdown
---
exercise_id: ex-3f9a2b
type: workout-exercise
name: Squat
archived: false
created: 2026-06-01
---

Notes about this exercise (form cues, equipment, etc).
```

- `exercise_id` is the stable identity — a short generated ID, independent of filename/title.
- All Templates and Workouts reference exercises by `exercise_id`, never by name string, so renaming an exercise never breaks historical links.
- Renaming the file is safe; wikilinks update automatically, `exercise_id` never changes.
- Deletion is **not supported** — only `archived: true/false` — to avoid orphaning historical data. Archived exercises are hidden from "add exercise" pickers but still render correctly in past data.

---

## 4. Template file

`workouts/templates/Push Day.md`
```markdown
---
type: workout-template
template_id: tpl-7c1d
name: Push Day
created: 2026-06-01
updated: 2026-06-19
exercise_count: 3
total_planned_sets: 9
exercises:
  - exercise_id: ex-3f9a2b
    name: Bench Press
    order: 1
    sets:
      - set: 1
        reps: 10
        weight: 60
      - set: 2
        reps: 8
        weight: 65
      - set: 3
        reps: 8
        weight: 65
  - exercise_id: ex-88aa11
    name: Overhead Press
    order: 2
    sets:
      - set: 1
        reps: 10
        weight: 30
      - set: 2
        reps: 8
        weight: 32.5
      - set: 3
        reps: 8
        weight: 32.5
  - exercise_id: ex-9b2c40
    name: Tricep Pushdown
    order: 3
    sets:
      - set: 1
        reps: 12
        weight: 20
      - set: 2
        reps: 12
        weight: 20
      - set: 3
        reps: 10
        weight: 22.5
---

# Push Day

## Bench Press
| Set | Reps | Weight (kg) |
|---|---|---|
| 1 | 10 | 60 |
| 2 | 8 | 65 |
| 3 | 8 | 65 |

## Overhead Press
| Set | Reps | Weight (kg) |
|---|---|---|
| 1 | 10 | 30 |
| 2 | 8 | 32.5 |
| 3 | 8 | 32.5 |

## Tricep Pushdown
| Set | Reps | Weight (kg) |
|---|---|---|
| 1 | 12 | 20 |
| 2 | 12 | 20 |
| 3 | 10 | 22.5 |
```

- `weight: 0` is valid and means bodyweight (Pull Ups, etc.) — plain number, no special-casing in the schema. Display as "BW" in the UI, store as `0`.
- Frontmatter `exercises[].sets` carries the **full data**, not a summary count — this is what makes the file queryable via Dataview/Bases without parsing the markdown table.
- **Frontmatter is the single source of truth; the body `##` headings + tables are a generated, read-only view.** The plugin always writes frontmatter first, then regenerates the body from it (see §11). Hand edits to data should be made in the YAML frontmatter, not the table — the plugin does not parse the table back into data.
- `##` heading → `exercise_id` is taken from the frontmatter `exercises` list order; headings are emitted from frontmatter, so there is no heading-text-to-ID resolution to worry about.
- **Each exercise entry also carries a per-entry `uid`** (e.g. `uid: e-7a2c91`), distinct from `exercise_id`. This lets the **same exercise appear multiple times** in one template (e.g. circuits: Squat, Lunge, Pull Up, then repeat all three) while still being matched 1:1 between a workout and its template at finish time. The `uid` is generated when the entry is added and copied verbatim into the workout when it's created. (Examples above omit `uid` for brevity; the real first key of each entry is `uid`.)

---

## 5. Workout file (performed instance)

Lives in `workouts/active/` while `status: in_progress`, moved verbatim to `workouts/completed/` on finish.

`workouts/active/2026-06-20 Push Day.md`
```markdown
---
type: workout
workout_id: wkt-a91f3
template_id: tpl-7c1d
status: in_progress
started: "2026-06-20T18:02:11"
completed:
current_phase_started: "2026-06-20T18:14:55"
exercises:
  - exercise_id: ex-3f9a2b
    name: Bench Press
    order: 1
    sets:
      - set: 1
        reps: 10
        weight: 60
        done: true
        started: "2026-06-20T18:02:11"
        duration_seconds: 42
      - set: 2
        reps: 8
        weight: 65
        done: true
        started: "2026-06-20T18:05:30"
        duration_seconds: 38
      - set: 3
        reps: 7
        weight: 65
        done: true
        started: "2026-06-20T18:09:02"
        duration_seconds: 45
  - exercise_id: ex-88aa11
    name: Overhead Press
    order: 2
    sets:
      - set: 1
        reps: 10
        weight: 30
        done: true
        started: "2026-06-20T18:14:55"
        duration_seconds: 35
      - set: 2
        reps: 8
        weight: 32.5
        done: false
        started:
        duration_seconds:
      - set: 3
        reps: 8
        weight: 32.5
        done: false
        started:
        duration_seconds:
  - exercise_id: ex-9b2c40
    name: Tricep Pushdown
    order: 3
    sets:
      - set: 1
        reps: 12
        weight: 20
        done: false
        started:
        duration_seconds:
      - set: 2
        reps: 12
        weight: 20
        done: false
        started:
        duration_seconds:
      - set: 3
        reps: 10
        weight: 22.5
        done: false
        started:
        duration_seconds:
---

# 2026-06-20 Push Day

## Bench Press
| Set | Reps | Weight (kg) | Done | Started | Duration (s) |
|---|---|---|---|---|---|
| 1 | 10 | 60 | ✅ | 18:02:11 | 42 |
| 2 | 8 | 65 | ✅ | 18:05:30 | 38 |
| 3 | 7 | 65 | ✅ | 18:09:02 | 45 |

## Overhead Press
| Set | Reps | Weight (kg) | Done | Started | Duration (s) |
|---|---|---|---|---|---|
| 1 | 10 | 30 | ✅ | 18:14:55 | 35 |
| 2 | 8 | 32.5 | ⬜ |  |  |
| 3 | 8 | 32.5 | ⬜ |  |  |

## Tricep Pushdown
| Set | Reps | Weight (kg) | Done | Started | Duration (s) |
|---|---|---|---|---|---|
| 1 | 12 | 20 | ⬜ |  |  |
| 2 | 12 | 20 | ⬜ |  |  |
| 3 | 10 | 22.5 | ⬜ |  |  |
```

Notes:
- **`status`** (`in_progress` → `completed`) is authoritative; the plugin moves the file from `active/` to `completed/` to match, via `app.fileManager.renameFile()` (preserves any wikilinks pointing at it). To discard a workout, just delete its file from `active/`.
- **`current_phase_started`**: the single timestamp the live stopwatch needs. Present only while `in_progress`, cleared on completion. On plugin load, if a workout has `status: in_progress`, the timer is recomputed as `Date.now() - current_phase_started` — not from a running interval, so it's correct immediately after reopening Obsidian regardless of how long it was closed.
- **No separate planned/actual fields.** Each set has a single `reps`/`weight`, copied from the template when the workout is created. They are visible and editable on **every** set from the start (so you can see and adjust the prescription before you begin), and `done` is a plain boolean. There is no `planned_reps`/`planned_weight`. (The parser still reads legacy `planned_*` from any pre-existing files.)
- **`done` is set only by the Start → End stopwatch flow** (End stamps `duration_seconds` and sets `done: true`). In the All-Sets tab you can **undo** a set (clears `done`, `started`, `duration_seconds`) but cannot tick it done directly — completion always goes through the timer.
- **Adding sets mid-workout**: plugin appends a new entry to both the `sets` array and the table row for that exercise; a new ad-hoc set copies `reps`/`weight` from the previous set. No new exercises can be added mid-workout — only new sets to exercises already in the workout.
- **Incomplete sets on finish**: if the workout ends while some sets are `done: false`, those sets are kept in the completed file as-is. This records the intended plan faithfully — a cut-short workout is not the same as a different workout. The template is NOT pruned to match what was actually done.
- **No denormalized/derived fields.** The workout frontmatter holds only source-of-truth: `workout_id`, `template_id`, `status`, `started`, `completed`, `current_phase_started`, and `exercises[]`. Everything else (date, duration, set counts, total volume, the workout's display name) is **derived on demand** — the date/name live in the filename (`YYYY-MM-DD <Template Name>.md`), and counts/volume/duration are computed from `exercises[]` + `started`/`completed` wherever needed (e.g. the History view). This keeps files clean and avoids stale summaries; an AI coach still has everything it needs (the `template_id` link + full per-set data).
- **Timestamp format**: all datetime values (`started`, `current_phase_started`, `completed`, per-set `started`) are stored as **quoted ISO-8601 strings** (e.g. `"2026-06-20T18:02:11"`), never as bare YAML timestamps — this keeps `metadataCache` parsing predictable and avoids timezone auto-coercion.

---

## 6. Live "Active Workout" UI

Two tabs. The UI is **styled entirely with Obsidian's CSS variables**, so it follows the user's active theme (light or dark) and looks native — no forced colors. Large tap targets for phone use in the gym. The header has a single **Finish** button, which asks for confirmation. There is no "abandon" — to discard a workout, finish it and delete the file, or delete the in-progress file from the `active/` folder directly. (Confirmations use the `mod-warning` button class — version-safe, no dependency on the 1.13 `setDestructive` API.)

**Input validation** (reps/weight fields everywhere): reps must be a positive integer 1–999; weight must be ≥ 0 with at most two decimal places (`1.75` ok, `1.757` rejected). Enforced by a shared `NumberField` component.

### Tab 1 — Stopwatch
- One large centered timer. Sits at `0:00` until the first **Start Set** press. Resets to `0` and restarts on **every** press of Start Set or End Set (single continuous counter). `current_phase_started` is the file-persisted anchor, so the timer is correct after reopening Obsidian.
- The stopwatch shows the **current set** = the active (in-progress) set if there is one, otherwise the **first not-done set**. Its `reps`/`weight` (copied from the template) are shown and **editable at any time**, including before you press Start — so you can see and adjust the prescription before loading the bar. There is **no manual prev/next** — the Start/End button is the only navigation here.
- One big button pinned to the **bottom of the screen**:
    - **Start Set** → timer resets & starts, button becomes **End Set**, and this set is marked active (reflected in Tab 2).
    - **End Set** → commits `reps`/`weight`/`duration_seconds`, marks `done: true`, timer resets & restarts, and the current set advances to the **first remaining not-done set** (anywhere in the workout, not just the next one).
    - When **all sets are done**, the button becomes **Finish Workout** (runs the §7 finish flow, including the template-update prompt if anything diverged).
- There is no separate "discard set" — to undo a set, switch to **All Sets** and uncheck its **Done** box.

### Tab 2 — All Sets
- Sets grouped by exercise, in order. Every set shows its `reps`/`weight` (from the template) and `done` state from the start.
- Inline editing of reps/weight on any set at any time, completed or not.
- **Start** button on any not-done set → starts it as the active set and switches to the Stopwatch (the two tabs share one active-set state). The currently active set shows "● active".
- A completed set shows **✓ Done · undo**; pressing undo clears `done`/`started`/`duration_seconds`. You cannot tick a set done here — completion only happens through Start → End.
- Add new set to any exercise block (a new set copies the previous set's `reps`/`weight`). **Deleting a set asks for confirmation.**
- Reorder exercise blocks and reorder sets within a block (simple up/down controls — no drag-and-drop dependency needed).
- **No adding new exercises mid-workout.** The exercise list is fixed at workout creation time. If the exercise list needs changing, finish (or delete the active file) and create a new workout.

---

## 7. Finish workout flow

1. On "Finish Workout", diff **only the completed sets** (`done: true`) in the workout against the corresponding sets in the **template's current state** — comparing weights, reps, set counts (of completed sets), and exercise order.
2. Incomplete sets (`done: false`) are excluded from the diff entirely. A workout cut short due to an interruption should not suggest removing sets from the template.
3. If no diff among completed sets → finish immediately, no prompt.
4. If diff exists → modal listing the changes, with options:
    - **Update Template** — rewrite the template file's body + frontmatter to match what was actually performed in the completed sets. Set counts in the template reflect the number of sets completed, not the number planned.
    - **Keep Template As-Is** — finish without touching the template.
    - **Cancel** — return to the workout.
5. Every workout originates from a template (see §10), so a `template_id` is always present and this diff step always applies.
6. On finish: `status → completed`, `completed`/`duration_minutes` finalized, `current_phase_started` cleared, file moved from `active/` to `completed/`. Incomplete sets remain in the file with blank actuals and `done: false`.

---

## 8. Resuming after closing Obsidian

- Every change to the active workout autosaves (debounced ~300–500ms) via `app.vault.process()` — no explicit "save" button during the workout.
- On plugin load, check for a workout with `status: in_progress` (tracked via a small plugin-settings pointer or by scanning `active/`, which should only ever contain 0 or 1 file). If found, the Active Workout view can be reopened directly via ribbon icon or command, landing back exactly where you left off, with the timer correctly recalculated from `current_phase_started`.
- Only **one active workout** at a time. If the user tries to start a new workout while one is already `in_progress`, a prompt explains they must **finish the current one first** (or delete its file from `active/`) and offers to **Resume current**. There is no abandon action.

---

## 9. Querying / progress stats

Workout frontmatter no longer stores denormalized summaries (§5), so plain Dataview (DQL) can't read pre-computed counts/volume. Templates still expose `exercise_count`/`total_planned_sets` if you want simple DQL over templates, and any per-workout or per-exercise stat can be computed from the structured `exercises[].sets` data via a short DataviewJS script.

The intended home for stats is an **in-plugin "Exercise Progress" view** (v2): scan `completed/`, filter each workout's `exercises[]` by `exercise_id`, and chart e.g. top-set weight or per-session volume over time. The schema already supports this with no migration — `exercise_id` is the consistent join key everywhere, and each completed set carries `reps`/`weight` plus the workout's `started`/`completed` timestamps.

---

## 10. Build order

1. **Frontmatter serializer + body renderer** — the shared core both Template and Workout files depend on. Reads structured data from frontmatter (via `metadataCache` or by parsing the YAML block), and serializes data → YAML frontmatter + regenerated body tables. Because frontmatter is the only source of truth (§11), there is **no table-parsing path** — the body is write-only output. Get the round-trip (data → file → data, reading only frontmatter) solid first, with unit tests on the type schema and table rendering (blank cells, `weight: 0` → "BW", missing/null actuals).
2. **Exercise CRUD** — list view, add/rename/archive. Simplest piece, validates the parser on a minimal schema.
3. **Template builder UI** — create/edit templates, add exercises (with inline "create new exercise" if missing), add/reorder/edit sets.
4. **Workout creation from template** — clones the chosen template's data into a new `active/` file, sets `status: in_progress`, `started`. There is **no "from scratch" creation** — every workout starts from a template. To work a new exercise, add it to a template first, then start a workout. `current_phase_started` is left blank until the first Start Set press (timer sits at `0:00`).
5. **Active Workout view** — Tab 1 (stopwatch) and Tab 2 (all sets), timestamp-based timer, autosave on every mutation.
6. **Finish flow** — diff against template, confirmation modal, file move to `completed/`.
7. **History view** — list of completed workouts, read-only or editable detail view.
8. **Settings** — configurable folder paths (base path + `exercises/`, `templates/`, `active/`, `completed/` sub-folder names).
9. *(Later)* Exercise progress view / DataviewJS examples, bodyweight tracking, AI-coach-facing export helpers.

---

## 11. Key technical decisions carried through the design

- **Stable identity via generated IDs** (`exercise_id`, `template_id`, `workout_id`), never derived from filenames/titles — renames never break links.
- **Frontmatter holds full structured data, not summaries** — required for both Dataview/Bases queries and future AI-coach consumption without table parsing.
- **Timer correctness via stored timestamps, not running intervals** — survives Obsidian restarts without drift.
- **File location follows `status`, not the other way around** — frontmatter is the source of truth, folder placement is a plugin-managed consequence.
- **No deletion of Exercises** — archive only, to keep historical Workout/Template data intact.
- **Sync direction: frontmatter → body** — frontmatter is the single source of truth; the plugin always writes frontmatter first and regenerates the body tables from it. Body tables are a human-readable view, not a second source of truth. If a user or AI agent wants to edit data outside the plugin, they should edit the YAML frontmatter directly (not the markdown table). See §1 notes for the reasoning.