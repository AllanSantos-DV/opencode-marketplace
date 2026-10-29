# opencode-marketplace

Marketplace de plugins do OpenCode — vitrine pública de plugins para o agente de código.

## Como usar

```sh
# Registrar o marketplace
opencode plugin marketplace add AllanSantos-DV/opencode-marketplace

# Instalar um plugin
opencode plugin install <plugin>@opencode-marketplace

# Atualizar todos os plugins
opencode plugin update --all
```

## Plugins Disponíveis

<!-- plugins:start -->
| Plugin | Versão | Descrição | Categoria |
|--------|--------|-----------|-----------|
| [memory](https://github.com/AllanSantos-DV/opencode-memory) | 0.4.1 | Memória persistente entre sessões para o OpenCode - recall semântico, grafo de código, dashboard visual e curadoria automática | productivity |
<!-- plugins:end -->

## Como publicar um plugin

1. Crie um repositório privado para seu plugin
2. Adicione a entrada em `.github/plugin/marketplace.json`
3. Execute `node docs/build.mjs` para gerar a vitrine
4. Faça commit em `main`

Consulte o [AGENTS.md](AGENTS.md) para detalhes completos.

## Links

- [GitHub](https://github.com/AllanSantos-DV/opencode-marketplace)
- [Vitrine](https://allansantos-dv.github.io/opencode-marketplace/)
- [OpenCode](https://opencode.ai)