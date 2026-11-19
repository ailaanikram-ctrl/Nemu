// Qwen provider (OpenAI-compatible chat/completions on Alibaba Cloud Model Studio).
// Server-side only. Portable: no Deno globals, so it runs in Supabase Edge Functions (Deno) and in Node tests.
// Responsibilities: config validation, request construction, auth header, timeout, response parsing, normalized errors.

export class QwenError extends Error {
  code: string; status: number;
  constructor(code: string, status: number) { super(FRIENDLY[code] ?? FRIENDLY.unavailable); this.code = code; this.status = status; }
}
// Messages safe to show in the UI. Provider response bodies are never forwarded.
const FRIENDLY: Record<string, string> = {
  not_configured: "The AI service is not configured yet. Ask the administrator to set it up.",
  auth_failed: "The AI service rejected its credentials. Ask the administrator to check the API key.",
  rate_limited: "The AI service is busy or a limit was reached. Try again in a moment.",
  timeout: "The AI service took too long to answer. Try again.",
  model_unavailable: "The configured AI model or endpoint was not found. Ask the administrator to check the model name and base URL.",
  bad_response: "The AI service sent an unexpected reply. Try again.",
  bad_request: "That message could not be processed.",
  unavailable: "The AI service is temporarily unavailable. Try again.",
};

export interface QwenConfig { apiKey: string; baseUrl: string; model: string; temperature: number; maxTokens: number; timeoutMs: number }
type Env = Record<string, string | undefined>;
const num = (v: string | undefined, d: number, lo: number, hi: number) => { const n = Number(v); return v && Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };

export function loadConfig(env: Env): QwenConfig {
  const fail = () => new QwenError("not_configured", 503);
  const apiKey = (env.QWEN_API_KEY ?? "").trim();
  let base = (env.QWEN_BASE_URL ?? "").trim();
  if (!apiKey || !base) throw fail();
  // Newer Model Studio endpoints carry the workspace in the host: https://{WorkspaceId}.<region>.maas.aliyuncs.com/compatible-mode/v1
  if (base.includes("{WorkspaceId}")) {
    const ws = (env.QWEN_WORKSPACE_ID ?? "").trim();
    if (!/^[A-Za-z0-9-]{1,64}$/.test(ws)) throw fail();
    base = base.replace("{WorkspaceId}", ws);
  }
  let u: URL; try { u = new URL(base); } catch { throw fail(); }
  if (u.protocol !== "https:" || u.username || u.password || u.search || u.hash) throw fail();
  // SSRF guard: the URL comes only from server env, and must be an Alibaba Cloud host unless explicitly overridden.
  if (env.QWEN_ALLOW_ANY_HOST !== "true" && !/(^|\.)aliyuncs\.com$/i.test(u.hostname)) throw fail();
  const model = (env.QWEN_MODEL ?? "qwen-plus").trim();
  if (!/^[A-Za-z0-9._:-]{1,64}$/.test(model)) throw fail();
  return { apiKey, baseUrl: u.origin + u.pathname.replace(/\/+$/, ""), model,
    temperature: num(env.QWEN_TEMPERATURE, 0.3, 0, 1.5), maxTokens: num(env.QWEN_MAX_TOKENS, 800, 1, 4096), timeoutMs: num(env.QWEN_TIMEOUT_MS, 30000, 1000, 60000) };
}
export const publicInfo = (c: QwenConfig) => ({ model: c.model, host: new URL(c.baseUrl).hostname.replace(/^[^.]+\.(?=.*maas\.)/, "") }); // never includes the key

export interface Msg { role: "user" | "assistant"; content: string }
export function validateMessages(raw: unknown): Msg[] {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > 20) throw new QwenError("bad_request", 400);
  let total = 0;
  const out = raw.map((m: any) => {
    if (!m || (m.role !== "user" && m.role !== "assistant") || typeof m.content !== "string") throw new QwenError("bad_request", 400);
    const content = m.content.trim(); total += content.length;
    if (!content || content.length > 4000) throw new QwenError("bad_request", 400);
    return { role: m.role as "user" | "assistant", content };
  });
  if (total > 16000 || out[out.length - 1].role !== "user") throw new QwenError("bad_request", 400);
  return out;
}

export async function chat(cfg: QwenConfig, messages: Msg[], opts: { system?: string; maxTokens?: number; fetchImpl?: typeof fetch } = {}): Promise<string> {
  const f = opts.fetchImpl ?? fetch;
  const body = { model: cfg.model, temperature: cfg.temperature, max_tokens: opts.maxTokens ?? cfg.maxTokens,
    messages: [...(opts.system ? [{ role: "system", content: opts.system }] : []), ...messages] };
  const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), cfg.timeoutMs);
  let res: Response;
  try {
    res = await f(cfg.baseUrl + "/chat/completions", { method: "POST", signal: ctl.signal,
      headers: { Authorization: "Bearer " + cfg.apiKey, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  } catch (e: any) { throw new QwenError(e?.name === "AbortError" ? "timeout" : "unavailable", e?.name === "AbortError" ? 504 : 502); }
  finally { clearTimeout(timer); }
  if (!res.ok) { // status only: the provider body is never read or forwarded
    const s = res.status;
    throw s === 401 || s === 403 ? new QwenError("auth_failed", 502) : s === 404 ? new QwenError("model_unavailable", 502)
      : s === 429 ? new QwenError("rate_limited", 429) : s === 400 ? new QwenError("bad_request", 502) : new QwenError("unavailable", 502);
  }
  let j: any; try { j = await res.json(); } catch { throw new QwenError("bad_response", 502); }
  const text = j?.choices?.[0]?.message?.content;
  if (typeof text !== "string" || !text.trim()) throw new QwenError("bad_response", 502);
  return text.trim();
}
