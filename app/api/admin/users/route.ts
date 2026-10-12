import { randomInt } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { adminConfigured, supabaseAdmin } from '@/lib/supabase/admin'
import { currentProfile } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * Account changes an admin can make for another person: a new password, a new display name, or a
 * corrected email address. Passwords are never readable (they are stored as one-way hashes, even by
 * the database owner), so the only tool is setting a new one, which the admin then passes on.
 */

const ID = /^[0-9a-f-]{36}$/i
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/
const ALPHABET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function temporaryPassword() {
  return Array.from({ length: 10 }, () => ALPHABET[randomInt(0, ALPHABET.length)]).join('')
}

export async function POST(request: NextRequest) {
  const me = await currentProfile()
  if (!me || me.profile?.role !== 'admin') return NextResponse.json({ ok: false, error: 'Admins only.' }, { status: 403 })
  if (!adminConfigured()) return NextResponse.json({ ok: false, error: 'The service key is not set on the server.' }, { status: 501 })

  let body: { userId?: unknown; action?: unknown; password?: unknown; name?: unknown; email?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Bad request.' }, { status: 400 })
  }
  const userId = typeof body.userId === 'string' ? body.userId : ''
  if (!ID.test(userId)) return NextResponse.json({ ok: false, error: 'Unknown person.' }, { status: 400 })

  const db = supabaseAdmin()
  const { data: target } = await db.from('profiles').select('id, role').eq('id', userId).maybeSingle()
  if (!target) return NextResponse.json({ ok: false, error: 'Unknown person.' }, { status: 404 })
  // Another admin's account can only be changed by that admin.
  if ((target as { role: string }).role === 'admin' && userId !== me.user.id) {
    return NextResponse.json({ ok: false, error: 'Another admin’s account can only be changed by that admin.' }, { status: 403 })
  }

  switch (body.action) {
    case 'set_password': {
      const typed = typeof body.password === 'string' ? body.password : ''
      const password = typed || temporaryPassword()
      if (password.length < 8 || password.length > 100) {
        return NextResponse.json({ ok: false, error: 'Use a password of 8 to 100 characters.' }, { status: 400 })
      }
      const { error } = await db.auth.admin.updateUserById(userId, { password })
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 })
      // Shown once to the admin so it can be passed on; it is not stored anywhere.
      return NextResponse.json({ ok: true, password })
    }
    case 'set_name': {
      const name = typeof body.name === 'string' ? body.name.trim() : ''
      if (name.length < 2 || name.length > 60) return NextResponse.json({ ok: false, error: 'Use a name of 2 to 60 characters.' }, { status: 400 })
      const { error } = await db.from('profiles').update({ display_name: name }).eq('id', userId)
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 })
      return NextResponse.json({ ok: true })
    }
    case 'set_email': {
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
      if (!EMAIL.test(email)) return NextResponse.json({ ok: false, error: 'That email address does not look right.' }, { status: 400 })
      const { error } = await db.auth.admin.updateUserById(userId, { email, email_confirm: true })
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 })
      return NextResponse.json({ ok: true })
    }
    default:
      return NextResponse.json({ ok: false, error: 'Unknown action.' }, { status: 400 })
  }
}
