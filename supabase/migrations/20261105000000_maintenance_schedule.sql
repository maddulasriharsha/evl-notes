-- Maintenance can now be scheduled (start later) and can switch itself off (end time). The flag stays
-- public; only this admin function writes it. "On" in the settings means "armed": the site is only
-- actually locked between the start (default: now) and the end (default: never), which the app works
-- out from these timestamps, so nothing has to run at the moment it ends.

drop function if exists public.admin_set_maintenance(boolean, text, text);

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
