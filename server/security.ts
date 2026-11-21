import crypto from 'node:crypto';
import path from 'node:path';
import type { Request, Response, NextFunction } from 'express';

// Ephemeral fallback key in memory if SESSION_SECRET is unset (never written to disk)
const EPHEMERAL_SECRET = crypto.randomBytes(32).toString('hex');

export function getSigningSecret(): string {
  const configured = process.env.SESSION_SECRET?.trim();
  return configured && configured.length >= 16 ? configured : EPHEMERAL_SECRET;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, expectedHex] = parts;
  if (!salt || !expectedHex) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHex, 'hex');
  if (derived.length !== expected.length) return false;
  return crypto.timingSafeEqual(derived, expected);
}

export function generateToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function createSignedMediaToken(params: {
  userId: string;
  resourceType: 'video' | 'resource';
  resourceId: string;
  ttlSeconds?: number;
}): { exp: number; sig: string } {
  const ttl = params.ttlSeconds ?? 120;
  const exp = Math.floor(Date.now() / 1000) + ttl;
  const payload = `${params.resourceType}:${params.resourceId}:${params.userId}:${exp}`;
  const sig = crypto.createHmac('sha256', getSigningSecret()).update(payload).digest('hex');
  return { exp, sig };
}

export function verifySignedMediaToken(params: {
  userId: string;
  resourceType: 'video' | 'resource';
  resourceId: string;
  exp: number;
  sig: string;
}): boolean {
  if (!params.sig || !Number.isFinite(params.exp)) return false;
  if (Math.floor(Date.now() / 1000) > params.exp) return false;
  const payload = `${params.resourceType}:${params.resourceId}:${params.userId}:${params.exp}`;
  const expected = crypto.createHmac('sha256', getSigningSecret()).update(payload).digest('hex');
  const sigBuf = Buffer.from(params.sig, 'utf8');
  const expBuf = Buffer.from(expected, 'utf8');
  if (sigBuf.length !== expBuf.length) return false;
  return crypto.timingSafeEqual(sigBuf, expBuf);
}

export function resolveConfinedPath(baseDir: string, unsafeRelativePath: string): string | null {
  const normalizedBase = path.resolve(baseDir);
  const cleaned = path.basename(unsafeRelativePath);
  if (!cleaned || cleaned === '.' || cleaned === '..') return null;
  const resolved = path.resolve(normalizedBase, cleaned);
  if (!resolved.startsWith(normalizedBase + path.sep)) {
    return null;
  }
  return resolved;
}

export function sanitizeExternalUrl(url: string): string {
  const trimmed = (url || '').trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('/')) return trimmed;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString();
    }
    return '';
  } catch {
    return '';
  }
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

// Sliding-window in-memory rate limiter
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(options: { windowMs: number; max: number; keyPrefix: string }) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const key = `${options.keyPrefix}:${ip}`;
    const now = Date.now();
    const bucket = rateBuckets.get(key);
    if (!bucket || now > bucket.resetAt) {
      rateBuckets.set(key, { count: 1, resetAt: now + options.windowMs });
      next();
      return;
    }
    if (bucket.count >= options.max) {
      res.status(429).json({
        error: 'Too many requests. Please wait a moment before trying again.',
      });
      return;
    }
    bucket.count += 1;
    next();
  };
}

export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function validateBdPhone(phone: string): boolean {
  const cleaned = phone.replace(/[\s-]/g, '');
  return /^(\+?88)?01[3-9]\d{8}$/.test(cleaned) || /^\+?[1-9]\d{7,14}$/.test(cleaned);
}
