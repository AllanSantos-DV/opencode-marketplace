// Narration of the site's Apresentar mode: one Vox Engine audio file per spoken line of the scenes in docs/assets/site.js,
// written to docs/media/narracao/cNN-pN.mp3, plus the voice manifest narracao.voz.json. The voice is the engine's default
// (never chosen here); the browser's speech synthesis is never a substitute.
//   node scripts/narracao.mjs        (the Vox daemon must be up; ffmpeg and ffprobe on PATH)
// The SDK comes from ../../vox-engine/sdk/node/vox-sdk.mjs or VOX_SDK=<path>. No engine, no default voice or a different voice:
// nothing is written.
import { readFileSync, writeFileSync, mkdirSync, rmSync, mkdtempSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { scenes } from './site-scenes.mjs';

const ROOT = join(import.meta.dirname, '..');
const OUT = join(ROOT, 'docs', 'media', 'narracao');
const sdkPath = resolve(process.env.VOX_SDK || join(ROOT, '..', '..', 'vox-engine', 'sdk', 'node', 'vox-sdk.mjs'));
const { VoxClient } = await import(pathToFileURL(sdkPath).href);

// Product names read by the Piper voice in Portuguese spelling; the page and the script keep the written form.
const SPOKEN = [[/opencode-marketplace/g, 'ôupen côud márket pleice'], [/OpenCode/g, 'ôupen côud'], [/\bmemory\b/g, 'mêmori']];
const spoken = (text) => SPOKEN.reduce((t, [re, say]) => t.replace(re, say), text);

const duration = (f) => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], { encoding: 'utf8', windowsHide: true }));

const client = await VoxClient.tryConnect();
if (!client) throw new Error('the Vox Engine daemon is not running: start it and run again (nothing was written)');
const info = await client.info();
const voice = info.default_voice;
if (!voice) throw new Error('the engine reported no default voice');
if (!(info.encode_formats || []).includes('mp3')) throw new Error(`the engine does not encode mp3 (only ${(info.encode_formats || []).join(',')})`);

const tmp = mkdtempSync(join(tmpdir(), 'opencode-marketplace-narration-'));
const files = [];
let total = 0;
try {
  for (const [i, scene] of scenes().entries()) {
    for (const [j, text] of scene.partes.entries()) {
      const id = `c${String(i + 1).padStart(2, '0')}-p${j + 1}`;
      const { header, audio } = await client.tts(spoken(text), { voice, speed: 1, format: 'mp3' });
      if (header?.event === 'error' || header?.error) throw new Error(`engine failed on ${id}: ${header.error || header.event}`);
      if (header?.voice && header.voice !== voice) throw new Error(`wrong voice on ${id}: default "${voice}", engine used "${header.voice}"`);
      const buf = Buffer.from(audio);
      if (!buf.length) throw new Error(`empty audio on ${id}`);
      const raw = join(tmp, `${id}.raw.mp3`), out = join(tmp, `${id}.mp3`);
      writeFileSync(raw, buf);
      // mono at 32 kbps: speech stays intelligible and every browser plays it
      execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', raw, '-ac', '1', '-c:a', 'libmp3lame', '-b:a', '32k', out], { windowsHide: true });
      const seconds = duration(out);
      total += seconds;
      files.push(`${id}.mp3`);
      console.log(`OK ${id}.mp3  ${seconds.toFixed(2)} s`);
    }
  }
} finally {
  client.close();
}
// The folder is replaced only after every line was generated: a failure halfway keeps the previous narration whole.
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
for (const f of files) writeFileSync(join(OUT, f), readFileSync(join(tmp, f)));
rmSync(tmp, { recursive: true, force: true });
writeFileSync(join(OUT, 'narracao.voz.json'), JSON.stringify({
  origem: 'vox-engine', voz: voice, motor: info.version, padraoDoMotor: info.default_voice, pedidaPeloDono: false,
  formato: 'mp3 32 kbps mono', falas: files.length, audioSeg: Number(total.toFixed(2)), geradoEm: new Date().toISOString(),
}, null, 2) + '\n');
console.log(`\n${files.length} lines, ${total.toFixed(1)} s, voice ${voice}, engine ${info.version}; ${readdirSync(OUT).length} files in ${OUT}`);
