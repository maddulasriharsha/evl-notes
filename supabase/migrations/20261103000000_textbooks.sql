-- Reference textbooks for each subject. The site lists the book and where to find it (a link the
-- moderator pastes); it never stores the book itself. Staff add and remove entries through these
-- functions; everyone can read the list.

create table public.textbooks (
  id uuid primary key default gen_random_uuid(),
  subject_code text not null check (length(subject_code) between 3 and 30),
  title text not null check (length(title) between 3 and 200),
  authors text check (authors is null or length(authors) <= 200),
  edition text check (edition is null or length(edition) <= 60),
  kind text not null default 'textbook' check (kind in ('textbook', 'reference')),
  link text check (link is null or (link ~ '^https://[^ ]+$' and length(link) <= 500)),
  added_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index textbooks_subject_idx on public.textbooks (subject_code);

alter table public.textbooks enable row level security;
create policy textbooks_read on public.textbooks for select using (true);
grant select on public.textbooks to anon, authenticated;

create function public.staff_add_textbook(p_subject text, p_title text, p_authors text, p_edition text, p_kind text, p_link text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  new_id uuid;
begin
  if not public.is_staff() then raise exception 'staff only' using errcode = '42501'; end if;
  insert into public.textbooks (subject_code, title, authors, edition, kind, link, added_by)
  values (p_subject, btrim(p_title), nullif(btrim(p_authors), ''), nullif(btrim(p_edition), ''), coalesce(p_kind, 'textbook'), nullif(btrim(p_link), ''), auth.uid())
  returning id into new_id;
  return new_id;
end;
$$;
revoke execute on function public.staff_add_textbook(text, text, text, text, text, text) from anon, public;
grant execute on function public.staff_add_textbook(text, text, text, text, text, text) to authenticated;

create function public.staff_remove_textbook(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'staff only' using errcode = '42501'; end if;
  delete from public.textbooks where id = p_id;
end;
$$;
revoke execute on function public.staff_remove_textbook(uuid) from anon, public;
grant execute on function public.staff_remove_textbook(uuid) to authenticated;
