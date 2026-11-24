# Waikīkī Surf Club

An original, desktop-first Three.js beach scene inspired by Waikīkī.

Open this directory in VS Code. In its terminal run:

```powershell
npm.cmd ci
npm.cmd run dev
```

Open the local URL printed by Vite. Run `npm.cmd run build` for a type-checked production build. On shells that do not block PowerShell scripts, `npm` also works.

Choose a scenic viewpoint to visit the palm grove, jungle creek, stone guardians, mountain lookout or surf break. Drag horizontally to orbit a full 360 degrees and vertically to tilt. Use the scroll wheel to zoom. Click one of the three marked characters or use their camera buttons. Esc or Back to Overview restores the opening shot. Inside the Shop opens a roofless cutaway of the rental counter, board storage and shave ice station. Sound is off until enabled.

The 11 people are original articulated code-generated stand-ins. The board carrier, shave ice customer and surfer are the three candidates for future rigged GLB replacement. Their camera targets are independent of their render geometry. All geometry, textures and the layered soundscape are generated locally. The shoreline foam and surf crest run on the GPU, while the surfer and spray sample the same crest on the CPU.

- `environment.ts`: terrain, kiosk, palm trees, signs and horizon
- `waves.ts`: shoreline swash and traveling crest
- `people.ts`: cast, poses, surfboard and wake
- `camera.ts`: orbit and follow shots
- `sound.ts`: opt-in synthetic ambience