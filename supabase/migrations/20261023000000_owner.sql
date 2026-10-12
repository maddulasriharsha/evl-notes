-- Owner: the one account (identified by its sign-in email) that can do everything.
--
--   owner      everything an admin can, plus: make or remove admins, block or reset admins,
--              delete files forever, run backups. Nobody else can change or block the owner.
--   admin      moderation, people and content management, as before, but not the owner-only items.
--
-- The owner is a normal account whose email appears in public.site_owners. The table cannot be read
-- or changed through the API; it is edited only here, in the SQL editor.

create table if not exists public.site_owners (
  email text primary key check (email = lower(email))
);
alter table public.site_owners enable row level security;
revoke all on public.site_owners from anon, authenticated;

insert into public.site_owners (email) values ('sriharsharmaddula@gmail.com') on conflict do nothing;

-- Is the signed-in person the owner? (They must also still be an admin.)
create or replace function public.is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() and exists (
    select 1
    from auth.users u
    join public.site_owners o on o.email = lower(u.email)
    where u.id = auth.uid()
  );
$$;

-- Is this particular account the owner? (Lets admins be refused when they try to change it.)
create or replace function public.is_owner_account(p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from auth.users u
    join public.site_owners o on o.email = lower(u.email)
    where u.id = p_user
  );
$$;

revoke execute on function public.is_owner() from anon, public;
grant execute on function public.is_owner() to authenticated;
revoke execute on function public.is_owner_account(uuid) from anon, public;
grant execute on function public.is_owner_account(uuid) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Blocking: nobody blocks the owner; only the owner blocks other admins.
-- ---------------------------------------------------------------------------------------------
create or replace function public.set_user_banned(p_user uuid, p_banned boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'staff only' using errcode = '42501'; end if;
  if p_user = auth.uid() then raise exception 'you cannot block yourself'; end if;
  if public.is_owner_account(p_user) then raise exception 'the owner cannot be blocked' using errcode = '42501'; end if;
  if exists (select 1 from public.profiles where id = p_user and role = 'admin') and not public.is_owner() then
    raise exception 'only the owner can block an admin' using errcode = '42501';
  end if;
  if not public.is_admin()
     and exists (select 1 from public.profiles where id = p_user and role in ('moderator', 'admin')) then
    raise exception 'moderators cannot block admins or other moderators' using errcode = '42501';
  end if;
  update public.profiles set banned_at = case when p_banned then now() else null end where id = p_user;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Roles: admins may make moderators and members; making or removing an admin is the owner's.
-- ---------------------------------------------------------------------------------------------
create or replace function public.set_user_role(p_user uuid, p_role text) returns void
language plpgsql security definer set search_path = public as $$
declare
  existing_role text;
begin
  if not public.is_admin() then raise exception 'admin only' using errcode = '42501'; end if;
  if p_role not in ('member', 'moderator', 'admin') then raise exception 'unknown role'; end if;
  if public.is_owner_account(p_user) and p_role <> 'admin' then
    raise exception 'the owner is always an admin' using errcode = '42501';
  end if;
  select role into existing_role from public.profiles where id = p_user;
  if (p_role = 'admin' or existing_role = 'admin') and not public.is_owner() then
    raise exception 'only the owner can make or remove an admin' using errcode = '42501';
  end if;
  if p_user = auth.uid() and p_role <> 'admin' then raise exception 'you cannot remove your own admin role'; end if;
  update public.profiles set role = p_role where id = p_user;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Deleting a file forever: owner only (admins can still hide and restore).
-- ---------------------------------------------------------------------------------------------
create or replace function public.admin_purge_file(p_file uuid) returns text[]
language plpgsql security definer set search_path = public as $$
declare
  paths text[];
begin
  if not public.is_owner() then raise exception 'only the owner can delete forever' using errcode = '42501'; end if;
  select array_remove(array[storage_path, thumb_path, preview_path], null) into paths
    from public.files where id = p_file and deleted_at is not null;
  if paths is null then raise exception 'hide the file before deleting it forever'; end if;
  delete from public.comments where file_id = p_file;
  delete from public.files where id = p_file;
  return paths;
end;
$$;
