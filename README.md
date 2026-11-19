# Nemu (PWA) — Tell it once. Start when it matters.

## What is new in Nemu 2.0
- **Four-field task:** Task, Task Brief, Due, Task Link. Empty fields are hidden, never invented. Links show as “Open link ↗”.
- **One message = one task** (extra sentences become the brief). Clearly separate jobs (“buy petrol, call Mum, submit…”) are offered as several tasks, with **Keep as one** / **Split into N**. Settings > AI can turn this off.
- **Composer on Today:** type naturally, review the preview, **Create task**. Follow-ups work in the preview (“Make that Saturday”, “Add this link: https://…”, “Rename to …”, “No due date”).
- **AI Assistant, powered by Qwen:** the chat box and the message interpreter use a Qwen model through **your own server** (a Supabase Edge Function). Order: Qwen → offline reader. Every AI reply is validated; if AI fails you see “temporarily unavailable” and the offline reader or **Create manually** still works.
- **“Connected ✓” only appears after a real test call succeeds** (Settings > Integrations > AI Assistant > Connect Qwen AI > Test connection). No Microsoft account or licence is involved anywhere.
- **Task details** screen (More: Edit, Reschedule, Duplicate, Delete), Focus shows the brief and link, notifications offer **Open & start** when a link exists.
- **Recurring tasks:** “Every Sunday remind me to…” (daily or weekly; the next one appears when you finish one).
- **Update prompt:** when a new version is deployed you see “Nemu has been updated. Refresh”.
- **GitHub Pages:** every path is relative, so it works under `/your-repo/`. Your existing data is kept (the storage name is unchanged).
- Upload ALL files again (including `sw.js`), then open the app once and press Refresh when asked.

Files: `index.html app.js style.css sw.js manifest.webmanifest icon.svg`, plus `supabase/schema.sql`, `supabase/functions/api/index.ts`, `openapi.yaml`.

## 1. Put the app online (GitHub Pages, same as AnchorWise)
1. New repo `nemu` on GitHub → upload the 6 app files in the repo root (not the supabase folder if you prefer).
2. Settings → Pages → Deploy from branch `main` / root. Open `https://YOUR-NAME.github.io/nemu/`.
3. On your phone: open the link → browser menu → **Add to Home screen**.
It already works fully offline with no backend (tasks live on the device).

## 2. Connect your base (Supabase, free tier)
1. supabase.com → New project. SQL Editor → paste `supabase/schema.sql` → Run.
2. Project Settings → API: copy **Project URL** and **anon key**.
3. In the app: You → Sync and AI → paste both → create account → sign in. Tasks now sync (offline edits queue, conflicts ask you).
   (Authentication → Providers → Email: turn off "Confirm email" while testing.)

## 3. AI Assistant powered by Qwen (optional, server-side)
**What changed:** the old Microsoft 365 Copilot connection (Application ID, Tenant ID, Microsoft sign-in, Graph calls, Copilot licence) is removed. The app no longer stores any Microsoft token, and old Copilot settings left on a device are deleted automatically on the next open.

**How it works:** browser → *your* Supabase function `api` (`/ai/status`, `/ai/test`, `/ai/chat`, `/ai/extract`) → Qwen. The function validates requests and holds the API key as a **server secret**. The browser uses your public Supabase anon key to reach the function, never the Qwen key. A personal Nemu sign-in is not required for AI.

**Prerequisites** (not free: Alibaba Cloud Model Studio bills per use; check current pricing and any free quota for your account and region):
1. An Alibaba Cloud account with Model Studio enabled.
2. An API key created in the Model Studio console (API Key section). Keys are tied to a region, so use the matching base URL.
3. A model name your account can use (default `qwen-plus`; confirm the current list in the console).

**Set it up**
1. Copy `supabase/.env.example` to `supabase/.env` and fill in `QWEN_API_KEY`, `QWEN_BASE_URL`, `QWEN_MODEL`. The example has placeholders only, and `.env` is git-ignored. `QWEN_WORKSPACE_ID` is needed **only** if your base URL contains `{WorkspaceId}`.
2. `supabase secrets set --env-file supabase/.env`
3. `supabase functions deploy api`
4. In production also set `ALLOWED_ORIGIN=https://YOUR-NAME.github.io`.
5. In the app: Settings > Sync (advanced) > sign in. Then Settings > Integrations > AI Assistant > **Connect Qwen AI** > **Test connection**. The status reads Not configured, Configured, Connected ✓ or Connection failed. It never shows a key.

**Run locally:** `npm run serve` (same as `python3 -m http.server 8080`) and open http://localhost:8080. Functions: `supabase functions serve api --env-file supabase/.env`.
**Run the tests:** `npm test` (Node 22.18 or newer, nothing to install).

**Never** commit or share `supabase/.env`, and never paste the key into the app, a screenshot or a chat. If a key leaks, revoke it in the console and create a new one.

**Troubleshooting**
| Message in the app | Likely cause and fix |
|---|---|
| Not configured | Secrets missing, or `QWEN_BASE_URL` invalid (must be https on an `aliyuncs.com` host). Re-run `supabase secrets set` and redeploy. |
| “rejected its credentials” (401/403 from Qwen) | Wrong or revoked key, or the key belongs to a different region than the base URL. |
| “model or endpoint was not found” (404) | Wrong `QWEN_MODEL`, or the base URL path is wrong. It should end in `/compatible-mode/v1`. |
| “busy or a limit was reached” (429) | Provider quota or rate limit, or more than 20 requests a minute from one user. Wait and retry. |
| “took too long” | Slow model or network. Raise `QWEN_TIMEOUT_MS` (max 60000) or pick a faster model. |
| “unexpected reply” | The model returned empty or non-standard output. Retry or try another model. |
| “That message could not be processed” (400) | Some models have extra rules. Try `qwen-plus`. |
| “Supabase connection was rejected” | Check the Supabase Project URL and anon key in Sync and storage (advanced). |

**Decisions you may want to change:** streaming is not used (replies arrive whole, which is simpler and safe). Rate limiting is in memory per function instance; use a table or Redis for strict limits. Chat history lives only in the open chat sheet and is not saved.

## 4. Reminders when the app is closed (Web Push)
1. Make a VAPID key pair (one time, on any computer with Node): `npx web-push generate-vapid-keys`. You get a public and a private key.
2. Supabase SQL Editor: run `supabase/schema-v2.sql` (replace the 2 placeholders at the bottom first; enable `pg_cron` and `pg_net` under Database > Extensions).
3. `supabase secrets set VAPID_PUBLIC=... VAPID_PRIVATE=... VAPID_SUBJECT=mailto:you@example.com CRON_SECRET=<any long random text>`
4. `supabase functions deploy push-due --no-verify-jwt`
5. In the app: You > Reminders when the app is closed > paste the **public** key > Turn on background reminders. Do this on each device.
iPhone: Add to Home Screen first (iOS 16.4+), then open from the Home Screen icon. Android Chrome works directly.

## What is in V2 now
- **Storage:** IndexedDB (existing localStorage data is moved automatically).
- **Routines:** Tasks tab > New routine. One step at a time, optional daily reminder time. Stored on this device (not synced yet).
- **Calendar:** You > Calendar > import an .ics file. Paste & Plan warns when a scheduled time clashes and offers "Schedule after it". Never edits your calendar.
- **Adaptive reminders:** after 3 snoozes it offers "Try 8 PM?" and you decide.
- **What helps me start?:** starts, focus minutes, snoozes, best time, and a suggestion if smaller steps work for you.
- **Share to Nemu:** after installing, share text from WhatsApp/Chrome/etc. and choose Nemu (Android Chrome). iPhone Safari does not support this yet.
- **Shortcuts:** long-press the home-screen icon for "Paste something" and "What's now?".

## Still limited (cannot be fixed inside a PWA)
- **Home-screen widgets:** websites cannot create phone widgets. Shortcuts above are the closest. A real widget needs a native app.
- **Live Google/Outlook calendar sync** needs OAuth with those providers; .ics import is the safe version.
- Repeating calendar events (RRULE) are not expanded; routines are device-only; background push could not be tested from where this was built, so test steps 5.1-5.5 once and tell me any error text.


### Qwen connection fix in this package
- Qwen no longer depends on a Nemu user session.
- The Test connection button becomes available after the Supabase Project URL and anon key are entered.
- Deploy `supabase/functions/api/index.ts` using `supabase functions deploy api --no-verify-jwt`.
- Because the endpoint is public, restrict `ALLOWED_ORIGIN` to your exact GitHub Pages origin and monitor provider usage. For a public multi-user release, add stronger server-side authentication and persistent rate limiting.
