-- The "questions" tag for Google Drive library files: an admin tags a file so it also appears in the
-- subject's Question bank, wherever it is listed (the same as the tag on uploaded notes).
-- The file list itself stays in data/drive-library.json; this table only lists the tagged ones.

create table public.drive_question_tags (
  file_id text primary key check (length(file_id) between 10 and 80),
  tagged_by uuid references auth.users(id) on delete set null,
  tagged_at timestamptz not null default now()
);

alter table public.drive_question_tags enable row level security;
create policy drive_question_tags_read on public.drive_question_tags for select using (true);
grant select on public.drive_question_tags to anon, authenticated;

create function public.staff_tag_drive_file(p_file text, p_on boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admins only' using errcode = '42501'; end if;
  if p_file is null or length(p_file) not between 10 and 80 then raise exception 'unknown file'; end if;
  if p_on then
    insert into public.drive_question_tags (file_id, tagged_by, tagged_at)
    values (p_file, auth.uid(), now())
    on conflict (file_id) do nothing;
  else
    delete from public.drive_question_tags where file_id = p_file;
  end if;
end;
$$;
revoke execute on function public.staff_tag_drive_file(text, boolean) from anon, public;
grant execute on function public.staff_tag_drive_file(text, boolean) to authenticated;
