import { jets } from '../entities/jet-models.js';

function silhouette({ shape, accent }) {
  const panels = [...shape].sort((a,b) => (a.origin[1]+a.size[1])-(b.origin[1]+b.size[1]));
  return `<svg viewBox="-5.8 -5 11.6 10" aria-hidden="true">
    <path d="M-5 0H5 M0-5V5 M-4-4H4V4H-4Z" fill="none" stroke="#a5cebd" stroke-opacity=".25" stroke-width=".035" stroke-dasharray=".2 .2"/>
    ${panels.map(({origin:[x,,z], size:[w,,l], paint}) =>
      `<rect x="${x}" y="${-z-l}" width="${w}" height="${l}" fill="${paint}" stroke="#0e191e" stroke-width=".016"/>`).join('')}
    <path d="M-4.8-4.1h.8m-.8 0v.8m9.6-.8h-.8m.8 0v.8M-4.8 4.1h.8m-.8 0v-.8m9.6.8h-.8m.8 0v-.8"
      fill="none" stroke="${accent}" stroke-width=".055"/>
  </svg>`;
}

const canopy = `<svg class="flight-canopy" viewBox="0 0 1280 720" preserveAspectRatio="none" aria-hidden="true">
  <path fill="#101c24" d="M0 0h1280v66l-123-35-185-10-37 20H345l-37-20-185 10L0 66z
    M0 272l113 153 53 115 159 58 95 13 72-55h296l72 55 95-13 159-58 53-115 113-153v448H0z"/>
  <path fill="#243640" d="M0 308l89 125 56 130 175 67 116 12 68-59h272l68 59 116-12 175-67 56-130 89-125v75l-63 99-50 105-185 74-161 31-52-42H511l-52 42-161-31-185-74-50-105L0 383z"/>
  <path fill="none" stroke="#547884" stroke-width="2" d="M0 273l113 153 53 115 159 57 95 13 72-55h296l72 55 95-13 159-57 53-115 113-153M123 31l185-10 37 20h590l37-20 185 10"/>
  <path fill="#0b141b" stroke="#47656b" stroke-width="2" d="M498 603h284l41 38v59H457v-59z"/>
  <path fill="none" stroke="#37535a" stroke-width="3" d="M36 600l104 48 139 25m965-73l-104 48-139 25M482 660v23h36m280-23v23h-36"/>
  <path fill="currentColor" d="M332 651h17v4h-17zm24 3h17v4h-17zm575-3h17v4h-17zm-24 3h17v4h-17z"/>
</svg>`;

export class FlightUI {
  constructor(game, ui, el) {
    this.hud = el('hud');
    this.overlay = el('overlay');
    this.hangar = document.createElement('section');
    this.hangar.className = 'menu flight-hangar';
    this.hangar.setAttribute('aria-labelledby','hangar-title');
    this.hangar.hidden = true;
    this.hangar.innerHTML = `
      <div class="eyebrow"><span class="live-dot"></span> FIELD GUIDE <span class="eyebrow-line"></span> AIR WING</div>
      <h2 id="hangar-title">FLIGHT HANGAR<span class="accent">.</span></h2>
      <p class="intro">Choose an aircraft and launch directly into the world.</p>
      <div class="flight-fleet">${Object.entries(jets).map(([id, jet]) => `
        <button type="button" class="flight-card" data-aircraft="${id}" style="--aircraft:${jet.accent}">
          <span class="flight-card-index">${jet.designation} <span>${jet.era}</span></span>
          ${silhouette(jet)}
          <strong>${jet.name}</strong><span class="flight-card-description">${jet.description}</span>
          <span class="flight-card-loadout"><b>${jet.special}</b> ${jet.payload}</span>
          <span class="flight-card-action">Launch aircraft <span aria-hidden="true">↗</span></span>
        </button>`).join('')}</div>
      <p class="flight-hangar-note" role="status" hidden></p>
      <div class="flight-hangar-footer">
        <button type="button" class="secondary">Back <span aria-hidden="true">←</span></button>
        <span><kbd>W / S</kbd> Throttle <kbd>MOUSE</kbd> Steer <kbd>SPACE</kbd> Boost</span>
      </div>`;
    el('settings-panel').after(this.hangar);
    const exit = () => {
      ui.show('menu');
      el('open-hangar').focus();
    };
    this.hangar.querySelector('.secondary').addEventListener('click', exit);
    this.hangar.addEventListener('keydown', event => {
      if (event.key === 'Escape') exit();
    });
    this.hangar.querySelectorAll('button[data-aircraft]').forEach(button => {
      button.addEventListener('click', () => {
        const error = game.launchJet(button.dataset.aircraft);
        if (!error) return game.lock();
        const note = this.hangar.querySelector('.flight-hangar-note');
        note.textContent = error;
        note.hidden = false;
      });
    });
    const button = document.createElement('button');
    button.id = 'open-hangar';
    button.type = 'button';
    button.className = 'secondary';
    button.innerHTML = 'Flight hangar <span aria-hidden="true">↗</span>';
    el('settings').after(button);
    button.addEventListener('click', () => ui.show('hangar'));
    const shortcut = document.createElement('span');
    shortcut.innerHTML = '<kbd>J</kbd> Hangar';
    this.hud.querySelector('.hud-tip').append(shortcut);

    this.readout = document.createElement('div');
    this.readout.className = 'flight-hud';
    this.readout.hidden = true;
    this.readout.innerHTML = `
      ${canopy}
      <div class="flight-reticle" aria-hidden="true"><span></span></div>
      <div class="flight-pitch" aria-hidden="true"><span></span><span></span><span></span></div>
      <div class="flight-ident"><span></span><strong></strong><small></small></div>
      <div class="flight-instruments">
        <div><span>SPEED</span><strong data-stat="speed"></strong><small>BLK/S</small></div>
        <div><span>ALTITUDE</span><strong data-stat="altitude"></strong><small>BLK</small></div>
        <div><span>HEADING</span><strong data-stat="heading"></strong><small>DEG</small></div>
      </div>
      <div class="flight-loadout">
        <div><kbd>LMB</kbd> <span>Auto cannon</span></div>
        <div><kbd>RMB</kbd> <strong></strong></div>
        <div class="flight-charge"><i></i></div>
        <small></small>
      </div>
      <div class="flight-controls"><kbd>W / S</kbd> Throttle <kbd>A / D</kbd> Turn
        <kbd>SPACE</kbd> Boost <kbd>E</kbd> Return <kbd>F5</kbd> View <kbd>J</kbd> Hangar</div>`;
    this.hud.prepend(this.readout);
    const find = selector => this.readout.querySelector(selector);
    this.nodes = ['speed','altitude','heading'].map(key => find(`[data-stat="${key}"]`));
    this.identity = ['span','strong','small'].map(tag => find(`.flight-ident ${tag}`));
    this.special = ['strong','i','small'].map(tag => find(`.flight-loadout ${tag}`));
    this.pitch = find('.flight-pitch');
    this.toast = document.createElement('div');
    this.toast.className = 'flight-toast';
    this.toast.hidden = true;
    this.toast.setAttribute('role', 'status');
    this.hud.append(this.toast);
  }

  show(view) {
    this.overlay.dataset.view = view;
    this.hangar.hidden = view !== 'hangar';
    if (!this.hangar.hidden) {
      this.hangar.querySelector('.flight-hangar-note').hidden = true;
      this.hangar.querySelector('.flight-card').focus();
    }
  }

  notify(text) {
    this.toast.textContent = text;
    this.toast.hidden = false;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => { this.toast.hidden = true; }, 3800);
  }

  update(jet, camera) {
    this.readout.hidden = !jet;
    this.hud.toggleAttribute('data-piloting', !!jet);
    if (!jet) return;
    const { spec, weapons } = jet;
    this.readout.toggleAttribute('data-cockpit', camera.mode.id === 'cockpit');
    this.readout.toggleAttribute('data-boost', jet.boosting);
    this.readout.toggleAttribute('data-firing', weapons.time - weapons.lastPrimary < .057);
    this.readout.style.setProperty('--flight-accent', spec.accent);
    this.pitch.style.transform = `translate(-50%, -50%) translateY(${jet.pitch*38}px)`;
    const heading = (Math.round(-jet.yaw*180/Math.PI)%360+360)%360;
    [Math.round(jet.speed),Math.floor(jet.position[1]),String(heading).padStart(3,'0')]
      .forEach((value,i) => { this.nodes[i].textContent = value; });
    [spec.designation,spec.name,camera.mode.name].forEach((value,i) => { this.identity[i].textContent = value; });
    const remaining = weapons.remaining(jet);
    this.special[0].textContent = spec.special;
    this.special[1].style.transform = `scaleX(${1-remaining/spec.cooldown})`;
    this.special[2].textContent = remaining > 0 ? `Charging · ${remaining.toFixed(1)}s` : 'Ready';
  }
}
