import { build } from 'esbuild';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = new URL('./', import.meta.url);
const [result, template, css] = await Promise.all([
  build({
    absWorkingDir: fileURLToPath(root),
    entryPoints: ['main.js'],
    bundle: true,
    write: false,
    platform: 'browser',
    format: 'iife',
    target: ['es2022'],
    minify: true,
  }),
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('ui/style.css', root), 'utf8'),
]);
const js = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const standalone = template
  .replace('<link rel="stylesheet" href="./ui/style.css">', () => `<style>\n${css}</style>`)
  .replace('<script type="module" src="./main.js"></script>', () => `<script>\n${js}</script>`);
await mkdir(new URL('dist/', root), { recursive: true });
await writeFile(new URL('dist/minecraft-clone.html', root), standalone);
console.log(`Built dist/minecraft-clone.html (${Buffer.byteLength(standalone)} bytes)`);
