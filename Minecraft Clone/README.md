# Minecraft Clone — Phase 1

A WebGL 2 voxel sandbox with a seeded, playable Overworld: coastlines, woodland,
highlands, dunes, caves, flooded lowlands, trees, and a 20-minute day/night cycle.
All textures and sky effects are generated in code. No accounts, assets, or network
requests are needed to play.

## Play and build

- **Play offline:** download and open [`dist/minecraft-clone.html`](dist/minecraft-clone.html)
  in a desktop WebGL 2 browser. The game needs a mouse and keyboard.
- **Develop:** from `Minecraft Clone/`, run `python3 -m http.server 8080` and open
  `http://localhost:8080/`. The dev page imports modules directly.
- **Build and test:** run `npm ci`, then `npm test` and `npm run build`. Commit the
  regenerated standalone HTML with source changes. To serve the release instead,
  use `python3 -m http.server 8080 --directory dist` and open
  `http://localhost:8080/minecraft-clone.html`.

| Control | Action |
| --- | --- |
| WASD / Mouse | Move / look |
| Space / Ctrl / Shift | Jump or swim up / sprint / walk slowly |
| Space twice | Toggle creative flight; Space ascends, Shift descends |
| Left / right mouse | Break / place the selected block |
| 1–9 or scroll | Pick a hotbar slot |
| F5 | On foot: first person → third person close → third person far |
| J | Open the flight hangar from the world |
| / or Enter | Open the world console; type `/help` for commands |
| Escape | Pause, or close the console and return to the pause menu |

Graphics settings persist locally where browser storage is available. World edits
are kept in memory for the current page session, including across dimension changes.
Creative is the default; survival mode currently changes movement and reach, not
health, hunger, or crafting. Nether, End, and City are registered but not playable
yet.

## Flight hangar

Choose **Flight hangar** from the menu, press **J** while playing, or run
`/jet kestrel`, `/jet wraith`, or `/jet eventide` in the world console.
Jets launch above you when there's enough clearance. Overworld departures begin
with a gentle climb; move the mouse up or down to adjust your pitch.

| Aircraft | Style | Right mouse |
| --- | --- | --- |
| A-07 Kestrel | Vintage interceptor | Blaze Rocket: a single explosive shot |
| M-24 Wraith | Modern strike jet | Pulse Salvo: three spread shots |
| X-99 Eventide | Future voidcraft | Singularity: a delayed, collapsing gravity well |

- **Mouse / A / D** steer; **W / S** raise or lower throttle; **Space** boosts.
- **F5** cycles close chase, far chase, and cockpit. Each view has flight telemetry.
- **Left mouse** fires the auto cannon (hold to repeat). **Right mouse** fires
  the special; the HUD shows its recharge. Impacts remove breakable voxel blocks.
- **E** or `/jet return` returns you to your launch point. A terrain collision
  triggers the same return automatically.

## ARCHITECTURE

- **`world/`**: `blocks.js` owns byte-sized IDs and procedural atlas definitions.
  Register additional tiles and blocks before the game creates its atlas.
  `registerDimension(id, { name, create, spawn, sky, zenith, daylight, clouds })`
  registers a dimension; `create(seed)` returns a generator with
  `generate({ x, z, size, height, set })` and optionally
  `surface(x, z) → { y, id, biome }` for distant terrain. `World` caches 16×96×16
  voxel chunks and overlays sparse edits; the data store is renderer-independent.
- **`engine/`**: `meshChunk(data, neighbors)` consumes typed arrays, with neighbors
  ordered +X, −X, +Z, −Z, and returns transferable opaque and liquid vertex arrays.
  `ChunkStream` prioritizes local tiles, invalidates edited boundaries, and
  progressively streams increasingly coarse surface tiles (up to 8×8 chunks
  per tile) into a fogged 64-chunk view. The surface approximation does not include
  edits or vegetation. Generation and meshing currently run on the main thread
  with a per-frame scheduling budget; generation and mesh buffers have no DOM or
  WebGL dependencies and can be moved to a worker. `Renderer` owns GPU resources,
  camera-relative projection, frustum culling, sky and water passes.
- **`entities/`**: `Player` handles motion and voxel collision. Set
  `player.vehicle` to a `Vehicle` implementation to delegate input, camera,
  updates, and renderables while piloting. A vehicle camera can return
  `{ position, yaw, pitch, roll, fov }` for each perspective; renderables carry
  `{ mesh, position, yaw, pitch, roll, scale }` with meshes uploaded through the
  renderer. Jets use voxel geometry and share a per-dimension projectile system.
- **`ui/` and `commands/`**: `Interface` owns the HUD, pause menu, graphics and
  console. `ui/settings.js` handles preferences (Potato through Ultra++).
  `createCommands()` returns a `CommandRegistry`; add commands with
  `register(name, usage, description, (args, game) => output)`.
- **`main.js`** wires the browser input and render loop together. `build.mjs`
  bundles the modules and embeds CSS and JS into the standalone HTML.
