import React from 'react';
import { useApp } from '../../context/AppContext';

export function SiteFooter() {
  const { settings, lang, setLang, navigate, needsAdminSetup } = useApp();

  const links = [
    { path: '/courses', label: lang === 'bn' ? 'সব কোর্স' : 'All Courses' },
    { path: '/categories', label: lang === 'bn' ? 'ক্যাটাগরি' : 'Categories' },
    { path: '/about', label: lang === 'bn' ? 'আমাদের সম্পর্কে' : 'About Us' },
    { path: '/contact', label: lang === 'bn' ? 'যোগাযোগ' : 'Contact Us' },
    { path: '/support', label: lang === 'bn' ? 'সাপোর্ট সেন্টার' : 'Support Center' },
  ];

  const legalLinks = [
    { path: '/privacy-policy', label: lang === 'bn' ? 'প্রাইভেসি পলিসি' : 'Privacy Policy' },
    { path: '/terms', label: lang === 'bn' ? 'শর্তাবলী' : 'Terms & Conditions' },
    { path: '/refund-policy', label: lang === 'bn' ? 'রিফান্ড পলিসি' : 'Refund Policy' },
  ];

  return (
    <footer className="border-t border-slate-200 bg-[#0B1F3A] text-slate-300">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-4">
          <div className="md:col-span-2">
            <div className="font-display text-xl font-bold tracking-tight text-white">
              {settings?.site_name || 'SERA ACADEMY'}
            </div>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-300">
              {lang === 'bn' ? settings?.about_text_bn : settings?.about_text}
            </p>
            <div className="mt-5 flex items-center gap-2">
              <span className="text-xs text-slate-400">Language:</span>
              <div className="inline-flex rounded-md border border-slate-700 bg-slate-900/60 p-0.5">
                <button
                  type="button"
                  onClick={() => setLang('en')}
                  className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                    lang === 'en' ? 'bg-[var(--brand-accent)] text-[#0B1F3A]' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  English
                </button>
                <button
                  type="button"
                  onClick={() => setLang('bn')}
                  className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                    lang === 'bn' ? 'bg-[var(--brand-accent)] text-[#0B1F3A]' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  বাংলা
                </button>
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-display text-sm font-semibold text-white">
              {lang === 'bn' ? 'একাডেমি' : 'Academy'}
            </h3>
            <ul className="mt-3 space-y-2.5 text-sm">
              {links.map((item) => (
                <li key={item.path}>
                  <a
                    href={item.path}
                    onClick={(e) => {
                      e.preventDefault();
                      navigate(item.path);
                    }}
                    className="text-slate-300 transition-colors hover:text-[var(--brand-accent)]"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
              {needsAdminSetup && (
                <li>
                  <a
                    href="/auth/admin-setup"
                    onClick={(e) => {
                      e.preventDefault();
                      navigate('/auth/admin-setup');
                    }}
                    className="text-[var(--brand-accent)] font-medium hover:underline"
                  >
                    Initialize Admin Account
                  </a>
                </li>
              )}
            </ul>
          </div>

          <div>
            <h3 className="font-display text-sm font-semibold text-white">
              {lang === 'bn' ? 'যোগাযোগ ও নীতিমালা' : 'Contact & Legal'}
            </h3>
            <ul className="mt-3 space-y-2 text-sm text-slate-300">
              <li>{settings?.contact_email || 'support@seraacademy.com'}</li>
              <li>{settings?.contact_phone || '+880 1700-000000'}</li>
              <li className="text-slate-400">{settings?.contact_address || 'Dhaka, Bangladesh'}</li>
            </ul>
            <ul className="mt-4 space-y-2 text-xs text-slate-400">
              {legalLinks.map((item) => (
                <li key={item.path}>
                  <a
                    href={item.path}
                    onClick={(e) => {
                      e.preventDefault();
                      navigate(item.path);
                    }}
                    className="hover:text-white transition-colors"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-4 border-t border-slate-800 pt-6 text-xs text-slate-400 sm:flex-row sm:items-center">
          <p>
            © {new Date().getFullYear()} {settings?.footer_text || 'SERA ACADEMY. All rights reserved.'}
          </p>
          <div className="flex flex-wrap items-center gap-4">
            {settings?.facebook_page_link && (
              <a
                href={settings.facebook_page_link}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-white"
              >
                Facebook
              </a>
            )}
            {settings?.telegram_support_link && (
              <a
                href={settings.telegram_support_link}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-white"
              >
                Telegram
              </a>
            )}
            {settings?.whatsapp_support_link && (
              <a
                href={settings.whatsapp_support_link}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-white"
              >
                WhatsApp
              </a>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
}
