# Character art source — v2

These twenty 1536 × 1024 source sheets are the controlled authored input for the vertical slice. Each sheet is a fixed 3 × 2 layout on a chroma-magenta field. The build script removes the field, downsamples the paintings to 75%, decontaminates hidden/edge RGB, isolates the six largest connected alpha components, and repacks them into deterministic, non-overlapping 512 × 512 runtime cells on a transparent 1536 × 1024 sheet. Repacking matters because the strongest sword, run, and landing silhouettes intentionally cross the original guide-cell edges.

The source matrix is deliberately small:

- four identity/outfit combinations with the sword;
- the same four combinations without the sword;
- four equipped six-drawing attack sequences.
- eight dedicated six-drawing run sequences: equipped and unequipped for all four combinations.

The runtime keeps all 21 canonical frame IDs. Frame metadata chooses an authored cell; idle breathing can reuse a drawing with a tiny deterministic bounds change, while the dedicated run and attack sheets each supply six different body drawings.

Rebuild with `npm run assets:build`. Verify committed output with `npm run assets:check`.

## Generation brief

The source was generated from `docs/concept-sheet.png` using this art-direction prompt, then reviewed at native gameplay scale:

> Production-ready 2D platformer sprite of a cute fuzzy humanoid monster; visibly broken fur silhouette; painterly storybook cel shading; expressive eyes and small fangs; fitted clothing with material-specific folds; detailed footwear; faceted wooden sword; upper-left light; full body and readable action silhouette; same canonical anatomy in every frame; no MapleStory imitation, flat vector icon art, circular head, stick limbs, cardboard joints, UI, labels, or scenery.

Pose-sheet constraint:

> Exactly three columns by two rows on a flat #FF00FF field. Idle, run contact, jump-rise, fall, landing squash, and attack contact share scale and root. The attack sheet contains anticipation, wind-up, strike start, contact, follow-through, and recovery with no slash VFX.

Run-sheet constraint:

> Exactly six separate full-body run-cycle drawings in a rigid three-column by two-row grid on a flat #FF00FF field: alternating contact, compression, passing, and recovery phases. The same rear paw keeps the sword trailing behind the body in every equipped cell; both paws are naturally reconstructed when unequipped. Preserve scale, face direction, foot registration, clothing deformation, and the canonical anatomy. No jump, idle, attack, duplicate pose, hand-switching, speed line, shadow, label, border, scenery, or magenta rim light.

Variant edits changed only identity (Moss teal leaf-eared / Bramble plum horned) and outfit (Trail cream tunic / Scout navy hoodie). Unequipped edits removed the sword and reconstructed an empty action paw.

This is an authored presentation layer for the vertical slice, not the simulation contract. Semantic composition, hide/replace rules, anchors, and vector debug fallback remain deterministic in code.
