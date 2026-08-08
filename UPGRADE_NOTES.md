# AirPlan UX + Simulation Upgrade

## Product experience
- Rebuilt the interface as a focused planning workspace with a top project bar, creation rail, central canvas, contextual inspector, and coverage health card.
- Added keyboard-first tools: V Select, R Room, W Wall, D Door, O Object, A Access Point.
- Added Space-to-pan, scroll-to-zoom, Shift multi-select, and clearer in-canvas instructions.
- Added local autosave while retaining manual save, load, JSON import, and export.
- Added Studio, Apartment, Office, and Blank starter layouts.
- Added one-drag Room creation so four connected walls are created in a single undo step.
- Added grid visibility/spacing, heatmap visibility/opacity, live analysis, and simulation-resolution controls.

## RF simulation
- Reworked path loss toward an indoor log-distance model.
- Added separate 2.4 / 5 / 6 GHz behavior and frequency-sensitive material attenuation.
- Wall thickness now influences attenuation.
- Existing door and obstacle losses are retained and frequency-adjusted.
- Added coverage distribution, median RSSI, weakest-10% RSSI, estimated median client link rate, and computation time.
- Added a smoother modern heatmap and coverage legend.

## Editing reliability
- Added batch wall actions so room creation and connected-wall edits can be represented as atomic history operations.
- Kept the worker-based simulation model so RF computation stays off the UI thread.

## Verification note
A TypeScript syntax/transpile pass succeeded for every TS/TSX source file in this sandbox. A full dependency install/build could not be completed because the sandbox npm mirror returned 404 responses for declared packages such as @types/node and zod-validation-error.

## UX interaction overhaul (verification pass)

This pass replaces the old per-node Konva dragging model with an atomic selection transaction.

### Fixed interaction behavior

- Multi-selection now moves as one unit when dragging any selected wall, object, access point, or door.
- Selected walls preserve topology: endpoints of connected unselected walls follow the moved joint instead of visually detaching.
- Doors remain attached to their parent wall when the wall moves; moving a door by itself projects motion onto that wall.
- Marquee selection now uses full object bounds instead of only checking wall endpoints/object origins.
- Room creation selects all four new walls immediately, so the room can be moved as a group.
- Only the endpoints of a single selected wall show joint handles. The previous all-wall handle clutter is removed.
- The resize/rotate Transformer is now limited to a single selected obstacle, avoiding heterogeneous multi-transform behavior.
- Delete is atomic for an entire selection, producing one undo step and cascading doors when a wall is removed.
- Deleting a mesh parent AP safely resets orphaned mesh nodes to standalone mode.
- Ctrl/Cmd+A selects all entities; Ctrl/Cmd+D duplicates the current selection; arrow keys nudge the selection.
- Ctrl/Cmd shortcuts no longer accidentally activate single-letter drawing tools.
- Added fit-plan, focus-selection, zoom in, and zoom out controls directly on the canvas.
- Empty plans no longer show a meaningless all-dead RF heatmap.

### Simulation responsiveness

Live simulations now terminate a stale worker before starting the newest run. This prevents expensive heatmap jobs from queuing behind rapid edits and visually lagging the plan.

### Verification performed in the sandbox

- TypeScript transpile/syntax pass across all TS/TSX source files: PASS.
- Interaction reducer tests covering mixed multi-selection translation, connected-wall topology, anchored doors, atomic delete, and mesh-parent cleanup: PASS.
- RF sanity tests confirming wall attenuation and stronger concrete/thickness attenuation: PASS.
- Visual regression screenshots generated from the reducer-tested before/after states and inspected manually.

A normal `npm ci` / Vite build could not be completed inside the sandbox because its configured npm mirror returns HTTP 404 for packages in the existing lockfile (for example `zod-validation-error@4.0.2`). The browser installed in the sandbox also has a managed `URLBlocklist: ["*"]`, so localhost navigation is blocked. No security policy was bypassed; screenshots were produced with an `about:blank` Playwright visual harness using the same workspace CSS and reducer-generated plan states.
