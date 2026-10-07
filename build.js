#!/usr/bin/env node
/* Собирает index.html со всеми css/js в один файл без обёртки документа (для Claude Artifacts). Путь вывода — первый аргумент, по умолчанию dist/davay-eblanit.html; --no-kts собирает версию без папки js/kts. */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const args = process.argv.slice(2);
const NO_KTS = args.includes('--no-kts');
const outArg = args.find((a) => !a.startsWith('--'));
const OUT = path.resolve(outArg || path.join(ROOT, 'dist', 'davay-eblanit.html'));

let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

html = html
  .replace(/<!doctype html>\s*/i, '')
  .replace(/<html[^>]*>\s*/i, '')
  .replace(/\s*<\/html>\s*$/i, '\n')
  .replace(/<head>\s*/i, '')
  .replace(/\s*<\/head>\s*/i, '\n')
  .replace(/<body[^>]*>\s*/i, '')
  .replace(/\s*<\/body>\s*/i, '\n')
  .replace(/<meta name="viewport"[^>]*>\s*/i, '');

html = html.replace(/<link rel="stylesheet" href="(css\/[^"]+)">/g, (m, href) => {
  const css = fs.readFileSync(path.join(ROOT, href), 'utf8');
  return `<style>\n${css.replace(/<\/style/gi, '<\\/style')}\n</style>`;
});
if (NO_KTS) html = html.replace(/<script src="js\/kts\/[^"]+"><\/script>\s*/g, '');
html = html.replace(/<script src="(js\/[^"]+)"><\/script>/g, (m, src) => {
  const js = fs.readFileSync(path.join(ROOT, src), 'utf8');
  return `<script>\n${js.replace(/<\/script/gi, '<\\/script')}\n</script>`;
});

const titleAt = html.indexOf('<title>');
if (titleAt < 0 || titleAt > 8000) throw new Error('<title> must be within the first 8KB of the bundle');

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, html);
console.log(`built ${path.relative(process.cwd(), OUT)} — ${(Buffer.byteLength(html) / 1024).toFixed(1)} KB`);
