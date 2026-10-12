-- Staff (moderators and admins) can move a note to another subject or chapter.
--
-- A note belongs to its owner's shelf for one subject + chapter (a "collection"). Moving it means
-- pointing it at the owner's shelf for the new place (created on demand). The bytes stay where they
-- are in Storage, so the rule that a stored path starts with {owner}/{collection}/{file} is relaxed
-- to "starts with the owner's folder", which is all the Storage policies ever relied on.

-- 1. Paths only have to live in the owner's own folder.
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.files'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%collection_id%'
  loop
    execute format('alter table public.files drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.files add constraint files_paths_in_owner_folder check (
  (storage_path is null or storage_path like owner_id::text || '/%')
  and (thumb_path is null or thumb_path like owner_id::text || '/%')
  and (preview_path is null or preview_path like owner_id::text || '/%')
);

-- 2. The collection can change, but only from inside staff_move_file().
create or replace function public.files_guard_update() returns trigger
language plpgsql as $$
begin
  if new.id <> old.id or new.owner_id <> old.owner_id
     or new.storage_path is distinct from old.storage_path or new.mime <> old.mime
     or new.size_bytes is distinct from old.size_bytes or new.created_at <> old.created_at then
    raise exception 'immutable file columns cannot change';
  end if;
  if new.collection_id <> old.collection_id and coalesce(current_setting('vj.moving_file', true), '') <> 'on' then
    raise exception 'immutable file columns cannot change';
  end if;
  return new;
end;
$$;

-- 3. The move itself.
create function public.staff_move_file(p_file uuid, p_subject text, p_unit integer) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  f record;
  target uuid;
begin
  if not public.is_staff() then raise exception 'staff only' using errcode = '42501'; end if;
  if p_unit is null or p_unit < 0 or p_unit > 7 then raise exception 'unknown chapter'; end if;
  if p_subject is null or p_subject !~ '^[0-9A-Z-]{4,12}$' then raise exception 'unknown subject'; end if;

  select id, owner_id, collection_id into f from public.files where id = p_file;
  if not found then raise exception 'file not found'; end if;

  -- Moderators can only move ordinary members' notes; admins can move anything.
  if not public.is_admin()
     and exists (select 1 from public.profiles where id = f.owner_id and role <> 'member') then
    raise exception 'moderators can only move members'' notes' using errcode = '42501';
  end if;

  select id into target from public.collections
   where owner_id = f.owner_id and subject_code = p_subject and unit = p_unit;
  if target is null then
    insert into public.collections (owner_id, subject_code, unit)
    values (f.owner_id, p_subject, p_unit)
    returning id into target;
  end if;
  if target = f.collection_id then return target; end if;

  perform set_config('vj.moving_file', 'on', true);
  update public.files
     set collection_id = target,
         position = coalesce((select max(position) + 1 from public.files where collection_id = target), 0)
   where id = p_file;
  perform set_config('vj.moving_file', 'off', true);

  update public.collections set updated_at = now() where id in (target, f.collection_id);
  return target;
end;
$$;
revoke execute on function public.staff_move_file(uuid, text, integer) from anon, public;
grant execute on function public.staff_move_file(uuid, text, integer) to authenticated;
