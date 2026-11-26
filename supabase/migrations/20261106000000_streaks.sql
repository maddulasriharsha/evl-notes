-- Study streak leaderboard.
--
-- A browser makes itself a secret random key the first time it visits, and the site gives it a random
-- name such as "Cosmic Otter". Each day (India time) it checks in, its streak grows by one.
--
-- Privacy: no account, IP address or page is stored, only a one-way hash of the browser's key, the
-- random name and day counts. The table cannot be read or written directly: the two functions below
-- are the only way in. The server decides what day it is and what the name is, so neither the numbers
-- nor the names can be made up by a visitor.

create table public.streak_players (
  key_hash       text primary key,
  name           text not null unique,
  current_streak integer not null default 1 check (current_streak >= 1),
  best_streak    integer not null default 1 check (best_streak >= 1),
  total_days     integer not null default 1 check (total_days >= 1),
  last_day       date not null,
  created_on     date not null
);
create index streak_players_rank_idx on public.streak_players (last_day, current_streak desc);
create index streak_players_created_idx on public.streak_players (created_on);

alter table public.streak_players enable row level security;
revoke all on public.streak_players from anon, authenticated;

create function public.random_streak_name(p_long boolean default false) returns text
language plpgsql volatile set search_path = public as $$
declare
  first_words text[] := array[
    'Cosmic','Quiet','Brave','Clever','Swift','Lunar','Solar','Golden','Silver','Curious','Mighty','Gentle',
    'Electric','Midnight','Crimson','Azure','Emerald','Amber','Violet','Frosty','Sunny','Stormy','Daring','Witty',
    'Calm','Bright','Lucky','Nimble','Bold','Sleepy','Jolly','Noble','Radiant','Wandering','Hidden','Flying',
    'Dancing','Fearless','Patient','Sharp','Stellar','Turbo','Pixel','Neon','Crystal','Thunder','Velvet','Rapid',
    'Sneaky','Cheerful','Mystic','Wild','Royal','Humble','Epic','Zesty','Breezy','Glowing','Roaming','Quantum'];
  last_words text[] := array[
    'Otter','Falcon','Panda','Tiger','Comet','Nebula','Phoenix','Dolphin','Koala','Lynx','Raven','Fox',
    'Wolf','Owl','Hawk','Panther','Penguin','Turtle','Dragon','Meteor','Pulsar','Quasar','Orbit','Rocket',
    'Voyager','Galaxy','Aurora','Eagle','Leopard','Badger','Beaver','Cheetah','Gecko','Heron','Jaguar','Kestrel',
    'Lemur','Manta','Narwhal','Octopus','Parrot','Rabbit','Seal','Sparrow','Squirrel','Stallion','Swan','Toucan',
    'Whale','Yak','Zebra','Bison','Cobra','Crane','Hedgehog','Mongoose','Peacock','Robin','Salamander','Kingfisher'];
  pick text;
  second text;
begin
  pick := first_words[1 + floor(random() * array_length(first_words, 1))::int];
  if p_long then
    loop
      second := first_words[1 + floor(random() * array_length(first_words, 1))::int];
      exit when second <> pick;
    end loop;
    pick := pick || ' ' || second;
  end if;
  return pick || ' ' || last_words[1 + floor(random() * array_length(last_words, 1))::int];
end;
$$;
revoke execute on function public.random_streak_name(boolean) from public, anon, authenticated;

-- Records today for this browser (once a day counts) and returns its name and streak.
create function public.streak_checkin(p_key uuid) returns json
language plpgsql security definer set search_path = public as $$
declare
  today date := (now() at time zone 'Asia/Kolkata')::date;
  h     text := encode(sha256(convert_to(p_key::text, 'utf8')), 'hex');
  me    public.streak_players%rowtype;
  tries integer := 0;
  next_run integer;
begin
  if p_key is null then raise exception 'p_key is required'; end if;

  select * into me from public.streak_players where key_hash = h for update;

  if not found then
    -- A brake on scripts inventing browsers: far above what the college could produce in a day.
    if (select count(*) from public.streak_players where created_on = today) >= 3000 then return null; end if;
    -- Visitors who came once and never returned are cleared out after a month.
    delete from public.streak_players where total_days = 1 and last_day < today - 30;
    loop
      tries := tries + 1;
      begin
        insert into public.streak_players (key_hash, name, last_day, created_on)
        values (h, public.random_streak_name(tries > 8), today, today)
        returning * into me;
        exit;
      exception when unique_violation then
        -- Either the name is taken (try another) or another tab created this browser a moment ago.
        select * into me from public.streak_players where key_hash = h;
        exit when found;
        if tries >= 30 then return null; end if;
      end;
    end loop;
  elsif me.last_day < today then
    next_run := case when me.last_day = today - 1 then me.current_streak + 1 else 1 end;
    update public.streak_players
       set current_streak = next_run,
           best_streak = greatest(best_streak, next_run),
           total_days = total_days + 1,
           last_day = today
     where key_hash = h
    returning * into me;
  end if;

  return json_build_object('name', me.name, 'streak', me.current_streak, 'best', me.best_streak, 'days', me.total_days);
end;
$$;
revoke execute on function public.streak_checkin(uuid) from public;
grant execute on function public.streak_checkin(uuid) to anon, authenticated;

-- The leaderboard: running streaks of two days or more (so one-off visits never fill it), best first.
-- Given the caller's own key it also marks their row and reports their place. Keys are never returned.
create function public.streak_board(p_key uuid default null) returns json
language sql stable security definer set search_path = public as $$
  with today as (select (now() at time zone 'Asia/Kolkata')::date as d),
  mine as (select case when p_key is null then null else encode(sha256(convert_to(p_key::text, 'utf8')), 'hex') end as h),
  ranked as (
    select s.key_hash, s.name, s.current_streak, s.best_streak, s.total_days,
           row_number() over (order by s.current_streak desc, s.best_streak desc, s.total_days desc, s.created_on, s.name) as place
    from public.streak_players s, today
    where s.last_day >= today.d - 1 and s.current_streak >= 2
  )
  select json_build_object(
    'players', coalesce((
      select json_agg(json_build_object(
               'place', r.place, 'name', r.name, 'streak', r.current_streak, 'best', r.best_streak, 'days', r.total_days,
               'me', coalesce(r.key_hash = mine.h, false)) order by r.place)
      from ranked r, mine where r.place <= 50), '[]'::json),
    'total', (select count(*) from ranked),
    'my_place', (select r.place from ranked r, mine where r.key_hash = mine.h)
  );
$$;
revoke execute on function public.streak_board(uuid) from public;
grant execute on function public.streak_board(uuid) to anon, authenticated;
