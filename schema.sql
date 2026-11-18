-- MOMENTUM base (Supabase / PostgreSQL). Run once in Supabase > SQL Editor.
create table if not exists public.tasks(
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  status text not null default 'open',            -- open | waiting | done | cancelled
  deadline timestamptz, scheduled_at timestamptz,
  deleted boolean not null default false,
  updated_at timestamptz not null default now(),
  data jsonb not null default '{}'::jsonb          -- steps, deadlineSource, afterId, cond, people, source (optional)...
);
create index if not exists tasks_user_updated on public.tasks(user_id, updated_at);
create table if not exists public.ai_extractions(
  id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid(),
  original_text text, provider text, model text, structured_output jsonb, user_approved boolean default false, created_at timestamptz default now());
create table if not exists public.focus_sessions(
  id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid(), task_id uuid,
  started_at timestamptz, ended_at timestamptz, completed boolean, interruption_count int default 0);
alter table public.tasks enable row level security;
alter table public.ai_extractions enable row level security;
alter table public.focus_sessions enable row level security;
create policy own_tasks on public.tasks for all using (user_id=auth.uid()) with check (user_id=auth.uid());
create policy own_ai on public.ai_extractions for all using (user_id=auth.uid()) with check (user_id=auth.uid());
create policy own_focus on public.focus_sessions for all using (user_id=auth.uid()) with check (user_id=auth.uid());
