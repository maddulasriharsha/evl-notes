-- Labels on notes: how they were made ("typed" or "handwritten") and which syllabus they follow
-- ("r25" or "old"). They live in the same tags array as "questions". Nobody writes the column
-- directly; these functions check who is asking.

alter table public.files drop constraint if exists files_tags_check;
alter table public.files
  add constraint files_tags_check check (tags <@ array['questions', 'typed', 'handwritten', 'r25', 'old']::text[]);

-- Typed / handwritten: the person who uploaded the note, or staff. p_style null clears it.
create function public.set_file_style(p_file uuid, p_style text) returns text[]
language plpgsql security definer set search_path = public as $$
declare
  result text[];
begin
  if p_style is not null and p_style not in ('typed', 'handwritten') then raise exception 'unknown style'; end if;
  update public.files f
     set tags = array_remove(array_remove(f.tags, 'typed'), 'handwritten') || case when p_style is null then '{}'::text[] else array[p_style] end
   where f.id = p_file and (f.owner_id = auth.uid() or public.is_staff())
   returning f.tags into result;
  if result is null then raise exception 'not allowed or file not found' using errcode = '42501'; end if;
  return result;
end;
$$;
revoke execute on function public.set_file_style(uuid, text) from anon, public;
grant execute on function public.set_file_style(uuid, text) to authenticated;

-- R25 / old syllabus: staff only. p_edition null clears it.
create function public.staff_set_file_edition(p_file uuid, p_edition text) returns text[]
language plpgsql security definer set search_path = public as $$
declare
  result text[];
begin
  if not public.is_staff() then raise exception 'staff only' using errcode = '42501'; end if;
  if p_edition is not null and p_edition not in ('r25', 'old') then raise exception 'unknown edition'; end if;
  update public.files f
     set tags = array_remove(array_remove(f.tags, 'r25'), 'old') || case when p_edition is null then '{}'::text[] else array[p_edition] end
   where f.id = p_file
   returning f.tags into result;
  if result is null then raise exception 'file not found'; end if;
  return result;
end;
$$;
revoke execute on function public.staff_set_file_edition(uuid, text) from anon, public;
grant execute on function public.staff_set_file_edition(uuid, text) to authenticated;

-- The same two labels for Google Drive library files (admins only, like the other Drive edits).
create table public.drive_labels (
  file_id text primary key check (length(file_id) between 10 and 80),
  style text check (style in ('typed', 'handwritten')),
  edition text check (edition in ('r25', 'old')),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.drive_labels enable row level security;
create policy drive_labels_read on public.drive_labels for select using (true);
grant select on public.drive_labels to anon, authenticated;

create function public.staff_set_drive_labels(p_file text, p_style text, p_edition text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admins only' using errcode = '42501'; end if;
  if p_file is null or length(p_file) not between 10 and 80 then raise exception 'unknown file'; end if;
  if p_style is null and p_edition is null then
    delete from public.drive_labels where file_id = p_file;
  else
    insert into public.drive_labels (file_id, style, edition, updated_by, updated_at)
    values (p_file, p_style, p_edition, auth.uid(), now())
    on conflict (file_id) do update set style = excluded.style, edition = excluded.edition, updated_by = excluded.updated_by, updated_at = now();
  end if;
end;
$$;
revoke execute on function public.staff_set_drive_labels(text, text, text) from anon, public;
grant execute on function public.staff_set_drive_labels(text, text, text) to authenticated;
