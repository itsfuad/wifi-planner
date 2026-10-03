# Nightmare Test: wifi-planner

Date: 2026-10-03
Target: Repository-wide review of the Wi-Fi planning application
Lens: Code and product — saved-work durability, editor invariants, RF model consistency, simulation lifecycle, and usability
Verified by: Clean npm install, production build, ESLint, real-app Playwright checks in installed Google Chrome, and direct probes of the bundled reducer, physics functions, and worker handler

## Summary

The project has a sensible client-side foundation: React/TypeScript, a reducer-backed plan with undo/redo, Konva editing, and worker-based RF computation. Seven findings were confirmed (2 High, 5 Medium), with the highest priority being saved-plan loss on reload and malformed-import crashes. Improvement work should prioritize reliable persistence and trustworthy results, then automated regression coverage and maintainability, before expanding the modeling features.

## Verification results

| Check                                                               | Result                                                                                                                                                 |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm ci --no-audit --no-fund`                                       | Passed; 185 packages installed                                                                                                                         |
| `npm run build`                                                     | Passed TypeScript checking and Vite production build                                                                                                   |
| Build output                                                        | Main JS: 565.84 kB minified / 174.85 kB gzip; worker: 3.04 kB; Vite reported the >500 kB chunk warning                                                 |
| `npm run lint`                                                      | Failed: 20 errors, 5 warnings                                                                                                                          |
| Browser persistence, stale-result, import, and narrow-screen probes | Reproduced findings below against the actual app                                                                                                       |
| Reducer and RF probes                                               | Reproduced wall/door and mesh behaviors below                                                                                                          |
| Existing automated test suite                                       | No test script in `package.json`; no test/spec files under `src`; `verification/TEST_RESULTS.md` records earlier checks without their executable tests |

The install/browser limitations described in the existing verification notes did not apply to this environment. Temporary probe tooling was kept in `/tmp/omnirush/wifi-planner-review/`; the probe is `probe.mjs`. No application implementation was changed during this review. These checks are targeted reproductions, not an exhaustive interaction or RF accuracy certification.

## Findings

### 1. Reload overwrites the saved plan with an empty plan — Fixed

**Severity:** High | **Likelihood:** Likely

**Scenario:** Create a layout, wait for “Saved locally,” then reload or reopen the application. Startup initializes an empty plan and autosaves it over the previous plan after 350 ms.

**Why it's realistic:** Reloading and returning to previously saved work are normal operations. “Open local” reads the same storage key after it has already been overwritten.

**Impact:** Loss of the locally saved drawing unless a separate JSON export exists.

**Evidence:** `src/model/PlanProvider.tsx:7` initializes from `initialPlan`; `src/model/PlanContext.tsx:8-16` defines that plan as empty; `src/App.tsx:3` writes `wifi-planner-v2` on initial mount without first restoring it.

**Verified:** In Chrome, selected Studio, waited for autosave, and reloaded. The saved plan changed from 6 walls / 1 AP to 0 walls / 0 APs.

**Suggested direction:** Restore and validate saved data during initialization before enabling autosave. Handle storage failures explicitly; the current `try/finally` resets the indicator to “Saved locally” even if writing throws. Add a reload regression test and test the failed-write state. Effort: small–medium.

### 2. Import accepts incomplete plans that crash rendering — Fixed

**Severity:** High | **Likelihood:** Possible

**Scenario:** Import syntactically valid JSON containing `{"walls":[],"routers":[]}`, or load a malformed saved plan.

**Why it's realistic:** JSON is a documented exchange format, and users can edit files or use older exports. Import checks only two arrays; local load trusts parsed JSON entirely.

**Impact:** The app crashes instead of rejecting the document. Invalid enum values, missing numeric fields, and dangling references can also reach rendering and simulation.

**Evidence:** `src/App.tsx:3` (`imp` and `load`); `src/model/PlanContext.tsx:42-43` accepts `SET_PLAN` unchanged; `src/ui/EditorCanvas.tsx:774,808` assumes doors and obstacles exist.

**Verified:** Uploaded the two-array JSON through the real file input. Chrome reported `Cannot read properties of undefined (reading 'map')`; the application shell was removed.

**Suggested direction:** Use one versioned parse/validate/migrate boundary for imports and local restoration. Validate all arrays, finite bounded dimensions and numbers, enums, unique IDs, and entity references; bound grid work before allocation. Show actionable errors while retaining the current valid plan. Update the README's legacy router example alongside the schema. Effort: medium.

### 3. Coverage from a previous plan is displayed as Live — Fixed

**Severity:** Medium | **Likelihood:** Likely when using manual analysis

**Scenario:** Analyze Studio, disable live analysis, then switch to Office or edit the plan. Old results remain displayed with a “Live” badge.

**Why it's realistic:** Manual analysis is an exposed workspace option, particularly useful for larger layouts.

**Impact:** The displayed heatmap and metrics no longer describe the current layout. A worker failure can also leave the previous result visible without an error state.

**Evidence:** `src/sim/useSimulation.ts:7,13-20,27-36` retains results without associating them with a plan revision and only clears the busy flag on worker errors. `src/App.tsx:3` gates results on AP count, not plan identity. `src/ui/SimulationPanel.tsx:2` labels any non-running result “Live.”

**Verified:** In Chrome, computed Studio, disabled live analysis, and selected Office. The prior coverage heading remained unchanged and still read “Live.” Code inspection confirmed that no new run is scheduled in that mode and the same result object is retained.

**Suggested direction:** Associate each result with the plan revision and resolution used. Represent empty, running, current, stale, and failed states explicitly. Cancel/invalidate pending work on relevant changes and offer “Reanalyze” for stale data. Effort: medium.

### 4. Shortening a wall leaves attached doors beyond its endpoint — Fixed

**Severity:** Medium | **Likelihood:** Likely when reshaping rooms

**Scenario:** A 10 m wall has a door centered 8 m from its start. Shorten the wall to 4 m using its endpoint handle.

**Why it's realistic:** Endpoint editing is a primary editor interaction, including connected-wall edits.

**Impact:** The door remains associated with the wall but is drawn past its endpoint. It no longer replaces wall attenuation where a user expects an opening.

**Evidence:** `src/ui/EditorCanvas.tsx:677-685` dispatches wall updates; `src/model/PlanContext.tsx:48-52` updates geometry without reconciling doors. Door-only movement clamps distance, but wall reshaping does not. Placement at `EditorCanvas.tsx:504-509` and door-width edits also lack complete wall-fit validation.

**Verified:** Called the actual reducer with a wall update from 1,000 cm to 400 cm. The attached 80 cm door retained `distance: 800`.

**Suggested direction:** Enforce door-fit invariants atomically with wall edits in the model. Define behavior for walls shorter than their doors, constrain placement/resizing, and share the geometry calculation with previews. Effort: medium.

### 5. Splitting one wall into adjacent segments changes RF loss at the joint — Fixed

**Severity:** Medium | **Likelihood:** Possible

**Scenario:** Represent a continuous wall as two collinear segments. A ray crosses their shared endpoint.

**Why it's realistic:** Walls are drawn as individual segments and frequently meet at grid-aligned endpoints. Grid-aligned routers and sample points make exact shared-joint crossings reproducible.

**Impact:** The ray receives attenuation twice for one physical barrier, producing artificial low-signal artifacts dependent on how the wall was drawn.

**Evidence:** `src/sim/physics.ts:10-16` accepts intersections at both segment endpoints; `src/sim/physics.ts:41` applies loss for every wall hit independently.

**Verified:** For a 5 GHz ray crossing a 15 cm brick wall, RSSI was approximately -56.55 dBm. Representing the same wall as two segments split at the crossing changed it to -65.75 dBm: an extra 9.2 dB loss.

**Suggested direction:** Define shared-joint crossing semantics and avoid counting the same collinear physical barrier twice. Preserve separate losses for genuinely distinct barriers. Add segmentation-invariance and endpoint/corner regression cases. Effort: medium.

### 6. Mesh configuration is disconnected from usable-connectivity estimates — Fixed, open item

**Severity:** Medium | **Likelihood:** Possible when planning mesh deployments

**Scenario:** A mesh satellite has no valid uplink or a very weak wireless backhaul, but has a strong local signal to nearby clients.

**Why it's realistic:** The inspector exposes mesh roles and parent selection; selecting the satellite role does not require choosing a parent.

**Impact:** Users cannot infer usable mesh service from the coverage card. Strong local radio coverage is physically possible without an uplink, but the current view does not distinguish that from a working network or account for backhaul bottlenecks. This is a product/modeling gap rather than evidence that the local RSSI calculation itself should change.

**Evidence:** `src/sim/worker.ts:6` considers AP power, gain, band, and geometry only. `src/utils/signal.ts:6-38` computes a separate backhaul RSSI used by canvas coloring, not worker metrics. `src/ui/PropertiesPanel.tsx:7` exposes the mesh configuration.

**Verified:** A satellite referencing a missing parent produced the exact same grid as a standalone AP. Its backhaul helper returned -120 dBm while the worker reported 100% coverage and a 600 Mbps median local-link estimate.

**Suggested direction:** Clearly separate radio coverage, uplink availability, and estimated end-to-end capacity. Validate mesh topology, flag unconnected nodes, and account for wireless backhaul limits/hops when offering usable-throughput estimates. Effort: medium–large.

### 7. Narrow screens clip essential controls — Fixed, open item

**Severity:** Medium | **Likelihood:** Likely on narrow viewports

**Scenario:** Open the application on a phone-sized screen or a narrow desktop window.

**Why it's realistic:** The application is browser-based and has no responsive fallback layout.

**Impact:** Essential controls are outside the visible viewport. The current canvas interactions are also wired to mouse handlers, so touch editing needs explicit implementation and verification.

**Evidence:** `src/index.css:1` sets `body{min-width:1040px;min-height:680px;overflow:hidden}` and fixed-width sidebars; `src/ui/EditorCanvas.tsx:720-728` uses mouse events for primary editing.

**Verified:** At a 390 × 844 viewport in Chrome, the body was 1,040 px wide, the properties panel began at x=754, and body overflow was hidden. Touch interaction behavior was inspected in code, not exercised on a touch device.

**Suggested direction:** Add collapsible tool/inspector panels, move or collapse floating metrics at narrow widths, and support pointer/touch gestures with cancellation/capture behavior. Provide a usable compact layout even if full editing remains desktop-first. Effort: medium–large.

## Additional improvement scopes

### A. Establish repeatable regression checks — high priority, medium effort

- Commit reducer and RF tests, rather than relying on historical verification prose. Cover door constraints, topology-preserving edits, atomic delete/undo, rotated obstacles, and wall-segmentation invariance.
- Add browser tests for save/reload, valid and invalid imports, drawing/dragging, undo/redo, simulation invalidation, and worker errors.
- Add a CI job running the chosen lockfile install, lint, tests, and production build. No tracked `.github` workflow was present.
- Resolve the current lint failures: loose `any` types, case-block declarations, expression statements, and ref reads during render. The ref diagnostics are evidence of a state-model concern, not independent proof of every possible interaction failure.

### B. Make source code maintainable — high priority, small–medium effort

- Format the source consistently. `App.tsx` has 4 lines, `PropertiesPanel.tsx` 7, and `worker.ts` 6; substantial logic is effectively manually minified. This makes reviews and debugging needlessly difficult without improving bundled size.
- Give real boundaries ownership: persistence/import logic, canvas gesture state, geometry commands, pure RF grid computation, and the worker transport. The 895-line `EditorCanvas.tsx` currently owns nearly all editing behaviors and rendering.
- Type `PlanContext.dispatch` using the actual action union instead of `Dispatch<any>`.
- Use state for drag data that determines rendering; keep refs for imperative handles. Reuse model geometry for previews to avoid divergent constraint behavior.
- Bound undo history and group property editing into user-level transactions. `history.ts:48` retains another prior state per action, and inspector inputs dispatch on every keystroke.

### C. Make coverage metrics answer a defined planning question — high product value, medium–large effort

- Introduce explicit analysis areas/room polygons and per-room targets. Currently the worker samples the entire rectangular canvas, including outdoor margins and furniture footprints.
- Probe: keeping Studio's physical geometry unchanged but doubling canvas width and height changed coverage from 100% to about 94.53%. This is consistent with the current whole-canvas definition, but shows why users need an explicit area-of-interest metric.
- Add a calibrated floor-plan image underlay, editable plan dimensions, measured wall lengths, and measurement points. These make creating a faithful real-world layout much easier than tracing by grid alone.
- Add AP-placement comparison and saved scenarios after persistence is reliable; show changes in room coverage and weak spots.
- Document model assumptions and allow calibration against measured RSSI. More advanced modeling could incorporate channel width, noise/interference, antenna/client capabilities, and multiple floors. Prioritize measurement validation before expensive reflection/diffraction modeling.

### D. Profile and optimize realistic larger plans — medium priority, measured effort

- The worker loops over cells × APs × walls/obstacles, with a door search on each wall intersection. Pre-index doors by wall and precompute static obstacle geometry before adding a spatial index if benchmarks justify it.
- Transfer the output `Float32Array` buffer to the UI instead of cloning it through `postMessage`.
- Avoid recalculating geometry-only coverage for cosmetic changes such as labels/SSID. Consider coarse previews followed by a refined result during active editing.
- Profile canvas rerenders during pointer movement; tooltip and drag updates currently occur in the component that renders the full scene.
- Investigate the 565.84 kB main chunk using bundle measurements. Splitting optional UI can help; merely dividing required initial code into chunks does not eliminate its download cost.

### E. Resolve small consistency and documentation gaps — small effort

- `UIProvider.tsx:2` defaults to a simulation resolution of 24 cm, while the inspector offers 12/20/30/50 cm and `UIContext` defaults to 20 cm. Use one supported default.
- Refresh the README: walls are dragged rather than click-start/click-end; the RF model now includes an indoor log-distance exponent; the JSON router example uses obsolete `isMesh`; obstacle `height` is a planar rectangle dimension, not modeled elevation.
- Choose/document one package manager and lockfile policy; both npm and pnpm locks are committed.
- Improve numeric field validation, keyboard focus behavior, tool selected-state semantics, and screen-reader access to entities through an object list. The current canvas has no equivalent DOM entity navigator.

## Recommended sequence

1. **Persistence and safe input:** findings 1–2, with regression tests.
2. **Trustworthy editing/results:** findings 3–5, typed actions, formatting, and passing lint/CI.
3. **Planning usefulness:** analysis regions, calibrated floor plans, mesh connectivity semantics, and scenario comparison.
4. **Broader usability and scale:** compact/touch layouts, accessible entity navigation, and benchmark-driven optimization.
