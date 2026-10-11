-- Note requests, followed subjects and site announcements. Additive only.

-- ---------------------------------------------------------------------------------------------
-- Note requests: "please upload this chapter". The board is public; closing is for the requester
-- or staff. A request is also treated as answered once someone uploads to that chapter.
-- ---------------------------------------------------------------------------------------------
create table public.note_requests (
  id           uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles (id) on delete cascade,
  subject_code text not null check (subject_code ~ '^[0-9A-Z-]{4,12}$'),
  unit         smallint not null check (unit between 0 and 6),
  message      text check (message is null or char_length(message) <= 200),
  created_at   timestamptz not null default now(),
  closed_at    timestamptz
);
create unique index note_requests_one_open_idx on public.note_requests (requester_id, subject_code, unit) where closed_at is null;
create index note_requests_open_idx on public.note_requests (subject_code, unit) where closed_at is null;

alter table public.note_requests enable row level security;
revoke all on public.note_requests from anon, authenticated;
grant select on public.note_requests to anon, authenticated;
grant insert (requester_id, subject_code, unit, message) on public.note_requests to authenticated;
grant update (closed_at) on public.note_requests to authenticated;

create policy requests_read on public.note_requests for select using (true);
create policy requests_insert_own on public.note_requests for insert to authenticated
  with check (requester_id = auth.uid() and not public.is_banned());
create policy requests_close on public.note_requests for update to authenticated
  using (requester_id = auth.uid() or public.is_staff())
  with check (requester_id = auth.uid() or public.is_staff());

-- ---------------------------------------------------------------------------------------------
-- Followed subjects: private to the person who follows.
-- ---------------------------------------------------------------------------------------------
create table public.follows (
  user_id      uuid not null references public.profiles (id) on delete cascade,
  subject_code text not null check (subject_code ~ '^[0-9A-Z-]{4,12}$'),
  created_at   timestamptz not null default now(),
  primary key (user_id, subject_code)
);

alter table public.follows enable row level security;
revoke all on public.follows from anon, authenticated;
grant select, delete on public.follows to authenticated;
grant insert (user_id, subject_code) on public.follows to authenticated;

create policy follows_read_own on public.follows for select to authenticated using (user_id = auth.uid());
create policy follows_insert_own on public.follows for insert to authenticated with check (user_id = auth.uid());
create policy follows_delete_own on public.follows for delete to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------------------------------
-- Announcements: a one-line banner. Everyone reads active ones; staff post and switch them off.
-- ---------------------------------------------------------------------------------------------
create table public.announcements (
  id         uuid primary key default gen_random_uuid(),
  message    text not null check (char_length(btrim(message)) between 1 and 200),
  link       text check (link is null or link ~ '^(/[^/]|https://[^ ]+$)'),
  active     boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.announcements enable row level security;
revoke all on public.announcements from anon, authenticated;
grant select on public.announcements to anon, authenticated;
grant insert (message, link, created_by) on public.announcements to authenticated;
grant update (active) on public.announcements to authenticated;

create policy announcements_read on public.announcements for select using (active or public.is_staff());
create policy announcements_insert_staff on public.announcements for insert to authenticated
  with check (public.is_staff() and created_by = auth.uid());
create policy announcements_update_staff on public.announcements for update to authenticated
  using (public.is_staff()) with check (public.is_staff());
