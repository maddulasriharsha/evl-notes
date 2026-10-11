-- Moderator role: day-to-day clean-up without full admin power.
--
--   member     uploads, comments, manages their own notes
--   moderator  + sees and restores hidden notes, hides/restores any file, shelf or comment,
--               blocks and unblocks members. Cannot: delete anything permanently, see emails or
--               the sign-in log, change roles, or act on admins and other moderators.
--   admin      everything, including roles, permanent delete and the dashboard.

-- ---------------------------------------------------------------------------------------------
-- Allow the new value
-- ---------------------------------------------------------------------------------------------
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.profiles'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%role%'
  loop
    execute format('alter table public.profiles drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.profiles
  add constraint profiles_role_check check (role in ('member', 'moderator', 'admin'));

-- ---------------------------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------------------------
create function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('moderator', 'admin'));
$$;

-- ---------------------------------------------------------------------------------------------
-- Staff (admin or moderator) can see hidden shelves, files and comments, and hide / restore them.
-- ---------------------------------------------------------------------------------------------
drop policy collections_read on public.collections;
create policy collections_read on public.collections for select
  using (not hidden or owner_id = auth.uid() or public.is_staff());

drop policy files_read on public.files;
create policy files_read on public.files for select
  using (
    (deleted_at is null and exists (select 1 from public.collections c where c.id = collection_id and not c.hidden))
    or owner_id = auth.uid()
    or public.is_staff()
  );

drop policy files_update_admin on public.files;
create policy files_update_staff on public.files for update to authenticated
  using (public.is_staff()) with check (public.is_staff());

drop policy comments_read on public.comments;
create policy comments_read on public.comments for select
  using (
    (deleted_at is null and exists (select 1 from public.files f where f.id = file_id))
    or author_id = auth.uid()
    or public.is_staff()
  );

drop policy comments_update_own_or_admin on public.comments;
create policy comments_update_own_or_staff on public.comments for update to authenticated
  using (author_id = auth.uid() or public.is_staff())
  with check (author_id = auth.uid() or public.is_staff());

create or replace function public.set_collection_hidden(p_collection uuid, p_hidden boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then
    raise exception 'staff only' using errcode = '42501';
  end if;
  update public.collections set hidden = p_hidden where id = p_collection;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Blocking: moderators can block members, but never staff. Nobody can block themselves.
-- ---------------------------------------------------------------------------------------------
create or replace function public.set_user_banned(p_user uuid, p_banned boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'staff only' using errcode = '42501'; end if;
  if p_user = auth.uid() then raise exception 'you cannot block yourself'; end if;
  if not public.is_admin()
     and exists (select 1 from public.profiles where id = p_user and role in ('moderator', 'admin')) then
    raise exception 'moderators cannot block admins or other moderators' using errcode = '42501';
  end if;
  update public.profiles set banned_at = case when p_banned then now() else null end where id = p_user;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Roles: admin only, now including moderator.
-- ---------------------------------------------------------------------------------------------
create or replace function public.set_user_role(p_user uuid, p_role text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admin only' using errcode = '42501'; end if;
  if p_role not in ('member', 'moderator', 'admin') then raise exception 'unknown role'; end if;
  if p_user = auth.uid() and p_role <> 'admin' then raise exception 'you cannot remove your own admin role'; end if;
  update public.profiles set role = p_role where id = p_user;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- People list for moderators: no emails, no sign-in history.
-- ---------------------------------------------------------------------------------------------
create function public.staff_people()
returns table (id uuid, display_name text, role text, banned_at timestamptz, joined timestamptz, files bigint, comments bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'staff only' using errcode = '42501'; end if;
  return query
    select p.id, p.display_name, p.role, p.banned_at, p.created_at,
           (select count(*) from public.files f where f.owner_id = p.id and f.deleted_at is null),
           (select count(*) from public.comments c where c.author_id = p.id and c.deleted_at is null)
    from public.profiles p
    order by p.created_at desc;
end;
$$;

-- is_staff() is used inside the public read rules, so everyone may call it (it answers "no" for visitors).
revoke execute on function public.staff_people() from anon, public;
grant execute on function public.staff_people() to authenticated;
