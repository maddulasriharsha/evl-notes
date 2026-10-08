-- Admin dashboard: sign-in history and contribution statistics.

-- ---------------------------------------------------------------------------------------------
-- Sign-in events. Written only through record_login(); readable only through admin functions.
-- ---------------------------------------------------------------------------------------------
create table public.login_events (
  id      bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  method  text not null check (method in ('password', 'google', 'email')),
  device  text not null check (device in ('mobile', 'tablet', 'desktop')),
  at      timestamptz not null default now()
);
create index login_events_user_idx on public.login_events (user_id, at desc);
create index login_events_at_idx on public.login_events (at desc);

alter table public.login_events enable row level security;
revoke all on public.login_events from anon, authenticated;

-- Called by the site right after a successful sign-in. Repeats within a minute are ignored.
create function public.record_login(p_method text, p_device text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  if exists (select 1 from public.login_events where user_id = auth.uid() and at > now() - interval '1 minute') then
    return;
  end if;
  insert into public.login_events (user_id, method, device)
  values (
    auth.uid(),
    case when p_method in ('password', 'google', 'email') then p_method else 'email' end,
    case when p_device in ('mobile', 'tablet', 'desktop') then p_device else 'desktop' end
  );
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Admin statistics
-- ---------------------------------------------------------------------------------------------
create function public.admin_overview() returns json
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admin only' using errcode = '42501'; end if;
  return json_build_object(
    'members',          (select count(*) from public.profiles),
    'members_7d',       (select count(*) from public.profiles where created_at > now() - interval '7 days'),
    'active_7d',        (select count(distinct user_id) from public.login_events where at > now() - interval '7 days'),
    'signins_7d',       (select count(*) from public.login_events where at > now() - interval '7 days'),
    'files',            (select count(*) from public.files where deleted_at is null),
    'files_7d',         (select count(*) from public.files where deleted_at is null and created_at > now() - interval '7 days'),
    'pages',            (select coalesce(sum(page_count), 0) from public.files where deleted_at is null),
    'storage_bytes',    (select coalesce(sum(size_bytes), 0) from public.files),
    'hidden_files',     (select count(*) from public.files where deleted_at is not null),
    'comments',         (select count(*) from public.comments where deleted_at is null),
    'comments_7d',      (select count(*) from public.comments where deleted_at is null and created_at > now() - interval '7 days'),
    'contributors',     (select count(distinct owner_id) from public.files where deleted_at is null),
    'blocked',          (select count(*) from public.profiles where banned_at is not null),
    'chapters_covered', (select count(distinct (c.subject_code, c.unit)) from public.collections c
                          where exists (select 1 from public.files f where f.collection_id = c.id and f.deleted_at is null))
  );
end;
$$;

-- Activity per day for the last p_days days (India time), oldest first.
create function public.admin_daily(p_days integer default 30)
returns table (day date, uploads bigint, signins bigint, comments bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admin only' using errcode = '42501'; end if;
  return query
    with days as (
      select generate_series((now() at time zone 'Asia/Kolkata')::date - (least(greatest(p_days, 1), 365) - 1),
                             (now() at time zone 'Asia/Kolkata')::date, interval '1 day')::date as d
    )
    select d,
      (select count(*) from public.files f where (f.created_at at time zone 'Asia/Kolkata')::date = d),
      (select count(*) from public.login_events l where (l.at at time zone 'Asia/Kolkata')::date = d),
      (select count(*) from public.comments c where (c.created_at at time zone 'Asia/Kolkata')::date = d)
    from days order by d;
end;
$$;

-- Most recent sign-ins across everyone.
create function public.admin_recent_logins(p_limit integer default 50)
returns table (user_id uuid, display_name text, email text, method text, device text, at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admin only' using errcode = '42501'; end if;
  return query
    select l.user_id, p.display_name, u.email::text, l.method, l.device, l.at
    from public.login_events l
    join auth.users u on u.id = l.user_id
    left join public.profiles p on p.id = l.user_id
    order by l.at desc
    limit least(greatest(p_limit, 1), 500);
end;
$$;

-- One row per person with everything the dashboard shows about them.
create function public.admin_people()
returns table (
  id uuid, display_name text, email text, role text, banned_at timestamptz, joined timestamptz,
  provider text, last_sign_in timestamptz, sign_ins bigint,
  files bigint, pages bigint, bytes bigint, chapters bigint, subjects bigint, comments bigint, last_upload timestamptz
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admin only' using errcode = '42501'; end if;
  return query
    select p.id, p.display_name, u.email::text, p.role, p.banned_at, p.created_at,
      coalesce(u.raw_app_meta_data ->> 'provider', 'email'),
      greatest(u.last_sign_in_at, (select max(l.at) from public.login_events l where l.user_id = p.id)),
      (select count(*) from public.login_events l where l.user_id = p.id),
      (select count(*) from public.files f where f.owner_id = p.id and f.deleted_at is null),
      (select coalesce(sum(f.page_count), 0)::bigint from public.files f where f.owner_id = p.id and f.deleted_at is null),
      (select coalesce(sum(f.size_bytes), 0)::bigint from public.files f where f.owner_id = p.id),
      (select count(distinct f.collection_id) from public.files f where f.owner_id = p.id and f.deleted_at is null),
      (select count(distinct c.subject_code) from public.collections c
         where c.owner_id = p.id and exists (select 1 from public.files f where f.collection_id = c.id and f.deleted_at is null)),
      (select count(*) from public.comments c where c.author_id = p.id and c.deleted_at is null),
      (select max(f.created_at) from public.files f where f.owner_id = p.id)
    from public.profiles p join auth.users u on u.id = p.id
    order by 10 desc, p.created_at;
end;
$$;

-- Sign-in history for one person.
create function public.admin_user_logins(p_user uuid, p_limit integer default 100)
returns table (method text, device text, at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admin only' using errcode = '42501'; end if;
  return query
    select l.method, l.device, l.at from public.login_events l
    where l.user_id = p_user order by l.at desc limit least(greatest(p_limit, 1), 500);
end;
$$;

revoke execute on function public.record_login(text, text), public.admin_overview(), public.admin_daily(integer),
  public.admin_recent_logins(integer), public.admin_people(), public.admin_user_logins(uuid, integer) from anon, public;
grant execute on function public.record_login(text, text), public.admin_overview(), public.admin_daily(integer),
  public.admin_recent_logins(integer), public.admin_people(), public.admin_user_logins(uuid, integer) to authenticated;
