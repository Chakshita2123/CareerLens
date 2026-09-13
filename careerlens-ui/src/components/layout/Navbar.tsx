'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession, signIn, signOut } from 'next-auth/react'
import { clsx } from 'clsx'
import {
  Scan, Target, Briefcase, Zap, BarChart2, MessageSquareCode,
  Menu, X, FileCheck, ArrowRight, LogIn, LogOut, User as UserIcon
} from 'lucide-react'
import { useSelectedVersion } from '@/lib/hooks'

const NAV = [
  { href: '/',           label: 'Analyze',        desc: 'Upload & ATS scoring',   icon: Scan              },
  { href: '/match',      label: 'Job Match',      desc: 'Semantic vector fit',    icon: Target            },
  { href: '/roles',      label: 'Career Roles',   desc: '25+ calibrated tracks',  icon: Briefcase         },
  { href: '/improve',    label: 'AI Polish',      desc: 'STAR bullet enhancement',icon: Zap               },
  { href: '/interview',  label: 'Interview',      desc: 'AI mock session prep',   icon: MessageSquareCode },
  { href: '/comparison', label: 'History',        desc: 'Version progression',    icon: BarChart2         },
]

/**
 * Optical Aperture Brand Icon
 */
function BrandApertureIcon() {
  return (
    <div className="relative w-8 h-8 rounded-xl bg-surface-elevated border border-surface-border flex items-center justify-center group-hover:border-lens-cyan/60 group-hover:shadow-[0_0_16px_rgba(0,240,255,0.35)] transition-all duration-300">
      {/* Concentric aperture blades */}
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-lens-cyan transition-transform duration-500 group-hover:rotate-45" aria-hidden="true">
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
  const { data: session, status } = useSession()
  const [versionId] = useSelectedVersion()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [userDropdownOpen, setUserDropdownOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Close mobile drawer and dropdown on route navigation
  useEffect(() => {
    setMobileMenuOpen(false)
    setUserDropdownOpen(false)
  }, [path])

  return (
    <header className="sticky top-0 z-40 border-b border-surface-border/80 bg-[#06070a]/90 backdrop-blur-xl">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14">
        
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-2.5 group select-none focus-ring rounded-xl">
          <BrandApertureIcon />
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="font-display font-bold text-sm tracking-tight text-white group-hover:text-white">
                CAREER<span className="text-lens-cyan font-extrabold tracking-wider">LENS</span>
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-focus-locked shadow-[0_0_6px_#00e676]" title="System Online" />
            </div>
            <span className="font-mono text-[8px] uppercase tracking-widest text-slate-400 -mt-0.5 hidden sm:block">
              AI CAREER INTELLIGENCE
            </span>
          </div>
        </Link>

        {/* Desktop Navigation Links */}
        <nav aria-label="Main navigation" className="hidden md:flex items-center gap-1 bg-surface-card/60 border border-surface-border/60 p-1 rounded-xl">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = path === href
            return (
              <Link
                key={href}
                href={href}
                className={clsx(
                  'relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 focus-ring',
                  active
                    ? 'bg-lens-cyan-dim text-lens-cyan border border-lens-cyan/30 shadow-[0_0_12px_rgba(0,240,255,0.2)] font-semibold'
                    : 'text-slate-300 hover:text-white hover:bg-surface-elevated'
                )}
                aria-current={active ? 'page' : undefined}
              >
                {active && (
                  <span className="absolute -top-0.5 left-2 right-2 h-[1px] bg-lens-cyan" />
                )}
                <Icon size={13} className={clsx(active ? 'text-lens-cyan' : 'text-slate-400')} />
                <span className="font-sans">{label}</span>
              </Link>
            )
          })}
        </nav>

        {/* User Auth, Status Indicator & Mobile Hamburger Toggle */}
        <div className="flex items-center gap-2.5">
          {/* Active Session Indicator (Desktop) */}
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-elevated/70 border border-surface-border font-mono text-[10px]">
            {mounted && versionId ? (
              <>
                <FileCheck size={12} className="text-focus-locked" />
                <span className="text-slate-300 font-medium">Resume Active</span>
              </>
            ) : (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                <span className="text-slate-400">No Resume Loaded</span>
              </>
            )}
          </div>

          {/* Desktop Google User Profile / Sign In */}
          <div className="hidden sm:flex items-center relative">
            {status === 'loading' ? (
              <div className="w-8 h-8 rounded-xl bg-surface-elevated animate-pulse border border-surface-border" />
            ) : session?.user ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setUserDropdownOpen(open => !open)}
                  className="flex items-center gap-2 p-1 pl-1.5 pr-2.5 rounded-xl bg-surface-card hover:bg-surface-elevated border border-surface-border hover:border-lens-cyan/40 transition-all focus-ring"
                  aria-expanded={userDropdownOpen}
                  aria-label="User profile menu"
                >
                  {session.user.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={session.user.image}
                      alt={session.user.name || 'User avatar'}
                      className="w-6 h-6 rounded-lg object-cover border border-surface-border"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-lg bg-lens-cyan-dim border border-lens-cyan/40 text-lens-cyan flex items-center justify-center font-mono font-bold text-xs">
                      {session.user.name?.[0]?.toUpperCase() || 'U'}
                    </div>
                  )}
                  <span className="font-sans text-xs font-semibold text-slate-200 max-w-[100px] truncate">
                    {session.user.name?.split(' ')[0] || 'Account'}
                  </span>
                </button>

                {/* Profile Dropdown Menu */}
                {userDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-[#090b10] border border-surface-border p-3 shadow-2xl z-50 space-y-2 animate-in fade-in zoom-in-95 duration-150">
                    <div className="px-2 py-1.5 border-b border-surface-border/70 space-y-0.5">
                      <div className="text-xs font-semibold text-white truncate">
                        {session.user.name}
                      </div>
                      <div className="text-[11px] font-mono text-slate-400 truncate">
                        {session.user.email}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => signOut({ callbackUrl: '/' })}
                      className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs font-mono text-focus-lost hover:bg-focus-lost-dim/40 transition-colors"
                    >
                      <LogOut size={13} />
                      <span>Sign Out</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link
                href="/login"
                className="btn-secondary py-1.5 px-3 text-xs flex items-center gap-1.5 font-mono"
              >
                <LogIn size={13} />
                <span>Sign In</span>
              </Link>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(open => !open)}
            aria-expanded={mobileMenuOpen}
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            className="md:hidden flex items-center justify-center w-9 h-9 rounded-xl bg-surface-card border border-surface-border text-slate-300 hover:text-white hover:border-lens-cyan/40 transition-colors focus-ring"
          >
            {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-surface-border/80 bg-[#06070a]/95 backdrop-blur-2xl px-4 pt-3 pb-6 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
          {/* User Auth state in mobile drawer */}
          <div className="p-3 rounded-xl bg-surface-elevated/80 border border-surface-border space-y-2">
            {session?.user ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  {session.user.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={session.user.image}
                      alt={session.user.name || 'User avatar'}
                      className="w-8 h-8 rounded-lg object-cover border border-surface-border shrink-0"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-lg bg-lens-cyan-dim border border-lens-cyan/40 text-lens-cyan flex items-center justify-center font-mono font-bold text-xs shrink-0">
                      {session.user.name?.[0]?.toUpperCase() || 'U'}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-white truncate">{session.user.name}</div>
                    <div className="text-[10px] font-mono text-slate-400 truncate">{session.user.email}</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => signOut({ callbackUrl: '/' })}
                  className="p-1.5 text-focus-lost hover:bg-focus-lost-dim rounded-lg transition-colors"
                  title="Sign Out"
                >
                  <LogOut size={16} />
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                className="w-full btn-primary py-2 text-xs flex items-center justify-center gap-2 font-mono"
              >
                <LogIn size={14} />
                <span>Sign in with Google</span>
              </Link>
            )}
          </div>

          {/* Active Resume status in mobile drawer */}
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-surface-elevated/60 border border-surface-border text-xs font-mono">
            <span className="text-slate-400">Profile Status:</span>
            {mounted && versionId ? (
              <span className="flex items-center gap-1.5 text-focus-locked font-semibold">
                <FileCheck size={13} /> Active Resume
              </span>
            ) : (
              <Link href="/" className="text-lens-cyan hover:underline flex items-center gap-1">
                Upload Resume <ArrowRight size={11} />
              </Link>
            )}
          </div>

          {/* Navigation Links in Drawer */}
          <div className="space-y-1">
            {NAV.map(({ href, label, desc, icon: Icon }) => {
              const active = path === href
              return (
                <Link
                  key={href}
                  href={href}
                  className={clsx(
                    'flex items-center justify-between p-3 rounded-xl transition-colors',
                    active
                      ? 'bg-lens-cyan-dim border border-lens-cyan/30 text-lens-cyan'
                      : 'hover:bg-surface-elevated text-slate-200'
                  )}
                  aria-current={active ? 'page' : undefined}
                >
                  <div className="flex items-center gap-3">
                    <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center border', active ? 'bg-lens-cyan text-black border-lens-cyan' : 'bg-surface-card border-surface-border text-slate-400')}>
                      <Icon size={16} />
                    </div>
                    <div>
                      <div className="font-display font-semibold text-sm">{label}</div>
                      <div className="text-[11px] text-slate-400 font-sans">{desc}</div>
                    </div>
                  </div>
                  <ArrowRight size={14} className={clsx(active ? 'text-lens-cyan' : 'text-slate-600')} />
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </header>
  )
}
