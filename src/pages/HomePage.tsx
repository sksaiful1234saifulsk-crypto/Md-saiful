import React, { useEffect, useState } from 'react';
import { Search, ChevronDown, ChevronUp, ArrowRight, CheckCircle2 } from 'lucide-react';
import type { Course, CourseCategory } from '../types/academy';
import { useApp } from '../context/AppContext';
import { apiRequest } from '../lib/api';
import { SafeImage } from '../components/common/SafeImage';
import { CourseCard } from '../components/courses/CourseCard';

export function HomePage() {
  const { settings, lang, setLang, navigate } = useApp();
  const [courses, setCourses] = useState<Course[]>([]);
  const [categories, setCategories] = useState<CourseCategory[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [contactForm, setContactForm] = useState({
    sender_name: '',
    sender_email: '',
    sender_phone: '',
    subject: '',
    message: '',
  });
  const [contactStatus, setContactStatus] = useState<{ type: 'idle' | 'sending' | 'ok' | 'err'; text?: string }>({
    type: 'idle',
  });

  useEffect(() => {
    void (async () => {
      try {
        const [cRes, catRes] = await Promise.all([
          apiRequest<{ courses: Course[] }>('/api/public/courses'),
          apiRequest<{ categories: CourseCategory[] }>('/api/public/categories'),
        ]);
        setCourses(cRes.courses);
        setCategories(catRes.categories);
      } catch {
        // handled cleanly with empty state
      }
    })();
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    navigate(q ? `/courses?q=${encodeURIComponent(q)}` : '/courses');
  };

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setContactStatus({ type: 'sending' });
    try {
      const res = await apiRequest<{ message: string }>('/api/public/support', {
        method: 'POST',
        body: JSON.stringify(contactForm),
      });
      setContactStatus({ type: 'ok', text: res.message });
      setContactForm({ sender_name: '', sender_email: '', sender_phone: '', subject: '', message: '' });
    } catch (err) {
      setContactStatus({
        type: 'err',
        text: err instanceof Error ? err.message : 'Could not send message.',
      });
    }
  };

  const featuredCourses = courses.filter((c) => c.is_featured).slice(0, 3);
  const latestCourses = courses.slice(0, 4);

  const heroTitle =
    (lang === 'bn' ? settings?.hero_title_bn : settings?.hero_title) ||
    'Master Career-Ready Skills with Structured Mentorship';
  const heroSubtitle =
    (lang === 'bn' ? settings?.hero_subtitle_bn : settings?.hero_subtitle) ||
    'Cohort-grade courses with private video classrooms and verified mentor communities.';
  const heroCta =
    (lang === 'bn' ? settings?.hero_cta_text_bn : settings?.hero_cta_text) || 'Browse All Courses';

  return (
    <div className="bg-slate-50">
      {/* HERO SECTION */}
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
          {/* Language & Search Toolbar */}
          <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
            <div className="text-xs font-medium text-slate-500">
              <span>{settings?.site_name || 'SERA ACADEMY'}</span>
              <span className="mx-2" aria-hidden="true">·</span>
              <span>{lang === 'bn' ? 'বাংলা ও ইংরেজি মাধ্যম' : 'Bilingual Bengali & English'}</span>
            </div>
            <div className="inline-flex items-center rounded-lg bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setLang('en')}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  lang === 'en' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                English
              </button>
              <button
                type="button"
                onClick={() => setLang('bn')}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  lang === 'bn' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                বাংলা
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 items-stretch gap-10 lg:grid-cols-12">
            <div className="flex flex-col justify-center lg:col-span-6">
              <h1 className="headline-balance font-display text-3xl font-bold tracking-tight text-[var(--brand-primary)] sm:text-4xl lg:text-5xl lg:leading-[1.12]">
                {heroTitle}
              </h1>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg">
                {heroSubtitle}
              </p>

              {/* Search Courses Bar */}
              <form onSubmit={handleSearchSubmit} className="mt-7 flex flex-col gap-3 sm:flex-row">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={
                      lang === 'bn'
                        ? 'কোর্স, বিষয় বা ইনস্ট্রাক্টর খুঁজুন...'
                        : 'Search courses, topics, or instructors...'
                    }
                    className="h-12 w-full rounded-lg border border-slate-300 bg-white pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[var(--brand-primary)] focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-[var(--brand-primary)] px-6 text-sm font-semibold text-white transition-colors hover:opacity-95 whitespace-nowrap shrink-0"
                >
                  <span>{heroCta}</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </form>
            </div>

            <div className="lg:col-span-6">
              <div className="h-64 overflow-hidden rounded-xl border border-slate-200 bg-slate-100 sm:h-80 lg:h-full">
                <SafeImage
                  src={settings?.hero_banner_url || '/src/assets/images/hero_academy_campus_1795281746754.jpg'}
                  alt={settings?.site_name || 'SERA ACADEMY Campus'}
                  fallbackTitle={settings?.site_name || 'SERA ACADEMY'}
                  className="h-full w-full object-cover"
                />
              </div>
            </div>
          </div>

          {/* Academy Statistics (Full-Width 4-Column Strip Below Split) */}
          {settings?.stats_json && settings.stats_json.length > 0 && (
            <div className="mt-12 grid grid-cols-2 gap-6 border-t border-slate-200 pt-8 md:grid-cols-4">
              {settings.stats_json.map((stat, idx) => (
                <div key={idx}>
                  <div className="font-display text-2xl font-bold text-[var(--brand-primary)] tabular-nums sm:text-3xl">
                    {stat.value}
                  </div>
                  <div className="mt-1 text-sm text-slate-600">
                    {lang === 'bn' && stat.label_bn ? stat.label_bn : stat.label}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* FEATURED COURSES */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              {lang === 'bn' ? 'জনপ্রিয় ও ফিচার্ড কোর্স' : 'Featured Programs'}
            </h2>
            <p className="mt-1.5 text-sm text-slate-600">
              {lang === 'bn'
                ? 'ইন্ডাস্ট্রি মেন্টরদের তত্ত্বাবধানে পরিচালিত প্রফেশনাল কোর্সসমূহ।'
                : 'Structured curricula with private video lessons, workbooks, and verified cohort groups.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/courses')}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--brand-primary)] hover:text-[var(--brand-accent)] transition-colors whitespace-nowrap"
          >
            <span>{lang === 'bn' ? 'সব কোর্স দেখুন' : 'View All Courses'}</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {(featuredCourses.length > 0 ? featuredCourses : latestCourses.slice(0, 3)).map((course) => (
            <CourseCard key={course.id} course={course} />
          ))}
        </div>
      </section>

      {/* POPULAR CATEGORIES */}
      <section className="border-y border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900">
              {lang === 'bn' ? 'কোর্স ক্যাটাগরি' : 'Popular Categories'}
            </h2>
            <button
              type="button"
              onClick={() => navigate('/categories')}
              className="text-sm font-medium text-[var(--brand-primary)] hover:underline"
            >
              {lang === 'bn' ? 'সব ক্যাটাগরি' : 'All Categories'}
            </button>
          </div>

          <div className="mt-7 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => navigate(`/courses?category=${encodeURIComponent(cat.slug)}`)}
                className="flex flex-col items-start rounded-xl border border-slate-200 bg-slate-50/70 p-5 text-left transition-colors hover:border-[var(--brand-primary)] hover:bg-white"
              >
                <div className="text-xs font-medium text-[var(--brand-accent)] tabular-nums">
                  {cat.course_count ?? 0} {lang === 'bn' ? 'টি কোর্স' : 'Courses'}
                </div>
                <div className="mt-1.5 font-display text-base font-semibold text-slate-900">
                  {lang === 'bn' && cat.name_bn ? cat.name_bn : cat.name}
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-600 line-clamp-2">
                  {cat.description}
                </p>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* LATEST COURSES */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900">
          {lang === 'bn' ? 'সর্বশেষ প্রকাশিত কোর্স' : 'Latest Courses'}
        </h2>
        <div className="mt-7 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {latestCourses.map((course) => (
            <CourseCard key={course.id} course={course} />
          ))}
        </div>
      </section>

      {/* WHY CHOOSE US */}
      {settings?.why_choose_json && settings.why_choose_json.length > 0 && (
        <section className="border-y border-slate-200 bg-[#0B1F3A] text-white">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
            <div className="max-w-2xl">
              <h2 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
                {lang === 'bn'
                  ? 'কেন SERA ACADEMY বেছে নেবেন'
                  : `Why Learners Choose ${settings.site_name}`}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">
                {lang === 'bn' ? settings.about_text_bn : settings.about_text}
              </p>
            </div>

            <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2">
              {settings.why_choose_json.map((item, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-slate-800 bg-[#132F54]/60 p-6"
                >
                  <div className="font-display text-base font-semibold text-white">
                    {String(idx + 1).padStart(2, '0')}.{' '}
                    {lang === 'bn' && item.title_bn ? item.title_bn : item.title}
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-slate-300">
                    {lang === 'bn' && item.description_bn ? item.description_bn : item.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* STUDENT TESTIMONIALS */}
      {settings?.testimonials_json && settings.testimonials_json.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900">
            {lang === 'bn' ? 'শিক্ষার্থীদের অভিজ্ঞতা' : 'Student Outcomes & Testimonials'}
          </h2>
          <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
            {settings.testimonials_json.map((t, idx) => (
              <blockquote
                key={idx}
                className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-6"
              >
                <p className="text-sm leading-relaxed text-slate-700">
                  “{lang === 'bn' && t.quote_bn ? t.quote_bn : t.quote}”
                </p>
                <footer className="mt-5 border-t border-slate-100 pt-4">
                  <div className="font-display text-sm font-semibold text-slate-900">{t.name}</div>
                  <div className="mt-0.5 text-xs text-slate-500">
                    {t.role} · {t.organization}
                  </div>
                  <div className="mt-0.5 text-xs font-medium text-[var(--brand-accent)]">
                    {t.course}
                  </div>
                </footer>
              </blockquote>
            ))}
          </div>
        </section>
      )}

      {/* FAQ + CONTACT SECTION */}
      <section className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-12">
            {/* FAQ */}
            <div className="lg:col-span-6">
              <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900">
                {lang === 'bn' ? 'সচরাচর জিজ্ঞাসিত প্রশ্ন' : 'Frequently Asked Questions'}
              </h2>
              <div className="mt-6 divide-y divide-slate-200 border-y border-slate-200">
                {(settings?.faq_json || []).map((faq, idx) => {
                  const isOpen = openFaq === idx;
                  return (
                    <div key={idx} className="py-4">
                      <button
                        type="button"
                        onClick={() => setOpenFaq(isOpen ? null : idx)}
                        className="flex w-full items-center justify-between gap-4 text-left text-sm font-semibold text-slate-900"
                      >
                        <span>{lang === 'bn' && faq.question_bn ? faq.question_bn : faq.question}</span>
                        {isOpen ? (
                          <ChevronUp className="h-4 w-4 shrink-0 text-slate-500" />
                        ) : (
                          <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" />
                        )}
                      </button>
                      {isOpen && (
                        <p className="mt-2.5 text-sm leading-relaxed text-slate-600">
                          {lang === 'bn' && faq.answer_bn ? faq.answer_bn : faq.answer}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Contact Form */}
            <div className="lg:col-span-6">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 sm:p-8">
                <h2 className="font-display text-xl font-bold text-slate-900">
                  {lang === 'bn' ? 'সরাসরি যোগাযোগ করুন' : 'Send a Support Inquiry'}
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  {lang === 'bn'
                    ? 'ভর্তি বা পেমেন্ট সংক্রান্ত যেকোনো প্রশ্নে বার্তা পাঠান।'
                    : 'Questions about courses, bKash/Nagad payments, or cohort schedules? Write to us.'}
                </p>

                <form onSubmit={handleContactSubmit} className="mt-5 space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <input
                      type="text"
                      required
                      placeholder={lang === 'bn' ? 'আপনার নাম' : 'Full Name'}
                      value={contactForm.sender_name}
                      onChange={(e) => setContactForm({ ...contactForm, sender_name: e.target.value })}
                      className="h-11 rounded-lg border border-slate-300 bg-white px-3.5 text-sm focus:border-[var(--brand-primary)] focus:outline-none"
                    />
                    <input
                      type="email"
                      required
                      placeholder={lang === 'bn' ? 'ইমেইল' : 'Email Address'}
                      value={contactForm.sender_email}
                      onChange={(e) => setContactForm({ ...contactForm, sender_email: e.target.value })}
                      className="h-11 rounded-lg border border-slate-300 bg-white px-3.5 text-sm focus:border-[var(--brand-primary)] focus:outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <input
                      type="tel"
                      placeholder={lang === 'bn' ? 'ফোন নম্বর (ঐচ্ছিক)' : 'Phone Number (Optional)'}
                      value={contactForm.sender_phone}
                      onChange={(e) => setContactForm({ ...contactForm, sender_phone: e.target.value })}
                      className="h-11 rounded-lg border border-slate-300 bg-white px-3.5 text-sm focus:border-[var(--brand-primary)] focus:outline-none"
                    />
                    <input
                      type="text"
                      required
                      placeholder={lang === 'bn' ? 'বিষয়' : 'Subject'}
                      value={contactForm.subject}
                      onChange={(e) => setContactForm({ ...contactForm, subject: e.target.value })}
                      className="h-11 rounded-lg border border-slate-300 bg-white px-3.5 text-sm focus:border-[var(--brand-primary)] focus:outline-none"
                    />
                  </div>
                  <textarea
                    required
                    rows={3}
                    placeholder={lang === 'bn' ? 'আপনার বার্তা লিখুন...' : 'Write your message...'}
                    value={contactForm.message}
                    onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 bg-white p-3.5 text-sm focus:border-[var(--brand-primary)] focus:outline-none"
                  />

                  {contactStatus.type === 'ok' && (
                    <div className="flex items-center gap-2 text-sm text-emerald-700">
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                      <span>{contactStatus.text}</span>
                    </div>
                  )}
                  {contactStatus.type === 'err' && (
                    <p className="text-sm text-red-600">{contactStatus.text}</p>
                  )}

                  <button
                    type="submit"
                    disabled={contactStatus.type === 'sending'}
                    className="inline-flex h-11 items-center justify-center rounded-lg bg-[var(--brand-primary)] px-6 text-sm font-semibold text-white transition-colors hover:opacity-95 disabled:opacity-60"
                  >
                    {contactStatus.type === 'sending'
                      ? lang === 'bn'
                        ? 'পাঠানো হচ্ছে...'
                        : 'Sending...'
                      : lang === 'bn'
                        ? 'বার্তা পাঠান'
                        : 'Send Message'}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
