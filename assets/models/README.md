# Custom 3D character models

This directory is the optional GLB model slot for Virtual Office 3D. The source artwork currently lives in `../` as PNG files. **PNG images have not been converted into full 3D meshes by this change.** A single PNG does not contain hidden/back-side geometry or a rig, so claiming that it was automatically converted into a faithful, animated 3D character would be misleading.

## Add a model

Create or obtain a rigged `.glb` model for each character and put it in this directory. For a model to work well in the office scene, prepare it with:

- feet/origin at floor level and an approximate standing height of 1.7–1.9 scene units;
- the character facing local +Z;
- a rig and at least one suitable idle/work animation clip (prefer a seated typing animation for workers);
- optimized textures and mesh size for web delivery.

Then add an entry to `manifest.json`. Example:

```json
{
  "version": 1,
  "models": {
    "alexander-data-analyst": {
      "file": "assets/models/alexander-data-analyst.glb",
      "scale": 1,
      "y": 0,
      "rotationY": 0,
      "animation": "SeatedTyping"
    }
  }
}
```

Supported keys are `alexander-data-analyst`, `olivia-product-researcher`, `ethan-marketing-strategist`, `sophia-content-creator`, `daniel-seo-specialist`, `isabella-graphic-designer`, `lucas-automation-engineer`, `charlotte-quality-controller`, and `william-bigboss`. The `animation` field is optional; when omitted, the first animation clip in the GLB is played. `x`, `y`, `z`, `rotationY`, `scale`, and `labelHeight` are optional adjustments.

If a model is not listed or fails to load, the existing articulated Three.js character remains visible. This allows models to be added incrementally without breaking the office.

## Honest conversion path from PNG

For faithful 3D results, use each PNG as the visual reference in a character-generation/modeling workflow, then export a rigged GLB. Inspect the front, side, and back before accepting it: one front-view PNG alone cannot establish accurate geometry for all sides. The current repo does not yet contain GLB character files, so this directory intentionally starts with an empty manifest.
