'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { Command, ArrowRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api/client';

export function InfoPageLayout({ children }: { children: ReactNode }) {
  // Check if user is logged in to toggle Dashboard button in navbar
  const { data: currentUser } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => apiFetch('/me', {}, { auth: false }).catch(() => null),
    retry: false,
  });

  const hasSession = !!currentUser;

  const footerLinks = {
    Product: [
      { label: 'Features', href: '/#features' },
      { label: 'Pricing', href: '/#pricing' },
      { label: 'Live Map', href: '/live' },
      { label: 'Partner API', href: '/#features' },
    ],
    Platform: [
      { label: 'Rider App', href: '/rider-app' },
      { label: 'Fleet Dashboard', href: '/login' },
      { label: 'Documentation', href: '/docs' },
      { label: 'Compliance', href: '/compliance' },
    ],
    Company: [
      { label: 'About', href: '/about' },
      { label: 'Blog', href: '/blog' },
      { label: 'Contact', href: '/contact' },
      { label: 'Careers', href: '/careers' },
    ],
    Legal: [
      { label: 'Privacy Policy', href: '/privacy' },
      { label: 'Terms of Service', href: '/terms' },
      { label: 'Security', href: '/security' },
    ],
  };

  return (
    <div className="dark min-h-screen bg-[#09090b] text-white overflow-x-hidden flex flex-col justify-between">
      {/* Navbar */}
      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#09090b]/80 backdrop-blur-xl" style={{colorScheme:'dark'}}>
        <nav className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 h-16">
          <Link href="/" className="flex items-center gap-3 group">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-blue-600 text-ink shadow-lg shadow-accent/20 group-hover:shadow-accent/40 transition-shadow">
              <Command size={18} />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent">
                E-Moto
              </p>
              <p className="font-display text-sm font-bold text-white">Fleet OS</p>
            </div>
          </Link>

          <div className="hidden items-center gap-8 text-[13px] font-medium md:flex" style={{color:'rgb(161,161,170)'}}>
            <Link href="/#features" className="transition hover:text-white">Features</Link>
            <Link href="/#showcase" className="transition hover:text-white">Platform</Link>
            <Link href="/#pricing" className="transition hover:text-white">Pricing</Link>
            <Link href="/#faq" className="transition hover:text-white">FAQ</Link>
          </div>

          <div className="hidden items-center gap-3 md:flex">
            {hasSession ? (
              <Link href="/overview" className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition" style={{background:'white', color:'black'}}>
                Dashboard <ArrowRight size={14} />
              </Link>
            ) : (
              <>
                <Link href="/login" className="rounded-lg px-4 py-2 text-sm font-medium transition hover:text-white" style={{color:'rgb(161,161,170)'}}>Sign in</Link>
                <Link href="/create-account" className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition" style={{background:'white', color:'black'}}>
                  Get started <ArrowRight size={14} />
                </Link>
              </>
            )}
          </div>
        </nav>
      </header>

      {/* Main Content Slot */}
      <main className="flex-grow">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-white/[0.06] mt-20">
        <div className="mx-auto w-full max-w-7xl px-6 py-12">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-5">
            {/* Brand */}
            <div className="lg:col-span-1">
              <Link href="/" className="flex items-center gap-3 group">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-blue-600 text-ink shadow-md shadow-accent/15">
                  <Command size={16} />
                </span>
                <div className="min-w-0">
                  <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-accent">
                    E-Moto
                  </p>
                  <p className="font-display text-xs font-bold text-white">Fleet OS</p>
                </div>
              </Link>
              <p className="mt-4 text-xs leading-5 text-zinc-500 max-w-[200px]">
                Smart mobility command center for electric motorcycle fleets.
              </p>
            </div>

            {/* Link columns */}
            {Object.entries(footerLinks).map(([title, links]) => (
              <div key={title}>
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-4">{title}</p>
                <ul className="space-y-2.5">
                  {links.map((link) => (
                    <li key={link.label}>
                      <Link href={link.href} className="text-sm text-zinc-400 hover:text-white transition">
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-10 flex flex-col gap-3 border-t border-white/[0.06] pt-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-zinc-600">&copy; 2026 eMoto Safety &amp; Fleet OS. All rights reserved.</p>
            <div className="flex gap-4">
              <a href="#" className="text-zinc-600 hover:text-white transition" aria-label="Twitter">
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
              </a>
              <a href="#" className="text-zinc-600 hover:text-white transition" aria-label="GitHub">
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/></svg>
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
