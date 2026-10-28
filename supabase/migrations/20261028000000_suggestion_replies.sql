-- ---------------------------------------------------------------------------------------------
-- Private replies on a suggestion: a two-person chat between whoever made the suggestion and the
-- staff (admins and moderators). Nobody else can read it. The author can answer only once staff
-- have written, so the box never turns into a way to message staff out of the blue.
-- ---------------------------------------------------------------------------------------------
alter table public.suggestions add column author_seen_at timestamptz;

create table public.suggestion_replies (
  id            uuid primary key default gen_random_uuid(),
  suggestion_id uuid not null references public.suggestions (id) on delete cascade,
  author_id     uuid not null references public.profiles (id) on delete cascade,
  from_staff    boolean not null default false,
  body          text not null check (char_length(btrim(body)) between 1 and 1000),
  created_at    timestamptz not null default now()
);
create index suggestion_replies_thread_idx on public.suggestion_replies (suggestion_id, created_at);

-- Set by the database, not the client: was the writer staff at the time?
create function public.suggestion_reply_defaults() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.from_staff := public.is_staff();
  return new;
end;
$$;
create trigger suggestion_reply_defaults before insert on public.suggestion_replies
  for each row execute function public.suggestion_reply_defaults();

-- Has staff already written in this thread? (A function, so the policy does not read its own table.)
create function public.suggestion_has_staff_reply(p_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.suggestion_replies where suggestion_id = p_id and from_staff);
$$;

create function public.suggestion_reply_count_today() returns integer
language sql stable security definer set search_path = public as $$
  select count(*)::int from public.suggestion_replies where author_id = auth.uid() and created_at > now() - interval '1 day';
$$;

alter table public.suggestion_replies enable row level security;
revoke all on public.suggestion_replies from anon, authenticated;
grant select on public.suggestion_replies to authenticated;
grant insert (suggestion_id, author_id, body) on public.suggestion_replies to authenticated;

create policy suggestion_replies_read on public.suggestion_replies for select to authenticated
  using (
    public.is_staff()
    or exists (select 1 from public.suggestions s where s.id = suggestion_id and s.author_id = auth.uid())
  );

create policy suggestion_replies_insert on public.suggestion_replies for insert to authenticated
  with check (
    author_id = auth.uid()
    and not public.is_banned()
    and (
      public.is_staff()
      or (
        exists (select 1 from public.suggestions s where s.id = suggestion_id and s.author_id = auth.uid())
        and public.suggestion_has_staff_reply(suggestion_id)
      )
    )
    and public.suggestion_reply_count_today() < 40
  );

-- The author opens the thread: remember it, so "new reply" goes away.
create function public.mark_suggestion_read(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.suggestions set author_seen_at = now() where id = p_id and author_id = auth.uid();
end;
$$;
revoke execute on function public.mark_suggestion_read(uuid) from anon, public;
grant execute on function public.mark_suggestion_read(uuid) to authenticated;
