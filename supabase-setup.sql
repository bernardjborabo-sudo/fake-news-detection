-- Run this once in your Supabase project's SQL Editor
-- (Dashboard -> SQL Editor -> New query -> paste -> Run)

create table public.history (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
    article jsonb not null,
    credibility numeric not null,
    suspicion numeric not null,
    verdict text not null,
    created_at timestamptz not null default now()
);

alter table public.history enable row level security;

-- A signed-in user can only ever see their own rows
create policy "Users can view their own history"
on public.history for select
using (auth.uid() = user_id);

-- A signed-in user can only ever insert rows tagged with their own id
create policy "Users can insert their own history"
on public.history for insert
with check (auth.uid() = user_id);

-- A signed-in user can only ever delete their own rows
create policy "Users can delete their own history"
on public.history for delete
using (auth.uid() = user_id);
