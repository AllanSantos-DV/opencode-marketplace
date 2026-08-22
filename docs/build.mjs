import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const MARKETPLACE = join(ROOT, ".github/plugin/marketplace.json");
const README = join(ROOT, "README.md");

// Read marketplace.json
const marketplace = JSON.parse(readFileSync(MARKETPLACE, "utf-8"));

// NOTE: docs/index.html e docs/assets/styles.css são escritos à mão (Laboratory Archive)
// e NÃO são gerados aqui — build.mjs apenas garante o redirect p/<name> e atualiza o README.
// Isso evita que um template genérico sobrescreva o design opinativo.

// Ensure p/<name>/index.html redirect for each plugin (preserve hand-written design)
for (const plugin of marketplace.plugins) {
  const pDir = join(__dirname, "p", plugin.name);
  mkdirSync(pDir, { recursive: true });
  const redirectUrl = "https://allansantos-dv.github.io/opencode-memory/";
  const pHtml = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${plugin.name} — ${marketplace.name}</title><meta http-equiv="refresh" content="0; url=${redirectUrl}"><link rel="canonical" href="${redirectUrl}"><meta name="robots" content="noindex"><link rel="stylesheet" href="../../assets/styles.css"><style>body{display:grid;place-items:center;min-height:100vh;padding:24px} .card{max-width:520px;width:100%;background:var(--surface);border:1px solid var(--line-strong);border-radius:16px;padding:28px;box-shadow:var(--shadow);text-align:center} .card h1{font-family:"Bricolage Grotesque",sans-serif;font-size:22px;margin-bottom:8px} .card p{color:var(--muted);font-size:14px;margin-bottom:16px} .card a{color:var(--graph)}</style></head><body><div class="card"><p style="font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)">opencode-marketplace · plugin</p><h1>${plugin.name} → docs</h1><p>Redirecionando para <a href="${redirectUrl}">${redirectUrl}</a>…</p><a class="btn btn--signal" href="${redirectUrl}">Abrir docs agora →</a><p style="margin-top:14px"><a href="../../">← Voltar à vitrine</a></p></div><script>location.replace("${redirectUrl}");</script></body></html>`;
  writeFileSync(join(pDir, "index.html"), pHtml);
}

// Generate README table
const readme = readFileSync(README, "utf-8");
const table = `<!-- plugins:start -->
| Plugin | Versão | Descrição | Categoria |
|--------|--------|-----------|-----------|
${marketplace.plugins
  .map(
    (plugin) =>
      `| [${plugin.name}](${plugin.homepage}) | ${plugin.version} | ${plugin.description} | ${plugin.category} |`
  )
  .join("\n")}
<!-- plugins:end -->`;

const newReadme = readme.replace(
  /<!-- plugins:start -->[\s\S]*?<!-- plugins:end -->/,
  table
);

writeFileSync(README, newReadme);

console.log("✅ Vitrine gerada com sucesso!");
console.log(`   - ${marketplace.plugins.length} plugin(s)`);
console.log(`   - Index: ${join(__dirname, "index.html")} (hand-written, preservado)`);
console.log(`   - Redirect: p/memory → https://allansantos-dv.github.io/opencode-memory/`);
console.log(`   - README: ${README}`);