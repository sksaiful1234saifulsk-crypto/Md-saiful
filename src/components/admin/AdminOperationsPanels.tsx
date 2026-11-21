import React, { useEffect, useState } from 'react';
import { Search, CheckCircle2, XCircle, ShieldOff, ShieldCheck } from 'lucide-react';
import type {
  CommunityMembership,
  CommunitySetting,
  Course,
  PaymentRecord,
} from '../../types/academy';
import { apiRequest } from '../../lib/api';

interface StudentRow {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  bio: string;
  email_verified: boolean;
  is_blocked: boolean;
  enrolled_courses_count: number;
  payments_count: number;
  created_at: string;
}

export function AdminStudentsPanel() {
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [search, setSearch] = useState('');
  const [selectedDetails, setSelectedDetails] = useState<{
    student: StudentRow;
    courses: { id: string; title: string; status: string }[];
    payments: PaymentRecord[];
    community: CommunityMembership[];
  } | null>(null);
  const [editing, setEditing] = useState<StudentRow | null>(null);

  const load = async () => {
    const res = await apiRequest<{ students: StudentRow[] }>(
      `/api/admin/students?q=${encodeURIComponent(search)}`
    );
    setStudents(res.students);
  };

  useEffect(() => {
    void load();
  }, [search]);

  const inspectStudent = async (id: string) => {
    const res = await apiRequest<typeof selectedDetails>(`/api/admin/students/${id}/details`);
    setSelectedDetails(res);
  };

  const toggleBlock = async (id: string) => {
    await apiRequest(`/api/admin/students/${id}/toggle-block`, { method: 'POST' });
    await load();
    if (selectedDetails?.student.id === id) {
      await inspectStudent(id);
    }
  };

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    await apiRequest(`/api/admin/students/${editing.id}`, {
      method: 'PUT',
      body: JSON.stringify(editing),
    });
    setEditing(null);
    await load();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="font-display text-lg font-bold text-slate-900">Student Directory</h2>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            placeholder="Search name, email, phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 w-full rounded-lg border border-slate-300 pl-9 pr-3 text-sm sm:w-72"
          />
        </div>
      </div>

      {editing && (
        <form onSubmit={saveEdit} className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
          <h3 className="font-display text-base font-bold text-slate-900">Edit Student</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <input
              type="text"
              required
              value={editing.full_name}
              onChange={(e) => setEditing({ ...editing, full_name: e.target.value })}
              className="h-10 rounded-lg border border-slate-300 px-3 text-sm"
            />
            <input
              type="email"
              required
              value={editing.email}
              onChange={(e) => setEditing({ ...editing, email: e.target.value })}
              className="h-10 rounded-lg border border-slate-300 px-3 text-sm"
            />
            <input
              type="tel"
              required
              value={editing.phone}
              onChange={(e) => setEditing({ ...editing, phone: e.target.value })}
              className="h-10 rounded-lg border border-slate-300 px-3 text-sm"
            />
          </div>
          <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700">
            <input
              type="checkbox"
              checked={editing.email_verified}
              onChange={(e) => setEditing({ ...editing, email_verified: e.target.checked })}
            />
            Email Verified
          </label>
          <div className="flex gap-2">
            <button
              type="submit"
              className="h-9 rounded-lg bg-[var(--brand-primary)] px-4 text-xs font-semibold text-white"
            >
              Save Changes
            </button>
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="h-9 rounded-lg border border-slate-300 px-4 text-xs"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {selectedDetails && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-display text-base font-bold text-slate-900">
                {selectedDetails.student.full_name}
              </h3>
              <div className="text-xs text-slate-500">
                {selectedDetails.student.email} · {selectedDetails.student.phone}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSelectedDetails(null)}
              className="text-xs font-semibold text-slate-600 underline"
            >
              Close
            </button>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3 text-xs">
            <div className="rounded-lg border border-slate-200 p-3">
              <div className="font-bold text-slate-800 mb-2">Enrolled Courses</div>
              {selectedDetails.courses.length === 0 ? (
                <p className="text-slate-500">None</p>
              ) : (
                selectedDetails.courses.map((c) => (
                  <div key={c.id} className="py-1 border-b border-slate-100 last:border-0">
                    {c.title} ({c.status})
                  </div>
                ))
              )}
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <div className="font-bold text-slate-800 mb-2">Payments</div>
              {selectedDetails.payments.length === 0 ? (
                <p className="text-slate-500">None</p>
              ) : (
                selectedDetails.payments.map((p) => (
                  <div key={p.id} className="py-1 border-b border-slate-100 last:border-0">
                    <span className="font-mono">{p.transaction_id}</span> · ৳{p.amount} ({p.status})
                  </div>
                ))
              )}
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <div className="font-bold text-slate-800 mb-2">Community Status</div>
              {selectedDetails.community.length === 0 ? (
                <p className="text-slate-500">None</p>
              ) : (
                selectedDetails.community.map((cm) => (
                  <div key={cm.id} className="py-1 border-b border-slate-100 last:border-0">
                    <div className="font-semibold">{cm.course_title}</div>
                    <div>
                      TG: {cm.telegram_status} · WA: {cm.whatsapp_status}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-600">
              <tr>
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Courses / Payments</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {students.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-sm text-slate-500">
                    No student accounts registered yet.
                  </td>
                </tr>
              ) : (
                students.map((s) => (
                  <tr key={s.id}>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{s.full_name}</div>
                      <div className="text-xs text-slate-500">
                        {s.email} · {s.phone}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs tabular-nums text-slate-600">
                      {s.enrolled_courses_count} enrolled · {s.payments_count} payments
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold">
                      {s.is_blocked ? (
                        <span className="text-red-700">Blocked</span>
                      ) : (
                        <span className="text-emerald-700">Active</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => inspectStudent(s.id)}
                          className="rounded border border-slate-300 px-2.5 py-1 text-xs font-medium"
                        >
                          Details
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditing(s)}
                          className="rounded border border-slate-300 px-2.5 py-1 text-xs font-medium"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleBlock(s.id)}
                          className={`inline-flex items-center gap-1 rounded border px-2.5 py-1 text-xs font-medium ${
                            s.is_blocked
                              ? 'border-emerald-200 text-emerald-700'
                              : 'border-red-200 text-red-700'
                          }`}
                        >
                          {s.is_blocked ? (
                            <>
                              <ShieldCheck className="h-3.5 w-3.5" /> Unblock
                            </>
                          ) : (
                            <>
                              <ShieldOff className="h-3.5 w-3.5" /> Block
                            </>
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function AdminPaymentsPanel() {
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [search, setSearch] = useState('');
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const load = async () => {
    const res = await apiRequest<{ payments: PaymentRecord[] }>(
      `/api/admin/payments?status=${statusFilter}&q=${encodeURIComponent(search)}`
    );
    setPayments(res.payments);
  };

  useEffect(() => {
    void load();
  }, [statusFilter, search]);

  const handleApprove = async (id: string) => {
    await apiRequest(`/api/admin/payments/${id}/approve`, { method: 'POST' });
    await load();
  };

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingId || !rejectReason.trim()) return;
    await apiRequest(`/api/admin/payments/${rejectingId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ rejection_reason: rejectReason }),
    });
    setRejectingId(null);
    setRejectReason('');
    await load();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1">
          {(['all', 'pending', 'approved', 'rejected'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold capitalize ${
                statusFilter === st ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            placeholder="Search TrxID, student, phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 w-full rounded-lg border border-slate-300 pl-9 pr-3 text-sm sm:w-72"
          />
        </div>
      </div>

      {rejectingId && (
        <form onSubmit={handleReject} className="rounded-xl border border-red-200 bg-white p-5 space-y-3">
          <h3 className="font-display text-sm font-bold text-red-800">Add Rejection Reason</h3>
          <input
            type="text"
            required
            placeholder="e.g. Transaction ID not found in bKash statement"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              className="h-9 rounded-lg bg-red-600 px-4 text-xs font-semibold text-white"
            >
              Confirm Reject
            </button>
            <button
              type="button"
              onClick={() => setRejectingId(null)}
              className="h-9 rounded-lg border border-slate-300 px-4 text-xs"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-600">
              <tr>
                <th className="px-4 py-3">Student & Course</th>
                <th className="px-4 py-3">Method & TrxID</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Verification</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {payments.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">
                    No transactions match your filter.
                  </td>
                </tr>
              ) : (
                payments.map((pay) => (
                  <tr key={pay.id}>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{pay.student_name}</div>
                      <div className="text-xs text-slate-500">
                        {pay.course_title} · {pay.student_email}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs font-bold uppercase text-slate-700">
                        {pay.payment_method}
                      </div>
                      <div className="font-mono text-xs text-slate-600">
                        {pay.transaction_id} · {pay.payer_phone}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold tabular-nums">
                      ৳{pay.amount.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold capitalize">
                      <span
                        className={
                          pay.status === 'approved'
                            ? 'text-emerald-700'
                            : pay.status === 'rejected'
                              ? 'text-red-700'
                              : 'text-amber-700'
                        }
                      >
                        {pay.status}
                      </span>
                      {pay.rejection_reason && (
                        <div className="mt-0.5 font-normal text-red-600">{pay.rejection_reason}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        {pay.status !== 'approved' && (
                          <button
                            type="button"
                            onClick={() => handleApprove(pay.id)}
                            className="inline-flex h-8 items-center gap-1 rounded bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-700"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Approve
                          </button>
                        )}
                        {pay.status !== 'rejected' && (
                          <button
                            type="button"
                            onClick={() => {
                              setRejectingId(pay.id);
                              setRejectReason('');
                            }}
                            className="inline-flex h-8 items-center gap-1 rounded border border-red-200 px-3 text-xs font-semibold text-red-700 hover:bg-red-50"
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            Reject
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function AdminCommunityPanel() {
  const [settingsList, setSettingsList] = useState<CommunitySetting[]>([]);
  const [memberships, setMemberships] = useState<CommunityMembership[]>([]);
  const [savedMsg, setSavedMsg] = useState('');

  const load = async () => {
    const res = await apiRequest<{
      settings: CommunitySetting[];
      memberships: CommunityMembership[];
    }>('/api/admin/community');
    setSettingsList(res.settings);
    setMemberships(res.memberships);
  };

  useEffect(() => {
    void load();
  }, []);

  const saveCourseSetting = async (cs: CommunitySetting) => {
    setSavedMsg('');
    await apiRequest(`/api/admin/community/settings/${encodeURIComponent(cs.course_id)}`, {
      method: 'PUT',
      body: JSON.stringify(cs),
    });
    setSavedMsg(`Updated community configuration for ${cs.course_title}.`);
    await load();
  };

  const updateMembership = async (
    id: string,
    payload: {
      telegram_status?: 'not_joined' | 'pending_verification' | 'verified';
      whatsapp_status?: 'not_joined' | 'pending_verification' | 'verified';
    }
  ) => {
    await apiRequest(`/api/admin/community/memberships/${encodeURIComponent(id)}/verify`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    await load();
  };

  return (
    <div className="space-y-6">
      {savedMsg && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs font-medium text-emerald-800">
          {savedMsg}
        </div>
      )}

      {/* Per-Course Community Settings */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-5">
        <h2 className="font-display text-lg font-bold text-slate-900">
          Course Community Links & Gate Rules
        </h2>
        <div className="space-y-4">
          {settingsList.map((cs, idx) => (
            <div key={cs.course_id} className="rounded-lg border border-slate-200 p-4 space-y-3">
              <div className="font-display text-sm font-bold text-slate-900">{cs.course_title}</div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-slate-600">
                    Telegram Channel Link
                  </label>
                  <input
                    type="url"
                    value={cs.telegram_link}
                    onChange={(e) => {
                      const next = [...settingsList];
                      next[idx] = { ...cs, telegram_link: e.target.value };
                      setSettingsList(next);
                    }}
                    className="mt-1 h-9 w-full rounded border border-slate-300 px-3 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600">
                    Telegram Chat ID (for Bot API, optional)
                  </label>
                  <input
                    type="text"
                    placeholder="-1001234567890 or @channel"
                    value={cs.telegram_chat_id}
                    onChange={(e) => {
                      const next = [...settingsList];
                      next[idx] = { ...cs, telegram_chat_id: e.target.value };
                      setSettingsList(next);
                    }}
                    className="mt-1 h-9 w-full rounded border border-slate-300 px-3 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600">
                    WhatsApp Group Link
                  </label>
                  <input
                    type="url"
                    value={cs.whatsapp_link}
                    onChange={(e) => {
                      const next = [...settingsList];
                      next[idx] = { ...cs, whatsapp_link: e.target.value };
                      setSettingsList(next);
                    }}
                    className="mt-1 h-9 w-full rounded border border-slate-300 px-3 text-xs"
                  />
                </div>
                <div className="flex items-end gap-4 pb-1">
                  <label className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={cs.telegram_required}
                      onChange={(e) => {
                        const next = [...settingsList];
                        next[idx] = { ...cs, telegram_required: e.target.checked };
                        setSettingsList(next);
                      }}
                    />
                    Telegram Required
                  </label>
                  <label className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={cs.whatsapp_required}
                      onChange={(e) => {
                        const next = [...settingsList];
                        next[idx] = { ...cs, whatsapp_required: e.target.checked };
                        setSettingsList(next);
                      }}
                    />
                    WhatsApp Required
                  </label>
                </div>
              </div>
              <button
                type="button"
                onClick={() => saveCourseSetting(cs)}
                className="h-9 rounded-lg bg-[var(--brand-primary)] px-4 text-xs font-semibold text-white"
              >
                Save Community Config
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Enrolled Student Memberships Verification */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="font-display text-lg font-bold text-slate-900">
            Student Community Verification Queue
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-600">
              <tr>
                <th className="px-4 py-3">Student & Course</th>
                <th className="px-4 py-3">Telegram</th>
                <th className="px-4 py-3">WhatsApp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {memberships.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-sm text-slate-500">
                    No enrolled community memberships yet.
                  </td>
                </tr>
              ) : (
                memberships.map((m) => (
                  <tr key={m.id}>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{m.student_name}</div>
                      <div className="text-xs text-slate-500">{m.course_title}</div>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <div className="font-mono text-slate-700">
                        {m.telegram_username || m.telegram_user_id || 'Not submitted'}
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="font-semibold capitalize">{m.telegram_status}</span>
                        <button
                          type="button"
                          onClick={() => updateMembership(m.id, { telegram_status: 'verified' })}
                          className="rounded bg-emerald-600 px-2 py-0.5 text-[11px] font-semibold text-white"
                        >
                          Verify
                        </button>
                        <button
                          type="button"
                          onClick={() => updateMembership(m.id, { telegram_status: 'not_joined' })}
                          className="rounded border border-red-200 px-2 py-0.5 text-[11px] font-semibold text-red-700"
                        >
                          Revoke
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <div className="font-mono text-slate-700">
                        {m.whatsapp_phone || 'Not submitted'}
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="font-semibold capitalize">{m.whatsapp_status}</span>
                        <button
                          type="button"
                          onClick={() => updateMembership(m.id, { whatsapp_status: 'verified' })}
                          className="rounded bg-emerald-600 px-2 py-0.5 text-[11px] font-semibold text-white"
                        >
                          Verify
                        </button>
                        <button
                          type="button"
                          onClick={() => updateMembership(m.id, { whatsapp_status: 'not_joined' })}
                          className="rounded border border-red-200 px-2 py-0.5 text-[11px] font-semibold text-red-700"
                        >
                          Revoke
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function AdminNotificationsPanel() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [form, setForm] = useState({
    target_scope: 'all_students',
    course_id: '',
    event_type: 'announcement',
    title: '',
    message: '',
    link: '/student/notifications',
  });
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    void (async () => {
      const res = await apiRequest<{ courses: Course[] }>('/api/admin/courses');
      setCourses(res.courses);
      if (res.courses[0]) {
        setForm((f) => ({ ...f, course_id: res.courses[0].id }));
      }
    })();
  }, []);

  const sendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback('');
    const res = await apiRequest<{ count: number }>('/api/admin/notifications/broadcast', {
      method: 'POST',
      body: JSON.stringify(form),
    });
    setFeedback(`Notification delivered to ${res.count} student(s).`);
    setForm({ ...form, title: '', message: '' });
  };

  return (
    <form onSubmit={sendBroadcast} className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
      <h2 className="font-display text-lg font-bold text-slate-900">Send Student Notification</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-semibold text-slate-700">Audience</label>
          <select
            value={form.target_scope}
            onChange={(e) => setForm({ ...form, target_scope: e.target.value })}
            className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm"
          >
            <option value="all_students">All Registered Students</option>
            <option value="course">Specific Course Enrolled Students</option>
          </select>
        </div>

        {form.target_scope === 'course' && (
          <div>
            <label className="block text-xs font-semibold text-slate-700">Course</label>
            <select
              value={form.course_id}
              onChange={(e) => setForm({ ...form, course_id: e.target.value })}
              className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm"
            >
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <input
        type="text"
        required
        placeholder="Notification Title"
        value={form.title}
        onChange={(e) => setForm({ ...form, title: e.target.value })}
        className="h-10 w-full rounded-lg border border-slate-300 px-3.5 text-sm"
      />
      <textarea
        required
        rows={3}
        placeholder="Announcement message..."
        value={form.message}
        onChange={(e) => setForm({ ...form, message: e.target.value })}
        className="w-full rounded-lg border border-slate-300 p-3.5 text-sm"
      />
      {feedback && <p className="text-xs font-semibold text-emerald-700">{feedback}</p>}
      <button
        type="submit"
        className="h-10 rounded-lg bg-[var(--brand-primary)] px-5 text-xs font-semibold text-white"
      >
        Send Notification
      </button>
    </form>
  );
}
