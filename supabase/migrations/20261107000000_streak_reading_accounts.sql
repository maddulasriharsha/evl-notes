-- Study streak: a day counts only after reading notes, and signed-in members use their own name.
--
-- Reading rule: when someone starts reading a note the browser calls streak_start, and the day is
-- counted only if the server saw that start at least five minutes ago. The page times the five minutes
-- of reading (only while it is on screen); the server's clock stops a day being claimed at once.
--
-- A streak row now belongs either to a browser (made-up name, hash of the browser's key) or to an
-- account (no name or key stored: the name is read from the profile, so it is always current and
-- cannot be faked). When someone signs in, their browser's streak moves to their account, which then
-- follows them to any device and appears on the board once.

alter table public.streak_players drop constraint streak_players_pkey;
alter table public.streak_players add column id bigint generated always as identity primary key;
alter table public.streak_players alter column key_hash drop not null;
alter table public.streak_players alter column name drop not null;
alter table public.streak_players add constraint streak_players_key_hash_key unique (key_hash);
alter table public.streak_players add column user_id uuid unique references public.profiles (id) on delete cascade;
alter table public.streak_players add constraint streak_players_owner_check check (
  (user_id is null and key_hash is not null and name is not null)
  or (user_id is not null and key_hash is null and name is null)
);

-- A visit now gives a name before any day has been counted.
alter table public.streak_players drop constraint streak_players_current_streak_check;
alter table public.streak_players drop constraint streak_players_best_streak_check;
alter table public.streak_players drop constraint streak_players_total_days_check;
alter table public.streak_players alter column current_streak set default 0;
alter table public.streak_players alter column best_streak set default 0;
alter table public.streak_players alter column total_days set default 0;
alter table public.streak_players alter column last_day drop not null;
alter table public.streak_players add constraint streak_players_counts_check
  check (current_streak >= 0 and best_streak >= 0 and total_days >= 0);

-- When each browser first began reading on a given day. Kept for a day, then cleared.
create table public.streak_reading (
  key_hash   text not null,
  day        date not null,
  started_at timestamptz not null default now(),
  primary key (key_hash, day)
);
create index streak_reading_day_idx on public.streak_reading (day);
alter table public.streak_reading enable row level security;
revoke all on public.streak_reading from anon, authenticated;

create function public.streak_start(p_key uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  today date := (now() at time zone 'Asia/Kolkata')::date;
begin
  if p_key is null then raise exception 'p_key is required'; end if;
  delete from public.streak_reading where day < today - 1;
  if (select count(*) from public.streak_reading where day = today) >= 6000 then return; end if;
  insert into public.streak_reading (key_hash, day)
  values (encode(sha256(convert_to(p_key::text, 'utf8')), 'hex'), today)
  on conflict do nothing;
end;
$$;
revoke execute on function public.streak_start(uuid) from public;
grant execute on function public.streak_start(uuid) to anon, authenticated;

-- Returns this visitor's name and streak, and counts today if the reading rule has been met.
create or replace function public.streak_checkin(p_key uuid) returns json
language plpgsql security definer set search_path = public as $$
declare
  today    date := (now() at time zone 'Asia/Kolkata')::date;
  h        text := encode(sha256(convert_to(p_key::text, 'utf8')), 'hex');
  uid      uuid;
  my_name  text;
  me       public.streak_players%rowtype;
  device   public.streak_players%rowtype;
  tries    integer := 0;
  next_run integer;
begin
  if p_key is null then raise exception 'p_key is required'; end if;

  -- Null when signed out, and for an account that has not chosen a display name yet.
  select id, display_name into uid, my_name from public.profiles where id = auth.uid();

  if uid is not null then
    select * into me from public.streak_players where user_id = uid for update;
    select * into device from public.streak_players where key_hash = h for update;

    if device.id is not null and me.id is null then
      -- First visit signed in: the browser's streak becomes the account's.
      update public.streak_players set user_id = uid, key_hash = null, name = null
       where id = device.id returning * into me;
    elsif device.id is not null then
      -- Both exist (say, another device): keep one row, with the longer of the running streaks.
      if device.last_day >= today - 1 and (coalesce(me.last_day < today - 1, true) or device.current_streak > me.current_streak) then
        if me.last_day = today and device.last_day = today - 1 then
          me.current_streak := device.current_streak + 1;
        else
          me.current_streak := device.current_streak;
          me.last_day := device.last_day;
        end if;
      end if;
      delete from public.streak_players where id = device.id;
      update public.streak_players
         set current_streak = me.current_streak,
             last_day = me.last_day,
             best_streak = greatest(me.best_streak, device.best_streak, me.current_streak),
             total_days = greatest(me.total_days, device.total_days)
       where id = me.id returning * into me;
    elsif me.id is null then
      insert into public.streak_players (user_id, created_on) values (uid, today)
      on conflict (user_id) do nothing;
      select * into me from public.streak_players where user_id = uid for update;
    end if;
  else
    select * into me from public.streak_players where key_hash = h for update;
  end if;

  if me.id is null then
    -- A brake on scripts inventing browsers: far above what the college could produce in a day.
    if (select count(*) from public.streak_players where created_on = today and user_id is null) >= 3000 then return null; end if;
    -- Visitors who never came back (one counted day or none) are cleared out after a month.
    delete from public.streak_players
     where user_id is null and total_days <= 1 and coalesce(last_day, created_on) < today - 30;
    loop
      tries := tries + 1;
      begin
        insert into public.streak_players (key_hash, name, created_on)
        values (h, public.random_streak_name(tries > 8), today)
        returning * into me;
        exit;
      exception when unique_violation then
        -- Either the name is taken (try another) or another tab created this browser a moment ago.
        select * into me from public.streak_players where key_hash = h;
        exit when found;
        if tries >= 30 then return null; end if;
      end;
    end loop;
  end if;

  if me.last_day is distinct from today and exists (
    -- Ten seconds of slack for the difference between the two clocks.
    select 1 from public.streak_reading r
    where r.key_hash = h and r.day = today and r.started_at <= now() - interval '290 seconds'
  ) then
    next_run := case when me.last_day = today - 1 then me.current_streak + 1 else 1 end;
    update public.streak_players
       set current_streak = next_run,
           best_streak = greatest(best_streak, next_run),
           total_days = total_days + 1,
           last_day = today
     where id = me.id
    returning * into me;
  end if;

  return json_build_object(
    'name', coalesce(my_name, me.name), 'account', uid is not null,
    'streak', case when me.last_day >= today - 1 then me.current_streak else 0 end,
    'best', me.best_streak, 'days', me.total_days, 'today', coalesce(me.last_day = today, false));
end;
$$;

-- Same ranking as before. Members are listed by their current display name; blocked accounts are left off.
create or replace function public.streak_board(p_key uuid default null) returns json
language sql stable security definer set search_path = public as $$
  with today as (select (now() at time zone 'Asia/Kolkata')::date as d),
  mine as (select case when p_key is null then null else encode(sha256(convert_to(p_key::text, 'utf8')), 'hex') end as h),
  ranked as (
    select s.key_hash, s.user_id, coalesce(p.display_name, s.name) as name, s.current_streak, s.best_streak, s.total_days,
           row_number() over (order by s.current_streak desc, s.best_streak desc, s.total_days desc, s.created_on, s.id) as place
    from public.streak_players s
    cross join today
    left join public.profiles p on p.id = s.user_id
    where s.last_day >= today.d - 1 and s.current_streak >= 2 and p.banned_at is null
  ),
  flagged as (
    select r.*,
           case when auth.uid() is not null and r.user_id = auth.uid() then true
                else coalesce(r.key_hash = mine.h, false) end as is_me
    from ranked r, mine
  )
  select json_build_object(
    'players', coalesce((
      select json_agg(json_build_object(
               'place', f.place, 'name', f.name, 'member', f.user_id is not null, 'streak', f.current_streak,
               'best', f.best_streak, 'days', f.total_days, 'me', f.is_me) order by f.place)
      from flagged f where f.place <= 50), '[]'::json),
    'total', (select count(*) from flagged),
    'my_place', (select min(f.place) from flagged f where f.is_me)
  );
$$;
