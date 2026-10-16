-- Admins can retitle a file from the Google Drive library (for example to mark a paper "Mid 1 2025").
-- The site files papers under Mid or Sem PYQs by reading the title, so this is how a Drive paper is moved.
create table public.drive_titles (
  file_id text primary key check (length(file_id) between 10 and 80),
  title text not null check (length(title) between 1 and 200),
  set_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.drive_titles enable row level security;
create policy drive_titles_read on public.drive_titles for select using (true);
grant select on public.drive_titles to anon, authenticated;

create function public.staff_rename_drive_file(p_file text, p_title text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admins only' using errcode = '42501'; end if;
  if p_file is null or length(p_file) not between 10 and 80 then raise exception 'unknown file'; end if;
  if p_title is null or length(btrim(p_title)) not between 1 and 200 then raise exception 'title must be 1 to 200 characters'; end if;
  insert into public.drive_titles (file_id, title, set_by, updated_at)
  values (p_file, btrim(p_title), auth.uid(), now())
  on conflict (file_id) do update set title = excluded.title, set_by = excluded.set_by, updated_at = now();
end;
$$;
revoke execute on function public.staff_rename_drive_file(text, text) from anon, public;
grant execute on function public.staff_rename_drive_file(text, text) to authenticated;
