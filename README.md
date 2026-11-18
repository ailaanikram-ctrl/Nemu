# MOMENTUM (PWA) — setup, step by step
Files: `index.html app.js style.css sw.js manifest.webmanifest icon.svg`, plus `supabase/schema.sql`, `supabase/functions/api/index.ts`, `openapi.yaml`.

## 1. Put the app online (GitHub Pages, same as AnchorWise)
1. New repo `momentum` on GitHub → upload the 6 app files in the repo root (not the supabase folder if you prefer).
2. Settings → Pages → Deploy from branch `main` / root. Open `https://YOUR-NAME.github.io/momentum/`.
3. On your phone: open the link → browser menu → **Add to Home screen**.
It already works fully offline with no backend (tasks live on the device).

## 2. Connect your base (Supabase, free tier)
1. supabase.com → New project. SQL Editor → paste `supabase/schema.sql` → Run.
2. Project Settings → API: copy **Project URL** and **anon key**.
3. In the app: You → Sync and AI → paste both → create account → sign in. Tasks now sync (offline edits queue, conflicts ask you).
   (Authentication → Providers → Email: turn off "Confirm email" while testing.)

## 3. Turn on the AI Inbox brain (optional)
1. Install Supabase CLI. `supabase functions deploy api`
2. `supabase secrets set AI_PROVIDER=anthropic AI_KEY=sk-... AI_MODEL=<model>` (key stays on the server, never in the app).
3. In the app: AI endpoint = `https://YOUR-PROJECT.supabase.co/functions/v1/api/ai/extract`
Without it, the built-in offline reader (English + Malay basics) is used. Other providers: add one adapter in `providers`.

## 4. Copilot extension (direction A: Copilot → MOMENTUM)
`openapi.yaml` describes the actions (createTask, getTodayTasks, getCurrentTask, completeTask, rescheduleTask). Replace YOUR-PROJECT, then build a declarative agent with an API plugin in Microsoft 365 Agents Toolkit. **Verify current Microsoft docs, licensing and OAuth requirements first**: I could not confirm them from here, and they vary by tenant.

## 5. Reminders when the app is closed (Web Push)
1. Make a VAPID key pair (one time, on any computer with Node): `npx web-push generate-vapid-keys`. You get a public and a private key.
2. Supabase SQL Editor: run `supabase/schema-v2.sql` (replace the 2 placeholders at the bottom first; enable `pg_cron` and `pg_net` under Database > Extensions).
3. `supabase secrets set VAPID_PUBLIC=... VAPID_PRIVATE=... VAPID_SUBJECT=mailto:you@example.com CRON_SECRET=<any long random text>`
4. `supabase functions deploy push-due --no-verify-jwt`
5. In the app: You > Reminders when the app is closed > paste the **public** key > Turn on background reminders. Do this on each device.
iPhone: Add to Home Screen first (iOS 16.4+), then open from the Home Screen icon. Android Chrome works directly.

## 6. Microsoft 365 Copilot as the task interpreter (preview)
Uses Microsoft's **Copilot Chat API** (Graph `beta`). Microsoft's docs say beta APIs are not supported for production use, it needs a **work or school account with a Microsoft 365 Copilot licence** (personal Microsoft accounts are not supported), and it returns text only, so MOMENTUM asks Copilot for JSON and validates it before showing the preview.
1. Entra admin center > App registrations > New registration. Account type: your org only (or multi-tenant if you need it).
2. Redirect URI: platform **Single-page application (SPA)**, value = your app URL, e.g. `https://YOUR-NAME.github.io/momentum/` (must match exactly, trailing slash included).
3. API permissions > Microsoft Graph > **Delegated**: `Sites.Read.All, Mail.Read, People.Read.All, OnlineMeetingTranscript.Read.All, Chat.Read, ChannelMessage.Read.All, ExternalItem.Read.All`. Microsoft requires all seven for this API. Then an admin must **Grant admin consent**.
4. Copy the **Application (client) ID** and **Directory (tenant) ID**.
5. App > You > Microsoft 365 Copilot: paste both > Connect Microsoft > sign in > tick "Use Copilot to understand pasted text".
The prompt tells Copilot not to use web search, files, mail or chats, and the pasted text is wrapped as untrusted data. You still approve every task before it is saved. If Copilot fails, the app falls back to the offline reader.
Privacy: when this is on, the text you paste goes to Microsoft 365 Copilot (the sheet says so each time). The seven permissions are broad read access that Microsoft requires for the API itself; MOMENTUM does not read your mail or files.

## What is in V2 now
- **Storage:** IndexedDB (existing localStorage data is moved automatically).
- **Routines:** Tasks tab > New routine. One step at a time, optional daily reminder time. Stored on this device (not synced yet).
- **Calendar:** You > Calendar > import an .ics file. Paste & Plan warns when a scheduled time clashes and offers "Schedule after it". Never edits your calendar.
- **Adaptive reminders:** after 3 snoozes it offers "Try 8 PM?" and you decide.
- **What helps me start?:** starts, focus minutes, snoozes, best time, and a suggestion if smaller steps work for you.
- **Share to MOMENTUM:** after installing, share text from WhatsApp/Chrome/etc. and choose MOMENTUM (Android Chrome). iPhone Safari does not support this yet.
- **Shortcuts:** long-press the home-screen icon for "Paste something" and "What's now?".

## Still limited (cannot be fixed inside a PWA)
- **Home-screen widgets:** websites cannot create phone widgets. Shortcuts above are the closest. A real widget needs a native app.
- **Live Google/Outlook calendar sync** needs OAuth with those providers; .ics import is the safe version.
- Repeating calendar events (RRULE) are not expanded; routines are device-only; background push could not be tested from where this was built, so test steps 5.1-5.5 once and tell me any error text.
