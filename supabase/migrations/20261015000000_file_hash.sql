-- Duplicate detection: every upload stores a SHA-256 fingerprint of its bytes, so the uploader can
-- warn "this exact file is already on the site" before anything is sent.
--
-- The fingerprint is advisory (it is written by the uploader), so it is never used to authorise
-- anything. Old files simply have no fingerprint and are not matched.

alter table public.files add column content_hash text
  check (content_hash is null or content_hash ~ '^[0-9a-f]{64}$');

create index files_content_hash_idx on public.files (content_hash)
  where content_hash is not null and deleted_at is null;

grant insert (content_hash) on public.files to authenticated;
