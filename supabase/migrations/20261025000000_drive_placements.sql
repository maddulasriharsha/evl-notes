-- Where a Google Drive library file is shown can be changed by the owner/admins without editing code.
-- The file list itself stays in data/drive-library.json; this table only holds the moves.

create table public.drive_placements (
  file_id text primary key check (length(file_id) between 10 and 80),
  subject_code text not null check (subject_code ~ '^[0-9A-Z-]{4,12}$'),
  unit integer not null check (unit between 0 and 7),
  moved_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.drive_placements enable row level security;
create policy drive_placements_read on public.drive_placements for select using (true);
grant select on public.drive_placements to anon, authenticated;

create function public.staff_move_drive_file(p_file text, p_subject text, p_unit integer) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admins only' using errcode = '42501'; end if;
  if p_file is null or length(p_file) not between 10 and 80 then raise exception 'unknown file'; end if;
  if p_unit is null or p_unit < 0 or p_unit > 7 then raise exception 'unknown chapter'; end if;
  if p_subject is null or p_subject !~ '^[0-9A-Z-]{4,12}$' then raise exception 'unknown subject'; end if;
  insert into public.drive_placements (file_id, subject_code, unit, moved_by, updated_at)
  values (p_file, p_subject, p_unit, auth.uid(), now())
  on conflict (file_id) do update
    set subject_code = excluded.subject_code, unit = excluded.unit, moved_by = excluded.moved_by, updated_at = now();
end;
$$;
revoke execute on function public.staff_move_drive_file(text, text, integer) from anon, public;
grant execute on function public.staff_move_drive_file(text, text, integer) to authenticated;
