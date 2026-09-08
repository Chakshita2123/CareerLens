import type { Metadata } from 'next'
import './globals.css'
import { Navbar } from '@/components/layout/Navbar'
import { AmbientBackground } from '@/components/layout/AmbientBackground'

export const metadata: Metadata = {
  title: 'CareerLens — Optical Resume Intelligence & Matching',
  description:
    'Calibrate your resume with instant camera-aperture ATS scoring, semantic vector job matching, ' +
    'role recommendations, and grounded AI-powered bullet enhancements.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen flex flex-col bg-[#06070a] text-[#e1e7f5] relative selection:bg-lens-cyan selection:text-black">
        {/* Global Persistent Optical Atmosphere Layer */}
        <AmbientBackground />

        <Navbar />
        <main className="flex-1 relative z-10">{children}</main>
        <footer className="border-t border-surface-border/80 text-center font-mono text-xs text-slate-500 py-6 mt-16 bg-[#06070a]/90 relative z-10">
          CAREERLENS · OPTICAL RESUME INTELLIGENCE · ALL SENSORS RUN LOCALLY
        </footer>
      </body>
    </html>
  )
}
