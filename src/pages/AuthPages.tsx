import React, { useState } from 'react';
import { ShieldAlert, CheckCircle2 } from 'lucide-react';
import type { UserProfile } from '../types/academy';
import { useApp } from '../context/AppContext';
import { apiRequest } from '../lib/api';

export function AuthPages({
  mode,
}: {
  mode: 'login' | 'register' | 'forgot' | 'reset' | 'admin-setup';
}) {
  const {
    lang,
    navigate,
    setSession,
    needsAdminSetup,
    refreshBootstrapStatus,
    currentPath,
  } = useApp();

  const queryParams = new URLSearchParams(currentPath.split('?')[1] || '');
  const nextPath = queryParams.get('next') || '';

  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    password: '',
    confirm_password: '',
    token: queryParams.get('token') || '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [resetPreview, setResetPreview] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await apiRequest<{ token: string; user: UserProfile }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: form.email, password: form.password }),
      });
      setSession(res.token, res.user);
      if (nextPath && nextPath.startsWith('/')) {
        navigate(nextPath);
      } else if (res.user.role === 'admin') {
        navigate('/admin');
      } else {
        navigate('/student');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await apiRequest<{
        token: string;
        user: UserProfile;
        verificationCodePreview?: string;
      }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          full_name: form.full_name,
          email: form.email,
          phone: form.phone,
          password: form.password,
          confirm_password: form.confirm_password,
        }),
      });
      setSession(res.token, res.user);
      navigate('/student');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleAdminBootstrap = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await apiRequest<{ token: string; user: UserProfile }>(
        '/api/auth/bootstrap-admin',
        {
          method: 'POST',
          body: JSON.stringify({
            full_name: form.full_name,
            email: form.email,
            phone: form.phone,
            password: form.password,
            confirm_password: form.confirm_password,
          }),
        }
      );
      setSession(res.token, res.user);
      await refreshBootstrapStatus();
      navigate('/admin');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not initialize admin account.');
    } finally {
      setBusy(false);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    setInfo('');
    try {
      const res = await apiRequest<{ message: string; resetTokenPreview?: string }>(
        '/api/auth/forgot-password',
        {
          method: 'POST',
          body: JSON.stringify({ email: form.email }),
        }
      );
      setInfo(res.message);
      if (res.resetTokenPreview) {
        setResetPreview(res.resetTokenPreview);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    setInfo('');
    try {
      const res = await apiRequest<{ message: string }>('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({
          token: form.token,
          new_password: form.password,
          confirm_password: form.confirm_password,
        }),
      });
      setInfo(res.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Password reset failed.');
    } finally {
      setBusy(false);
    }
  };

  if (mode === 'admin-setup' && !needsAdminSetup) {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
          <h1 className="font-display text-xl font-bold text-slate-900">
            Administrator Already Initialized
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            First-run admin initialization is locked. Please sign in with your administrator credentials.
          </p>
          <button
            type="button"
            onClick={() => navigate('/auth/login')}
            className="mt-6 h-11 w-full rounded-lg bg-[var(--brand-primary)] text-sm font-semibold text-white"
          >
            Go to Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12 sm:py-16">
      {needsAdminSetup && mode === 'login' && (
        <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          <div className="flex items-start gap-2.5">
            <ShieldAlert className="h-5 w-5 shrink-0 text-amber-700 mt-0.5" />
            <div>
              <div className="font-semibold">First-Run Setup Available</div>
              <p className="mt-1 text-xs leading-relaxed">
                No administrator account has been created yet. Claim the primary Admin account once to lock setup.
              </p>
              <button
                type="button"
                onClick={() => navigate('/auth/admin-setup')}
                className="mt-2.5 text-xs font-bold text-[var(--brand-primary)] underline"
              >
                Initialize First Admin Account
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8">
        <h1 className="font-display text-2xl font-bold text-slate-900">
          {mode === 'login' && (lang === 'bn' ? 'অ্যাকাউন্টে সাইন ইন করুন' : 'Sign In')}
          {mode === 'register' && (lang === 'bn' ? 'নতুন শিক্ষার্থী নিবন্ধন' : 'Create Student Account')}
          {mode === 'forgot' && (lang === 'bn' ? 'পাসওয়ার্ড পুনরুদ্ধার' : 'Forgot Password')}
          {mode === 'reset' && (lang === 'bn' ? 'নতুন পাসওয়ার্ড সেট করুন' : 'Reset Password')}
          {mode === 'admin-setup' && 'Initialize Primary Admin'}
        </h1>
        <p className="mt-1.5 text-sm text-slate-600">
          {mode === 'login' && 'Access your enrolled courses, payments, and learning progress.'}
          {mode === 'register' && 'Register as a student to enroll via bKash or Nagad.'}
          {mode === 'forgot' && 'Enter your email address to generate a password reset token.'}
          {mode === 'reset' && 'Enter your reset token and choose a strong new password.'}
          {mode === 'admin-setup' && 'One-time setup for the SERA ACADEMY administrator account.'}
        </p>

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}
        {info && (
          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{info}</span>
            </div>
            {resetPreview && (
              <div className="mt-2 border-t border-emerald-200 pt-2 text-xs">
                <div>Reset Token (SMTP Preview):</div>
                <div className="mt-1 font-mono break-all select-all font-semibold">{resetPreview}</div>
                <button
                  type="button"
                  onClick={() => navigate(`/auth/reset-password?token=${encodeURIComponent(resetPreview)}`)}
                  className="mt-2 font-semibold underline"
                >
                  Continue to Reset Password
                </button>
              </div>
            )}
          </div>
        )}

        {mode === 'login' && (
          <form onSubmit={handleLogin} className="mt-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700">Email Address</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="mt-1 h-11 w-full rounded-lg border border-slate-300 px-3.5 text-sm focus:border-[var(--brand-primary)] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Password</label>
              <input
                type="password"
                required
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="mt-1 h-11 w-full rounded-lg border border-slate-300 px-3.5 text-sm focus:border-[var(--brand-primary)] focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="h-11 w-full rounded-lg bg-[var(--brand-primary)] text-sm font-semibold text-white hover:opacity-95 disabled:opacity-60"
            >
              {busy ? 'Signing in...' : 'Sign In'}
            </button>
            <div className="flex items-center justify-between pt-2 text-xs text-slate-600">
              <button
                type="button"
                onClick={() => navigate('/auth/forgot-password')}
                className="hover:text-[var(--brand-primary)] underline"
              >
                Forgot Password?
              </button>
              <button
                type="button"
                onClick={() => navigate('/auth/register')}
                className="font-semibold text-[var(--brand-primary)] hover:underline"
              >
                Create Student Account
              </button>
            </div>
          </form>
        )}

        {(mode === 'register' || mode === 'admin-setup') && (
          <form
            onSubmit={mode === 'admin-setup' ? handleAdminBootstrap : handleRegister}
            className="mt-6 space-y-4"
          >
            <div>
              <label className="block text-xs font-semibold text-slate-700">Full Name</label>
              <input
                type="text"
                required
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                className="mt-1 h-11 w-full rounded-lg border border-slate-300 px-3.5 text-sm focus:border-[var(--brand-primary)] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Email Address</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="mt-1 h-11 w-full rounded-lg border border-slate-300 px-3.5 text-sm focus:border-[var(--brand-primary)] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Phone Number</label>
              <input
                type="tel"
                required
                placeholder="017XXXXXXXX"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="mt-1 h-11 w-full rounded-lg border border-slate-300 px-3.5 text-sm focus:border-[var(--brand-primary)] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Password (min. 8 characters)
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="mt-1 h-11 w-full rounded-lg border border-slate-300 px-3.5 text-sm focus:border-[var(--brand-primary)] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Confirm Password</label>
              <input
                type="password"
                required
                minLength={8}
                value={form.confirm_password}
                onChange={(e) => setForm({ ...form, confirm_password: e.target.value })}
                className="mt-1 h-11 w-full rounded-lg border border-slate-300 px-3.5 text-sm focus:border-[var(--brand-primary)] focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="h-11 w-full rounded-lg bg-[var(--brand-primary)] text-sm font-semibold text-white hover:opacity-95 disabled:opacity-60"
            >
              {busy
                ? 'Creating Account...'
                : mode === 'admin-setup'
                  ? 'Claim Admin Account'
                  : 'Register Student Account'}
            </button>
            {mode === 'register' && (
              <div className="pt-2 text-center text-xs text-slate-600">
                Already registered?{' '}
                <button
                  type="button"
                  onClick={() => navigate('/auth/login')}
                  className="font-semibold text-[var(--brand-primary)] hover:underline"
                >
                  Sign In
                </button>
              </div>
            )}
          </form>
        )}

        {mode === 'forgot' && (
          <form onSubmit={handleForgot} className="mt-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700">Registered Email</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="mt-1 h-11 w-full rounded-lg border border-slate-300 px-3.5 text-sm focus:border-[var(--brand-primary)] focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="h-11 w-full rounded-lg bg-[var(--brand-primary)] text-sm font-semibold text-white hover:opacity-95 disabled:opacity-60"
            >
              {busy ? 'Submitting...' : 'Request Reset Token'}
            </button>
            <div className="text-center text-xs">
              <button
                type="button"
                onClick={() => navigate('/auth/reset-password')}
                className="text-[var(--brand-primary)] underline"
              >
                Already have a reset token?
              </button>
            </div>
          </form>
        )}

        {mode === 'reset' && (
          <form onSubmit={handleReset} className="mt-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700">Reset Token</label>
              <input
                type="text"
                required
                value={form.token}
                onChange={(e) => setForm({ ...form, token: e.target.value })}
                className="mt-1 h-11 w-full rounded-lg border border-slate-300 px-3.5 font-mono text-xs focus:border-[var(--brand-primary)] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">New Password</label>
              <input
                type="password"
                required
                minLength={8}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="mt-1 h-11 w-full rounded-lg border border-slate-300 px-3.5 text-sm focus:border-[var(--brand-primary)] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Confirm Password</label>
              <input
                type="password"
                required
                minLength={8}
                value={form.confirm_password}
                onChange={(e) => setForm({ ...form, confirm_password: e.target.value })}
                className="mt-1 h-11 w-full rounded-lg border border-slate-300 px-3.5 text-sm focus:border-[var(--brand-primary)] focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="h-11 w-full rounded-lg bg-[var(--brand-primary)] text-sm font-semibold text-white hover:opacity-95 disabled:opacity-60"
            >
              {busy ? 'Updating...' : 'Reset Password'}
            </button>
            {info && (
              <button
                type="button"
                onClick={() => navigate('/auth/login')}
                className="h-10 w-full rounded-lg border border-slate-300 text-xs font-semibold text-slate-700"
              >
                Return to Sign In
              </button>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
