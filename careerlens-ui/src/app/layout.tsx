import type { Metadata } from 'next'
import './globals.css'
import { Navbar } from '@/components/layout/Navbar'

export const metadata: Metadata = {
  title: 'CareerLens — AI Resume Intelligence',
  description:
    'Upload your resume and get instant ATS scores, job match analysis, ' +
    'role recommendations, and AI-powered bullet point improvements.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1">{children}</main>
        <footer className="border-t border-surface-border text-center text-sm text-slate-600 py-6 mt-16">
          CareerLens · AI Resume Intelligence · All analysis runs locally
        </footer>
      </body>
    </html>
  )
}
