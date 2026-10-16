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
  create table auth.users (id uuid primary key, email text, last_sign_in_at timestamptz, raw_app_meta_data jsonb default '{}');
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
  await db.exec(`insert into auth.users (id, email) values ('${A}', 'a@x.in'), ('${B}', 'b@x.in'), ('${ADMIN}', 'owner@x.in');`)
  // The site owner is the account whose email is listed in site_owners (the real one is added by the migration).
  await db.exec(`insert into public.site_owners (email) values ('owner@x.in') on conflict do nothing;`)
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

describe('admin powers', () => {
  it('lets admins (only) hide and restore anyone’s single file', async () => {
    const r = await as(B, `update public.files set deleted_at = now() where id = $1 returning id`, [F1])
    expect(r.rows).toHaveLength(0)
    await as(ADMIN, `update public.files set deleted_at = now() where id = $1`, [F1])
    expect((await as(null, `select id from public.files`)).rows).toHaveLength(0)
    await as(ADMIN, `update public.files set deleted_at = null where id = $1`, [F1])
    expect((await as(null, `select id from public.files`)).rows).toHaveLength(1)
  })

  it('lists users with emails for admins only', async () => {
    const r = await as(ADMIN, `select email, role from public.admin_users() order by email`)
    expect(r.rows.map((x) => x.email)).toEqual(['a@x.in', 'b@x.in', 'owner@x.in'])
    await fails(A, `select * from public.admin_users()`)
    await fails(null, `select * from public.admin_users()`)
  })

  it('blocks a banned person from uploading and commenting, and only admins can ban', async () => {
    await fails(A, `select public.set_user_banned($1, true)`, [B])
    await fails(B, `update public.profiles set banned_at = now() where id = $1`, [B])
    await as(ADMIN, `select public.set_user_banned($1, true)`, [B])
    await fails(B, `insert into public.comments (file_id, author_id, body) values ($1, $2, 'spam')`, [F1, B])
    await fails(B, `insert into public.collections (owner_id, subject_code, unit) values ($1, '25ES1IT102', 1)`, [B])
    await fails(B, `insert into storage.objects (bucket_id, name) values ('notes', $1)`, [`${B}/x/y/z.pdf`])
    // still able to read
    expect((await as(B, `select id from public.files`)).rows).toHaveLength(1)
    await as(ADMIN, `select public.set_user_banned($1, false)`, [B])
    await as(B, `insert into public.comments (file_id, author_id, body) values ($1, $2, 'back') returning id`, [F1, B])
  })

  it('does not let an admin block themselves or drop their own admin role', async () => {
    await fails(ADMIN, `select public.set_user_banned($1, true)`, [ADMIN])
    await fails(ADMIN, `select public.set_user_role($1, 'member')`, [ADMIN])
  })

  it('lets admins promote and demote others; members cannot', async () => {
    await fails(A, `select public.set_user_role($1, 'admin')`, [A])
    await as(ADMIN, `select public.set_user_role($1, 'admin')`, [A])
    expect((await db.query(`select role from public.profiles where id = '${A}'`)).rows[0]).toEqual({ role: 'admin' })
    await as(ADMIN, `select public.set_user_role($1, 'member')`, [A])
  })

  it('deletes forever only hidden files, only for admins, and lets admins remove the bytes', async () => {
    await fails(ADMIN, `select public.admin_purge_file($1)`, [F1]) // still visible
    await as(A, `update public.files set deleted_at = now() where id = $1`, [F1])
    await fails(A, `select public.admin_purge_file($1)`, [F1])
    const r = await as(ADMIN, `select public.admin_purge_file($1) as paths`, [F1])
    expect(r.rows[0]!.paths).toEqual([path(A, colA, F1)])
    expect((await db.query(`select count(*)::int as n from public.files`)).rows[0]).toEqual({ n: 0 })
    expect((await db.query(`select count(*)::int as n from public.comments`)).rows[0]).toEqual({ n: 0 })
    expect((await as(A, `delete from storage.objects returning id`)).rows).toHaveLength(0)
    expect((await as(ADMIN, `delete from storage.objects returning id`)).rows).toHaveLength(1)
  })
})

describe('admin dashboard', () => {
  it('records sign-ins for the signed-in person only, ignoring rapid repeats', async () => {
    await as(A, `select public.record_login('password', 'mobile')`)
    await as(A, `select public.record_login('password', 'mobile')`)
    await as(B, `select public.record_login('google', 'phone-ish')`)
    await fails(null, `select public.record_login('password', 'desktop')`)
    const r = await db.query(`select user_id, method, device from public.login_events order by id`)
    expect(r.rows).toEqual([
      { user_id: A, method: 'password', device: 'mobile' },
      { user_id: B, method: 'google', device: 'desktop' },
    ])
  })

  it('keeps sign-in history private to admins', async () => {
    await fails(A, `select * from public.login_events`)
    await fails(A, `select public.admin_overview()`)
    await fails(A, `select * from public.admin_recent_logins(10)`)
    await fails(A, `select * from public.admin_people()`)
    await fails(A, `select * from public.admin_user_logins($1)`, [B])
    await fails(A, `select * from public.admin_daily(7)`)
  })

  it('gives admins totals, daily activity, people and history', async () => {
    const o = (await as(ADMIN, `select public.admin_overview() as o`)).rows[0]!.o as Record<string, number>
    expect(o.members).toBe(3)
    expect(o.active_7d).toBe(2)
    const daily = await as(ADMIN, `select * from public.admin_daily(30)`)
    expect(daily.rows).toHaveLength(30)
    expect(daily.rows.reduce((n, r) => n + Number(r.signins), 0)).toBe(2)
    const people = await as(ADMIN, `select email, sign_ins from public.admin_people() order by email`)
    expect(people.rows.map((r) => [r.email, Number(r.sign_ins)])).toEqual([['a@x.in', 1], ['b@x.in', 1], ['owner@x.in', 0]])
    const recent = await as(ADMIN, `select email from public.admin_recent_logins(10)`)
    expect(recent.rows).toHaveLength(2)
    expect((await as(ADMIN, `select * from public.admin_user_logins($1)`, [A])).rows).toHaveLength(1)
  })
})

describe('google drive links', () => {
  const L1 = 'cccccccc-0000-4000-8000-000000000001'
  const L2 = 'cccccccc-0000-4000-8000-000000000002'
  const DRIVE = '1kZqdo_2yHP24dDkfNLxCk-CqCj2yAYMy'
  const insert = `insert into public.files (id, collection_id, owner_id, drive_id, name, mime) values ($1, $2, $3, $4, 'ODE notes', $5)`

  it('lets someone add a Drive link to their own shelf without using storage', async () => {
    await as(A, insert, [L1, colA, A, DRIVE, 'application/vnd.google-apps.file'])
    const r = await db.query(`select storage_path, size_bytes, drive_id from public.files where id = '${L1}'`)
    expect(r.rows[0]).toEqual({ storage_path: null, size_bytes: null, drive_id: DRIVE })
    expect((await as(null, `select id from public.files where id = $1`, [L1])).rows).toHaveLength(1)
  })

  it('accepts folders, Google Docs, Sheets and Slides', async () => {
    for (const [i, mime] of ['folder', 'document', 'spreadsheet', 'presentation'].entries()) {
      const id = `cccccccc-0000-4000-8000-00000000010${i}`
      await as(A, insert, [id, colA, A, DRIVE, `application/vnd.google-apps.${mime}`])
    }
  })

  it('refuses links on someone else’s shelf, from anonymous users, and for blocked people', async () => {
    await fails(B, insert, [L2, colA, B, DRIVE, 'application/vnd.google-apps.file'])
    await fails(null, insert, [L2, colA, A, DRIVE, 'application/vnd.google-apps.file'])
    await as(ADMIN, `select public.set_user_banned($1, true)`, [A])
    await fails(A, insert, [L2, colA, A, DRIVE, 'application/vnd.google-apps.file'])
    await as(ADMIN, `select public.set_user_banned($1, false)`, [A])
  })

  it('rejects malformed rows: both sources, no source, wrong type, bad id', async () => {
    await fails(A, `insert into public.files (id, collection_id, owner_id, drive_id, storage_path, name, mime, size_bytes) values ($1, $2, $3, $4, $5, 'x', 'application/pdf', 10)`,
      [L2, colA, A, DRIVE, path(A, colA, L2)])
    await fails(A, `insert into public.files (id, collection_id, owner_id, name, mime) values ($1, $2, $3, 'x', 'application/vnd.google-apps.file')`, [L2, colA, A])
    await fails(A, insert, [L2, colA, A, DRIVE, 'application/pdf'])
    await fails(A, insert, [L2, colA, A, 'short', 'application/vnd.google-apps.file'])
    await fails(A, insert, [L2, colA, A, "bad id with spaces & symbols!", 'application/vnd.google-apps.file'])
    await fails(A, insert, [L2, colA, A, DRIVE, 'text/html'])
  })

  it('cannot be pointed at a different Drive file afterwards', async () => {
    await fails(A, `update public.files set drive_id = '1AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' where id = $1`, [L1])
  })

  it('can be hidden by its owner, and permanently deleted by an admin once hidden', async () => {
    await as(A, `update public.files set deleted_at = now() where id = $1`, [L1])
    expect((await as(null, `select id from public.files where id = $1`, [L1])).rows).toHaveLength(0)
    const r = await as(ADMIN, `select public.admin_purge_file($1) as paths`, [L1])
    expect(r.rows[0]!.paths).toEqual([])
    expect((await db.query(`select count(*)::int as n from public.files where id = '${L1}'`)).rows[0]).toEqual({ n: 0 })
  })
})

describe('duplicate fingerprints', () => {
  const H = 'a'.repeat(64)
  const F = 'eeeeeeee-0000-4000-8000-000000000001'
  it('lets an uploader store a fingerprint and everyone look it up', async () => {
    const col = (await as(A, `select id from public.collections where owner_id = $1 limit 1`, [A])).rows[0]!.id as string
    await as(A, `insert into public.files (id, collection_id, owner_id, storage_path, name, mime, size_bytes, content_hash) values ($1, $2, $3, $4, 'Hashed', 'application/pdf', 1, $5)`,
      [F, col, A, path(A, col, F), H])
    expect((await as(null, `select id from public.files where content_hash = $1 and deleted_at is null`, [H])).rows).toHaveLength(1)
  })
  it('rejects a malformed fingerprint and does not let it be rewritten later', async () => {
    const col = (await as(A, `select id from public.collections where owner_id = $1 limit 1`, [A])).rows[0]!.id as string
    const G = 'eeeeeeee-0000-4000-8000-000000000002'
    await fails(A, `insert into public.files (id, collection_id, owner_id, storage_path, name, mime, size_bytes, content_hash) values ($1, $2, $3, $4, 'Bad', 'application/pdf', 1, 'not-a-hash')`,
      [G, col, A, path(A, col, G)])
    await fails(A, `update public.files set content_hash = $2 where id = $1`, [F, 'b'.repeat(64)])
  })
})

describe('community features', () => {
  const FV = 'ffffffff-0000-4000-8000-000000000001'
  let shelfA = ''
  let commentOnFv = ''

  it('allows the question-papers (6) and question-bank (7) shelves and nothing beyond', async () => {
    const ok = await as(A, `insert into public.collections (owner_id, subject_code, unit) values ($1, '25ES1CS101', 6) returning id`, [A])
    expect(ok.rows).toHaveLength(1)
    const bank = await as(A, `insert into public.collections (owner_id, subject_code, unit) values ($1, '25ES1CS101', 7) returning id`, [A])
    expect(bank.rows).toHaveLength(1)
    await fails(A, `insert into public.collections (owner_id, subject_code, unit) values ($1, '25ES1CS101', 8)`, [A])
  })

  it('lets members mark a note helpful, once, and never their own', async () => {
    const col = (await as(A, `select id from public.collections where owner_id = $1 and unit = 6`, [A])).rows[0]!.id as string
    shelfA = col
    await as(A, `insert into public.files (id, collection_id, owner_id, storage_path, name, mime, size_bytes) values ($1, $2, $3, $4, 'Paper', 'application/pdf', 1000)`,
      [FV, col, A, path(A, col, FV)])
    await as(B, `insert into public.file_votes (file_id, user_id) values ($1, $2)`, [FV, B])
    await fails(B, `insert into public.file_votes (file_id, user_id) values ($1, $2)`, [FV, B])
    await fails(A, `insert into public.file_votes (file_id, user_id) values ($1, $2)`, [FV, A])
    await fails(B, `insert into public.file_votes (file_id, user_id) values ($1, $2)`, [FV, A])
    // anyone can see the count
    expect((await as(null, `select count(*)::int as n from public.file_votes where file_id = $1`, [FV])).rows[0]).toEqual({ n: 1 })
    // only you can take your own vote back
    const nope = await as(A, `delete from public.file_votes where file_id = $1 returning user_id`, [FV])
    expect(nope.rows).toHaveLength(0)
    await as(B, `delete from public.file_votes where file_id = $1 and user_id = $2`, [FV, B])
    expect((await as(null, `select count(*)::int as n from public.file_votes where file_id = $1`, [FV])).rows[0]).toEqual({ n: 0 })
  })

  it('keeps saved notes private', async () => {
    await as(B, `insert into public.bookmarks (user_id, file_id) values ($1, $2)`, [B, FV])
    expect((await as(B, `select file_id from public.bookmarks`)).rows).toHaveLength(1)
    expect((await as(A, `select file_id from public.bookmarks`)).rows).toHaveLength(0)
    expect((await as(null, `select file_id from public.bookmarks`).catch(() => ({ rows: [] }))).rows).toHaveLength(0)
    await fails(A, `insert into public.bookmarks (user_id, file_id) values ($1, $2)`, [B, FV])
  })

  it('takes reports from signed-in members and shows them only to the reporter and staff', async () => {
    const c = await as(A, `insert into public.comments (file_id, author_id, body) values ($1, $2, 'rude') returning id`, [FV, A])
    commentOnFv = c.rows[0]!.id as string
    await as(B, `insert into public.reports (reporter_id, file_id, reason) values ($1, $2, 'low_quality')`, [B, FV])
    await as(B, `insert into public.reports (reporter_id, comment_id, reason, details) values ($1, $2, 'spam', 'link farm')`, [B, commentOnFv])
    // one open report per person per note
    await fails(B, `insert into public.reports (reporter_id, file_id, reason) values ($1, $2, 'duplicate')`, [B, FV])
    // exactly one target, honest reporter, known reason
    await fails(B, `insert into public.reports (reporter_id, reason) values ($1, 'spam')`, [B])
    await fails(B, `insert into public.reports (reporter_id, file_id, comment_id, reason) values ($1, $2, $3, 'spam')`, [B, FV, commentOnFv])
    await fails(B, `insert into public.reports (reporter_id, file_id, reason) values ($1, $2, 'low_quality')`, [A, FV])
    await fails(B, `insert into public.reports (reporter_id, file_id, reason) values ($1, $2, 'because')`, [B, FV])
    // privacy: the uploader cannot see who reported them
    expect((await as(A, `select id from public.reports`)).rows).toHaveLength(0)
    expect((await as(B, `select id from public.reports`)).rows).toHaveLength(2)
    expect((await as(ADMIN, `select id from public.reports`)).rows).toHaveLength(2)
    await fails(B, `select public.resolve_reports($1)`, [FV])
    await as(ADMIN, `select public.resolve_reports($1, null)`, [FV])
    expect((await as(ADMIN, `select id from public.reports where resolved_at is null`)).rows).toHaveLength(1)
    // once resolved, the same person may report it again
    await as(B, `insert into public.reports (reporter_id, file_id, reason) values ($1, $2, 'duplicate')`, [B, FV])
    void shelfA
  })
})

describe('requests, follows and announcements', () => {
  it('lets members ask for a chapter, publicly, once, and close their own request', async () => {
    await as(B, `insert into public.note_requests (requester_id, subject_code, unit, message) values ($1, '25ES1CS101', 3, 'exam soon')`, [B])
    await fails(B, `insert into public.note_requests (requester_id, subject_code, unit) values ($1, '25ES1CS101', 3)`, [B])
    await fails(B, `insert into public.note_requests (requester_id, subject_code, unit) values ($1, '25ES1CS101', 3)`, [A])
    await fails(B, `insert into public.note_requests (requester_id, subject_code, unit) values ($1, '25ES1CS101', 9)`, [B])
    expect((await as(null, `select id from public.note_requests where closed_at is null`)).rows).toHaveLength(1)
    // someone else cannot close it, the requester can
    const nope = await as(A, `update public.note_requests set closed_at = now() where requester_id = $1 returning id`, [B])
    expect(nope.rows).toHaveLength(0)
    const ok = await as(B, `update public.note_requests set closed_at = now() where requester_id = $1 returning id`, [B])
    expect(ok.rows).toHaveLength(1)
    // once closed they can ask again
    await as(B, `insert into public.note_requests (requester_id, subject_code, unit) values ($1, '25ES1CS101', 3)`, [B])
  })

  it('keeps followed subjects private', async () => {
    await as(B, `insert into public.follows (user_id, subject_code) values ($1, '25ES1CS101')`, [B])
    expect((await as(B, `select subject_code from public.follows`)).rows).toHaveLength(1)
    expect((await as(A, `select subject_code from public.follows`)).rows).toHaveLength(0)
    await fails(A, `insert into public.follows (user_id, subject_code) values ($1, '25ES1CS101')`, [B])
    await as(B, `delete from public.follows where user_id = $1`, [B])
    expect((await as(B, `select subject_code from public.follows`)).rows).toHaveLength(0)
  })

  it('lets only staff post announcements; everyone reads the active ones', async () => {
    await fails(B, `insert into public.announcements (message, created_by) values ('hi', $1)`, [B])
    await as(ADMIN, `insert into public.announcements (message, link, created_by) values ('Mid-2 papers are up', '/requests', $1)`, [ADMIN])
    // unsafe links are refused
    await fails(ADMIN, `insert into public.announcements (message, link, created_by) values ('x', '//evil.example', $1)`, [ADMIN])
    await fails(ADMIN, `insert into public.announcements (message, link, created_by) values ('x', 'javascript:alert(1)', $1)`, [ADMIN])
    expect((await as(null, `select message from public.announcements where active`)).rows).toHaveLength(1)
    const off = await as(B, `update public.announcements set active = false returning id`)
    expect(off.rows).toHaveLength(0)
    await as(ADMIN, `update public.announcements set active = false`)
    expect((await as(null, `select message from public.announcements where active`)).rows).toHaveLength(0)
  })
})

describe('visitor counter', () => {
  const V1 = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa'
  const V2 = 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb'

  it('lets any browser report a visit but never read the table', async () => {
    await as(null, `select public.record_visit($1)`, [V1])
    await as(null, `select public.record_visit($1)`, [V1])
    await as(B, `select public.record_visit($1)`, [V2])
    await fails(null, `select * from public.site_visits`)
    await fails(B, `select * from public.site_visits`)
    await fails(null, `update public.site_visits set views = 0`)
  })

  it('shows totals to the admin only', async () => {
    await fails(B, `select public.admin_visits(7)`)
    await fails(null, `select public.admin_visits(7)`)
    const r = await as(ADMIN, `select public.admin_visits(7) as v`)
    const v = r.rows[0]!.v as { today: number; all_time: number; views_all: number; daily: { visitors: number }[] }
    expect(Number(v.today)).toBe(2)
    expect(Number(v.all_time)).toBe(2)
    expect(Number(v.views_all)).toBe(3)
    expect(v.daily).toHaveLength(7)
  })
})

describe('suggestion box', () => {
  it('lets members suggest, keeps them private, and lets staff read and mark them', async () => {
    await as(B, `insert into public.suggestions (author_id, category, body) values ($1, 'feature', 'Please add a dark mode toggle')`, [B])
    await fails(B, `insert into public.suggestions (author_id, category, body) values ($1, 'feature', 'sent as someone else')`, [A])
    await fails(B, `insert into public.suggestions (author_id, category, body) values ($1, 'rant', 'unknown category here')`, [B])
    await fails(B, `insert into public.suggestions (author_id, category, body) values ($1, 'bug', 'abc')`, [B])
    await fails(null, `select * from public.suggestions`)
    expect((await as(A, `select id from public.suggestions`)).rows).toHaveLength(0)
    expect((await as(B, `select id from public.suggestions`)).rows).toHaveLength(1)
    expect((await as(ADMIN, `select id from public.suggestions`)).rows).toHaveLength(1)
    // the author cannot mark their own as done; staff can
    const own = await as(B, `update public.suggestions set status = 'done' where author_id = $1 returning id`, [B])
    expect(own.rows).toHaveLength(0)
    const staff = await as(ADMIN, `update public.suggestions set status = 'seen' returning id`)
    expect(staff.rows).toHaveLength(1)
  })

  it('stops a flood: ten a day', async () => {
    for (let i = 0; i < 9; i++) {
      await as(B, `insert into public.suggestions (author_id, category, body) values ($1, 'other', 'suggestion number ${i}')`, [B])
    }
    await fails(B, `insert into public.suggestions (author_id, category, body) values ($1, 'other', 'one too many today')`, [B])
  })
})

describe('moderator role', () => {
  const MOD = '44444444-4444-4444-8444-444444444444'
  const M1 = 'dddddddd-0000-4000-8000-000000000001'
  let shelf = ''
  let commentId = ''

  it('can be assigned only by an admin', async () => {
    await db.exec(`insert into auth.users (id, email) values ('${MOD}', 'mod@x.in')`)
    await db.exec(`insert into public.profiles (id, display_name) values ('${MOD}', 'Moderator')`)
    await fails(A, `select public.set_user_role($1, 'moderator')`, [MOD])
    await fails(MOD, `select public.set_user_role($1, 'admin')`, [MOD])
    await as(ADMIN, `select public.set_user_role($1, 'moderator')`, [MOD])
    expect((await db.query(`select role from public.profiles where id = '${MOD}'`)).rows[0]).toEqual({ role: 'moderator' })
    await fails(ADMIN, `select public.set_user_role($1, 'overlord')`, [MOD])
    await fails(MOD, `update public.profiles set role = 'admin' where id = $1`, [MOD])
  })

  it('can hide and restore anyone’s file, and see hidden ones', async () => {
    const r = await as(A, `insert into public.collections (owner_id, subject_code, unit) values ($1, '25ES1CS101', 1) returning id`, [A])
    shelf = r.rows[0]!.id as string
    await as(A, `insert into public.files (id, collection_id, owner_id, storage_path, name, mime, size_bytes) values ($1, $2, $3, $4, 'Notes', 'application/pdf', 1000)`,
      [M1, shelf, A, path(A, shelf, M1)])
    await as(MOD, `update public.files set deleted_at = now() where id = $1`, [M1])
    expect((await as(null, `select id from public.files where id = $1`, [M1])).rows).toHaveLength(0)
    expect((await as(MOD, `select id from public.files where id = $1`, [M1])).rows).toHaveLength(1)
    await as(MOD, `update public.files set deleted_at = null where id = $1`, [M1])
    expect((await as(null, `select id from public.files where id = $1`, [M1])).rows).toHaveLength(1)
    // an ordinary member still cannot
    const nope = await as(B, `update public.files set deleted_at = now() where id = $1 returning id`, [M1])
    expect(nope.rows).toHaveLength(0)
  })

  it('can rename anyone’s file; members can rename only their own', async () => {
    await as(MOD, `update public.files set name = 'Renamed by mod' where id = $1`, [M1])
    expect((await as(null, `select name from public.files where id = $1`, [M1])).rows[0]).toEqual({ name: 'Renamed by mod' })
    await as(A, `update public.files set name = 'Mine again' where id = $1`, [M1])
    const nope = await as(B, `update public.files set name = 'Hijacked' where id = $1 returning id`, [M1])
    expect(nope.rows).toHaveLength(0)
    expect((await as(null, `select name from public.files where id = $1`, [M1])).rows[0]).toEqual({ name: 'Mine again' })
  })

  it('can hide a shelf and remove any comment', async () => {
    await as(MOD, `select public.set_collection_hidden($1, true)`, [shelf])
    expect((await as(null, `select id from public.collections where id = $1`, [shelf])).rows).toHaveLength(0)
    await as(MOD, `select public.set_collection_hidden($1, false)`, [shelf])
    await fails(B, `select public.set_collection_hidden($1, true)`, [shelf])
    const c = await as(B, `insert into public.comments (file_id, author_id, body) values ($1, $2, 'spam link') returning id`, [M1, B])
    commentId = c.rows[0]!.id as string
    await as(MOD, `update public.comments set deleted_at = now() where id = $1`, [commentId])
    expect((await as(null, `select id from public.comments where id = $1`, [commentId])).rows).toHaveLength(0)
  })

  it('can block and unblock members, but not admins or other moderators', async () => {
    await as(MOD, `select public.set_user_banned($1, true)`, [B])
    await fails(B, `insert into public.comments (file_id, author_id, body) values ($1, $2, 'x')`, [M1, B])
    await as(MOD, `select public.set_user_banned($1, false)`, [B])
    await fails(MOD, `select public.set_user_banned($1, true)`, [ADMIN])
    await fails(MOD, `select public.set_user_banned($1, true)`, [MOD])
    await as(ADMIN, `select public.set_user_banned($1, true)`, [MOD])
    await as(ADMIN, `select public.set_user_banned($1, false)`, [MOD])
  })

  it('cannot delete forever, read emails, or see the dashboard and sign-in log', async () => {
    await as(MOD, `update public.files set deleted_at = now() where id = $1`, [M1])
    await fails(MOD, `select public.admin_purge_file($1)`, [M1])
    await fails(MOD, `select * from public.admin_users()`)
    await fails(MOD, `select * from public.admin_people()`)
    await fails(MOD, `select public.admin_overview()`)
    await fails(MOD, `select * from public.admin_recent_logins(5)`)
    await fails(MOD, `select * from public.login_events`)
    await fails(MOD, `delete from public.files where id = $1`, [M1])
    await as(MOD, `update public.files set deleted_at = null where id = $1`, [M1])
  })

  it('gets a people list without emails, and members get nothing', async () => {
    const r = await as(MOD, `select * from public.staff_people()`)
    expect(r.rows.length).toBeGreaterThanOrEqual(4)
    expect(Object.keys(r.rows[0]!)).not.toContain('email')
    await fails(A, `select * from public.staff_people()`)
    await fails(null, `select * from public.staff_people()`)
  })

  it('leaves public reading unchanged for visitors who are not signed in', async () => {
    expect((await as(null, `select id from public.files where id = $1`, [M1])).rows).toHaveLength(1)
    expect((await as(null, `select id from public.collections where id = $1`, [shelf])).rows).toHaveLength(1)
  })
})

describe('reports: broken reason, automatic hiding after five people, storage figure', () => {
  const R = (n: number) => `aaaaaaaa-0000-4000-8000-00000000000${n}`
  const FILE = 'bbbbbbbb-0000-4000-8000-000000000001'
  const COL = 'bbbbbbbb-0000-4000-8000-0000000000c1'

  it('hides a note once five different people reported it, and not before', async () => {
    for (let n = 1; n <= 5; n++) {
      await db.exec(`insert into auth.users (id, email) values ('${R(n)}', 'r${n}@x.in')`)
      await db.exec(`insert into public.profiles (id, display_name) values ('${R(n)}', 'Reporter ${n}')`)
    }
    await db.exec(`insert into public.collections (id, owner_id, subject_code, unit) values ('${COL}', '${A}', '25ES1IT102', 4)`)
    await db.exec(
      `insert into public.files (id, collection_id, owner_id, storage_path, name, mime, size_bytes)
       values ('${FILE}', '${COL}', '${A}', '${A}/${COL}/${FILE}/notes.pdf', 'Reported note', 'application/pdf', 100)`,
    )
    for (let n = 1; n <= 4; n++) {
      await as(R(n), `insert into public.reports (reporter_id, file_id, reason) values ($1, $2, 'broken')`, [R(n), FILE])
    }
    const before = await db.query<{ deleted_at: string | null }>(`select deleted_at from public.files where id = '${FILE}'`)
    expect(before.rows[0]!.deleted_at).toBeNull()
    await as(R(5), `insert into public.reports (reporter_id, file_id, reason) values ($1, $2, 'broken')`, [R(5), FILE])
    const after = await db.query<{ deleted_at: string | null }>(`select deleted_at from public.files where id = '${FILE}'`)
    expect(after.rows[0]!.deleted_at).not.toBeNull()
  })

  it('does not count one person reporting more than once', async () => {
    const F2 = 'bbbbbbbb-0000-4000-8000-000000000002'
    await db.exec(
      `insert into public.files (id, collection_id, owner_id, storage_path, name, mime, size_bytes)
       values ('${F2}', '${COL}', '${A}', '${A}/${COL}/${F2}/notes.pdf', 'Another note', 'application/pdf', 100)`,
    )
    await as(R(1), `insert into public.reports (reporter_id, file_id, reason) values ($1, $2, 'spam')`, [R(1), F2])
    await fails(R(1), `insert into public.reports (reporter_id, file_id, reason) values ($1, $2, 'other')`, [R(1), F2])
    const r = await db.query<{ deleted_at: string | null }>(`select deleted_at from public.files where id = '${F2}'`)
    expect(r.rows[0]!.deleted_at).toBeNull()
  })
})

describe('staff move a note to another subject or chapter', () => {
  const MV_COL = 'cccccccc-0000-4000-8000-0000000000c1'
  const MV_FILE = 'cccccccc-0000-4000-8000-000000000001'
  const MOD2 = 'cccccccc-0000-4000-8000-0000000000a1'

  it('lets a moderator move a member note, but not an owner doing it by plain update', async () => {
    await db.exec(`insert into auth.users (id, email) values ('${MOD2}', 'mod2@x.in')`)
    await db.exec(`insert into public.profiles (id, display_name, role) values ('${MOD2}', 'Mod Two', 'moderator')`)
    await db.exec(`insert into public.collections (id, owner_id, subject_code, unit) values ('${MV_COL}', '${B}', '25ES1CS102', 1)`)
    await db.exec(
      `insert into public.files (id, collection_id, owner_id, storage_path, name, mime, size_bytes)
       values ('${MV_FILE}', '${MV_COL}', '${B}', '${B}/${MV_COL}/${MV_FILE}/notes.pdf', 'Movable', 'application/pdf', 100)`,
    )
    // The owner cannot move it with a plain update (the guard still blocks that)
    await fails(B, `update public.files set collection_id = $1 where id = $2`, [MV_COL, MV_FILE])
    // A member cannot call the staff function
    await fails(A, `select public.staff_move_file($1, '25ES1CS103', 2)`, [MV_FILE])
    // A moderator can
    const moved = await as(MOD2, `select public.staff_move_file($1, '25ES1CS103', 2) as id`, [MV_FILE])
    const targetCol = moved.rows[0]!.id as string
    expect(targetCol).not.toBe(MV_COL)
    const row = await db.query<{ collection_id: string }>(`select collection_id from public.files where id = '${MV_FILE}'`)
    expect(row.rows[0]!.collection_id).toBe(targetCol)
    const col = await db.query<{ owner_id: string; subject_code: string; unit: number }>(`select owner_id, subject_code, unit from public.collections where id = '${targetCol}'`)
    expect(col.rows[0]).toMatchObject({ owner_id: B, subject_code: '25ES1CS103', unit: 2 })
  })

  it('stops a moderator moving staff notes, and rejects a bad chapter', async () => {
    const adminCol = 'cccccccc-0000-4000-8000-0000000000c2'
    const adminFile = 'cccccccc-0000-4000-8000-000000000002'
    await db.exec(`insert into public.collections (id, owner_id, subject_code, unit) values ('${adminCol}', '${ADMIN}', '25ES1CS102', 3)`)
    await db.exec(
      `insert into public.files (id, collection_id, owner_id, storage_path, name, mime, size_bytes)
       values ('${adminFile}', '${adminCol}', '${ADMIN}', '${ADMIN}/${adminCol}/${adminFile}/notes.pdf', 'Admin note', 'application/pdf', 100)`,
    )
    await fails(MOD2, `select public.staff_move_file($1, '25ES1CS103', 2)`, [adminFile])
    await as(ADMIN, `select public.staff_move_file($1, '25ES1CS103', 3)`, [adminFile])
    await fails(ADMIN, `select public.staff_move_file($1, '25ES1CS103', 9)`, [adminFile])
  })
})

describe('owner powers', () => {
  const ADMIN2 = 'dddddddd-0000-4000-8000-0000000000a1'
  const VICTIM = 'dddddddd-0000-4000-8000-0000000000b1'
  const OC = '99999999-0000-4000-8000-0000000000c1'
  const OF = '99999999-0000-4000-8000-000000000001'

  it('knows who the owner is, and only that account', async () => {
    await db.exec(`insert into public.site_owners (email) values ('owner@x.in') on conflict do nothing`)
    await db.exec(`insert into auth.users (id, email) values ('${ADMIN2}', 'admin2@x.in'), ('${VICTIM}', 'victim@x.in')`)
    await db.exec(`insert into public.profiles (id, display_name, role) values ('${ADMIN2}', 'Second Admin', 'admin'), ('${VICTIM}', 'Victim', 'member')`)
    expect((await as(ADMIN, `select public.is_owner() as o`)).rows[0]!.o).toBe(true)
    expect((await as(ADMIN2, `select public.is_owner() as o`)).rows[0]!.o).toBe(false)
    expect((await as(A, `select public.is_owner() as o`)).rows[0]!.o).toBe(false)
    await fails(null, `select public.is_owner()`)
    // the owner list itself cannot be read or edited through the API
    await fails(ADMIN, `select * from public.site_owners`)
    await fails(ADMIN, `insert into public.site_owners (email) values ('x@x.in')`)
  })

  it('lets only the owner make or remove admins', async () => {
    await fails(ADMIN2, `select public.set_user_role($1, 'admin')`, [VICTIM])
    await as(ADMIN2, `select public.set_user_role($1, 'moderator')`, [VICTIM])
    await as(ADMIN, `select public.set_user_role($1, 'admin')`, [VICTIM])
    await fails(ADMIN2, `select public.set_user_role($1, 'member')`, [VICTIM])
    await as(ADMIN, `select public.set_user_role($1, 'member')`, [VICTIM])
  })

  it('protects the owner from being blocked or demoted, and admins from other admins', async () => {
    await fails(ADMIN2, `select public.set_user_banned($1, true)`, [ADMIN])
    await fails(ADMIN2, `select public.set_user_role($1, 'member')`, [ADMIN])
    await fails(ADMIN, `select public.set_user_role($1, 'member')`, [ADMIN])
    await fails(ADMIN2, `select public.set_user_banned($1, true)`, [VICTIM]).catch(() => undefined)
    await as(ADMIN, `select public.set_user_role($1, 'admin')`, [VICTIM])
    await fails(ADMIN2, `select public.set_user_banned($1, true)`, [VICTIM])
    await as(ADMIN, `select public.set_user_banned($1, true)`, [VICTIM])
    await as(ADMIN, `select public.set_user_banned($1, false)`, [VICTIM])
    await as(ADMIN, `select public.set_user_role($1, 'member')`, [VICTIM])
  })

  it('lets only the owner delete a file forever', async () => {
    await db.exec(`insert into public.collections (id, owner_id, subject_code, unit) values ('${OC}', '${A}', '25ES1CS104', 1)`)
    await db.exec(
      `insert into public.files (id, collection_id, owner_id, storage_path, name, mime, size_bytes, deleted_at)
       values ('${OF}', '${OC}', '${A}', '${A}/${OC}/${OF}/notes.pdf', 'Doomed', 'application/pdf', 100, now())`,
    )
    await fails(ADMIN2, `select public.admin_purge_file($1)`, [OF])
    const paths = await as(ADMIN, `select public.admin_purge_file($1) as p`, [OF])
    expect(paths.rows).toHaveLength(1)
  })
})

describe('question tags', () => {
  const TC = '88888888-0000-4000-8000-0000000000c1'
  const TF = '88888888-0000-4000-8000-000000000001'
  const TMOD = '88888888-0000-4000-8000-0000000000a1'

  it('lets staff tag a note as questions, and nobody else', async () => {
    await db.exec(`insert into auth.users (id, email) values ('${TMOD}', 'tagmod@x.in')`)
    await db.exec(`insert into public.profiles (id, display_name, role) values ('${TMOD}', 'Tag Mod', 'moderator')`)
    await db.exec(`insert into public.collections (id, owner_id, subject_code, unit) values ('${TC}', '${B}', '25ES1CS105', 2)`)
    await db.exec(
      `insert into public.files (id, collection_id, owner_id, storage_path, name, mime, size_bytes)
       values ('${TF}', '${TC}', '${B}', '${B}/${TC}/${TF}/notes.pdf', 'Unit 2 questions', 'application/pdf', 100)`,
    )
    await fails(B, `select public.staff_set_file_tag($1, 'questions', true)`, [TF])
    await fails(null, `select public.staff_set_file_tag($1, 'questions', true)`, [TF])
    await fails(B, `update public.files set tags = array['questions'] where id = $1`, [TF])
    await fails(TMOD, `select public.staff_set_file_tag($1, 'anything', true)`, [TF])
    const on = await as(TMOD, `select public.staff_set_file_tag($1, 'questions', true) as t`, [TF])
    expect(on.rows[0]!.t).toEqual(['questions'])
    const twice = await as(TMOD, `select public.staff_set_file_tag($1, 'questions', true) as t`, [TF])
    expect(twice.rows[0]!.t).toEqual(['questions'])
    const off = await as(TMOD, `select public.staff_set_file_tag($1, 'questions', false) as t`, [TF])
    expect(off.rows[0]!.t).toEqual([])
  })
})

describe('admins move Google Drive library files', () => {
  const DRIVE_ID = '1p6KUg1olQgaUrA1b8M8KQIDulXp9X1v_'

  it('lets admins place a library file somewhere else; everyone can read where it is', async () => {
    await fails(B, `select public.staff_move_drive_file($1, '25BS1PH102', 7)`, [DRIVE_ID])
    await fails(null, `select public.staff_move_drive_file($1, '25BS1PH102', 7)`, [DRIVE_ID])
    await fails(ADMIN, `select public.staff_move_drive_file($1, 'bad code', 7)`, [DRIVE_ID])
    await fails(ADMIN, `select public.staff_move_drive_file($1, '25BS1PH102', 9)`, [DRIVE_ID])
    await as(ADMIN, `select public.staff_move_drive_file($1, '25BS1PH102', 7)`, [DRIVE_ID])
    await as(ADMIN, `select public.staff_move_drive_file($1, '25BS1PH102', 3)`, [DRIVE_ID])
    const seen = await as(null, `select subject_code, unit from public.drive_placements where file_id = $1`, [DRIVE_ID])
    expect(seen.rows).toEqual([{ subject_code: '25BS1PH102', unit: 3 }])
    await fails(B, `insert into public.drive_placements (file_id, subject_code, unit) values ('abcdefghijk', '25BS1PH102', 1)`)
  })
})

describe('admins retitle Google Drive library files', () => {
  const DRIVE_ID = '1p6KUg1olQgaUrA1b8M8KQIDulXp9X1v_'

  it('lets admins set a title; everyone can read it', async () => {
    await fails(B, `select public.staff_rename_drive_file($1, 'EDC · Mid 1 2025')`, [DRIVE_ID])
    await fails(null, `select public.staff_rename_drive_file($1, 'EDC · Mid 1 2025')`, [DRIVE_ID])
    await fails(ADMIN, `select public.staff_rename_drive_file($1, '   ')`, [DRIVE_ID])
    await as(ADMIN, `select public.staff_rename_drive_file($1, 'EDC · Mid 1 2025')`, [DRIVE_ID])
    await as(ADMIN, `select public.staff_rename_drive_file($1, 'EDC · Sem 2025')`, [DRIVE_ID])
    const seen = await as(null, `select title from public.drive_titles where file_id = $1`, [DRIVE_ID])
    expect(seen.rows).toEqual([{ title: 'EDC · Sem 2025' }])
    await fails(B, `insert into public.drive_titles (file_id, title) values ('abcdefghijk', 'x')`)
  })
})

describe("a member's branch", () => {
  it('is set by the member (kept when asked), corrected by staff, and never by anyone else', async () => {
    await fails(null, `select public.set_my_branch('ece')`)
    await fails(A, `select public.set_my_branch('Not A Branch')`)
    await as(A, `select public.set_my_branch('cse-aiml')`)
    await as(A, `select public.set_my_branch('rai', true)`)
    expect((await as(null, `select branch from public.profiles where id = $1`, [A])).rows).toEqual([{ branch: 'cse-aiml' }])
    await fails(A, `update public.profiles set branch = 'ece' where id = $1`, [A])
    await fails(B, `select public.staff_set_user_branch($1, 'ece')`, [A])
    await as(ADMIN, `select public.staff_set_user_branch($1, 'rai')`, [A])
    expect((await as(null, `select branch from public.profiles where id = $1`, [A])).rows).toEqual([{ branch: 'rai' }])
    await as(ADMIN, `select public.staff_set_user_branch($1, null)`, [A])
  })
})
