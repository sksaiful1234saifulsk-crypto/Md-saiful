import { Router, type Request, type Response } from 'express';
import crypto from 'node:crypto';
import { db, uuid, hasAdminAccount, createNotification } from '../db.ts';
import {
  hashPassword,
  verifyPassword,
  generateToken,
  hashToken,
  validateEmail,
  validateBdPhone,
  rateLimit,
} from '../security.ts';
import { requireAuth, type AuthRequest } from '../middleware.ts';

const router = Router();

function issueSession(userId: string, req: Request): string {
  const rawToken = generateToken(32);
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const ua = String(req.headers['user-agent'] || '').slice(0, 200);
  const ip = req.ip || req.socket.remoteAddress || '';

  db.prepare(
    `INSERT INTO sessions (id, user_id, token_hash, user_agent, ip_address, expires_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(uuid(), userId, tokenHash, ua, ip, expiresAt);

  return rawToken;
}

function fetchUserProfile(userId: string) {
  const row = db
    .prepare(
      `SELECT p.id, p.email, p.full_name, p.phone, p.avatar_url, p.bio,
              p.preferred_language, p.email_verified, p.is_blocked, p.created_at,
              COALESCE(ur.role, 'student') as role
       FROM profiles p
       LEFT JOIN user_roles ur ON ur.user_id = p.id
       WHERE p.id = ?`
    )
    .get(userId) as Record<string, unknown> | undefined;

  if (!row) return null;
  return {
    id: String(row.id),
    email: String(row.email),
    full_name: String(row.full_name),
    phone: String(row.phone),
    avatar_url: String(row.avatar_url || ''),
    bio: String(row.bio || ''),
    preferred_language: row.preferred_language === 'bn' ? 'bn' : 'en',
    email_verified: Boolean(row.email_verified),
    is_blocked: Boolean(row.is_blocked),
    role: row.role === 'admin' ? 'admin' : 'student',
    created_at: String(row.created_at),
  };
}

// Check if initial admin needs to be claimed
router.get('/bootstrap-status', (_req: Request, res: Response) => {
  res.json({
    needsAdminSetup: !hasAdminAccount(),
  });
});

// One-time atomic first-admin setup (permanently locks once an admin exists)
router.post(
  '/bootstrap-admin',
  rateLimit({ windowMs: 15 * 60 * 1000, max: 10, keyPrefix: 'bootstrap' }),
  (req: Request, res: Response) => {
    const { full_name, email, phone, password, confirm_password } = req.body as Record<string, string>;

    if (!full_name?.trim() || !email?.trim() || !phone?.trim() || !password) {
      res.status(400).json({ error: 'All fields are required to initialize the administrator account.' });
      return;
    }
    if (!validateEmail(email)) {
      res.status(400).json({ error: 'Please provide a valid email address.' });
      return;
    }
    if (!validateBdPhone(phone)) {
      res.status(400).json({ error: 'Please provide a valid phone number.' });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({ error: 'Admin password must be at least 8 characters long.' });
      return;
    }
    if (password !== confirm_password) {
      res.status(400).json({ error: 'Passwords do not match.' });
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    const userId = uuid();

    try {
      db.exec('BEGIN IMMEDIATE');
      if (hasAdminAccount()) {
        db.exec('ROLLBACK');
        res.status(403).json({
          error: 'An administrator account has already been initialized. Please sign in.',
        });
        return;
      }

      const existing = db.prepare('SELECT id FROM profiles WHERE email = ?').get(cleanEmail);
      if (existing) {
        db.exec('ROLLBACK');
        res.status(409).json({ error: 'An account with this email already exists.' });
        return;
      }

      db.prepare(
        `INSERT INTO profiles (id, email, full_name, phone, password_hash, email_verified)
         VALUES (?, ?, ?, ?, ?, 1)`
      ).run(userId, cleanEmail, full_name.trim(), phone.trim(), hashPassword(password));

      db.prepare(
        `INSERT INTO user_roles (id, user_id, role, assigned_by)
         VALUES (?, ?, 'admin', ?)`
      ).run(uuid(), userId, userId);

      db.prepare(
        `INSERT INTO admin_activity_logs (id, admin_id, action, target_type, target_id, details)
         VALUES (?, ?, 'ADMIN_BOOTSTRAPPED', 'profile', ?, ?)`
      ).run(uuid(), userId, userId, JSON.stringify({ email: cleanEmail }));

      db.exec('COMMIT');

      const token = issueSession(userId, req);
      res.status(201).json({
        token,
        user: fetchUserProfile(userId),
      });
    } catch {
      try {
        db.exec('ROLLBACK');
      } catch {
        // ignore rollback error
      }
      res.status(500).json({ error: 'Failed to initialize administrator account.' });
    }
  }
);

// Student Registration (ALWAYS assigns 'student' role)
router.post(
  '/register',
  rateLimit({ windowMs: 15 * 60 * 1000, max: 20, keyPrefix: 'register' }),
  (req: Request, res: Response) => {
    const { full_name, email, phone, password, confirm_password } = req.body as Record<string, string>;

    if (!full_name?.trim() || !email?.trim() || !phone?.trim() || !password) {
      res.status(400).json({ error: 'All registration fields are required.' });
      return;
    }
    if (!validateEmail(email)) {
      res.status(400).json({ error: 'Please enter a valid email address.' });
      return;
    }
    if (!validateBdPhone(phone)) {
      res.status(400).json({ error: 'Please enter a valid phone number (e.g. 01712345678).' });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters long.' });
      return;
    }
    if (password !== confirm_password) {
      res.status(400).json({ error: 'Passwords do not match.' });
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    const existing = db.prepare('SELECT id FROM profiles WHERE email = ?').get(cleanEmail);
    if (existing) {
      res.status(409).json({ error: 'An account with this email address already exists.' });
      return;
    }

    const userId = uuid();
    const verificationCode = String(crypto.randomInt(100000, 999999));

    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare(
        `INSERT INTO profiles (id, email, full_name, phone, password_hash, email_verified, email_verification_code)
         VALUES (?, ?, ?, ?, ?, 0, ?)`
      ).run(userId, cleanEmail, full_name.trim(), phone.trim(), hashPassword(password), verificationCode);

      // Strictly enforce 'student' role regardless of client payload
      db.prepare(
        `INSERT INTO user_roles (id, user_id, role)
         VALUES (?, ?, 'student')`
      ).run(uuid(), userId);

      createNotification({
        userId,
        eventType: 'registration',
        title: 'Welcome to SERA ACADEMY',
        message: `Your student account is registered. Verify your email using code ${verificationCode} in Account Settings.`,
        link: '/student/settings',
      });

      db.exec('COMMIT');
    } catch {
      db.exec('ROLLBACK');
      res.status(500).json({ error: 'Unable to complete registration. Please try again.' });
      return;
    }

    const token = issueSession(userId, req);
    res.status(201).json({
      token,
      user: fetchUserProfile(userId),
      verificationCodePreview: verificationCode,
      message: 'Registration successful. Please verify your email code.',
    });
  }
);

// Verify Email Code
router.post('/verify-email', requireAuth, (req: AuthRequest, res: Response) => {
  const { code } = req.body as { code?: string };
  if (!code?.trim()) {
    res.status(400).json({ error: 'Verification code is required.' });
    return;
  }

  const row = db
    .prepare('SELECT email_verification_code, email_verified FROM profiles WHERE id = ?')
    .get(req.user!.id) as { email_verification_code: string; email_verified: number } | undefined;

  if (!row) {
    res.status(404).json({ error: 'Profile not found.' });
    return;
  }
  if (row.email_verified === 1) {
    res.json({ user: fetchUserProfile(req.user!.id), message: 'Email is already verified.' });
    return;
  }
  if (row.email_verification_code !== code.trim()) {
    res.status(400).json({ error: 'Invalid verification code.' });
    return;
  }

  db.prepare(
    `UPDATE profiles SET email_verified = 1, email_verification_code = '', updated_at = datetime('now')
     WHERE id = ?`
  ).run(req.user!.id);

  res.json({
    user: fetchUserProfile(req.user!.id),
    message: 'Email address verified successfully.',
  });
});

// Resend Verification Code
router.post('/resend-verification', requireAuth, (req: AuthRequest, res: Response) => {
  const code = String(crypto.randomInt(100000, 999999));
  db.prepare(
    `UPDATE profiles SET email_verification_code = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(code, req.user!.id);

  createNotification({
    userId: req.user!.id,
    eventType: 'email_verification',
    title: 'Email Verification Code',
    message: `Your verification code is ${code}.`,
    link: '/student/settings',
  });

  res.json({
    verificationCodePreview: code,
    message: 'A fresh verification code has been generated.',
  });
});

// Login
router.post(
  '/login',
  rateLimit({ windowMs: 15 * 60 * 1000, max: 25, keyPrefix: 'login' }),
  (req: Request, res: Response) => {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email?.trim() || !password) {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }

    const row = db
      .prepare('SELECT id, password_hash, is_blocked FROM profiles WHERE email = ?')
      .get(email.trim().toLowerCase()) as
      | { id: string; password_hash: string; is_blocked: number }
      | undefined;

    if (!row || !verifyPassword(password, row.password_hash)) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    if (row.is_blocked === 1) {
      res.status(403).json({
        error: 'Your account has been suspended by an administrator. Please contact support.',
      });
      return;
    }

    const token = issueSession(row.id, req);
    res.json({
      token,
      user: fetchUserProfile(row.id),
    });
  }
);

// Logout
router.post('/logout', requireAuth, (req: AuthRequest, res: Response) => {
  if (req.sessionId) {
    db.prepare('DELETE FROM sessions WHERE id = ?').run(req.sessionId);
  }
  res.json({ ok: true });
});

// Current User
router.get('/me', requireAuth, (req: AuthRequest, res: Response) => {
  const profile = fetchUserProfile(req.user!.id);
  if (!profile) {
    res.status(404).json({ error: 'Account not found.' });
    return;
  }
  res.json({ user: profile });
});

// Forgot Password
router.post(
  '/forgot-password',
  rateLimit({ windowMs: 15 * 60 * 1000, max: 10, keyPrefix: 'forgot' }),
  (req: Request, res: Response) => {
    const { email } = req.body as { email?: string };
    if (!email?.trim() || !validateEmail(email)) {
      res.status(400).json({ error: 'Please provide a valid email address.' });
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = db.prepare('SELECT id FROM profiles WHERE email = ?').get(cleanEmail) as
      | { id: string }
      | undefined;

    if (user) {
      const resetToken = generateToken(20);
      const expires = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      db.prepare(
        `UPDATE profiles SET password_reset_token = ?, password_reset_expires = ? WHERE id = ?`
      ).run(hashToken(resetToken), expires, user.id);

      // Expose reset token only if SMTP is not configured so local/preview users can test full flow
      res.json({
        message: 'If an account matches that email, password reset instructions have been issued.',
        resetTokenPreview: !process.env.SMTP_HOST ? resetToken : undefined,
      });
      return;
    }

    res.json({
      message: 'If an account matches that email, password reset instructions have been issued.',
    });
  }
);

// Reset Password
router.post('/reset-password', (req: Request, res: Response) => {
  const { token, new_password, confirm_password } = req.body as Record<string, string>;
  if (!token?.trim() || !new_password) {
    res.status(400).json({ error: 'Reset token and new password are required.' });
    return;
  }
  if (new_password.length < 8) {
    res.status(400).json({ error: 'Password must be at least 8 characters long.' });
    return;
  }
  if (new_password !== confirm_password) {
    res.status(400).json({ error: 'Passwords do not match.' });
    return;
  }

  const tokenHash = hashToken(token.trim());
  const user = db
    .prepare(
      `SELECT id, password_reset_expires FROM profiles WHERE password_reset_token = ?`
    )
    .get(tokenHash) as { id: string; password_reset_expires: string } | undefined;

  if (!user || new Date(user.password_reset_expires).getTime() < Date.now()) {
    res.status(400).json({ error: 'Invalid or expired password reset token.' });
    return;
  }

  db.prepare(
    `UPDATE profiles
     SET password_hash = ?, password_reset_token = '', password_reset_expires = '', updated_at = datetime('now')
     WHERE id = ?`
  ).run(hashPassword(new_password), user.id);

  // Invalidate existing sessions for safety
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id);

  res.json({ message: 'Password updated successfully. You may now sign in.' });
});

// Update Profile (permitted fields only: full_name, phone, bio, preferred_language)
router.put('/profile', requireAuth, (req: AuthRequest, res: Response) => {
  const { full_name, phone, bio, preferred_language } = req.body as Record<string, string>;
  if (!full_name?.trim() || !phone?.trim()) {
    res.status(400).json({ error: 'Full name and phone number are required.' });
    return;
  }
  if (!validateBdPhone(phone)) {
    res.status(400).json({ error: 'Please provide a valid phone number.' });
    return;
  }
  const lang = preferred_language === 'bn' ? 'bn' : 'en';

  db.prepare(
    `UPDATE profiles
     SET full_name = ?, phone = ?, bio = ?, preferred_language = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(full_name.trim(), phone.trim(), (bio || '').trim().slice(0, 600), lang, req.user!.id);

  res.json({
    user: fetchUserProfile(req.user!.id),
    message: 'Profile updated successfully.',
  });
});

// Change Password
router.put('/change-password', requireAuth, (req: AuthRequest, res: Response) => {
  const { current_password, new_password, confirm_password } = req.body as Record<string, string>;
  if (!current_password || !new_password) {
    res.status(400).json({ error: 'Current password and new password are required.' });
    return;
  }
  if (new_password.length < 8) {
    res.status(400).json({ error: 'New password must be at least 8 characters long.' });
    return;
  }
  if (new_password !== confirm_password) {
    res.status(400).json({ error: 'New passwords do not match.' });
    return;
  }

  const row = db
    .prepare('SELECT password_hash FROM profiles WHERE id = ?')
    .get(req.user!.id) as { password_hash: string } | undefined;

  if (!row || !verifyPassword(current_password, row.password_hash)) {
    res.status(401).json({ error: 'Current password is incorrect.' });
    return;
  }

  db.prepare(
    `UPDATE profiles SET password_hash = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(hashPassword(new_password), req.user!.id);

  res.json({ message: 'Password changed successfully.' });
});

export default router;
