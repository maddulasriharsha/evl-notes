-- ---------------------------------------------------------------------------------------------
-- Star ratings (1 to 5, one per person per note, never on your own note) and a short summary
-- the uploader or staff can write under a note ("what is inside").
-- ---------------------------------------------------------------------------------------------
create table public.file_ratings (
  file_id    uuid not null references public.files (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  stars      smallint not null check (stars between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (file_id, user_id)
);
create index file_ratings_user_idx on public.file_ratings (user_id);

alter table public.file_ratings enable row level security;
revoke all on public.file_ratings from anon, authenticated;
grant select on public.file_ratings to anon, authenticated;
grant insert (file_id, user_id, stars) on public.file_ratings to authenticated;
grant update (stars, updated_at) on public.file_ratings to authenticated;
grant delete on public.file_ratings to authenticated;

create policy ratings_read on public.file_ratings for select using (true);
create policy ratings_insert_own on public.file_ratings for insert to authenticated
  with check (
    user_id = auth.uid()
    and not public.is_banned()
    and exists (select 1 from public.files f where f.id = file_id and f.deleted_at is null and f.owner_id <> auth.uid())
  );
create policy ratings_update_own on public.file_ratings for update to authenticated
  using (user_id = auth.uid() and not public.is_banned()) with check (user_id = auth.uid());
create policy ratings_delete_own on public.file_ratings for delete to authenticated using (user_id = auth.uid());

-- The summary is changed by whoever may already edit the note (its owner, or staff): the existing
-- files update policies decide who, this grant only opens the column.
alter table public.files add column summary text check (summary is null or char_length(summary) <= 300);
grant update (summary) on public.files to authenticated;
