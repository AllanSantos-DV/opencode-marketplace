import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const MARKETPLACE = join(ROOT, ".github/plugin/marketplace.json");
const README = join(ROOT, "README.md");
const DOCS = join(ROOT, "docs");

// Read marketplace.json
const marketplace = JSON.parse(readFileSync(MARKETPLACE, "utf-8"));

// Generate index.html
const indexHtml = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${marketplace.name} - Marketplace de Plugins do OpenCode</title>
  <meta name="description" content="${marketplace.metadata.description}">
  <link rel="stylesheet" href="assets/styles.css">
</head>
<body>
  <header>
    <h1>${marketplace.name}</h1>
    <p>${marketplace.metadata.description}</p>
  </header>
  
  <main>
    <h2>Plugins Disponíveis</h2>
    <div class="plugins-grid">
      ${marketplace.plugins
        .map(
          (plugin) => `
      <article class="plugin-card">
        <h3>${plugin.name}</h3>
        <p>${plugin.description}</p>
        <div class="plugin-meta">
          <span class="version">v${plugin.version}</span>
          <span class="category">${plugin.category}</span>
        </div>
        <div class="plugin-links">
          <a href="https://www.npmjs.com/package/@allansantos-dev/opencode-memory" target="_blank"><img src="https://img.shields.io/npm/v/@allansantos-dev/opencode-memory" alt="npm version"></a>
          <a href="${plugin.homepage}" target="_blank">GitHub</a>
        </div>
        <pre><code>opencode.json: ["@allansantos-dev/opencode-memory"]</code></pre>
      </article>`
        )
        .join("")}
    </div>
  </main>
  
  <footer>
    <p>Marketplace de plugins do OpenCode</p>
  </footer>
</body>
</html>`;

// Write index.html
mkdirSync(join(DOCS, "assets"), { recursive: true });
writeFileSync(join(DOCS, "index.html"), indexHtml);

// Generate p/<name>/index.html for each plugin
for (const plugin of marketplace.plugins) {
  const pDir = join(DOCS, "p", plugin.name);
  mkdirSync(pDir, { recursive: true });
  const pHtml = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>${plugin.name} — ${marketplace.name}</title><link rel="stylesheet" href="../../assets/styles.css"></head><body><header><h1>${plugin.name} v${plugin.version}</h1><p>${plugin.description}</p></header><main><pre><code>npm i @allansantos-dev/opencode-memory\n// opencode.json: ["@allansantos-dev/opencode-memory"]</code></pre><p><a href="${plugin.homepage}">GitHub</a> · <a href="https://www.npmjs.com/package/@allansantos-dev/opencode-memory">npm</a></p></main></body></html>`;
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
console.log(`   - Index: ${join(DOCS, "index.html")}`);
console.log(`   - README: ${README}`);