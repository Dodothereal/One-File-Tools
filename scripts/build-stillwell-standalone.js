#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const sourceDir = path.resolve(__dirname, '../experiences/stillwell');
const outputPath = path.join(sourceDir, 'stillwell-standalone.html');
const mimeTypes = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };

function inlineAsset(url, directory) {
  if (!url || /^(data:|#)/i.test(url)) return url;
  if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(url)) throw new Error(`External resource: ${url}`);
  const filename = path.resolve(directory, decodeURIComponent(url));
  const mime = mimeTypes[path.extname(filename).toLowerCase()];
  if (!mime) throw new Error(`Unsupported asset: ${url}`);
  return `data:${mime};base64,${fs.readFileSync(filename).toString('base64')}`;
}

function inlineCss(css, directory) {
  return css.replace(/url\(\s*(['"]?)(.*?)\1\s*\)/gi, (match, quote, url) => {
    if (/^data:image\/svg\+xml,/i.test(url)) return `url("data:image/svg+xml;base64,${Buffer.from(decodeURIComponent(url.slice(url.indexOf(',') + 1))).toString('base64')}")`;
    if (/^(data:|#)/i.test(url)) return match;
    return `url("${inlineAsset(url, directory)}")`;
  });
}

function buildHtml(html, directory = sourceDir) {
  let fontsInserted = false;
  html = html.replace(/<link\b[^>]*>/gi, tag => {
    const rel = tag.match(/\brel=["']([^"']+)["']/i)?.[1];
    if (rel === 'preconnect' || rel === 'manifest') return '';
    if (rel === 'stylesheet') {
      if (!/https:\/\/fonts\.googleapis\.com\//.test(tag)) throw new Error(`Unsupported stylesheet: ${tag}`);
      if (fontsInserted) throw new Error('Duplicate font stylesheet');
      fontsInserted = true;
      const fontDir = path.join(directory, 'assets/fonts');
      return `<style>${inlineCss(fs.readFileSync(path.join(fontDir, 'fonts.css'), 'utf8'), fontDir)}</style>`;
    }
    return tag.replace(/\bhref=(["'])(.*?)\1/gi, (_, quote, url) => `href=${quote}${inlineAsset(url, directory)}${quote}`);
  });
  html = html.replace(/<(img|image)\b[^>]*>/gi, tag => tag.replace(/\b(src|href|xlink:href)=(["'])(.*?)\2/gi,
    (_, attr, quote, url) => `${attr}=${quote}${inlineAsset(url, directory)}${quote}`));
  html = html.replace(/\bstyle=(["'])(.*?)\1/gi, (_, quote, css) => `style=${quote}${inlineCss(css, directory).replaceAll(quote, quote === '"' ? '&quot;' : '&#39;')}${quote}`);
  return html.replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gi,
    (_, css) => `<style>${inlineCss(css, directory)}</style>`);
}

if (require.main === module) {
  const html = buildHtml(fs.readFileSync(path.join(sourceDir, 'index.html'), 'utf8'));
  fs.writeFileSync(outputPath, html);
  console.log(`Built ${path.relative(process.cwd(), outputPath)} (${Buffer.byteLength(html)} bytes; offline assets)`);
}

module.exports = { buildHtml, inlineAsset, inlineCss };
