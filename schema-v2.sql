-- Run AFTER schema.sql. Adds server-side reminders (Web Push).
alter table public.tasks add column if not exists reminder_at timestamptz;
alter table public.tasks add column if not exists rem_count int not null default 0;
alter table public.tasks add column if not exists last_rem timestamptz;
create or replace function public.reset_rem() returns trigger language plpgsql as $$
begin if new.reminder_at is distinct from old.reminder_at then new.rem_count:=0; new.last_rem:=null; end if; return new; end $$;
drop trigger if exists tasks_reset_rem on public.tasks;
create trigger tasks_reset_rem before update on public.tasks for each row execute function public.reset_rem();
create index if not exists tasks_due on public.tasks(reminder_at) where status='open' and deleted=false;

create table if not exists public.push_subscriptions(
  endpoint text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  sub jsonb not null, qs text default '22:00', qe text default '07:00',
  tz_offset int default 0, max_rem int default 2, priv boolean default false,
  created_at timestamptz default now());
alter table public.push_subscriptions enable row level security;
create policy own_push on public.push_subscriptions for all using (user_id=auth.uid()) with check (user_id=auth.uid());

-- Check every minute (Supabase: Database > Extensions: enable pg_cron and pg_net). Replace the 2 placeholders.
create extension if not exists pg_cron; create extension if not exists pg_net;
select cron.schedule('momentum-push','* * * * *', $$
  select net.http_post(url:='https://YOUR-PROJECT.supabase.co/functions/v1/push-due',
    headers:='{"Content-Type":"application/json","x-cron-secret":"YOUR_CRON_SECRET"}'::jsonb) $$);
