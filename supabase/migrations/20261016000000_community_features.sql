-- Community features: helpful votes, saved notes, reports, and a "Previous question papers" section.
-- Everything here is additive; nothing existing is changed except the allowed range of collections.unit.

-- ---------------------------------------------------------------------------------------------
-- Question papers: unit 6 is the "Previous question papers" shelf of a subject.
-- ---------------------------------------------------------------------------------------------
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.collections'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%unit%'
  loop
    execute format('alter table public.collections drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.collections
  add constraint collections_unit_check check (unit between 0 and 6);

-- ---------------------------------------------------------------------------------------------
-- Helpful votes: one per person per note, never on your own note. Counts are public.
-- ---------------------------------------------------------------------------------------------
create table public.file_votes (
  file_id    uuid not null references public.files (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (file_id, user_id)
);
create index file_votes_user_idx on public.file_votes (user_id);

alter table public.file_votes enable row level security;
revoke all on public.file_votes from anon, authenticated;
grant select on public.file_votes to anon, authenticated;
grant insert (file_id, user_id) on public.file_votes to authenticated;
grant delete on public.file_votes to authenticated;

create policy votes_read on public.file_votes for select using (true);
create policy votes_insert_own on public.file_votes for insert to authenticated
  with check (
    user_id = auth.uid()
    and not public.is_banned()
    and exists (select 1 from public.files f where f.id = file_id and f.deleted_at is null and f.owner_id <> auth.uid())
  );
create policy votes_delete_own on public.file_votes for delete to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------------------------
-- Saved notes: private to the person who saved them.
-- ---------------------------------------------------------------------------------------------
create table public.bookmarks (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  file_id    uuid not null references public.files (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, file_id)
);
create index bookmarks_user_idx on public.bookmarks (user_id, created_at desc);

alter table public.bookmarks enable row level security;
revoke all on public.bookmarks from anon, authenticated;
grant select, delete on public.bookmarks to authenticated;
grant insert (user_id, file_id) on public.bookmarks to authenticated;

create policy bookmarks_read_own on public.bookmarks for select to authenticated using (user_id = auth.uid());
create policy bookmarks_insert_own on public.bookmarks for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.files f where f.id = file_id and f.deleted_at is null));
create policy bookmarks_delete_own on public.bookmarks for delete to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------------------------------
-- Reports: any signed-in person can flag a note or a comment; staff review them.
-- ---------------------------------------------------------------------------------------------
create table public.reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  file_id     uuid references public.files (id) on delete cascade,
  comment_id  uuid references public.comments (id) on delete cascade,
  reason      text not null check (reason in ('wrong_place', 'low_quality', 'duplicate', 'inappropriate', 'copyright', 'spam', 'other')),
  details     text check (details is null or char_length(details) <= 500),
  created_at  timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles (id),
  check ((file_id is not null)::int + (comment_id is not null)::int = 1)
);
-- A person can have one open report per note / comment.
create unique index reports_open_file_idx on public.reports (reporter_id, file_id) where file_id is not null and resolved_at is null;
create unique index reports_open_comment_idx on public.reports (reporter_id, comment_id) where comment_id is not null and resolved_at is null;
create index reports_open_idx on public.reports (created_at desc) where resolved_at is null;

alter table public.reports enable row level security;
revoke all on public.reports from anon, authenticated;
grant select on public.reports to authenticated;
grant insert (reporter_id, file_id, comment_id, reason, details) on public.reports to authenticated;

create policy reports_read on public.reports for select to authenticated
  using (reporter_id = auth.uid() or public.is_staff());
create policy reports_insert_own on public.reports for insert to authenticated
  with check (reporter_id = auth.uid() and not public.is_banned());

-- Staff close every open report on a note or comment at once (after hiding it, or dismissing).
create function public.resolve_reports(p_file uuid default null, p_comment uuid default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'staff only' using errcode = '42501'; end if;
  update public.reports
     set resolved_at = now(), resolved_by = auth.uid()
   where resolved_at is null
     and ((p_file is not null and file_id = p_file) or (p_comment is not null and comment_id = p_comment));
end;
$$;
revoke execute on function public.resolve_reports(uuid, uuid) from anon, public;
grant execute on function public.resolve_reports(uuid, uuid) to authenticated;
