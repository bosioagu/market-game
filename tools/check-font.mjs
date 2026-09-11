/**
 * Verifica que todo el texto que el juego dibuja se pueda representar con la
 * tipografía bitmap. Un caracter que falta se dibuja como "?" y pasa inadvertido.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const fuente = readFileSync('src/engine/font.ts', 'utf8');
const bloque = fuente.slice(fuente.indexOf('const G: Record<string, Glyph> = {'), fuente.indexOf('export const GLYPH_W'));
const glifos = new Set();
for (const m of bloque.matchAll(/^\s+(?:'((?:[^'\\]|\\.)*)'|"([^"]*)"|([A-Za-zÁÉÍÓÚÑÜ$_|]))\s*:\s*\[/gm)) {
  glifos.add((m[1] ?? m[2] ?? m[3]).replace(/\\'/g, "'").replace(/\\\\/g, '\\'));
}
const acentos = new Set(['á', 'é', 'í', 'ó', 'ú', 'ñ', 'ü', 'à', 'è', 'ì', 'ò', 'ù']);

function archivos(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? archivos(p) : p.endsWith('.ts') ? [p] : [];
  });
}

const faltan = new Map();
for (const archivo of archivos('src')) {
  if (archivo.endsWith('engine/font.ts')) continue;
  const src = readFileSync(archivo, 'utf8');
  // Sólo los textos que van a drawText / drawButton / drawKeyCap / say().
  for (const m of src.matchAll(/(?:drawText|drawButton|drawKeyCap)\(\s*(?:ctx|c)\s*,\s*([^\n]*)|\.say\(([^\n]*)|(?:name|tagline|description|text):\s*('[^']*'|`[^`]*`)/g)) {
    const trozo = m[1] ?? m[2] ?? m[3] ?? '';
    for (const lit of trozo.matchAll(/'([^']*)'|`([^`]*)`/g)) {
      for (const ch of lit[1] ?? lit[2] ?? '') {
        if (ch === ' ' || ch === '\\' || ch === '$' || ch === '{' || ch === '}') continue;
        const up = ch.toUpperCase();
        if (glifos.has(ch) || glifos.has(up) || acentos.has(ch)) continue;
        if (!faltan.has(ch)) faltan.set(ch, new Set());
        faltan.get(ch).add(archivo);
      }
    }
  }
}

if (faltan.size === 0) {
  console.log('✔ todo el texto entra en la tipografía');
} else {
  for (const [ch, archs] of faltan) {
    console.log(`✘ falta el glifo ${JSON.stringify(ch)} (U+${ch.codePointAt(0).toString(16).toUpperCase()}) en: ${[...archs].join(', ')}`);
  }
  process.exit(1);
}
