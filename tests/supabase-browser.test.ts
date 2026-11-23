import { describe, expect, it, vi } from 'vitest'

// A fake client that records what is called on it, shaped like the real query builder: chained
// methods keep their `this`, and the result is a thenable that only "sends" when awaited.
const calls: string[] = []
let created = 0
function builder(path: string[]): unknown {
  const self = {
    path,
    select(cols: string) {
      calls.push(`select:${cols}`)
      return builder([...this.path, `select(${cols})`])
    },
    eq(col: string, v: unknown) {
      return builder([...this.path, `eq(${col},${String(v)})`])
    },
    update(row: Record<string, unknown>) {
      return builder([...this.path, `update(${Object.keys(row).join(',')})`])
    },
    then(ok: (v: unknown) => unknown, bad?: (e: unknown) => unknown) {
      calls.push(`sent:${this.path.join('.')}`)
      return Promise.resolve({ data: this.path.join('.'), error: null }).then(ok, bad)
    },
  }
  return self
}
vi.mock('@supabase/ssr', () => ({
  createBrowserClient: () => {
    created++
    return {
      from: (t: string) => builder([`from(${t})`]),
      rpc: (fn: string, args: unknown) => Promise.resolve({ data: { fn, args }, error: null }),
      auth: {
        prefix: 'auth',
        getUser() {
          // Uses `this`, like the real auth client.
          return Promise.resolve({ data: { user: { id: `${this.prefix}-user` } }, error: null })
        },
      },
    }
  },
}))
vi.mock('@/lib/env', () => ({ supabaseUrl: 'https://abcdefghij.supabase.co', supabaseAnonKey: 'anon' }))

describe('the deferred browser client', () => {
  it('loads nothing until a request is awaited, then replays the chain on the real client', async () => {
    const { supabaseBrowser } = await import('@/lib/supabase/browser')
    const q = supabaseBrowser().from('files').update({ name: 'x' }).eq('id', 7)
    expect(created).toBe(0)
    expect(calls).toEqual([])
    const { data, error } = await q
    expect(error).toBeNull()
    expect(data).toBe('from(files).update(name).eq(id,7)')
    expect(created).toBe(1)
  })

  it('reuses one client, keeps `this` for methods, and works for rpc and auth', async () => {
    const { supabaseBrowser } = await import('@/lib/supabase/browser')
    const db = supabaseBrowser()
    const files = db.from('files')
    // A saved partial chain can be extended more than once.
    const [a, b] = await Promise.all([files.select('id'), files.select('name')])
    expect([a.data, b.data]).toEqual(['from(files).select(id)', 'from(files).select(name)'])
    expect((await db.rpc('record_visit', { p_visitor: 'v' })).data).toEqual({ fn: 'record_visit', args: { p_visitor: 'v' } })
    expect((await db.auth.getUser()).data.user?.id).toBe('auth-user')
    expect(created).toBe(1)
  })

  it('passes errors to catch', async () => {
    const { supabaseBrowser } = await import('@/lib/supabase/browser')
    const broken = (supabaseBrowser() as unknown as { nothing: { here: () => Promise<unknown> } }).nothing.here()
    await expect(broken).rejects.toBeInstanceOf(TypeError)
  })
})

describe('hasSession', () => {
  it('sees the Supabase session cookie, whole or split', async () => {
    const { hasSession } = await import('@/lib/supabase/browser')
    vi.stubGlobal('document', { cookie: 'vj=1; other=2' })
    expect(hasSession()).toBe(false)
    vi.stubGlobal('document', { cookie: 'vj=1; sb-abcdefghij-auth-token=base64-xyz' })
    expect(hasSession()).toBe(true)
    vi.stubGlobal('document', { cookie: 'sb-abcdefghij-auth-token.0=a; sb-abcdefghij-auth-token.1=b' })
    expect(hasSession()).toBe(true)
    vi.stubGlobal('document', { cookie: 'sb-someoneelse-auth-token=a' })
    expect(hasSession()).toBe(false)
    vi.unstubAllGlobals()
  })
})
