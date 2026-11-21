# Stillwell

A fictional wellness brand that gradually unravels into an immersive horror experience as the visitor scrolls. Self-contained HTML/CSS/JavaScript, with local images and install icons. No framework, runtime dependencies, API keys, tracking, camera, or microphone.

## Run

From this directory:

```sh
python3 -m http.server 3000 --bind 0.0.0.0
```

Open http://localhost:3000. This is a static production site; no build is needed. The HTML can also be opened directly, except the optional web manifest requires HTTP.

## Offline single-file build

From the repository root, run `npm run build:stillwell` (Node.js, no dependencies or network needed).
This generates `experiences/stillwell/stillwell-standalone.html`, which can be opened with `file://`
or distributed on its own. Images, SVG portrait references, icons, CSS images, and fonts are embedded
as base64 data URIs; the manifest and font preconnect links are removed. Ordinary navigation links
remain links. Sound still requires opt-in; installed browser speech voices may depend on the OS.

`assets/fonts/fonts.css` and its six WOFF2 files are vendored Google Fonts Latin/Latin Extended
subsets for DM Sans (variable weights 400–700) and Instrument Serif (normal/italic).
They were fetched from the [Google Fonts CSS endpoint](https://fonts.googleapis.com/css2?family=DM+Sans:wght@400..700&family=Instrument+Serif:ital@0;1&display=swap)
using a Chrome user agent to request WOFF2. The corresponding SIL Open Font Licenses are included
beside them. The normal source page continues to use Google Fonts; only the standalone build
uses the offline copies. To update fonts, replace the vendored WOFF2 files and local URLs in
`fonts.css`, then rebuild. `node scripts/test-stillwell-standalone.cjs` checks reproducibility,
resource embedding, and empty/error cases after building.

## Experience

- Six scroll-driven chapters progress from a cream-and-sage marketing site to an uncanny house, corrupted transmission, descending corridor, and final presence.
- Sound is off until the visitor clicks the persistent control. Web Audio creates ambient chords, filtered wind, dissonant drones, knocks, and accelerating heartbeats. Optional browser speech synthesis adds brief phrases, where supported. Audio stops in hidden tabs.
- The motion control and the operating system's reduced-motion preference disable animated effects, parallax, and zooming. There are no rapid flashes, forced fullscreen, scroll traps, permission prompts, or autoplay audio.
- Return to calm, the replay button, or Escape in the horror chapters resets the experience. Sound remains in the visitor's chosen on/off state and returns to the opening ambience.
- Marketing claims, press names, testimonials, and resident numbers are fictional story props, not real endorsements or services. Nothing is submitted or collected.

## Assets

- Interior photograph: https://unsplash.com/photos/1600210492486-724fe5c67fb0 (image CDN ID `photo-1600210492486-724fe5c67fb0`).
- Forest photograph: https://unsplash.com/photos/1441974231531-c6227db76b6e (image CDN ID `photo-1441974231531-c6227db76b6e`).
- Fonts: DM Sans and Instrument Serif, via Google Fonts; system fallbacks are provided.
- Finale portrait: [Conrad Veidt as Gwynplaine in The Man Who Laughs (1928)](https://commons.wikimedia.org/wiki/File:The_Man_Who_Laughs_-_Conrad_Veidt_as_Gwynplaine.jpg), public domain, cropped and color-graded for this experience.
- Corridor, figure, and app icon are original SVG/CSS artwork.

No service worker is registered; the authenticated app proxy does not support them.
