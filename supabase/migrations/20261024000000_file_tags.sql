-- Tags on notes. For now one tag exists: "questions", which staff (moderators and admins) put on a
-- note so it also appears in the subject's Question bank, wherever it was uploaded.
-- Nobody can set a tag directly: the column has no insert or update privilege for members.

alter table public.files
  add column tags text[] not null default '{}'
  check (tags <@ array['questions']::text[]);

create index files_tags_idx on public.files using gin (tags);

create function public.staff_set_file_tag(p_file uuid, p_tag text, p_on boolean) returns text[]
language plpgsql security definer set search_path = public as $$
declare
  result text[];
begin
  if not public.is_staff() then raise exception 'staff only' using errcode = '42501'; end if;
  if p_tag is null or p_tag <> 'questions' then raise exception 'unknown tag'; end if;
  update public.files
     set tags = case
       when p_on and not (tags @> array[p_tag]) then array_append(tags, p_tag)
       when not p_on then array_remove(tags, p_tag)
       else tags
     end
   where id = p_file
   returning tags into result;
  if result is null then raise exception 'file not found'; end if;
  return result;
end;
$$;
revoke execute on function public.staff_set_file_tag(uuid, text, boolean) from anon, public;
grant execute on function public.staff_set_file_tag(uuid, text, boolean) to authenticated;
