// The Apresentar scenes live in docs/assets/site.js (the page has no build step); the narration script and the site tests
// read them from there so the narrated text, the audio files and the script document cannot drift apart.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const SITE = join(import.meta.dirname, '..', 'docs');

export function scenes() {
  const js = readFileSync(join(SITE, 'assets', 'site.js'), 'utf8');
  const start = js.indexOf('const CENAS'), end = js.indexOf('const $ =');
  if (start < 0 || end < start) throw new Error('docs/assets/site.js: CENAS block not found before "const $ ="');
  return new Function(`${js.slice(start, end)}; return CENAS;`)();
}

export const audioFile = (i, j) => `media/narracao/c${String(i + 1).padStart(2, '0')}-p${j + 1}.mp3`;
