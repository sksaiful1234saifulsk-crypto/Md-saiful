import React, { useEffect, useState } from 'react';
import { CheckCircle2, Mail, MessageSquare, ExternalLink } from 'lucide-react';
import type { Course } from '../types/academy';
import { useApp } from '../context/AppContext';
import { apiRequest } from '../lib/api';
import { CourseCard } from '../components/courses/CourseCard';

export function InstructorDetailPage({ slug }: { slug: string }) {
  const { lang } = useApp();
  const [instructor, setInstructor] = useState<{ name: string; title: string; bio: string } | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const res = await apiRequest<{
          instructor: { name: string; title: string; bio: string };
          courses: Course[];
        }>(`/api/public/instructors/${encodeURIComponent(slug)}`);
        setInstructor(res.instructor);
        setCourses(res.courses);
      } catch {
        setInstructor(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-16">
        <div className="h-48 animate-pulse rounded-xl bg-white border border-slate-200" />
      </div>
    );
  }

  if (!instructor) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <h1 className="font-display text-2xl font-bold text-slate-900">Instructor Not Found</h1>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="rounded-xl border border-slate-200 bg-white p-8">
        <div className="text-xs font-medium text-[var(--brand-accent)]">
          {lang === 'bn' ? 'কোর্স ইনস্ট্রাক্টর' : 'Faculty & Mentor'}
        </div>
        <h1 className="mt-2 font-display text-3xl font-bold text-slate-900">{instructor.name}</h1>
        <p className="mt-1 text-sm font-medium text-slate-500">{instructor.title}</p>
        <p className="mt-4 max-w-3xl text-sm leading-relaxed text-slate-700">{instructor.bio}</p>
      </div>

      <h2 className="mt-10 font-display text-2xl font-bold text-slate-900">
        {lang === 'bn' ? 'ইনস্ট্রাক্টরের কোর্সসমূহ' : `Courses Taught by ${instructor.name}`}
      </h2>
      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {courses.map((c) => (
          <CourseCard key={c.id} course={c} />
        ))}
      </div>
    </div>
  );
}

export function AboutPage() {
  const { settings, lang } = useApp();
  return (
    <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6 lg:px-8">
      <div className="rounded-xl border border-slate-200 bg-white p-8 sm:p-10">
        <h1 className="font-display text-3xl font-bold text-[var(--brand-primary)]">
          {settings?.about_title || 'About SERA ACADEMY'}
        </h1>
        <p className="mt-5 text-base leading-relaxed text-slate-700">
          {lang === 'bn' ? settings?.about_text_bn : settings?.about_text}
        </p>

        {settings?.why_choose_json && (
          <div className="mt-10 grid grid-cols-1 gap-6 border-t border-slate-200 pt-8 md:grid-cols-2">
            {settings.why_choose_json.map((w, idx) => (
              <div key={idx} className="rounded-lg border border-slate-200 bg-slate-50 p-5">
                <h2 className="font-display text-base font-semibold text-slate-900">
                  {String(idx + 1).padStart(2, '0')}. {lang === 'bn' && w.title_bn ? w.title_bn : w.title}
                </h2>
                <p className="mt-2 text-sm text-slate-600">
                  {lang === 'bn' && w.description_bn ? w.description_bn : w.description}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function ContactSupportPage({ mode }: { mode: 'contact' | 'support' }) {
  const { settings, user, lang } = useApp();
  const [form, setForm] = useState({
    sender_name: user?.full_name || '',
    sender_email: user?.email || '',
    sender_phone: user?.phone || '',
    subject: '',
    message: '',
  });
  const [status, setStatus] = useState<{ ok?: string; err?: string; busy?: boolean }>({});

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus({ busy: true });
    try {
      const res = await apiRequest<{ message: string }>('/api/public/support', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      setStatus({ ok: res.message });
      setForm({ ...form, subject: '', message: '' });
    } catch (err) {
      setStatus({ err: err instanceof Error ? err.message : 'Submission failed.' });
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-5">
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h1 className="font-display text-2xl font-bold text-slate-900">
              {mode === 'support'
                ? lang === 'bn'
                  ? 'সাপোর্ট সেন্টার'
                  : 'Support Center'
                : lang === 'bn'
                  ? 'যোগাযোগ করুন'
                  : 'Contact Us'}
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              {lang === 'bn'
                ? 'পেমেন্ট যাচাই, কমিউনিটি অ্যাক্সেস বা টেকনিক্যাল সহায়তার জন্য সরাসরি যোগাযোগ করুন।'
                : 'Reach our support team regarding course enrollment, bKash/Nagad payments, or community verification.'}
            </p>

            <div className="mt-6 space-y-3 border-t border-slate-100 pt-5 text-sm">
              <div>
                <div className="text-xs text-slate-500">Email</div>
                <div className="font-medium text-slate-900">
                  {settings?.email_support_address || settings?.contact_email}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Phone</div>
                <div className="font-medium text-slate-900">{settings?.contact_phone}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Address</div>
                <div className="font-medium text-slate-900">{settings?.contact_address}</div>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-2.5 border-t border-slate-100 pt-5">
              {settings?.whatsapp_support_link && (
                <a
                  href={settings.whatsapp_support_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-11 items-center justify-between rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-800 hover:bg-slate-50"
                >
                  <span className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-emerald-600" />
                    WhatsApp Support
                  </span>
                  <ExternalLink className="h-4 w-4 text-slate-400" />
                </a>
              )}
              {settings?.telegram_support_link && (
                <a
                  href={settings.telegram_support_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-11 items-center justify-between rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-800 hover:bg-slate-50"
                >
                  <span className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-sky-600" />
                    Telegram Support
                  </span>
                  <ExternalLink className="h-4 w-4 text-slate-400" />
                </a>
              )}
              {settings?.facebook_page_link && (
                <a
                  href={settings.facebook_page_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-11 items-center justify-between rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-800 hover:bg-slate-50"
                >
                  <span className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-blue-600" />
                    Facebook Page
                  </span>
                  <ExternalLink className="h-4 w-4 text-slate-400" />
                </a>
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-7">
          <form
            onSubmit={submitForm}
            className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8 space-y-4"
          >
            <h2 className="font-display text-lg font-bold text-slate-900">
              {lang === 'bn' ? 'সাপোর্ট টিকেট পাঠান' : 'Submit a Support Ticket'}
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <input
                type="text"
                required
                placeholder="Full Name"
                value={form.sender_name}
                onChange={(e) => setForm({ ...form, sender_name: e.target.value })}
                className="h-11 rounded-lg border border-slate-300 px-3.5 text-sm focus:border-[var(--brand-primary)] focus:outline-none"
              />
              <input
                type="email"
                required
                placeholder="Email Address"
                value={form.sender_email}
                onChange={(e) => setForm({ ...form, sender_email: e.target.value })}
                className="h-11 rounded-lg border border-slate-300 px-3.5 text-sm focus:border-[var(--brand-primary)] focus:outline-none"
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <input
                type="tel"
                placeholder="Phone Number"
                value={form.sender_phone}
                onChange={(e) => setForm({ ...form, sender_phone: e.target.value })}
                className="h-11 rounded-lg border border-slate-300 px-3.5 text-sm focus:border-[var(--brand-primary)] focus:outline-none"
              />
              <input
                type="text"
                required
                placeholder="Subject"
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                className="h-11 rounded-lg border border-slate-300 px-3.5 text-sm focus:border-[var(--brand-primary)] focus:outline-none"
              />
            </div>
            <textarea
              required
              rows={5}
              placeholder="Describe your question or issue..."
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              className="w-full rounded-lg border border-slate-300 p-3.5 text-sm focus:border-[var(--brand-primary)] focus:outline-none"
            />
            {status.ok && (
              <div className="flex items-center gap-2 text-sm text-emerald-700">
                <CheckCircle2 className="h-4 w-4" />
                <span>{status.ok}</span>
              </div>
            )}
            {status.err && <p className="text-sm text-red-600">{status.err}</p>}
            <button
              type="submit"
              disabled={status.busy}
              className="h-11 rounded-lg bg-[var(--brand-primary)] px-6 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-60"
            >
              {status.busy ? 'Sending...' : 'Submit Ticket'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export function LegalPage({ type }: { type: 'privacy' | 'terms' | 'refund' }) {
  const { settings } = useApp();
  const siteName = settings?.site_name || 'SERA ACADEMY';

  const content = {
    privacy: {
      title: 'Privacy Policy',
      paragraphs: [
        `${siteName} collects only the account, enrollment, payment transaction, and community verification records required to deliver authorized educational services.`,
        'Student passwords are salted and hashed with cryptographic key derivation. Private video streams and downloadable resources are served exclusively via short-lived signed URLs to verified enrolled learners.',
        'We never sell student contact details to third parties. For account deletion or data corrections, contact our support desk.',
      ],
    },
    terms: {
      title: 'Terms & Conditions',
      paragraphs: [
        `By creating an account or enrolling in a program at ${siteName}, you agree that course access is strictly personal and non-transferable.`,
        'Students must complete manual bKash or Nagad payment verification and fulfill mandatory Telegram and WhatsApp community verification rules for each enrolled course.',
        'Redistributing private video lessons, PDF workbooks, or cohort access credentials violates platform rules and may result in enrollment revocation.',
      ],
    },
    refund: {
      title: 'Refund Policy',
      paragraphs: [
        'Because digital courses include immediate access to downloadable materials and mentor communities upon verification, refund requests are evaluated within 48 hours of enrollment approval if less than 10% of lessons have been accessed.',
        'Duplicate or erroneous bKash/Nagad transfers that are rejected during manual verification are refunded to the original sender number after transaction confirmation.',
      ],
    },
  }[type];

  return (
    <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6 lg:px-8">
      <div className="rounded-xl border border-slate-200 bg-white p-8 sm:p-10">
        <h1 className="font-display text-3xl font-bold text-slate-900">{content.title}</h1>
        <div className="mt-6 space-y-4 text-sm leading-relaxed text-slate-700">
          {content.paragraphs.map((p, idx) => (
            <p key={idx}>{p}</p>
          ))}
        </div>
      </div>
    </div>
  );
}
