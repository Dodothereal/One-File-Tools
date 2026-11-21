import { AIR, GRASS, DIRT, STONE, SAND, LOG, LEAVES, BRICK, PRISM, SNOW, blocks } from '../world/blocks.js';
import { clamp } from '../engine/math.js';
import { meshBoxes } from '../engine/mesh.js';

const WIDTH = .3;
const HEIGHT = 1.79;

export const defaultHotbar = [GRASS, DIRT, STONE, SAND, LOG, LEAVES, BRICK, PRISM, SNOW];

export class Player {
  constructor(position) {
    this.position = position;
    this.yaw = 0;
    this.pitch = -.10;
    this.mode = 'creative';
    this.flying = false;
    this.grounded = false;
    this.velocity = 0;
    this.slot = 0;
    this.hotbar = [...defaultHotbar];
    this.vehicle = null;
    this.lastJump = -Infinity;
  }

  moveTo(position) {
    this.position = position.slice();
    this.velocity = 0;
    this.grounded = false;
  }

  setMode(mode) {
    this.mode = mode;
    this.flying = false;
    this.lastJump = -Infinity;
  }

  eye() {
    const [x, y, z] = this.position;
    return [x, y + 1.60, z];
  }

  look(dx, dy, sensitivity) {
    this.yaw -= dx * sensitivity * .002;
    this.pitch = clamp(this.pitch - dy * sensitivity * .002, -1.55, 1.55);
  }

  jump(at) {
    if (this.mode === 'creative' && at - this.lastJump < 280) {
      this.flying = !this.flying;
      this.velocity = 0;
      this.lastJump = -Infinity;
      return;
    }
    this.lastJump = at;
    if (this.grounded && !this.flying) {
      this.grounded = false;
      this.velocity = 7.3;
    }
  }

  intersects(x, y, z) {
    const [px, py, pz] = this.position;
    return x + 1 > px - WIDTH && x < px + WIDTH && y + 1 > py &&
      y < py + HEIGHT && z + 1 > pz - WIDTH && z < pz + WIDTH;
  }

  step(dt, keys, world) {
    if (this.vehicle) {
      this.vehicle.update(dt, keys, world, this);
      return;
    }
    const down = key => Number(keys.has(key));
    const forward = down('KeyW') - down('KeyS'), side = down('KeyD') - down('KeyA');
    const [x, y, z] = this.position;
    const water = blocks[world.get(Math.floor(x), Math.floor(y + .45), Math.floor(z))].liquid;
    const sprint = keys.has('ControlLeft') || keys.has('ControlRight');
    const descend = keys.has('ShiftLeft') || keys.has('ShiftRight');
    const speed = (this.flying ? sprint ? 22 : 10 : water ? 2.6 : sprint ? 7.2 : descend ? 2.1 : 4.6) * dt /
      (Math.hypot(forward, side) || 1);
    const nx = (Math.sin(this.yaw)*forward - Math.cos(this.yaw)*side)*speed;
    const nz = (Math.cos(this.yaw)*forward + Math.sin(this.yaw)*side)*speed;
    if (this.flying) this.velocity = (down('Space') - Number(descend)) * 9;
    else if (water && keys.has('Space')) this.velocity = 4;
    else this.velocity = Math.max(water ? -2.2 : -30, this.velocity - (water ? 6 : 21)*dt);
    this.moveAxis(0, nx, world);
    this.moveAxis(2, nz, world);
    this.grounded = false;
    if (this.moveAxis(1, this.velocity*dt, world)) {
      this.grounded = this.velocity < 0;
      this.velocity = 0;
    }
    if (this.position[1] < -10) this.moveTo(world.spawn());
  }

  moveAxis(axis, movement, world) {
    if (!movement) return false;
    const pos = this.position;
    const pad = [WIDTH, 0, WIDTH], height = [WIDTH, HEIGHT, WIDTH];
    const direction = Math.sign(movement);
    pos[axis] += movement;
    let bound = pos[axis];
    let collided = false;
    const extent = pos.map((n, i) => [
      Math.floor(n - pad[i] + (i === axis && direction < 0 ? 0 : .00001)),
      Math.floor(n + height[i] - .00001),
    ]);
    for (let x = extent[0][0]; x <= extent[0][1]; x++) for (let y = extent[1][0]; y <= extent[1][1]; y++) {
      for (let z = extent[2][0]; z <= extent[2][1]; z++) {
        const id = world.get(x, y, z);
        if (id === AIR || !blocks[id].solid) continue;
        const block = [x, y, z][axis];
        bound = direction > 0 ? Math.min(bound, block - height[axis]) : Math.max(bound, block + 1 + pad[axis]);
        collided = true;
      }
    }
    pos[axis] = bound;
    return collided;
  }
}

export function playerMesh() {
  return meshBoxes([
    { origin: [-.24,.75,-.16], size: [.48,.60,.32], id: PRISM },
    { origin: [-.21,1.35,-.21], size: [.42,.43,.42], id: SAND },
    { origin: [-.22,1.67,-.22], size: [.44,.13,.44], id: LOG },
    { origin: [-.42,.61,-.13], size: [.17,.71,.26], id: SAND },
    { origin: [.25,.61,-.13], size: [.17,.71,.26], id: SAND },
    { origin: [-.235,0,-.15], size: [.22,.75,.31], id: DIRT },
    { origin: [.015,0,-.15], size: [.22,.75,.31], id: DIRT },
  ]);
}
