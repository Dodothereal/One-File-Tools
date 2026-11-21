import { blocks, faceTile } from '../world/blocks.js';
import { COLS, TILE } from '../engine/atlas.js';
import { presets, settingRules, normalizeSettings, saveSettings } from './settings.js';
import { FlightUI } from './flight.js';

export const el = id => document.getElementById(id);

export class Interface {
  constructor(game, atlas) {
    this.game = game;
    this.atlas = atlas;
    this.view = 'menu';
    this.hotbarSignature = '';
    this.history = [];
    this.historyIndex = 0;
    this.flight = new FlightUI(game, this, el);
    el('play').addEventListener('click', () => game.lock());
    el('settings').addEventListener('click', () => this.show('settings'));
    el('back').addEventListener('click', () => this.show('menu'));
    el('preset').replaceChildren(...['Custom', ...Object.keys(presets)].map(name => new Option(name, name)));
    el('preset').options[0].disabled = true;
    el('preset').addEventListener('change', e => {
      const preset = e.target.value;
      this.setSettings({ ...presets[preset], preset });
    });
    for (const key of Object.keys(settingRules)) {
      el(key === 'overlay' ? 'show-overlay' : key).addEventListener('input', e => this.setSettings({
        [key]: settingRules[key] === 'boolean' ? e.target.checked
          : key === 'fog' ? e.target.value : Number(e.target.value),
      }));
    }
    el('chat-form').addEventListener('submit', e => {
      e.preventDefault();
      const input = el('command');
      const command = input.value.trim();
      if (!command || command === '/') return;
      this.history.push(command);
      this.historyIndex = this.history.length;
      this.log(command, 'entry');
      this.log(game.commands.execute(command, game));
      input.value = '';
    });
    el('command').addEventListener('keydown', e => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const matches = game.commands.complete(e.target.value);
        if (matches.length === 1) e.target.value = matches[0] + ' ';
        else if (matches.length) this.log(matches.join('  '));
      } else if (e.key === 'Escape') {
        e.preventDefault();
        this.show('menu');
        el('play').focus();
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        this.historyIndex = Math.max(0, Math.min(this.history.length,
          this.historyIndex + (e.key === 'ArrowUp' ? -1 : 1)));
        e.target.value = this.history[this.historyIndex] ?? '';
      }
    });
    this.syncSettings();
  }

  setSettings(changes) {
    this.game.settings = normalizeSettings({ ...this.game.settings, ...changes });
    saveSettings(this.game.settings);
    this.syncSettings();
  }

  syncSettings() {
    const { settings } = this.game;
    el('preset').value = settings.preset;
    for (const [key, rule] of Object.entries(settingRules)) {
      if (rule === 'boolean') el(key === 'overlay' ? 'show-overlay' : key).checked = settings[key];
      else el(key).value = settings[key];
      const output = el(`${key}-value`);
      if (output) output.value = key === 'scale' ? `${Math.round(settings[key]*100)}%`
        : `${settings[key]}${key === 'distance' || key === 'detail' ? ' chunks' : key === 'fov' ? '°' : key === 'budget' ? ' ms' : '×'}`;
    }
  }

  show(view) {
    this.view = view;
    this.flight.show(view);
    el('overlay').hidden = view === 'play' || view === 'chat';
    el('menu').hidden = view !== 'menu';
    el('settings-panel').hidden = view !== 'settings';
    el('menu-scroll').scrollTop = 0;
    el('hud').hidden = view !== 'play' && view !== 'chat';
    el('chat').hidden = view !== 'chat';
    if (this.game.started) {
      el('play').firstChild.nodeValue = 'Resume expedition ';
      el('intro').textContent = 'Your expedition is paused. Pick up where you left off, or tune your view.';
    }
  }

  openChat(prefix) {
    this.show('chat');
    if (!el('chat-log').hasChildNodes()) this.log('World Console — type /help for commands.');
    el('command').value = prefix;
    el('command').focus();
  }

  log(message, className = '') {
    if (!message) return;
    const log = el('chat-log');
    const p = document.createElement('p');
    p.className = className;
    p.textContent = message;
    log.append(p);
    while (log.children.length > 40) log.firstElementChild.remove();
    log.scrollTop = log.scrollHeight;
  }

  notice(message) {
    const notice = el('notice');
    notice.hidden = !message;
    notice.textContent = message;
  }

  update(camera, fps, drawn) {
    const { player, world } = this.game;
    this.flight.update(player.vehicle, camera);
    const [x,y,z] = player.position.map(Math.floor);
    const biome = world.generator.surface?.(x,z).biome;
    el('dimension-name').textContent = biome ? `${world.dimension.name} · ${biome}` : world.dimension.name;
    if (world.dimension.name !== this.dimensionName) {
      this.dimensionName = world.dimension.name;
      el('world-name').textContent = this.dimensionName;
      document.title = `Minecraft Clone · ${this.dimensionName}`;
    }
    el('location').textContent = `XYZ  ${x} / ${y} / ${z}`;
    el('statusline').textContent = `${camera.mode?.name ?? 'Preview'}  /  ${player.flying ? 'Flying' : player.mode}  /  ${fps} FPS · ${drawn} tiles`;
    el('performance').hidden = !this.game.settings.overlay;
    el('performance').textContent = `${fps} FPS · ${this.game.frameMs?.toFixed(1) ?? '—'} ms\n${drawn} tiles · ${this.game.renderer.triangles ?? 0} triangles\nQueue ${this.game.stream.jobs.length + this.game.stream.dirty.size} · ${this.game.settings.preset} · ${this.game.settings.distance} chunks`;
    const signature = `${player.slot}:${player.hotbar.join(',')}`;
    if (signature === this.hotbarSignature) return;
    this.hotbarSignature = signature;
    el('selected-name').textContent = blocks[player.hotbar[player.slot]].name;
    el('hotbar').replaceChildren(...player.hotbar.map((id, i) => {
      const slot = document.createElement('div');
      slot.className = i === player.slot ? 'slot selected' : 'slot';
      slot.title = blocks[id].name;
      const number = document.createElement('span');
      number.textContent = i + 1;
      const icon = document.createElement('canvas');
      icon.width = icon.height = TILE;
      const tile = faceTile(id, 2);
      icon.getContext('2d').drawImage(this.atlas, tile % COLS * TILE, Math.floor(tile / COLS) * TILE,
        TILE, TILE, 0, 0, TILE, TILE);
      slot.append(number, icon);
      return slot;
    }));
  }
}
