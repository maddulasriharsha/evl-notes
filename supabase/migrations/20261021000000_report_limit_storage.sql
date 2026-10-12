-- 1. A new report reason: the note is broken (does not open, blank pages, wrong file).
-- 2. A note or comment that five different people have reported is hidden automatically until staff look
--    at it. Staff can restore it from the admin pages; the reports stay open until they are resolved.
-- 3. The dashboard's "Storage used" counts only files still held in Supabase Storage (not originals that
--    were moved to Drive, and not Drive links).

alter table public.reports drop constraint if exists reports_reason_check;
alter table public.reports add constraint reports_reason_check
  check (reason in ('wrong_place', 'low_quality', 'duplicate', 'inappropriate', 'copyright', 'spam', 'broken', 'other'));

create or replace function public.auto_hide_reported() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  n integer;
begin
  if new.file_id is not null then
    select count(distinct reporter_id) into n
      from public.reports
     where file_id = new.file_id and resolved_at is null;
    if n >= 5 then
      update public.files set deleted_at = now() where id = new.file_id and deleted_at is null;
    end if;
  elsif new.comment_id is not null then
    select count(distinct reporter_id) into n
      from public.reports
     where comment_id = new.comment_id and resolved_at is null;
    if n >= 5 then
      update public.comments set deleted_at = now() where id = new.comment_id and deleted_at is null;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists reports_auto_hide on public.reports;
create trigger reports_auto_hide after insert on public.reports
  for each row execute function public.auto_hide_reported();

create or replace function public.admin_overview() returns json
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
    'storage_bytes',    (select coalesce(sum(size_bytes), 0) from public.files
                          where storage_path is not null and drive_id is null and original_removed_at is null),
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
