# Verified sign-up (email code)

New accounts are created on the server, so they never wait on Supabase's 2-emails-per-hour limit.

- **Without Brevo set up:** the account is created straight away; the email address is not verified.
- **With Brevo set up:** the student gets a 6-digit code by email and must enter it before the account is
  created. Free plan: 300 emails a day.

No database table is needed. The server signs the code (HMAC) and gives the browser a token; the code is
valid for 10 minutes. See `lib/signup-code.ts`.

## One-time setup (about 10 minutes)

1. Create a free account at <https://www.brevo.com>.
2. **Senders, Domains & Dedicated IPs → Senders → Add a sender.** Use a real address you can open
   (your Gmail is fine) and click the confirmation link Brevo emails to it.
3. **SMTP & API → API Keys → Generate a new API key.** Copy it.
4. In Vercel → Project → Settings → Environment Variables (Production), add:

   | Name | Value |
   |---|---|
   | `BREVO_API_KEY` | the API key from step 3 |
   | `BREVO_SENDER_EMAIL` | the sender address from step 2 |

5. Redeploy.

`SUPABASE_SERVICE_ROLE_KEY` must also be set (it is already, for the Drive backup). To use a separate
signing secret, add `SIGNUP_SECRET` (any long random text).

## Notes
- Emails from a Gmail sender can land in spam; tell students to check it. A domain you own, verified in
  Brevo, avoids this.
- Existing accounts are unaffected. Google sign-in does not use this at all.
- Remove `BREVO_API_KEY` to switch back to "no email needed".

## "Are you a person?" check
Account creation shows a quick check. By default it is a one-line sum (no setup, no tracking). For
Cloudflare Turnstile instead (free), create a Turnstile widget at <https://dash.cloudflare.com> and add
`NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` in Vercel, then redeploy.

## When the 300-a-day limit is reached
The sign-up form shows a message explaining the limit and pointing to Google sign-in, which is not
affected. The counter resets daily.
