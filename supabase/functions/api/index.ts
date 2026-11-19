const cors = (origin: string) => ({
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Vary": "Origin",
});

const json = (body: unknown, status = 200, origin = "*") => new Response(JSON.stringify(body), {
  status,
  headers: { ...cors(origin), "Content-Type": "application/json", "Cache-Control": "no-store" },
});

const error = (code: string, message: string, status: number, origin: string) =>
  json({ error: { code, message } }, status, origin);

const allowedOrigin = Deno.env.get("ALLOWED_ORIGIN") || "*";
const apiKey = Deno.env.get("QWEN_API_KEY") || "";
const baseUrl = (Deno.env.get("QWEN_BASE_URL") || "").replace(/\/$/, "");
const model = Deno.env.get("QWEN_MODEL") || "qwen-plus";
const timeoutMs = Math.min(60000, Math.max(5000, Number(Deno.env.get("QWEN_TIMEOUT_MS") || 45000)));

function originFor(req: Request) {
  const incoming = req.headers.get("origin") || "";
  if (allowedOrigin === "*") return "*";
  return incoming === allowedOrigin ? incoming : "";
}

function configured() {
  try {
    const u = new URL(baseUrl);
    return Boolean(apiKey && u.protocol === "https:" && u.hostname.endsWith("aliyuncs.com"));
  } catch { return false; }
}

async function body(req: Request) {
  const n = Number(req.headers.get("content-length") || 0);
  if (n > 100000) throw new Error("too_large");
  return await req.json();
}

async function qwen(messages: Array<{role:string, content:string}>, temperature = 0.3) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const r = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages, temperature }),
      signal: controller.signal,
    });
    const text = await r.text();
    let data: any = null;
    try { data = JSON.parse(text); } catch {}
    if (!r.ok) {
      const code = r.status === 401 || r.status === 403 ? "auth_failed" : r.status === 404 ? "model_unavailable" : r.status === 429 ? "rate_limited" : "unavailable";
      const msg = code === "auth_failed" ? "Qwen rejected the configured credentials." : code === "model_unavailable" ? "The Qwen model or endpoint was not found." : code === "rate_limited" ? "Qwen is busy or a usage limit was reached." : "Qwen is temporarily unavailable.";
      throw Object.assign(new Error(msg), { code, status: r.status === 429 ? 429 : 502 });
    }
    const reply = data?.choices?.[0]?.message?.content;
    if (typeof reply !== "string" || !reply.trim()) throw Object.assign(new Error("Qwen returned an unexpected reply."), { code: "bad_response", status: 502 });
    return reply.trim();
  } catch (e: any) {
    if (e?.name === "AbortError") throw Object.assign(new Error("The Qwen request took too long."), { code: "timeout", status: 504 });
    throw e;
  } finally { clearTimeout(timer); }
}

Deno.serve(async (req) => {
  const origin = originFor(req);
  if (!origin) return new Response("Forbidden", { status: 403 });
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });
  const path = new URL(req.url).pathname.replace(/^.*\/functions\/v1\/api/, "");
  if (path === "/ai/status" && req.method === "GET") {
    let host = ""; try { host = new URL(baseUrl).hostname; } catch {}
    return json({ configured: configured(), model: configured() ? model : "", host }, 200, origin);
  }
  if (!configured()) return error("not_configured", "Qwen is not configured on the server.", 503, origin);
  try {
    if (path === "/ai/test" && req.method === "POST") {
      await qwen([{ role: "user", content: "Reply with exactly: OK" }], 0);
      return json({ ok: true, model }, 200, origin);
    }
    if (path === "/ai/chat" && req.method === "POST") {
      const input = await body(req);
      if (!Array.isArray(input.messages) || input.messages.length < 1 || input.messages.length > 30) return error("bad_request", "Messages are invalid.", 400, origin);
      const messages = input.messages.map((m: any) => ({ role: m?.role, content: String(m?.content || "").slice(0, 8000) }));
      if (messages.some((m: any) => !["system","user","assistant"].includes(m.role) || !m.content.trim())) return error("bad_request", "Messages are invalid.", 400, origin);
      return json({ reply: await qwen(messages) }, 200, origin);
    }
    if (path === "/ai/extract" && req.method === "POST") {
      const input = await body(req);
      const text = String(input?.text || "").trim().slice(0, 8000);
      if (!text) return error("bad_request", "Text is required.", 400, origin);
      const system = `Return JSON only. Interpret the user's text for a task app. Schema: {"interpretation":"single_task"|"multiple_tasks","task":{"task":"","taskBrief":null,"due":null,"taskLink":null,"recurrence":null},"tasks":[],"confidence":{"task":0.9,"due":0.9}}. For multiple_tasks, put task objects in tasks. Task max 120 chars, brief max 240. due must be ISO 8601 or null. Never invent a link or due date.`;
      const raw = await qwen([{ role: "system", content: system }, { role: "user", content: text }], 0.1);
      let parsed: any; try { parsed = JSON.parse(raw.replace(/^```json\s*|\s*```$/g, "")); } catch { return error("bad_response", "Qwen returned an unexpected task format.", 502, origin); }
      return json(parsed, 200, origin);
    }
    return error("not_found", "Endpoint not found.", 404, origin);
  } catch (e: any) {
    return error(e?.code || "unavailable", e?.message || "The AI Assistant is unavailable.", e?.status || 502, origin);
  }
});
