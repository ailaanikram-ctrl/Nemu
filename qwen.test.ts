import { test } from "node:test";
import assert from "node:assert/strict";
import { loadConfig, validateMessages, chat, QwenError, publicInfo } from "../supabase/functions/api/qwen.ts";

const ENV = { QWEN_API_KEY: "sk-TESTSECRET123", QWEN_BASE_URL: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1", QWEN_MODEL: "qwen-plus" };
const cfg = () => loadConfig(ENV);
const reply = (status: number, body: unknown) => (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;
const code = async (p: Promise<unknown>) => { try { await p; return "none"; } catch (e) { return (e as QwenError).code; } };

test("missing server configuration", () => {
  for (const env of [{}, { QWEN_API_KEY: "k" }, { QWEN_BASE_URL: ENV.QWEN_BASE_URL }]) assert.throws(() => loadConfig(env), (e: QwenError) => e.code === "not_configured" && e.status === 503);
});
test("base URL validation (https, Alibaba host, no credentials, workspace template)", () => {
  for (const u of ["http://dashscope-intl.aliyuncs.com/v1", "https://evil.example.com/v1", "https://a:b@dashscope-intl.aliyuncs.com/v1", "https://dashscope-intl.aliyuncs.com/v1?x=1", "not a url"])
    assert.throws(() => loadConfig({ ...ENV, QWEN_BASE_URL: u }), (e: QwenError) => e.code === "not_configured");
  assert.equal(loadConfig({ ...ENV, QWEN_BASE_URL: "https://evil.example.com/v1", QWEN_ALLOW_ANY_HOST: "true" }).baseUrl, "https://evil.example.com/v1");
  const t = "https://{WorkspaceId}.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1";
  assert.throws(() => loadConfig({ ...ENV, QWEN_BASE_URL: t }), (e: QwenError) => e.code === "not_configured");
  assert.equal(loadConfig({ ...ENV, QWEN_BASE_URL: t, QWEN_WORKSPACE_ID: "ws-123" }).baseUrl, "https://ws-123.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1");
  assert.throws(() => loadConfig({ ...ENV, QWEN_MODEL: "bad model;drop" }), (e: QwenError) => e.code === "not_configured");
});
test("empty / malformed messages are rejected", () => {
  for (const m of [[], null, [{ role: "user", content: "   " }], [{ role: "system", content: "x" }], [{ role: "user", content: 5 }], [{ role: "assistant", content: "hi" }], [{ role: "user", content: "x".repeat(4001) }]])
    assert.throws(() => validateMessages(m), (e: QwenError) => e.code === "bad_request" && e.status === 400);
  assert.throws(() => validateMessages(Array.from({ length: 21 }, () => ({ role: "user", content: "a" }))));
  assert.deepEqual(validateMessages([{ role: "user", content: " hi " }]), [{ role: "user", content: "hi" }]);
});
test("successful response parsing + request shape (key only in server header)", async () => {
  let seen: any;
  const f = (async (u: string, o: any) => { seen = { u, o }; return new Response(JSON.stringify({ choices: [{ message: { content: "  Hello!  " } }] })); }) as unknown as typeof fetch;
  const out = await chat(cfg(), [{ role: "user", content: "hi" }], { system: "be brief", fetchImpl: f });
  assert.equal(out, "Hello!");
  assert.equal(seen.u, "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions");
  assert.equal(seen.o.headers.Authorization, "Bearer sk-TESTSECRET123");
  const b = JSON.parse(seen.o.body);
  assert.equal(b.model, "qwen-plus"); assert.deepEqual(b.messages.map((m: any) => m.role), ["system", "user"]);
  assert.ok(!seen.o.body.includes("sk-TESTSECRET123"));
});
test("provider authentication failure", async () => { for (const s of [401, 403]) assert.equal(await code(chat(cfg(), [{ role: "user", content: "x" }], { fetchImpl: reply(s, { error: "bad key sk-TESTSECRET123" }) })), "auth_failed"); });
test("rate limit, missing model, server error", async () => {
  const m = [{ role: "user" as const, content: "x" }];
  assert.equal(await code(chat(cfg(), m, { fetchImpl: reply(429, {}) })), "rate_limited");
  assert.equal(await code(chat(cfg(), m, { fetchImpl: reply(404, {}) })), "model_unavailable");
  assert.equal(await code(chat(cfg(), m, { fetchImpl: reply(503, {}) })), "unavailable");
});
test("timeout / aborted request", async () => {
  const slow = ((_u: string, o: any) => new Promise((_r, rej) => o.signal.addEventListener("abort", () => rej(Object.assign(new Error("x"), { name: "AbortError" }))))) as unknown as typeof fetch;
  const c = { ...cfg(), timeoutMs: 30 };
  try { await chat(c, [{ role: "user", content: "x" }], { fetchImpl: slow }); assert.fail("should time out"); } catch (e) { assert.equal((e as QwenError).code, "timeout"); assert.equal((e as QwenError).status, 504); }
});
test("malformed provider response", async () => {
  const m = [{ role: "user" as const, content: "x" }];
  for (const body of [{}, { choices: [] }, { choices: [{ message: { content: "" } }] }, { choices: [{ message: { content: 5 } }] }]) assert.equal(await code(chat(cfg(), m, { fetchImpl: reply(200, body) })), "bad_response");
  const notJson = (async () => new Response("<html>", { status: 200 })) as unknown as typeof fetch;
  assert.equal(await code(chat(cfg(), m, { fetchImpl: notJson })), "bad_response");
});
test("secret never appears in errors or public info", async () => {
  const leak = reply(401, { message: "invalid key sk-TESTSECRET123", authorization: "Bearer sk-TESTSECRET123" });
  try { await chat(cfg(), [{ role: "user", content: "x" }], { fetchImpl: leak }); } catch (e) { assert.ok(!JSON.stringify({ m: (e as Error).message, c: (e as QwenError).code }).includes("sk-TESTSECRET123")); }
  assert.ok(!JSON.stringify(publicInfo(cfg())).includes("sk-TESTSECRET123"));
});
