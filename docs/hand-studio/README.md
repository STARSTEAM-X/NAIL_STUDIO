# Original interactive hand asset

Preview: `/hand-studio`. Source: `model/realistic-hand-v1.blend`. Runtime:
`apps/web/public/models/realistic-hand-v1.glb` (15,012,052 bytes).

This is newly authored procedural geometry, not a modification or import of the
previous `hand.glb` or `hand_source.glb`. User photographs guide proportions and
nail appearance only; no photographic pixels or stock assets are embedded.
The model, rig, UVs and baked pigment/normal/roughness maps were created locally
through Blender MCP. No external generation services or paid asset libraries
were used. The original editor's asset is retained separately.

## Source and regeneration

Open the source blend in Blender 5.1. The active scene is `Realistic Hand Studio`;
an earlier procedural blockout is archived in another scene for recovery.
The anatomical generator is `tools/realistic_hand_anatomy.py`, which imports
shared baking/export helpers from `tools/create_realistic_hand.py`. Run the
anatomical generator with Blender's `--python` option to rebuild (it replaces
the generated scene/assets). Baking requires Cycles. `start_hand_studio_blender.py`
starts the already installed Blender MCP addon for an interactive session.

Coordinates are metres: X across the palm, Y towards fingers, Z towards dorsum.
The GLB intentionally keeps that basis (`export_yup=False`). It contains a
23-bone rig including forearm, wrist and palm, five separate closed nail shells,
five skinned cuticle lips, and five distal bone sockets. The runtime clones
independent skeletons for each hand and mirrors the left instance across X.

## Realism pass (anatomy-3)

Rebuilt through the Blender MCP bridge from `tools/realistic_hand_anatomy.py`:

- Finger widths follow anatomical stations (MCP base, PIP/DIP condyles,
  narrower middle phalanx, pulp that widens beside the nail) instead of a
  linear taper; the distal pulp bulges below and beside the plate.
- Interdigital webs are palmar wedges with a rounded free edge, giving the
  U-shaped saddle between fingers; the old unioned spheres (knuckle blobs) are
  gone. A thumb–index web and smooth thenar/hypothenar swelling replace the
  stick-on thumb base. The dorsal palm sinks under the finger roots so the
  metacarpal heads read as knuckles; junctions get an extra local relax.
- Nail groove: the bed is recessed 0.26 mm and lateral folds rise 0.18 mm, so
  the plate sits inside the skin rather than capping the fingertip.
- Pigment zones (knuckle and fingertip blush, pinker palm, warmer dorsum,
  bluish veins) are multipliers around a neutral mean, so any runtime tone
  still applies. Softer palmar and wrist creases.
- Seam-based UVs: dorsal/palmar halves per finger, palm and forearm
  (~16 islands instead of hundreds of smart-project fragments).
- Runtime skin uses per-channel wrapped diffuse (approximate subsurface
  scattering) and a warm sheen; the key light casts soft shadows outside
  low quality.

Previews: `v2-hand-dorsal.png`, `v2-hand-palmar.png`, `v2-knuckles.png`,
`v2-nail-index.png` (Blender EEVEE renders of the source scene).

## Nail fit and runtime

Each nail carries a 41 × 25 bed sampled by ray casting against the actual hand
surface in bind coordinates. The authored plate is 0.28 mm thick with its upper
surface 0.22 mm above the skin. The runtime smooths small dorsal skin ridges
under the keratin plate without moving its measured footprint. The first 40%
of the bed stays fixed through every supported shape/length/width change.
Only the distal region grows; the plate and cuticle share the distal bone.

Seven shapes, continuous length, width/curvature/taper/tip controls, six finishes,
solid/French/ombre/PNG patterns, and six decoration types are editable per nail,
hand or both hands. Shape changes replace only affected nail geometry; color
changes retain geometry. Owned geometry/material/texture/skeleton resources are
disposed. Decoration footprints use bounded candidate placement and a spatial
hash; crowded items are moved or hidden with a visible warning.

The page also provides five poses, joint and wrist controls, independent skin
and proportions, orbit/pan/focus, four lighting presets, PNG export at 2048 px
or above, comparison, schema-validated scene files, local drafts, presets and
bounded undo/redo. PNG input is limited to 64 KB and 2048 × 2048; scene files to
2 MB. Existing project/MCP schemas are not migrated by this standalone page.

## Verification and limits

- Web suite: 46 files / 382 tests pass, including actual GLB loading, all five
  pose attachments, independent skeletons, 100 pose switches without drift,
  outward triangles across all seven shapes at three lengths, and runtime
  root-to-skin clearance below 0.4 mm at three points on each finger.
- `python tools/verify_realistic_hand.py`: closed manifold shells, positive
  volume, finite attributes, normalized skin weights, distal bindings, UVs,
  sockets, PBR maps, provenance and asset-size checks pass.
- All workspace typechecks and the production web build pass. No lint script
  is configured in this repository; `npm run lint --workspaces --if-present`
  therefore skips lint. `git diff --check` passes.
- Root `npm test`: all 89 test files / 648 tests pass across contracts,
  patterns, API, web and MCP workspaces.
- `nail-fit-2048.png` is a real browser photo export of the fitted runtime nail.

This is an authored anatomical approximation with procedural skin, not a scanned
photorealistic hand. Visual acceptance against the supplied photographs remains
subjective. GPU FPS and long-running GPU memory stability have not been certified.
Arbitrary extreme poses and nail lengths do not have a general finger/palm
collision solver; decoration placement only checks the nail footprint and other
decorations. Rings, bracelets and runtime animation export are not implemented.
The Blender source includes the five-pose demonstration action. These limits
mean the full specification's production acceptance is not yet certified.
