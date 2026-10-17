# Reference pattern collection

The collection follows the 17 original references and 9 additional luxury references
provided in this chat. It adds 25 pattern types to the existing 16, and 26 presets
to the existing 6. All patterns produce editable strokes using the existing design
document schema. Saved designs keep their strokes; regenerating a recipe uses the
new rendering and defaults.

## Coverage

| Reference | Preset | Main elements |
| --- | --- | --- |
| 1 | `cloud-sky` | Clouds, pastel waves, constellation/orbit |
| 2 | `champagne-quilt` | Quilt grid, pearls, satin bow, cat-eye |
| 3 | `pink-polka-pearl` | Fine dots, pearl finish, crystals |
| 4 | `burgundy-ribbon` | Ribbon bow, burgundy, silver shimmer |
| 5 | `ruby-crystal-ombre` | Ruby ombre, glitter, crystal cluster |
| 6 | `pearl-heart-french` | Pearl French, small hearts, bow |
| 7 | `red-gold-french` | Double French, gold outline, burgundy bow |
| 8 | `pastel-picnic` | Rainbow, cloud, fruit, daisies |
| 9 | `vanilla-sprinkle` | Wavy French, sprinkles, bunny, cat |
| 10 | `latte-polka-french` | Sparse dots and cream French |
| 11 | `playful-doodles` | Smiley, sketch checkerboard, outline flowers, squiggles |
| 12 | `midnight-haunt` | Spiderweb, ghost, skull, stitched smile |
| 13 | `graphic-french` | Diagonal, chevron, reverse and outlined French |
| 14 | `cherry-blush` | Aura, cherries, bunny, small sparkles |
| 15 | `navy-daisy` | Navy, daisies, heart |
| 16 | `ink-flames` | Flowing black flame tips |
| 17 | `champagne-cherry` | Silver cherries, aura, sparse dots, cat-eye |
| Additional 1 | `glazed-pearl` | Pink pearl glaze |
| Additional 2 | `rose-gold-glitter` | Rose gold flakes and crystals |
| Additional 3 | `pastel-botanical` | Layered botanical petals and small leaves |
| Additional 4 | `bridal-pearl-bow` | Deep smile French, white bow, raised pearls |
| Additional 5 | `emerald-marble-foil` | Emerald marble and gold foil |
| Additional 6 | `black-gold-couture` | Black French and gold foil curves |
| Additional 7 | `peach-blush` | Soft centered blush and fine sparkle |
| Additional 8 | `plum-cat-eye` | Plum magnetic shimmer |
| Additional 9 | `bridal-crystal-lace` | Soft white tips, crystals, pearls, fine chains |

## Review locally

```powershell
node tools/render-pattern-catalog.mjs test-results/pattern-catalog
node tools/review-patterns.mjs
```

Open `http://localhost:5175/pattern-review.html` to inspect presets on the actual
hand model, using the app's scene, rasterizer, morphs, materials and decorations.
Select a preset and finger, then rotate the preview to inspect highlights.
The tool does not call the API or save projects, and is not part of the web build.

The flat gallery labels each finish, but does not simulate lighting, morph shapes,
or raised gem geometry. Cat-eye uses a painted fine-particle band plus a directional
physical material. Pearl uses thin-film iridescence. These are approximations of
the references, not photo reproductions. The current model's geometry/normals and
scene lighting still limit the smoothness of reflections at close range. Painted
flowers and foil have color detail; raised relief is limited to catalog decorations.

## Compatibility and bounds

- Restart/redeploy the MCP service to expose 41 patterns, 34 decorations and 32 presets.
- Deploy the shared contracts/API, web and AI service together for `pearl` and
  `cat_eye` finish support. No database migration or schema-version bump is needed.
- Counts, spacing, widths, UV coordinates and color inputs are bounded by Zod.
  Grids necessarily visit each cell/intersection; all sampling is bounded and
  proportional to the generated strokes or pixels. No new dependencies are used.
- Regression checks cover default schemas, dense patterns, deterministic seeds,
  motif margins, vine connectivity, finish switching, and the 4 MB API body limit
  for every preset.

## Changed files

- Pattern rendering: `packages/patterns/src/patterns.ts`, `geometry.ts`,
  `referencePatterns.ts`.
- Preset collections: `packages/patterns/src/presets.ts`, `referencePresets.ts`,
  `luxuryPresets.ts`.
- Shared finish values: `packages/contracts/src/design.ts`.
- Web materials and finish selector: `apps/web/src/3d/materials/finishes.ts`,
  `apps/web/src/features/design/PaintToolbar.tsx`.
- AI compatibility: `apps/ai/app/schemas.py`, `apps/ai/app/generation/recipe.py`.
- Tests: `packages/patterns/src/patterns.test.ts`, `geometry.test.ts`,
  `apps/mcp/src/render.test.ts`, `apps/web/src/3d/materials/finishes.test.ts`,
  `apps/ai/tests/test_recipe.py`.
- Review tooling: `tools/render-pattern-catalog.mjs`, `review-patterns.mjs`,
  `pattern-review.html`, `pattern-review.tsx`, and this document.

## Luxury reference refinements

The five photo-based sets now use malachite bands and branching kintsugi foil,
almond/swoop French with glitter borders and beaded curves, elongated two-color
blush, narrow magnetic cores with up to 900 shimmer particles, and bridal chaton
clusters surrounded by marquise petals and pearls. Shared decoration ids include
`gem-marquise`, `gem-chaton` and `metal-bead` (34 entries total).

New patterns are bounded to 820 / 120 / 330 / 240 strokes respectively for
`gold_vein` / `malachite` / `glitter_line` / `bead_line`. Vein traversal is
limited to 220 segments and 160 fragments, branch depth to two; arc-length
sampling uses a monotone walk. All sampling is O(generated strokes), with fixed
curve resolution and bounded polygon edges. Each nail still packs at most six
layers of 500 strokes. Legacy French, aura and cat-eye defaults are verified
against hashes captured before this refinement, including three untouched presets.

These textures approximate the visual motifs at normal viewing distance. They do
not provide translucent jelly/subsurface scattering, physically refracting diamond
facets, or crumpled raised foil. Flat previews show decoration placeholders;
geometry, occlusion, material highlights and apparent sizes need the 3D viewer.

## Repair loop 1

- Cat-eye particle styling now follows `core === 0 && glow === undefined` for
  legacy output. Shimmer changes only the particle count, without a style jump
  at 0.25. Enhanced cores use three overlapping soft glow widths.
- Aura uses the original 7×7 grid, legacy dab size and opacity with continuous
  aspect/rotation transforms. Dabs still overlap at both schema extremes;
  the optional inner color is an additional pass.
- Empty clipped vein networks return before fallback or flake sampling. Tests
  cover extreme angles in both regions and rejection of every clipped segment.
- Gold borders/X lines use 0.024 UV bands and larger sparkles; gold beads use
  0.019 UV. Bridal tips use stacked milky gradients; silver swirls use 0.016 UV
  beads with darker silver contrast. Nude edge foil is thicker with tip clusters.
- SHA-256 fixtures cover the entire documents of all 27 untouched presets,
  captured before this repair. Their serialized outputs remain byte-identical.
- The catalog command now also regenerates `luxury-reference-comparison.png`
  when the five local reference photos are available. Two render/compare passes
  were inspected at catalog size.

## Validation

- Root `npm run typecheck` passed. `npm run test` passed all 548 tests:
  contracts 23, patterns 29, API 116, web 338, MCP 42.
- `npm run lint --workspaces --if-present` found no lint scripts.
  `git diff --check` passed. API tests emit an existing pg deprecation warning.
- All 32 presets stay below 4 MB (maximum body 3,278,117 bytes). The five
  refined sets use 1–2 layers per nail, with at most 928 strokes per nail.
- Tests cover default parsing, deterministic seeds, UV bounds, stroke caps,
  visible edge foil, real vein junctions, duplicate/short curves, negative almond
  smiles, maximum shimmer combined with glitter, all preset schemas and API body
  limits, and synchronized decoration ids.
- Catalog PNGs are generated with the real rasterizer and compared against all
  five files under `test-results/reference/`.
- Browser access to the local review origin was declined by the approval gate in
  this session. The 3D visual comparison remains unverified; run the review command
  above to inspect geometry and lighting locally.
