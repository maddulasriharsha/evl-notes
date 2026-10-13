-- A member's branch (the slug used in /b/{branch}, for example "cse-aiml"). Subjects shared by
-- several branches use it to show a student their own branch's notes first and to keep other
-- branches' notes behind a "Notes from other branches" partition. Unknown (null) is always shown.

alter table public.profiles add column branch text
  check (branch is null or branch ~ '^[a-z0-9-]{2,20}$');

-- A member sets their own branch. With p_keep, an existing choice is left alone (used by the
-- uploader, which fills it in from the branch picked for the first upload).
create function public.set_my_branch(p_branch text, p_keep boolean default false) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'sign in first' using errcode = '42501'; end if;
  if p_branch is not null and p_branch !~ '^[a-z0-9-]{2,20}$' then raise exception 'unknown branch'; end if;
  update public.profiles set branch = p_branch
  where id = auth.uid() and (not coalesce(p_keep, false) or branch is null);
end;
$$;
revoke execute on function public.set_my_branch(text, boolean) from anon, public;
grant execute on function public.set_my_branch(text, boolean) to authenticated;

-- Staff can correct the branch shown on someone's notes.
create function public.staff_set_user_branch(p_user uuid, p_branch text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'staff only' using errcode = '42501'; end if;
  if p_branch is not null and p_branch !~ '^[a-z0-9-]{2,20}$' then raise exception 'unknown branch'; end if;
  update public.profiles set branch = p_branch where id = p_user;
  if not found then raise exception 'unknown member'; end if;
end;
$$;
revoke execute on function public.staff_set_user_branch(uuid, text) from anon, public;
grant execute on function public.staff_set_user_branch(uuid, text) to authenticated;
