// Sends due reminders as Web Push, even when the app is closed. Called every minute by pg_cron.
// Deploy: supabase functions deploy push-due --no-verify-jwt
// Secrets: VAPID_PUBLIC, VAPID_PRIVATE, VAPID_SUBJECT (mailto:you@example.com), CRON_SECRET
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";
webpush.setVapidDetails(Deno.env.get("VAPID_SUBJECT")!, Deno.env.get("VAPID_PUBLIC")!, Deno.env.get("VAPID_PRIVATE")!);
const hm = (s: string) => { const [h, m] = s.split(":").map(Number); return h * 60 + m; };

Deno.serve(async (req) => {
  if (req.headers.get("x-cron-secret") !== Deno.env.get("CRON_SECRET")) return new Response("no", { status: 401 });
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const now = new Date();
  const { data: tasks } = await sb.from("tasks").select("id,user_id,title,data,rem_count,last_rem")
    .eq("status", "open").eq("deleted", false).lte("reminder_at", now.toISOString()).limit(200);
  let sent = 0;
  for (const t of tasks ?? []) {
    const { data: subs } = await sb.from("push_subscriptions").select("*").eq("user_id", t.user_id);
    if (!subs?.length) continue;
    const s = subs[0];
    if (t.rem_count >= s.max_rem) continue;
    if (t.last_rem && now.getTime() - Date.parse(t.last_rem) < 15 * 60000) continue;
    const local = ((now.getUTCHours() * 60 + now.getUTCMinutes()) - s.tz_offset + 1440) % 1440;   // tz_offset = JS getTimezoneOffset()
    const a = hm(s.qs), b = hm(s.qe);
    if (a > b ? (local >= a || local < b) : (local >= a && local < b)) continue;                    // quiet hours
    if (t.data?.afterId) { const { data: p } = await sb.from("tasks").select("status").eq("id", t.data.afterId).maybeSingle(); if (p && p.status !== "done") continue; }
    const step = t.data?.steps?.[0] ?? "Do the first 2 minutes";
    const body = s.priv ? "You have a scheduled reminder." : `${t.title} · ${t.data?.blocker === "big" ? "Don't finish it. Just do the first step: " : "First step: "}${step}`;
    for (const sub of subs) {
      try { await webpush.sendNotification(sub.sub, JSON.stringify({ title: s.priv ? "Nemu" : t.title, body, id: t.id, link: s.priv ? null : (t.data?.link ?? null) })); sent++; }
      catch (e: any) { if (e.statusCode === 404 || e.statusCode === 410) await sb.from("push_subscriptions").delete().eq("endpoint", sub.endpoint); }
    }
    await sb.from("tasks").update({ rem_count: t.rem_count + 1, last_rem: now.toISOString() }).eq("id", t.id);   // does not touch updated_at
  }
  return new Response(JSON.stringify({ sent }), { headers: { "Content-Type": "application/json" } });
});
