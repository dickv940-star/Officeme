# Virtual Office 3D

## Implementation
- The room view uses Three.js 0.180.0 from jsDelivr and OrbitControls for free orbit, zoom, and pan.
- Characters are generated from original procedural geometry with an articulated hierarchy (torso, head, shoulders, elbows, hips, knees, feet). The visual states include typing, sitting, standing, and a gentle walking loop.
- The worker roster is read from the existing `appdigi_officeme_workers_v1` localStorage key. Names and roles appear on 3D labels; existing staff CRUD and room notes remain in `index.html`.
- The director, worker, and cafe rooms share the same 3D renderer. Camera reset and motion pause controls are included.
- The UI explicitly labels all motion as a visual simulation. It does not claim the characters are doing real work or that AI agents are active.

## Asset and license decision
This first implementation uses procedural geometry authored in `virtual-office-3d.js`; it does not download, bundle, or redistribute third-party character meshes. That avoids introducing an unverified character-model license into the public repository. Three.js is distributed under the MIT license; the app loads its ES module and OrbitControls from jsDelivr. The procedural character look is stylized/semi-realistic rather than photorealistic.

Possible later upgrade: Quaternius Universal Base Characters and Universal Animation Library are published as CC0 assets; if those models are added, include the exact asset files and a source/license note in this document. They are not bundled in this first pass.

## Accessibility and performance
- Honors `prefers-reduced-motion: reduce` by starting with character motion paused.
- Responsive canvas and lower pixel ratio / smaller shadow maps on narrow screens.
- Uses a low-power WebGL renderer and caps device pixel ratio.
- OrbitControls supports mouse, touch, and keyboard focus on its canvas.

## Manual smoke-test checklist
1. Open the Workers room; the 3D canvas should load and show the current saved roster.
2. Drag to rotate, wheel/pinch to zoom, right-drag/two-finger drag to pan; reset camera should restore the initial view.
3. Open Director and Cafe rooms and confirm each shows its own layout.
4. Add, edit, and remove a worker in Data Pekerja; reopen the room to confirm labels/characters reflect the saved list.
5. Save a room note and confirm the existing notes workflow still works.
6. Enable OS/browser reduced motion and reload; characters should start paused.
7. Test desktop Chrome and a mobile browser with WebGL enabled.

The repository connector cannot execute a real browser/WebGL session, so those visual smoke tests must be run in a browser after the branch is published. CI validates JavaScript syntax and key integration hooks only.
