# Drive backup

Every uploaded file is copied to a Google Drive folder. As soon as the copy is verified (same size and
checksum) the original is removed from Supabase Storage and the note is served from the Drive copy. Thumbnails
and previews stay in Storage.

## What it does, exactly

1. **Copy.** A daily job (and the **Run backup now** button on Admin → Backup) downloads each new
   upload, uploads it to the folder **VJNOTES backup**, makes it readable by "anyone with the link",
   and checks the size and MD5 checksum against the original. Only then is it recorded.
2. **Remove.** Right after the copy is verified the original is removed from Storage. If the copy
   cannot be verified, the original is kept and the problem is shown on the Backup tab. (Set
   `KEEP_ORIGINAL_DAYS` in `lib/backup-rules.ts` above 0 to wait that many days first.)
3. **Serve.** A note whose original was removed opens in Drive's preview, and Download uses Drive.
   Downloading a whole chapter as one PDF skips those files.
4. **Delete forever** (Admin → Files) also deletes the Drive copy.

## One-time setup (about 15 minutes)

You need a Google account used only for backups (not your personal one).

### 1. Supabase service key
Supabase → Project Settings → API → copy the **service_role** key.
Add it in Vercel as `SUPABASE_SERVICE_ROLE_KEY` (Production). Keep it secret: it bypasses all rules.

### 2. Google Cloud: allow the Drive API
In the same Google Cloud project you use for sign-in:
1. **APIs & Services → Library** → search **Google Drive API** → **Enable**.
2. **APIs & Services → Credentials → Create credentials → OAuth client ID** →
   type **Web application**. Under *Authorized redirect URIs* add
   `https://developers.google.com/oauthplayground`. Save, and copy the **Client ID** and **Client secret**.
3. **OAuth consent screen / Audience**: set the publishing status to **In production**. In
   *Testing* mode Google expires refresh tokens after 7 days and the backup would stop.

### 3. Get a refresh token for the backup account
1. Open <https://developers.google.com/oauthplayground>.
2. Click the gear icon, tick **Use your own OAuth credentials**, paste the Client ID and secret.
3. In *Step 1* type the scope `https://www.googleapis.com/auth/drive.file` and press **Authorize APIs**.
4. Sign in with the **backup account** and allow access.
5. In *Step 2* press **Exchange authorization code for tokens** and copy the **Refresh token**.

`drive.file` lets the app see only the files it created itself, nothing else in that Drive.

### 4. Vercel environment variables (Production)
| Name | Value |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | from step 1 |
| `GOOGLE_DRIVE_CLIENT_ID` | from step 2 |
| `GOOGLE_DRIVE_CLIENT_SECRET` | from step 2 |
| `GOOGLE_DRIVE_REFRESH_TOKEN` | from step 3 |
| `CRON_SECRET` | any long random text (lets the daily job run) |
| `GOOGLE_DRIVE_FOLDER_ID` | optional: use this folder instead of creating "VJNOTES backup" |

Redeploy after adding them. Then open **Admin → Backup**: every line in *Setup* should be ticked.

### 5. Run it
Press **Run backup now** until *Waiting* reaches 0. After that the daily job keeps up by itself.

## Things to know
- The backup Drive account must keep the **VJNOTES backup** folder and its files. If they are
  deleted or unshared, notes whose original was removed stop opening. Do not clean that Drive by hand.
- Free Google accounts have 15 GB. Watch it on the Backup tab's counts.
- Drive can throttle files that many people open at once ("too many views"). It is rare for class notes.
- Files already removed from Storage cannot be put back automatically; the Drive copy is the only one.
