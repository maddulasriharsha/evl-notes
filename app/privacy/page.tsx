import type { Metadata } from 'next'
import { Container } from '@/components/ui'

export const metadata: Metadata = { title: 'Privacy policy' }

const sections: { title: string; body: string[] }[] = [
  {
    title: 'What this site is',
    body: [
      'VJNOTES is a free, non-commercial site where B.Tech (R25) students at VNR VJIET share class notes. It is run by a student, Sriharsha Reddy (EVL), not by the college.',
    ],
  },
  {
    title: 'Reading and downloading',
    body: [
      'You can read and download everything without an account. We do not use ads or tracking cookies.',
      'To know roughly how many people use the site, your browser keeps a random number (not linked to you or to any account) and tells us it was here today. We do not store your IP address, the pages you read or anything else. If your browser sends “Do Not Track”, nothing is counted.',
    ],
  },
  {
    title: 'What we store when you sign in',
    body: [
      'Your email address, used only to sign you in. It is never shown on the site or shared.',
      'The display name you choose. It is shown publicly next to the notes you upload.',
      'If you use “Continue with Google”, we receive your name, email address and profile picture from Google. We only use the email to sign you in and the name to suggest a display name.',
      'A sign-in cookie that keeps you logged in. It is required for uploading and is not used for anything else.',
      'When you sign in, the time, the sign-in method and whether you used a phone or computer. Only the site admin can see this.',
    ],
  },
  {
    title: 'Notes you upload',
    body: [
      'Files you upload are public: anyone can view and download them. Do not upload anything private or anything you do not have the right to share, such as copyrighted textbooks.',
      'You can hide your files at any time from “My notes”. Hidden files are no longer shown on the site.',
    ],
  },
  {
    title: 'Where data is kept',
    body: [
      'Accounts, the list of notes and the uploaded files are stored with Supabase. The website itself is hosted on Vercel.',
    ],
  },
  {
    title: 'Deleting your account',
    body: ['To delete your account or remove your files completely, contact the site owner, Sriharsha Reddy (EVL), and it will be done.'],
  },
]

export default function PrivacyPage() {
  return (
    <Container className="max-w-3xl py-12">
      <h1 className="font-display text-4xl font-semibold tracking-tight">Privacy policy</h1>
      <p className="mt-2 text-sm text-ink-3">Last updated 21 October 2026</p>
      <div className="mt-8 space-y-8">
        {sections.map((s) => (
          <section key={s.title}>
            <h2 className="font-semibold">{s.title}</h2>
            <div className="mt-2 space-y-2 leading-relaxed text-ink-2">
              {s.body.map((p) => (
                <p key={p}>{p}</p>
              ))}
            </div>
          </section>
        ))}
      </div>
    </Container>
  )
}
