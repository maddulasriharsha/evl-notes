# Google Drive material

The owner's Drive folder
(<https://drive.google.com/drive/folders/1W-TjBCJTUq3RfFBpchCYaoIlJVwgFS3G>) is shown on the site inside each
chapter as the owner's notes, with the ADMIN badge. Files are **not copied**: each one is previewed straight from Google Drive with
`drive.google.com/file/d/<id>/preview`, so they cost the site no storage or bandwidth.

## How the files were sorted (9 Oct 2026)

1. The whole folder tree was listed: 596 files.
2. Each PDF, PPTX, DOCX and MD file was downloaded once to a temporary folder, its text was read, and it was
   scored against the topic list of every R25 unit of its subject. Confident matches set the chapter.
   The temporary copies were then deleted.
3. Phone scans with no readable text fall back to the file and folder name. Old R22 material whose unit
   numbers do not match R25 goes to **General** unless the content clearly matches an R25 unit.
4. Each file is tagged Notes, Slides, Lab or Questions (question papers, banks, worksheets).

The result is `data/drive-library.json` (546 files). `docs/mapping.csv` lists every file with where it went,
including the 50 that were left out.

## What was left out, and why

- **Published textbooks** (B V Ramana, Boylestad, Millman, Salivahanan, Hayt, Sahdev, Deitel, Nielsen & Chuang,
  Beiser, R K Jain, …): copyrighted books should not be redistributed from a public site.
- **Personal or junk files**: a quiz marks sheet, WIL reports, blank templates, `desktop.ini`, Office lock files,
  half-downloaded files, the syllabus PDF and record-sheet templates.

## Changing where a file appears

Edit its entry in `data/drive-library.json` (`subject`, `unit` 1–5 or `null` for General, `kind`) and redeploy.
To add new Drive files, share them as "Anyone with the link" and add an entry with the Drive file id.

## Important

- Files must stay shared as **Anyone with the link → Viewer**, or the preview stops working for visitors.
- If a file is deleted from Drive, its card on the site will show an error. Student uploads are unaffected:
  they live in Supabase Storage.
