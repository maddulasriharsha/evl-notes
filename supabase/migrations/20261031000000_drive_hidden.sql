-- Admins can take a Google Drive library file off the site (and put it back) without editing code.
-- The file list itself stays in data/drive-library.json; this table only lists the hidden ones.

create table public.drive_hidden (
  file_id text primary key check (length(file_id) between 10 and 80),
  hidden_by uuid references auth.users(id) on delete set null,
  hidden_at timestamptz not null default now()
);

alter table public.drive_hidden enable row level security;
create policy drive_hidden_read on public.drive_hidden for select using (true);
grant select on public.drive_hidden to anon, authenticated;

create function public.staff_hide_drive_file(p_file text, p_hidden boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admins only' using errcode = '42501'; end if;
  if p_file is null or length(p_file) not between 10 and 80 then raise exception 'unknown file'; end if;
  if p_hidden then
    insert into public.drive_hidden (file_id, hidden_by, hidden_at)
    values (p_file, auth.uid(), now())
    on conflict (file_id) do update set hidden_by = excluded.hidden_by, hidden_at = now();
  else
    delete from public.drive_hidden where file_id = p_file;
  end if;
end;
$$;
revoke execute on function public.staff_hide_drive_file(text, boolean) from anon, public;
grant execute on function public.staff_hide_drive_file(text, boolean) to authenticated;
