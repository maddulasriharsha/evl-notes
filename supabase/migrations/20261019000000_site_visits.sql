-- Visitor counter for the admin dashboard.
--
-- Privacy: no IP address, no user agent, no page, no account. A browser gets a random id the first
-- time it visits (kept in its own storage, never tied to a sign-in). The only thing stored is
-- "this random id was here on this day, N times". Nothing can read the table directly.

create table public.site_visits (
  day     date not null,
  visitor uuid not null,
  views   integer not null default 1,
  primary key (day, visitor)
);

alter table public.site_visits enable row level security;
revoke all on public.site_visits from anon, authenticated;

-- Anyone's browser may report a visit. A runaway script cannot push one id's count past 1000.
create function public.record_visit(p_visitor uuid) returns void
language sql security definer set search_path = public as $$
  insert into public.site_visits (day, visitor)
  values ((now() at time zone 'Asia/Kolkata')::date, p_visitor)
  on conflict (day, visitor) do update set views = least(public.site_visits.views + 1, 1000);
$$;
revoke execute on function public.record_visit(uuid) from public;
grant execute on function public.record_visit(uuid) to anon, authenticated;

-- Totals and the daily series for the admin dashboard.
create function public.admin_visits(p_days integer default 30) returns json
language plpgsql stable security definer set search_path = public as $$
declare
  today date := (now() at time zone 'Asia/Kolkata')::date;
  span  integer := least(greatest(p_days, 1), 365);
begin
  if not public.is_admin() then raise exception 'admin only' using errcode = '42501'; end if;
  return json_build_object(
    'today',     (select count(*) from public.site_visits where day = today),
    'week',      (select count(distinct visitor) from public.site_visits where day > today - 7),
    'month',     (select count(distinct visitor) from public.site_visits where day > today - 30),
    'all_time',  (select count(distinct visitor) from public.site_visits),
    'views_all', (select coalesce(sum(views), 0) from public.site_visits),
    'daily',     (
      select coalesce(json_agg(json_build_object('day', d, 'visitors', v, 'views', w) order by d), '[]'::json)
      from (
        select g.d, count(s.visitor) as v, coalesce(sum(s.views), 0) as w
        from generate_series(today - (span - 1), today, interval '1 day') as g(d)
        left join public.site_visits s on s.day = g.d::date
        group by g.d
      ) t
    )
  );
end;
$$;
revoke execute on function public.admin_visits(integer) from anon, public;
grant execute on function public.admin_visits(integer) to authenticated;
