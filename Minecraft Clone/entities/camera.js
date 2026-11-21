import { viewAxes } from '../engine/math.js';
import { raycast } from '../engine/raycast.js';
import { blocks } from '../world/blocks.js';

export const perspectives = [
  { id: 'first', name: 'First Person' },
  { id: 'close', name: 'Third Person · Close', distance: 3.8 },
  { id: 'far', name: 'Third Person · Far', distance: 8 },
  { id: 'cockpit', name: 'Cockpit' },
];

export function resolveCamera(index, player, world, fov) {
  const mode = perspectives[index];
  const rig = player.vehicle?.camera(mode.id, player);
  const yaw = rig?.yaw ?? player.yaw;
  const pitch = rig?.pitch ?? player.pitch;
  const axes = viewAxes(yaw, pitch);
  const eye = rig?.position ?? player.eye();
  let position = eye;
  if (mode.distance && !rig) {
    const back = axes.forward.map(n => -n);
    const hit = raycast(eye, back, mode.distance, (x,y,z) => blocks[world.get(x,y,z)].solid);
    const distance = hit ? Math.max(0, hit.distance - .2) : mode.distance;
    position = eye.map((n,i) => n + back[i]*distance);
  }
  return { position, ...axes, fov: rig?.fov ?? fov, mode,
    showPlayer: !player.vehicle && !!mode.distance && position !== eye &&
      Math.hypot(...position.map((p,i) => p-eye[i])) > .6 };
}
