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

## Honest limits of this MVP
- Reminders fire while the app is open or recently active. Notifications when the app is fully closed need Web Push (server + VAPID); not included. Android Chrome is the most reliable; iOS needs the app added to Home screen.
- Local storage is localStorage (fine for thousands of tasks); move to IndexedDB later if needed.
- Not yet built (V2/V3 in your spec): routines, calendar, adaptive reminders, analytics, widgets, share-target.
