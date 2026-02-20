# BUDGET WEBAPP Agent Guide

## Repository Layout
- Git root: `C:\Users\dean.guedo\Documents\BUDGET WEBAPP`
- App root: `moving-out-app/` (Vite + React + TypeScript)

## Install / Run / Test / Build
Run commands from `moving-out-app/`:

```bash
npm install
npm run dev
npm test
npm run build
npm run lint
npm run preview
```

## Single Source of Truth Rule
- Assignment structure and field behavior must come from `moving-out-app/schema/assignment.schema.json`.
- Teacher-editable constants and scenario defaults must come from `moving-out-app/schema/constants.json`.
- UI must render sections and fields from schema data, not hardcoded field lists in React components.
- Compute and flags logic must be deterministic pure functions in `moving-out-app/src/rules/`.

## Checkpoint Workflow
- Implement in small checkpoints.
- After each checkpoint:
  - run tests relevant to the checkpoint (and full test suite before export/import completion),
  - verify lint/build health as applicable,
  - commit with checkpoint message.

## Definition of Done (Per Checkpoint)
- Behavior required by the checkpoint is implemented.
- Tests for new deterministic logic are present and passing.
- No regression in existing tests.
- Changes are documented if user-facing behavior changed.
- Commit is created with a checkpoint-prefixed message.
