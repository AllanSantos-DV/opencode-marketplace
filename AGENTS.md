# AGENTS.md — opencode-marketplace

Guia para um agente (ou humano) **publicar, migrar ou criar** um plugin do **OpenCode** neste repositório. Leia isto inteiro antes de mexer.

---

## 1. O que é este repositório

Vitrine (marketplace) de plugins do OpenCode do Allan. Usuários registram uma vez:

```sh
opencode plugin marketplace add AllanSantos-DV/opencode-marketplace
opencode plugin install <plugin>@opencode-marketplace
opencode plugin update --all
```

- Repositório **público**: `AllanSantos-DV/opencode-marketplace`, branch padrão `main`.
- Vitrine (GitHub Pages): <https://allansantos-dv.github.io/opencode-marketplace/>.

## 2. Modelo de publicação — leia com atenção

- **O commit em `main` É a publicação.** Não há GitHub Actions, nem build no servidor, nem
  dependência de releases públicas.
- **Plugins são vendados** (os arquivos de runtime já empacotados) em `plugins/<nome>/`.
  **Nunca edite `plugins/<nome>/` à mão** — esses arquivos vêm do repositório de origem de
  cada plugin. Editar aqui é perder a mudança no próximo sync.
- O `opencode plugin update` detecta atualização **pela `version`** do `plugin.json`. Sem bump
  de versão, ninguém recebe a mudança.
- **Fonte de verdade da vitrine:** `.github/plugin/marketplace.json`. A página e a tabela do
  README saem dele.

## 3. Layout do repositório

```
.
├─ .github/plugin/marketplace.json   # manifesto central (o CLI lê; a vitrine também)
├─ plugins/<nome>/                    # runtime vendado de cada plugin (NÃO editar à mão)
│  ├─ plugin.json                     # metadados + marcadores
│  └─ <runtime: index.ts, *.js, *.py, ...>
├─ docs/                              # vitrine (GitHub Pages, gerada)
│  ├─ build.mjs                       # gerador: manifesto -> index.html + tabela do README
│  ├─ index.html                      # GERADO (não editar à mão)
│  ├─ p/<nome>/index.html             # GERADO: a PÁGINA DEDICADA de cada plugin
│  ├─ content/<nome>.json             # conteúdo rico da página (você escreve)
│  └─ assets/{styles.css,app.js}      # design escrito à mão (edite estes ao afinar visual)
├─ README.md                          # tabela entre <!-- plugins:start/end --> é GERADA
└─ AGENTS.md                          # este guia
```

## 4. Anatomia de um plugin

### 4.1 `plugin.json`

```jsonc
{
  "name": "meu-plugin",
  "version": "0.1.0",
  "description": "Uma frase clara do que faz, na voz do usuário.",
  "author": { "name": "Allan Santos", "url": "https://github.com/AllanSantos-DV" },
  "homepage": "https://github.com/AllanSantos-DV/<origem>",
  "repository": "https://github.com/AllanSantos-DV/<origem>",
  "license": "MIT",
  "keywords": ["ate", "6", "tags", "curtas"],
  "category": "productivity"
}
```

Campos usados pela vitrine: `name, version, description, category, keywords, repository,
homepage`. Mantenha a `description` curta (cabe num card) e em pt-BR.

## 5. A fonte de verdade: `.github/plugin/marketplace.json`

```jsonc
{
  "name": "opencode-marketplace",
  "owner": { "name": "Allan Santos" },
  "metadata": { "description": "...", "version": "1.0.0" },
  "plugins": [
    {
      "name": "meu-plugin",
      "description": "...",
      "version": "0.1.0",
      "source": "./plugins/meu-plugin",
      "author": { "name": "Allan Santos" },
      "homepage": "https://github.com/AllanSantos-DV/origem",
      "repository": "https://github.com/AllanSantos-DV/origem",
      "license": "MIT",
      "keywords": ["..."],
      "category": "productivity"
    }
  ]
}
```

Toda entrada precisa bater com o `plugin.json` vendado (nome, versão, descrição).

## 6. A vitrine (`docs/`)

- Gerada por `node docs/build.mjs` — Node puro, **sem dependências**, sem Actions.
- O gerador lê `marketplace.json`, escreve `docs/index.html` (cards assados, bom p/ SEO/no-JS)
  e **sincroniza a tabela do README** entre `<!-- plugins:start -->` e `<!-- plugins:end -->`.
- Design: `docs/assets/styles.css` e `docs/assets/app.js` são escritos à mão — **edite estes**
  para mexer no visual; `index.html` é sempre regenerado.
- Publicação: GitHub Pages, branch `main`, pasta `/docs`. Ligar uma vez:
  `gh api -X POST repos/AllanSantos-DV/opencode-marketplace/pages -f 'source[branch]=main' -f 'source[path]=/docs'`.

## 7. Fluxos

### 7.1 Publicar/atualizar um plugin existente (sequência — nesta ordem)

1. **Vender:** copie o runtime já empacotado para `plugins/<nome>/` (da origem; não edite à mão).
2. **Versão:** suba `version` em `plugins/<nome>/plugin.json` (semver).
3. **Manifesto:** reflita `name/version/description` em `.github/plugin/marketplace.json`.
4. **Gerar:** `node docs/build.mjs` (atualiza `docs/index.html` + tabela do README).
5. **Commit** em `main` — a publicação. Ex.: `chore(<nome>): sync v<versão>`.

### 7.2 Adicionar um plugin NOVO

1. Crie `plugins/<nome>/` com o runtime + `plugin.json` (seção 4).
2. Acrescente a entrada no array `plugins` de `.github/plugin/marketplace.json`.
3. (Opcional) Adicione o `<nome>` em `const ORDER` de `docs/build.mjs` para posicioná-lo na vitrine.
4. `node docs/build.mjs`.
5. Commit `feat(<nome>): add <nome> v<versão>`.

## 8. Convenções de commit

- **Conventional Commits**, assunto em **uma linha** (`feat:`, `fix:`, `chore:`, `docs:`…),
  com escopo do plugin quando fizer sentido: `chore(memory): sync v0.1.0`.
- Inclua o trailer:
  `Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>`.

## 9. Checklist antes do commit

- [ ] `plugin.json` com `version` bumpada e `description` curta em pt-BR.
- [ ] Entrada correspondente em `.github/plugin/marketplace.json` (mesma versão/descrição).
- [ ] `node docs/build.mjs` rodado (index.html + tabela do README atualizados).
- [ ] Nada editado à mão em `plugins/<nome>/` que devesse vir da origem.
- [ ] Commit em Conventional Commits, uma linha, com o trailer.