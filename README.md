# VJNOTES

Class notes for **B.Tech EVL (R25), VNR VJIET**: Year I and II, Semesters 1–4. Anyone can read, preview and
download. Students sign in (Google or any email) to upload photos or PDFs to a chapter.

*Created by: Harsha (2nd Year)*

## How it works

- **Semester → Subject → Chapter.** Subject names, codes and chapter titles come from the two R25 syllabus
  books (`data/curriculum.json`, titles only, no syllabus text). Every subject also has a **General** section
  (complete notes, lab work).
- **One shelf per person per chapter.** When Arjun uploads to *DS · Unit II*, the files go on "Arjun's notes"
  for that chapter. Uploading again later adds to the same shelf, it never creates a second post. Only Arjun
  can add to, rename or hide files on his shelf.
- **Google Drive links.** Instead of uploading, people can paste a Drive link (a file, a folder, or a Google Doc, Sheet or
  Slides). Only the link is stored, so it uses no Supabase Storage; the site checks the link is public and previews it
  from Drive. Links get comments, hide/delete and admin tools like any other note.
- **Comments.** Every uploaded file has a comment section. Anyone can read it; signed-in people can post.
  Authors can delete their own comments and the admin can delete any. Uploads and comments by the admin
  show an **Admin** badge.
- **Viewing.** PDFs render in the page (also on phones) and images open full screen with zoom. Download is
  always one tap away but never required.

## Why uploads are permanent

The website and the files are separate things:

| What | Where it lives | Affected by redeploying / redesigning the site? |
|---|---|---|
| Website code | GitHub → Vercel | Replaced on every deploy |
| Student files (originals, untouched) | Supabase Storage bucket `notes` | **No** |
| Shelves, names, file list | Supabase Postgres | **No** (schema only changes through new migration files) |

On top of that, the database rules (`supabase/migrations/…_init.sql`, tested in `tests/rls.test.ts`) make it
impossible to delete anything through the site: there is no delete permission on any table or on storage.
"Hide" in *My notes* only sets a flag, and the file can be restored. Storage paths are unique, so an upload
can never overwrite another.

## One-time setup (about 20 minutes)

### 1. Supabase (database, sign-in, file storage)

1. Create a free project at <https://supabase.com> (region: Mumbai `ap-south-1`).
2. **SQL Editor → New query**: paste and run each file in `supabase/migrations/`, oldest first
   (`…_init.sql`, `…_comments.sql`, `…_admin_powers.sql`, `…_dashboard.sql`, `…_drive_links.sql`, `…_moderator.sql`).
3. **Project Settings → API**: copy the *Project URL* and the *anon / publishable* key.
4. **Authentication → URL Configuration**: set *Site URL* to your live address (for example
   `https://vj-notes.me`) and add `https://vj-notes.me/auth/callback` and
   `http://localhost:3000/auth/callback` to *Redirect URLs*.
5. **Authentication → Providers → Google**: turn it on. Create an OAuth client in Google Cloud Console
   (APIs & Services → Credentials → OAuth client ID → Web application) with the redirect URI that Supabase
   shows you, then paste the client ID and secret back into Supabase.
6. **Authentication → Email Templates → Magic Link** (do the same for **Confirm signup**): replace the
   message body with

   ```html
   <h2>Sign in to VJNOTES</h2>
   <p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/upload">Sign in</a></p>
   <p>Or type this code on the sign-in page: <strong>{{ .Token }}</strong></p>
   ```

   This link works even when opened from the Gmail app or another phone.
7. Supabase's built-in email only sends a few sign-in emails per hour. Before sharing the site widely, add a
   free SMTP sender (for example Resend or Brevo) under **Authentication → SMTP Settings**. Google sign-in
   is not affected by this limit.

### 2. Run it on your computer

```bash
pnpm install
```

Copy `.env.example` to `.env.local` and fill in the two values from step 1.3, then:

```bash
pnpm dev
```

Open <http://localhost:3000>.

### 3. Put it online (Vercel)

1. Push this folder to a new GitHub repository.
2. On <https://vercel.com>, **Add New → Project**, import the repository, and add the two environment variables
   `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. Deploy. Every later `git push` redeploys the site. Uploaded notes are untouched by this.

### 4. Make yourself admin

Sign in on the live site once and choose your display name. Then in the Supabase SQL Editor run:

```sql
update public.profiles set role = 'admin'
where id = (select id from auth.users where email = 'YOUR-EMAIL@example.com');
```

An **Admin** button then appears on *My notes*. The admin area has:

- **Dashboard**: members, weekly activity, uploads and sign-ins per day, storage used, top contributors,
  recent sign-ins. Click a name for that person's uploads, comments and full sign-in history.
- **Files / Comments**: hide or restore anything; "Delete forever" (hidden files only) frees storage.
- **People**: emails, contribution, last sign-in; block someone from uploading and commenting; add co-admins.
- **Shelves**: hide or show a person's whole shelf for a chapter.

## Roles

| Role | Can do |
|---|---|
| **Member** | Upload, comment, manage their own notes |
| **Moderator** | Also hide or restore any note, shelf or comment, see hidden items, and block or unblock members. Cannot delete permanently, see emails or the sign-in log, change roles, or act on admins and moderators |
| **Admin** | Everything: dashboard, emails and sign-ins, permanent delete, and choosing roles |

Admins pick a person's role from the **People** tab of the admin area (Member / Moderator / Admin).

## Adding a branch

The site is organised as **branch → semester → subject → chapter**. Branches live in `data/curriculum.json` under
`branches`; each has an `id` (the URL, for example `cse` → `/b/cse`), a `short` name, a full `name`, and its `semesters`
with subjects and chapter titles (copied from that branch's syllabus book, titles only). All 17 R25 branches (1st and 2nd year) were
loaded from the syllabus books on <https://www.vnrvjiet.ac.in/academics/syllabus>. Bio-Tech has only the first year so
far because no second-year book is published yet. To add a year or a branch, send the syllabus PDF; nothing else changes.

A **subject code identifies the course**. When two branches teach the same code (for example the common first-year
courses), they share one set of notes, and the subject page lists every branch that teaches it. Use the exact same
name for the same code (a test checks this).

## Changing the site later

- **Code or design**: edit, commit, push. Data is not touched.
- **Database structure**: add a **new** file in `supabase/migrations/` and run it in the SQL editor. Never edit
  or re-run the first migration, and never drop tables.
- **Chapter names / subjects**: edit `data/curriculum.json`. Notes are stored by subject code and unit number,
  so renaming a chapter keeps its notes.

## Backups

Supabase free projects pause after 7 days with no visitors (data is kept; press *Restore* in the dashboard).
Once a month, or before big changes:

- **Database**: Supabase → Database → Backups, or `supabase db dump` with the Supabase CLI.
- **Files**: Storage → `notes` bucket → download. Copying the files to Google Drive is enough.

## Limits on the free plans

| | Free limit | Rough meaning |
|---|---|---|
| Supabase Storage | 1 GB | ≈ 400 phone photos at 2.5 MB, or ≈ 150 large PDFs |
| Supabase bandwidth | 5 GB / month | Thumbnails and screen-size previews keep this low; originals load only on zoom or download |
| Max file size | 50 MB | Enforced in the browser and in the database |
| Vercel Hobby | Free for personal, non-commercial use | Fine for a class site |

When storage gets close to 1 GB, Supabase Pro ($25/month, 100 GB) is a one-click upgrade with no code changes.

## Commands

| Command | What it does |
|---|---|
| `pnpm dev` | Local site at <http://localhost:3000> |
| `pnpm build` | Production build (pre-renders every subject and chapter page) |
| `pnpm test` | Data checks, upload helpers, and the database security rules run against a real Postgres (PGlite) |
| `pnpm typecheck` | TypeScript check |

## Project layout

```
app/                  pages (home, /sem/N, /s/<code>, /s/<code>/unit-N, /view, /upload, /me, /admin, /login)
components/           UI pieces (uploader, PDF viewer, cards, header and footer)
lib/                  curriculum data, Supabase clients, upload logic
data/                 curriculum.json (from the syllabus books)
supabase/migrations/  database schema + security rules (forward-only)
tests/                vitest suites
```
