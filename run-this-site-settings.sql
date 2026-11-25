-- Site-wide switches. For now: maintenance mode. The maintenance flag is public (the proxy and the
-- maintenance page read it without signing in); nothing can be written directly, only the admin
-- function below changes it.

create table public.site_settings (
  key text primary key check (key in ('maintenance')),
  value jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.site_settings enable row level security;
create policy site_settings_read on public.site_settings for select using (true);
grant select on public.site_settings to anon, authenticated;

insert into public.site_settings (key, value) values ('maintenance', '{"on": false}'::jsonb);

create function public.admin_set_maintenance(p_on boolean, p_message text, p_back text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admins only' using errcode = '42501'; end if;
  if p_on is null then raise exception 'p_on is required'; end if;
  update public.site_settings
  set value = jsonb_build_object(
        'on', p_on,
        'message', left(coalesce(btrim(p_message), ''), 300),
        'back', left(coalesce(btrim(p_back), ''), 80),
        'since', case when p_on then now() else null end
      ),
      updated_by = auth.uid(),
      updated_at = now()
  where key = 'maintenance';
end;
$$;
revoke execute on function public.admin_set_maintenance(boolean, text, text) from anon, public;
grant execute on function public.admin_set_maintenance(boolean, text, text) to authenticated;
