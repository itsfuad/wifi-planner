# Bugfix: wifi-planner

Source report(s): `verification/wifi-planner.nightmare.md`
Date: 2026-10-03
Mode: applied directly

## Results

1. Reload overwrites the saved plan with an empty plan — **Fixed**

   Saved plans are restored and validated before autosave starts. Save failures now surface an error notice.

2. Import accepts incomplete plans that crash rendering — **Fixed**

   Added a shared plan parser with validation, legacy router migration, duplicate/reference checks, and non-destructive import errors.

3. Coverage from a previous plan is displayed as Live — **Fixed**

   Simulation results now carry a plan revision and plan ID. Stale results are labeled “Needs update” and offer reanalysis; worker failures are surfaced.

4. Shortening a wall leaves attached doors beyond its endpoint — **Fixed**

   Wall and door reducer actions clamp attached door widths and positions to the updated wall geometry.

5. Splitting one wall into adjacent segments changes RF loss at the joint — **Fixed**

   Collinear wall hits at the same ray point are deduplicated. A regression test protects segmentation invariance.

6. Mesh configuration is disconnected from usable-connectivity estimates — **Fixed, open item**

   Mesh topology, wireless backhaul strength, multi-hop paths, airtime reservation, and sibling backhaul sharing now determine usable coverage and usable median link estimates, with visible warnings for disconnected or capacity-limited nodes.

7. Narrow screens clip essential controls — **Fixed, open item**

   Added a compact responsive layout, two-finger canvas panning, touch event cancellation, and a DOM object list for keyboard selection. A dedicated physical-device gesture pass remains open.

## Additional improvements applied

- Added Vitest regression coverage for validation, legacy migration, doors, RF wall segmentation, mesh connectivity, and sibling backhaul capacity.
- Added `npm run test`, formatting scripts, and a GitHub Actions workflow for format, lint, test, and build checks.
- Resolved all ESLint errors and warnings.
- Replaced `Dispatch<any>` with the typed action/history dispatch type.
- Added numeric input bounds in the properties panel.
- Standardized the simulation default to 20 cm.
- Added worker grid-size bounds, large-grid protection, transferable heatmap buffers, and code-split Vite bundles.
- Added mesh backhaul airtime sharing, multi-hop capacity propagation, and sibling-capacity regression coverage.
- Updated README usage, RF assumptions, mesh behavior, and JSON schema examples.
- Removed the duplicate pnpm lockfile; npm is the repository package-manager source of truth.

## Files changed

- `src/App.tsx`
- `src/index.css`
- `src/model/PlanContext.tsx`
- `src/model/geometry.ts`
- `src/model/history.ts`
- `src/model/plan.test.ts`
- `src/model/validation.ts`
- `src/sim/mesh.ts`
- `src/sim/mesh.test.ts`
- `src/sim/physics.ts`
- `src/sim/physics.test.ts`
- `src/sim/useSimulation.ts`
- `src/sim/worker.ts`
- `src/ui/EditorCanvas.tsx`
- `src/ui/PropertiesPanel.tsx`
- `src/ui/SimulationPanel.tsx`
- `src/utils/signal.ts`
- `package.json`
- `package-lock.json`
- `vite.config.ts`
- `.github/workflows/ci.yml`
- `README.md`

## Open items for a human

- Validate touch gestures on actual iOS and Android devices, especially pan-versus-draw cancellation and multi-touch behavior.
- Decide whether mesh usable throughput should eventually model channel contention and client-level scheduling in more detail; the current implementation provides conservative backhaul-aware coverage, not a full network-capacity simulator.
- The broader product scopes from the report—calibrated floor-plan underlays, explicit analysis regions, scenario comparison, and measured RF calibration—remain future work rather than being invented inside this bugfix pass.

## Verification

- `npm run format:check` — passed
- `npm run lint` — passed
- `npm run test` — passed: 3 files, 7 tests
- `npm run build` — passed; Vite output is split into React, canvas, icons, app, and worker chunks
- Chrome browser probe — passed persistence, invalid import, stale-result, narrow viewport, and no-page-error checks
