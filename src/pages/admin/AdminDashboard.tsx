import React, { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  Users,
  BookOpen,
  CreditCard,
  MessageCircle,
  Bell,
  Palette,
  Wallet,
  LifeBuoy,
  BarChart3,
  Shield,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { apiRequest } from '../../lib/api';
import { AdminCourseManager } from '../../components/admin/AdminCourseManager';
import {
  AdminCommunityPanel,
  AdminNotificationsPanel,
  AdminPaymentsPanel,
  AdminStudentsPanel,
} from '../../components/admin/AdminOperationsPanels';
import {
  AdminCustomizationPanel,
  AdminReportsPanel,
  AdminSecurityPanel,
  AdminSupportPanel,
} from '../../components/admin/AdminSettingsAndSecurity';

type AdminMenuTab =
  | 'overview'
  | 'students'
  | 'courses'
  | 'payments'
  | 'community'
  | 'notifications'
  | 'website'
  | 'payment_settings'
  | 'support'
  | 'reports'
  | 'security';

interface OverviewPayload {
  metrics: {
    totalStudents: number;
    totalCourses: number;
    publishedCourses: number;
    totalEnrollments: number;
    totalRevenue: number;
    pendingPayments: number;
    approvedPayments: number;
    rejectedPayments: number;
    pendingCommunity: number;
    openSupport: number;
  };
  recentRegistrations: { id: string; full_name: string; email: string; phone: string; created_at: string }[];
  recentTransactions: {
    id: string;
    student_name: string;
    course_title: string;
    payment_method: string;
    transaction_id: string;
    amount: number;
    status: string;
  }[];
  recentActivities: { id: string; action: string; admin_name: string; created_at: string }[];
}

export function AdminDashboard() {
  const { user, navigate, logout, needsAdminSetup } = useApp();
  const [tab, setTab] = useState<AdminMenuTab>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [overview, setOverview] = useState<OverviewPayload | null>(null);

  const loadOverview = async () => {
    try {
      const res = await apiRequest<OverviewPayload>('/api/admin/overview');
      setOverview(res);
    } catch {
      // ignore if unauthorized
    }
  };

  useEffect(() => {
    if (user?.role === 'admin' && tab === 'overview') {
      void loadOverview();
    }
  }, [user?.role, tab]);

  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <div className="rounded-xl border border-slate-200 bg-white p-8">
          <h1 className="font-display text-xl font-bold text-slate-900">Administrator Access</h1>
          <p className="mt-2 text-sm text-slate-600">
            {needsAdminSetup
              ? 'No admin account has been initialized yet. Claim the first admin account to unlock /admin.'
              : 'Please sign in with an authorized administrator account.'}
          </p>
          <button
            type="button"
            onClick={() => navigate(needsAdminSetup ? '/auth/admin-setup' : '/auth/login?next=/admin')}
            className="mt-5 h-11 w-full rounded-lg bg-[var(--brand-primary)] text-sm font-semibold text-white"
          >
            {needsAdminSetup ? 'Initialize Admin Account' : 'Sign In to Admin'}
          </button>
        </div>
      </div>
    );
  }

  if (user.role !== 'admin') {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <div className="rounded-xl border border-red-200 bg-white p-8">
          <h1 className="font-display text-xl font-bold text-red-700">Access Restricted</h1>
          <p className="mt-2 text-sm text-slate-600">
            Only authorized administrators can access the SERA ACADEMY control panel.
          </p>
          <button
            type="button"
            onClick={() => navigate('/student')}
            className="mt-5 h-11 w-full rounded-lg bg-[var(--brand-primary)] text-sm font-semibold text-white"
          >
            Go to Student Dashboard
          </button>
        </div>
      </div>
    );
  }

  const menuItems: { id: AdminMenuTab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="h-4 w-4" /> },
    { id: 'students', label: 'A. Students', icon: <Users className="h-4 w-4" /> },
    { id: 'courses', label: 'B. Courses', icon: <BookOpen className="h-4 w-4" /> },
    { id: 'payments', label: 'C. Payments', icon: <CreditCard className="h-4 w-4" /> },
    { id: 'community', label: 'D. Community', icon: <MessageCircle className="h-4 w-4" /> },
    { id: 'notifications', label: 'E. Notifications', icon: <Bell className="h-4 w-4" /> },
    { id: 'website', label: 'F. Website Design', icon: <Palette className="h-4 w-4" /> },
    { id: 'payment_settings', label: 'G. Payment Settings', icon: <Wallet className="h-4 w-4" /> },
    { id: 'support', label: 'H. Support', icon: <LifeBuoy className="h-4 w-4" /> },
    { id: 'reports', label: 'I. Reports', icon: <BarChart3 className="h-4 w-4" /> },
    { id: 'security', label: 'J. Security & Logs', icon: <Shield className="h-4 w-4" /> },
  ];

  const selectTab = (next: AdminMenuTab) => {
    setTab(next);
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Mobile-First Admin Bar */}
      <div className="border-b border-slate-200 bg-[#0B1F3A] text-white lg:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <div className="font-display text-sm font-bold">SERA ADMIN</div>
            <div className="text-[11px] text-slate-300">
              {menuItems.find((m) => m.id === tab)?.label}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMobileMenuOpen((v) => !v)}
            aria-label="Toggle admin menu"
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-slate-700"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="border-t border-slate-800 bg-[#0B1F3A] px-3 py-3 grid grid-cols-2 gap-1.5">
            {menuItems.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => selectTab(m.id)}
                className={`flex min-h-[44px] items-center gap-2 rounded-lg px-3 text-xs font-medium ${
                  tab === m.id ? 'bg-[var(--brand-accent)] text-[#0B1F3A] font-bold' : 'text-slate-200 hover:bg-slate-800'
                }`}
              >
                {m.icon}
                <span className="truncate">{m.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          {/* Desktop Sidebar */}
          <aside className="hidden lg:block lg:col-span-3">
            <div className="sticky top-24 rounded-xl border border-slate-200 bg-white p-4">
              <div className="border-b border-slate-100 pb-3 mb-3">
                <div className="font-display text-sm font-bold text-[var(--brand-primary)]">
                  Admin Control Panel
                </div>
                <div className="text-xs text-slate-500 truncate">{user.email}</div>
              </div>
              <nav className="space-y-1">
                {menuItems.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => selectTab(m.id)}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                      tab === m.id
                        ? 'bg-[var(--brand-primary)] text-white'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {m.icon}
                    <span>{m.label}</span>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => void logout()}
                  className="mt-2 flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Sign Out</span>
                </button>
              </nav>
            </div>
          </aside>

          {/* Main Admin Viewport */}
          <main className="lg:col-span-9 space-y-6">
            {tab === 'overview' && overview && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="text-xs text-slate-500">Total Students</div>
                    <div className="mt-1 font-display text-2xl font-bold text-slate-900 tabular-nums">
                      {overview.metrics.totalStudents}
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="text-xs text-slate-500">Courses (Published)</div>
                    <div className="mt-1 font-display text-2xl font-bold text-slate-900 tabular-nums">
                      {overview.metrics.totalCourses} ({overview.metrics.publishedCourses})
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="text-xs text-slate-500">Active Enrollments</div>
                    <div className="mt-1 font-display text-2xl font-bold text-slate-900 tabular-nums">
                      {overview.metrics.totalEnrollments}
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="text-xs text-slate-500">Approved Revenue</div>
                    <div className="mt-1 font-display text-2xl font-bold text-[var(--brand-primary)] tabular-nums">
                      ৳{overview.metrics.totalRevenue.toLocaleString()}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <button
                    type="button"
                    onClick={() => setTab('payments')}
                    className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-left"
                  >
                    <div className="text-xs font-medium text-amber-800">Pending Payments</div>
                    <div className="mt-1 font-display text-xl font-bold text-amber-900 tabular-nums">
                      {overview.metrics.pendingPayments}
                    </div>
                  </button>
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="text-xs text-slate-500">Approved Payments</div>
                    <div className="mt-1 font-display text-xl font-bold text-emerald-700 tabular-nums">
                      {overview.metrics.approvedPayments}
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="text-xs text-slate-500">Rejected Payments</div>
                    <div className="mt-1 font-display text-xl font-bold text-red-700 tabular-nums">
                      {overview.metrics.rejectedPayments}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTab('community')}
                    className="rounded-xl border border-slate-200 bg-white p-4 text-left"
                  >
                    <div className="text-xs text-slate-500">Community Queue</div>
                    <div className="mt-1 font-display text-xl font-bold text-slate-900 tabular-nums">
                      {overview.metrics.pendingCommunity}
                    </div>
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 bg-white p-5">
                    <h2 className="font-display text-base font-bold text-slate-900">
                      Recent Transactions
                    </h2>
                    <div className="mt-3 divide-y divide-slate-100 text-xs">
                      {overview.recentTransactions.length === 0 ? (
                        <p className="py-4 text-slate-500">No transactions submitted yet.</p>
                      ) : (
                        overview.recentTransactions.map((t) => (
                          <div key={t.id} className="flex items-center justify-between py-2.5">
                            <div>
                              <div className="font-semibold text-slate-900">{t.student_name}</div>
                              <div className="text-slate-500">
                                {t.payment_method.toUpperCase()} · {t.transaction_id}
                              </div>
                            </div>
                            <div className="text-right tabular-nums">
                              <div className="font-bold">৳{t.amount}</div>
                              <div className="capitalize text-slate-500">{t.status}</div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-5">
                    <h2 className="font-display text-base font-bold text-slate-900">
                      Recent Registrations
                    </h2>
                    <div className="mt-3 divide-y divide-slate-100 text-xs">
                      {overview.recentRegistrations.length === 0 ? (
                        <p className="py-4 text-slate-500">No student registrations yet.</p>
                      ) : (
                        overview.recentRegistrations.map((r) => (
                          <div key={r.id} className="flex items-center justify-between py-2.5">
                            <div>
                              <div className="font-semibold text-slate-900">{r.full_name}</div>
                              <div className="text-slate-500">{r.email}</div>
                            </div>
                            <div className="font-mono text-slate-500">{r.phone}</div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {tab === 'students' && <AdminStudentsPanel />}
            {tab === 'courses' && <AdminCourseManager />}
            {tab === 'payments' && <AdminPaymentsPanel />}
            {tab === 'community' && <AdminCommunityPanel />}
            {tab === 'notifications' && <AdminNotificationsPanel />}
            {tab === 'website' && <AdminCustomizationPanel mode="website" />}
            {tab === 'payment_settings' && <AdminCustomizationPanel mode="payment" />}
            {tab === 'support' && <AdminSupportPanel />}
            {tab === 'reports' && <AdminReportsPanel />}
            {tab === 'security' && <AdminSecurityPanel />}
          </main>
        </div>
      </div>
    </div>
  );
}
