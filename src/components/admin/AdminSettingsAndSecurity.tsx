import React, { useEffect, useState } from 'react';
import { Upload, Download, ShieldCheck } from 'lucide-react';
import type { AdminActivityLog, SupportMessage, WebsiteSettings } from '../../types/academy';
import { useApp } from '../../context/AppContext';
import { apiRequest } from '../../lib/api';

export function AdminCustomizationPanel({ mode }: { mode: 'website' | 'payment' }) {
  const { refreshSettings } = useApp();
  const [form, setForm] = useState<WebsiteSettings | null>(null);
  const [saved, setSaved] = useState('');

  useEffect(() => {
    void (async () => {
      const res = await apiRequest<{ settings: WebsiteSettings }>('/api/admin/settings');
      setForm(res.settings);
    })();
  }, []);

  const uploadBrandAsset = async (
    field: 'logo_url' | 'favicon_url' | 'hero_banner_url',
    file: File
  ) => {
    const fd = new FormData();
    fd.append('image', file);
    const res = await apiRequest<{ url: string }>('/api/admin/upload/image', {
      method: 'POST',
      body: fd,
    });
    setForm((prev) => (prev ? { ...prev, [field]: res.url } : prev));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setSaved('');
    await apiRequest('/api/admin/settings', {
      method: 'PUT',
      body: JSON.stringify(form),
    });
    await refreshSettings();
    setSaved('Settings saved and published to the live website.');
  };

  if (!form) {
    return <div className="h-48 animate-pulse rounded-xl border border-slate-200 bg-white" />;
  }

  return (
    <form onSubmit={handleSave} className="rounded-xl border border-slate-200 bg-white p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <h2 className="font-display text-lg font-bold text-slate-900">
          {mode === 'payment' ? 'bKash & Nagad Payment Settings' : 'Website Branding & Content'}
        </h2>
        <button
          type="submit"
          className="h-10 rounded-lg bg-[var(--brand-primary)] px-5 text-xs font-semibold text-white"
        >
          Save Changes
        </button>
      </div>

      {saved && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs font-medium text-emerald-800">
          {saved}
        </div>
      )}

      {mode === 'website' ? (
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700">Website Name</label>
              <input
                type="text"
                value={form.site_name}
                onChange={(e) => setForm({ ...form, site_name: e.target.value })}
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Primary Navy Color</label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  type="color"
                  value={form.primary_color}
                  onChange={(e) => setForm({ ...form, primary_color: e.target.value })}
                  className="h-10 w-12 rounded border border-slate-300"
                />
                <input
                  type="text"
                  value={form.primary_color}
                  onChange={(e) => setForm({ ...form, primary_color: e.target.value })}
                  className="h-10 flex-1 rounded-lg border border-slate-300 px-3 font-mono text-xs"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Gold Accent Color</label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  type="color"
                  value={form.accent_color}
                  onChange={(e) => setForm({ ...form, accent_color: e.target.value })}
                  className="h-10 w-12 rounded border border-slate-300"
                />
                <input
                  type="text"
                  value={form.accent_color}
                  onChange={(e) => setForm({ ...form, accent_color: e.target.value })}
                  className="h-10 flex-1 rounded-lg border border-slate-300 px-3 font-mono text-xs"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700">Logo Image</label>
              <div className="mt-1 flex gap-2">
                <input
                  type="text"
                  value={form.logo_url}
                  onChange={(e) => setForm({ ...form, logo_url: e.target.value })}
                  placeholder="/uploads/..."
                  className="h-10 flex-1 rounded-lg border border-slate-300 px-3 text-xs"
                />
                <label className="inline-flex h-10 cursor-pointer items-center gap-1 rounded-lg border border-slate-300 px-3 text-xs font-semibold">
                  <Upload className="h-3.5 w-3.5" />
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void uploadBrandAsset('logo_url', f);
                    }}
                  />
                </label>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Favicon Image</label>
              <div className="mt-1 flex gap-2">
                <input
                  type="text"
                  value={form.favicon_url}
                  onChange={(e) => setForm({ ...form, favicon_url: e.target.value })}
                  className="h-10 flex-1 rounded-lg border border-slate-300 px-3 text-xs"
                />
                <label className="inline-flex h-10 cursor-pointer items-center gap-1 rounded-lg border border-slate-300 px-3 text-xs font-semibold">
                  <Upload className="h-3.5 w-3.5" />
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void uploadBrandAsset('favicon_url', f);
                    }}
                  />
                </label>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Hero Banner Image</label>
              <div className="mt-1 flex gap-2">
                <input
                  type="text"
                  value={form.hero_banner_url}
                  onChange={(e) => setForm({ ...form, hero_banner_url: e.target.value })}
                  className="h-10 flex-1 rounded-lg border border-slate-300 px-3 text-xs"
                />
                <label className="inline-flex h-10 cursor-pointer items-center gap-1 rounded-lg border border-slate-300 px-3 text-xs font-semibold">
                  <Upload className="h-3.5 w-3.5" />
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void uploadBrandAsset('hero_banner_url', f);
                    }}
                  />
                </label>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700">Hero Title (EN)</label>
              <input
                type="text"
                value={form.hero_title}
                onChange={(e) => setForm({ ...form, hero_title: e.target.value })}
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Hero Title (BN)</label>
              <input
                type="text"
                value={form.hero_title_bn}
                onChange={(e) => setForm({ ...form, hero_title_bn: e.target.value })}
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Hero Subtitle (EN)</label>
              <textarea
                rows={2}
                value={form.hero_subtitle}
                onChange={(e) => setForm({ ...form, hero_subtitle: e.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-300 p-3 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Hero Subtitle (BN)</label>
              <textarea
                rows={2}
                value={form.hero_subtitle_bn}
                onChange={(e) => setForm({ ...form, hero_subtitle_bn: e.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-300 p-3 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700">About Section (EN)</label>
              <textarea
                rows={3}
                value={form.about_text}
                onChange={(e) => setForm({ ...form, about_text: e.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-300 p-3 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">About Section (BN)</label>
              <textarea
                rows={3}
                value={form.about_text_bn}
                onChange={(e) => setForm({ ...form, about_text_bn: e.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-300 p-3 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <input
              type="email"
              placeholder="Contact Email"
              value={form.contact_email}
              onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
              className="h-10 rounded-lg border border-slate-300 px-3 text-xs"
            />
            <input
              type="text"
              placeholder="Contact Phone"
              value={form.contact_phone}
              onChange={(e) => setForm({ ...form, contact_phone: e.target.value })}
              className="h-10 rounded-lg border border-slate-300 px-3 text-xs"
            />
            <input
              type="text"
              placeholder="Address"
              value={form.contact_address}
              onChange={(e) => setForm({ ...form, contact_address: e.target.value })}
              className="h-10 rounded-lg border border-slate-300 px-3 text-xs"
            />
            <input
              type="text"
              placeholder="Footer Copyright Text"
              value={form.footer_text}
              onChange={(e) => setForm({ ...form, footer_text: e.target.value })}
              className="h-10 rounded-lg border border-slate-300 px-3 text-xs"
            />
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-slate-200 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-display text-sm font-bold text-[#E2136E]">bKash Configuration</span>
                <label className="inline-flex items-center gap-1.5 text-xs font-medium">
                  <input
                    type="checkbox"
                    checked={form.bkash_enabled}
                    onChange={(e) => setForm({ ...form, bkash_enabled: e.target.checked })}
                  />
                  Enabled
                </label>
              </div>
              <input
                type="text"
                placeholder="bKash Number"
                value={form.bkash_number}
                onChange={(e) => setForm({ ...form, bkash_number: e.target.value })}
                className="h-10 w-full rounded-lg border border-slate-300 px-3 font-mono text-sm"
              />
            </div>

            <div className="rounded-lg border border-slate-200 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-display text-sm font-bold text-[#D9531E]">Nagad Configuration</span>
                <label className="inline-flex items-center gap-1.5 text-xs font-medium">
                  <input
                    type="checkbox"
                    checked={form.nagad_enabled}
                    onChange={(e) => setForm({ ...form, nagad_enabled: e.target.checked })}
                  />
                  Enabled
                </label>
              </div>
              <input
                type="text"
                placeholder="Nagad Number"
                value={form.nagad_number}
                onChange={(e) => setForm({ ...form, nagad_number: e.target.value })}
                className="h-10 w-full rounded-lg border border-slate-300 px-3 font-mono text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Payment Instructions (EN)
              </label>
              <textarea
                rows={4}
                value={form.payment_instructions}
                onChange={(e) => setForm({ ...form, payment_instructions: e.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-300 p-3 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Payment Instructions (BN)
              </label>
              <textarea
                rows={4}
                value={form.payment_instructions_bn}
                onChange={(e) => setForm({ ...form, payment_instructions_bn: e.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-300 p-3 text-sm"
              />
            </div>
          </div>
        </div>
      )}
    </form>
  );
}

export function AdminSupportPanel() {
  const { refreshSettings } = useApp();
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [settings, setSettings] = useState<WebsiteSettings | null>(null);
  const [replies, setReplies] = useState<Record<string, string>>({});
  const [linksSaved, setLinksSaved] = useState('');

  const load = async () => {
    const [sRes, cfgRes] = await Promise.all([
      apiRequest<{ messages: SupportMessage[] }>('/api/admin/support'),
      apiRequest<{ settings: WebsiteSettings }>('/api/admin/settings'),
    ]);
    setMessages(sRes.messages);
    setSettings(cfgRes.settings);
  };

  useEffect(() => {
    void load();
  }, []);

  const saveSupportLinks = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    await apiRequest('/api/admin/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
    await refreshSettings();
    setLinksSaved('Support contact links updated.');
  };

  const sendReply = async (id: string) => {
    const replyText = replies[id];
    if (!replyText?.trim()) return;
    await apiRequest(`/api/admin/support/${id}/reply`, {
      method: 'POST',
      body: JSON.stringify({ admin_reply: replyText, status: 'replied' }),
    });
    setReplies({ ...replies, [id]: '' });
    await load();
  };

  return (
    <div className="space-y-6">
      {settings && (
        <form
          onSubmit={saveSupportLinks}
          className="rounded-xl border border-slate-200 bg-white p-6 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-slate-900">Support Contact Channels</h2>
            <button
              type="submit"
              className="h-9 rounded-lg bg-[var(--brand-primary)] px-4 text-xs font-semibold text-white"
            >
              Save Support Links
            </button>
          </div>
          {linksSaved && <p className="text-xs font-medium text-emerald-700">{linksSaved}</p>}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input
              type="url"
              placeholder="WhatsApp Support URL"
              value={settings.whatsapp_support_link}
              onChange={(e) => setSettings({ ...settings, whatsapp_support_link: e.target.value })}
              className="h-10 rounded-lg border border-slate-300 px-3 text-xs"
            />
            <input
              type="email"
              placeholder="Support Email Address"
              value={settings.email_support_address}
              onChange={(e) => setSettings({ ...settings, email_support_address: e.target.value })}
              className="h-10 rounded-lg border border-slate-300 px-3 text-xs"
            />
            <input
              type="url"
              placeholder="Facebook Page URL"
              value={settings.facebook_page_link}
              onChange={(e) => setSettings({ ...settings, facebook_page_link: e.target.value })}
              className="h-10 rounded-lg border border-slate-300 px-3 text-xs"
            />
            <input
              type="url"
              placeholder="Telegram Support URL"
              value={settings.telegram_support_link}
              onChange={(e) => setSettings({ ...settings, telegram_support_link: e.target.value })}
              className="h-10 rounded-lg border border-slate-300 px-3 text-xs"
            />
          </div>
        </form>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
        <h2 className="font-display text-lg font-bold text-slate-900">Student Support Tickets</h2>
        {messages.length === 0 ? (
          <p className="text-sm text-slate-500">No support messages yet.</p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className="rounded-lg border border-slate-200 p-4 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div>
                  <span className="font-bold text-slate-900">{m.subject}</span> — {m.sender_name} (
                  {m.sender_email})
                </div>
                <span className="capitalize font-semibold text-slate-600">{m.status}</span>
              </div>
              <p className="text-sm text-slate-700">{m.message}</p>
              {m.admin_reply && (
                <div className="rounded bg-slate-50 p-3 text-xs text-slate-700 border border-slate-200">
                  <strong>Replied:</strong> {m.admin_reply}
                </div>
              )}
              <div className="flex gap-2 pt-1">
                <input
                  type="text"
                  placeholder="Write reply to student..."
                  value={replies[m.id] || ''}
                  onChange={(e) => setReplies({ ...replies, [m.id]: e.target.value })}
                  className="h-9 flex-1 rounded-lg border border-slate-300 px-3 text-xs"
                />
                <button
                  type="button"
                  onClick={() => sendReply(m.id)}
                  className="h-9 rounded-lg bg-[var(--brand-primary)] px-4 text-xs font-semibold text-white"
                >
                  Reply
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export function AdminReportsPanel() {
  const [reports, setReports] = useState<{
    revenueByMethod: { payment_method: string; count: number; revenue: number }[];
    coursePerformance: {
      id: string;
      title: string;
      status: string;
      enrollments: number;
      revenue: number;
    }[];
    monthlyRevenue: { month: string; approved_count: number; total: number }[];
  } | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await apiRequest<typeof reports>('/api/admin/reports');
      setReports(res);
    })();
  }, []);

  const exportCsv = () => {
    if (!reports) return;
    const rows = [
      ['Course Title', 'Status', 'Active Enrollments', 'Revenue (BDT)'],
      ...reports.coursePerformance.map((c) => [
        `"${c.title.replace(/"/g, '""')}"`,
        c.status,
        String(c.enrollments),
        String(c.revenue),
      ]),
    ];
    const blob = new Blob([rows.map((r) => r.join(',')).join('\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sera_academy_report_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!reports) return <div className="h-48 animate-pulse rounded-xl bg-white border border-slate-200" />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="font-display text-lg font-bold text-slate-900">Revenue & Enrollment Reports</h2>
        <button
          type="button"
          onClick={exportCsv}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 px-3.5 text-xs font-semibold text-slate-800 hover:bg-slate-50"
        >
          <Download className="h-3.5 w-3.5" />
          <span>Download CSV</span>
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {reports.revenueByMethod.length === 0 ? (
          <div className="col-span-2 rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
            Approved bKash and Nagad revenue breakdowns will appear here once transactions are approved.
          </div>
        ) : (
          reports.revenueByMethod.map((r) => (
            <div key={r.payment_method} className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="text-xs font-bold uppercase text-slate-500">{r.payment_method}</div>
              <div className="mt-1 font-display text-2xl font-bold text-[var(--brand-primary)] tabular-nums">
                ৳{r.revenue.toLocaleString()}
              </div>
              <div className="mt-0.5 text-xs text-slate-500 tabular-nums">
                {r.count} approved transactions
              </div>
            </div>
          ))
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-600">
            <tr>
              <th className="px-4 py-3">Course</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Enrollments</th>
              <th className="px-4 py-3 text-right">Revenue</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {reports.coursePerformance.map((c) => (
              <tr key={c.id}>
                <td className="px-4 py-3 font-medium text-slate-900">{c.title}</td>
                <td className="px-4 py-3 text-xs capitalize text-slate-600">{c.status}</td>
                <td className="px-4 py-3 text-right font-mono tabular-nums">{c.enrollments}</td>
                <td className="px-4 py-3 text-right font-mono font-semibold tabular-nums">
                  ৳{c.revenue.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AdminSecurityPanel() {
  const { user, refreshUser } = useApp();
  const [data, setData] = useState<{
    logs: AdminActivityLog[];
    activeSessions: {
      id: string;
      email: string;
      full_name: string;
      role: string;
      user_agent: string;
      created_at: string;
      isCurrent: boolean;
    }[];
    integrations: {
      supabaseConfigured: boolean;
      telegramBotConfigured: boolean;
      sessionSecretConfigured: boolean;
    };
  } | null>(null);
  const [pw, setPw] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [profile, setProfile] = useState({
    full_name: user?.full_name || '',
    phone: user?.phone || '',
  });
  const [msg, setMsg] = useState('');

  const load = async () => {
    const res = await apiRequest<typeof data>('/api/admin/security');
    setData(res);
  };

  useEffect(() => {
    void load();
  }, []);

  const updateAdminProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiRequest('/api/auth/profile', {
      method: 'PUT',
      body: JSON.stringify({ ...profile, bio: user?.bio || '', preferred_language: 'en' }),
    });
    await refreshUser();
    setMsg('Admin profile updated.');
  };

  const changeAdminPw = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiRequest('/api/auth/change-password', {
      method: 'PUT',
      body: JSON.stringify(pw),
    });
    setPw({ current_password: '', new_password: '', confirm_password: '' });
    setMsg('Admin password updated.');
  };

  const revokeOthers = async () => {
    const res = await apiRequest<{ message: string }>('/api/admin/security/revoke-sessions', {
      method: 'POST',
    });
    setMsg(res.message);
    await load();
  };

  return (
    <div className="space-y-6">
      {msg && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs font-medium text-emerald-800">
          {msg}
        </div>
      )}

      {data && (
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex items-center gap-2 font-display text-base font-bold text-slate-900">
            <ShieldCheck className="h-5 w-5 text-[var(--brand-primary)]" />
            <span>Environment & Integration Configuration</span>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3 text-xs">
            <div className="rounded-lg border border-slate-200 p-3">
              <div className="text-slate-500">Supabase PostgreSQL & Storage</div>
              <div className="mt-1 font-semibold text-slate-900">
                {data.integrations.supabaseConfigured
                  ? 'Connected via Env'
                  : 'Local SQLite + Private Storage Active'}
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <div className="text-slate-500">Telegram Bot Verification</div>
              <div className="mt-1 font-semibold text-slate-900">
                {data.integrations.telegramBotConfigured
                  ? 'Bot API Active'
                  : 'Manual Verification Mode'}
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <div className="text-slate-500">Session & URL Signing</div>
              <div className="mt-1 font-semibold text-slate-900">
                {data.integrations.sessionSecretConfigured
                  ? 'Persistent Env Secret'
                  : 'Runtime Ephemeral Secret'}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <form
          onSubmit={updateAdminProfile}
          className="rounded-xl border border-slate-200 bg-white p-6 space-y-3"
        >
          <h3 className="font-display text-base font-bold text-slate-900">Admin Profile</h3>
          <input
            type="text"
            required
            value={profile.full_name}
            onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
            placeholder="Admin Name"
            className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm"
          />
          <input
            type="tel"
            required
            value={profile.phone}
            onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
            placeholder="Phone"
            className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm"
          />
          <button
            type="submit"
            className="h-10 rounded-lg bg-[var(--brand-primary)] px-4 text-xs font-semibold text-white"
          >
            Update Admin Profile
          </button>
        </form>

        <form
          onSubmit={changeAdminPw}
          className="rounded-xl border border-slate-200 bg-white p-6 space-y-3"
        >
          <h3 className="font-display text-base font-bold text-slate-900">Change Admin Password</h3>
          <input
            type="password"
            required
            placeholder="Current Password"
            value={pw.current_password}
            onChange={(e) => setPw({ ...pw, current_password: e.target.value })}
            className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm"
          />
          <input
            type="password"
            required
            minLength={8}
            placeholder="New Password"
            value={pw.new_password}
            onChange={(e) => setPw({ ...pw, new_password: e.target.value })}
            className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm"
          />
          <input
            type="password"
            required
            minLength={8}
            placeholder="Confirm New Password"
            value={pw.confirm_password}
            onChange={(e) => setPw({ ...pw, confirm_password: e.target.value })}
            className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm"
          />
          <button
            type="submit"
            className="h-10 rounded-lg bg-slate-900 px-4 text-xs font-semibold text-white"
          >
            Update Password
          </button>
        </form>
      </div>

      {data && (
        <>
          <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-display text-base font-bold text-slate-900">Active Sessions</h3>
              <button
                type="button"
                onClick={revokeOthers}
                className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
              >
                Revoke All Other Sessions
              </button>
            </div>
            <div className="divide-y divide-slate-100 text-xs">
              {data.activeSessions.map((s) => (
                <div key={s.id} className="flex items-center justify-between py-2.5">
                  <div>
                    <span className="font-semibold text-slate-900">{s.full_name}</span> ({s.role}) ·{' '}
                    <span className="text-slate-500">{s.user_agent.slice(0, 60)}</span>
                  </div>
                  <span className="font-mono text-slate-500">
                    {s.isCurrent ? 'Current Session' : s.created_at.slice(0, 16)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="border-b border-slate-200 px-6 py-4">
              <h3 className="font-display text-base font-bold text-slate-900">Admin Audit Logs</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-4 py-2.5">Action</th>
                    <th className="px-4 py-2.5">Target</th>
                    <th className="px-4 py-2.5">Admin</th>
                    <th className="px-4 py-2.5">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.logs.map((l) => (
                    <tr key={l.id}>
                      <td className="px-4 py-2.5 font-mono font-semibold text-slate-900">{l.action}</td>
                      <td className="px-4 py-2.5 text-slate-600">
                        {l.target_type} ({l.target_id.slice(0, 8)})
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">{l.admin_name}</td>
                      <td className="px-4 py-2.5 font-mono text-slate-500 tabular-nums">
                        {l.created_at}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
