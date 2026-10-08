/**
 * Runs the real migration in an in-memory Postgres (PGlite) with minimal stand-ins for
 * Supabase's auth and storage schemas, then checks the row-level security rules as the
 * anon role and as two different signed-in students.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'

const A = '11111111-1111-4111-8111-111111111111'
const B = '22222222-2222-4222-8222-222222222222'
const ADMIN = '33333333-3333-4333-8333-333333333333'

const SUPABASE_STUBS = `
  create role anon nologin;
  create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;

  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language sql immutable as
    $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
  grant usage on schema storage to anon, authenticated;
  grant select, insert, update, delete on storage.objects to anon, authenticated;
  grant usage on schema public to anon, authenticated;
`

let db: PGlite

async function as(user: string | null, sql: string, params: unknown[] = []) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${user ?? ''}', false);`)
  await db.exec(`set role ${user ? 'authenticated' : 'anon'};`)
  try {
    return await db.query<Record<string, unknown>>(sql, params)
  } finally {
    await db.exec('reset role;')
  }
}

async function fails(user: string | null, sql: string, params: unknown[] = []) {
  await expect(as(user, sql, params)).rejects.toThrow()
}

const path = (owner: string, col: string, file: string) => `${owner}/${col}/${file}/notes.pdf`

beforeAll(async () => {
  db = new PGlite()
  await db.exec(SUPABASE_STUBS)
  const dir = join(process.cwd(), 'supabase', 'migrations')
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    await db.exec(readFileSync(join(dir, f), 'utf8'))
  }
  await db.exec(`insert into auth.users (id) values ('${A}'), ('${B}'), ('${ADMIN}');`)
})

describe('profiles', () => {
  it('lets a student create only their own profile', async () => {
    await as(A, `insert into public.profiles (id, display_name) values ($1, 'Arjun')`, [A])
    await fails(A, `insert into public.profiles (id, display_name) values ($1, 'Fake')`, [B])
    await as(B, `insert into public.profiles (id, display_name) values ($1, 'Bhavya')`, [B])
    await db.exec(`insert into public.profiles (id, display_name, role) values ('${ADMIN}', 'Owner', 'admin')`)
  })

  it('does not let a student make themselves admin', async () => {
    await fails(A, `update public.profiles set role = 'admin' where id = $1`, [A])
    await fails(A, `insert into public.profiles (id, display_name, role) values ($1, 'x', 'admin')`, [A])
  })

  it('lets a student rename themselves but not others', async () => {
    await as(A, `update public.profiles set display_name = 'Arjun K' where id = $1`, [A])
    const r = await as(A, `update public.profiles set display_name = 'Hacked' where id = $1 returning id`, [B])
    expect(r.rows).toHaveLength(0)
  })
})

let colA = ''

describe('collections (one shelf per person per chapter)', () => {
  it('lets a student create a shelf for themselves only', async () => {
    const r = await as(A, `insert into public.collections (owner_id, subject_code, unit) values ($1, '25ES1IT102', 2) returning id`, [A])
    colA = r.rows[0]!.id as string
    await fails(A, `insert into public.collections (owner_id, subject_code, unit) values ($1, '25ES1IT102', 2)`, [B])
  })

  it('refuses a second shelf for the same chapter', async () => {
    await fails(A, `insert into public.collections (owner_id, subject_code, unit) values ($1, '25ES1IT102', 2)`, [A])
  })

  it('refuses anonymous writes', async () => {
    await fails(null, `insert into public.collections (owner_id, subject_code, unit) values ($1, '25ES1IT102', 3)`, [A])
  })

  it('does not let a student hide their own shelf state or edit someone else’s', async () => {
    await fails(A, `update public.collections set hidden = true where id = $1`, [colA])
    const r = await as(B, `update public.collections set description = 'spam' where id = $1 returning id`, [colA])
    expect(r.rows).toHaveLength(0)
  })
})

const F1 = 'aaaaaaaa-0000-4000-8000-000000000001'
const F2 = 'aaaaaaaa-0000-4000-8000-000000000002'

describe('files', () => {
  it('accepts a file in the owner’s own folder and shelf', async () => {
    await as(
      A,
      `insert into public.files (id, collection_id, owner_id, storage_path, name, mime, size_bytes) values ($1, $2, $3, $4, 'Unit 2', 'application/pdf', 1000)`,
      [F1, colA, A, path(A, colA, F1)],
    )
  })

  it('rejects paths outside the owner’s folder', async () => {
    await fails(
      A,
      `insert into public.files (id, collection_id, owner_id, storage_path, name, mime, size_bytes) values ($1, $2, $3, $4, 'x', 'application/pdf', 1)`,
      [F2, colA, A, path(B, colA, F2)],
    )
  })

  it('rejects adding files to someone else’s shelf', async () => {
    await fails(
      B,
      `insert into public.files (id, collection_id, owner_id, storage_path, name, mime, size_bytes) values ($1, $2, $3, $4, 'x', 'application/pdf', 1)`,
      [F2, colA, B, path(B, colA, F2)],
    )
  })

  it('rejects disallowed types and files over 50 MB', async () => {
    await fails(
      A,
      `insert into public.files (id, collection_id, owner_id, storage_path, name, mime, size_bytes) values ($1, $2, $3, $4, 'x', 'text/html', 1)`,
      [F2, colA, A, path(A, colA, F2)],
    )
    await fails(
      A,
      `insert into public.files (id, collection_id, owner_id, storage_path, name, mime, size_bytes) values ($1, $2, $3, $4, 'x', 'application/pdf', 60000000)`,
      [F2, colA, A, path(A, colA, F2)],
    )
  })

  it('is publicly readable without signing in', async () => {
    const r = await as(null, `select id from public.files`)
    expect(r.rows.map((x) => x.id)).toEqual([F1])
  })

  it('can never be hard-deleted by anyone through the API', async () => {
    await fails(A, `delete from public.files where id = $1`, [F1])
    await fails(null, `delete from public.files where id = $1`, [F1])
    await fails(A, `delete from public.collections where id = $1`, [colA])
  })

  it('cannot have its stored bytes path rewritten', async () => {
    await fails(A, `update public.files set storage_path = 'x' where id = $1`, [F1])
  })

  it('soft-deletes: hidden from the public, still visible to the owner, restorable', async () => {
    await as(A, `update public.files set deleted_at = now() where id = $1`, [F1])
    expect((await as(null, `select id from public.files`)).rows).toHaveLength(0)
    expect((await as(A, `select id from public.files`)).rows).toHaveLength(1)
    await as(A, `update public.files set deleted_at = null where id = $1`, [F1])
    expect((await as(null, `select id from public.files`)).rows).toHaveLength(1)
  })

  it('cannot be hidden by another student', async () => {
    const r = await as(B, `update public.files set deleted_at = now() where id = $1 returning id`, [F1])
    expect(r.rows).toHaveLength(0)
  })
})

describe('moderation', () => {
  it('only admins can hide a shelf, and hidden shelves disappear publicly', async () => {
    await fails(A, `select public.set_collection_hidden($1, true)`, [colA])
    await fails(null, `select public.set_collection_hidden($1, true)`, [colA])
    await as(ADMIN, `select public.set_collection_hidden($1, true)`, [colA])
    expect((await as(null, `select id from public.collections where id = $1`, [colA])).rows).toHaveLength(0)
    expect((await as(null, `select id from public.files`)).rows).toHaveLength(0)
    expect((await as(A, `select id from public.collections where id = $1`, [colA])).rows).toHaveLength(1)
    await as(ADMIN, `select public.set_collection_hidden($1, false)`, [colA])
    expect((await as(null, `select id from public.files`)).rows).toHaveLength(1)
  })
})

describe('storage', () => {
  it('lets students upload only into their own folder', async () => {
    await as(A, `insert into storage.objects (bucket_id, name) values ('notes', $1)`, [path(A, colA, F2)])
    await fails(A, `insert into storage.objects (bucket_id, name) values ('notes', $1)`, [path(B, colA, F2)])
    await fails(null, `insert into storage.objects (bucket_id, name) values ('notes', $1)`, [path(A, colA, F2)])
  })

  it('has no way to overwrite or delete an uploaded object', async () => {
    const del = await as(A, `delete from storage.objects returning id`)
    expect(del.rows).toHaveLength(0)
    const upd = await as(A, `update storage.objects set name = 'x' returning id`)
    expect(upd.rows).toHaveLength(0)
    expect((await db.query(`select count(*)::int as n from storage.objects`)).rows[0]).toEqual({ n: 1 })
  })

  it('creates the public notes bucket with a 50 MB limit', async () => {
    const r = await db.query(`select public, file_size_limit from storage.buckets where id = 'notes'`)
    expect(r.rows[0]).toEqual({ public: true, file_size_limit: 52428800 })
  })
})

describe('comments', () => {
  let commentId = ''

  it('lets signed-in people comment as themselves only', async () => {
    const r = await as(B, `insert into public.comments (file_id, author_id, body) values ($1, $2, 'Thanks, very clear!') returning id`, [F1, B])
    commentId = r.rows[0]!.id as string
    await fails(B, `insert into public.comments (file_id, author_id, body) values ($1, $2, 'fake')`, [F1, A])
  })

  it('refuses anonymous and empty comments', async () => {
    await fails(null, `insert into public.comments (file_id, author_id, body) values ($1, $2, 'hi')`, [F1, A])
    await fails(A, `insert into public.comments (file_id, author_id, body) values ($1, $2, '   ')`, [F1, A])
  })

  it('is readable by everyone', async () => {
    expect((await as(null, `select id from public.comments`)).rows).toHaveLength(1)
  })

  it('cannot be edited or deleted by others, nor hard-deleted at all', async () => {
    const r = await as(A, `update public.comments set deleted_at = now() where id = $1 returning id`, [commentId])
    expect(r.rows).toHaveLength(0)
    await fails(B, `update public.comments set body = 'changed' where id = $1`, [commentId])
    await fails(B, `delete from public.comments where id = $1`, [commentId])
  })

  it('can be removed by its author or an admin', async () => {
    await as(B, `update public.comments set deleted_at = now() where id = $1`, [commentId])
    expect((await as(null, `select id from public.comments`)).rows).toHaveLength(0)
    const r = await as(A, `insert into public.comments (file_id, author_id, body) values ($1, $2, 'second') returning id`, [F1, A])
    await as(ADMIN, `update public.comments set deleted_at = now() where id = $1`, [r.rows[0]!.id])
    expect((await as(null, `select id from public.comments`)).rows).toHaveLength(0)
  })

  it('cannot be added to a hidden file', async () => {
    await as(A, `update public.files set deleted_at = now() where id = $1`, [F1])
    await fails(B, `insert into public.comments (file_id, author_id, body) values ($1, $2, 'x')`, [F1, B])
    await as(A, `update public.files set deleted_at = null where id = $1`, [F1])
  })
})
