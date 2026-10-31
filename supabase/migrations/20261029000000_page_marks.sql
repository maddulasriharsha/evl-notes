-- ---------------------------------------------------------------------------------------------
-- Reading tools inside the viewer:
--   page_marks       a private bookmark on one page, or a public flag ("formula on this page is
--                    outdated") that everyone reading the note can see until staff resolve it.
--   reading_progress where a signed-in person stopped in a note, so any device can resume there.
-- ---------------------------------------------------------------------------------------------
create table public.page_marks (
  id          uuid primary key default gen_random_uuid(),
  file_id     uuid not null references public.files (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  page        integer not null check (page between 1 and 2000),
  kind        text not null check (kind in ('bookmark', 'flag')),
  note        text check (note is null or char_length(btrim(note)) between 1 and 200),
  created_at  timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles (id),
  check (kind <> 'flag' or note is not null)
);
create unique index page_marks_bookmark_idx on public.page_marks (user_id, file_id, page) where kind = 'bookmark';
create index page_marks_file_idx on public.page_marks (file_id, page);
create index page_marks_user_idx on public.page_marks (user_id, created_at desc);

alter table public.page_marks enable row level security;
revoke all on public.page_marks from anon, authenticated;
grant select on public.page_marks to anon, authenticated;
grant insert (file_id, user_id, page, kind, note) on public.page_marks to authenticated;
grant delete on public.page_marks to authenticated;

-- Flags are community notes anyone can read; bookmarks are private to their owner.
create policy page_marks_read on public.page_marks for select
  using ((kind = 'flag' and resolved_at is null) or user_id = auth.uid() or public.is_staff());
create policy page_marks_insert on public.page_marks for insert to authenticated
  with check (
    user_id = auth.uid()
    and not public.is_banned()
    and exists (select 1 from public.files f where f.id = file_id and f.deleted_at is null)
    and (kind = 'bookmark' or (select count(*) from public.page_marks m where m.user_id = auth.uid() and m.kind = 'flag' and m.created_at > now() - interval '1 day') < 20)
  );
create policy page_marks_delete on public.page_marks for delete to authenticated
  using (user_id = auth.uid() or public.is_staff());

-- Staff mark a flag as dealt with (the note was fixed or the flag was wrong).
create function public.staff_resolve_page_flag(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'staff only' using errcode = '42501'; end if;
  update public.page_marks set resolved_at = now(), resolved_by = auth.uid()
   where id = p_id and kind = 'flag' and resolved_at is null;
end;
$$;
revoke execute on function public.staff_resolve_page_flag(uuid) from anon, public;
grant execute on function public.staff_resolve_page_flag(uuid) to authenticated;

-- ---------------------------------------------------------------------------------------------
create table public.reading_progress (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  file_id    uuid not null references public.files (id) on delete cascade,
  page       integer not null check (page between 1 and 2000),
  pages      integer not null check (pages between 1 and 2000),
  updated_at timestamptz not null default now(),
  primary key (user_id, file_id)
);
create index reading_progress_user_idx on public.reading_progress (user_id, updated_at desc);

alter table public.reading_progress enable row level security;
revoke all on public.reading_progress from anon, authenticated;
grant select, delete on public.reading_progress to authenticated;
grant insert (user_id, file_id, page, pages, updated_at) on public.reading_progress to authenticated;
grant update (page, pages, updated_at) on public.reading_progress to authenticated;

create policy reading_progress_own_read on public.reading_progress for select to authenticated using (user_id = auth.uid());
create policy reading_progress_own_insert on public.reading_progress for insert to authenticated with check (user_id = auth.uid());
create policy reading_progress_own_update on public.reading_progress for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy reading_progress_own_delete on public.reading_progress for delete to authenticated using (user_id = auth.uid());
