import { test } from "node:test";
import assert from "node:assert/strict";
import { cyclePerspective, resolveCamera } from "../entities/camera.js";
import { Jet, findLaunchSite } from "../entities/jet.js";
import { jets } from "../entities/jet-models.js";
import { JetWeapons } from "../entities/jet-weapons.js";
import { Player } from "../entities/player.js";
import { AIR, BEDROCK, STONE, WATER } from "../world/blocks.js";
import { dimensions } from "../world/dimensions.js";
import { World } from "../world/world.js";

const dt = 1 / 120;
const worldWith = (generate = () => {}, id = "test") => new World({ id, create: () => ({ generate }) }, 12);

function hangar(id) {
  const world = worldWith();
  const weapons = new JetWeapons({});
  const player = new Player([0.5, 1.01, 0.5]);
  const jet = new Jet(id, findLaunchSite(world, player.position, jets[id]), player, {}, weapons, world);
  player.vehicle = jet;
  player.position = jet.position;
  return { world, weapons, player, jet };
}

function steps(count, callback) {
  for (let i = 0; i < count; i++) callback(dt);
}

test("jet view cycles close, far, cockpit and back, separately from on-foot views", () => {
  assert.deepEqual(
    [1, 2, 3].map((i) => cyclePerspective(i, true)),
    [2, 3, 1]
  );
  assert.deepEqual(
    [0, 1, 2].map((i) => cyclePerspective(i, false)),
    [1, 2, 0]
  );
  const { world, jet, player } = hangar("eventide");
  const [close, far, cockpit] = [1, 2, 3].map((i) => resolveCamera(i, player, world, 85));
  assert.equal(close.mode.id, "close");
  assert.equal(close.showPlayer, false);
  assert(far.position[2] < close.position[2]);
  assert(cockpit.position[2] > jet.position[2]);
  jet.view = 3;
  assert.deepEqual(jet.renderables(), []);
  world.set(0, 10, -2, STONE);
  world.set(0, 11, -2, STONE);
  const clipped = resolveCamera(2, player, world, 85);
  assert(clipped.position[2] > -1);
});

test("launch selects open space or declines when a cavern is obstructed", () => {
  const world = worldWith();
  world.set(2, 10, -1, STONE);
  assert.deepEqual(findLaunchSite(world, [0.5, 1, 0.5], jets.kestrel), [0.5, 14.5, 0.5]);
  const cavern = worldWith(({ set, height }) => {
    for (let y = 5; y < height; y++) set(0, y, 0, STONE);
  }, "nether");
  assert.equal(findLaunchSite(cavern, [0.5, 1, 0.5], jets.eventide), null);
});

test("open skies allow launches above the old limit and at the flight ceiling", () => {
  const world = new World(dimensions.get("overworld"), 2391);
  assert.deepEqual(findLaunchSite(world, [0.5, 106, 0.5], jets.kestrel), [0.5, 115.5, 0.5]);
  assert.deepEqual(findLaunchSite(world, [0.5, 200, 0.5], jets.kestrel), [0.5, 199.5, 0.5]);
});

test("idle Overworld departures climb over the terrain ahead of the default spawn", () => {
  const world = new World(dimensions.get("overworld"), 2391);
  for (const id of Object.keys(jets)) {
    const player = new Player(world.spawn(18, 0));
    player.yaw = -0.5;
    const launch = findLaunchSite(world, player.position, jets[id]);
    player.vehicle = new Jet(id, launch, player, {}, new JetWeapons({}), world);
    steps(20 * 120, (dt) => player.step(dt, new Set(), world));
    assert.equal(player.vehicle?.id, id);
    assert(player.position[1] > launch[1] + 45);
  }
});

test("every jet has a stable departure from the Nether, End, and City spawns", () => {
  for (const dimensionId of ["nether", "end", "city"]) {
    const dimension = dimensions.get(dimensionId);
    const world = new World(dimension, 2391);
    for (const [id, spec] of Object.entries(jets)) {
      const player = new Player(world.spawn(...dimension.spawn));
      player.yaw = -0.5;
      const launch = findLaunchSite(world, player.position, spec);
      assert(launch, `${id}: no launch site in ${dimensionId}`);
      player.vehicle = new Jet(id, launch, player, {}, new JetWeapons({}), world);
      steps(120, (dt) => player.step(dt, new Set(), world));
      assert.equal(player.vehicle?.id, id, `${id} crashed in ${dimensionId}`);
      assert(Math.hypot(...player.position.map((n, i) => n - launch[i])) > 10);
    }
  }
});

test("jets accelerate and bank; boost is distinct and collision safely returns the pilot", () => {
  const { world, jet, player } = hangar("kestrel");
  const boost = new Set(["KeyW", "Space"]);
  const banking = new Set(["KeyD"]);
  steps(80, (dt) => player.step(dt, boost, world));
  assert(jet.speed > jets.kestrel.speed[1]);
  assert(jet.position[2] > 15);
  steps(20, (dt) => player.step(dt, banking, world));
  assert(jet.yaw < 0 && jet.roll < 0);
  assert.equal(player.position, jet.position);
  const [x, y, z] = jet.position.map(Math.floor);
  for (let bx = x - 9; bx <= x + 9; bx++) for (let by = y - 2; by <= y + 2; by++) world.set(bx, by, z + 7, STONE);
  for (let i = 0; i < 40 && player.vehicle; i++) player.step(dt, new Set(), world);
  assert(jet.crashed);
  assert.equal(player.vehicle, null);
  assert.deepEqual(player.position, [0.5, 1.01, 0.5]);
});

test("an isolated block in the inner wing path triggers an emergency return", () => {
  const { world, jet, player } = hangar("kestrel");
  world.set(1, 10, 9, STONE);
  for (let i = 0; i < 100 && player.vehicle; i++) player.step(dt, new Set(), world);
  assert.equal(jet.crashed, true);
  assert.equal(player.vehicle, null);
});

test("the primary cannon is rate limited, sweeps projectiles, and chips one block", () => {
  const { world, jet, weapons } = hangar("kestrel");
  world.set(0, 10, 8, STONE);
  world.set(1, 10, 8, STONE);
  weapons.fire(0, jet);
  weapons.fire(0, jet);
  assert.equal(weapons.shots.length, 1);
  steps(15, (dt) => weapons.update(dt, world));
  assert.equal(weapons.shots.length, 0);
  assert.equal(world.get(0, 10, 8), AIR);
  assert.equal(world.get(1, 10, 8), STONE);
  assert(weapons.renderables().length > 0);
});

test("the rocket and spread salvo carve different patterns and preserve protected blocks", () => {
  for (const [id, type, count] of [
    ["kestrel", "rocket", 1],
    ["wraith", "pulse", 3]
  ]) {
    const { world, jet, weapons } = hangar(id);
    for (let x = -7; x <= 7; x++) for (let y = 8; y < 13; y++) world.set(x, y, 10, STONE);
    world.set(0, 9, 10, BEDROCK);
    world.set(0, 10, 9, WATER);
    weapons.fire(2, jet);
    weapons.fire(2, jet);
    assert.deepEqual(
      weapons.shots.map((shot) => shot.type),
      Array(count).fill(type)
    );
    steps(30, (dt) => weapons.update(dt, world));
    assert.equal(world.get(0, 10, 10), AIR);
    assert.equal(world.get(0, 9, 10), BEDROCK);
    assert.equal(world.get(0, 10, 9), WATER);
    assert.equal(world.get(-3, 10, 10), id === "kestrel" ? STONE : AIR);
    assert(weapons.remaining(jet) > 0);
    steps(360, (dt) => weapons.update(dt, world));
    assert.equal(weapons.remaining(jet), 0);
  }
});

test("the singularity opens a visible field before carving and resets across dimensions", () => {
  const { world, jet, weapons } = hangar("eventide");
  world.set(0, 10, 10, STONE);
  world.set(3, 10, 10, STONE);
  world.set(5, 10, 10, STONE);
  weapons.fire(2, jet);
  steps(20, (dt) => weapons.update(dt, world));
  assert.equal(weapons.shots.length, 0);
  assert.equal(weapons.effects[0].type, "gravity");
  assert(weapons.renderables().length > 3);
  assert.equal(world.get(0, 10, 10), STONE);
  steps(110, (dt) => weapons.update(dt, world));
  assert.equal(world.get(0, 10, 10), AIR);
  assert.equal(world.get(3, 10, 10), AIR);
  assert.equal(world.get(5, 10, 10), STONE);
  weapons.reset();
  assert.equal(weapons.remaining(jet), 0);
  assert.deepEqual(weapons.renderables(), []);
});

test("projectiles inherit the jet's speed so a boosting Eventide stays behind its Singularity", () => {
  const { world, jet, player, weapons } = hangar("eventide");
  const keys = new Set(["Space"]);
  steps(240, (dt) => player.step(dt, keys, world));
  assert(jet.speed > jets.eventide.speed[1]);
  weapons.fire(2, jet);
  steps(100, (dt) => {
    player.step(dt, keys, world);
    weapons.update(dt, world);
  });
  const [shot] = weapons.shots;
  const { forward } = jet.axes();
  const lead = shot.position.reduce((sum, n, i) => sum + (n - jet.position[i]) * forward[i], 0);
  assert(lead > jets.eventide.length + 20);
});
