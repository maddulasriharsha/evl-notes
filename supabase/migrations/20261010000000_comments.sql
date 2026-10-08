-- Comments on uploaded files. Anyone can read them; only signed-in people can write.
-- Like everything else, comments are never hard-deleted: "Delete" sets deleted_at.

create table public.comments (
  id         uuid primary key default gen_random_uuid(),
  file_id    uuid not null references public.files (id) on delete restrict,
  author_id  uuid not null references public.profiles (id) on delete restrict,
  body       text not null check (char_length(btrim(body)) between 1 and 1000),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index comments_file_idx on public.comments (file_id, created_at);

alter table public.comments enable row level security;

revoke all on public.comments from anon, authenticated;
grant select on public.comments to anon, authenticated;
grant insert (file_id, author_id, body) on public.comments to authenticated;
grant update (deleted_at) on public.comments to authenticated;

-- Visible while not deleted and while the file itself is visible (files RLS applies here).
create policy comments_read on public.comments for select
  using (
    (deleted_at is null and exists (select 1 from public.files f where f.id = file_id))
    or author_id = auth.uid()
    or public.is_admin()
  );

-- You can comment as yourself, on a file you can see, only if you have a profile.
create policy comments_insert_own on public.comments for insert to authenticated
  with check (
    author_id = auth.uid()
    and exists (select 1 from public.files f where f.id = file_id and f.deleted_at is null)
  );

-- Authors can remove their own comments; admins can remove any.
create policy comments_update_own_or_admin on public.comments for update to authenticated
  using (author_id = auth.uid() or public.is_admin())
  with check (author_id = auth.uid() or public.is_admin());
