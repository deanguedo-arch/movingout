# Moving Out Budget App Architecture

## Overview
This project is an offline-first, schema-driven budgeting app for the "Moving Out / Life After High School" assignment. It replaces booklet workflow with guided sections, deterministic budget computation, evidence attachment capture, readiness flags, and export/import review packages.

## Core Architecture Decisions

### 1) Schema-Driven UI
- `schema/assignment.schema.json` defines sections, fields, requiredness, field role (`input`, `derived`, `reflection`), validation hints, and pin-enabled sections.
- UI screens render forms and section navigation from schema objects.
- No section field lists are hardcoded in components.

### 2) Deterministic Compute + Flags
- Budget math is in pure functions under `src/rules/compute.ts`.
- Readiness/warning logic is in pure functions under `src/rules/flags.ts`.
- Functions consume only `inputs + constants + schema/evidence state` and return deterministic outputs.
- Currency math is rounded predictably using cent-based helpers.

### 3) Offline-First Persistence (IndexedDB)
- IndexedDB is the persistence layer for:
  - submission record
  - teacher constants overrides
  - evidence item metadata
  - evidence file blobs
  - append-only event log
- Evidence uses Option A: uploaded files stored as blobs in IndexedDB.

### 4) Append-Only Audit Trail
- Event log entries are immutable and monotonic (`seq`).
- Events include field edits, evidence actions, compute runs, pin actions, constants edits, export, and import.
- Logs are exported with the submission package.

### 5) ZIP Transfer Boundary
- Export builds one ZIP package containing submission data, schema/constants snapshot, event log, evidence files, and generated artifacts.
- Import restores submission + evidence blobs + log + constants state for continuation or teacher review.

## Main Runtime Flow
1. Load schema/constants snapshots.
2. Load local submission/evidence/log state from IndexedDB.
3. Render dashboard + sections from schema.
4. On edits, recompute derived totals and readiness flags, then persist and append events.
5. Generate comparison artifact from pinned choices only.
6. Export/import state through ZIP boundary.

## Boundaries and Responsibilities
- `src/schema/*`: schema/constants types + loaders.
- `src/rules/*`: pure compute and flags logic.
- `src/storage/*`: IndexedDB persistence.
- `src/logs/*`: append-only event APIs.
- `src/features/*`: UI slices and route pages.
- `src/export/*`: ZIP export/import logic.
- `src/artifacts/*`: generated printable comparison output.

## Quality Controls
- Fixtures + unit tests verify deterministic math, flagging rules, and import/export integrity.
- Rule changes require test updates/additions.
- Checkpoint-based commits keep changes reviewable and reversible.
