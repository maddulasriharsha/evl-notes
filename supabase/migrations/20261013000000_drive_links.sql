-- Notes can be a link to Google Drive (a file, a folder, or a Google Doc / Sheet / Slides)
-- instead of an uploaded file. Only the link is stored here, so it uses no Storage space.
-- Everything that works on uploads (shelves, comments, hide/delete, admin tools) works on links too.

alter table public.files add column drive_id text
  check (drive_id is null or drive_id ~ '^[A-Za-z0-9_-]{10,120}$');

-- A link has no stored bytes, so these become optional.
alter table public.files alter column storage_path drop not null;
alter table public.files alter column size_bytes drop not null;

-- Replace the "mime must be one of five upload types" rule with one that also allows link types.
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.files'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%mime%'
  loop
    execute format('alter table public.files drop constraint %I', c.conname);
  end loop;
end $$;

-- Exactly one source: an uploaded file, or a Drive link. Never both, never neither.
alter table public.files add constraint files_source_check check (
  (
    drive_id is null
    and storage_path is not null
    and size_bytes is not null
    and mime in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif')
  )
  or
  (
    drive_id is not null
    and storage_path is null
    and thumb_path is null
    and preview_path is null
    and mime in (
      'application/vnd.google-apps.file',
      'application/vnd.google-apps.folder',
      'application/vnd.google-apps.document',
      'application/vnd.google-apps.spreadsheet',
      'application/vnd.google-apps.presentation'
    )
  )
);

-- Students may set the link when adding a file. It cannot be changed afterwards.
grant insert (drive_id) on public.files to authenticated;

create or replace function public.files_guard_update() returns trigger
language plpgsql as $$
begin
  if new.id <> old.id or new.collection_id <> old.collection_id or new.owner_id <> old.owner_id
     or new.storage_path is distinct from old.storage_path
     or new.drive_id is distinct from old.drive_id
     or new.mime <> old.mime
     or new.size_bytes is distinct from old.size_bytes
     or new.created_at <> old.created_at then
    raise exception 'immutable file columns cannot change';
  end if;
  return new;
end;
$$;
