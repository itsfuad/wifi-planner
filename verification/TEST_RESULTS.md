# UX Verification Results

## Passed

- Mixed multi-selection translation: 4 walls + object + AP move with one delta.
- Connected unselected wall endpoint follows the translated selected joint.
- Door remains anchored to a translated wall.
- Door-only movement is constrained/projected to the parent wall.
- Selection deletion is atomic and cascades attached doors.
- Deleting a mesh parent clears the child parent reference and returns the child to standalone mode.
- RF sanity: drywall lowers RSSI; thicker concrete lowers it further.
- TS/TSX syntax/transpile check across `src/`: pass.

## Visual checks

- `workspace-layout-check.png`
- `multiselect-before.png`
- `multiselect-after.png`

The screenshots were generated from reducer-tested plan states and the project's current workspace CSS.

## Sandbox limitations

A clean dependency install is blocked by the sandbox npm mirror. `npm ci` returns 404 for an existing lockfile dependency (`zod-validation-error@4.0.2`). The sandbox Chromium also has a managed `URLBlocklist: ["*"]`, which blocks localhost navigation. The policy was not modified or bypassed.
