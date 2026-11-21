import { Router, type Request, type Response } from 'express';
import { db, uuid, getWebsiteSettings } from '../db.ts';
import { resolveSessionUser } from '../middleware.ts';
import { rateLimit, validateEmail } from '../security.ts';

const router = Router();

// Public Website Settings (excludes any private server secrets)
router.get('/settings/public', (_req: Request, res: Response) => {
  res.json({ settings: getWebsiteSettings() });
});

// Categories with published course counts
router.get('/categories', (_req: Request, res: Response) => {
  const rows = db
    .prepare(
      `SELECT cc.*,
              (SELECT COUNT(*) FROM courses c WHERE c.category_id = cc.id AND c.status = 'published') as course_count
       FROM course_categories cc
       ORDER BY cc.sort_order ASC, cc.name ASC`
    )
    .all();
  res.json({ categories: rows });
});

// Published Courses with optional search, category, level, featured filters
router.get('/courses', (req: Request, res: Response) => {
  const search = String(req.query.q || '').trim().toLowerCase();
  const category = String(req.query.category || '').trim();
  const level = String(req.query.level || '').trim();
  const featured = String(req.query.featured || '').trim();

  let sql = `
    SELECT c.*,
           cc.name as category_name,
           cc.name_bn as category_name_bn,
           cc.slug as category_slug,
           (SELECT COUNT(*) FROM lessons l WHERE l.course_id = c.id) as lesson_count,
           (SELECT COUNT(*) FROM chapters ch WHERE ch.course_id = c.id) as chapter_count,
           (SELECT COUNT(*) FROM enrollments e WHERE e.course_id = c.id AND e.status = 'active') as enrollment_count
    FROM courses c
    LEFT JOIN course_categories cc ON cc.id = c.category_id
    WHERE c.status = 'published'
  `;
  const params: unknown[] = [];

  if (search) {
    sql += ` AND (LOWER(c.title) LIKE ? OR LOWER(c.title_bn) LIKE ? OR LOWER(c.short_description) LIKE ? OR LOWER(c.instructor_name) LIKE ?)`;
    const pat = `%${search}%`;
    params.push(pat, pat, pat, pat);
  }
  if (category && category !== 'all') {
    sql += ` AND cc.slug = ?`;
    params.push(category);
  }
  if (level && level !== 'all') {
    sql += ` AND c.level = ?`;
    params.push(level);
  }
  if (featured === '1' || featured === 'true') {
    sql += ` AND c.is_featured = 1`;
  }

  sql += ` ORDER BY c.is_featured DESC, c.created_at DESC`;

  const rows = db.prepare(sql).all(...(params as string[])) as Record<string, unknown>[];
  const courses = rows.map((r) => ({
    ...r,
    is_featured: Boolean(r.is_featured),
  }));

  res.json({ courses });
});

// Course Details (NEVER leaks video_storage_path on public response!)
router.get('/courses/:slug', (req: Request, res: Response) => {
  const { user } = resolveSessionUser(req);
  const slug = String(req.params.slug || '').trim();

  const course = db
    .prepare(
      `SELECT c.*,
              cc.name as category_name,
              cc.name_bn as category_name_bn,
              cc.slug as category_slug,
              (SELECT COUNT(*) FROM lessons l WHERE l.course_id = c.id) as lesson_count,
              (SELECT COUNT(*) FROM chapters ch WHERE ch.course_id = c.id) as chapter_count,
              (SELECT COUNT(*) FROM enrollments e WHERE e.course_id = c.id AND e.status = 'active') as enrollment_count
       FROM courses c
       LEFT JOIN course_categories cc ON cc.id = c.category_id
       WHERE c.slug = ? AND (c.status = 'published' OR ? = 'admin')`
    )
    .get(slug, user?.role || 'guest') as Record<string, unknown> | undefined;

  if (!course) {
    res.status(404).json({ error: 'Course not found.' });
    return;
  }

  const chapters = db
    .prepare('SELECT * FROM chapters WHERE course_id = ? ORDER BY sort_order ASC, created_at ASC')
    .all(String(course.id)) as Record<string, unknown>[];

  // Omit video_storage_path strictly
  const lessons = db
    .prepare(
      `SELECT id, course_id, chapter_id, title, title_bn, description,
              duration_seconds, is_free_preview, sort_order,
              CASE WHEN video_storage_path <> '' THEN 1 ELSE 0 END as has_video
       FROM lessons
       WHERE course_id = ?
       ORDER BY sort_order ASC, created_at ASC`
    )
    .all(String(course.id)) as Record<string, unknown>[];

  const chaptersWithLessons = chapters.map((ch) => ({
    ...ch,
    lessons: lessons
      .filter((l) => l.chapter_id === ch.id)
      .map((l) => ({
        ...l,
        is_free_preview: Boolean(l.is_free_preview),
        has_video: Boolean(l.has_video),
      })),
  }));

  let viewerPayment = null;
  let viewerEnrollment = null;
  if (user) {
    viewerEnrollment = db
      .prepare('SELECT id, status, enrolled_at FROM enrollments WHERE user_id = ? AND course_id = ?')
      .get(user.id, String(course.id));
    viewerPayment = db
      .prepare(
        'SELECT id, payment_method, amount, transaction_id, status, rejection_reason, created_at FROM payments WHERE user_id = ? AND course_id = ? ORDER BY created_at DESC LIMIT 1'
      )
      .get(user.id, String(course.id));
  }

  const communityInfo = db
    .prepare(
      `SELECT telegram_required, whatsapp_required, instructions, instructions_bn
       FROM community_settings WHERE course_id = ?`
    )
    .get(String(course.id));

  res.json({
    course: { ...course, is_featured: Boolean(course.is_featured) },
    chapters: chaptersWithLessons,
    communityRequirements: communityInfo
      ? {
          telegram_required: Boolean((communityInfo as Record<string, unknown>).telegram_required),
          whatsapp_required: Boolean((communityInfo as Record<string, unknown>).whatsapp_required),
          instructions: String((communityInfo as Record<string, unknown>).instructions || ''),
          instructions_bn: String((communityInfo as Record<string, unknown>).instructions_bn || ''),
        }
      : { telegram_required: true, whatsapp_required: true, instructions: '', instructions_bn: '' },
    viewerEnrollment,
    viewerPayment,
  });
});

// Instructor Details
router.get('/instructors/:slug', (req: Request, res: Response) => {
  const slug = String(req.params.slug || '').trim();
  const rows = db
    .prepare(
      `SELECT c.*, cc.name as category_name, cc.slug as category_slug,
              (SELECT COUNT(*) FROM lessons l WHERE l.course_id = c.id) as lesson_count
       FROM courses c
       LEFT JOIN course_categories cc ON cc.id = c.category_id
       WHERE c.instructor_slug = ? AND c.status = 'published'
       ORDER BY c.created_at DESC`
    )
    .all(slug) as Record<string, unknown>[];

  if (rows.length === 0) {
    res.status(404).json({ error: 'Instructor not found.' });
    return;
  }

  const first = rows[0];
  res.json({
    instructor: {
      name: String(first.instructor_name),
      slug: String(first.instructor_slug),
      title: String(first.instructor_title),
      bio: String(first.instructor_bio),
    },
    courses: rows.map((r) => ({ ...r, is_featured: Boolean(r.is_featured) })),
  });
});

// Public Support / Contact Submission
router.post(
  '/support',
  rateLimit({ windowMs: 10 * 60 * 1000, max: 10, keyPrefix: 'support_public' }),
  (req: Request, res: Response) => {
    const { user } = resolveSessionUser(req);
    const { sender_name, sender_email, sender_phone, subject, message } = req.body as Record<string, string>;

    if (!sender_name?.trim() || !sender_email?.trim() || !subject?.trim() || !message?.trim()) {
      res.status(400).json({ error: 'Name, email, subject, and message are required.' });
      return;
    }
    if (!validateEmail(sender_email)) {
      res.status(400).json({ error: 'Please provide a valid email address.' });
      return;
    }

    const id = uuid();
    db.prepare(
      `INSERT INTO support_messages (id, user_id, sender_name, sender_email, sender_phone, subject, message)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      user?.id || null,
      sender_name.trim().slice(0, 120),
      sender_email.trim().toLowerCase().slice(0, 120),
      (sender_phone || '').trim().slice(0, 40),
      subject.trim().slice(0, 180),
      message.trim().slice(0, 3000)
    );

    res.status(201).json({
      id,
      message: 'Your support message has been submitted. Our team will respond shortly.',
    });
  }
);

export default router;
