-- Drive backup: every uploaded file is copied to a Google Drive folder. A week later, once the copy
-- has been checked again, the original is removed from Storage to save space and the note is served
-- from the Drive copy. Thumbnails and previews stay in Storage.
--
-- storage_path is deliberately left in place after the original is removed: it is an immutable column
-- and part of the source check. original_removed_at is what says the bytes are no longer there.

alter table public.files
  add column backup_drive_id     text check (backup_drive_id is null or backup_drive_id ~ '^[A-Za-z0-9_-]{10,120}$'),
  add column backed_up_at        timestamptz,
  add column original_removed_at timestamptz,
  add column backup_error        text;

-- The two jobs look for work by these.
create index files_backup_pending_idx on public.files (created_at)
  where backup_drive_id is null and storage_path is not null and drive_id is null;
create index files_backup_removal_idx on public.files (backed_up_at)
  where backup_drive_id is not null and original_removed_at is null;

-- Nothing here is writable by members or the browser: only the server job (service role) sets
-- these columns. They are readable, because the page needs them to know where to serve a file from.
