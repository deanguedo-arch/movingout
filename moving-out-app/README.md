# Moving Out Project Budget App

Offline-first React + TypeScript app for the "Moving Out / Life After High School Budgeting" assignment.

## Stack
- Vite + React + TypeScript
- IndexedDB (`idb`) for local persistence (submission, evidence blobs, logs)
- Vitest for deterministic rule/storage/export tests
- JSZip for ZIP export/import

## Core Product Features
- Schema-driven assignment UI from `schema/assignment.schema.json`
- Teacher constants from `schema/constants.json` with teacher-mode overrides
- Deterministic rules engine (`src/rules/compute.ts`, `src/rules/flags.ts`)
- Itemized essentials tables with assignment-style dropdowns (food, clothing, health, recreation, misc)
- Per-field info popovers `(i)` for tax/income and key budgeting inputs
- Section guide cards (what to do, what changed, how to research now)
- Evidence capture (URL + optional `jpg/png/webp/pdf` upload) stored as blobs
- Append-only event log for edits/evidence/compute/pin/export/import/constants
- Pinning for housing + transportation choices
- Comparison Sheet artifact generation from pinned items only
- ZIP export/import workflow for full submission package transfer
- Edmonton/Alberta current-context snapshot cards:
  - Auto refresh: ETS monthly pass, Alberta minimum wage
  - Teacher managed: Alberta gas benchmark, Canada CPI YoY
- Service worker registration for offline-first usage after initial load

## Install / Run
```bash
npm install
npm run dev
```

## Test / Build / Lint
```bash
npm test
npm run build
npm run lint
```

## Data and Single Source of Truth
- Assignment schema: `schema/assignment.schema.json`
- Scenario constants: `schema/constants.json`

React sections/forms are rendered from schema definitions and compute/flags run from pure functions.

## Compatibility
- Legacy `1.1.0` submissions are migrated to `1.2.0` on load/import.
- Migration maps old scalar essentials fields into new table fields.

## Key Paths
- Rules engine: `src/rules/`
- Storage and logs: `src/storage/`, `src/logs/`
- Evidence + pinning + artifacts: `src/evidence/`, `src/pinning/`, `src/artifacts/`
- Export/import: `src/export/`
- Screen features: `src/features/`
- Integrations: `src/integrations/`
- Test fixtures: `fixtures/submissions/`, `fixtures/expected/`

## ZIP Contents
Export package contains:
- `submission.json`
- `schema.json`
- `constants.json`
- `event_log.jsonl`
- `evidence/items.json`
- `evidence/manifest.json`
- `evidence/evidence_<fileId>_<filename>`
- `artifacts/comparison_sheet.html`
- `artifacts/summary.json`
- `teacher_summary.json`

## Notes
- Teacher passcode default comes from `schema/constants.json` (`teacher_mode.default_passcode`).
- This app is local-first and does not require network access after initial asset cache.
