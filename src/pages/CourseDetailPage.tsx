import React, { useEffect, useState } from 'react';
import { Lock, Play, CheckCircle2, Clock, User, ShieldCheck, X } from 'lucide-react';
import type { Chapter, Course, PaymentMethod } from '../types/academy';
import { useApp } from '../context/AppContext';
import { apiRequest } from '../lib/api';
import { SafeImage } from '../components/common/SafeImage';

interface CourseDetailPayload {
  course: Course;
  chapters: Chapter[];
  communityRequirements: {
    telegram_required: boolean;
    whatsapp_required: boolean;
    instructions: string;
    instructions_bn: string;
  };
  viewerEnrollment: { id: string; status: string } | null;
  viewerPayment: {
    id: string;
    payment_method: string;
    amount: number;
    transaction_id: string;
    status: string;
    rejection_reason: string;
  } | null;
}

export function CourseDetailPage({ slug }: { slug: string }) {
  const { user, settings, lang, navigate } = useApp();
  const [data, setData] = useState<CourseDetailPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Manual bKash / Nagad checkout modal
  const [showCheckout, setShowCheckout] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('bkash');
  const [transactionId, setTransactionId] = useState('');
  const [payerPhone, setPayerPhone] = useState('');
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [paymentFeedback, setPaymentFeedback] = useState<{ ok?: string; err?: string }>({});

  const loadCourse = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiRequest<CourseDetailPayload>(`/api/public/courses/${encodeURIComponent(slug)}`);
      setData(res);
      if (settings && !settings.bkash_enabled && settings.nagad_enabled) {
        setPaymentMethod('nagad');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load course details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadCourse();
  }, [slug, user?.id]);

  const handleBuyClick = () => {
    if (!user) {
      navigate(`/auth/login?next=${encodeURIComponent(`/courses/${slug}`)}`);
      return;
    }
    setPaymentFeedback({});
    setPayerPhone(user.phone || '');
    setShowCheckout(true);
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data) return;
    setSubmittingPayment(true);
    setPaymentFeedback({});
    try {
      const res = await apiRequest<{ message: string }>('/api/student/payments', {
        method: 'POST',
        body: JSON.stringify({
          course_id: data.course.id,
          payment_method: paymentMethod,
          transaction_id: transactionId.trim(),
          payer_phone: payerPhone.trim(),
        }),
      });
      setPaymentFeedback({ ok: res.message });
      setTransactionId('');
      await loadCourse();
    } catch (err) {
      setPaymentFeedback({
        err: err instanceof Error ? err.message : 'Could not submit payment.',
      });
    } finally {
      setSubmittingPayment(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="h-96 animate-pulse rounded-xl border border-slate-200 bg-white" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <h1 className="font-display text-2xl font-bold text-slate-900">Course Unavailable</h1>
        <p className="mt-2 text-sm text-slate-600">{error || 'This course could not be found.'}</p>
        <button
          type="button"
          onClick={() => navigate('/courses')}
          className="mt-6 rounded-lg bg-[var(--brand-primary)] px-5 py-2.5 text-sm font-medium text-white"
        >
          Back to Courses
        </button>
      </div>
    );
  }

  const { course, chapters, communityRequirements, viewerEnrollment, viewerPayment } = data;
  const title = lang === 'bn' && course.title_bn ? course.title_bn : course.title;
  const fullDesc =
    lang === 'bn' && course.full_description_bn ? course.full_description_bn : course.full_description;
  const hasDiscount =
    course.discount_price !== null &&
    course.discount_price >= 0 &&
    course.discount_price < course.price;
  const activePrice = hasDiscount ? course.discount_price! : course.price;
  const isEnrolled = viewerEnrollment?.status === 'active';

  return (
    <div className="bg-slate-50 pb-16">
      {/* Course Hero Header */}
      <div className="border-b border-slate-200 bg-[#0B1F3A] text-white">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
                <span className="text-[var(--brand-accent)] font-medium">
                  {lang === 'bn' && course.category_name_bn
                    ? course.category_name_bn
                    : course.category_name || 'Course'}
                </span>
                <span aria-hidden="true">·</span>
                <span>{course.level}</span>
                <span aria-hidden="true">·</span>
                <span>{course.language}</span>
                {course.duration && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{course.duration}</span>
                  </>
                )}
              </div>

              <h1 className="mt-3 headline-balance font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
                {title}
              </h1>
              <p className="mt-4 text-base leading-relaxed text-slate-200">
                {lang === 'bn' && course.short_description_bn
                  ? course.short_description_bn
                  : course.short_description}
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-6 border-t border-slate-800 pt-5 text-sm text-slate-300">
                <button
                  type="button"
                  onClick={() => navigate(`/instructors/${course.instructor_slug}`)}
                  className="inline-flex items-center gap-2 hover:text-[var(--brand-accent)] transition-colors"
                >
                  <User className="h-4 w-4 text-[var(--brand-accent)]" />
                  <span>
                    {lang === 'bn' ? 'ইনস্ট্রাক্টর:' : 'Instructor:'} {course.instructor_name}
                  </span>
                </button>
                <span className="inline-flex items-center gap-2 tabular-nums">
                  <Clock className="h-4 w-4 text-[var(--brand-accent)]" />
                  <span>
                    {course.lesson_count ?? 0} {lang === 'bn' ? 'টি লেসন' : 'Lessons'}
                  </span>
                </span>
              </div>
            </div>

            {/* Enrollment & Pricing Card */}
            <div className="lg:col-span-5">
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-900">
                <div className="aspect-[4/3] w-full overflow-hidden bg-slate-100">
                  <SafeImage
                    src={course.thumbnail_url}
                    alt={title}
                    fallbackTitle={title}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="p-6">
                  <div className="flex items-baseline gap-3 tabular-nums">
                    <span className="font-display text-3xl font-bold text-[var(--brand-primary)]">
                      ৳{activePrice.toLocaleString()}
                    </span>
                    {hasDiscount && (
                      <span className="text-sm text-slate-400 line-through">
                        ৳{course.price.toLocaleString()}
                      </span>
                    )}
                  </div>

                  {isEnrolled ? (
                    <div className="mt-5 space-y-3">
                      <div className="flex items-center gap-2 text-sm font-medium text-emerald-700">
                        <CheckCircle2 className="h-4 w-4 shrink-0" />
                        <span>
                          {lang === 'bn'
                            ? 'আপনি এই কোর্সে এনরোলকৃত আছেন'
                            : 'Your enrollment is active'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => navigate(`/student/classroom/${course.slug}`)}
                        className="w-full rounded-lg bg-[var(--brand-primary)] px-5 py-3 text-sm font-semibold text-white hover:opacity-95 min-h-[44px]"
                      >
                        {lang === 'bn' ? 'ক্লাসরুমে প্রবেশ করুন' : 'Open Course Classroom'}
                      </button>
                    </div>
                  ) : viewerPayment?.status === 'pending' ? (
                    <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                      <div className="font-semibold">
                        {lang === 'bn' ? 'পেমেন্ট যাচাই চলছে' : 'Payment Verification Pending'}
                      </div>
                      <p className="mt-1 text-xs">
                        TrxID: <span className="font-mono">{viewerPayment.transaction_id}</span> ·{' '}
                        {viewerPayment.payment_method.toUpperCase()}
                      </p>
                      <button
                        type="button"
                        onClick={() => navigate('/student/payments')}
                        className="mt-3 text-xs font-semibold underline"
                      >
                        {lang === 'bn' ? 'পেমেন্ট স্ট্যাটাস দেখুন' : 'View Payment Status'}
                      </button>
                    </div>
                  ) : (
                    <div className="mt-5 space-y-3">
                      {viewerPayment?.status === 'rejected' && (
                        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
                          Previous payment ({viewerPayment.transaction_id}) rejected:{' '}
                          {viewerPayment.rejection_reason}
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={handleBuyClick}
                        className="w-full rounded-lg bg-[var(--brand-accent)] px-5 py-3 text-sm font-bold text-[#0B1F3A] transition-colors hover:opacity-95 min-h-[44px]"
                      >
                        {lang === 'bn' ? 'এখনই কিনুন (বিকাশ / নগদ)' : 'Buy Now via bKash / Nagad'}
                      </button>
                    </div>
                  )}

                  {/* Mandatory Community Requirement Notice */}
                  {(communityRequirements.telegram_required || communityRequirements.whatsapp_required) && (
                    <div className="mt-5 border-t border-slate-100 pt-4 text-xs leading-relaxed text-slate-600">
                      <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                        <ShieldCheck className="h-4 w-4 text-[var(--brand-primary)] shrink-0" />
                        <span>
                          {lang === 'bn'
                            ? 'বাধ্যতামূলক কমিউনিটি নীতিমালা'
                            : 'Mandatory Community Access Rule'}
                        </span>
                      </div>
                      <p className="mt-1">
                        {lang === 'bn'
                          ? 'পেমেন্ট অ্যাপ্রুভাল এবং টেলিগ্রাম ও হোয়াটসঅ্যাপ উভয় গ্রুপে ভেরিফিকেশনের পর প্রাইভেট ক্লাসরুম আনলক হবে।'
                          : 'Private classroom lessons unlock after payment approval and verified membership in both the course Telegram channel and WhatsApp group.'}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content: Description + Curriculum */}
      <div className="mx-auto mt-10 max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
          <div className="space-y-8 lg:col-span-7">
            <section className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8">
              <h2 className="font-display text-xl font-bold text-slate-900">
                {lang === 'bn' ? 'কোর্স বিবরণ' : 'About This Course'}
              </h2>
              <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-700">
                {fullDesc}
              </p>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8">
              <h2 className="font-display text-xl font-bold text-slate-900">
                {lang === 'bn' ? 'কোর্স কারিকুলাম' : 'Course Curriculum'}
              </h2>
              <div className="mt-5 space-y-4">
                {chapters.map((ch, idx) => (
                  <div key={ch.id} className="overflow-hidden rounded-lg border border-slate-200">
                    <div className="bg-slate-50 px-4 py-3 font-display text-sm font-semibold text-slate-900">
                      {String(idx + 1).padStart(2, '0')}. {lang === 'bn' && ch.title_bn ? ch.title_bn : ch.title}
                    </div>
                    <ul className="divide-y divide-slate-100 bg-white">
                      {(ch.lessons || []).map((lesson) => (
                        <li
                          key={lesson.id}
                          className="flex items-center justify-between gap-4 px-4 py-3 text-sm"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {lesson.is_free_preview || isEnrolled ? (
                              <Play className="h-4 w-4 shrink-0 text-[var(--brand-primary)]" />
                            ) : (
                              <Lock className="h-4 w-4 shrink-0 text-slate-400" />
                            )}
                            <span className="truncate text-slate-800">
                              {lang === 'bn' && lesson.title_bn ? lesson.title_bn : lesson.title}
                            </span>
                          </div>
                          <span className="shrink-0 text-xs text-slate-500 tabular-nums">
                            {lesson.duration_seconds
                              ? `${Math.ceil(lesson.duration_seconds / 60)} min`
                              : 'Video'}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <div className="lg:col-span-5">
            <section className="rounded-xl border border-slate-200 bg-white p-6">
              <h2 className="font-display text-lg font-bold text-slate-900">
                {lang === 'bn' ? 'কোর্স ইনস্ট্রাক্টর' : 'Course Instructor'}
              </h2>
              <div className="mt-4">
                <div className="font-display text-base font-semibold text-[var(--brand-primary)]">
                  {course.instructor_name}
                </div>
                <div className="text-xs text-slate-500">{course.instructor_title}</div>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">{course.instructor_bio}</p>
                <button
                  type="button"
                  onClick={() => navigate(`/instructors/${course.instructor_slug}`)}
                  className="mt-4 text-sm font-medium text-[var(--brand-primary)] hover:underline"
                >
                  {lang === 'bn' ? 'ইনস্ট্রাক্টরের প্রোফাইল দেখুন' : 'View Instructor Profile'}
                </button>
              </div>
            </section>
          </div>
        </div>
      </div>

      {/* MANUAL BKASH / NAGAD PAYMENT MODAL */}
      {showCheckout && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 p-0 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-6 sm:rounded-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div>
                <h2 className="font-display text-lg font-bold text-slate-900">
                  {lang === 'bn' ? 'ম্যানুয়াল পেমেন্ট জমা দিন' : 'Manual Course Payment'}
                </h2>
                <p className="text-xs text-slate-500">{title}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowCheckout(false)}
                aria-label="Close payment modal"
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 min-h-[40px] min-w-[40px]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3 text-sm">
                <span className="text-slate-600">
                  {lang === 'bn' ? 'পরিশোধযোগ্য ফি:' : 'Total Course Fee:'}
                </span>
                <span className="font-display text-xl font-bold text-[var(--brand-primary)] tabular-nums">
                  ৳{activePrice.toLocaleString()}
                </span>
              </div>

              {/* Payment Method Selector */}
              <div className="grid grid-cols-2 gap-3">
                {settings?.bkash_enabled && (
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('bkash')}
                    className={`rounded-lg border p-3 text-left transition-colors min-h-[56px] ${
                      paymentMethod === 'bkash'
                        ? 'border-[#E2136E] bg-[#E2136E]/5 text-slate-900'
                        : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    <div className="text-sm font-bold text-[#E2136E]">bKash</div>
                    <div className="mt-0.5 font-mono text-xs text-slate-700">
                      {settings.bkash_number}
                    </div>
                  </button>
                )}
                {settings?.nagad_enabled && (
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('nagad')}
                    className={`rounded-lg border p-3 text-left transition-colors min-h-[56px] ${
                      paymentMethod === 'nagad'
                        ? 'border-[#F7941D] bg-[#F7941D]/10 text-slate-900'
                        : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    <div className="text-sm font-bold text-[#D9531E]">Nagad</div>
                    <div className="mt-0.5 font-mono text-xs text-slate-700">
                      {settings.nagad_number}
                    </div>
                  </button>
                )}
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-xs leading-relaxed text-slate-700 whitespace-pre-line">
                {lang === 'bn' && settings?.payment_instructions_bn
                  ? settings.payment_instructions_bn
                  : settings?.payment_instructions}
              </div>

              <form onSubmit={handlePaymentSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    {lang === 'bn' ? 'ট্রানজেকশন আইডি (Transaction ID)' : 'Transaction ID (TrxID)'}
                  </label>
                  <input
                    type="text"
                    required
                    value={transactionId}
                    onChange={(e) => setTransactionId(e.target.value.toUpperCase())}
                    placeholder="e.g. BK9X72LM4P"
                    className="mt-1 h-11 w-full rounded-lg border border-slate-300 px-3.5 font-mono text-sm uppercase focus:border-[var(--brand-primary)] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    {lang === 'bn' ? 'যে নম্বর থেকে টাকা পাঠিয়েছেন' : 'Payer Mobile Number'}
                  </label>
                  <input
                    type="tel"
                    required
                    value={payerPhone}
                    onChange={(e) => setPayerPhone(e.target.value)}
                    placeholder="017XXXXXXXX"
                    className="mt-1 h-11 w-full rounded-lg border border-slate-300 px-3.5 font-mono text-sm focus:border-[var(--brand-primary)] focus:outline-none"
                  />
                </div>

                {paymentFeedback.ok && (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
                    {paymentFeedback.ok}
                  </div>
                )}
                {paymentFeedback.err && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                    {paymentFeedback.err}
                  </div>
                )}

                <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={() => setShowCheckout(false)}
                    className="h-11 rounded-lg border border-slate-300 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    {lang === 'bn' ? 'বন্ধ করুন' : 'Close'}
                  </button>
                  <button
                    type="submit"
                    disabled={submittingPayment || Boolean(paymentFeedback.ok)}
                    className="h-11 rounded-lg bg-[var(--brand-primary)] px-6 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-60"
                  >
                    {submittingPayment
                      ? lang === 'bn'
                        ? 'জমা হচ্ছে...'
                        : 'Submitting...'
                      : lang === 'bn'
                        ? 'পেমেন্ট জমা দিন'
                        : 'Submit for Verification'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
