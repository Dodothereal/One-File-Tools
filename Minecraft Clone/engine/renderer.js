import { COLS, TILE } from './atlas.js';
import { viewProjection, visible } from './math.js';
import { atmosphere } from './atmosphere.js';

const skyVertex = `#version 300 es
out vec2 point;
void main() {
  point = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)) * 2.0 - 1.0;
  gl_Position = vec4(point, 0., 1.);
}`;

const skyFragment = `#version 300 es
precision highp float;
in vec2 point;
out vec4 color;
uniform vec3 forward, right, up, eye, horizon, zenith, sun;
uniform vec2 scale;
uniform float daylight;
uniform bool clouds, stars, sunlight;
float random(vec2 p) { return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float noise(vec2 p) {
  vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(random(i),random(i+vec2(1,0)),f.x),mix(random(i+vec2(0,1)),random(i+1.),f.x),f.y);
}
void main() {
  vec3 ray = normalize(forward + right * point.x * scale.x + up * point.y * scale.y);
  vec3 rgb = mix(horizon, zenith, smoothstep(-.08,.85,ray.y));
  float sunDot = max(0., dot(ray,sun));
  vec3 sunColor = vec3(1.,.84,.57);
  if (sunlight) rgb += sunColor * pow(sunDot,20.) * .2 * daylight;
  if (sunlight && ray.y > -.02 && sun.y > -.03) {
    vec3 local = ray - sun * sunDot;
    float square = max(abs(dot(local,normalize(vec3(sun.z,0.,-sun.x)))),abs(local.y));
    if (sunDot > .99 && square < .029) rgb = sunColor;
  }
  vec2 starCell = floor(vec2(atan(ray.x,ray.z),asin(ray.y))*310.);
  if (stars && ray.y > 0. && random(starCell) > .996) rgb += vec3(.65,.76,.95) * (1.-daylight);
  if (clouds && ray.y > .055 && eye.y < 113.) {
    vec2 p = floor((eye.xz + ray.xz * ((113. - eye.y) / ray.y)) / 4.) * .0625;
    float cover = noise(p)*.7 + noise(p*2.3)*.3;
    if (cover > .62) rgb = mix(rgb,vec3(.83,.89,.92)*(.27+daylight*.73),smoothstep(.055,.35,ray.y)*.83);
  }
  color = vec4(rgb,1.);
}`;

const voxelVertex = `#version 300 es
layout(location=0) in vec3 position;
layout(location=1) in vec4 material;
uniform mat4 vp;
uniform vec3 offset;
uniform vec2 rotation;
out vec2 uv;
out float shade, fogDepth;
flat out float tile;
void main() {
  vec3 p = vec3(position.x*rotation.x + position.z*rotation.y, position.y,
                position.z*rotation.x - position.x*rotation.y) + offset;
  gl_Position = vp * vec4(p,1.);
  fogDepth = length(p);
  uv = material.xy;
  tile = material.z;
  shade = material.w;
}`;

const voxelFragment = `#version 300 es
precision highp float;
in vec2 uv;
in float shade, fogDepth;
flat in float tile;
uniform sampler2D atlas;
uniform vec3 horizon;
uniform vec2 fog;
uniform float daylight, alpha;
out vec4 color;
void main() {
  vec2 texel = vec2(mod(tile,${COLS}.),floor(tile/${COLS}.))*${TILE}. + clamp(uv*${TILE}., .5, ${TILE - 0.5});
  vec3 base = texture(atlas,texel/vec2(textureSize(atlas,0))).rgb;
  vec3 light = mix(vec3(.27,.36,.55),vec3(1.05,1.03,.96),daylight);
  vec3 lit = shade < 0. ? base : base * shade * light;
  float haze = smoothstep(fog.x,fog.y,fogDepth);
  color = vec4(mix(lit,horizon,haze),alpha);
}`;

const lineVertex = `#version 300 es
layout(location=0) in vec3 position;
uniform mat4 vp;
uniform vec3 offset;
void main() { gl_Position = vp * vec4(position + offset,1.); }`;
const lineFragment = `#version 300 es
precision mediump float;
out vec4 color;
void main() { color = vec4(1.,.96,.81,.88); }`;

function program(gl, vert, frag, uniforms) {
  const p = gl.createProgram();
  for (const [type, source] of [[gl.VERTEX_SHADER, vert], [gl.FRAGMENT_SHADER, frag]]) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
    gl.attachShader(p, shader);
    gl.deleteShader(shader);
  }
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  return { p, ...Object.fromEntries(uniforms.map(name => [name, gl.getUniformLocation(p, name)])) };
}

function boxLines() {
  const points = [];
  for (let i = 0; i < 8; i++) {
    for (let a = 0; a < 3; a++) {
      const j = i ^ (1 << a);
      if (j <= i) continue;
      for (const n of [i, j]) for (let k = 0; k < 3; k++) points.push(n & (1 << k) ? 1.002 : -0.002);
    }
  }
  return new Float32Array(points);
}

export class Renderer {
  constructor(canvas, atlas) {
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false });
    if (!gl) throw new Error('This world needs WebGL 2. Try a current browser with hardware acceleration on.');
    this.gl = gl;
    this.canvas = canvas;
    this.sky = program(gl, skyVertex, skyFragment, ['forward','right','up','eye','horizon','zenith','sun','scale','daylight','clouds','stars','sunlight']);
    this.voxel = program(gl, voxelVertex, voxelFragment, ['vp','offset','rotation','atlas','horizon','fog','daylight','alpha']);
    this.line = program(gl, lineVertex, lineFragment, ['vp','offset']);
    this.edges = this.buffer(boxLines(), 3);
    this.atlas = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.atlas);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }

  buffer(data, stride) {
    if (!data.length) return null;
    const { gl } = this;
    const vao = gl.createVertexArray(), vbo = gl.createBuffer();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, stride*4, 0);
    if (stride > 3) {
      gl.enableVertexAttribArray(1);
      gl.vertexAttribPointer(1, 4, gl.FLOAT, false, stride*4, 12);
    }
    gl.bindVertexArray(null);
    return { vao, vbo, count: data.length / stride };
  }

  upload({ opaque, liquid }) {
    return { opaque: this.buffer(opaque, 7), liquid: this.buffer(liquid, 7) };
  }

  release(mesh) {
    for (const buffer of Object.values(mesh)) {
      if (!buffer) continue;
      this.gl.deleteVertexArray(buffer.vao);
      this.gl.deleteBuffer(buffer.vbo);
    }
  }

  render(camera, tiles, settings, time, dimension, target, entities) {
    const { gl, canvas, sky, voxel, line } = this;
    const ratio = Math.min(devicePixelRatio || 1, 2) * settings.scale;
    const width = Math.max(1, Math.floor(canvas.clientWidth*ratio));
    const height = Math.max(1, Math.floor(canvas.clientHeight*ratio));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    const aspect = width / height;
    const radius = settings.distance * 16;
    const vp = viewProjection(camera, aspect, radius*1.65 + 32);
    const [px, py, pz] = camera.position;
    const phase = time * Math.PI * 2;
    const altitude = Math.sin(phase);
    const sun = [Math.cos(phase) * 0.94, altitude * 0.94, 0.341];
    const lit = Math.min(1, Math.max(0, (altitude + .18) * 2.1));
    const daylight = dimension.daylight ?? lit;
    const { horizon, zenith, fog, fogRange, stars, sun: sunlight } = atmosphere(dimension, settings, daylight);
    const tan = Math.tan(camera.fov * Math.PI / 360);
    gl.viewport(0, 0, width, height);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.useProgram(sky.p);
    gl.uniform3fv(sky.forward, camera.forward);
    gl.uniform3fv(sky.right, camera.right);
    gl.uniform3fv(sky.up, camera.up);
    gl.uniform3fv(sky.eye, camera.position);
    gl.uniform3fv(sky.horizon, horizon);
    gl.uniform3fv(sky.zenith, zenith);
    gl.uniform3fv(sky.sun, sun);
    gl.uniform2f(sky.scale, tan * aspect, tan);
    gl.uniform1f(sky.daylight, daylight);
    gl.uniform1i(sky.clouds, settings.clouds && dimension.clouds !== false);
    gl.uniform1i(sky.stars, stars);
    gl.uniform1i(sky.sunlight, sunlight);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.useProgram(voxel.p);
    gl.bindTexture(gl.TEXTURE_2D, this.atlas);
    gl.uniform1i(voxel.atlas, 0);
    gl.uniformMatrix4fv(voxel.vp, false, vp);
    gl.uniform2f(voxel.fog, ...fogRange);
    gl.uniform3fv(voxel.horizon, fog);
    gl.uniform1f(voxel.daylight, daylight);
    gl.uniform1f(voxel.alpha, 1);
    gl.uniform2f(voxel.rotation, 1, 0);
    const draw = (buffer, x, y, z) => {
      if (!buffer) return;
      gl.uniform3f(voxel.offset, x-px, y-py, z-pz);
      gl.bindVertexArray(buffer.vao);
      gl.drawArrays(gl.TRIANGLES, 0, buffer.count);
    };
    const water = [];
    let drawn = 0;
    for (const tile of tiles) {
      const [x,z,maxX,maxZ] = tile.bounds;
      if (!visible(tile.bounds, camera, vp)) continue;
      draw(tile.mesh.opaque, x, 0, z);
      if (tile.mesh.liquid) water.push([tile, ((x+maxX)*.5-px)**2 + ((z+maxZ)*.5-pz)**2]);
      drawn++;
    }
    for (const entity of entities) {
      gl.uniform2f(voxel.rotation, Math.cos(entity.yaw ?? 0), Math.sin(entity.yaw ?? 0));
      draw(entity.mesh.opaque, ...entity.position);
    }
    gl.uniform2f(voxel.rotation, 1, 0);
    gl.enable(gl.BLEND);
    gl.depthMask(false);
    gl.uniform1f(voxel.alpha, .70);
    water.sort((a,b) => b[1]-a[1]);
    for (const [tile] of water) draw(tile.mesh.liquid, tile.bounds[0], 0, tile.bounds[1]);
    gl.depthMask(true);
    if (target) {
      gl.useProgram(line.p);
      gl.uniformMatrix4fv(line.vp, false, vp);
      gl.uniform3f(line.offset, target[0]-px, target[1]-py, target[2]-pz);
      gl.bindVertexArray(this.edges.vao);
      gl.drawArrays(gl.LINES, 0, this.edges.count);
    }
    gl.disable(gl.BLEND);
    gl.bindVertexArray(null);
    return drawn;
  }
}
