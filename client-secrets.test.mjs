import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
const root = new URL("..", import.meta.url).pathname;
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? (["tests", "supabase", "node_modules", ".git"].includes(f) ? [] : walk(p)) : [p]; });
const client = walk(root).filter((f) => /\.(js|html|css|webmanifest|svg)$/.test(f));
test("browser files contain no Qwen secret, provider URL, or old Copilot/Microsoft sign-in code", () => {
  assert.ok(client.length >= 5);
  for (const f of client) {
    const s = readFileSync(f, "utf8");
    for (const bad of [/QWEN_API_KEY/, /DASHSCOPE/i, /aliyuncs\.com/i, /\bsk-[A-Za-z0-9]{12,}/, /login\.microsoftonline/i, /graph\.microsoft\.com/i, /Connect Copilot/i, /Sign in with Microsoft/i, /Application \(client\) ID/i, /Microsoft 365 Copilot/i])
      assert.ok(!bad.test(s), `${f} matches ${bad}`);
  }
});
test("server secrets are read only from environment, never hard-coded", () => {
  const s = readFileSync(join(root, "supabase/functions/api/qwen.ts"), "utf8") + readFileSync(join(root, "supabase/functions/api/index.ts"), "utf8");
  assert.ok(!/sk-[A-Za-z0-9]{12,}/.test(s));
  assert.ok(/env\.QWEN_API_KEY/.test(s));
});
test(".env files are git-ignored and examples use placeholders", () => {
  const gi = readFileSync(join(root, ".gitignore"), "utf8"); assert.ok(/^\.env$/m.test(gi) && /supabase\/\.env$/m.test(gi));
  const ex = readFileSync(join(root, "supabase/.env.example"), "utf8"); assert.ok(/QWEN_API_KEY=YOUR_/.test(ex) && !/sk-[A-Za-z0-9]{12,}/.test(ex));
});
