-- Question bank section (unit 7) and the suggestion box.

-- ---------------------------------------------------------------------------------------------
-- unit 7 = "Question bank" shelf of a subject (next to 6 = "Previous question papers").
-- ---------------------------------------------------------------------------------------------
do $$
declare c record;
begin
  for c in
    select conrelid::regclass as tbl, conname from pg_constraint
    where conrelid in ('public.collections'::regclass, 'public.note_requests'::regclass)
      and contype = 'c' and pg_get_constraintdef(oid) like '%unit%'
  loop
    execute format('alter table %s drop constraint %I', c.tbl, c.conname);
  end loop;
end $$;

alter table public.collections add constraint collections_unit_check check (unit between 0 and 7);
alter table public.note_requests add constraint note_requests_unit_check check (unit between 0 and 7);

-- ---------------------------------------------------------------------------------------------
-- Suggestion box: signed-in people write, staff read and mark them. People see their own.
-- ---------------------------------------------------------------------------------------------
create table public.suggestions (
  id         uuid primary key default gen_random_uuid(),
  author_id  uuid not null references public.profiles (id) on delete cascade,
  category   text not null check (category in ('feature', 'bug', 'content', 'other')),
  body       text not null check (char_length(btrim(body)) between 5 and 1000),
  status     text not null default 'new' check (status in ('new', 'seen', 'done')),
  created_at timestamptz not null default now()
);
create index suggestions_status_idx on public.suggestions (status, created_at desc);
create index suggestions_author_idx on public.suggestions (author_id, created_at desc);

alter table public.suggestions enable row level security;
revoke all on public.suggestions from anon, authenticated;
grant select on public.suggestions to authenticated;
grant insert (author_id, category, body) on public.suggestions to authenticated;
grant update (status) on public.suggestions to authenticated;

create policy suggestions_read on public.suggestions for select to authenticated
  using (author_id = auth.uid() or public.is_staff());

-- At most 10 suggestions per person per day, and not while blocked.
create policy suggestions_insert_own on public.suggestions for insert to authenticated
  with check (
    author_id = auth.uid()
    and not public.is_banned()
    and (select count(*) from public.suggestions s
         where s.author_id = auth.uid() and s.created_at > now() - interval '1 day') < 10
  );

create policy suggestions_update_staff on public.suggestions for update to authenticated
  using (public.is_staff()) with check (public.is_staff());
