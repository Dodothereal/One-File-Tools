export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const dot = (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
export const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];

export function viewAxes(yaw, pitch, roll = 0) {
  const c = Math.cos(pitch);
  const forward = [Math.sin(yaw)*c, Math.sin(pitch), Math.cos(yaw)*c];
  const right = [-Math.cos(yaw), 0, Math.sin(yaw)];
  const up = cross(right, forward);
  if (!roll) return { forward, right, up };
  const s = Math.sin(roll),
    r = Math.cos(roll);
  return { forward, right: right.map((n, i) => n * r + up[i] * s), up: up.map((n, i) => n * r - right[i] * s) };
}

export function viewProjection(camera, aspect, far) {
  const { forward, right, up, fov } = camera;
  const r = 1 / Math.tan(fov * Math.PI / 360);
  // Camera-relative positions avoid cancellation on large worlds.
  const near = 0.06, range = (far + near) / (far - near);
  return new Float32Array([
    right[0]*r/aspect, up[0]*r, forward[0]*range, forward[0],
    right[1]*r/aspect, up[1]*r, forward[1]*range, forward[1],
    right[2]*r/aspect, up[2]*r, forward[2]*range, forward[2],
    0, 0, -2*far*near/(far-near), 0,
  ]);
}

export function visible(bounds, camera, matrix) {
  const [x, z, maxX, maxZ, maxY] = bounds;
  const [px, py, pz] = camera.position;
  for (const [row, sign] of [[0,1],[0,-1],[1,1],[1,-1],[2,1],[2,-1]]) {
    const a = matrix[3] + sign*matrix[row];
    const b = matrix[7] + sign*matrix[4+row];
    const c = matrix[11] + sign*matrix[8+row];
    if (a*((a < 0 ? x : maxX)-px) + b*((b < 0 ? 0 : maxY)-py) +
      c*((c < 0 ? z : maxZ)-pz) + matrix[15] + sign*matrix[12+row] < 0) return false;
  }
  return true;
}
