import { meshBoxes } from "../engine/mesh.js";
import { registerTile } from "../world/blocks.js";

const colors = {
  silver: ["#afbabd", "#a4afb4", "#c6d3d8"],
  steel: ["#536776", "#5c7585", "#4c5f6c"],
  alloy: ["#4d3d72", "#634e94", "#413360"],
  dark: ["#222f3a", "#2a3c48", "#313747"],
  glass: ["#345e72", "#3e7890", "#58a1b3"],
  red: ["#d85843", "#db624e", "#b64031"],
  amber: ["#ffb154", "#fff1b0", "#ff9661"],
  cyan: ["#63f1ff", "#b9fcff", "#37bded"],
  violet: ["#ab83ff", "#d6baff", "#7651f4"],
  void: ["#302051", "#211333", "#3c1e57"]
};
const materials = Object.fromEntries(Object.entries(colors).map(([key, palette]) => [key, registerTile(palette)]));
const luminous = new Set(["amber", "cyan", "violet"]);
const box = (x, y, z, w, h, l, paint) => ({
  origin: [x - w / 2, y, z - l / 2],
  size: [w, h, l],
  tile: materials[paint],
  paint: colors[paint][0],
  glow: luminous.has(paint)
});
const mirrored = (x, y, z, w, h, l, color) => [box(-x, y, z, w, h, l, color), box(x, y, z, w, h, l, color)];
const sweep = (steps, step, first, advance, chord, taper, color) =>
  Array.from({ length: steps }, (_, i) => mirrored(0.55 + (i + 0.5) * step, -0.19, first - i * advance, step, 0.25, chord - i * taper, color))
    .flat()
    .map((part) => ({ ...part, wing: true }));

export const jets = {
  kestrel: {
    name: "Kestrel",
    designation: "A-07",
    era: "Vintage interceptor",
    accent: "#ffb154",
    description: "Silver swept wings and tight turns.",
    special: "Blaze Rocket",
    payload: "One heavy rocket. Blasts a small crater.",
    speed: [12, 30, 46],
    turn: 1.34,
    cooldown: 2.3,
    span: 3.45,
    length: 3.6,
    seat: 1.35,
    shape: [box(0, -0.49, -0.27, 1.34, 0.98, 5.15, "silver"), box(0, -0.36, 2.49, 1.08, 0.76, 1.2, "silver"), box(0, -0.24, 3.23, 0.63, 0.49, 0.74, "red"), box(0, 0.4, 0.63, 0.97, 0.58, 1.63, "glass"), box(0, -0.36, -2.85, 1.04, 0.78, 0.55, "dark"), box(0, -0.28, -3.13, 0.66, 0.62, 0.18, "amber"), ...sweep(5, 0.57, 0.06, 0.31, 2.6, 0.4, "silver"), ...mirrored(3.3, -0.165, -1.18, 0.34, 0.2, 0.88, "red"), ...mirrored(1, -0.08, -2.3, 1.24, 0.22, 0.96, "silver"), box(0, 0.31, -2.28, 0.28, 1.07, 1.12, "silver"), box(0, 1.36, -2.52, 0.29, 0.25, 0.63, "red")]
  },
  wraith: {
    name: "Wraith",
    designation: "M-24",
    era: "Modern strike jet",
    accent: "#63f1ff",
    description: "Twin engines and a wide delta wing.",
    special: "Pulse Salvo",
    payload: "Three energy bolts sweep a wide strip.",
    speed: [16, 37, 56],
    turn: 1.11,
    cooldown: 3,
    span: 4.15,
    length: 4.25,
    seat: 1.9,
    shape: [box(0, -0.48, -0.26, 1.7, 0.95, 6.54, "steel"), box(0, -0.36, 3.34, 1.32, 0.72, 1.27, "steel"), box(0, -0.23, 4.02, 0.72, 0.43, 0.48, "dark"), box(0, 0.44, 1.27, 0.97, 0.55, 1.6, "glass"), ...sweep(6, 0.6, 0.02, 0.27, 3.87, 0.52, "steel"), ...mirrored(3.98, -0.15, -1.42, 0.36, 0.18, 0.93, "cyan"), ...mirrored(1.11, -0.36, -1.78, 0.83, 0.85, 4.03, "dark"), ...mirrored(1.11, -0.31, -3.91, 0.57, 0.65, 0.23, "cyan"), ...mirrored(1.17, 0.4, -2.49, 0.32, 1.19, 1.37, "steel"), ...mirrored(1.34, 1.52, -2.7, 0.32, 0.31, 0.81, "steel"), ...mirrored(2.48, -0.45, -0.75, 0.51, 0.3, 1.61, "dark")]
  },
  eventide: {
    name: "Eventide",
    designation: "X-99",
    era: "Future voidcraft",
    accent: "#c69bff",
    description: "Split wings and a glowing reactor.",
    special: "Singularity",
    payload: "A gravity well collapses into a deep crater.",
    speed: [19, 46, 68],
    turn: 1.23,
    cooldown: 5,
    span: 4.65,
    length: 4.6,
    seat: 1.8,
    shape: [box(0, -0.44, -0.32, 1.42, 0.88, 7.55, "alloy"), box(0, -0.27, 3.79, 1.04, 0.55, 1.52, "dark"), box(0, -0.13, 4.46, 0.44, 0.25, 0.24, "violet"), box(0, 0.41, 1.16, 0.91, 0.55, 1.72, "glass"), ...sweep(5, 0.81, -0.23, 0.53, 2.95, 0.45, "alloy"), ...mirrored(3.12, -0.17, -2.36, 1.8, 0.22, 1.23, "dark"), ...mirrored(4.2, -0.28, -1.57, 0.63, 0.65, 3.57, "alloy"), ...mirrored(4.2, -0.17, -3.41, 0.43, 0.4, 0.16, "violet"), ...mirrored(4.2, 0.365, -1.38, 0.25, 0.08, 2.84, "violet"), ...mirrored(2.0, 0.08, -1.16, 0.66, 0.08, 1.94, "violet"), ...mirrored(1.23, -0.33, -3, 0.54, 0.71, 2.1, "dark"), box(0, -0.31, -4.18, 1, 0.64, 0.22, "violet")]
  }
};

export function jetMeshes(renderer) {
  return Object.fromEntries(Object.entries(jets).map(([id, jet]) => [id, renderer.upload(meshBoxes(jet.shape))]));
}

export function effectMeshes(renderer) {
  const beam = (color, size, length) => meshBoxes([box(0, -size / 2, length / 2, size, size, length, color)]);
  const ring = meshBoxes(
    Array.from({ length: 24 }, (_, i) => {
      const angle = (i * Math.PI) / 12;
      return box(Math.cos(angle), Math.sin(angle) - 0.055, 0, 0.22, 0.22, 0.1, "violet");
    })
  );
  return Object.fromEntries(
    Object.entries({
      tracer: beam("amber", 0.13, 3),
      rocket: meshBoxes([box(0, -0.21, 0, 0.42, 0.42, 0.95, "red"), box(0, -0.095, -0.87, 0.19, 0.19, 1.29, "amber")]),
      pulse: beam("cyan", 0.26, 2.45),
      well: meshBoxes([box(0, -0.48, 0, 0.96, 0.96, 0.96, "void"), box(0, 0.48, 0, 0.59, 0.08, 0.59, "violet")]),
      ring,
      spark: meshBoxes([box(0, -0.12, 0, 0.24, 0.24, 0.24, "amber")]),
      ion: meshBoxes([box(0, -0.12, 0, 0.24, 0.24, 0.24, "cyan")])
    }).map(([id, mesh]) => [id, renderer.upload(mesh)])
  );
}
