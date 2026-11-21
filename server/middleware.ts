import type { Request, Response, NextFunction } from 'express';
import { db } from './db.ts';
import { hashToken } from './security.ts';
import type { UserRole } from '../src/types/academy.ts';

export interface AuthenticatedUser {
  id: string;
  email: string;
  full_name: string;
  phone: string;
  role: UserRole;
  is_blocked: boolean;
  email_verified: boolean;
}

export interface AuthRequest extends Request {
  user?: AuthenticatedUser;
  sessionId?: string;
}

export function resolveSessionUser(req: Request): {
  user: AuthenticatedUser | null;
  sessionId: string | null;
} {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return { user: null, sessionId: null };
  }
  const rawToken = authHeader.slice(7).trim();
  if (!rawToken) return { user: null, sessionId: null };

  const tokenHash = hashToken(rawToken);
  const row = db
    .prepare(
      `SELECT s.id as session_id, s.expires_at,
              p.id, p.email, p.full_name, p.phone, p.is_blocked, p.email_verified,
              COALESCE(ur.role, 'student') as role
       FROM sessions s
       JOIN profiles p ON p.id = s.user_id
       LEFT JOIN user_roles ur ON ur.user_id = p.id
       WHERE s.token_hash = ?`
    )
    .get(tokenHash) as
    | {
        session_id: string;
        expires_at: string;
        id: string;
        email: string;
        full_name: string;
        phone: string;
        is_blocked: number;
        email_verified: number;
        role: UserRole;
      }
    | undefined;

  if (!row) return { user: null, sessionId: null };
  if (new Date(row.expires_at).getTime() < Date.now()) {
    db.prepare('DELETE FROM sessions WHERE id = ?').run(row.session_id);
    return { user: null, sessionId: null };
  }
  if (row.is_blocked === 1) {
    return { user: null, sessionId: null };
  }

  return {
    sessionId: row.session_id,
    user: {
      id: row.id,
      email: row.email,
      full_name: row.full_name,
      phone: row.phone,
      role: row.role === 'admin' ? 'admin' : 'student',
      is_blocked: row.is_blocked === 1,
      email_verified: row.email_verified === 1,
    },
  };
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const { user, sessionId } = resolveSessionUser(req);
  if (!user || !sessionId) {
    res.status(401).json({ error: 'Authentication required. Please sign in.' });
    return;
  }
  req.user = user;
  req.sessionId = sessionId;
  next();
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction): void {
  const { user, sessionId } = resolveSessionUser(req);
  if (!user || !sessionId) {
    res.status(401).json({ error: 'Admin authentication required.' });
    return;
  }
  if (user.role !== 'admin') {
    res.status(403).json({ error: 'Forbidden: Administrator access required.' });
    return;
  }
  req.user = user;
  req.sessionId = sessionId;
  next();
}
