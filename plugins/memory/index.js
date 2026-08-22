var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/contracts.ts
function truncate(s, n) {
  if (s.length <= n) return s;
  return s.slice(0, n - 3) + "...";
}
function sleep(ms, signal) {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve();
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      resolve();
    }, { once: true });
  });
}
function safeJsonParse(text, fallback) {
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}
var init_contracts = __esm({
  "src/contracts.ts"() {
    "use strict";
  }
});

// src/config.ts
var config_exports = {};
__export(config_exports, {
  CONFIG_DIR: () => CONFIG_DIR,
  ENV_KEY: () => ENV_KEY,
  clearDaemonUrl: () => clearDaemonUrl,
  configuredDaemonUrl: () => configuredDaemonUrl,
  readConfig: () => readConfig,
  saveDaemonUrl: () => saveDaemonUrl,
  validateDaemonUrl: () => validateDaemonUrl
});
import { readFileSync as readFileSync3, writeFileSync, existsSync as existsSync3, mkdirSync, renameSync } from "node:fs";
import { join as join3 } from "node:path";
import { homedir as homedir2 } from "node:os";
function validateDaemonUrl(input) {
  if (!input || input.trim().length === 0) {
    return { ok: false, error: "URL must not be empty" };
  }
  let url;
  try {
    url = new URL(input);
  } catch {
    return { ok: false, error: "Invalid URL format" };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, error: "Protocol must be http: or https:" };
  }
  if (!url.hostname) {
    return { ok: false, error: "Hostname is required" };
  }
  const path = url.pathname;
  if (path !== "/" && path !== "") {
    return { ok: false, error: "Path must be root (/) or absent" };
  }
  const normalized = `${url.protocol}//${url.hostname}${url.port ? ":" + url.port : ""}`;
  return { ok: true, url: normalized };
}
function readConfig(dir) {
  const configPath = join3(dir ?? CONFIG_DIR, "config.json");
  try {
    if (!existsSync3(configPath)) return {};
    const raw = readFileSync3(configPath, "utf-8");
    return safeJsonParse(raw, {});
  } catch {
    return {};
  }
}
function configuredDaemonUrl(env, readCfg) {
  const envUrl = env?.[ENV_KEY];
  if (envUrl) return envUrl;
  if (readCfg) {
    const cfg = readCfg();
    if (cfg.daemonUrl) return cfg.daemonUrl;
  }
  return null;
}
function saveDaemonUrl(url, dir) {
  const v = validateDaemonUrl(url);
  if (!v.ok) return { ok: false, error: v.error };
  try {
    const configDir = dir ?? CONFIG_DIR;
    mkdirSync(configDir, { recursive: true });
    const configPath = join3(configDir, "config.json");
    const tmpPath = configPath + ".tmp";
    const existing = readConfig(configDir);
    const updated = { ...existing, daemonUrl: v.url };
    writeFileSync(tmpPath, JSON.stringify(updated, null, 2));
    renameSync(tmpPath, configPath);
    return { ok: true, url: v.url };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}
function clearDaemonUrl(dir) {
  try {
    const configDir = dir ?? CONFIG_DIR;
    const configPath = join3(configDir, "config.json");
    if (!existsSync3(configPath)) return { ok: true };
    const existing = readConfig(configDir);
    const { daemonUrl: _, ...rest } = existing;
    const tmpPath = configPath + ".tmp";
    writeFileSync(tmpPath, JSON.stringify(rest, null, 2));
    renameSync(tmpPath, configPath);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}
var CONFIG_DIR, ENV_KEY;
var init_config = __esm({
  "src/config.ts"() {
    "use strict";
    init_contracts();
    CONFIG_DIR = join3(homedir2(), ".opencode-memory");
    ENV_KEY = "OPENCODE_MEMORY_DAEMON_URL";
  }
});

// src/index.ts
import { tool } from "@opencode-ai/plugin/tool";

// src/daemon.ts
init_contracts();
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
function resolveRunDir() {
  const override = process.env.MCP_RUN_DIR;
  if (override) return join(override, "run");
  return join(homedir(), ".mcp-memory", "run");
}
function readRegistry(runDir) {
  const dir = runDir ?? resolveRunDir();
  const filePath = join(dir, "daemon.json");
  try {
    if (!existsSync(filePath)) return null;
    const raw = readFileSync(filePath, "utf-8");
    const parsed = safeJsonParse(raw, null);
    if (!parsed || typeof parsed.url !== "string") return null;
    const source = parsed.source === "registry" ? "registry" : "configured";
    return {
      url: parsed.url,
      source,
      features: parsed.features ?? null
    };
  } catch {
    return null;
  }
}
async function healthDetail(url, timeoutMs) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs ?? 3e3);
  try {
    const res = await fetch(`${url}/health`, { signal: ac.signal });
    if (!res.ok) return { alive: false, features: null };
    const data = await res.json();
    return {
      alive: true,
      features: data.features ?? null
    };
  } catch {
    return { alive: false, features: null };
  } finally {
    clearTimeout(timer);
  }
}
async function health(url, timeoutMs) {
  const h = await healthDetail(url, timeoutMs);
  return h.alive;
}
async function resolveDaemon(opts) {
  const env = opts?._env ?? process.env;
  const configuredUrl = env.OPENCODE_MEMORY_DAEMON_URL ?? opts?._readConfig?.()?.daemonUrl ?? null;
  const healthFn = opts?._health ?? health;
  if (configuredUrl) {
    const h = await healthFn(configuredUrl, 3e3);
    const alive = typeof h === "boolean" ? h : h.alive;
    const features = typeof h === "boolean" ? null : h.features;
    if (alive) {
      return { info: { url: configuredUrl, source: "configured", features }, source: "configured", configuredUrl };
    }
    return { info: null, source: "configured-unreachable", configuredUrl };
  }
  const readReg = opts?._readRegistry ?? readRegistry;
  const reg = readReg();
  if (reg) {
    const h = await healthFn(reg.url, 3e3);
    const alive = typeof h === "boolean" ? h : h.alive;
    const features = typeof h === "boolean" ? null : h.features;
    if (alive) {
      return { info: { ...reg, features }, source: "registry", configuredUrl: null };
    }
    return { info: null, source: "registry-dead", configuredUrl: null };
  }
  return { info: null, source: "none", configuredUrl: null };
}
async function discover() {
  const result = await resolveDaemon();
  return result.info;
}

// src/errors.ts
var GraphError = class extends Error {
  status;
  code;
  mappedRoot;
  requestedRoot;
  expected;
  actual;
  retryAfter;
  hint;
  state;
  constructor(msg, opts = {}) {
    super(msg);
    this.name = "GraphError";
    this.status = opts.status ?? 500;
    this.code = opts.code ?? null;
    this.mappedRoot = opts.mappedRoot;
    this.requestedRoot = opts.requestedRoot;
    this.expected = opts.expected;
    this.actual = opts.actual;
    this.retryAfter = opts.retryAfter;
    this.hint = opts.hint;
    this.state = opts.state;
  }
};
var MemoryHttpError = class extends Error {
  status;
  body;
  constructor(status, body) {
    super(`HTTP ${status}${body ? `: ${body.slice(0, 200)}` : ""}`);
    this.name = "MemoryHttpError";
    this.status = status;
    this.body = body;
  }
};

// src/client.ts
var MemoryClient = class {
  #baseUrl;
  constructor(baseUrl) {
    this.#baseUrl = baseUrl.replace(/\/+$/, "");
  }
  async #req(method, path, body, timeoutMs, signal) {
    const url = `${this.#baseUrl}${path}`;
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs ?? 15e3);
    const onExternalAbort = () => ac.abort();
    if (signal) {
      if (signal.aborted) ac.abort();
      else signal.addEventListener("abort", onExternalAbort, { once: true });
    }
    try {
      const headers = { "Content-Type": "application/json" };
      const init = { method, headers, signal: ac.signal };
      if (body !== void 0) init.body = JSON.stringify(body);
      const res = await fetch(url, init);
      if (!res.ok) {
        let text = "";
        try {
          text = await res.text();
        } catch {
        }
        throw new MemoryHttpError(res.status, text);
      }
      if (res.status === 204) return void 0;
      return await res.json();
    } finally {
      clearTimeout(timer);
      if (signal) signal.removeEventListener("abort", onExternalAbort);
    }
  }
  async search(query, opts) {
    const body = { query };
    if (opts?.topK !== void 0) body.topK = opts.topK;
    if (opts?.metadata) body.metadata = opts.metadata;
    if (opts?.dateRange) body.dateRange = opts.dateRange;
    const resp = await this.#req("POST", "/api/v1/search", body, opts?.timeoutMs, opts?.signal);
    if (opts?.minScore !== void 0) {
      resp.results = resp.results.filter((r) => r.score >= opts.minScore);
      resp.count = resp.results.length;
    }
    return resp;
  }
  async context(query, opts) {
    const body = { query };
    if (opts?.format) body.format = opts.format;
    if (opts?.maxTokens !== void 0) body.maxTokens = opts.maxTokens;
    if (opts?.topK !== void 0) body.topK = opts.topK;
    if (opts?.metadata) body.metadata = opts.metadata;
    return await this.#req("POST", "/api/v1/context", body, opts?.timeoutMs, opts?.signal);
  }
  async compose(query, opts) {
    const body = { query };
    if (opts?.projectId) body.project_id = opts.projectId;
    if (opts?.setup !== void 0) body.setup = opts.setup;
    if (opts?.includeLifecycleState !== void 0) body.includeLifecycleState = opts.includeLifecycleState;
    if (opts?.metadata) body.metadata = opts.metadata;
    return await this.#req("POST", "/api/v1/compose", body, opts?.timeoutMs, opts?.signal);
  }
  async list(opts) {
    const params = new URLSearchParams();
    if (opts?.limit !== void 0) params.set("limit", String(opts.limit));
    if (opts?.metadata) {
      for (const [k, v] of Object.entries(opts.metadata)) {
        params.set(`metadata.${k}`, v);
      }
    }
    const qs = params.toString();
    const path = `/api/v1/documents${qs ? "?" + qs : ""}`;
    return await this.#req("GET", path);
  }
  async getDocument(id) {
    return await this.#req("GET", `/api/v1/documents/${encodeURIComponent(id)}`);
  }
  async save(content, metadata, opts) {
    const body = { content };
    if (metadata) body.metadata = metadata;
    if (opts?.documentId) body.documentId = opts.documentId;
    return await this.#req("POST", "/api/v1/documents", body, opts?.timeoutMs);
  }
  async updateDocument(id, content, metadata) {
    const body = { content };
    if (metadata) body.metadata = metadata;
    return await this.#req("PUT", `/api/v1/documents/${encodeURIComponent(id)}`, body);
  }
  async patchMetadata(id, metadata, remove) {
    const body = {};
    if (metadata) body.metadata = metadata;
    if (remove) body.remove = remove;
    await this.#req("PATCH", `/api/v1/documents/${encodeURIComponent(id)}`, body);
  }
  async deleteDocument(id) {
    await this.#req("DELETE", `/api/v1/documents/${encodeURIComponent(id)}`);
  }
  async feedback(id, verdict, opts) {
    const body = { verdict };
    if (opts?.reason) body.reason = opts.reason;
    if (opts?.replacementDocId) body.replacementDocId = opts.replacementDocId;
    return await this.#req("POST", `/api/v1/documents/${encodeURIComponent(id)}/feedback`, body);
  }
  async health() {
    return await this.#req("GET", "/health");
  }
};

// src/recall.ts
init_contracts();

// src/graph.ts
init_contracts();
var GraphClient = class {
  #baseUrl;
  #timeoutMs;
  #inflight = /* @__PURE__ */ new Map();
  // expose for gate check (member access) — also used internally
  get inflight() {
    return this.#inflight;
  }
  constructor(opts) {
    this.#baseUrl = opts.baseUrl.replace(/\/+$/, "");
    this.#timeoutMs = opts.timeoutMs ?? 15e3;
  }
  async #req(method, path, body, signal) {
    const url = `${this.#baseUrl}${path}`;
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), this.#timeoutMs);
    const onExternalAbort = () => ac.abort(signal?.reason ?? void 0);
    if (signal) {
      if (signal.aborted) ac.abort(signal?.reason ?? void 0);
      else signal.addEventListener("abort", onExternalAbort, { once: true });
    }
    try {
      const headers = { "Content-Type": "application/json" };
      const init = { method, headers, signal: ac.signal };
      if (body !== void 0) init.body = JSON.stringify(body);
      const res = await fetch(url, init);
      if (!res.ok) {
        let text = "";
        try {
          text = await res.text();
        } catch {
        }
        let parsed = null;
        try {
          parsed = JSON.parse(text);
        } catch {
        }
        throw new GraphError(`HTTP ${res.status}`, {
          status: res.status,
          code: typeof parsed?.code === "string" ? parsed.code : null,
          hint: typeof parsed?.hint === "string" ? parsed.hint : void 0,
          state: typeof parsed?.state === "string" ? parsed.state : void 0,
          retryAfter: res.headers.get("Retry-After") ?? void 0,
          mappedRoot: typeof parsed?.mappedRoot === "string" ? parsed.mappedRoot : void 0,
          requestedRoot: typeof parsed?.requestedRoot === "string" ? parsed.requestedRoot : void 0
        });
      }
      if (res.status === 204) return void 0;
      return await res.json();
    } finally {
      clearTimeout(timer);
      if (signal) signal.removeEventListener("abort", onExternalAbort);
    }
  }
  async #reqGraph(path, params, signal) {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return this.#req("GET", `/api/v1/graph${path}${qs}`, void 0, signal);
  }
  async #postGraph(path, body, signal) {
    return this.#req("POST", `/api/v1/graph${path}`, body, signal);
  }
  async status(root, expectedProjectId, signal) {
    const params = { root };
    if (expectedProjectId) params.project_id = expectedProjectId;
    return await this.#reqGraph("/status", params, signal);
  }
  async ingest(root, opts) {
    const body = { root, refresh: opts?.refresh ?? false };
    if (opts?.expectedProjectId) body.project_id = opts.expectedProjectId;
    return await this.#postGraph("/ingest", body, opts?.signal);
  }
  async symbols(root, opts) {
    const params = { root };
    if (opts?.query) params.q = opts.query;
    if (opts?.limit !== void 0) params.limit = String(opts.limit);
    if (opts?.expectedProjectId) params.project_id = opts.expectedProjectId;
    return await this.#reqGraph("/symbols", params, opts?.signal);
  }
  async search(root, opts) {
    const params = { root, query: opts.query };
    if (opts.topK !== void 0) params.topK = String(opts.topK);
    if (opts.hops !== void 0) params.hops = String(opts.hops);
    if (opts.expectedProjectId) params.project_id = opts.expectedProjectId;
    return await this.#reqGraph("/search", params, opts.signal);
  }
  async callers(root, opts) {
    if (!opts.id) throw new Error("id is required");
    const params = { root, id: opts.id };
    if (opts.limit !== void 0) params.limit = String(opts.limit);
    if (opts.expectedProjectId) params.project_id = opts.expectedProjectId;
    return await this.#reqGraph("/callers", params, opts.signal);
  }
  async references(root, opts) {
    if (!opts.id) throw new Error("id is required");
    const params = { root, id: opts.id };
    if (opts.limit !== void 0) params.limit = String(opts.limit);
    if (opts.expectedProjectId) params.project_id = opts.expectedProjectId;
    return await this.#reqGraph("/references", params, opts.signal);
  }
  async tags(root, opts) {
    const body = { root, id: opts.id, terms: opts.terms };
    if (opts.source) body.source = opts.source;
    if (opts.expectedProjectId) body.project_id = opts.expectedProjectId;
    return await this.#postGraph("/tags", body, opts.signal);
  }
  async ensureReady(root, opts) {
    const existing = this.#inflight.get(root);
    if (existing) return existing;
    const cap = 15e3;
    const deadline = opts?.deadlineMs ?? 18e4;
    const start = Date.now();
    let backoff = 2e3;
    const signal = opts?.signal;
    const promise = (async () => {
      let st = await this.status(root, opts?.expectedProjectId, signal);
      opts?.onProgress?.(st.state, st.nodes);
      if (st.state === "ready" && !opts?.refresh) {
        return st;
      }
      if (st.state === "not_indexed" || st.state === "failed" || opts?.refresh) {
        try {
          st = await this.ingest(root, {
            refresh: opts?.refresh,
            expectedProjectId: opts?.expectedProjectId,
            signal
          });
          opts?.onProgress?.(st.state, st.nodes);
        } catch (e) {
          if (e instanceof GraphError && e.status === 429) {
            const raw = e.retryAfter;
            const secs = parseInt(String(raw ?? ""), 10);
            const backoffJitter = Math.min(cap, backoff * (0.8 + 0.4 * Math.random()));
            const delay = isNaN(secs) ? Math.max(0, new Date(String(raw)).getTime() - Date.now()) : Math.min(cap, secs * 1e3);
            const effectiveDelay = isNaN(delay) || delay < 0 ? backoffJitter : delay;
            const finalDelay = Number.isFinite(effectiveDelay) ? effectiveDelay : backoffJitter;
            const sleepDelay = Number.isNaN(finalDelay) ? backoffJitter : finalDelay;
            await sleep(sleepDelay || backoffJitter, signal);
            return { ...st, queued: true, retryAfter: e.retryAfter };
          }
          throw e;
        }
      }
      let retries = 1;
      while (Date.now() - start < deadline) {
        if (signal?.aborted) break;
        const backoffJitter = Math.min(cap, backoff * (0.8 + 0.4 * Math.random()));
        await sleep(backoffJitter, signal);
        backoff = Math.min(backoff * 2, cap);
        try {
          st = await this.status(root, opts?.expectedProjectId, signal);
          opts?.onProgress?.(st.state, st.nodes);
          if (st.state === "ready") {
            return st;
          }
          if (st.state === "failed" && retries > 0) {
            retries--;
            try {
              await this.ingest(root, { expectedProjectId: opts?.expectedProjectId, signal });
            } catch {
            }
          }
        } catch (e) {
          if (e instanceof GraphError && e.status === 429) {
            const raw = e.retryAfter;
            const secs = parseInt(String(raw ?? ""), 10);
            const retryBackoffJitter = Math.min(cap, backoff * (0.8 + 0.4 * Math.random()));
            const delay = isNaN(secs) ? Math.max(0, new Date(String(raw)).getTime() - Date.now()) : Math.min(cap, secs * 1e3);
            const effectiveDelay = isNaN(delay) || delay < 0 ? retryBackoffJitter : delay;
            const finalDelay = Number.isFinite(effectiveDelay) ? effectiveDelay : retryBackoffJitter;
            await sleep(finalDelay, signal);
            return { ...st, queued: true, retryAfter: e.retryAfter };
          }
        }
      }
      return { ...st, timedOut: true };
    })();
    this.#inflight.set(root, promise);
    promise.finally(() => this.#inflight.delete(root));
    return promise;
  }
};
async function readGuard(client, root, cwd, fn) {
  const effectiveRoot = root || cwd;
  if (!effectiveRoot) {
    return "No root directory available. Set root or run in a project directory.";
  }
  try {
    const st = await client.status(effectiveRoot);
    if (st.state !== "ready") {
      return `Graph is not ready (state: ${st.state}). Run graph_analyze first.`;
    }
    if (st.nodes === 0) {
      return `Graph has 0 nodes. Run graph_analyze to index the project first.`;
    }
  } catch (e) {
    return `Graph status check failed: ${explainError(e)}`;
  }
  try {
    return await fn(client, effectiveRoot);
  } catch (e) {
    return `Graph operation failed: ${explainError(e)}`;
  }
}
function fmtNode(n) {
  const sig = n.signature ? ` ${n.signature}` : "";
  const pr = typeof n.pagerank === "number" ? n.pagerank.toFixed(3) : "N/A";
  const base = `[${n.type}] ${n.name} (${n.file}:${n.startLine}-${n.endLine}, pagerank=${pr})${sig}`;
  const doc = typeof n.doc === "string" ? n.doc.trim().replace(/\s+/g, " ") : "";
  return doc ? `${base} | doc: ${truncate(doc, 200)}` : base;
}
function explainError(e) {
  if (e instanceof GraphError) {
    const parts = [e.message];
    if (e.hint) parts.push(`Hint: ${e.hint}`);
    if (e.mappedRoot) parts.push(`Mapped root: ${e.mappedRoot}`);
    if (e.state) parts.push(`State: ${e.state}`);
    return parts.join(" | ");
  }
  if (e instanceof Error) return e.message;
  return String(e);
}

// src/projectId.ts
init_contracts();
import { execFileSync } from "node:child_process";
import { existsSync as existsSync2, readFileSync as readFileSync2 } from "node:fs";
import { join as join2, isAbsolute } from "node:path";
function normalizeGitRemote(remoteUrl) {
  if (!remoteUrl) return null;
  let url = remoteUrl.trim();
  const sshMatch = url.match(/^git@([^:]+):(.+)$/);
  if (sshMatch) {
    const host = sshMatch[1];
    let path = sshMatch[2];
    if (path.endsWith(".git")) path = path.slice(0, -4);
    return `${host}/${path}`.toLowerCase();
  }
  try {
    const parsed = new URL(url);
    let path = parsed.pathname;
    if (path.startsWith("/")) path = path.slice(1);
    if (path.endsWith(".git")) path = path.slice(0, -4);
    return `${parsed.hostname}/${path}`.toLowerCase();
  } catch {
    return null;
  }
}
function git(args, cwd) {
  try {
    return execFileSync("git", args, { cwd, timeout: 5e3, stdio: ["pipe", "pipe", "pipe"] }).toString().trim() || null;
  } catch {
    return null;
  }
}
function gitRemoteOriginUrl(workspacePath) {
  return git(["remote", "get-url", "origin"], workspacePath);
}
function gitRepoBase(workspacePath) {
  return git(["rev-parse", "--show-toplevel"], workspacePath);
}
function findProjectRoot(workspacePath) {
  let dir = workspacePath;
  for (let i = 0; i < 20; i++) {
    const candidate = join2(dir, ".memory", "project.json");
    if (existsSync2(candidate)) return dir;
    const parent = join2(dir, "..");
    if (parent === dir) break;
    dir = parent;
  }
  const toplevel = gitRepoBase(workspacePath);
  if (toplevel) {
    const candidate = join2(toplevel, ".memory", "project.json");
    if (existsSync2(candidate)) return toplevel;
  }
  return null;
}
function assertSafeProjectId(projectId) {
  if (!projectId || projectId.length === 0) {
    throw new Error("Project ID must not be empty");
  }
  if (projectId.includes("\\") || isAbsolute(projectId) || projectId.startsWith("/") || /^[a-zA-Z]:[\\/]/.test(projectId)) {
    throw new Error(`Project ID must not be a path: ${projectId}`);
  }
  return projectId;
}
function readDeclaredProjectId(workspacePath) {
  const root = findProjectRoot(workspacePath);
  if (!root) return null;
  try {
    const raw = readFileSync2(join2(root, ".memory", "project.json"), "utf-8");
    const data = safeJsonParse(raw, null);
    if (!data) return null;
    const pid = data.metadata ? data.metadata.project_id : data.project_id;
    if (typeof pid === "string" && pid.length > 0) return assertSafeProjectId(pid);
    return null;
  } catch {
    return null;
  }
}
function resolveProjectId(workspacePath) {
  const declared = readDeclaredProjectId(workspacePath);
  if (declared) return declared;
  const remote = gitRemoteOriginUrl(workspacePath);
  const normalized = normalizeGitRemote(remote);
  if (normalized) return assertSafeProjectId(normalized);
  throw new Error("Cannot resolve project_id: no declared ID and no git remote");
}
function tryResolveProjectId(workspacePath) {
  try {
    return resolveProjectId(workspacePath);
  } catch {
    return null;
  }
}
function projectIdStrength(workspacePath) {
  const declared = readDeclaredProjectId(workspacePath);
  if (declared) return "declared";
  const remote = gitRemoteOriginUrl(workspacePath);
  const normalized = normalizeGitRemote(remote);
  if (normalized) return "git-remote";
  return "none";
}
function isFragileScope(workspacePath) {
  return projectIdStrength(workspacePath) === "none";
}

// src/recall.ts
var RECALL_DEFAULTS = {
  maxItems: 8,
  maxPerBlock: 3,
  maxCharsPerItem: 320,
  minScore: 0.5,
  timeoutMs: 3500,
  composeTimeoutMs: 2500,
  overallDeadlineMs: 4500
};
var CONSUME_ORDER = ["knowledge", "skill", "setup", "skill_global", "procedural"];
function recallOptsFromEnv(base) {
  const defaults = base ?? { ...RECALL_DEFAULTS };
  const envMaxItems = process.env.OPENCODE_MEMORY_MAX_ITEMS;
  const envMinScore = process.env.OPENCODE_MEMORY_MIN_SCORE;
  if (envMaxItems) {
    const n = parseInt(envMaxItems, 10);
    if (!isNaN(n) && n > 0) defaults.maxItems = n;
  }
  if (envMinScore) {
    const n = parseFloat(envMinScore);
    if (!isNaN(n) && n >= 0 && n <= 1) defaults.minScore = n;
  }
  return defaults;
}
function formatItem(block, item, opts) {
  const text = item.text ?? item.description ?? "";
  const clamped = truncate(text, opts.maxCharsPerItem);
  const score = item.score.toFixed(2);
  const pointerBlocks = ["skill", "skill_global", "setup"];
  if (pointerBlocks.includes(block)) {
    return `- (${score}) [${item.id}] ${item.name} \u2014 ${clamped}`;
  }
  return `- (${score}) [${item.id}] ${clamped}`;
}
function formatEnvelope(envelope, projectId, opts) {
  const lines = [];
  let count = 0;
  let budget = opts.maxItems;
  for (const blockType of CONSUME_ORDER) {
    for (const block of envelope.blocks) {
      if (block.block !== blockType) continue;
      const take = Math.min(opts.maxPerBlock, budget);
      const items = block.items.slice(0, take);
      for (const item of items) {
        lines.push(formatItem(block.block, item, opts));
        count++;
      }
      budget -= items.length;
      if (budget <= 0) break;
    }
    if (budget <= 0) break;
  }
  return {
    text: lines.join("\n"),
    count,
    source: "compose"
  };
}
async function fallbackContext(client, projectId, query, opts) {
  try {
    const resp = await client.context(query, {
      metadata: { project_id: projectId },
      timeoutMs: opts.timeoutMs,
      signal: opts.signal
    });
    if (!resp.context) return { text: "", count: 0, source: "empty" };
    return { text: resp.context, count: 1, source: "context" };
  } catch {
    return { text: "", count: 0, source: "empty" };
  }
}
async function fallbackSearch(client, projectId, query, opts) {
  try {
    const resp = await client.search(query, {
      metadata: { project_id: projectId },
      minScore: opts.minScore,
      timeoutMs: opts.timeoutMs,
      signal: opts.signal
    });
    if (!resp.results.length) return { text: "", count: 0, source: "empty" };
    const lines = resp.results.slice(0, opts.maxItems).map((r) => {
      const t = truncate(r.text, opts.maxCharsPerItem);
      return `- (${r.score.toFixed(2)}) [${r.documentId}] ${t}`;
    });
    return { text: lines.join("\n"), count: resp.results.length, source: "search" };
  } catch {
    return { text: "", count: 0, source: "empty" };
  }
}
var graphStatusCache = /* @__PURE__ */ new Map();
function isGraphReadyCached(root) {
  const cached = graphStatusCache.get(root);
  if (cached && Date.now() - cached.at < 3e4) return cached.state === "ready";
  return null;
}
function setGraphCache(root, state) {
  graphStatusCache.set(root, { state, at: Date.now() });
  if (graphStatusCache.size > 100) {
    const first = graphStatusCache.keys().next().value;
    if (first) graphStatusCache.delete(first);
  }
}
async function graphFallback(graphClient, root, query, signal) {
  try {
    const cachedReady = isGraphReadyCached(root);
    if (cachedReady === false) return { text: "", count: 0, source: "empty" };
    if (cachedReady === null) {
      const st = await graphClient.status(root, void 0, signal);
      if (signal.aborted) return { text: "", count: 0, source: "empty" };
      setGraphCache(root, st.state);
      if (st.state !== "ready" || st.nodes === 0) return { text: "", count: 0, source: "empty" };
    }
    const res = await graphClient.search(root, { query, topK: 5, hops: 1, signal });
    if (signal.aborted) return { text: "", count: 0, source: "empty" };
    if (!res.seed.length && !res.expanded.length) return { text: "", count: 0, source: "empty" };
    const nodes = [...res.seed, ...res.expanded].slice(0, 8);
    const lines = nodes.map((n) => `- ${fmtNode(n)}`);
    return { text: `### Graph Context (${nodes.length} nodes)
${lines.join("\n")}`, count: nodes.length, source: "graph" };
  } catch {
    return { text: "", count: 0, source: "empty" };
  }
}
async function composeRecall(client, workingDirectory, query, opts) {
  if (opts?.recall === false) return { text: "", count: 0, source: "empty" };
  const defaults = recallOptsFromEnv();
  const effectiveOpts = {
    ...defaults,
    ...opts?.maxItems !== void 0 && { maxItems: opts.maxItems },
    ...opts?.minScore !== void 0 && { minScore: opts.minScore },
    ...opts?.overallDeadlineMs !== void 0 && { overallDeadlineMs: opts.overallDeadlineMs }
  };
  const startMs = Date.now();
  const overallAc = new AbortController();
  const overallTimer = setTimeout(() => overallAc.abort(), effectiveOpts.overallDeadlineMs);
  const overallSignal = overallAc.signal;
  let projectId = null;
  try {
    projectId = resolveProjectId(workingDirectory);
  } catch {
  }
  try {
    try {
      if (!overallSignal.aborted) {
        const composeOpts = {
          timeoutMs: effectiveOpts.composeTimeoutMs,
          signal: overallSignal
        };
        if (projectId) composeOpts.projectId = projectId;
        const envelope = await client.compose(query, composeOpts);
        if (envelope.blocks.length > 0 && envelope.blocks.some((b) => b.items.length > 0)) {
          const result = formatEnvelope(envelope, projectId, effectiveOpts);
          if (result.count > 0) return result;
        }
      }
    } catch {
    }
    if (!projectId || overallSignal.aborted) return { text: "", count: 0, source: "empty" };
    const ctx = await fallbackContext(client, projectId, query, { ...effectiveOpts, signal: overallSignal });
    if (ctx.source !== "empty") return ctx;
    let searchResult = null;
    if (!overallSignal.aborted) {
      searchResult = await fallbackSearch(client, projectId, query, { ...effectiveOpts, signal: overallSignal });
      if (searchResult.source !== "empty") return searchResult;
    }
    const remaining = effectiveOpts.overallDeadlineMs - (Date.now() - startMs);
    if (opts?.graphClient && opts?.graphRoot && remaining >= 800 && !overallSignal.aborted) {
      return await graphFallback(opts.graphClient, opts.graphRoot, query, overallSignal);
    }
    return { text: "", count: 0, source: "empty" };
  } finally {
    clearTimeout(overallTimer);
  }
}

// src/prompts.ts
function ingestionCapabilityNote(features) {
  if (!features) return null;
  if (features.ingestion === true) {
    return "[Memory] The memory server supports ingestion \u2014 memories will be saved automatically when relevant.";
  }
  if (features.ingestion === false) {
    return "[Memory] Server ingestion unavailable \u2014 use memory_save to store knowledge manually.";
  }
  return null;
}
function buildRecallContext(ctx) {
  if (!ctx.recallResult || ctx.recallResult.source === "empty" || !ctx.recallResult.text) {
    return null;
  }
  return `[Memory Recall \u2014 ${ctx.recallResult.count} items from ${ctx.recallResult.source}]
${ctx.recallResult.text}`;
}
function buildCurationDirective() {
  return `<memory-curation>
Ao concluir uma tarefa importante ou aprender algo novo sobre o projeto/usu\xE1rio,
salve o conhecimento com a ferramenta memory_save (knowledge) ou memory_save (skill).
Antes de salvar, busque com memory_search para evitar duplicatas.
Li\xE7\xF5es devem ser generaliz\xE1veis e verificadas \u2014 n\xE3o salve erros de ambiente ou tentativa-e-erro.
</memory-curation>`;
}
var CURATOR_SYSTEM = `Voc\xEA \xE9 um curador de aprendizado para um agente de c\xF3digo. Voc\xEA N\xC3O est\xE1 falando com um usu\xE1rio \u2014 est\xE1 revisando uma conversa que J\xC1 terminou.

Seu \xDANICO trabalho: persistir conhecimento dur\xE1vel e reutiliz\xE1vel na mem\xF3ria do projeto chamando as ferramentas memory_save ou memory_save_skill.

Regras duras:
- Salve APENAS li\xE7\xF5es generaliz\xE1veis e verificadas.
- NUNCA salve erros de ambiente, segredos, ou narrativas one-off.
- N\xC3O edite arquivos, N\xC3O rode comandos \u2014 s\xF3 escreva na mem\xF3ria.
- name e description em PORTUGU\xCAS; body em INGL\xCAS.

Responda com um array JSON de li\xE7\xF5es extra\xEDdas, ou [] se nada qualificar.`;
function buildCurationPrompt(block) {
  return `Revise o bloco de conversa abaixo. Extraia li\xE7\xF5es reutiliz\xE1veis e salve na mem\xF3ria.

--- BLOCO ---
${block.text}
--- FIM ---`;
}
function buildSystemPromptInjection(ctx) {
  const parts = [];
  const recall = buildRecallContext(ctx);
  if (recall) parts.push(recall);
  const ingestion = ingestionCapabilityNote(ctx.features ?? null);
  if (ingestion) parts.push(ingestion);
  if (ctx.hasCurationDirective) {
    parts.push(buildCurationDirective());
  }
  if (parts.length === 0) return null;
  return parts.join("\n\n");
}

// src/skill.ts
var NEGATIVE_TRIGGERS = /não use|não utilise|avoid|do not use|não execute|do not execute|não aplique|do not apply/i;
function validateSkill(doc) {
  const errors = [];
  const warnings = [];
  if (!doc.name || doc.name.trim().length === 0) {
    errors.push("name must not be empty");
  } else if (doc.name.length > 64) {
    errors.push("name must not exceed 64 characters");
  }
  if (!doc.description || doc.description.trim().length === 0) {
    errors.push("description must not be empty");
  } else if (doc.description.length > 1024) {
    errors.push("description must not exceed 1024 characters");
  }
  if (!doc.body || doc.body.trim().length === 0) {
    errors.push("body must not be empty");
  }
  if (errors.length > 0) {
    return { valid: false, errors, warnings };
  }
  if (!doc.body.includes("## What")) {
    warnings.push("body is missing a '## What' section");
  }
  if (!doc.body.includes("## When to use")) {
    warnings.push("body is missing a '## When to use' section");
  }
  if (!doc.body.includes("## Do")) {
    warnings.push("body is missing a '## Do' section");
  }
  if (!doc.body.includes("## Don't") && !doc.body.includes("## Don\u2019t")) {
    warnings.push(`body is missing a "## Don't" section`);
  }
  if (!NEGATIVE_TRIGGERS.test(doc.description)) {
    warnings.push("description lacks a negative trigger (e.g. 'avoid', 'do not use')");
  }
  if (doc.description.length > 400) {
    warnings.push("description exceeds 400 characters");
  }
  if (doc.body.length < 80) {
    warnings.push("body is shorter than 80 characters");
  }
  if (doc.body.length > 1e5) {
    warnings.push("body exceeds 100,000 characters \u2014 consider splitting");
  }
  return { valid: true, errors, warnings };
}
function buildSkillDocument(lesson, meta) {
  const header = `# ${lesson.name}

> ${lesson.description}

`;
  const content = header + lesson.body;
  const metadata = {
    type: "skill",
    status: "candidate",
    name: lesson.name,
    description: lesson.description,
    confidence: "medium",
    source: "curation",
    ...meta
  };
  return { content, metadata };
}

// src/curation.ts
var DEFAULTS = {
  memoryInterval: 10,
  cooldownMs: 6e5,
  errorBackoffMs: 6e4
};
function decideReview(input) {
  if (input.isReviewSession) {
    return { review: false, reason: "anti-loop" };
  }
  if (input.turns < input.memoryInterval) {
    return { review: false, reason: "below-threshold" };
  }
  if (input.now - input.lastReviewAt < input.cooldownMs) {
    return { review: false, reason: "cooldown" };
  }
  if (input.inFlight) {
    return { review: false, reason: "in-flight" };
  }
  return { review: true, memory: true };
}
function commitReview(input) {
  switch (input.status) {
    case "ok":
      return { resetTurns: true, lastReviewAt: input.now };
    case "error":
      return { resetTurns: false, lastReviewAt: input.now - DEFAULTS.cooldownMs + DEFAULTS.errorBackoffMs };
    case "empty":
      return { resetTurns: false, lastReviewAt: null };
  }
}

// src/transcript.ts
var VALID_ROLES = /* @__PURE__ */ new Set(["user", "assistant"]);
var DISCARD_TYPES = /* @__PURE__ */ new Set(["tool_call", "tool_result", "reasoning", "system", "hook", "ephemeral"]);
function cleanTranscript(events) {
  const turns = [];
  for (const ev of events) {
    if (!ev || typeof ev !== "object") continue;
    const obj = ev;
    const role = obj.role;
    if (typeof role !== "string" || !VALID_ROLES.has(role)) continue;
    const eventType = typeof obj.type === "string" ? obj.type : "";
    if (eventType && DISCARD_TYPES.has(eventType)) continue;
    const text = extractText(obj.content);
    if (!text || !text.trim()) continue;
    const id = typeof obj.id === "string" ? obj.id : typeof obj.messageId === "string" ? obj.messageId : "";
    turns.push({ role, text, id });
  }
  return turns;
}
function extractText(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    const parts = [];
    for (const item of content) {
      if (item && typeof item === "object") {
        const obj = item;
        if (typeof obj.text === "string") parts.push(obj.text);
        else if (typeof obj.content === "string") parts.push(obj.content);
      }
    }
    return parts.join("\n");
  }
  return "";
}
function groupIntoBlocks(turns, maxBlockChars = 12e3) {
  if (turns.length === 0) return [];
  const blocks = [];
  let currentText = "";
  let currentFromId = turns[0].id;
  let currentToId = turns[0].id;
  let currentTurns = 0;
  let currentChars = 0;
  for (const turn of turns) {
    const turnLen = turn.text.length;
    const wouldExceed = currentChars + turnLen > maxBlockChars;
    if (wouldExceed && currentTurns > 0) {
      blocks.push({
        text: currentText,
        fromId: currentFromId,
        toId: currentToId,
        turns: currentTurns
      });
      currentText = "";
      currentChars = 0;
      currentTurns = 0;
    }
    if (currentTurns === 0) {
      currentFromId = turn.id;
    }
    currentToId = turn.id;
    currentText += (currentText ? "\n\n" : "") + `${turn.role}: ${turn.text}`;
    currentChars += turnLen;
    currentTurns++;
    if (turnLen > maxBlockChars) {
      blocks.push({
        text: currentText,
        fromId: currentFromId,
        toId: currentToId,
        turns: currentTurns
      });
      currentText = "";
      currentChars = 0;
      currentTurns = 0;
    }
  }
  if (currentTurns > 0) {
    blocks.push({
      text: currentText,
      fromId: currentFromId,
      toId: currentToId,
      turns: currentTurns
    });
  }
  return blocks;
}

// src/curator.ts
function extractModel(messages) {
  for (const msg of messages) {
    if (!msg || typeof msg !== "object") continue;
    const obj = msg;
    if (typeof obj.model === "string" && typeof obj.provider === "string") {
      return { providerID: obj.provider, modelID: obj.model };
    }
    if (obj.model && typeof obj.model === "object") {
      const m = obj.model;
      if (typeof m.id === "string" && typeof m.providerId === "string") {
        return { providerID: m.providerId, modelID: m.id };
      }
    }
  }
  return void 0;
}
async function runCuration(input) {
  try {
    const messages = await input.client.session.messages({ path: { id: input.sessionID } });
    const turns = cleanTranscript(messages);
    if (turns.length === 0) {
      return { status: "empty" };
    }
    const blocks = groupIntoBlocks(turns, 12e3);
    const model = input.extractModel(messages);
    for (const block of blocks) {
      try {
        const curationSession = await input.client.session.create({
          body: { parentID: input.sessionID, title: "memory-curation" }
        });
        input.reviewSessions.add(curationSession.id);
        await input.client.session.prompt({
          path: { id: curationSession.id },
          body: {
            system: input.CURATOR_SYSTEM,
            parts: [{ type: "text", text: input.buildCurationPrompt(block) }],
            ...model ? { model } : {}
          }
        });
      } catch {
      }
    }
    return { status: "ok" };
  } catch {
    return { status: "error" };
  }
}

// src/termExtract.ts
var PT_STOP = /* @__PURE__ */ new Set([
  "o",
  "a",
  "os",
  "as",
  "um",
  "uma",
  "uns",
  "umas",
  "de",
  "do",
  "da",
  "dos",
  "das",
  "dum",
  "duma",
  "e",
  "ou",
  "mas",
  "se",
  "que",
  "com",
  "sem",
  "por",
  "para",
  "no",
  "na",
  "nos",
  "nas",
  "num",
  "numa",
  "em",
  "como",
  "quando",
  "onde",
  "qual",
  "quem",
  "porque",
  "porqu\xEA",
  "pois",
  "ent\xE3o",
  "assim",
  "muito",
  "mais",
  "menos",
  "j\xE1",
  "ainda",
  "s\xF3",
  "tamb\xE9m",
  "at\xE9",
  "desde",
  "entre",
  "sobre",
  "este",
  "esta",
  "estes",
  "estas",
  "esse",
  "essa",
  "esses",
  "essas",
  "aquele",
  "aquela",
  "aqueles",
  "aquelas",
  "isto",
  "isso",
  "aquilo",
  "me",
  "te",
  "se",
  "lhe",
  "lhes",
  "meu",
  "minha",
  "teu",
  "tua",
  "nosso",
  "nossa",
  "este",
  "esta",
  "isto",
  "isso",
  "ter",
  "ser",
  "estar",
  "ir",
  "vir",
  "fazer",
  "poder",
  "querer",
  "saber",
  "haver"
]);
var EN_STOP = /* @__PURE__ */ new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "but",
  "if",
  "then",
  "else",
  "of",
  "on",
  "in",
  "to",
  "for",
  "with",
  "from",
  "by",
  "at",
  "as",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "have",
  "has",
  "had",
  "do",
  "does",
  "did",
  "will",
  "would",
  "could",
  "should",
  "may",
  "might",
  "it",
  "its",
  "this",
  "that",
  "these",
  "those",
  "i",
  "you",
  "he",
  "she",
  "we",
  "they",
  "me",
  "him",
  "her",
  "us",
  "them",
  "my",
  "your",
  "his",
  "our",
  "their",
  "not",
  "no",
  "nor",
  "so",
  "too",
  "very",
  "can",
  "shall",
  "must",
  "here",
  "there",
  "where",
  "when",
  "why",
  "how",
  "what",
  "which",
  "who",
  "whom",
  "all",
  "each",
  "every",
  "both",
  "few",
  "more",
  "most",
  "other",
  "some",
  "such",
  "than",
  "up",
  "out",
  "about",
  "into",
  "over",
  "after",
  "before",
  "between",
  "under",
  "again",
  "further",
  "once",
  "only",
  "own",
  "same",
  "just"
]);
var STOP = /* @__PURE__ */ new Set([...PT_STOP, ...EN_STOP]);
var MAX_TERMS = 3;
function extractTerms(query) {
  const tokens = query.toLowerCase().split(/[\s,.;:!?\-_/\\(){}\[\]<>]+/).map((t) => t.trim()).filter((t) => t.length > 0);
  const seen = /* @__PURE__ */ new Set();
  const result = [];
  for (const token of tokens) {
    if (STOP.has(token)) continue;
    if (seen.has(token)) continue;
    seen.add(token);
    result.push(token);
    if (result.length >= MAX_TERMS) break;
  }
  return result;
}
function canonicalTag(words) {
  return words.map((w) => w.trim().toLowerCase()).filter((w) => w.length > 0).sort().join(" ");
}

// src/feedbackLoop.ts
async function tagOnMiss(client, root, opts) {
  let symbols;
  try {
    const symbolsResult = await client.symbols(root, {
      query: opts.expectedName,
      expectedProjectId: opts.expectedProjectId
    });
    symbols = symbolsResult.symbols;
  } catch (e) {
    return { error: true, reason: `Failed to look up symbols: ${e instanceof Error ? e.message : String(e)}` };
  }
  const node = symbols.find((s) => s.name === opts.expectedName);
  if (!node) {
    return {
      error: true,
      reason: `Node "${opts.expectedName}" not found by exact name in graph symbols.`
    };
  }
  const terms = extractTerms(opts.query);
  if (terms.length < 2) {
    return {
      error: true,
      reason: `Query "${opts.query}" produced less than 2 meaningful terms after stopword removal. Need at least 2 terms to create a tag.`
    };
  }
  const tagPhrase = canonicalTag(terms);
  try {
    const tagResult = await client.tags(root, {
      id: node.id,
      terms: [tagPhrase],
      source: opts.source ?? "tag-on-miss",
      expectedProjectId: opts.expectedProjectId
    });
    return {
      accepted: tagResult.accepted,
      droppedOverCap: tagResult.dropped_over_cap,
      rejected: tagResult.rejected
    };
  } catch (e) {
    return { error: true, reason: `Failed to write tag: ${e instanceof Error ? e.message : String(e)}` };
  }
}

// src/dashboard.ts
init_contracts();
import { createServer } from "node:http";
import { readFileSync as readFileSync4, writeFileSync as writeFileSync2, existsSync as existsSync4, mkdirSync as mkdirSync2, renameSync as renameSync2, unlinkSync } from "node:fs";
import { join as join4 } from "node:path";
import { homedir as homedir3 } from "node:os";
init_config();
function portFilePath(dir) {
  return join4(dir, "dashboard-port.json");
}
function readPortFile(dir) {
  try {
    const p = portFilePath(dir);
    if (!existsSync4(p)) return null;
    const raw = readFileSync4(p, "utf-8");
    const data = safeJsonParse(raw, null);
    if (data && typeof data.port === "number" && data.port > 0) return data.port;
    return null;
  } catch {
    return null;
  }
}
function writePortFile(dir, port) {
  try {
    mkdirSync2(dir, { recursive: true });
    const file = portFilePath(dir);
    const tmp = `${file}.tmp.${process.pid}`;
    writeFileSync2(tmp, JSON.stringify({ port }));
    try {
      renameSync2(tmp, file);
    } catch (e) {
      try {
        unlinkSync(tmp);
      } catch {
      }
      throw e;
    }
  } catch {
  }
}
var activeDashboardPorts = /* @__PURE__ */ new Set();
async function isAlive(port, timeoutMs = 500) {
  try {
    let signal;
    let timer;
    if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
      signal = AbortSignal.timeout(timeoutMs);
    } else {
      const ac = new AbortController();
      signal = ac.signal;
      void sleep(timeoutMs).then(() => {
        try {
          ac.abort();
        } catch {
        }
      });
      timer = setTimeout(() => {
        try {
          ac.abort();
        } catch {
        }
      }, timeoutMs);
    }
    const r = await fetch(`http://127.0.0.1:${port}/api/data`, { signal });
    if (timer) clearTimeout(timer);
    return r.ok;
  } catch {
    return false;
  }
}
function spaHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>OpenCode Memory Dashboard</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0d1117; color: #c9d1d9; padding: 24px; }
  h1 { font-size: 1.5rem; margin-bottom: 20px; color: #58a6ff; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 16px; }
  .card { background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 16px; }
  .card h2 { font-size: 1rem; margin-bottom: 12px; color: #8b949e; border-bottom: 1px solid #21262d; padding-bottom: 8px; }
  .pill { display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 0.8rem; font-weight: 600; }
  .pill.online { background: #238636; color: #fff; }
  .pill.offline { background: #da3633; color: #fff; }
  .row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 0.9rem; }
  .row .label { color: #8b949e; }
  input[type="text"] { width: 100%; padding: 8px; border: 1px solid #30363d; border-radius: 6px; background: #0d1117; color: #c9d1d9; font-size: 0.9rem; margin: 4px 0; }
  button { padding: 6px 14px; border: 1px solid #30363d; border-radius: 6px; background: #21262d; color: #c9d1d9; cursor: pointer; font-size: 0.85rem; margin: 4px 4px 4px 0; }
  button:hover { background: #30363d; }
  button.primary { background: #238636; border-color: #238636; color: #fff; }
  button.primary:hover { background: #2ea043; }
  .search-results { max-height: 300px; overflow-y: auto; margin-top: 8px; }
  .search-result { padding: 8px; border-bottom: 1px solid #21262d; font-size: 0.85rem; }
  .search-result .score { color: #8b949e; font-size: 0.8rem; }
  .empty { color: #484f58; font-style: italic; font-size: 0.85rem; }
  .doc-item { padding: 6px 0; border-bottom: 1px solid #21262d; font-size: 0.85rem; }
  .doc-type { display: inline-block; padding: 1px 6px; border-radius: 4px; background: #1f6feb22; color: #58a6ff; font-size: 0.75rem; margin-left: 6px; }
  #status-bar { position: fixed; bottom: 0; left: 0; right: 0; background: #161b22; border-top: 1px solid #30363d; padding: 6px 16px; font-size: 0.75rem; color: #484f58; text-align: center; }
</style>
</head>
<body>
<h1>OpenCode Memory Dashboard</h1>
<div class="grid">
  <div class="card" id="card-status">
    <h2>Server Status</h2>
    <div id="status-content"><span class="empty">Loading...</span></div>
  </div>
  <div class="card" id="card-config">
    <h2>Server Config</h2>
    <div id="config-content"><span class="empty">Loading...</span></div>
  </div>
  <div class="card" id="card-scope">
    <h2>Scope</h2>
    <div id="scope-content"><span class="empty">Loading...</span></div>
  </div>
  <div class="card" id="card-search">
    <h2>Search</h2>
    <input type="text" id="search-input" placeholder="Search memory...">
    <button onclick="doSearch()">Search</button>
    <div id="search-results" class="search-results"></div>
  </div>
  <div class="card" id="card-recent">
    <h2>Recent Documents</h2>
    <div id="recent-content"><span class="empty">Loading...</span></div>
  </div>
</div>
<div id="status-bar">Auto-refresh: 5s</div>
<script>
let busy = false;
function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
async function load() {
  if (busy) return;
  busy = true;
  try {
    const r = await fetch('/api/data');
    if (!r.ok) return;
    const d = await r.json();
    renderStatus(d);
    renderConfig(d);
    renderScope(d);
    renderRecent(d);
  } catch(e) {} finally { busy = false; }
}
function renderStatus(d) {
  const el = document.getElementById('status-content');
  const pill = d.daemon.online ? '<span class="pill online">Online</span>' : '<span class="pill offline">Offline</span>';
  el.innerHTML = pill +
    '<div class="row"><span class="label">URL</span><span>' + esc(d.daemon.url || 'N/A') + '</span></div>' +
    '<div class="row"><span class="label">Version</span><span>' + esc(d.daemon.version || 'N/A') + '</span></div>' +
    '<div class="row"><span class="label">Status</span><span>' + esc(d.daemon.status || 'N/A') + '</span></div>';
}
function renderConfig(d) {
  const el = document.getElementById('config-content');
  el.innerHTML =
    '<input type="text" id="config-url" value="' + esc(d.server.configuredUrl || '') + '" placeholder="http://host:port">' +
    '<div><button class="primary" onclick="saveConfig()">Save</button>' +
    '<button onclick="clearConfig()">Clear</button>' +
    (d.canProvision ? '<button onclick="doProvision()">Provision</button>' : '') + '</div>';
}
function renderScope(d) {
  const el = document.getElementById('scope-content');
  el.innerHTML =
    '<div class="row"><span class="label">Project ID</span><span>' + esc(d.scope.projectId || 'none') + '</span></div>' +
    '<div class="row"><span class="label">Strength</span><span>' + esc(d.scope.strength) + '</span></div>' +
    '<div class="row"><span class="label">Fragile</span><span>' + esc(d.scope.fragile) + '</span></div>' +
    '<div class="row"><span class="label">Workdir</span><span>' + esc(d.scope.workdir) + '</span></div>';
}
function renderRecent(d) {
  const el = document.getElementById('recent-content');
  if (!d.recent || d.recent.length === 0) { el.innerHTML = '<span class="empty">No documents</span>'; return; }
  el.innerHTML = d.recent.slice(0, 8).map(doc =>
    '<div class="doc-item">' + esc(doc.id.substring(0, 12)) + '...' +
    (doc.type ? '<span class="doc-type">' + esc(doc.type) + '</span>' : '') +
    '<br>' + esc(doc.text.substring(0, 120)) + '</div>'
  ).join('');
}
async function doSearch() {
  const q = document.getElementById('search-input').value;
  if (!q) return;
  const el = document.getElementById('search-results');
  el.innerHTML = '<span class="empty">Searching...</span>';
  try {
    const r = await fetch('/api/search?q=' + encodeURIComponent(q));
    const results = await r.json();
    if (!results.length) { el.innerHTML = '<span class="empty">No results</span>'; return; }
    el.innerHTML = results.map(r =>
      '<div class="search-result"><span class="score">' + esc(r.score.toFixed(2)) + '</span> ' + esc(r.text.substring(0, 200)) + '</div>'
    ).join('');
  } catch(e) { el.innerHTML = '<span class="empty">Search failed</span>'; }
}
async function saveConfig() {
  const url = document.getElementById('config-url').value;
  await fetch('/api/config', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({url}) });
  load();
}
async function clearConfig() {
  await fetch('/api/config', { method: 'DELETE' });
  load();
}
async function doProvision() {
  const el = document.getElementById('config-content');
  el.innerHTML = '<span class="empty">Provisioning...</span>';
  await fetch('/api/setup', { method: 'POST' });
  load();
}
load();
setInterval(() => { if (!busy) load(); }, 5000);
</script>
</body>
</html>`;
}
var MemoryDashboard = class {
  #cwdProvider;
  #provisioner;
  #clientFactory;
  #configDir;
  #portDir;
  #resolveDaemonFn;
  #server = null;
  #url = null;
  #clientCache = null;
  #clientUrl = null;
  #starting = null;
  url = null;
  constructor(opts) {
    this.#cwdProvider = opts?.cwdProvider ?? (() => process.cwd());
    this.#provisioner = opts?.provisioner ?? (() => Promise.resolve({ ok: false, reason: "no-provisioner" }));
    this.#clientFactory = opts?.clientFactory ?? ((u) => new MemoryClient(u));
    this.#configDir = opts?._configDir ?? CONFIG_DIR;
    this.#portDir = opts?._portDir ?? join4(homedir3(), ".opencode-memory");
    this.#resolveDaemonFn = opts?._resolveDaemon ?? resolveDaemon;
  }
  #getClient(url) {
    if (!this.#clientCache || this.#clientUrl !== url) {
      this.#clientCache = this.#clientFactory(url);
      this.#clientUrl = url;
    }
    return this.#clientCache;
  }
  #getClientOrNull() {
    return this.#clientCache;
  }
  async ensureServer() {
    if (this.#url) return this.#url;
    try {
      const result = await this.#resolveDaemonFn();
      if (result.info) {
        this.#url = result.info.url;
        this.#getClient(result.info.url);
        return this.#url;
      }
    } catch {
    }
    try {
      const prov = await this.#provisioner();
      if (prov.ok) {
        const result = await this.#resolveDaemonFn();
        if (result.info) {
          this.#url = result.info.url;
          this.#getClient(result.info.url);
          return this.#url;
        }
      }
    } catch {
    }
    this.#url = "http://127.0.0.1:0";
    return this.#url;
  }
  async snapshot() {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const cwd = this.#cwdProvider();
    const pid = tryResolveProjectId(cwd);
    const strength = projectIdStrength(cwd);
    const fragile = isFragileScope(cwd);
    const config = readConfig(this.#configDir);
    const snap = {
      ts: now,
      daemon: { online: false, url: null, version: null, status: null },
      scope: {
        projectId: pid,
        strength,
        fragile,
        hasConfig: !!config.daemonUrl,
        configPath: join4(this.#configDir, "config.json"),
        workdir: cwd
      },
      recent: [],
      skills: { active: [], candidate: [] },
      server: {
        configuredUrl: config.daemonUrl ?? null,
        envOverride: !!process.env.OPENCODE_MEMORY_DAEMON_URL,
        source: "none",
        online: false
      },
      canProvision: true
    };
    try {
      const result = await this.#resolveDaemonFn();
      snap.server.source = result.source;
      snap.server.configuredUrl = result.configuredUrl ?? config.daemonUrl ?? null;
      if (result.info) {
        snap.daemon.online = true;
        snap.daemon.url = result.info.url;
        snap.server.online = true;
        this.#getClient(result.info.url);
        try {
          const client = this.#getClient(result.info.url);
          const health2 = await client.health();
          snap.daemon.version = health2.version;
          snap.daemon.status = health2.status;
        } catch {
        }
        try {
          const client = this.#getClient(result.info.url);
          const metaFilter = {};
          if (pid) metaFilter.project_id = pid;
          const list = await client.list({ limit: 8, metadata: Object.keys(metaFilter).length > 0 ? metaFilter : void 0 });
          snap.recent = list.data.map((d) => ({
            id: d.id,
            text: (d.content ?? "").slice(0, 200),
            type: d.metadata?.type ?? null
          }));
        } catch {
        }
        try {
          const client = this.#getClient(result.info.url);
          const metaFilter = {};
          if (pid) metaFilter.project_id = pid;
          const list = await client.list({ metadata: Object.keys(metaFilter).length > 0 ? metaFilter : void 0 });
          for (const doc of list.data) {
            const type = doc.metadata?.type;
            if (type !== "skill" && type !== "skill_candidate") continue;
            const entry = {
              id: doc.id,
              name: doc.metadata?.name ?? "unknown",
              status: doc.metadata?.status ?? "unknown"
            };
            if (type === "skill") snap.skills.active.push(entry);
            else snap.skills.candidate.push(entry);
          }
        } catch {
        }
      }
    } catch {
    }
    return snap;
  }
  async search(query) {
    const client = this.#getClientOrNull();
    if (!client) return [];
    try {
      const resp = await client.search(query, { topK: 10 });
      return resp.results;
    } catch {
      return [];
    }
  }
  async provision() {
    return this.#provisioner();
  }
  getServerConfig() {
    return readConfig(this.#configDir);
  }
  async saveServerConfig(url) {
    if (url === void 0) {
      const { clearDaemonUrl: clearDaemonUrl2 } = await Promise.resolve().then(() => (init_config(), config_exports));
      return clearDaemonUrl2(this.#configDir);
    }
    const v = validateDaemonUrl(url);
    if (!v.ok) return { ok: false, error: v.error };
    const { saveDaemonUrl: saveDaemonUrl2 } = await Promise.resolve().then(() => (init_config(), config_exports));
    return saveDaemonUrl2(url, this.#configDir);
  }
  async startServer() {
    if (this.#server) return await this.ensureServer();
    if (this.#starting) return this.#starting;
    this.#starting = (async () => {
      const preferred = readPortFile(this.#portDir);
      if (preferred && !activeDashboardPorts.has(preferred) && await isAlive(preferred)) {
        this.#url = `http://127.0.0.1:${preferred}`;
        this.url = this.#url;
        return this.#url;
      }
      return new Promise((resolve) => {
        const server = createServer((req, res) => {
          this.#handleRequest(req, res);
        });
        server.listen(0, "127.0.0.1", async () => {
          const addr = server.address();
          if (addr && typeof addr === "object") {
            const actualPort = addr.port;
            this.#server = server;
            this.#url = `http://127.0.0.1:${actualPort}`;
            this.url = this.#url;
            writePortFile(this.#portDir, actualPort);
            activeDashboardPorts.add(actualPort);
            try {
              const after = readPortFile(this.#portDir);
              if (after !== null && after !== actualPort && await isAlive(after)) {
                try {
                  server.close();
                } catch {
                }
                activeDashboardPorts.delete(actualPort);
                this.#server = null;
                this.#url = `http://127.0.0.1:${after}`;
                this.url = this.#url;
                resolve(this.#url);
                return;
              }
            } catch {
            }
            resolve(this.#url);
          } else {
            resolve("http://127.0.0.1:0");
          }
        });
        server.on("error", () => {
          const fallback = createServer((req, res) => {
            this.#handleRequest(req, res);
          });
          fallback.listen(0, "127.0.0.1", () => {
            const addr = fallback.address();
            if (addr && typeof addr === "object") {
              this.#server = fallback;
              this.#url = `http://127.0.0.1:${addr.port}`;
              this.url = this.#url;
              writePortFile(this.#portDir, addr.port);
              activeDashboardPorts.add(addr.port);
            }
            resolve(this.#url ?? "http://127.0.0.1:0");
          });
        });
      });
    })();
    try {
      return await this.#starting;
    } finally {
      this.#starting = null;
    }
  }
  async #handleRequest(req, res) {
    const url = req.url ?? "/";
    const method = req.method ?? "GET";
    if (url === "/" && method === "GET") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(spaHtml());
      return;
    }
    if (url === "/api/data" && method === "GET") {
      const snap = await this.snapshot();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(snap));
      return;
    }
    if (url.startsWith("/api/search") && method === "GET") {
      const parsed = new URL(url, "http://localhost");
      const q = parsed.searchParams.get("q") ?? "";
      const results = await this.search(q);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(results));
      return;
    }
    if (url === "/api/setup" && method === "POST") {
      const result = await this.provision();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(result));
      return;
    }
    if (url === "/api/config" && method === "GET") {
      const config = this.getServerConfig();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(config));
      return;
    }
    if (url === "/api/config" && method === "POST") {
      const MAX_BODY = 65536;
      const REQUEST_TIMEOUT_MS = 1e4;
      const contentLength = parseInt(req.headers["content-length"] ?? "0", 10);
      if (contentLength > MAX_BODY) {
        res.writeHead(413, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: "Payload too large" }));
        return;
      }
      let body = "";
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        req.destroy();
      }, REQUEST_TIMEOUT_MS);
      req.on("data", (chunk) => {
        if (timedOut) return;
        body += chunk.toString();
      });
      req.on("error", () => {
        clearTimeout(timer);
      });
      req.on("end", async () => {
        clearTimeout(timer);
        try {
          const parsed = safeJsonParse(body, {});
          const result = await this.saveServerConfig(parsed.url);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(result));
        } catch {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: false, error: "parse error" }));
        }
      });
      return;
    }
    if (url === "/api/config" && method === "DELETE") {
      const result = await this.saveServerConfig(void 0);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(result));
      return;
    }
    res.writeHead(404);
    res.end("Not Found");
  }
};

// src/provision.ts
import { existsSync as existsSync5, readFileSync as readFileSync5, rmSync, writeFileSync as writeFileSync3, unlinkSync as unlinkSync2 } from "node:fs";
import { join as join5 } from "node:path";
import { homedir as homedir4 } from "node:os";
import { spawn } from "node:child_process";
var RELEASES_API = "https://api.github.com/repos/AllanSantos-DV/mcp-memory-server-releases/releases?per_page=30";
var MIN_VERSION = [2, 19, 0];
var LOCK_TTL_MS = 6e5;
var PROVISION_POLL_INTERVAL_MS = 2e3;
var PROVISION_POLL_TIMEOUT_MS = 9e4;
function serverDir() {
  return join5(homedir4(), ".opencode-memory", "server");
}
function parseVersion(tag) {
  const m = tag.match(/^v(\d+)\.(\d+)\.(\d+)$/);
  if (!m) return null;
  return [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10)];
}
function versionGte(a, b) {
  if (a[0] !== b[0]) return a[0] > b[0];
  if (a[1] !== b[1]) return a[1] > b[1];
  return a[2] >= b[2];
}
function isWindows() {
  return process.platform === "win32";
}
function javaBinary() {
  return isWindows() ? "java.exe" : "java";
}
async function fetchLatestServerRelease(opts) {
  try {
    const fetchFn = opts?._fetch ?? globalThis.fetch;
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), opts?._timeoutMs ?? 15e3);
    let resp;
    try {
      resp = await fetchFn(RELEASES_API, { signal: ac.signal });
    } finally {
      clearTimeout(timer);
    }
    const raw = await resp.json();
    let best = null;
    for (const r of raw) {
      if (r.draft || r.prerelease) continue;
      const ver = parseVersion(r.tag_name);
      if (!ver) continue;
      if (!versionGte(ver, MIN_VERSION)) continue;
      const jarAssets = r.assets.filter((a) => /^mcp-memory-server-.*\.jar$/.test(a.name));
      if (jarAssets.length === 0) continue;
      const plainJar = jarAssets.find((a) => !a.name.includes("-gpu")) ?? jarAssets[0];
      const sha256Name = plainJar.name + ".sha256";
      const sha256Asset = r.assets.find((a) => a.name === sha256Name);
      const release = {
        version: ver,
        tag: r.tag_name,
        jarUrl: plainJar.browser_download_url,
        jarName: plainJar.name,
        sha256Url: sha256Asset?.browser_download_url ?? null
      };
      if (!best || versionGte(ver, best.version)) {
        best = release;
      }
    }
    return best;
  } catch {
    return null;
  }
}
async function resolveJava(opts) {
  const existsFn = opts._existsSync ?? existsSync5;
  const env = opts._env ?? process.env;
  const whichFn = opts._which ?? (async (cmd) => {
    try {
      const { execFileSync: execFileSync2 } = await import("node:child_process");
      const result = execFileSync2(isWindows() ? "where" : "which", [cmd], {
        timeout: 5e3,
        stdio: ["pipe", "pipe", "pipe"]
      }).toString().trim();
      return result || null;
    } catch {
      return null;
    }
  });
  const bundled = join5(opts.serverDir, "runtime", "bin", javaBinary());
  if (existsFn(bundled)) return bundled;
  if (existsFn(bundled + ".exe")) return bundled + ".exe";
  const javaHome = env.JAVA_HOME;
  if (javaHome) {
    const homeBin = join5(javaHome, "bin", javaBinary());
    if (existsFn(homeBin)) return homeBin;
    if (existsFn(homeBin + ".exe")) return homeBin + ".exe";
  }
  const fromPath = await whichFn("java");
  if (fromPath) return fromPath;
  return null;
}
function lockPath(dir) {
  return join5(dir, ".provisioning.lock");
}
async function acquireLock(dir, opts) {
  const lp = lockPath(dir);
  const timeout = opts?.timeoutMs ?? 6e4;
  try {
    if (existsSync5(lp)) {
      const raw = readFileSync5(lp, "utf-8");
      const parsed = JSON.parse(raw);
      if (parsed.ts && Date.now() - parsed.ts < LOCK_TTL_MS) {
        const start = Date.now();
        while (Date.now() - start < timeout) {
          await new Promise((r) => setTimeout(r, 500));
          if (!existsSync5(lp)) break;
          const re = JSON.parse(readFileSync5(lp, "utf-8"));
          if (re.ts && Date.now() - re.ts >= LOCK_TTL_MS) break;
        }
        if (existsSync5(lp)) {
          const re = JSON.parse(readFileSync5(lp, "utf-8"));
          if (re.ts && Date.now() - re.ts < LOCK_TTL_MS) return false;
        }
      }
    }
    writeFileSync3(lp, JSON.stringify({ pid: process.pid, ts: Date.now() }));
    return true;
  } catch {
    return true;
  }
}
function releaseLock(dir) {
  try {
    const lp = lockPath(dir);
    if (existsSync5(lp)) unlinkSync2(lp);
  } catch {
  }
}
async function downloadJar(url, dest, opts) {
  try {
    const fetchFn = opts?._fetch ?? globalThis.fetch;
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), opts?._timeoutMs ?? 12e4);
    let resp;
    try {
      resp = await fetchFn(url, { signal: ac.signal });
    } finally {
      clearTimeout(timer);
    }
    if (!resp.ok) return false;
    const buf = Buffer.from(await resp.arrayBuffer());
    const { writeFileSync: ws } = await import("node:fs");
    ws(dest, buf);
    return true;
  } catch {
    return false;
  }
}
async function verifySha256(jarPath, sha256Url, opts) {
  try {
    const fetchFn = opts?._fetch ?? globalThis.fetch;
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), opts?._timeoutMs ?? 3e4);
    let resp;
    try {
      resp = await fetchFn(sha256Url, { signal: ac.signal });
    } finally {
      clearTimeout(timer);
    }
    if (!resp.ok) return false;
    const expected = (await resp.text()).trim().split(/\s+/)[0]?.toLowerCase();
    if (!expected || expected.length !== 64) return false;
    const { readFileSync: rs } = await import("node:fs");
    const { createHash } = await import("node:crypto");
    const buf = rs(jarPath);
    const actual = createHash("sha256").update(buf).digest("hex");
    return actual === expected;
  } catch {
    return false;
  }
}
function spawnDaemon(javaPath, jarPath, opts) {
  const spawnFn = opts?._spawn ?? spawn;
  try {
    const child = spawnFn(
      javaPath,
      ["--enable-native-access=ALL-UNNAMED", "-jar", jarPath, "--transport", "http", "--daemon"],
      {
        detached: true,
        stdio: "ignore",
        windowsHide: true
      }
    );
    child.unref();
  } catch {
  }
}
async function waitForAnnounce(discoverFn, pollMs, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const info = await discoverFn();
    if (info) return true;
    await new Promise((r) => setTimeout(r, pollMs));
  }
  return false;
}
async function ensureServer(opts) {
  const sDir = opts?._serverDir ?? serverDir();
  const discoverFn = opts?._discover ?? discover;
  const acquireFn = opts?._acquireLock ?? ((d) => acquireLock(d));
  const releaseFn = opts?._releaseLock ?? releaseLock;
  try {
    const existing = await discoverFn();
    if (existing) {
      return { ok: true, reused: true, version: null };
    }
    const autoEnabled = opts?._autoProvisionEnabled ?? (() => true);
    if (!autoEnabled()) {
      return { ok: false, reason: "disabled" };
    }
    const acquired = await acquireFn(sDir);
    if (!acquired) {
      const waitFn = opts?._waitForAnnounce ?? (() => waitForAnnounce(discoverFn, PROVISION_POLL_INTERVAL_MS, 6e4));
      const waited = await waitFn();
      if (waited) return { ok: true, reused: true, pending: true };
      return { ok: false, reason: "lock-timeout" };
    }
    try {
      const resolveJavaFn = opts?._resolveJava ?? ((d) => resolveJava({ serverDir: d }));
      const java = await resolveJavaFn(sDir);
      if (!java) {
        return { ok: false, reason: "no-java" };
      }
      const fetchReleaseFn = opts?._fetchLatestRelease ?? (() => fetchLatestServerRelease());
      const release = await fetchReleaseFn();
      if (!release) {
        return { ok: false, reason: "no-release" };
      }
      const jarPath = join5(sDir, release.jarName);
      if (!existsSync5(jarPath)) {
        const dlFn = opts?._downloadJar ?? ((url, dest) => downloadJar(url, dest));
        const downloaded = await dlFn(release.jarUrl, jarPath);
        if (!downloaded) {
          return { ok: false, reason: "download-failed" };
        }
      }
      if (release.sha256Url) {
        const verifyFn = opts?._verifySha256 ?? ((jar, url) => verifySha256(jar, url));
        const valid = await verifyFn(jarPath, release.sha256Url);
        if (!valid) {
          try {
            rmSync(jarPath);
          } catch {
          }
          return { ok: false, reason: "sha256-mismatch" };
        }
      }
      const spawnFn = opts?._spawnDaemon ?? ((j, jar) => spawnDaemon(j, jar));
      spawnFn(java, jarPath);
      const waitFn = opts?._waitForAnnounce ?? (() => waitForAnnounce(discoverFn, PROVISION_POLL_INTERVAL_MS, PROVISION_POLL_TIMEOUT_MS));
      const announced = await waitFn();
      return {
        ok: announced,
        installed: announced,
        version: release.version.join("."),
        ...announced ? {} : { reason: "spawn-timeout" }
      };
    } finally {
      releaseFn(sDir);
    }
  } catch {
    return { ok: false, reason: "error" };
  }
}

// src/serverAlert.ts
function buildServerAlert(reason, url) {
  if (reason === "unreachable") {
    return [
      "\u{1F9E0} MEMORY SERVER UNREACHABLE \u2014 configured server `" + (url ?? "unknown") + "` did not respond.",
      "Memory is temporarily unavailable. NOTIFY the user and open the panel",
      "(tool `memory_dashboard`) to review/fix the URL."
    ].join("\n");
  }
  return [
    "\u{1F9E0} MEMORY DISABLED \u2014 no memory server configured or running.",
    "Memory is NOT saving or injecting recall. NOTIFY the user and open the",
    "panel (tool `memory_dashboard`) where they can POINT to an existing",
    "server OR authorize provisioning a local one."
  ].join("\n");
}

// src/serverGate.ts
async function serverGate(opts) {
  try {
    const resolve = opts?._resolveDaemon ?? resolveDaemon;
    const result = await resolve();
    if (result.info) {
      return { alert: null, source: result.source };
    }
    if (result.source === "configured-unreachable") {
      return {
        alert: buildServerAlert("unreachable", result.configuredUrl ?? void 0),
        source: result.source
      };
    }
    if (result.source === "none") {
      return { alert: buildServerAlert("unconfigured"), source: result.source };
    }
    return { alert: null, source: result.source };
  } catch {
    return { alert: null, source: "error" };
  }
}

// src/skillGuide.ts
var SKILL_GUIDE = `# Memory Skill Authoring Guide

## PT Header (required)

Every skill artifact must have a PT header:

| Field | Constraint |
|-------|-----------|
| \`name\` | PT, \u226464 chars |
| \`description\` | PT, \u22641024 chars |
| \`body\` | EN |

## EN Body Structure

\`\`\`markdown
## What
One sentence: what the skill does.

## When to use
When to invoke the skill (trigger conditions).

## Do
Step-by-step instructions the agent follows.

## Don't
Anti-patterns and forbidden actions.

## Example
A concrete example showing correct usage.
\`\`\`

## Rules Table

| Rule | Description |
|------|-------------|
| description PT | Description must be in Portuguese, \u22641024 chars |
| name PT | Name must be in Portuguese, \u226464 chars |
| body EN | Body must be in English |
| no code in description | Description must not contain code or technical jargon |
| one skill per file | One skill per .md file |

## Pitfalls

| Mistake | Fix |
|---------|-----|
| Description in English | Rewrite in Portuguese |
| Name too long (>64 chars) | Shorten to \u226464 chars |
| Body in Portuguese | Rewrite in English |
| No \`When to use\` section | Add trigger conditions |
| No \`Don't\` section | Add anti-patterns |

## Lifecycle

1. **candidate** \u2014 New skill, needs review
2. **promote** \u2014 Reviewed and approved
3. **invalidate** \u2014 Deprecated or replaced

Use \`memory_save_skill\` to persist skills and \`memory_list_skills\` to query them.
`;

// src/ingestionGuide.ts
var INGESTION_GUIDE = `# Ingestion Guide

## Server-side Ingestion

When \`features.ingestion === false\`, the server does not ingest documents automatically.

## Client-side Ingestion

Set \`OPENCODE_MEMORY_INGEST=1\` to enable client-side ingestion.

## Ingestion Frequency

Set \`OPENCODE_MEMORY_INGEST_EVERY=N\` to ingest every N turns (default: 5, minimum: 1).

## Capability Note

When server-side ingestion is off but client-side ingestion is on, the capability note is:
"Server-side ingestion is disabled; client-side ingestion is active."
`;

// src/index.ts
import { z } from "zod";
var recallCache = /* @__PURE__ */ new Map();
var turnCount = /* @__PURE__ */ new Map();
var MAX_SESSION_CACHE = 500;
function evictIfNeeded(collection, max) {
  if (collection.size <= max) return;
  const toEvict = collection.size - max;
  let evicted = 0;
  if (collection instanceof Set) {
    for (const key of collection) {
      if (evicted >= toEvict) break;
      collection.delete(key);
      evicted++;
    }
  } else {
    for (const key of collection.keys()) {
      if (evicted >= toEvict) break;
      collection.delete(key);
      evicted++;
    }
  }
}
var daemonCache = null;
var daemonCacheAt = 0;
var DAEMON_CACHE_TTL_MS = 3e4;
var clientInstance = null;
var clientBaseUrl = null;
var graphClientInstance = null;
var graphClientBaseUrl = null;
var reviewSessions = /* @__PURE__ */ new Set();
var lastReviewAt = 0;
var curationInFlight = /* @__PURE__ */ new Set();
var dashboard = null;
function getClient(url) {
  if (!clientInstance || clientBaseUrl !== url) {
    clientInstance = new MemoryClient(url);
    clientBaseUrl = url;
  }
  return clientInstance;
}
function getGraphClient(url) {
  if (!graphClientInstance || graphClientBaseUrl !== url) {
    graphClientInstance = new GraphClient({ baseUrl: url });
    graphClientBaseUrl = url;
  }
  return graphClientInstance;
}
async function withDaemon(fn, fallback, signal) {
  try {
    const now = Date.now();
    let daemon = null;
    if (daemonCache && now - daemonCacheAt < DAEMON_CACHE_TTL_MS) {
      daemon = daemonCache;
    } else {
      const result = await resolveDaemon();
      if (result.info) {
        daemonCache = { url: result.info.url, features: result.info.features ?? null };
        daemonCacheAt = now;
        daemon = daemonCache;
      } else {
        daemonCache = null;
        daemonCacheAt = now;
        daemon = null;
      }
    }
    if (!daemon) return fallback;
    return await fn(daemon.url, signal);
  } catch (e) {
    if (typeof fallback === "string") return JSON.stringify({ ok: false, error: explainError(e) });
    return fallback;
  }
}
async function handleGraphIngest(root, refresh, workdir, projectId) {
  return withDaemon(async (url) => {
    const gc = getGraphClient(url);
    const effectiveRoot = root ?? workdir;
    const result = await gc.ingest(effectiveRoot, {
      refresh,
      expectedProjectId: projectId ?? void 0
    });
    return JSON.stringify({
      ok: true,
      project_id: result.project_id,
      root: result.root,
      state: result.state,
      status: result.status
    });
  }, JSON.stringify({ ok: false, error: "Daemon not available" }));
}
var OpenCodeMemory = async (ctx, options) => {
  const opts = options ?? {};
  const workdir = ctx.worktree ?? ctx.directory ?? process.cwd();
  const projectId = tryResolveProjectId(workdir);
  return {
    "experimental.chat.system.transform": async (_input, output) => {
      try {
        const daemon = await (async () => {
          const now = Date.now();
          if (daemonCache && now - daemonCacheAt < DAEMON_CACHE_TTL_MS) return daemonCache;
          const result = await resolveDaemon();
          if (result.info) {
            daemonCache = { url: result.info.url, features: result.info.features ?? null };
            daemonCacheAt = now;
            return daemonCache;
          }
          daemonCache = null;
          daemonCacheAt = now;
          return null;
        })();
        if (!daemon) {
          const gate = await serverGate();
          if (gate.alert) output.system.push(gate.alert);
          return;
        }
        const sessionId = _input.sessionID ?? "default";
        const cached = recallCache.get(sessionId);
        const injection = buildSystemPromptInjection({
          recallResult: cached ?? null,
          features: daemon.features,
          hasCurationDirective: opts.curationDirective !== false
        });
        if (injection) {
          output.system.push(injection);
        }
      } catch {
      }
    },
    "chat.message": async (input, _output) => {
      try {
        const daemon = await (async () => {
          const now = Date.now();
          if (daemonCache && now - daemonCacheAt < DAEMON_CACHE_TTL_MS) return daemonCache;
          const result = await resolveDaemon();
          if (result.info) {
            daemonCache = { url: result.info.url, features: result.info.features ?? null };
            daemonCacheAt = now;
            return daemonCache;
          }
          daemonCache = null;
          daemonCacheAt = now;
          return null;
        })();
        if (!daemon) return;
        const sessionId = input.sessionID;
        const currentTurn = (turnCount.get(sessionId) ?? 0) + 1;
        turnCount.set(sessionId, currentTurn);
        evictIfNeeded(turnCount, MAX_SESSION_CACHE);
        if (currentTurn > 1 && opts.recall !== false) {
          const text = _output.parts.filter((p) => p.type === "text").map((p) => p.text).join(" ");
          if (text) {
            const client = getClient(daemon.url);
            let graphClient;
            try {
              graphClient = getGraphClient(daemon.url);
            } catch {
            }
            const result = await composeRecall(client, workdir, text, {
              recall: opts.recall,
              maxItems: opts.maxItems,
              minScore: opts.minScore,
              overallDeadlineMs: opts.overallDeadlineMs,
              graphClient,
              graphRoot: workdir
            });
            recallCache.set(sessionId, result);
            evictIfNeeded(recallCache, MAX_SESSION_CACHE);
          }
        }
      } catch {
      }
    },
    event: async ({ event }) => {
      const ev = event;
      if (ev.type === "session.deleted" || ev.type === "server.instance.disposed") {
        const sessionId = ev.sessionID;
        if (sessionId) {
          recallCache.delete(sessionId);
          turnCount.delete(sessionId);
          reviewSessions.delete(sessionId);
        }
      }
      if (ev.type === "session.idle") {
        const sessionId = ev.sessionID;
        if (!sessionId) return;
        if (reviewSessions.has(sessionId)) return;
        const turns = turnCount.get(sessionId) ?? 0;
        const decision = decideReview({
          isReviewSession: reviewSessions.has(sessionId),
          inFlight: curationInFlight.has(sessionId),
          turns,
          lastReviewAt,
          now: Date.now(),
          memoryInterval: 10,
          cooldownMs: 6e5
        });
        if (decision.review) {
          const daemon = await (async () => {
            const now = Date.now();
            if (daemonCache && now - daemonCacheAt < DAEMON_CACHE_TTL_MS) return daemonCache;
            const result = await resolveDaemon();
            if (result.info) {
              daemonCache = { url: result.info.url, features: result.info.features ?? null };
              daemonCacheAt = now;
              return daemonCache;
            }
            daemonCache = null;
            daemonCacheAt = now;
            return null;
          })();
          if (!daemon) return;
          curationInFlight.add(sessionId);
          const sdkSession = ctx?.client?.session;
          const hasRealSession = sdkSession !== null && typeof sdkSession === "object" && typeof sdkSession.messages === "function" && typeof sdkSession.create === "function" && typeof sdkSession.prompt === "function";
          const curationClient = hasRealSession ? { session: sdkSession } : {
            session: {
              messages: async (opts2) => {
                void opts2;
                return [];
              },
              create: async (opts2) => {
                void opts2;
                return { id: `curation-${Date.now()}` };
              },
              prompt: async (opts2) => {
                void opts2;
                return {};
              }
            }
          };
          if (reviewSessions.size >= MAX_SESSION_CACHE) evictIfNeeded(reviewSessions, MAX_SESSION_CACHE);
          void runCuration({
            client: curationClient,
            sessionID: sessionId,
            reviewSessions,
            extractModel,
            CURATOR_SYSTEM,
            buildCurationPrompt
          }).then((res) => {
            const commit = commitReview({ status: res.status, now: Date.now() });
            if (commit.resetTurns) turnCount.set(sessionId, 0);
            if (commit.lastReviewAt !== null) lastReviewAt = commit.lastReviewAt;
            curationInFlight.delete(sessionId);
          }).catch(() => {
            curationInFlight.delete(sessionId);
          });
        }
      }
    },
    tool: {
      memory_status: tool({
        description: "Check memory daemon status, features, and resolved project_id",
        args: {},
        execute: async () => {
          const pid = tryResolveProjectId(workdir);
          const fallbackDaemonNull = JSON.stringify({ ok: true, daemon: null, projectId: pid });
          return withDaemon(async (url, _signal) => {
            void _signal;
            const features = daemonCache?.features ?? null;
            return JSON.stringify({ ok: true, daemon: { url, features }, projectId: pid });
          }, fallbackDaemonNull);
        }
      }),
      memory_search: tool({
        description: "Semantic search across project memory",
        args: { query: z.string(), topK: z.number().optional() },
        execute: async (args) => {
          return withDaemon(async (url) => {
            const client = getClient(url);
            const resp = await client.search(args.query, {
              topK: args.topK ?? 5,
              metadata: projectId ? { project_id: projectId } : void 0
            });
            return JSON.stringify(resp);
          }, JSON.stringify({ results: [], count: 0 }));
        }
      }),
      memory_get: tool({
        description: "Get a memory document by ID",
        args: { id: z.string() },
        execute: async (args) => {
          return withDaemon(async (url) => {
            const client = getClient(url);
            const doc = await client.getDocument(args.id);
            return JSON.stringify(doc);
          }, "null");
        }
      }),
      memory_save: tool({
        description: "Save knowledge or skill to memory",
        args: {
          content: z.string(),
          metadata: z.record(z.string(), z.string()).optional()
        },
        execute: async (args) => {
          return withDaemon(async (url) => {
            const client = getClient(url);
            const doc = await client.save(args.content, {
              ...args.metadata,
              ...projectId ? { project_id: projectId } : {}
            });
            return JSON.stringify({ ok: true, id: doc.id });
          }, JSON.stringify({ ok: false, error: "Daemon not available" }));
        }
      }),
      memory_save_skill: tool({
        description: "Save a skill to the project (validates PT+EN format).",
        args: {
          name: z.string().describe("Skill name (PT, <=64 chars)"),
          description: z.string().describe("Description (PT, <=1024 chars)"),
          body: z.string().describe("Body in English (## What, ## When to use, ## Do, ## Don't)")
        },
        execute: async (args) => {
          const validation = validateSkill(args);
          if (!validation.valid) {
            return JSON.stringify({ ok: false, errors: validation.errors });
          }
          return withDaemon(async (url) => {
            const client = getClient(url);
            const doc = buildSkillDocument(args, {
              source: "curation",
              ...projectId ? { project_id: projectId } : {}
            });
            const flatMeta = {
              type: doc.metadata.type,
              status: doc.metadata.status,
              name: doc.metadata.name,
              description: doc.metadata.description,
              confidence: doc.metadata.confidence,
              source: doc.metadata.source
            };
            if (doc.metadata.project_id) flatMeta.project_id = doc.metadata.project_id;
            if (doc.metadata.tags) flatMeta.tags = JSON.stringify(doc.metadata.tags);
            if (doc.metadata.evidence) flatMeta.evidence = JSON.stringify(doc.metadata.evidence);
            const saved = await client.save(doc.content, flatMeta);
            return JSON.stringify({ ok: true, id: saved.id, warnings: validation.warnings });
          }, JSON.stringify({ ok: false, error: "Daemon not available" }));
        }
      }),
      memory_list_skills: tool({
        description: "List skills in the project (active and candidates).",
        args: {},
        execute: async () => {
          return withDaemon(async (url) => {
            const client = getClient(url);
            const resp = await client.list({
              metadata: projectId ? { project_id: projectId } : void 0
            });
            const skills = resp.data.filter(
              (d) => d.metadata?.type === "skill" || d.metadata?.type === "skill_candidate"
            );
            return JSON.stringify({
              skills: skills.map((s) => ({
                id: s.id,
                name: s.metadata?.name ?? "unknown",
                status: s.metadata?.status ?? "unknown",
                type: s.metadata?.type ?? "unknown"
              })),
              count: skills.length
            });
          }, JSON.stringify({ skills: [], count: 0 }));
        }
      }),
      // ─── Graph Tools (Phase 3) ────────────────────────────────────────────
      graph_status: tool({
        description: "Check semantic code graph status (nodes, edges, hubs). Read-only, does not index.",
        args: { root: z.string().optional().describe("Project root directory") },
        execute: async (args) => {
          return withDaemon(async (url) => {
            const gc = getGraphClient(url);
            const root = args.root ?? workdir;
            const st = await gc.status(root, projectId ?? void 0);
            return JSON.stringify({
              ok: true,
              project_id: st.project_id,
              root: st.root,
              state: st.state,
              nodes: st.nodes,
              edges: st.edges,
              hubs: st.topHubs?.map(fmtNode) ?? [],
              report: st.report,
              hint: st.hint
            });
          }, JSON.stringify({ ok: false, error: "Daemon not available" }));
        }
      }),
      graph_ingest: tool({
        description: "Index the project for semantic graph analysis (async, polls until ready).",
        args: {
          root: z.string().optional().describe("Project root directory"),
          refresh: z.boolean().optional().describe("Force re-index from scratch")
        },
        execute: async (args) => handleGraphIngest(args.root, args.refresh, workdir, projectId)
      }),
      graph_reindex: tool({
        description: "Alias to graph_ingest (compat with TOOLS.md) \u2014 re-index the project graph.",
        args: {
          root: z.string().optional().describe("Project root directory"),
          refresh: z.boolean().optional().describe("Force re-index from scratch")
        },
        execute: async (args) => handleGraphIngest(args.root, args.refresh, workdir, projectId)
      }),
      graph_symbols: tool({
        description: "List graph symbols (hubs by PageRank, or search by name query).",
        args: {
          root: z.string().optional().describe("Project root directory"),
          query: z.string().optional().describe("Search by symbol name"),
          limit: z.number().optional().describe("Max symbols to return")
        },
        execute: async (args) => {
          return withDaemon(async (url) => {
            const gc = getGraphClient(url);
            const root = args.root ?? workdir;
            const result = await gc.symbols(root, {
              query: args.query,
              limit: args.limit,
              expectedProjectId: projectId ?? void 0
            });
            return JSON.stringify({
              ok: true,
              project_id: result.project_id,
              root: result.root,
              state: result.state,
              symbols: result.symbols.map(fmtNode),
              truncated: result.truncated,
              hint: result.hint
            });
          }, JSON.stringify({ ok: false, error: "Daemon not available" }));
        }
      }),
      graph_search: tool({
        description: "Semantic search: seeds + N-hops neighborhood expansion.",
        args: {
          root: z.string().optional().describe("Project root directory"),
          query: z.string().describe("Search query"),
          topK: z.number().optional().describe("Number of seed nodes (1-25)"),
          hops: z.number().optional().describe("Expansion hops (1-2)")
        },
        execute: async (args) => {
          return withDaemon(async (url) => {
            return readGuard(
              getGraphClient(url),
              args.root ?? workdir,
              workdir,
              async (gc, root) => {
                const result = await gc.search(root, {
                  query: args.query,
                  topK: args.topK,
                  hops: args.hops,
                  expectedProjectId: projectId ?? void 0
                });
                return JSON.stringify({
                  ok: true,
                  project_id: result.project_id,
                  root: result.root,
                  state: result.state,
                  query: result.query,
                  seed: result.seed.map(fmtNode),
                  expanded: result.expanded.map(fmtNode),
                  truncated: result.truncated,
                  hint: result.hint
                });
              }
            );
          }, JSON.stringify({ ok: false, error: "Daemon not available" }));
        }
      }),
      graph_callers: tool({
        description: "Who calls a node (inbound CALLS edges).",
        args: {
          root: z.string().optional().describe("Project root directory"),
          id: z.string().describe("Node ID from graph_symbols"),
          limit: z.number().optional().describe("Max callers to return")
        },
        execute: async (args) => {
          return withDaemon(async (url) => {
            return readGuard(
              getGraphClient(url),
              args.root ?? workdir,
              workdir,
              async (gc, root) => {
                const result = await gc.callers(root, {
                  id: args.id,
                  limit: args.limit,
                  expectedProjectId: projectId ?? void 0
                });
                return JSON.stringify({
                  ok: true,
                  project_id: result.project_id,
                  root: result.root,
                  state: result.state,
                  id: result.id,
                  callers: result.callers.map(fmtNode),
                  totalCount: result.totalCount,
                  truncated: result.truncated,
                  hint: result.hint
                });
              }
            );
          }, JSON.stringify({ ok: false, error: "Daemon not available" }));
        }
      }),
      graph_references: tool({
        description: "All references to a node (CALLS + CONTAINS + IMPORTS).",
        args: {
          root: z.string().optional().describe("Project root directory"),
          id: z.string().describe("Node ID from graph_symbols"),
          limit: z.number().optional().describe("Max references to return")
        },
        execute: async (args) => {
          return withDaemon(async (url) => {
            return readGuard(
              getGraphClient(url),
              args.root ?? workdir,
              workdir,
              async (gc, root) => {
                const result = await gc.references(root, {
                  id: args.id,
                  limit: args.limit,
                  expectedProjectId: projectId ?? void 0
                });
                return JSON.stringify({
                  ok: true,
                  project_id: result.project_id,
                  root: result.root,
                  state: result.state,
                  id: result.id,
                  references: result.references.map(fmtNode),
                  totalCount: result.totalCount,
                  truncated: result.truncated,
                  hint: result.hint
                });
              }
            );
          }, JSON.stringify({ ok: false, error: "Daemon not available" }));
        }
      }),
      graph_analyze: tool({
        description: "Full graph analysis: ensureReady + hubs + optional ContextBundle query.",
        args: {
          root: z.string().optional().describe("Project root directory"),
          query: z.string().optional().describe("Optional search query for ContextBundle"),
          refresh: z.boolean().optional().describe("Force re-index")
        },
        execute: async (args) => {
          return withDaemon(async (url) => {
            const gc = getGraphClient(url);
            const root = args.root ?? workdir;
            const result = await gc.ensureReady(root, {
              expectedProjectId: projectId ?? void 0,
              refresh: args.refresh,
              onProgress: (state, nodes) => {
                void state;
                void nodes;
              }
            });
            let contextBundle = null;
            if (result.state === "ready" && args.query) {
              try {
                const searchResult = await gc.search(root, {
                  query: args.query,
                  expectedProjectId: projectId ?? void 0
                });
                contextBundle = {
                  seed: searchResult.seed.map(fmtNode),
                  expanded: searchResult.expanded.map(fmtNode)
                };
              } catch {
              }
            }
            return JSON.stringify({
              ok: true,
              project_id: result.project_id,
              root: result.root,
              state: result.state,
              nodes: result.nodes,
              edges: result.edges,
              hubs: (result.topHubs ?? result.hubs ?? []).map(fmtNode),
              contextBundle,
              timedOut: result.timedOut,
              queued: result.queued,
              retryAfter: result.retryAfter,
              report: result.report,
              hint: result.hint
            });
          }, JSON.stringify({ ok: false, error: "Daemon not available" }));
        }
      }),
      graph_tag_node: tool({
        description: "Tag a graph node with extracted terms. Mode A: explicit id + terms/query. Mode B: expectedName + query.",
        args: {
          root: z.string().optional().describe("Project root directory"),
          id: z.string().optional().describe("Node ID (Mode A)"),
          expectedName: z.string().optional().describe("Expected node name (Mode B)"),
          query: z.string().optional().describe("Query to extract terms from"),
          terms: z.array(z.string()).optional().describe("Explicit terms (Mode A)"),
          source: z.string().optional().describe("Tag source label")
        },
        execute: async (args) => {
          return withDaemon(async (url) => {
            const gc = getGraphClient(url);
            const root = args.root ?? workdir;
            if (args.id) {
              let tagTerms = args.terms;
              if (!tagTerms && args.query) {
                tagTerms = extractTerms(args.query);
              }
              tagTerms = (tagTerms ?? []).filter((t) => t.trim().length > 0);
              if (tagTerms.length < 2) {
                return JSON.stringify({
                  ok: false,
                  error: "Need at least 2 non-empty terms (via explicit terms or query extraction)."
                });
              }
              const tagPhrase = canonicalTag(tagTerms);
              const result = await gc.tags(root, {
                id: args.id,
                terms: [tagPhrase],
                source: args.source ?? "agent",
                expectedProjectId: projectId ?? void 0
              });
              return JSON.stringify({
                ok: true,
                project_id: result.project_id,
                root: result.root,
                state: result.state,
                id: result.id,
                accepted: result.accepted,
                dropped_over_cap: result.dropped_over_cap,
                rejected: result.rejected
              });
            }
            if (args.expectedName && args.query) {
              const result = await tagOnMiss(gc, root, {
                query: args.query,
                expectedName: args.expectedName,
                source: args.source,
                expectedProjectId: projectId ?? void 0
              });
              if (result.error) {
                return JSON.stringify({ ok: false, error: result.reason });
              }
              return JSON.stringify({
                ok: true,
                accepted: result.accepted,
                dropped_over_cap: result.droppedOverCap,
                rejected: result.rejected
              });
            }
            return JSON.stringify({
              ok: false,
              error: "Provide either (id + terms/query) or (expectedName + query)."
            });
          }, JSON.stringify({ ok: false, error: "Daemon not available" }));
        }
      }),
      // ─── Dashboard Tools (Phase 4) ────────────────────────────────────────
      memory_dashboard: tool({
        description: "Open the visual memory dashboard \u2014 daemon status, scope, documents, config.",
        args: {},
        execute: async () => {
          try {
            if (!dashboard) {
              dashboard = new MemoryDashboard({
                cwdProvider: () => workdir,
                provisioner: () => ensureServer()
              });
            }
            const url = await dashboard.startServer();
            return JSON.stringify({ title: "memory-dashboard", output: `Dashboard: ${url}` });
          } catch {
            return JSON.stringify({ title: "memory-dashboard", output: "Dashboard unavailable" });
          }
        }
      }),
      memory_setup: tool({
        description: "Download and start the local memory server (opt-in, one-time setup).",
        args: {},
        execute: async () => {
          try {
            const result = await ensureServer();
            return JSON.stringify({
              title: result.ok ? "memory-setup: ok" : "memory-setup: failed",
              output: result.ok ? `Server ${result.reused ? "already running" : "installed and running"} (v${result.version || "?"})` : `Failed: ${result.reason}`
            });
          } catch {
            return JSON.stringify({ title: "memory-setup: failed", output: "Setup failed unexpectedly" });
          }
        }
      }),
      memory_skill_guide: tool({
        description: "Return the skill authoring guide for creating memory skills.",
        args: {},
        execute: async () => {
          return JSON.stringify({ title: "memory-skill-guide", output: SKILL_GUIDE });
        }
      }),
      memory_ingestion_guide: tool({
        description: "Server-side Ingestion \u2014 quando o daemon indexa automaticamente e como habilitar ingest\xE3o client-side.",
        args: {},
        execute: async () => {
          return JSON.stringify({ title: "memory-ingestion-guide", output: INGESTION_GUIDE });
        }
      })
    }
  };
};
var index_default = OpenCodeMemory;
export {
  OpenCodeMemory,
  index_default as default
};
