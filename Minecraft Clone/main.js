import { createAtlas } from './engine/atlas.js';
import { Renderer } from './engine/renderer.js';
import { ChunkStream } from './engine/stream.js';
import { raycast } from './engine/raycast.js';
import { viewAxes } from './engine/math.js';
import { AIR, blocks } from './world/blocks.js';
import { dimensions } from './world/dimensions.js';
import { World } from './world/world.js';
import { Player, playerMesh } from './entities/player.js';
import { perspectives, resolveCamera } from './entities/camera.js';
import { createCommands } from './commands/builtin.js';
import { registerPortalCommands } from './commands/portals.js';
import { lightNetherFrame, updatePortalTravel } from './world/portals.js';
import { Interface, el } from './ui/interface.js';
import { loadSettings } from './ui/settings.js';

const SEED = 2391;

class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.settings = loadSettings();
    this.commands = registerPortalCommands(createCommands());
    this.keys = new Set();
    this.savedEdits = new Map();
    this.perspective = 0;
    this.started = false;
    this.time = .20;
    const atlas = createAtlas();
    this.renderer = new Renderer(canvas, atlas);
    this.avatar = this.renderer.upload(playerMesh());
    this.enterDimension(dimensions.get('overworld'));
    this.ui = new Interface(this, atlas);
    this.bindInput();
    requestAnimationFrame(at => this.frame(at));
  }

  enterDimension(dimension) {
    this.stream?.dispose();
    if (!this.savedEdits.has(dimension.id)) this.savedEdits.set(dimension.id, new Map());
    this.world = new World(dimension, SEED, this.savedEdits.get(dimension.id));
    this.portalState = { cooldown: 3, contact: null, elapsed: 0 };
    const [x,z] = dimension.spawn ?? (dimension.id === 'overworld' ? [18, 0] : [0, 0]);
    const position = this.world.spawn(x, z);
    if (!this.player) {
      this.player = new Player(position);
      this.player.yaw = -.5;
    } else {
      this.player.vehicle = null;
      this.player.moveTo(position);
    }
    this.stream = new ChunkStream(this.world, this.renderer);
    this.previewCamera = { position: [x, position[1] + 12, z - 9], ...viewAxes(-.42, -.23), fov: 72 };
  }

  lock() {
    this.ui.notice('');
    const failure = () => {
      this.ui.show('menu');
      this.ui.notice('Could not capture the mouse. Click the button to try again.');
    };
    try { this.canvas.requestPointerLock()?.catch(failure); } catch { failure(); }
  }

  bindInput() {
    document.addEventListener('pointerlockchange', () => {
      this.keys.clear();
      if (document.pointerLockElement === this.canvas) {
        if (!this.started) {
          window.addEventListener('beforeunload', event => {
            event.preventDefault();
            event.returnValue = true;
          });
        }
        this.started = true;
        this.ui.show('play');
        this.canvas.focus();
      } else if (this.ui.view === 'play') this.ui.show('menu');
    });
    document.addEventListener('pointerlockerror', () => {
      this.ui.show('menu');
      this.ui.notice('Mouse capture is unavailable. Try opening the game in its own browser tab.');
    });
    window.addEventListener('blur', () => this.keys.clear());
    window.addEventListener('keydown', event => {
      if (this.ui.view !== 'play') return;
      const { code } = event;
      if (event.ctrlKey) event.preventDefault();
      if (!event.ctrlKey && (code === 'Slash' || code === 'Enter')) {
        event.preventDefault();
        this.ui.openChat(code === 'Slash' ? '/' : '');
        document.exitPointerLock();
        return;
      }
      if (code === 'F5') {
        event.preventDefault();
        if (!event.repeat) this.perspective = (this.perspective + 1) % perspectives.length;
      } else if (code === 'Space') {
        event.preventDefault();
        if (!event.repeat && !this.player.vehicle) this.player.jump(performance.now());
      } else if (/^Digit[1-9]$/.test(code)) this.player.slot = Number(code.slice(-1)) - 1;
      this.keys.add(code);
    });
    window.addEventListener('keyup', event => this.keys.delete(event.code));
    document.addEventListener('mousemove', e => {
      if (this.ui.view === 'play') this.player.look(e.movementX, e.movementY, this.settings.sensitivity);
    });
    this.canvas.addEventListener('contextmenu', e => e.preventDefault());
    this.canvas.addEventListener('wheel', e => {
      if (this.ui.view !== 'play') return;
      e.preventDefault();
      this.player.slot = (this.player.slot + Math.sign(e.deltaY) + 9) % 9;
    }, { passive: false });
    document.addEventListener('mousedown', e => {
      if (this.ui.view !== 'play' || (e.button !== 0 && e.button !== 2)) return;
      e.preventDefault();
      if (this.player.vehicle) {
        this.player.vehicle.interact(e.button, this.world, this.player);
        return;
      }
      const hit = this.target(this.camera());
      if (!hit) return;
      if (e.button === 0 && !blocks[this.world.get(...hit.block)].unbreakable) this.world.set(...hit.block, AIR);
      if (e.button === 2 && hit.adjacent && !this.player.intersects(...hit.adjacent)) {
        this.world.set(...hit.adjacent, this.player.hotbar[this.player.slot]);
        lightNetherFrame(this.world, hit.adjacent);
      }
    });
  }

  camera() {
    return resolveCamera(this.perspective, this.player, this.world, this.settings.fov);
  }

  target(camera) {
    if (this.player.vehicle) return null;
    const reach = (this.player.mode === 'creative' ? 8 : 5) +
      Math.hypot(...this.player.eye().map((n,i) => n-camera.position[i]));
    return raycast(camera.position, camera.forward, reach, (x,y,z) => blocks[this.world.get(x,y,z)].solid);
  }

  frame(at) {
    const elapsed = this.lastFrame === undefined ? 0 : at - this.lastFrame;
    this.lastFrame = at;
    if (this.ui.view === 'play') {
      let remaining = Math.min(.08, elapsed/1000);
      while (remaining > 0) {
        const dt = Math.min(remaining, 1/120);
        this.player.step(dt, this.keys, this.world);
        remaining -= dt;
      }
      this.time = (this.time + elapsed/1_200_000) % 1;
      updatePortalTravel(this, Math.min(.08, elapsed / 1000), dimensions);
    }
    this.stream.update(this.player.position, this.settings);
    const camera = this.started ? this.camera() : this.previewCamera;
    const selection = this.ui.view === 'play' ? this.target(camera)?.block : null;
    const objects = this.player.vehicle?.renderables() ?? [];
    const renderables = camera.showPlayer ? [...objects, {
      mesh: this.avatar, position: this.player.position, yaw: this.player.yaw,
    }] : objects;
    const drawn = this.renderer.render(camera, this.stream.active.values(), this.settings,
      this.time, this.world.dimension, selection, renderables);
    this.periodStart ??= at;
    this.frameCount = (this.frameCount ?? 0) + 1;
    if (at - this.periodStart > 500) {
      this.fps = Math.round(this.frameCount * 1000 / (at - this.periodStart));
      this.frameCount = 0;
      this.periodStart = at;
    }
    if (this.started) this.ui.update(camera, this.fps ?? '—', drawn);
    requestAnimationFrame(next => this.frame(next));
  }
}

try {
  new Game(el('world'));
} catch (error) {
  console.error(error);
  el('notice').hidden = false;
  el('notice').textContent = error.message;
  el('play').disabled = el('settings').disabled = true;
}
