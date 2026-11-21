import React, { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export function BrandHeader() {
  const { user, settings, lang, setLang, currentPath, navigate } = useApp();
  const [mobileOpen, setMobileOpen] = useState(false);

  const siteName = settings?.site_name || 'SERA ACADEMY';
  const primaryPath = currentPath.split('?')[0];

  const handleActionClick = () => {
    setMobileOpen(false);
    if (user?.role === 'admin') {
      navigate('/admin');
    } else if (user) {
      navigate('/student');
    } else {
      navigate('/auth/login');
    }
  };

  const primaryActionLabel =
    user?.role === 'admin'
      ? lang === 'bn'
        ? 'অ্যাডমিন প্যানেল'
        : 'Admin Panel'
      : user
        ? lang === 'bn'
          ? 'ড্যাশবোর্ড'
          : 'Dashboard'
        : lang === 'bn'
          ? 'সাইন ইন'
          : 'Sign In';

  const navItems = [
    { path: '/courses', label: lang === 'bn' ? 'কোর্সসমূহ' : 'Courses' },
    { path: '/categories', label: lang === 'bn' ? 'ক্যাটাগরি' : 'Categories' },
    { path: '/about', label: lang === 'bn' ? 'আমাদের সম্পর্কে' : 'About' },
    { path: '/support', label: lang === 'bn' ? 'সাপোর্ট' : 'Support' },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-8 px-4 sm:px-6 lg:px-8">
        {/* Zone 1: Single-element Brand Wordmark */}
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault();
            navigate('/');
            setMobileOpen(false);
          }}
          className="flex items-center gap-2.5 whitespace-nowrap shrink-0 font-display text-lg font-bold tracking-tight text-[var(--brand-primary)]"
        >
          {settings?.logo_url ? (
            <img
              src={settings.logo_url}
              alt={siteName}
              referrerPolicy="no-referrer"
              className="h-7 w-7 rounded object-contain"
            />
          ) : null}
          <span>{siteName}</span>
        </a>

        {/* Zone 2: Clean Single-Line Nav Links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
          {navItems.map((item) => {
            const active = primaryPath === item.path;
            return (
              <a
                key={item.path}
                href={item.path}
                onClick={(e) => {
                  e.preventDefault();
                  navigate(item.path);
                }}
                className={`whitespace-nowrap shrink-0 py-1 transition-colors hover:text-[var(--brand-primary)] ${
                  active
                    ? 'text-[var(--brand-primary)] border-b-2 border-[var(--brand-accent)]'
                    : ''
                }`}
              >
                {item.label}
              </a>
            );
          })}
        </nav>

        {/* Zone 3: 1 Primary Action + Mobile Menu Trigger */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={handleActionClick}
            className="hidden sm:inline-flex items-center justify-center rounded-lg bg-[var(--brand-primary)] px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-accent)] whitespace-nowrap shrink-0 min-h-[40px]"
          >
            {primaryActionLabel}
          </button>

          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
            className="inline-flex md:hidden items-center justify-center rounded-lg border border-slate-200 p-2.5 text-slate-700 hover:bg-slate-100 min-h-[44px] min-w-[44px]"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="border-t border-slate-200 bg-white px-4 py-4 md:hidden">
          <div className="flex flex-col space-y-1">
            {navItems.map((item) => (
              <a
                key={item.path}
                href={item.path}
                onClick={(e) => {
                  e.preventDefault();
                  navigate(item.path);
                  setMobileOpen(false);
                }}
                className="flex min-h-[44px] items-center rounded-lg px-3 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                {item.label}
              </a>
            ))}
            <a
              href="/contact"
              onClick={(e) => {
                e.preventDefault();
                navigate('/contact');
                setMobileOpen(false);
              }}
              className="flex min-h-[44px] items-center rounded-lg px-3 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              {lang === 'bn' ? 'যোগাযোগ' : 'Contact'}
            </a>
            <div className="flex items-center justify-between border-t border-slate-100 pt-3 mt-2">
              <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => setLang('en')}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium min-h-[36px] ${
                    lang === 'en' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  EN
                </button>
                <button
                  type="button"
                  onClick={() => setLang('bn')}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium min-h-[36px] ${
                    lang === 'bn' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  বাংলা
                </button>
              </div>
              <button
                type="button"
                onClick={handleActionClick}
                className="rounded-lg bg-[var(--brand-primary)] px-4 py-2 text-sm font-medium text-white min-h-[44px]"
              >
                {primaryActionLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
