'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { clsx } from 'clsx'
import { Scan, Target, Briefcase, Zap, BarChart2 } from 'lucide-react'

const NAV = [
  { href: '/',           label: 'Upload / Scan', icon: Scan       },
  { href: '/match',      label: 'Job Match',     icon: Target     },
  { href: '/roles',      label: 'Roles',         icon: Briefcase  },
  { href: '/improve',    label: 'Enhance',       icon: Zap        },
  { href: '/comparison', label: 'History',       icon: BarChart2  },
]

/**
 * Optical Aperture Brand Icon
 */
function BrandApertureIcon() {
  return (
    <div className="relative w-8 h-8 rounded-xl bg-surface-elevated border border-surface-border flex items-center justify-center group-hover:border-lens-cyan/60 group-hover:shadow-[0_0_16px_rgba(0,240,255,0.4)] transition-all duration-300">
      {/* Concentric aperture blades */}
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-lens-cyan transition-transform duration-500 group-hover:rotate-45">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.6" />
        <circle cx="12" cy="12" r="6" stroke="currentColor" strokeWidth="1.5" />
        {/* Iris lines */}
        <line x1="12" y1="2" x2="16" y2="9" stroke="currentColor" strokeWidth="1.5" />
        <line x1="22" y1="12" x2="15" y2="16" stroke="currentColor" strokeWidth="1.5" />
        <line x1="12" y1="22" x2="8" y2="15" stroke="currentColor" strokeWidth="1.5" />
        <line x1="2" y1="12" x2="9" y2="8" stroke="currentColor" strokeWidth="1.5" />
        {/* Center glowing pupil */}
        <circle cx="12" cy="12" r="2" fill="#00f0ff" />
      </svg>
      {/* Corner bracket accents */}
      <span className="absolute -top-0.5 -left-0.5 w-1.5 h-1.5 border-t border-l border-lens-cyan/70" />
      <span className="absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 border-b border-r border-lens-cyan/70" />
    </div>
  )
}

export function Navbar() {
  const path = usePathname()

  return (
    <nav className="sticky top-0 z-40 border-b border-surface-border/80 bg-[#06070a]/85 backdrop-blur-xl">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14">
        {/* Logo with Optical Metaphor */}
        <Link href="/" className="flex items-center gap-2.5 group select-none">
          <BrandApertureIcon />
          <div className="flex flex-col">
            <div className="flex items-center gap-1">
              <span className="font-display font-bold text-sm tracking-tight text-white group-hover:text-white">
                CAREER<span className="text-lens-cyan font-extrabold tracking-wider">LENS</span>
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-focus-locked shadow-[0_0_6px_#00e676]" />
            </div>
            <span className="font-mono text-[8px] uppercase tracking-widest text-slate-500 -mt-1 hidden sm:block">
              OPTICAL RESUME INTELLIGENCE
            </span>
          </div>
        </Link>

        {/* Navigation Tabs with Viewfinder Highlights */}
        <div className="flex items-center gap-1 bg-surface-card/60 border border-surface-border/60 p-1 rounded-xl">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = path === href
            return (
              <Link
                key={href}
                href={href}
                className={clsx(
                  'relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200',
                  active
                    ? 'bg-lens-cyan-dim text-lens-cyan border border-lens-cyan/30 shadow-[0_0_12px_rgba(0,240,255,0.2)]'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-surface-elevated'
                )}
              >
                {active && (
                  <span className="absolute -top-0.5 left-2 right-2 h-[1px] bg-lens-cyan" />
                )}
                <Icon size={13} className={clsx(active ? 'text-lens-cyan' : 'text-slate-500')} />
                <span className="hidden sm:inline font-sans">{label}</span>
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
