import { blocks, faceTile } from '../world/blocks.js';
import { COLS, TILE } from '../engine/atlas.js';
import { presets, normalizeSettings, saveSettings } from './settings.js';
import { FlightUI } from "./flight.js";

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
    el('preset').replaceChildren(...Object.keys(presets).map(name => new Option(name, name)));
    el('preset').addEventListener('change', e => {
      const preset = e.target.value;
      this.setSettings({ ...presets[preset], preset });
    });
    for (const key of ['distance', 'fov', 'sensitivity', 'clouds']) {
      el(key).addEventListener('input', e => this.setSettings({
        [key]: key === 'clouds' ? e.target.checked : e.target.valueAsNumber,
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
      if (e.key === 'Escape') {
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
    for (const key of ['preset', 'distance', 'fov', 'sensitivity']) el(key).value = settings[key];
    el('clouds').checked = settings.clouds;
    el('distance-value').value = `${settings.distance} chunks`;
    el('fov-value').value = `${settings.fov}°`;
    el('sensitivity-value').value = `${settings.sensitivity.toFixed(2)}×`;
  }

  show(view) {
    this.view = view;
    this.flight.show(view);
    el('overlay').hidden = view === 'play' || view === 'chat';
    el('menu').hidden = view !== 'menu';
    el('settings-panel').hidden = view !== 'settings';
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
    el('location').textContent = `XYZ  ${x} / ${y} / ${z}`;
    el('statusline').textContent = `${camera.mode.name}  /  ${player.flying ? 'Flying' : player.mode}  /  ${fps} FPS · ${drawn} tiles`;
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
