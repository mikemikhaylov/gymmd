# Obsidian Workout Tracker — Implementation Plan

## 0. Goal

A markdown-native Obsidian plugin for logging gym workouts, where:
- All data is stored as plain, human-editable markdown files in the vault.
- Frontmatter carries full structured data (not just summaries) so Dataview/Bases can query it directly.
- Exercises, Templates, and Workouts are three separate, stably-linked entities.
- A workout in progress survives closing/reopening Obsidian.
- Output is structured enough to be consumed later by an AI coach reading the vault.

---

## 1. Entities

| Entity | Purpose | Lifecycle |
|---|---|---|
| **Exercise** | Named movement with a stable ID | Created once, renamed freely, archived not deleted |
| **Template** | Reusable workout plan (exercises + planned sets) | Created, edited anytime; can be updated from a finished workout if it diverged |
| **Workout** | One performed instance, always created from a template | Created → lives in `Active/` while in progress → moved to `Completed/` on finish (or `Abandoned/` if discarded) |

Templates and Workouts are **separate files**, not one object with a status field. A Workout may reference the Template it started from, but is independent once created — editing it never silently mutates the template.

---

## 2. File layout

```
VaultRoot/
  Workouts/
    Exercises/
      Squat.md
      Pull Up.md
      Bench Press.md
    Templates/
      Push Day.md
      Leg Day.md
    Active/
      2026-06-20 Push Day.md          ← exists only while in_progress (0 or 1 file)
    Completed/
      2026-06-18 Push Day.md
      2026-06-15 Leg Day.md
    Abandoned/
      2026-06-14 Leg Day.md           ← workouts discarded mid-session
```

- Base path and sub-folder names configurable in plugin settings; structure above is the default.
- Workout filenames: `YYYY-MM-DD <Template Name>.md`, with `-2`, `-3` suffix for multiple sessions same day.
- One file = one whole workout/template, all exercises and sets nested inside.

---

## 3. Exercise file

`Workouts/Exercises/Squat.md`
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

`Workouts/Templates/Push Day.md`
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

---

## 5. Workout file (performed instance)

Lives in `Workouts/Active/` while `status: in_progress`, moved verbatim to `Workouts/Completed/` on finish.

`Workouts/Active/2026-06-20 Push Day.md`
```markdown
---
type: workout
workout_id: wkt-a91f3
template_id: tpl-7c1d
template_name: Push Day
status: in_progress
date: 2026-06-20
started: "2026-06-20T18:02:11"
completed:
duration_minutes:
current_phase_started: "2026-06-20T18:14:55"
exercise_count: 3
total_sets_planned: 9
total_sets_completed: 4
total_volume_kg: 1875
exercises:
  - exercise_id: ex-3f9a2b
    name: Bench Press
    order: 1
    sets:
      - set: 1
        planned_reps: 10
        planned_weight: 60
        reps: 10
        weight: 60
        done: true
        started: "2026-06-20T18:02:11"
        duration_seconds: 42
      - set: 2
        planned_reps: 8
        planned_weight: 65
        reps: 8
        weight: 65
        done: true
        started: "2026-06-20T18:05:30"
        duration_seconds: 38
      - set: 3
        planned_reps: 8
        planned_weight: 65
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
        planned_reps: 10
        planned_weight: 30
        reps: 10
        weight: 30
        done: true
        started: "2026-06-20T18:14:55"
        duration_seconds: 35
      - set: 2
        planned_reps: 8
        planned_weight: 32.5
        reps:
        weight:
        done: false
        started:
        duration_seconds:
      - set: 3
        planned_reps: 8
        planned_weight: 32.5
        reps:
        weight:
        done: false
        started:
        duration_seconds:
  - exercise_id: ex-9b2c40
    name: Tricep Pushdown
    order: 3
    sets:
      - set: 1
        planned_reps: 12
        planned_weight: 20
        reps:
        weight:
        done: false
        started:
        duration_seconds:
      - set: 2
        planned_reps: 12
        planned_weight: 20
        reps:
        weight:
        done: false
        started:
        duration_seconds:
      - set: 3
        planned_reps: 10
        planned_weight: 22.5
        reps:
        weight:
        done: false
        started:
        duration_seconds:
---

# Push Day — 2026-06-20

## Bench Press
| Set | Planned Reps | Planned Weight | Reps | Weight (kg) | Done | Started | Duration (s) |
|---|---|---|---|---|---|---|---|
| 1 | 10 | 60 | 10 | 60 | ✅ | 18:02:11 | 42 |
| 2 | 8 | 65 | 8 | 65 | ✅ | 18:05:30 | 38 |
| 3 | 8 | 65 | 7 | 65 | ✅ | 18:09:02 | 45 |

## Overhead Press
| Set | Planned Reps | Planned Weight | Reps | Weight (kg) | Done | Started | Duration (s) |
|---|---|---|---|---|---|---|---|
| 1 | 10 | 30 | 10 | 30 | ✅ | 18:14:55 | 35 |
| 2 | 8 | 32.5 |  |  | ⬜ |  |  |
| 3 | 8 | 32.5 |  |  | ⬜ |  |  |

## Tricep Pushdown
| Set | Planned Reps | Planned Weight | Reps | Weight (kg) | Done | Started | Duration (s) |
|---|---|---|---|---|---|---|---|
| 1 | 12 | 20 |  |  | ⬜ |  |  |
| 2 | 12 | 20 |  |  | ⬜ |  |  |
| 3 | 10 | 22.5 |  |  | ⬜ |  |  |
```

Notes:
- **`status`** (`in_progress` → `completed`, or `in_progress` → `abandoned`) is authoritative; the plugin moves the file between `Active/`, `Completed/`, and `Abandoned/` to match, via `app.fileManager.renameFile()` (preserves any wikilinks pointing at it).
- **`current_phase_started`**: the single timestamp the live stopwatch needs. Present only while `in_progress`, cleared on completion. On plugin load, if a workout has `status: in_progress`, the timer is recomputed as `Date.now() - current_phase_started` — not from a running interval, so it's correct immediately after reopening Obsidian regardless of how long it was closed.
- **Planned vs actual columns both present** on every set row — plan is fixed when the workout starts (or copied from the template), actual is filled in live and freely editable afterward, anywhere, on any set (past, current, or future).
- **Adding sets mid-workout**: plugin appends a new entry to both the `sets` array and the table row for that exercise; `planned_*` can be left blank or mirror the actual values for ad-hoc sets. No new exercises can be added mid-workout — only new sets to exercises already in the workout.
- **Incomplete sets on finish**: if the workout ends while some sets are `done: false`, those sets are kept in the completed file as-is (with blank actuals). This records the intended plan faithfully — a cut-short workout is not the same as a different workout. The template is NOT pruned to match what was actually done.
- Frontmatter summary fields (`total_volume_kg`, `total_sets_completed`, etc.) are recomputed by the plugin on every change.
- **Timestamp format**: all datetime values (`started`, `current_phase_started`, `completed`, per-set `started`) are stored as **quoted ISO-8601 strings** (e.g. `"2026-06-20T18:02:11"`), never as bare YAML timestamps — this keeps `metadataCache` parsing predictable and avoids timezone auto-coercion. `date` is a plain `YYYY-MM-DD` date.

---

## 6. Live "Active Workout" UI

Two tabs, **dark theme only** — forced via a scoped CSS class on the view container, completely independent of the vault's current theme. There is no light mode variant; the plugin always renders dark. Large tap targets for phone use in the gym.

### Tab 1 — Stopwatch
- One large centered timer. Sits at `0:00` until the first **Start Set** press. Resets to `0` and restarts on **every** press of Start Set or End Set (no separate "rest" vs "set" mode — single continuous counter). `current_phase_started` is written to the file on every reset.
- Current exercise name, "Set X of Y" indicator.
- Planned weight/reps shown large; become editable the moment **Start Set** is pressed (pre-filled from planned values).
- One big toggle button:
    - **Start Set** → timer resets & starts, fields become editable, button becomes **End Set**.
    - **End Set** → commits `reps`/`weight`/`duration_seconds` to that set, marks `done: true`, timer resets & restarts immediately, advances to next planned set, button reverts to **Start Set**.
- Manual prev/next navigation to jump between sets out of order if needed.

### Tab 2 — All Sets
- Sets grouped by exercise, in order, each row showing planned vs actual, done/not-done state.
- Inline editing of reps/weight on any set, completed or not.
- Add new set to any exercise block (ad-hoc sets — `planned_*` mirrors actual on entry).
- Delete a set from any exercise block.
- Reorder exercise blocks and reorder sets within a block (simple up/down controls — no drag-and-drop dependency needed).
- **No adding new exercises mid-workout.** The exercise list is fixed at workout creation time. If the exercise list needs changing, finish or abandon and create a new workout.

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
6. On finish: `status → completed`, `completed`/`duration_minutes` finalized, `current_phase_started` cleared, file moved from `Active/` to `Completed/`. Incomplete sets remain in the file with blank actuals and `done: false`.

---

## 8. Resuming after closing Obsidian

- Every change to the active workout autosaves (debounced ~300–500ms) via `app.vault.process()` — no explicit "save" button during the workout.
- On plugin load, check for a workout with `status: in_progress` (tracked via a small plugin-settings pointer or by scanning `Active/`, which should only ever contain 0 or 1 file). If found, the Active Workout view can be reopened directly via ribbon icon or command, landing back exactly where you left off, with the timer correctly recalculated from `current_phase_started`.
- If the user tries to **start a new workout** while one is already `in_progress`, show a prompt: **"A workout is already in progress — resume it or abandon it?"**
    - **Resume** → opens the existing active workout view.
    - **Abandon** → sets `status: abandoned`, clears `current_phase_started`, and moves the file from `Active/` to `Workouts/Abandoned/` (via `fileManager.renameFile()`). Abandoned workouts are preserved, not deleted — they keep whatever sets were completed, so a later AI coach can still see interrupted attempts. A new workout can then begin.

---

## 9. Dataview / Bases queries this schema supports out of the box

```dataview
TABLE date, duration_minutes, total_sets_completed, total_volume_kg
FROM "Workouts/Completed"
WHERE type = "workout"
SORT date DESC
```

```dataview
TABLE total_planned_sets, exercise_count
FROM "Workouts/Templates"
WHERE type = "workout-template"
```

Per-exercise history across all workouts (e.g. "all Bench Press sets over the last year") requires scanning the `exercises[].sets` arrays inside frontmatter across all files in `Completed/` — doable today via a short DataviewJS script since the data is fully structured in frontmatter (no markdown-table parsing needed). A dedicated in-plugin "Exercise Progress" view is a natural v2 feature once there's real history to query against — current schema already supports it without any migration, since `exercise_id` is the consistent join key everywhere.

---

## 10. Build order

1. **Frontmatter serializer + body renderer** — the shared core both Template and Workout files depend on. Reads structured data from frontmatter (via `metadataCache` or by parsing the YAML block), and serializes data → YAML frontmatter + regenerated body tables. Because frontmatter is the only source of truth (§11), there is **no table-parsing path** — the body is write-only output. Get the round-trip (data → file → data, reading only frontmatter) solid first, with unit tests on the type schema and table rendering (blank cells, `weight: 0` → "BW", missing/null actuals).
2. **Exercise CRUD** — list view, add/rename/archive. Simplest piece, validates the parser on a minimal schema.
3. **Template builder UI** — create/edit templates, add exercises (with inline "create new exercise" if missing), add/reorder/edit sets.
4. **Workout creation from template** — clones the chosen template's data into a new `Active/` file, sets `status: in_progress`, `started`. There is **no "from scratch" creation** — every workout starts from a template. To work a new exercise, add it to a template first, then start a workout. `current_phase_started` is left blank until the first Start Set press (timer sits at `0:00`).
5. **Active Workout view** — Tab 1 (stopwatch) and Tab 2 (all sets), timestamp-based timer, autosave on every mutation.
6. **Finish flow** — diff against template, confirmation modal, file move to `Completed/`.
7. **History view** — list of completed workouts, read-only or editable detail view.
8. **Settings** — configurable folder paths (base path + `Exercises/`, `Templates/`, `Active/`, `Completed/`, `Abandoned/` sub-folder names).
9. *(Later)* Exercise progress view / DataviewJS examples, bodyweight tracking, AI-coach-facing export helpers.

---

## 11. Key technical decisions carried through the design

- **Stable identity via generated IDs** (`exercise_id`, `template_id`, `workout_id`), never derived from filenames/titles — renames never break links.
- **Frontmatter holds full structured data, not summaries** — required for both Dataview/Bases queries and future AI-coach consumption without table parsing.
- **Timer correctness via stored timestamps, not running intervals** — survives Obsidian restarts without drift.
- **File location follows `status`, not the other way around** — frontmatter is the source of truth, folder placement is a plugin-managed consequence.
- **No deletion of Exercises** — archive only, to keep historical Workout/Template data intact.
- **Sync direction: frontmatter → body** — frontmatter is the single source of truth; the plugin always writes frontmatter first and regenerates the body tables from it. Body tables are a human-readable view, not a second source of truth. If a user or AI agent wants to edit data outside the plugin, they should edit the YAML frontmatter directly (not the markdown table). See §1 notes for the reasoning.