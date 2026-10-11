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
