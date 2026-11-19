# Rigged player characters implementation plan

**Goal:** Replace the capsule player with separate male/female characters from the supplied FBX files, each with Idle, Walk and Run animations.

**Architecture:** Inspect and rig in portable Blender; export self-contained GLBs for Three.js. Keep the existing ecctrl physics/cameras and feed animation blending from actual movement. Store the character choice through the existing local mock API. User explicitly confirmed local-only work and delegated implementation choices.

**Tech stack:** Blender Python, glTF 2.0, React Three Fiber, Three.js, ecctrl, Zustand, existing localStorage mock database.

## Constraints and decisions
- Preserve supplied character appearance and source files.
- One standalone GLB per character, embedded textures, three named looping clips.
- Remove horizontal root motion; retain vertical motion. Check proportions, feet, joints and loop boundaries visually.
- Local repository only; no remote database or deployment changes.
- Existing untracked portfolio-log belongs to the user and is untouched.
- Work in the user-selected checkout so the local app immediately uses the generated files.

## Tasks
- [x] Inspect source skeletons, geometry, textures and animation ranges; document findings.
- [x] Fit skeletons and skin weights; retarget the three clips; export and visually inspect both characters.
- [x] Add a character catalog and local API for per-user selection, validating IDs and preserving other mock data.
- [x] Replace PlayerModel with skinned GLBs, use continuous movement-based animation transitions, and add male/female choice to settings.
- [x] Verify GLB skins, weights, animations, root drift, local persistence and production build.
- [ ] Browser interaction validation: blocked by computer-use URL policy; no UI success claim.

## Review focus
- Animation/model imports failing must not remove physics or crash the whole scene.
- A blocked player must not keep running in place; idle/run transitions must blend.
- Character switch and reload must preserve selection and use independent skeletons.
- Neither high-resolution source textures nor bind-pose scale should cause an oversized or invisible player.
- Public-base URL and stale/invalid stored character IDs must resolve safely.

## Progress
- Source assets found. Current player is a procedural capsule. API is localStorage only; user confirmed this is the intended target.
- Both meshes had no skin; source clips share Mixamo skeleton. Fitted 22-bone rigs with normalized max-four-influence weights. Three detached male vertices repaired from adjacent valid surface.
- Exported 4.24/4.28 MB GLBs and packed editable Blender files in assets/characters.
- Blender rendered Idle and three samples each of Walk and Run for both models; checked appearance.
- 5 Node tests and production build passed. Build reports pre-existing large JS bundle warning.
- Fresh independent code review found gait speed mismatch. Fixed by storing measured gait speeds (male Walk 1.49 / Run 3.91, female 1.42 / 3.72 m/s), matching playback to velocity, synchronizing phases, and using physical speeds 1.6 / 4.2 m/s.
- Verified ecctrl turns body +Z toward input; GLBs face +Z. Foot offset is -(capsuleHalfHeight .5 + radius .3 + floatHeight .2) = -1m.
