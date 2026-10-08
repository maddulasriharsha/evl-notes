-- EVL Notes: initial schema.
--
-- Design rules (do not weaken in later migrations):
--   * Nothing a student uploads is ever hard-deleted by the app. "Remove" sets files.deleted_at;
--     the storage object stays. There is no DELETE policy on any table or on storage.objects.
--   * Every write is checked by row-level security against auth.uid().
--   * Migrations are forward-only. Never edit this file after it has been applied; add a new one.


-- ---------------------------------------------------------------------------------------------
-- Profiles: one per signed-in person. display_name is what appears on their notes ("Arjun").
-- ---------------------------------------------------------------------------------------------
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete restrict,
  display_name text not null check (char_length(btrim(display_name)) between 2 and 40),
  role         text not null default 'member' check (role in ('member', 'admin')),
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------------------------
-- Collections: one per person per chapter. Re-uploading to the same chapter adds to the same
-- collection, so a chapter shows "Arjun's notes" once, not a feed of posts.
-- unit = 1..5 for a chapter, 0 for "General / complete notes / lab work".
-- ---------------------------------------------------------------------------------------------
create table public.collections (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references public.profiles (id) on delete restrict,
  subject_code text not null check (subject_code ~ '^[0-9A-Z-]{4,12}$'),
  unit         smallint not null check (unit between 0 and 5),
  description  text check (description is null or char_length(description) <= 500),
  hidden       boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (owner_id, subject_code, unit)
);
create index collections_subject_unit_idx on public.collections (subject_code, unit);
create index collections_updated_idx on public.collections (updated_at desc);

-- ---------------------------------------------------------------------------------------------
-- Files: the uploaded originals (never modified) plus optional derived thumbnail / preview.
-- ---------------------------------------------------------------------------------------------
create table public.files (
  id            uuid primary key,
  collection_id uuid not null references public.collections (id) on delete restrict,
  owner_id      uuid not null references public.profiles (id) on delete restrict,
  storage_path  text not null unique,
  thumb_path    text,
  preview_path  text,
  name          text not null check (char_length(name) between 1 and 200),
  mime          text not null check (mime in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif')),
  size_bytes    bigint not null check (size_bytes > 0 and size_bytes <= 52428800),
  page_count    integer check (page_count is null or page_count > 0),
  width         integer,
  height        integer,
  position      integer not null default 0,
  created_at    timestamptz not null default now(),
  deleted_at    timestamptz,
  -- Every path must live in the owner's own folder: {owner_id}/{collection_id}/{file_id}/...
  check (storage_path like owner_id::text || '/' || collection_id::text || '/' || id::text || '/%'),
  check (thumb_path is null or thumb_path like owner_id::text || '/' || collection_id::text || '/' || id::text || '/%'),
  check (preview_path is null or preview_path like owner_id::text || '/' || collection_id::text || '/' || id::text || '/%')
);
create index files_collection_idx on public.files (collection_id, position);
create index files_created_idx on public.files (created_at desc);

-- ---------------------------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------------------------
create function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- Adding a file marks its collection as updated, so "recently updated" works.
create function public.touch_collection() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.collections set updated_at = now() where id = new.collection_id;
  return new;
end;
$$;
create trigger files_touch_collection after insert on public.files
  for each row execute function public.touch_collection();

-- Owners cannot move a file to another collection or rewrite where its bytes live.
create function public.files_guard_update() returns trigger
language plpgsql as $$
begin
  if new.id <> old.id or new.collection_id <> old.collection_id or new.owner_id <> old.owner_id
     or new.storage_path <> old.storage_path or new.mime <> old.mime or new.size_bytes <> old.size_bytes
     or new.created_at <> old.created_at then
    raise exception 'immutable file columns cannot change';
  end if;
  return new;
end;
$$;
create trigger files_guard_update before update on public.files
  for each row execute function public.files_guard_update();

-- Admin moderation: hide or restore a collection (data is never removed).
create function public.set_collection_hidden(p_collection uuid, p_hidden boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;
  update public.collections set hidden = p_hidden where id = p_collection;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.collections enable row level security;
alter table public.files enable row level security;

-- Column-level privileges: members may only ever change these columns.
revoke all on public.profiles, public.collections, public.files from anon, authenticated;
grant select on public.profiles, public.collections, public.files to anon, authenticated;
grant insert (id, display_name) on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;
grant insert (owner_id, subject_code, unit, description) on public.collections to authenticated;
grant update (description) on public.collections to authenticated;
grant insert (id, collection_id, owner_id, storage_path, thumb_path, preview_path, name, mime, size_bytes, page_count, width, height, position)
  on public.files to authenticated;
grant update (name, position, deleted_at) on public.files to authenticated;
grant execute on function public.set_collection_hidden(uuid, boolean) to authenticated;
revoke execute on function public.set_collection_hidden(uuid, boolean) from anon, public;

-- profiles
create policy profiles_read on public.profiles for select using (true);
create policy profiles_insert_self on public.profiles for insert to authenticated
  with check (id = auth.uid());
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- collections
create policy collections_read on public.collections for select
  using (not hidden or owner_id = auth.uid() or public.is_admin());
create policy collections_insert_own on public.collections for insert to authenticated
  with check (owner_id = auth.uid());
create policy collections_update_own on public.collections for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- files
create policy files_read on public.files for select
  using (
    (deleted_at is null and exists (select 1 from public.collections c where c.id = collection_id and not c.hidden))
    or owner_id = auth.uid()
    or public.is_admin()
  );
create policy files_insert_own on public.files for insert to authenticated
  with check (
    owner_id = auth.uid()
    and deleted_at is null
    and exists (select 1 from public.collections c where c.id = collection_id and c.owner_id = auth.uid())
  );
create policy files_update_own on public.files for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- ---------------------------------------------------------------------------------------------
-- Storage: public-read bucket. Uploads only into your own folder. No update, no delete:
-- once a file is uploaded its bytes can never be overwritten or removed through the API.
-- ---------------------------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('notes', 'notes', true, 52428800,
        array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do nothing;

create policy notes_insert_own_folder on storage.objects for insert to authenticated
  with check (bucket_id = 'notes' and (storage.foldername(name))[1] = auth.uid()::text);
