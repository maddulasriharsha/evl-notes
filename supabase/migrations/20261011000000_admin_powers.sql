-- Admin powers: block people, moderate single files and comments, permanently delete junk,
-- and manage roles. Members still cannot hard-delete anything.

-- ---------------------------------------------------------------------------------------------
-- Blocking: a blocked person can still read the site but cannot upload or comment.
-- ---------------------------------------------------------------------------------------------
alter table public.profiles add column banned_at timestamptz;

create function public.is_banned() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and banned_at is not null);
$$;

drop policy collections_insert_own on public.collections;
create policy collections_insert_own on public.collections for insert to authenticated
  with check (owner_id = auth.uid() and not public.is_banned());

drop policy files_insert_own on public.files;
create policy files_insert_own on public.files for insert to authenticated
  with check (
    owner_id = auth.uid()
    and deleted_at is null
    and not public.is_banned()
    and exists (select 1 from public.collections c where c.id = collection_id and c.owner_id = auth.uid())
  );

drop policy comments_insert_own on public.comments;
create policy comments_insert_own on public.comments for insert to authenticated
  with check (
    author_id = auth.uid()
    and not public.is_banned()
    and exists (select 1 from public.files f where f.id = file_id and f.deleted_at is null)
  );

drop policy notes_insert_own_folder on storage.objects;
create policy notes_insert_own_folder on storage.objects for insert to authenticated
  with check (bucket_id = 'notes' and (storage.foldername(name))[1] = auth.uid()::text and not public.is_banned());

-- ---------------------------------------------------------------------------------------------
-- Admins can hide, restore and rename anyone's files (soft delete via deleted_at).
-- ---------------------------------------------------------------------------------------------
create policy files_update_admin on public.files for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------------------------
-- Admin-only functions. Each checks is_admin() itself.
-- ---------------------------------------------------------------------------------------------
create function public.set_user_banned(p_user uuid, p_banned boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admin only' using errcode = '42501'; end if;
  if p_user = auth.uid() then raise exception 'you cannot block yourself'; end if;
  update public.profiles set banned_at = case when p_banned then now() else null end where id = p_user;
end;
$$;

create function public.set_user_role(p_user uuid, p_role text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admin only' using errcode = '42501'; end if;
  if p_role not in ('member', 'admin') then raise exception 'unknown role'; end if;
  if p_user = auth.uid() and p_role <> 'admin' then raise exception 'you cannot remove your own admin role'; end if;
  update public.profiles set role = p_role where id = p_user;
end;
$$;

-- Everyone who has signed up, with their email (only admins can call this).
create function public.admin_users()
returns table (id uuid, display_name text, email text, role text, banned_at timestamptz, created_at timestamptz, files bigint, comments bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admin only' using errcode = '42501'; end if;
  return query
    select p.id, p.display_name, u.email::text, p.role, p.banned_at, p.created_at,
           (select count(*) from public.files f where f.owner_id = p.id and f.deleted_at is null),
           (select count(*) from public.comments c where c.author_id = p.id and c.deleted_at is null)
    from public.profiles p join auth.users u on u.id = p.id
    order by p.created_at desc;
end;
$$;

-- Permanently removes a file's database rows (and its comments) and returns the storage paths,
-- which the admin's browser then deletes from the bucket. Only works on files already hidden,
-- so nothing visible can be destroyed by a single mis-click.
create function public.admin_purge_file(p_file uuid) returns text[]
language plpgsql security definer set search_path = public as $$
declare
  paths text[];
begin
  if not public.is_admin() then raise exception 'admin only' using errcode = '42501'; end if;
  select array_remove(array[storage_path, thumb_path, preview_path], null) into paths
    from public.files where id = p_file and deleted_at is not null;
  if paths is null then raise exception 'hide the file before deleting it forever'; end if;
  delete from public.comments where file_id = p_file;
  delete from public.files where id = p_file;
  return paths;
end;
$$;

revoke execute on function public.set_user_banned(uuid, boolean), public.set_user_role(uuid, text),
  public.admin_users(), public.admin_purge_file(uuid) from anon, public;
grant execute on function public.set_user_banned(uuid, boolean), public.set_user_role(uuid, text),
  public.admin_users(), public.admin_purge_file(uuid) to authenticated;

-- Admins may delete objects from the notes bucket (used only after admin_purge_file).
create policy notes_admin_select on storage.objects for select to authenticated
  using (bucket_id = 'notes' and public.is_admin());
create policy notes_admin_delete on storage.objects for delete to authenticated
  using (bucket_id = 'notes' and public.is_admin());
