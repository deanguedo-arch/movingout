# User Manual

## 1. Student Workflow
1. Open Dashboard (`/`) and review current completion and budget summary.
2. Open each section in the left sidebar and read the `Section Guide` card.
3. Enter inputs and use `(i)` info popovers beside labels when you need definitions/context.
4. In Essentials, fill itemized tables:
   - Food + household weekly planner
   - Clothing annual planner (auto monthly conversion)
   - Health/hygiene annual planner (auto monthly conversion)
   - Recreation annual planner (auto monthly conversion)
   - Misc monthly planner
3. Use `Calculate / Check Budget` in sections to refresh derived values and readiness flags.
4. Open Evidence Center (`/evidence`) and add:
   - Rental ad URL (+ optional file upload)
   - Vehicle ad URL (+ optional file upload)
5. Return to Housing and Transportation sections and click `Pin this option` for chosen options.
6. Open Comparison Sheet (`/comparison`) and regenerate/print the pinned snapshot.
7. Open Readiness Check (`/readiness`) to review fix-next items.
8. Open Export / Import (`/transfer`) and click `Export ZIP` for submission package.

## 2. Teacher Workflow
1. Open Scenario Settings (`/settings`) to view read-only current-context snapshots and assumptions.
2. Open Teacher Mode (`/teacher`) and enter passcode.
3. Use `Refresh Transit` and `Refresh Minimum Wage` to update auto-fetched snapshots.
4. Manually maintain:
   - Alberta gas benchmark value/source/date
   - Canada CPI YoY value/source/date
5. Edit deduction rates, thresholds, transportation defaults, and loan table points.
6. Click `Save Constants` to apply new values for local scenario.
5. Optional: click `Reset To Defaults` to restore constants from `schema/constants.json`.

## 3. Import Workflow
1. Open Export / Import (`/transfer`).
2. Select an exported ZIP file.
3. Click `Import ZIP`.
4. App restores submission, evidence blobs, constants snapshot, and event log.

## 4. Readiness Flags
Readiness page reports:
- Missing required fields
- Missing required evidence
- Affordability warning
- Deficit warning
- Fragile buffer warning
- Low vehicle price warning
- Unsourced category warning
- Ordered "Fix Next" list

No extra gating steps are required after calculate/check.

## 5. Manual Test Checklist
- [ ] Dashboard loads with computed net income and expenses.
- [ ] Section fields render from schema and persist after refresh.
- [ ] `(i)` info popovers open/close and show guidance text.
- [ ] Section Guide card appears for each section.
- [ ] Derived fields update deterministically after edits.
- [ ] Essentials tables compute expected monthly totals from annual rows.
- [ ] Evidence URL + file upload saves and shows in Evidence Center.
- [ ] Missing evidence warning clears when required evidence URL is provided.
- [ ] Housing and Transportation pin buttons create/update pinned choices.
- [ ] Comparison page shows pinned choices only and printable preview.
- [ ] Export ZIP includes required files and evidence attachments.
- [ ] Import ZIP restores prior submission state and evidence.
- [ ] Legacy `1.1.0` submission imports and is migrated to table fields.
- [ ] Event log includes FIELD_EDIT/EVIDENCE/PIN/EXPORT/IMPORT/CONSTANTS events.
- [ ] Teacher mode passcode unlocks constants/snapshot editing and recomputes results.
- [ ] App remains usable offline after first load (service worker cache).
