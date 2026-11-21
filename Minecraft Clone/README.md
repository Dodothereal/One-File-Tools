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
| Space / R / Shift | Jump or swim up / hold to sprint / walk slowly |
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
health, hunger, or crafting. Use `/dimension nether` to visit the Nether's lava
seas, forests, caves and bridges. `/dimension end` visits floating islands,
obsidian pillars and outer settlements; `/dimension city` visits an infinite
street grid with towers, parks and plazas. Three gates near Overworld spawn lead
to those dimensions, with return gates near each arrival. Stand inside a gate
for one second to travel (End portals are instant); arrival has a three-second
cooldown. `/portal <nether|end|city>` builds a gate in front of you. Completing an
obsidian rectangle with a 2×3 through 21×21 interior automatically lights it.

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

## Graphics and console

Graphics & controls groups quality, performance and camera controls. Presets set
all quality options; editing one displays **Custom** (FOV, sensitivity and the
overlay are independent). v1 preferences migrate to v2 without losing overrides.

| Preset | Distance | Full-detail ring | Resolution | FPS cap | Streaming budget |
| --- | ---: | ---: | ---: | ---: | ---: |
| Potato | 4 | 1 | 50% | 60 | 2 ms |
| Low | 6 | 2 | 65% | 60 | 3 ms |
| Balanced | 10 | 3 | 85% | 60 | 4 ms |
| High | 16 | 4 | 100% | 120 | 4 ms |
| Ultra | 32 | 5 | 100% | Unlimited | 5 ms |
| Ultra++ | 64 | 6 | 100% | Unlimited | 5 ms |

Potato/Low disable clouds, per-vertex ambient occlusion, animated water and shader
grading. Balanced and above enable them and smooth fog. Grading uses inexpensive
highlight glow, tone mapping and a vignette, not a framebuffer bloom blur. Water
uses small waves and animated highlights. LOD tiles reduce their sampling density
with distance, retain their full footprint and add boundary skirts; fog hides the
outer edge. Streaming prioritizes near tiles, yields between individual chunk
generations, obeys a configurable soft CPU budget and uploads at most two tiles
per frame. A single chunk generation or mesh can exceed that budget; there is no
worker. The overlay shows FPS, frame interval, drawn tiles/triangles and pending
tiles. Actual performance depends on the GPU, resolution and dimension generator.

The console supports Tab completion of command names and `/help [command]`:

- `/graphics [Potato|Low|Balanced|High|Ultra|Ultra++]`, `/render <2-64>`,
  `/fov <60-105>`, `/set <option> <value>` (no arguments lists valid options).
  Option names match the settings fields: `distance`, `detail`, `scale`, `clouds`,
  `ao`, `fog` (`low|high`), `water`, `post`, `fpsLimit` (`30|60|120|unlimited`),
  `budget`, `overlay`, `fov`, `sensitivity`. Booleans accept `true|false|on|off`.
- `/setblock <x y z> <block>` and `/fill <x1 y1 z1> <x2 y2 z2> <block>` accept
  block keys/IDs and `~` relative coordinates. Coordinates are floored to voxels;
  fills are limited to 32768 blocks and the world's Y range.
- `/speed <0.1-5>`, `/fly` (creative only), `/pos`, `/clear`, `/perf` and
  `/benchmark` (average rendered FPS over five seconds, printed to the console).
- Existing `/help`, `/tp`, `/gamemode`, `/time`, `/dimension`, `/give`, `/seed`
  remain available. Weather and dimension location search are not implemented.

## ARCHITECTURE

- **`world/`**: `blocks.js` owns byte-sized IDs and procedural atlas definitions.
  Register additional tiles and blocks before the game creates its atlas.
  `registerDimension(id, { name, create, spawn, sky, zenith, daylight, clouds })`
  registers a dimension; `create(seed)` returns a generator with
  `generate({ x, z, size, height, set })` and optionally
  `surface(x, z) → { y, id, biome }` for distant terrain. `World` caches 16×96×16
  voxel chunks and overlays sparse edits; the data store is renderer-independent.
  Generators may supply `spawn(x, z)` returning a safe `[x, y, z]` position (or
  nothing to use the surface scan), useful beneath the Nether's bedrock roof.
  `world/blocks_dimensions.js` registers additional procedural palettes through
  `blocks.js`. Blocks with `glow: true` ignore face shading and daylight (but
  still receive distance fog); dimension `fog` overrides the default horizon fog.
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
