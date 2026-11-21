import React, { useEffect, useState } from 'react';
import {
  BookOpen,
  CreditCard,
  Users,
  Bell,
  LifeBuoy,
  Settings,
  LayoutDashboard,
  LogOut,
  ExternalLink,
  CheckCircle2,
  Clock,
  XCircle,
} from 'lucide-react';
import type {
  CommunityMembership,
  EnrollmentWithAccess,
  NotificationItem,
  PaymentRecord,
  SupportMessage,
} from '../../types/academy';
import { useApp } from '../../context/AppContext';
import { apiRequest } from '../../lib/api';
import { SafeImage } from '../../components/common/SafeImage';

type StudentTab =
  | 'overview'
  | 'courses'
  | 'payments'
  | 'community'
  | 'notifications'
  | 'support'
  | 'settings';

export function StudentDashboard({ initialTab = 'overview' }: { initialTab?: StudentTab }) {
  const { user, lang, navigate, logout, refreshUser } = useApp();
  const [tab, setTab] = useState<StudentTab>(initialTab);
  const [enrollments, setEnrollments] = useState<EnrollmentWithAccess[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [memberships, setMemberships] = useState<CommunityMembership[]>([]);
  const [supportTickets, setSupportTickets] = useState<SupportMessage[]>([]);
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [loading, setLoading] = useState(true);

  // Community submission states keyed by course_id
  const [tgInputs, setTgInputs] = useState<Record<string, { username: string; userId: string }>>({});
  const [waInputs, setWaInputs] = useState<Record<string, string>>({});
  const [commFeedback, setCommFeedback] = useState<Record<string, string>>({});

  // Support ticket form
  const [ticketForm, setTicketForm] = useState({ subject: '', message: '' });
  const [ticketNotice, setTicketNotice] = useState('');

  // Account settings forms
  const [profileForm, setProfileForm] = useState({
    full_name: user?.full_name || '',
    phone: user?.phone || '',
    bio: user?.bio || '',
    preferred_language: user?.preferred_language || 'en',
  });
  const [verifyCode, setVerifyCode] = useState('');
  const [pwForm, setPwForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });
  const [settingsMsg, setSettingsMsg] = useState<{ ok?: string; err?: string }>({});

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (user) {
      setProfileForm({
        full_name: user.full_name,
        phone: user.phone,
        bio: user.bio,
        preferred_language: user.preferred_language,
      });
    }
  }, [user]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [dash, comm, sup] = await Promise.all([
        apiRequest<{
          enrollments: EnrollmentWithAccess[];
          payments: PaymentRecord[];
          notifications: NotificationItem[];
        }>('/api/student/dashboard'),
        apiRequest<{ memberships: CommunityMembership[] }>('/api/student/community'),
        apiRequest<{ messages: SupportMessage[] }>('/api/student/support'),
      ]);
      setEnrollments(dash.enrollments);
      setPayments(dash.payments);
      setNotifications(dash.notifications);
      setMemberships(comm.memberships);
      setSupportTickets(sup.messages);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      void loadAll();
    }
  }, [user?.id]);

  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <div className="rounded-xl border border-slate-200 bg-white p-8">
          <h1 className="font-display text-xl font-bold text-slate-900">Sign In Required</h1>
          <p className="mt-2 text-sm text-slate-600">
            Please sign in to access your student dashboard.
          </p>
          <button
            type="button"
            onClick={() => navigate('/auth/login')}
            className="mt-5 h-11 w-full rounded-lg bg-[var(--brand-primary)] text-sm font-semibold text-white"
          >
            Sign In
          </button>
        </div>
      </div>
    );
  }

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const switchTab = (next: StudentTab, path: string) => {
    setTab(next);
    navigate(path);
  };

  const handleMarkRead = async (id?: string) => {
    await apiRequest('/api/student/notifications/read', {
      method: 'POST',
      body: JSON.stringify({ notification_id: id }),
    });
    await loadAll();
  };

  const handleSubmitTelegram = async (courseId: string) => {
    const input = tgInputs[courseId] || { username: '', userId: '' };
    setCommFeedback({ ...commFeedback, [courseId]: '' });
    try {
      const res = await apiRequest<{ message: string }>('/api/student/community/verify-telegram', {
        method: 'POST',
        body: JSON.stringify({
          course_id: courseId,
          telegram_username: input.username,
          telegram_user_id: input.userId,
        }),
      });
      setCommFeedback({ ...commFeedback, [courseId]: res.message });
      await loadAll();
    } catch (err) {
      setCommFeedback({
        ...commFeedback,
        [courseId]: err instanceof Error ? err.message : 'Submission failed.',
      });
    }
  };

  const handleSubmitWhatsapp = async (courseId: string) => {
    const phone = waInputs[courseId] || user.phone || '';
    setCommFeedback({ ...commFeedback, [courseId]: '' });
    try {
      const res = await apiRequest<{ message: string }>('/api/student/community/submit-whatsapp', {
        method: 'POST',
        body: JSON.stringify({
          course_id: courseId,
          whatsapp_phone: phone,
        }),
      });
      setCommFeedback({ ...commFeedback, [courseId]: res.message });
      await loadAll();
    } catch (err) {
      setCommFeedback({
        ...commFeedback,
        [courseId]: err instanceof Error ? err.message : 'Submission failed.',
      });
    }
  };

  const handleCreateSupportTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    setTicketNotice('');
    try {
      const res = await apiRequest<{ message: string }>('/api/student/support', {
        method: 'POST',
        body: JSON.stringify(ticketForm),
      });
      setTicketForm({ subject: '', message: '' });
      setTicketNotice(res.message);
      await loadAll();
    } catch (err) {
      setTicketNotice(err instanceof Error ? err.message : 'Could not submit ticket.');
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsMsg({});
    try {
      const res = await apiRequest<{ message: string }>('/api/auth/profile', {
        method: 'PUT',
        body: JSON.stringify(profileForm),
      });
      await refreshUser();
      setSettingsMsg({ ok: res.message });
    } catch (err) {
      setSettingsMsg({ err: err instanceof Error ? err.message : 'Update failed.' });
    }
  };

  const handleVerifyEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsMsg({});
    try {
      const res = await apiRequest<{ message: string }>('/api/auth/verify-email', {
        method: 'POST',
        body: JSON.stringify({ code: verifyCode }),
      });
      setVerifyCode('');
      await refreshUser();
      setSettingsMsg({ ok: res.message });
    } catch (err) {
      setSettingsMsg({ err: err instanceof Error ? err.message : 'Verification failed.' });
    }
  };

  const handleResendCode = async () => {
    setSettingsMsg({});
    try {
      const res = await apiRequest<{ message: string; verificationCodePreview?: string }>(
        '/api/auth/resend-verification',
        { method: 'POST' }
      );
      setSettingsMsg({
        ok: `${res.message}${res.verificationCodePreview ? ` (Code: ${res.verificationCodePreview})` : ''}`,
      });
    } catch (err) {
      setSettingsMsg({ err: err instanceof Error ? err.message : 'Failed to generate code.' });
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsMsg({});
    try {
      const res = await apiRequest<{ message: string }>('/api/auth/change-password', {
        method: 'PUT',
        body: JSON.stringify(pwForm),
      });
      setPwForm({ current_password: '', new_password: '', confirm_password: '' });
      setSettingsMsg({ ok: res.message });
    } catch (err) {
      setSettingsMsg({ err: err instanceof Error ? err.message : 'Password change failed.' });
    }
  };

  const navItems: { id: StudentTab; path: string; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', path: '/student', label: lang === 'bn' ? 'ওভারভিউ' : 'Overview', icon: <LayoutDashboard className="h-4 w-4" /> },
    { id: 'courses', path: '/student/courses', label: lang === 'bn' ? 'আমার কোর্স' : 'My Courses', icon: <BookOpen className="h-4 w-4" /> },
    { id: 'payments', path: '/student/payments', label: lang === 'bn' ? 'পেমেন্ট' : 'Payments', icon: <CreditCard className="h-4 w-4" /> },
    { id: 'community', path: '/student/community', label: lang === 'bn' ? 'কমিউনিটি' : 'Community', icon: <Users className="h-4 w-4" /> },
    {
      id: 'notifications',
      path: '/student/notifications',
      label: `${lang === 'bn' ? 'নোটিফিকেশন' : 'Notifications'}${unreadCount > 0 ? ` (${unreadCount})` : ''}`,
      icon: <Bell className="h-4 w-4" />,
    },
    { id: 'support', path: '/student/support', label: lang === 'bn' ? 'সাপোর্ট' : 'Support', icon: <LifeBuoy className="h-4 w-4" /> },
    { id: 'settings', path: '/student/settings', label: lang === 'bn' ? 'সেটিংস' : 'Settings', icon: <Settings className="h-4 w-4" /> },
  ];

  const filteredPayments = payments.filter((p) =>
    paymentFilter === 'all' ? true : p.status === paymentFilter
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Sidebar Navigation (Mobile horizontal pills / Desktop vertical rail) */}
        <aside className="lg:col-span-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="border-b border-slate-100 pb-4">
              <div className="font-display text-base font-bold text-slate-900 truncate">
                {user.full_name}
              </div>
              <div className="text-xs text-slate-500 truncate">{user.email}</div>
              <div className="mt-1 text-xs font-medium text-slate-600">
                {user.email_verified ? 'Verified Student' : 'Email Unverified'}
              </div>
            </div>

            <nav className="mt-3 flex gap-1.5 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => switchTab(item.id, item.path)}
                  className={`flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap min-h-[42px] ${
                    tab === item.id
                      ? 'bg-[var(--brand-primary)] text-white'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              ))}
              <button
                type="button"
                onClick={() => navigate('/courses')}
                className="flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 whitespace-nowrap min-h-[42px]"
              >
                <ExternalLink className="h-4 w-4" />
                <span>{lang === 'bn' ? 'নতুন কোর্স খুঁজুন' : 'Browse Courses'}</span>
              </button>
              <button
                type="button"
                onClick={() => void logout()}
                className="flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-red-700 hover:bg-red-50 whitespace-nowrap min-h-[42px]"
              >
                <LogOut className="h-4 w-4" />
                <span>{lang === 'bn' ? 'লগআউট' : 'Sign Out'}</span>
              </button>
            </nav>
          </div>
        </aside>

        {/* Main Content Viewport */}
        <main className="lg:col-span-9 space-y-6">
          {loading ? (
            <div className="h-64 animate-pulse rounded-xl border border-slate-200 bg-white" />
          ) : (
            <>
              {/* OVERVIEW */}
              {tab === 'overview' && (
                <div className="space-y-6">
                  <div className="rounded-xl border border-slate-200 bg-white p-6">
                    <h1 className="font-display text-2xl font-bold text-slate-900">
                      {lang === 'bn' ? `স্বাগতম, ${user.full_name}` : `Welcome back, ${user.full_name}`}
                    </h1>
                    <p className="mt-1 text-sm text-slate-600">
                      Track your enrolled courses, bKash/Nagad payment verifications, and community requirements.
                    </p>

                    <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4 border-t border-slate-100 pt-5">
                      <div>
                        <div className="text-xs text-slate-500">Enrolled Courses</div>
                        <div className="mt-1 font-display text-2xl font-bold text-[var(--brand-primary)] tabular-nums">
                          {enrollments.length}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500">Pending Payments</div>
                        <div className="mt-1 font-display text-2xl font-bold text-amber-600 tabular-nums">
                          {payments.filter((p) => p.status === 'pending').length}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500">Approved Payments</div>
                        <div className="mt-1 font-display text-2xl font-bold text-emerald-700 tabular-nums">
                          {payments.filter((p) => p.status === 'approved').length}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500">Unread Alerts</div>
                        <div className="mt-1 font-display text-2xl font-bold text-slate-900 tabular-nums">
                          {unreadCount}
                        </div>
                      </div>
                    </div>
                  </div>

                  {!user.email_verified && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 flex flex-wrap items-center justify-between gap-3">
                      <span>Your email is not yet verified. Verify it in Account Settings using the code from your notifications.</span>
                      <button
                        type="button"
                        onClick={() => switchTab('settings', '/student/settings')}
                        className="rounded-lg bg-amber-900 px-3.5 py-2 text-xs font-semibold text-white"
                      >
                        Verify Email
                      </button>
                    </div>
                  )}

                  <div className="rounded-xl border border-slate-200 bg-white p-6">
                    <div className="flex items-center justify-between">
                      <h2 className="font-display text-lg font-bold text-slate-900">My Enrolled Courses</h2>
                      <button
                        type="button"
                        onClick={() => navigate('/courses')}
                        className="text-xs font-semibold text-[var(--brand-primary)] hover:underline"
                      >
                        Browse Catalog
                      </button>
                    </div>

                    {enrollments.length === 0 ? (
                      <div className="mt-4 rounded-lg border border-slate-100 bg-slate-50 p-6 text-center">
                        <p className="text-sm text-slate-600">You have no active course enrollments yet.</p>
                        <button
                          type="button"
                          onClick={() => navigate('/courses')}
                          className="mt-3 rounded-lg bg-[var(--brand-primary)] px-4 py-2 text-xs font-semibold text-white"
                        >
                          Explore Courses
                        </button>
                      </div>
                    ) : (
                      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                        {enrollments.map((en) => (
                          <div key={en.id} className="rounded-xl border border-slate-200 p-4">
                            <div className="font-display text-base font-semibold text-slate-900">
                              {en.course.title}
                            </div>
                            <div className="mt-2 flex items-center justify-between text-xs text-slate-500 tabular-nums">
                              <span>
                                {en.completed_lessons}/{en.total_lessons} Lessons
                              </span>
                              <span>{en.progress_percent}%</span>
                            </div>
                            <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                              <div
                                className="h-full bg-[var(--brand-primary)]"
                                style={{ width: `${en.progress_percent}%` }}
                              />
                            </div>
                            <div className="mt-4 flex items-center justify-between gap-2">
                              {en.has_full_access ? (
                                <button
                                  type="button"
                                  onClick={() => navigate(`/student/classroom/${en.course.slug}`)}
                                  className="h-10 w-full rounded-lg bg-[var(--brand-primary)] text-xs font-semibold text-white"
                                >
                                  Open Classroom
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => switchTab('community', '/student/community')}
                                  className="h-10 w-full rounded-lg border border-amber-300 bg-amber-50 text-xs font-semibold text-amber-900"
                                >
                                  Verify Telegram & WhatsApp to Unlock
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* MY COURSES */}
              {tab === 'courses' && (
                <div className="rounded-xl border border-slate-200 bg-white p-6">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                    <h1 className="font-display text-xl font-bold text-slate-900">My Enrolled Courses</h1>
                    <button
                      type="button"
                      onClick={() => navigate('/courses')}
                      className="rounded-lg bg-[var(--brand-primary)] px-4 py-2 text-xs font-semibold text-white"
                    >
                      Browse All Courses
                    </button>
                  </div>

                  {enrollments.length === 0 ? (
                    <p className="py-10 text-center text-sm text-slate-600">
                      No courses unlocked yet. Submit a payment on any course page to begin.
                    </p>
                  ) : (
                    <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
                      {enrollments.map((en) => (
                        <div key={en.id} className="overflow-hidden rounded-xl border border-slate-200">
                          <div className="aspect-[16/9] bg-slate-100">
                            <SafeImage
                              src={en.course.thumbnail_url}
                              alt={en.course.title}
                              fallbackTitle={en.course.title}
                              className="h-full w-full object-cover"
                            />
                          </div>
                          <div className="p-5">
                            <h2 className="font-display text-base font-bold text-slate-900">
                              {en.course.title}
                            </h2>
                            <div className="mt-2 flex items-center justify-between text-xs text-slate-500 tabular-nums">
                              <span>Progress: {en.progress_percent}%</span>
                              <span>
                                {en.completed_lessons}/{en.total_lessons} lessons
                              </span>
                            </div>
                            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
                              <div
                                className="h-full bg-[var(--brand-accent)]"
                                style={{ width: `${en.progress_percent}%` }}
                              />
                            </div>
                            <div className="mt-4">
                              {en.has_full_access ? (
                                <button
                                  type="button"
                                  onClick={() => navigate(`/student/classroom/${en.course.slug}`)}
                                  className="h-10 w-full rounded-lg bg-[var(--brand-primary)] text-xs font-semibold text-white"
                                >
                                  Enter Private Classroom
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => switchTab('community', '/student/community')}
                                  className="h-10 w-full rounded-lg border border-amber-300 bg-amber-50 text-xs font-semibold text-amber-900"
                                >
                                  Complete Community Verification
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* PAYMENTS */}
              {tab === 'payments' && (
                <div className="rounded-xl border border-slate-200 bg-white p-6">
                  <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
                    <h1 className="font-display text-xl font-bold text-slate-900">Payment History</h1>
                    <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
                      {(['all', 'pending', 'approved', 'rejected'] as const).map((st) => (
                        <button
                          key={st}
                          type="button"
                          onClick={() => setPaymentFilter(st)}
                          className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize ${
                            paymentFilter === st ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                          }`}
                        >
                          {st}
                        </button>
                      ))}
                    </div>
                  </div>

                  {filteredPayments.length === 0 ? (
                    <p className="py-10 text-center text-sm text-slate-600">
                      No payments recorded under this filter.
                    </p>
                  ) : (
                    <div className="mt-4 overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="border-b border-slate-200 text-xs text-slate-500">
                          <tr>
                            <th className="py-3 pr-4">Course</th>
                            <th className="py-3 pr-4">Method & TrxID</th>
                            <th className="py-3 pr-4 text-right">Amount</th>
                            <th className="py-3 pr-4">Status</th>
                            <th className="py-3">Date</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filteredPayments.map((pay) => (
                            <tr key={pay.id}>
                              <td className="py-3 pr-4 font-medium text-slate-900">
                                {pay.course_title}
                                {pay.rejection_reason && (
                                  <div className="mt-0.5 text-xs text-red-600">
                                    Reason: {pay.rejection_reason}
                                  </div>
                                )}
                              </td>
                              <td className="py-3 pr-4">
                                <div className="text-xs font-semibold uppercase text-slate-700">
                                  {pay.payment_method}
                                </div>
                                <div className="font-mono text-xs text-slate-500">
                                  {pay.transaction_id} · {pay.payer_phone}
                                </div>
                              </td>
                              <td className="py-3 pr-4 text-right font-mono font-semibold tabular-nums">
                                ৳{pay.amount.toLocaleString()}
                              </td>
                              <td className="py-3 pr-4">
                                <span
                                  className={`inline-flex items-center gap-1 text-xs font-semibold capitalize ${
                                    pay.status === 'approved'
                                      ? 'text-emerald-700'
                                      : pay.status === 'rejected'
                                        ? 'text-red-700'
                                        : 'text-amber-700'
                                  }`}
                                >
                                  {pay.status === 'approved' && <CheckCircle2 className="h-3.5 w-3.5" />}
                                  {pay.status === 'pending' && <Clock className="h-3.5 w-3.5" />}
                                  {pay.status === 'rejected' && <XCircle className="h-3.5 w-3.5" />}
                                  {pay.status}
                                </span>
                              </td>
                              <td className="py-3 text-xs text-slate-500 tabular-nums">
                                {pay.created_at.slice(0, 10)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* MANDATORY COMMUNITY VERIFICATION */}
              {tab === 'community' && (
                <div className="space-y-6">
                  <div className="rounded-xl border border-slate-200 bg-white p-6">
                    <h1 className="font-display text-xl font-bold text-slate-900">
                      Mandatory Telegram & WhatsApp Verification
                    </h1>
                    <p className="mt-1 text-sm text-slate-600">
                      To protect cohort accountability, every enrolled learner must join and verify membership in both the course Telegram Channel and WhatsApp Group before entering the private classroom.
                    </p>
                  </div>

                  {memberships.length === 0 ? (
                    <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-600">
                      Once your course payment is approved, your mandatory community links and verification forms will appear here.
                    </div>
                  ) : (
                    memberships.map((m) => (
                      <div key={m.course_id} className="rounded-xl border border-slate-200 bg-white p-6 space-y-5">
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                          <div>
                            <h2 className="font-display text-lg font-bold text-slate-900">
                              {m.course_title}
                            </h2>
                            <p className="mt-0.5 text-xs text-slate-500">
                              {lang === 'bn' && m.instructions_bn ? m.instructions_bn : m.instructions}
                            </p>
                          </div>
                          {(!m.telegram_required || m.telegram_status === 'verified') &&
                          (!m.whatsapp_required || m.whatsapp_status === 'verified') ? (
                            <button
                              type="button"
                              onClick={() => navigate(`/student/classroom/${m.course_slug}`)}
                              className="h-10 rounded-lg bg-[var(--brand-primary)] px-4 text-xs font-semibold text-white"
                            >
                              Open Classroom
                            </button>
                          ) : null}
                        </div>

                        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                          {/* Telegram Card */}
                          <div className="rounded-lg border border-slate-200 p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="font-display text-sm font-bold text-slate-900">
                                1. Telegram Channel {m.telegram_required ? '(Required)' : '(Optional)'}
                              </span>
                              <span
                                className={`text-xs font-semibold capitalize ${
                                  m.telegram_status === 'verified'
                                    ? 'text-emerald-700'
                                    : m.telegram_status === 'pending_verification'
                                      ? 'text-amber-700'
                                      : 'text-slate-500'
                                }`}
                              >
                                {m.telegram_status.replace('_', ' ')}
                              </span>
                            </div>

                            {m.telegram_link ? (
                              <a
                                href={m.telegram_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-sky-600 text-xs font-semibold text-white hover:bg-sky-700"
                              >
                                <span>Join Telegram Channel</span>
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            ) : (
                              <p className="text-xs text-slate-500">Channel link will be posted by admin.</p>
                            )}

                            {m.telegram_status !== 'verified' && (
                              <div className="space-y-2 pt-2 border-t border-slate-100">
                                <input
                                  type="text"
                                  placeholder="Your Telegram @username"
                                  value={tgInputs[m.course_id]?.username ?? m.telegram_username ?? ''}
                                  onChange={(e) =>
                                    setTgInputs({
                                      ...tgInputs,
                                      [m.course_id]: {
                                        username: e.target.value,
                                        userId: tgInputs[m.course_id]?.userId ?? m.telegram_user_id ?? '',
                                      },
                                    })
                                  }
                                  className="h-10 w-full rounded-lg border border-slate-300 px-3 text-xs focus:border-[var(--brand-primary)] focus:outline-none"
                                />
                                <input
                                  type="text"
                                  placeholder="Telegram Numeric User ID (optional for Bot API)"
                                  value={tgInputs[m.course_id]?.userId ?? m.telegram_user_id ?? ''}
                                  onChange={(e) =>
                                    setTgInputs({
                                      ...tgInputs,
                                      [m.course_id]: {
                                        username: tgInputs[m.course_id]?.username ?? m.telegram_username ?? '',
                                        userId: e.target.value,
                                      },
                                    })
                                  }
                                  className="h-10 w-full rounded-lg border border-slate-300 px-3 font-mono text-xs focus:border-[var(--brand-primary)] focus:outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleSubmitTelegram(m.course_id)}
                                  className="h-10 w-full rounded-lg bg-[var(--brand-primary)] text-xs font-semibold text-white"
                                >
                                  Verify Telegram Membership
                                </button>
                              </div>
                            )}
                          </div>

                          {/* WhatsApp Card */}
                          <div className="rounded-lg border border-slate-200 p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="font-display text-sm font-bold text-slate-900">
                                2. WhatsApp Group {m.whatsapp_required ? '(Required)' : '(Optional)'}
                              </span>
                              <span
                                className={`text-xs font-semibold capitalize ${
                                  m.whatsapp_status === 'verified'
                                    ? 'text-emerald-700'
                                    : m.whatsapp_status === 'pending_verification'
                                      ? 'text-amber-700'
                                      : 'text-slate-500'
                                }`}
                              >
                                {m.whatsapp_status.replace('_', ' ')}
                              </span>
                            </div>

                            {m.whatsapp_link ? (
                              <a
                                href={m.whatsapp_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 text-xs font-semibold text-white hover:bg-emerald-700"
                              >
                                <span>Join WhatsApp Group</span>
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            ) : (
                              <p className="text-xs text-slate-500">Group link will be posted by admin.</p>
                            )}

                            {m.whatsapp_status !== 'verified' && (
                              <div className="space-y-2 pt-2 border-t border-slate-100">
                                <input
                                  type="tel"
                                  placeholder="Your WhatsApp Phone (017XXXXXXXX)"
                                  value={waInputs[m.course_id] ?? m.whatsapp_phone ?? user.phone}
                                  onChange={(e) =>
                                    setWaInputs({ ...waInputs, [m.course_id]: e.target.value })
                                  }
                                  className="h-10 w-full rounded-lg border border-slate-300 px-3 font-mono text-xs focus:border-[var(--brand-primary)] focus:outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleSubmitWhatsapp(m.course_id)}
                                  className="h-10 w-full rounded-lg bg-[var(--brand-primary)] text-xs font-semibold text-white"
                                >
                                  Submit WhatsApp for Verification
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        {commFeedback[m.course_id] && (
                          <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs text-slate-700">
                            {commFeedback[m.course_id]}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* NOTIFICATIONS */}
              {tab === 'notifications' && (
                <div className="rounded-xl border border-slate-200 bg-white p-6">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                    <h1 className="font-display text-xl font-bold text-slate-900">Notifications</h1>
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={() => handleMarkRead()}
                        className="text-xs font-semibold text-[var(--brand-primary)] hover:underline"
                      >
                        Mark All as Read
                      </button>
                    )}
                  </div>
                  <div className="mt-4 divide-y divide-slate-100">
                    {notifications.length === 0 ? (
                      <p className="py-8 text-center text-sm text-slate-500">No notifications yet.</p>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          className={`flex flex-col justify-between gap-2 py-4 sm:flex-row sm:items-center ${
                            !n.is_read ? 'bg-slate-50/70 px-3 rounded-lg' : ''
                          }`}
                        >
                          <div>
                            <div className="text-sm font-semibold text-slate-900">{n.title}</div>
                            <p className="mt-0.5 text-xs text-slate-600">{n.message}</p>
                            <div className="mt-1 text-[11px] text-slate-400 tabular-nums">
                              {n.created_at}
                            </div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            {n.link && (
                              <button
                                type="button"
                                onClick={() => navigate(n.link)}
                                className="text-xs font-semibold text-[var(--brand-primary)] hover:underline"
                              >
                                Open
                              </button>
                            )}
                            {!n.is_read && (
                              <button
                                type="button"
                                onClick={() => handleMarkRead(n.id)}
                                className="text-xs text-slate-500 hover:text-slate-900"
                              >
                                Mark Read
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* SUPPORT MESSAGES */}
              {tab === 'support' && (
                <div className="space-y-6">
                  <form
                    onSubmit={handleCreateSupportTicket}
                    className="rounded-xl border border-slate-200 bg-white p-6 space-y-4"
                  >
                    <h1 className="font-display text-xl font-bold text-slate-900">Contact Academy Support</h1>
                    <input
                      type="text"
                      required
                      placeholder="Subject"
                      value={ticketForm.subject}
                      onChange={(e) => setTicketForm({ ...ticketForm, subject: e.target.value })}
                      className="h-11 w-full rounded-lg border border-slate-300 px-3.5 text-sm"
                    />
                    <textarea
                      required
                      rows={3}
                      placeholder="Describe how we can help..."
                      value={ticketForm.message}
                      onChange={(e) => setTicketForm({ ...ticketForm, message: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 p-3.5 text-sm"
                    />
                    {ticketNotice && <p className="text-xs font-medium text-emerald-700">{ticketNotice}</p>}
                    <button
                      type="submit"
                      className="h-11 rounded-lg bg-[var(--brand-primary)] px-5 text-sm font-semibold text-white"
                    >
                      Send Support Message
                    </button>
                  </form>

                  <div className="rounded-xl border border-slate-200 bg-white p-6">
                    <h2 className="font-display text-lg font-bold text-slate-900">Your Support History</h2>
                    <div className="mt-4 space-y-4">
                      {supportTickets.length === 0 ? (
                        <p className="text-sm text-slate-500">No support tickets submitted yet.</p>
                      ) : (
                        supportTickets.map((t) => (
                          <div key={t.id} className="rounded-lg border border-slate-200 p-4 space-y-2">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-semibold text-slate-900">{t.subject}</span>
                              <span className="capitalize font-medium text-slate-600">{t.status}</span>
                            </div>
                            <p className="text-sm text-slate-700">{t.message}</p>
                            {t.admin_reply && (
                              <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-800 border border-slate-200">
                                <div className="font-semibold text-[var(--brand-primary)]">Admin Reply:</div>
                                <p className="mt-1">{t.admin_reply}</p>
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* SETTINGS */}
              {tab === 'settings' && (
                <div className="space-y-6">
                  {settingsMsg.ok && (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                      {settingsMsg.ok}
                    </div>
                  )}
                  {settingsMsg.err && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                      {settingsMsg.err}
                    </div>
                  )}

                  {!user.email_verified && (
                    <form
                      onSubmit={handleVerifyEmail}
                      className="rounded-xl border border-amber-200 bg-white p-6 space-y-3"
                    >
                      <h2 className="font-display text-lg font-bold text-slate-900">Verify Email Address</h2>
                      <p className="text-xs text-slate-600">
                        Enter the 6-digit verification code from your registration notification.
                      </p>
                      <div className="flex flex-col gap-3 sm:flex-row">
                        <input
                          type="text"
                          required
                          placeholder="6-digit code"
                          value={verifyCode}
                          onChange={(e) => setVerifyCode(e.target.value)}
                          className="h-11 rounded-lg border border-slate-300 px-3.5 font-mono text-sm"
                        />
                        <button
                          type="submit"
                          className="h-11 rounded-lg bg-[var(--brand-primary)] px-5 text-sm font-semibold text-white"
                        >
                          Verify
                        </button>
                        <button
                          type="button"
                          onClick={handleResendCode}
                          className="h-11 rounded-lg border border-slate-300 px-4 text-xs font-semibold text-slate-700"
                        >
                          Generate New Code
                        </button>
                      </div>
                    </form>
                  )}

                  <form
                    onSubmit={handleUpdateProfile}
                    className="rounded-xl border border-slate-200 bg-white p-6 space-y-4"
                  >
                    <h2 className="font-display text-lg font-bold text-slate-900">Profile Settings</h2>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700">Full Name</label>
                        <input
                          type="text"
                          required
                          value={profileForm.full_name}
                          onChange={(e) => setProfileForm({ ...profileForm, full_name: e.target.value })}
                          className="mt-1 h-11 w-full rounded-lg border border-slate-300 px-3.5 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700">Phone Number</label>
                        <input
                          type="tel"
                          required
                          value={profileForm.phone}
                          onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                          className="mt-1 h-11 w-full rounded-lg border border-slate-300 px-3.5 text-sm"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">Preferred Language</label>
                      <select
                        value={profileForm.preferred_language}
                        onChange={(e) =>
                          setProfileForm({
                            ...profileForm,
                            preferred_language: e.target.value === 'bn' ? 'bn' : 'en',
                          })
                        }
                        className="mt-1 h-11 rounded-lg border border-slate-300 px-3 text-sm"
                      >
                        <option value="en">English</option>
                        <option value="bn">বাংলা (Bengali)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">Short Bio</label>
                      <textarea
                        rows={3}
                        value={profileForm.bio}
                        onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })}
                        className="mt-1 w-full rounded-lg border border-slate-300 p-3 text-sm"
                      />
                    </div>
                    <button
                      type="submit"
                      className="h-11 rounded-lg bg-[var(--brand-primary)] px-6 text-sm font-semibold text-white"
                    >
                      Save Profile
                    </button>
                  </form>

                  <form
                    onSubmit={handleChangePassword}
                    className="rounded-xl border border-slate-200 bg-white p-6 space-y-4"
                  >
                    <h2 className="font-display text-lg font-bold text-slate-900">Change Password</h2>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                      <input
                        type="password"
                        required
                        placeholder="Current Password"
                        value={pwForm.current_password}
                        onChange={(e) => setPwForm({ ...pwForm, current_password: e.target.value })}
                        className="h-11 rounded-lg border border-slate-300 px-3.5 text-sm"
                      />
                      <input
                        type="password"
                        required
                        minLength={8}
                        placeholder="New Password"
                        value={pwForm.new_password}
                        onChange={(e) => setPwForm({ ...pwForm, new_password: e.target.value })}
                        className="h-11 rounded-lg border border-slate-300 px-3.5 text-sm"
                      />
                      <input
                        type="password"
                        required
                        minLength={8}
                        placeholder="Confirm New Password"
                        value={pwForm.confirm_password}
                        onChange={(e) => setPwForm({ ...pwForm, confirm_password: e.target.value })}
                        className="h-11 rounded-lg border border-slate-300 px-3.5 text-sm"
                      />
                    </div>
                    <button
                      type="submit"
                      className="h-11 rounded-lg border border-slate-300 bg-slate-900 px-6 text-sm font-semibold text-white"
                    >
                      Update Password
                    </button>
                  </form>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
