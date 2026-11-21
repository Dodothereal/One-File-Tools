import { viewAxes } from "../engine/math.js";
import { raycast } from "../engine/raycast.js";
import { AIR, blocks } from "../world/blocks.js";
import { offset } from "./jet.js";

const payloads = {
  tracer: { speed: 132, life: 0.85, radius: 0 },
  rocket: { speed: 76, life: 1.7, radius: 2.8 },
  pulse: { speed: 116, life: 1.1, radius: 1.65 },
  well: { speed: 52, life: 0.95, radius: 4.35 }
};

export function carveImpact(world, block, center, radius) {
  const remove = (x, y, z) => {
    const material = blocks[world.get(x, y, z)];
    if (material.solid && !material.unbreakable) world.set(x, y, z, AIR);
  };
  if (!radius) {
    if (block) remove(...block);
    return;
  }
  const [cx, cy, cz] = center;
  const limit = radius * radius;
  for (let y = Math.floor(cy - radius); y <= Math.floor(cy + radius); y++) {
    for (let z = Math.floor(cz - radius); z <= Math.floor(cz + radius); z++) {
      for (let x = Math.floor(cx - radius); x <= Math.floor(cx + radius); x++) {
        if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 + (z + 0.5 - cz) ** 2 <= limit) remove(x, y, z);
      }
    }
  }
}

export class JetWeapons {
  constructor(meshes) {
    this.meshes = meshes;
    this.reset();
  }

  reset() {
    this.shots = [];
    this.effects = [];
    this.cooldowns = new Map();
    this.time = 0;
    this.lastPrimary = -Infinity;
    this.barrel = -1;
  }

  remaining(jet) {
    return Math.max(0, (this.cooldowns.get(jet.id) ?? 0) - this.time);
  }

  fire(button, jet) {
    const launch = (type, lateral = 0, spread = 0) => {
      const yaw = jet.yaw + spread;
      this.shots.push({
        type,
        yaw,
        pitch: jet.pitch,
        forward: viewAxes(yaw, jet.pitch).forward,
        speed: payloads[type].speed + jet.speed,
        position: offset(jet.position, jet.axes(), lateral, -0.18, jet.spec.length + 0.48),
        life: payloads[type].life
      });
    };
    if (button === 0) {
      if (this.time - this.lastPrimary < 0.115) return;
      this.lastPrimary = this.time;
      this.barrel *= -1;
      launch("tracer", this.barrel * 0.36);
    } else if (button === 2 && this.remaining(jet) === 0) {
      this.cooldowns.set(jet.id, this.time + jet.spec.cooldown);
      if (jet.id === "wraith") {
        for (const side of [-1, 0, 1]) launch("pulse", side * 1.7, -side * 0.055);
      } else launch(jet.id === "eventide" ? "well" : "rocket");
    }
  }

  update(dt, world) {
    this.time += dt;
    const solid = (x, y, z) => blocks[world.get(x, y, z)].solid;
    for (const shot of this.shots) {
      const { radius } = payloads[shot.type];
      const distance = Math.min(dt, shot.life) * shot.speed;
      const hit = raycast(shot.position, shot.forward, distance, solid);
      shot.position = shot.position.map((n, i) => n + shot.forward[i] * (hit?.distance ?? distance));
      shot.life = hit ? 0 : shot.life - dt;
      if (shot.type === "well" && shot.life <= 0) {
        this.effects.push({ type: "gravity", position: shot.position, age: 0, life: 1.25, radius, collapsed: false });
      } else if (hit) {
        carveImpact(world, hit.block, shot.position, radius);
        this.effects.push({ type: shot.type === "pulse" ? "ion" : "spark", position: shot.position, age: 0, life: 0.43, radius: Math.max(0.55, radius) });
      }
    }
    this.shots = this.shots.filter((shot) => shot.life > 0);
    for (const effect of this.effects) {
      effect.age += dt;
      if (effect.type === "gravity" && !effect.collapsed && effect.age >= 0.85) {
        effect.collapsed = true;
        carveImpact(world, null, effect.position, effect.radius);
      }
    }
    this.effects = this.effects.filter((effect) => effect.age < effect.life);
  }

  renderables() {
    const objects = this.shots.map((shot) => ({ ...shot, mesh: this.meshes[shot.type] }));
    for (const { type, position, age, life, radius, collapsed } of this.effects) {
      const phase = age / life;
      if (type === "gravity") {
        const size = collapsed ? Math.max(0.1, (1 - phase) * radius * 2.8) : radius * (0.42 + 0.52 * Math.sin(phase * Math.PI));
        objects.push({ mesh: this.meshes.well, position, yaw: age * 6, roll: age * 4, scale: Math.max(0.16, size * 0.44) }, { mesh: this.meshes.ring, position, yaw: age * 2.4, pitch: 0.72, scale: size }, { mesh: this.meshes.ring, position, yaw: -age * 2.7, pitch: -0.86, scale: size * 0.86 });
        for (let i = 0; i < 12; i++) {
          const angle = (i * Math.PI) / 6 + age * (2 + i * 0.15);
          const orbit = size * (1.28 - phase) * (1 + (i % 3) * 0.16);
          objects.push({ mesh: this.meshes.ring, scale: 0.12, position: [position[0] + Math.cos(angle) * orbit, position[1] + Math.sin(i + age * 8) * orbit * 0.54, position[2] + Math.sin(angle) * orbit], yaw: angle });
        }
      } else {
        for (let i = 0; i < (radius > 1 ? 13 : 5); i++) {
          const yaw = i * 2.39996,
            pitch = Math.asin(1 - (2 * (i + 0.5)) / 13);
          const direction = viewAxes(yaw, pitch).forward;
          objects.push({ mesh: this.meshes[type], position: position.map((n, a) => n + direction[a] * phase * radius * 1.35), yaw: yaw + age * 9, pitch, scale: 1.2 * (1 - phase) + 0.13 });
        }
      }
    }
    return objects;
  }
}
