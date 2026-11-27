# Plaça / hill look pass + home headline

## Goal

Replace the home punchline and tighten Plaça del Mercat and Dalt de la Vila so they read closer to the public Catalan seafront buildings, without naming the town or adding identifying detail.

## Headline

- EN: `Just coding.`
- ES: `Solo código.`
- CA: `Només codi.`
- Leave the home lede as-is; it already explains the agent workflow.

## Look pass (layout and quests unchanged)

1. **Market hall** (`plaza.ts`): cream rendered Noucentista shell; tiled porch of round arches; three round upper windows (center wider); wavy parapet; keep clock gable, door, and `MERCAT` sign. Stall glimpse through the doorway only (not walkable).
2. **Church / Campanar** (`hill.ts` + `makeChurchLandmark`): ochre nave; pale stone portal surround; keep rose window. Square tower shaft, irregular octagon upper with balustrade and small reddish tile cupola (no apostle reliefs). Distant landmark silhouette matches.
3. **Surrounding blocks** (`seafront.json` plaza + hill): cream/ochre renders, dark green shutters, tile eaves. No new streets.

## Out of scope

- Sound pass (next).
- Metro move, east expansion, home-page 3D swap.
- Naming saints, dates, or the real town on screen.

## Success

- Visual read from square and beach matches the public look without doxxing.
- `astro check`, unit tests, and smoke stay green.
- Draw-call budget still roughly at spawn `<= 770`.
