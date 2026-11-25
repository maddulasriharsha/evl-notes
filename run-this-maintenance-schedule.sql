-- Run this once in the Supabase SQL editor. It is safe to run even if you already ran
-- run-this-site-settings.sql (it creates the settings table only if it is missing).

create table if not exists public.site_settings (
  key text primary key check (key in ('maintenance')),
  value jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.site_settings enable row level security;
drop policy if exists site_settings_read on public.site_settings;
create policy site_settings_read on public.site_settings for select using (true);
grant select on public.site_settings to anon, authenticated;
insert into public.site_settings (key, value) values ('maintenance', '{"on": false}'::jsonb) on conflict (key) do nothing;

drop function if exists public.admin_set_maintenance(boolean, text, text);
drop function if exists public.admin_set_maintenance(boolean, text, text, timestamptz, timestamptz);

create function public.admin_set_maintenance(p_on boolean, p_message text, p_back text, p_starts timestamptz, p_ends timestamptz) returns void
language plpgsql security definer set search_path = public as $$
declare
  begins timestamptz := coalesce(p_starts, now());
begin
  if not public.is_admin() then raise exception 'admins only' using errcode = '42501'; end if;
  if p_on is null then raise exception 'p_on is required'; end if;
  if p_on and p_ends is not null and p_ends <= begins then raise exception 'the end time must be after the start time'; end if;
  update public.site_settings
  set value = jsonb_build_object(
        'on', p_on,
        'message', left(coalesce(btrim(p_message), ''), 300),
        'back', left(coalesce(btrim(p_back), ''), 80),
        'since', case when p_on then begins else null end,
        'starts', case when p_on and p_starts is not null then p_starts else null end,
        'until', case when p_on then p_ends else null end
      ),
      updated_by = auth.uid(),
      updated_at = now()
  where key = 'maintenance';
end;
$$;
revoke execute on function public.admin_set_maintenance(boolean, text, text, timestamptz, timestamptz) from anon, public;
grant execute on function public.admin_set_maintenance(boolean, text, text, timestamptz, timestamptz) to authenticated;
