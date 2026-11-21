import { clamp, viewAxes } from '../engine/math.js';
import { raycast } from '../engine/raycast.js';
import { blocks } from '../world/blocks.js';
import { HEIGHT } from '../world/world.js';
import { Vehicle } from './vehicle.js';
import { jets } from './jet-models.js';

const solid = world => (x,y,z) => blocks[world.get(x,y,z)].solid;
const approach = (value, target, dt, rate) => value + (target-value) * (1-Math.exp(-dt*rate));

export function offset(position, { right, up, forward }, x, y, z) {
  return position.map((n,i) => n + right[i]*x + up[i]*y + forward[i]*z);
}

function sweep(world, from, to, accepts = solid(world)) {
  const delta = to.map((n,i) => n-from[i]);
  const length = Math.hypot(...delta);
  return length ? raycast(from, delta.map(n => n/length), length, accepts) : null;
}

export function findLaunchSite(world, [x,y,z], spec) {
  const radius = Math.ceil(Math.max(spec.span, spec.length));
  const roof = world.dimension.id === 'nether' ? HEIGHT-9 : HEIGHT+18;
  for (let launchY = Math.max(5, Math.floor(y)+9); launchY <= roof; launchY += 4) {
    let clear = true;
    for (let dx = -radius; dx <= radius && clear; dx++) {
      for (let dz = -radius; dz <= radius && clear; dz++) {
        for (let dy = -2; dy <= 2; dy++) {
          const block = blocks[world.get(Math.floor(x)+dx, launchY+dy, Math.floor(z)+dz)];
          if (block.solid || block.liquid) { clear = false; break; }
        }
      }
    }
    if (clear) return [x, launchY+.5, z];
  }
  return null;
}

export class Jet extends Vehicle {
  constructor(id, position, pilot, mesh, weapons, world) {
    super();
    this.id = id;
    this.spec = jets[id];
    this.position = position;
    this.launchSite = pilot.vehicle?.launchSite ?? pilot.position.slice();
    this.wasFlying = pilot.vehicle?.wasFlying ?? pilot.flying;
    this.yaw = pilot.vehicle?.yaw ?? pilot.yaw;
    this.heading = this.yaw;
    this.pitch = this.desiredPitch = world.dimension.id === 'overworld' ? Math.PI/15 : 0;
    this.roll = 0;
    this.throttle = .32;
    this.speed = this.spec.speed[0];
    this.view = 1;
    this.mesh = mesh;
    this.weapons = weapons;
    const { span, length } = this.spec;
    this.probes = [[0,0,0], [0,0,length], [0,0,-length], [0,1.35,-1.8],
      [0,-.5,0], [span,-.1,-1.5], [-span,-.1,-1.5], [span*.57,-.1,-.4], [-span*.57,-.1,-.4]];
  }

  axes() {
    return viewAxes(this.yaw, this.pitch, this.roll);
  }

  look(dx, dy, sensitivity) {
    this.heading -= dx * sensitivity * .002;
    this.desiredPitch = clamp(this.desiredPitch - dy*sensitivity*.002, -1.12, 1.12);
  }

  eject(pilot) {
    pilot.vehicle = null;
    pilot.moveTo(this.launchSite);
    pilot.flying = this.wasFlying && pilot.mode === 'creative';
    pilot.lastJump = -Infinity;
  }

  update(dt, keys, world, pilot) {
    const [slow, cruise, boost] = this.spec.speed;
    const axis = (positive, negative) => Number(keys.has(positive)) - Number(keys.has(negative));
    this.throttle = clamp(this.throttle + axis('KeyW', 'KeyS') * dt*.65, 0, 1);
    const prev = this.axes();
    this.heading += axis('KeyA', 'KeyD') * this.spec.turn * dt;
    const turn = clamp(this.heading - this.yaw, -1.4, 1.4);
    this.yaw += turn * (1-Math.exp(-dt*6));
    this.pitch = approach(this.pitch, this.desiredPitch, dt, 5);
    this.roll = approach(this.roll, clamp(turn*1.5, -.80, .80), dt, 6);
    this.boosting = keys.has('Space');
    const target = this.boosting ? boost : slow + (cruise-slow)*this.throttle;
    this.speed = approach(this.speed, target, dt, 2.7);
    const axes = this.axes();
    const next = offset(this.position, axes, 0, 0, this.speed*dt);
    const hitsTerrain = (x,y,z) => {
      const block = blocks[world.get(x,y,z)];
      return block.solid || block.liquid;
    };
    if (next[1] < 2 || this.probes.some(([x,y,z]) =>
      sweep(world, offset(this.position, prev, x,y,z), offset(next, axes, x,y,z), hitsTerrain))) {
      this.crashed = true;
      this.eject(pilot);
      return;
    }
    if (next[1] > HEIGHT+104) {
      next[1] = HEIGHT+104;
      this.desiredPitch = Math.min(this.desiredPitch, 0);
    }
    pilot.position = this.position = next;
    if (keys.has('Mouse0')) this.interact(0);
  }

  camera(perspective, pilot, world) {
    const pose = { yaw: this.yaw, pitch: this.pitch, roll: this.roll };
    if (perspective === 'cockpit' || perspective === 'first') {
      return { ...pose, position: offset(this.position, this.axes(), 0, .83, this.spec.seat) };
    }
    const far = perspective === 'far';
    const range = far ? 22 : 12;
    const lift = far ? 7 : 3.5;
    const { up, forward } = viewAxes(this.yaw, this.pitch);
    const delta = forward.map((n,i) => lift*up[i]-range*n);
    const length = Math.hypot(...delta);
    const direction = delta.map(n => n/length);
    const hit = raycast(this.position, direction, length, solid(world));
    const distance = hit ? Math.max(0, hit.distance-.30) : length;
    return { yaw: this.yaw, pitch: this.pitch-Math.atan2(lift, range+36), roll: this.roll*.58,
      position: this.position.map((n,i) => n+direction[i]*distance) };
  }

  interact(button) {
    this.weapons.fire(button, this);
  }

  renderables() {
    return this.view === 3 ? [] : [{
      mesh: this.mesh, position: this.position, yaw: this.yaw, pitch: this.pitch, roll: this.roll,
    }];
  }
}
