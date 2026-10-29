// opencode-marketplace — vitrine de plugins do OpenCode. Modo Apresentar (cenas com narração e diagrama revelado aos poucos)
// e leitura do vídeo. Sem dependências nem rede. A voz é a do Vox Engine (voz padrão do motor), gravada em
// media/narracao/cNN-pN.mp3 por scripts/narracao.mjs: uma fala por arquivo, e a cena avança pela duração real do áudio. Sem o
// áudio, só as legendas e as setas conduzem, com aviso; o site nunca usa a voz do navegador.
(() => {
  "use strict";

  // ---- cenas: cada "parte" é uma frase narrada e revela um passo do visual -------------------------------------------
  const FICHAS = [
    ["Lembra sozinho", "as lembranças certas entram no contexto a cada mensagem", "#1d4ed8"],
    ["Entende o código", "o grafo do projeto mostra quem chama quem", "#1d4ed8"],
    ["Guarda as lições", "um agente à parte guarda o que foi aprendido", "#be185d"],
  ];
  const CENAS = [
    { t: "opencode-marketplace", vis: "hero", partes: [
      "Este é o opencode-marketplace: a vitrine de plugins para o OpenCode. Você registra uma vez e instala cada plugin com um comando.",
    ] },
    { t: "Para quem", vis: "hero", partes: [
      "É para quem usa o OpenCode e quer plugins prontos, sem copiar arquivos nem compilar nada.",
    ] },
    { t: "Como funciona", vis: "mapa", partes: [
      "Você registra a vitrine no seu OpenCode, uma vez só.",
      "Cada plugin fica na vitrine já empacotado, pronto para usar.",
      "Você instala o plugin pelo nome.",
      "Quando sai versão nova, um comando atualiza todos.",
    ] },
    { t: "O primeiro plugin: memory", vis: "fichas", partes: [
      "O primeiro plugin é o memory: o seu agente lembra do que já aprendeu, de uma sessão para outra.",
      "Ele acha o código certo pelo grafo do projeto, sabendo quem chama quem.",
      "E guarda as lições sozinho, sem travar o agente.",
    ] },
    { t: "Como usar", vis: "comandos", partes: [
      "Para começar, registre a vitrine com um comando.",
      "Depois, instale o memory pelo nome e atualize tudo quando quiser. opencode-marketplace: plugins do OpenCode com um comando.",
    ] },
  ];

  const $ = (sel, raiz = document) => raiz.querySelector(sel);
  const el = (tag, cls, texto) => { const e = document.createElement(tag); if (cls) { e.className = cls; } if (texto) { e.textContent = texto; } return e; };

  // ---- vídeo: sem o arquivo, mostra o aviso em vez de um player quebrado ---------------------------------------------
  const video = $("#apresentacao");
  if (video) {
    const falhou = () => { video.hidden = true; $("#video-vazio").hidden = false; };
    $("source", video)?.addEventListener("error", falhou);
    video.addEventListener("error", falhou);
    // o erro da <source> pode disparar antes deste script rodar: confere o estado também depois do carregamento
    window.addEventListener("load", () => { if (video.networkState === HTMLMediaElement.NETWORK_NO_SOURCE) { falhou(); } });
    // "Assistir ao vídeo": só por clique (com som, que o clique libera); nada toca sozinho ao abrir a página
    document.querySelectorAll("[data-assistir]").forEach((b) => b.addEventListener("click", () => {
      if (video.hidden) { $("#video-vazio").scrollIntoView({ block: "center" }); return; }
      video.scrollIntoView({ block: "center" }); video.focus({ preventScroll: true });
      video.play().catch((e) => { if (e?.name === "NotSupportedError") { falhou(); } });   // sem fonte tocável: mostra o aviso
    }));
  }

  // ---- modo Apresentar -------------------------------------------------------------------------------------------------
  const abrir = document.querySelectorAll("[data-apresentar]");
  if (!abrir.length) { return; }
  const AVISO = "Narração pela voz do Vox Engine. Setas ← → navegam; Espaço pausa; Esc sai.";
  const AVISO_SEM_AUDIO = "Narração em áudio indisponível: acompanhe pelas legendas e use as setas ← →. Esc sai.";
  const VELOCIDADES = [0.85, 1, 1.15, 1.3];
  const rotuloVel = (v) => `Velocidade: ${String(v).replace(".", ",")}×`;
  const srcAudio = (i, j) => `media/narracao/c${String(i + 1).padStart(2, "0")}-p${j + 1}.mp3`;
  let ap = null;   // estado da apresentação aberta

  function montarVisual(cena, destino) {
    destino.replaceChildren();
    if (cena.vis === "hero") {
      const svg = $(".hero-art svg").cloneNode(true);
      destino.append(svg);
    } else if (cena.vis === "fichas") {
      const caixa = el("div", "fichas");
      FICHAS.forEach(([nome, desc, cor]) => {
        const f = el("div", "ficha"); f.style.setProperty("--cor", cor);
        f.append(el("b", "", nome), el("span", "", desc));
        caixa.append(f);
      });
      destino.append(caixa);
    } else if (cena.vis === "comandos") {
      const caixa = el("div", "comandos");
      [["1", "opencode plugin marketplace add AllanSantos-DV/opencode-marketplace"], ["2", "opencode plugin install memory@opencode-marketplace"], ["2", "opencode plugin update --all"]]
        .forEach(([passo, cmd]) => { const p = el("pre", "", cmd); p.dataset.s = passo; caixa.append(p); });
      destino.append(caixa);
    } else {
      const svg = $("#mapa").cloneNode(true);
      svg.removeAttribute("id"); svg.classList.add("prog");
      destino.append(svg);
    }
  }

  function mostrar(i, j) {
    const cena = CENAS[i];
    ap.i = i; ap.j = j;
    if (ap.cenaMontada !== i) { montarVisual(cena, ap.visual); ap.cenaMontada = i; }
    ap.titulo.textContent = cena.t;
    ap.texto.replaceChildren(...cena.partes.slice(j, j + 1).map((p) => el("p", "", p)));
    const passo = cena.n ?? j + 1;
    if (cena.vis === "fichas") { ap.visual.querySelectorAll(".ficha").forEach((f, k) => f.classList.toggle("on", k < passo)); }
    if (cena.vis !== "fichas") { ap.visual.querySelectorAll("[data-s]").forEach((g) => g.classList.toggle("on", Number(g.dataset.s) <= passo)); }
    const total = CENAS.reduce((s, c) => s + c.partes.length, 0);
    const feitas = CENAS.slice(0, i).reduce((s, c) => s + c.partes.length, 0) + j + 1;
    ap.barra.style.width = `${(feitas / total) * 100}%`;
    ap.pos.textContent = `${i + 1} / ${CENAS.length}`;
    ap.indice.value = String(i);
  }

  function parar() { ap.ficha += 1; clearTimeout(ap.timer); ap.audio.pause(); }

  // sem áudio (arquivo ausente, som desligado ou reprodução negada): as legendas seguem pelo tempo de leitura
  function porLegenda(seguir, texto) { ap.timer = setTimeout(seguir, Math.max(3500, texto.length * 65) / ap.vel); }

  function falar(retomar = false) {
    const cena = CENAS[ap.i], texto = cena.partes[ap.j], ficha = ap.ficha + (retomar ? 0 : 1);
    ap.ficha = ficha;
    clearTimeout(ap.timer);
    const seguir = () => { if (ap && ap.ficha === ficha && ap.tocando) { ap.timer = setTimeout(() => ap && ap.ficha === ficha && avancar(true), 400 / ap.vel); } };
    if (!ap.som || ap.semAudio) { ap.audio.pause(); porLegenda(seguir, texto); return; }
    const a = ap.audio, src = srcAudio(ap.i, ap.j);
    if (!(retomar && a.getAttribute("src") === src && !a.ended)) { a.src = src; }
    a.playbackRate = ap.vel;
    a.onended = seguir;
    a.onerror = () => { if (ap && ap.ficha === ficha) { ap.semAudio = true; ap.aviso.textContent = AVISO_SEM_AUDIO; ap.aviso.classList.add("falha"); porLegenda(seguir, texto); } };
    a.play().catch((e) => {
      if (!ap || ap.ficha !== ficha || e?.name === "AbortError") { return; }
      ap.semAudio = true; ap.aviso.textContent = AVISO_SEM_AUDIO; ap.aviso.classList.add("falha"); porLegenda(seguir, texto);
    });
  }

  function avancar(auto) {
    let { i, j } = ap;
    if (j + 1 < CENAS[i].partes.length) { j += 1; } else if (i + 1 < CENAS.length) { i += 1; j = 0; } else {
      parar(); ap.tocando = false; ap.botPausa.textContent = "Recomeçar"; return;
    }
    mostrar(i, j);
    if (ap.tocando || auto) { falar(); } else { parar(); }
  }

  function voltar() {
    let { i, j } = ap;
    if (j > 0) { j -= 1; } else if (i > 0) { i -= 1; j = CENAS[i].partes.length - 1; }
    mostrar(i, j);
    if (ap.botPausa.textContent === "Recomeçar") { ap.botPausa.textContent = "Continuar"; }
    if (ap.tocando) { falar(); } else { parar(); }
  }

  function alternar() {
    if (ap.botPausa.textContent === "Recomeçar") { ap.tocando = true; ap.botPausa.textContent = "Pausar"; mostrar(0, 0); falar(); return; }
    ap.tocando = !ap.tocando;
    ap.botPausa.textContent = ap.tocando ? "Pausar" : "Continuar";
    if (ap.tocando) { falar(true); } else { parar(); }
  }

  function irPara(i) { ap.botPausa.textContent = ap.tocando ? "Pausar" : "Continuar"; mostrar(i, 0); if (ap.tocando) { falar(); } else { parar(); } }

  function fechar() {
    parar(); ap.audio.removeAttribute("src"); ap.audio.load();
    ap.raiz.remove();
    ap.inertes.forEach((e) => { e.inert = false; });
    document.removeEventListener("keydown", teclas, true);
    const voltarPara = ap.origem; ap = null;
    voltarPara?.focus();
  }

  function teclas(e) {
    if (!ap) { return; }
    if (e.key === "Escape") { e.preventDefault(); fechar(); }
    else if (e.key === "ArrowRight") { e.preventDefault(); avancar(false); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); voltar(); }
    else if (e.key === " " && !(e.target instanceof HTMLButtonElement || e.target instanceof HTMLSelectElement)) { e.preventDefault(); alternar(); }
  }

  function abrirApresentacao(origem) {
    if (ap) { return; }
    video?.pause();   // uma voz por vez: o vídeo não segue falando por baixo da narração
    const raiz = el("div", "apres"); raiz.setAttribute("role", "dialog"); raiz.setAttribute("aria-modal", "true"); raiz.setAttribute("aria-label", "Apresentação do opencode-marketplace"); raiz.tabIndex = -1;
    const topo = el("div", "apres-topo"), pos = el("span", "pos");
    topo.append(el("strong", "", "opencode-marketplace · apresentação"), pos);
    const corpo = el("div", "apres-corpo"), blocoTexto = el("div", "apres-texto"), titulo = el("h2"), texto = el("div"), visual = el("div", "apres-visual");
    texto.setAttribute("aria-live", "polite");
    blocoTexto.append(titulo, texto); corpo.append(blocoTexto, visual);
    const barra = el("div", "apres-barra"), barraI = el("i"); barra.append(barraI);
    const ctl = el("div", "apres-ctl");
    const bt = (rotulo, fn, cls = "btn peq") => { const b = el("button", cls, rotulo); b.type = "button"; b.addEventListener("click", fn); return b; };
    const botPausa = bt("Pausar", alternar, "btn pri peq"), botSom = bt("Som: ligado", () => {
      ap.som = !ap.som; botSom.textContent = ap.som ? "Som: ligado" : "Som: desligado";
      if (ap.tocando) { falar(); } else { parar(); }
    });
    let v = 1;
    const botVel = bt(rotuloVel(1), () => {
      v = VELOCIDADES[(VELOCIDADES.indexOf(v) + 1) % VELOCIDADES.length]; ap.vel = v; ap.audio.playbackRate = v; botVel.textContent = rotuloVel(v);
    });
    const indice = el("select", "apres-indice"); indice.setAttribute("aria-label", "Tópicos da apresentação");
    CENAS.forEach((c, k) => { const o = el("option", "", `${k + 1}. ${c.t}`); o.value = String(k); indice.append(o); });
    indice.addEventListener("change", () => { irPara(Number(indice.value)); raiz.focus(); });
    const aviso = el("span", "aviso", AVISO);
    ctl.append(bt("Anterior", voltar), botPausa, bt("Próxima", () => avancar(false)), indice, botSom, botVel, bt("Sair", fechar), aviso);
    raiz.append(topo, corpo, barra, ctl);
    document.body.append(raiz);
    const inertes = [...document.body.children].filter((e) => e !== raiz && !e.inert);   // o link de pular é filho do body: também fica inerte
    inertes.forEach((e) => { e.inert = true; });
    ap = { inertes, raiz, titulo, texto, visual, barra: barraI, pos, botPausa, aviso, indice, audio: new Audio(), vel: 1, i: 0, j: 0, cenaMontada: -1, tocando: true, som: true, semAudio: false, ficha: 0, timer: 0, origem };
    document.addEventListener("keydown", teclas, true);
    mostrar(0, 0);
    raiz.focus();
    falar();
  }

  abrir.forEach((b) => b.addEventListener("click", () => abrirApresentacao(b)));
})();
