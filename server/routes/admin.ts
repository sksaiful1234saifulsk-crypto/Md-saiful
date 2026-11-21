import { Router, type Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import { db, uuid, createNotification, logAdminAction, getWebsiteSettings } from '../db.ts';
import { requireAdmin, type AuthRequest } from '../middleware.ts';
import { resolveConfinedPath, sanitizeExternalUrl, slugify, validateEmail } from '../security.ts';
import { getSupabaseAdmin, isSupabaseConfigured } from '../supabase.ts';

const router = Router();
router.use(requireAdmin);

const PRIVATE_VIDEOS_DIR = path.resolve(process.cwd(), 'storage', 'private_videos');
const PRIVATE_RESOURCES_DIR = path.resolve(process.cwd(), 'storage', 'private_resources');
const PUBLIC_UPLOADS_DIR = path.resolve(process.cwd(), 'storage', 'public_uploads');

for (const dir of [PRIVATE_VIDEOS_DIR, PRIVATE_RESOURCES_DIR, PUBLIC_UPLOADS_DIR]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

const uploadImage = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, PUBLIC_UPLOADS_DIR),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const safeExt = ['.jpg', '.jpeg', '.png', '.webp', '.svg', '.ico'].includes(ext) ? ext : '.png';
      cb(null, `brand_${Date.now()}_${uuid().slice(0, 8)}${safeExt}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml', 'image/x-icon'];
    cb(null, allowed.includes(file.mimetype));
  },
});

const uploadVideo = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, PRIVATE_VIDEOS_DIR),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const safeExt = ['.mp4', '.webm', '.mov'].includes(ext) ? ext : '.mp4';
      cb(null, `video_${Date.now()}_${uuid().slice(0, 8)}${safeExt}`);
    },
  }),
  limits: { fileSize: 300 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['video/mp4', 'video/webm', 'video/quicktime'];
    cb(null, allowed.includes(file.mimetype));
  },
});

const uploadResource = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, PRIVATE_RESOURCES_DIR),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const safeExt = ['.pdf', '.zip', '.txt', '.md'].includes(ext) ? ext : '.pdf';
      cb(null, `res_${Date.now()}_${uuid().slice(0, 8)}${safeExt}`);
    },
  }),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['application/pdf', 'application/zip', 'application/x-zip-compressed', 'text/plain'];
    cb(null, allowed.includes(file.mimetype));
  },
});

// OVERVIEW KPIs
router.get('/overview', (_req: AuthRequest, res: Response) => {
  const totalStudents = (
    db.prepare("SELECT COUNT(*) as cnt FROM user_roles WHERE role = 'student'").get() as { cnt: number }
  ).cnt;
  const totalCourses = (db.prepare('SELECT COUNT(*) as cnt FROM courses').get() as { cnt: number }).cnt;
  const publishedCourses = (
    db.prepare("SELECT COUNT(*) as cnt FROM courses WHERE status = 'published'").get() as { cnt: number }
  ).cnt;
  const totalEnrollments = (
    db.prepare("SELECT COUNT(*) as cnt FROM enrollments WHERE status = 'active'").get() as { cnt: number }
  ).cnt;
  const revenueRow = db
    .prepare("SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE status = 'approved'")
    .get() as { total: number };
  const pendingPayments = (
    db.prepare("SELECT COUNT(*) as cnt FROM payments WHERE status = 'pending'").get() as { cnt: number }
  ).cnt;
  const approvedPayments = (
    db.prepare("SELECT COUNT(*) as cnt FROM payments WHERE status = 'approved'").get() as { cnt: number }
  ).cnt;
  const rejectedPayments = (
    db.prepare("SELECT COUNT(*) as cnt FROM payments WHERE status = 'rejected'").get() as { cnt: number }
  ).cnt;
  const pendingCommunity = (
    db
      .prepare(
        "SELECT COUNT(*) as cnt FROM community_memberships WHERE telegram_status = 'pending_verification' OR whatsapp_status = 'pending_verification'"
      )
      .get() as { cnt: number }
  ).cnt;
  const openSupport = (
    db.prepare("SELECT COUNT(*) as cnt FROM support_messages WHERE status = 'open'").get() as { cnt: number }
  ).cnt;

  const recentRegistrations = db
    .prepare(
      `SELECT p.id, p.full_name, p.email, p.phone, p.email_verified, p.is_blocked, p.created_at
       FROM profiles p
       JOIN user_roles ur ON ur.user_id = p.id
       WHERE ur.role = 'student'
       ORDER BY p.created_at DESC
       LIMIT 6`
    )
    .all();

  const recentTransactions = db
    .prepare(
      `SELECT pay.*, p.full_name as student_name, p.email as student_email, c.title as course_title
       FROM payments pay
       JOIN profiles p ON p.id = pay.user_id
       JOIN courses c ON c.id = pay.course_id
       ORDER BY pay.created_at DESC
       LIMIT 8`
    )
    .all();

  const recentActivities = db
    .prepare(
      `SELECT l.*, p.full_name as admin_name
       FROM admin_activity_logs l
       JOIN profiles p ON p.id = l.admin_id
       ORDER BY l.created_at DESC
       LIMIT 10`
    )
    .all();

  res.json({
    metrics: {
      totalStudents,
      totalCourses,
      publishedCourses,
      totalEnrollments,
      totalRevenue: revenueRow.total,
      pendingPayments,
      approvedPayments,
      rejectedPayments,
      pendingCommunity,
      openSupport,
    },
    recentRegistrations,
    recentTransactions,
    recentActivities,
  });
});

// STUDENT MANAGEMENT
router.get('/students', (req: AuthRequest, res: Response) => {
  const search = String(req.query.q || '').trim().toLowerCase();
  let sql = `
    SELECT p.id, p.email, p.full_name, p.phone, p.bio, p.email_verified, p.is_blocked, p.created_at,
           (SELECT COUNT(*) FROM enrollments e WHERE e.user_id = p.id AND e.status = 'active') as enrolled_courses_count,
           (SELECT COUNT(*) FROM payments pay WHERE pay.user_id = p.id) as payments_count
    FROM profiles p
    JOIN user_roles ur ON ur.user_id = p.id
    WHERE ur.role = 'student'
  `;
  const params: string[] = [];
  if (search) {
    sql += ` AND (LOWER(p.full_name) LIKE ? OR LOWER(p.email) LIKE ? OR LOWER(p.phone) LIKE ?)`;
    const pat = `%${search}%`;
    params.push(pat, pat, pat);
  }
  sql += ` ORDER BY p.created_at DESC`;

  const students = db.prepare(sql).all(...params) as Record<string, unknown>[];
  res.json({
    students: students.map((s) => ({
      ...s,
      email_verified: Boolean(s.email_verified),
      is_blocked: Boolean(s.is_blocked),
    })),
  });
});

router.get('/students/:id/details', (req: AuthRequest, res: Response) => {
  const id = String(req.params.id);
  const student = db
    .prepare(
      `SELECT p.id, p.email, p.full_name, p.phone, p.bio, p.email_verified, p.is_blocked, p.created_at
       FROM profiles p WHERE p.id = ?`
    )
    .get(id) as Record<string, unknown> | undefined;

  if (!student) {
    res.status(404).json({ error: 'Student not found.' });
    return;
  }

  const courses = db
    .prepare(
      `SELECT e.*, c.title, c.slug
       FROM enrollments e
       JOIN courses c ON c.id = e.course_id
       WHERE e.user_id = ?
       ORDER BY e.enrolled_at DESC`
    )
    .all(id);

  const payments = db
    .prepare(
      `SELECT pay.*, c.title as course_title
       FROM payments pay
       JOIN courses c ON c.id = pay.course_id
       WHERE pay.user_id = ?
       ORDER BY pay.created_at DESC`
    )
    .all(id);

  const community = db
    .prepare(
      `SELECT cm.*, c.title as course_title
       FROM community_memberships cm
       JOIN courses c ON c.id = cm.course_id
       WHERE cm.user_id = ?`
    )
    .all(id);

  res.json({
    student: {
      ...student,
      email_verified: Boolean(student.email_verified),
      is_blocked: Boolean(student.is_blocked),
    },
    courses,
    payments,
    community,
  });
});

router.put('/students/:id', (req: AuthRequest, res: Response) => {
  const id = String(req.params.id);
  const { full_name, phone, email, bio, email_verified } = req.body as Record<string, unknown>;
  if (!String(full_name || '').trim() || !String(phone || '').trim() || !validateEmail(String(email || ''))) {
    res.status(400).json({ error: 'Valid name, email, and phone are required.' });
    return;
  }

  db.prepare(
    `UPDATE profiles
     SET full_name = ?, phone = ?, email = ?, bio = ?, email_verified = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(
    String(full_name).trim(),
    String(phone).trim(),
    String(email).trim().toLowerCase(),
    String(bio || '').trim(),
    email_verified ? 1 : 0,
    id
  );

  logAdminAction({
    adminId: req.user!.id,
    action: 'UPDATE_STUDENT',
    targetType: 'profile',
    targetId: id,
    details: { full_name: String(full_name) },
    ipAddress: req.ip,
  });

  res.json({ ok: true, message: 'Student profile updated.' });
});

router.post('/students/:id/toggle-block', (req: AuthRequest, res: Response) => {
  const id = String(req.params.id);
  const row = db.prepare('SELECT is_blocked, full_name FROM profiles WHERE id = ?').get(id) as
    | { is_blocked: number; full_name: string }
    | undefined;

  if (!row) {
    res.status(404).json({ error: 'Student not found.' });
    return;
  }

  const nextBlocked = row.is_blocked === 1 ? 0 : 1;
  db.prepare("UPDATE profiles SET is_blocked = ?, updated_at = datetime('now') WHERE id = ?").run(nextBlocked, id);
  if (nextBlocked === 1) {
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id);
  }

  logAdminAction({
    adminId: req.user!.id,
    action: nextBlocked === 1 ? 'BLOCK_STUDENT' : 'UNBLOCK_STUDENT',
    targetType: 'profile',
    targetId: id,
    details: { student: row.full_name },
    ipAddress: req.ip,
  });

  res.json({ is_blocked: Boolean(nextBlocked) });
});

// CATEGORY MANAGEMENT
router.get('/categories', (_req: AuthRequest, res: Response) => {
  const categories = db
    .prepare(
      `SELECT cc.*, (SELECT COUNT(*) FROM courses c WHERE c.category_id = cc.id) as course_count
       FROM course_categories cc
       ORDER BY cc.sort_order ASC, cc.name ASC`
    )
    .all();
  res.json({ categories });
});

router.post('/categories', (req: AuthRequest, res: Response) => {
  const { name, name_bn, slug, description, sort_order } = req.body as Record<string, unknown>;
  if (!String(name || '').trim()) {
    res.status(400).json({ error: 'Category name is required.' });
    return;
  }
  const cleanSlug = slugify(String(slug || name)) || `cat-${Date.now()}`;
  const id = uuid();
  try {
    db.prepare(
      `INSERT INTO course_categories (id, name, name_bn, slug, description, sort_order)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      String(name).trim(),
      String(name_bn || '').trim(),
      cleanSlug,
      String(description || '').trim(),
      Number(sort_order || 0)
    );
    logAdminAction({
      adminId: req.user!.id,
      action: 'CREATE_CATEGORY',
      targetType: 'category',
      targetId: id,
      details: { name: String(name) },
      ipAddress: req.ip,
    });
    res.status(201).json({ id, slug: cleanSlug });
  } catch {
    res.status(409).json({ error: 'Category slug already exists.' });
  }
});

router.put('/categories/:id', (req: AuthRequest, res: Response) => {
  const id = String(req.params.id);
  const { name, name_bn, slug, description, sort_order } = req.body as Record<string, unknown>;
  if (!String(name || '').trim()) {
    res.status(400).json({ error: 'Category name is required.' });
    return;
  }
  db.prepare(
    `UPDATE course_categories SET name = ?, name_bn = ?, slug = ?, description = ?, sort_order = ? WHERE id = ?`
  ).run(
    String(name).trim(),
    String(name_bn || '').trim(),
    slugify(String(slug || name)),
    String(description || '').trim(),
    Number(sort_order || 0),
    id
  );
  res.json({ ok: true });
});

router.delete('/categories/:id', (req: AuthRequest, res: Response) => {
  db.prepare('DELETE FROM course_categories WHERE id = ?').run(String(req.params.id));
  res.json({ ok: true });
});

// COURSE MANAGEMENT
router.get('/courses', (_req: AuthRequest, res: Response) => {
  const rows = db
    .prepare(
      `SELECT c.*, cc.name as category_name,
              (SELECT COUNT(*) FROM chapters ch WHERE ch.course_id = c.id) as chapter_count,
              (SELECT COUNT(*) FROM lessons l WHERE l.course_id = c.id) as lesson_count,
              (SELECT COUNT(*) FROM enrollments e WHERE e.course_id = c.id AND e.status = 'active') as enrollment_count
       FROM courses c
       LEFT JOIN course_categories cc ON cc.id = c.category_id
       ORDER BY c.created_at DESC`
    )
    .all() as Record<string, unknown>[];
  res.json({ courses: rows.map((r) => ({ ...r, is_featured: Boolean(r.is_featured) })) });
});

router.post('/courses', (req: AuthRequest, res: Response) => {
  const body = req.body as Record<string, unknown>;
  const title = String(body.title || '').trim();
  const shortDesc = String(body.short_description || '').trim();
  const fullDesc = String(body.full_description || '').trim();
  const instructorName = String(body.instructor_name || '').trim();

  if (!title || !shortDesc || !instructorName) {
    res.status(400).json({ error: 'Course title, short description, and instructor name are required.' });
    return;
  }

  const courseId = uuid();
  const slug = slugify(String(body.slug || title)) || `course-${Date.now()}`;
  const instructorSlug = slugify(instructorName) || 'instructor';
  const price = Math.max(0, Number(body.price || 0));
  const discountPrice =
    body.discount_price !== '' && body.discount_price !== null && body.discount_price !== undefined
      ? Math.max(0, Number(body.discount_price))
      : null;

  try {
    db.exec('BEGIN IMMEDIATE');
    db.prepare(
      `INSERT INTO courses (
        id, title, title_bn, slug, thumbnail_url, short_description, short_description_bn,
        full_description, full_description_bn, category_id, price, discount_price,
        instructor_name, instructor_slug, instructor_title, instructor_bio,
        duration, level, language, status, is_featured
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      courseId,
      title,
      String(body.title_bn || '').trim(),
      slug,
      sanitizeExternalUrl(String(body.thumbnail_url || '')),
      shortDesc,
      String(body.short_description_bn || '').trim(),
      fullDesc || shortDesc,
      String(body.full_description_bn || '').trim(),
      body.category_id ? String(body.category_id) : null,
      price,
      discountPrice,
      instructorName,
      instructorSlug,
      String(body.instructor_title || 'Lead Instructor').trim(),
      String(body.instructor_bio || '').trim(),
      String(body.duration || 'Self-Paced').trim(),
      String(body.level || 'Beginner'),
      String(body.language || 'Bengali & English'),
      String(body.status || 'draft'),
      body.is_featured ? 1 : 0
    );

    // Ensure community_settings exists for every course
    db.prepare(
      `INSERT INTO community_settings (id, course_id, telegram_link, whatsapp_link, telegram_required, whatsapp_required, instructions)
       VALUES (?, ?, '', '', 1, 1, 'Join both the Telegram channel and WhatsApp group, then submit verification details.')`
    ).run(uuid(), courseId);

    logAdminAction({
      adminId: req.user!.id,
      action: 'CREATE_COURSE',
      targetType: 'course',
      targetId: courseId,
      details: { title, slug },
      ipAddress: req.ip,
    });
    db.exec('COMMIT');

    res.status(201).json({ id: courseId, slug });
  } catch {
    try {
      db.exec('ROLLBACK');
    } catch {
      // ignore
    }
    res.status(409).json({ error: 'Course slug already exists. Choose a unique slug.' });
  }
});

router.put('/courses/:id', (req: AuthRequest, res: Response) => {
  const id = String(req.params.id);
  const body = req.body as Record<string, unknown>;
  const existing = db.prepare('SELECT id, status, title FROM courses WHERE id = ?').get(id) as
    | { id: string; status: string; title: string }
    | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Course not found.' });
    return;
  }

  const title = String(body.title || existing.title).trim();
  const slug = slugify(String(body.slug || title));
  const instructorName = String(body.instructor_name || 'Instructor').trim();
  const price = Math.max(0, Number(body.price || 0));
  const discountPrice =
    body.discount_price !== '' && body.discount_price !== null && body.discount_price !== undefined
      ? Math.max(0, Number(body.discount_price))
      : null;
  const nextStatus = String(body.status || 'draft');

  db.prepare(
    `UPDATE courses
     SET title = ?, title_bn = ?, slug = ?, thumbnail_url = ?,
         short_description = ?, short_description_bn = ?,
         full_description = ?, full_description_bn = ?,
         category_id = ?, price = ?, discount_price = ?,
         instructor_name = ?, instructor_slug = ?, instructor_title = ?, instructor_bio = ?,
         duration = ?, level = ?, language = ?, status = ?, is_featured = ?,
         updated_at = datetime('now')
     WHERE id = ?`
  ).run(
    title,
    String(body.title_bn || '').trim(),
    slug,
    sanitizeExternalUrl(String(body.thumbnail_url || '')),
    String(body.short_description || '').trim(),
    String(body.short_description_bn || '').trim(),
    String(body.full_description || '').trim(),
    String(body.full_description_bn || '').trim(),
    body.category_id ? String(body.category_id) : null,
    price,
    discountPrice,
    instructorName,
    slugify(instructorName) || 'instructor',
    String(body.instructor_title || '').trim(),
    String(body.instructor_bio || '').trim(),
    String(body.duration || '').trim(),
    String(body.level || 'Beginner'),
    String(body.language || 'Bengali & English'),
    nextStatus,
    body.is_featured ? 1 : 0,
    id
  );

  // If transitioning from draft to published, announce to students
  if (existing.status !== 'published' && nextStatus === 'published') {
    const studentIds = db
      .prepare("SELECT user_id FROM user_roles WHERE role = 'student'")
      .all() as { user_id: string }[];
    for (const s of studentIds) {
      createNotification({
        userId: s.user_id,
        eventType: 'new_course',
        title: `New Course Published: ${title}`,
        message: 'A new course is now open for enrollment at SERA ACADEMY.',
        link: `/courses/${slug}`,
      });
    }
  }

  logAdminAction({
    adminId: req.user!.id,
    action: 'UPDATE_COURSE',
    targetType: 'course',
    targetId: id,
    details: { title, status: nextStatus },
    ipAddress: req.ip,
  });

  res.json({ ok: true });
});

router.delete('/courses/:id', (req: AuthRequest, res: Response) => {
  const id = String(req.params.id);
  db.prepare('DELETE FROM courses WHERE id = ?').run(id);
  logAdminAction({
    adminId: req.user!.id,
    action: 'DELETE_COURSE',
    targetType: 'course',
    targetId: id,
    ipAddress: req.ip,
  });
  res.json({ ok: true });
});

// CURRICULUM (CHAPTERS, LESSONS, RESOURCES)
router.get('/courses/:id/curriculum', (req: AuthRequest, res: Response) => {
  const courseId = String(req.params.id);
  const chapters = db
    .prepare('SELECT * FROM chapters WHERE course_id = ? ORDER BY sort_order ASC, created_at ASC')
    .all(courseId) as Record<string, unknown>[];
  const lessons = db
    .prepare('SELECT * FROM lessons WHERE course_id = ? ORDER BY sort_order ASC, created_at ASC')
    .all(courseId) as Record<string, unknown>[];
  const resources = db
    .prepare('SELECT * FROM lesson_resources WHERE course_id = ? ORDER BY created_at ASC')
    .all(courseId) as Record<string, unknown>[];

  res.json({
    chapters: chapters.map((ch) => ({
      ...ch,
      lessons: lessons
        .filter((l) => l.chapter_id === ch.id)
        .map((l) => ({
          ...l,
          is_free_preview: Boolean(l.is_free_preview),
          has_video: Boolean(l.video_storage_path),
          resources: resources.filter((r) => r.lesson_id === l.id),
        })),
    })),
  });
});

router.post('/chapters', (req: AuthRequest, res: Response) => {
  const { course_id, title, title_bn, sort_order } = req.body as Record<string, unknown>;
  if (!course_id || !String(title || '').trim()) {
    res.status(400).json({ error: 'Course ID and chapter title are required.' });
    return;
  }
  const id = uuid();
  const maxOrder = (
    db.prepare('SELECT COALESCE(MAX(sort_order), 0) as m FROM chapters WHERE course_id = ?').get(String(course_id)) as {
      m: number;
    }
  ).m;

  db.prepare(
    `INSERT INTO chapters (id, course_id, title, title_bn, sort_order) VALUES (?, ?, ?, ?, ?)`
  ).run(
    id,
    String(course_id),
    String(title).trim(),
    String(title_bn || '').trim(),
    typeof sort_order === 'number' ? sort_order : maxOrder + 1
  );
  res.status(201).json({ id });
});

router.put('/chapters/:id', (req: AuthRequest, res: Response) => {
  const { title, title_bn, sort_order } = req.body as Record<string, unknown>;
  db.prepare('UPDATE chapters SET title = ?, title_bn = ?, sort_order = ? WHERE id = ?').run(
    String(title || '').trim(),
    String(title_bn || '').trim(),
    Number(sort_order || 1),
    String(req.params.id)
  );
  res.json({ ok: true });
});

router.delete('/chapters/:id', (req: AuthRequest, res: Response) => {
  db.prepare('DELETE FROM chapters WHERE id = ?').run(String(req.params.id));
  res.json({ ok: true });
});

router.post('/chapters/reorder', (req: AuthRequest, res: Response) => {
  const { ordered_ids } = req.body as { ordered_ids?: string[] };
  if (!Array.isArray(ordered_ids)) {
    res.status(400).json({ error: 'ordered_ids array is required.' });
    return;
  }
  const stmt = db.prepare('UPDATE chapters SET sort_order = ? WHERE id = ?');
  ordered_ids.forEach((cid, idx) => stmt.run(idx + 1, cid));
  res.json({ ok: true });
});

router.post('/lessons', (req: AuthRequest, res: Response) => {
  const { course_id, chapter_id, title, title_bn, description, duration_seconds, is_free_preview } =
    req.body as Record<string, unknown>;

  if (!course_id || !chapter_id || !String(title || '').trim()) {
    res.status(400).json({ error: 'Course, chapter, and lesson title are required.' });
    return;
  }

  const maxOrder = (
    db
      .prepare('SELECT COALESCE(MAX(sort_order), 0) as m FROM lessons WHERE chapter_id = ?')
      .get(String(chapter_id)) as { m: number }
  ).m;

  const id = uuid();
  db.prepare(
    `INSERT INTO lessons (id, course_id, chapter_id, title, title_bn, description, duration_seconds, is_free_preview, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    String(course_id),
    String(chapter_id),
    String(title).trim(),
    String(title_bn || '').trim(),
    String(description || '').trim(),
    Math.max(0, Number(duration_seconds || 0)),
    is_free_preview ? 1 : 0,
    maxOrder + 1
  );

  // Notify enrolled students of new lesson
  const enrolledStudents = db
    .prepare("SELECT user_id FROM enrollments WHERE course_id = ? AND status = 'active'")
    .all(String(course_id)) as { user_id: string }[];
  for (const e of enrolledStudents) {
    createNotification({
      userId: e.user_id,
      eventType: 'new_lesson',
      title: 'New Lesson Added',
      message: `Lesson "${String(title).trim()}" is now available in your course.`,
      link: '/student/courses',
    });
  }

  res.status(201).json({ id });
});

router.put('/lessons/:id', (req: AuthRequest, res: Response) => {
  const { title, title_bn, description, duration_seconds, is_free_preview, sort_order } =
    req.body as Record<string, unknown>;
  db.prepare(
    `UPDATE lessons
     SET title = ?, title_bn = ?, description = ?, duration_seconds = ?, is_free_preview = ?, sort_order = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(
    String(title || '').trim(),
    String(title_bn || '').trim(),
    String(description || '').trim(),
    Math.max(0, Number(duration_seconds || 0)),
    is_free_preview ? 1 : 0,
    Number(sort_order || 1),
    String(req.params.id)
  );
  res.json({ ok: true });
});

router.delete('/lessons/:id', (req: AuthRequest, res: Response) => {
  db.prepare('DELETE FROM lessons WHERE id = ?').run(String(req.params.id));
  res.json({ ok: true });
});

router.post('/lessons/reorder', (req: AuthRequest, res: Response) => {
  const { ordered_ids } = req.body as { ordered_ids?: string[] };
  if (!Array.isArray(ordered_ids)) {
    res.status(400).json({ error: 'ordered_ids array is required.' });
    return;
  }
  const stmt = db.prepare('UPDATE lessons SET sort_order = ? WHERE id = ?');
  ordered_ids.forEach((lid, idx) => stmt.run(idx + 1, lid));
  res.json({ ok: true });
});

// Upload Private Video for Lesson (local confined private storage or Supabase Private Storage)
router.post('/lessons/:id/video', uploadVideo.single('video'), async (req: AuthRequest, res: Response) => {
  const lessonId = String(req.params.id);
  const file = req.file;
  if (!file) {
    res.status(400).json({ error: 'Valid MP4, WebM, or MOV video file is required.' });
    return;
  }

  const lesson = db.prepare('SELECT id, video_storage_path FROM lessons WHERE id = ?').get(lessonId) as
    | { id: string; video_storage_path: string }
    | undefined;
  if (!lesson) {
    fs.unlinkSync(file.path);
    res.status(404).json({ error: 'Lesson not found.' });
    return;
  }

  let storedPath = file.filename;

  // Optional Supabase Private Storage sync
  if (isSupabaseConfigured()) {
    const sb = getSupabaseAdmin();
    const bucket = process.env.SUPABASE_VIDEO_BUCKET?.trim() || 'course-videos';
    if (sb) {
      const objectPath = `lessons/${lessonId}/${file.filename}`;
      const buffer = fs.readFileSync(file.path);
      const { error } = await sb.storage.from(bucket).upload(objectPath, buffer, {
        contentType: file.mimetype,
        upsert: true,
      });
      if (!error) {
        storedPath = `supabase:${objectPath}`;
        fs.unlinkSync(file.path);
      }
    }
  }

  // Delete previous private video file if replaced (never delete shared seeded samples)
  if (
    lesson.video_storage_path &&
    !lesson.video_storage_path.startsWith('supabase:') &&
    !['lesson_intro.mp4', 'lesson_deep_dive.mp4'].includes(lesson.video_storage_path)
  ) {
    const oldResolved = resolveConfinedPath(PRIVATE_VIDEOS_DIR, lesson.video_storage_path);
    if (oldResolved && fs.existsSync(oldResolved)) {
      fs.unlinkSync(oldResolved);
    }
  }

  db.prepare("UPDATE lessons SET video_storage_path = ?, updated_at = datetime('now') WHERE id = ?").run(
    storedPath,
    lessonId
  );

  logAdminAction({
    adminId: req.user!.id,
    action: 'UPLOAD_LESSON_VIDEO',
    targetType: 'lesson',
    targetId: lessonId,
    details: { sizeBytes: file.size },
    ipAddress: req.ip,
  });

  res.json({ ok: true, has_video: true });
});

router.delete('/lessons/:id/video', (req: AuthRequest, res: Response) => {
  const lessonId = String(req.params.id);
  const lesson = db.prepare('SELECT id, video_storage_path FROM lessons WHERE id = ?').get(lessonId) as
    | { id: string; video_storage_path: string }
    | undefined;
  if (!lesson) {
    res.status(404).json({ error: 'Lesson not found.' });
    return;
  }

  if (
    lesson.video_storage_path &&
    !lesson.video_storage_path.startsWith('supabase:') &&
    !['lesson_intro.mp4', 'lesson_deep_dive.mp4'].includes(lesson.video_storage_path)
  ) {
    const resolved = resolveConfinedPath(PRIVATE_VIDEOS_DIR, lesson.video_storage_path);
    if (resolved && fs.existsSync(resolved)) fs.unlinkSync(resolved);
  }

  db.prepare("UPDATE lessons SET video_storage_path = '', updated_at = datetime('now') WHERE id = ?").run(lessonId);
  res.json({ ok: true });
});

// Upload Private PDF/ZIP Resource for Lesson
router.post('/lessons/:id/resources', uploadResource.single('resource'), async (req: AuthRequest, res: Response) => {
  const lessonId = String(req.params.id);
  const file = req.file;
  const title = String(req.body?.title || file?.originalname || 'Lesson Workbook').trim();
  if (!file) {
    res.status(400).json({ error: 'Valid PDF, ZIP, or text file is required.' });
    return;
  }

  const lesson = db.prepare('SELECT id, course_id FROM lessons WHERE id = ?').get(lessonId) as
    | { id: string; course_id: string }
    | undefined;
  if (!lesson) {
    fs.unlinkSync(file.path);
    res.status(404).json({ error: 'Lesson not found.' });
    return;
  }

  let storedPath = file.filename;
  if (isSupabaseConfigured()) {
    const sb = getSupabaseAdmin();
    const bucket = process.env.SUPABASE_RESOURCE_BUCKET?.trim() || 'course-resources';
    if (sb) {
      const objectPath = `resources/${lessonId}/${file.filename}`;
      const buffer = fs.readFileSync(file.path);
      const { error } = await sb.storage.from(bucket).upload(objectPath, buffer, {
        contentType: file.mimetype,
        upsert: true,
      });
      if (!error) {
        storedPath = `supabase:${objectPath}`;
        fs.unlinkSync(file.path);
      }
    }
  }

  const id = uuid();
  db.prepare(
    `INSERT INTO lesson_resources (id, lesson_id, course_id, title, file_storage_path, file_size_bytes, mime_type)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, lessonId, lesson.course_id, title, storedPath, file.size, file.mimetype);

  res.status(201).json({ id, title, file_size_bytes: file.size });
});

router.delete('/resources/:id', (req: AuthRequest, res: Response) => {
  const id = String(req.params.id);
  const resRow = db.prepare('SELECT file_storage_path FROM lesson_resources WHERE id = ?').get(id) as
    | { file_storage_path: string }
    | undefined;
  if (
    resRow &&
    !resRow.file_storage_path.startsWith('supabase:') &&
    resRow.file_storage_path !== 'course_workbook.pdf'
  ) {
    const resolved = resolveConfinedPath(PRIVATE_RESOURCES_DIR, resRow.file_storage_path);
    if (resolved && fs.existsSync(resolved)) fs.unlinkSync(resolved);
  }
  db.prepare('DELETE FROM lesson_resources WHERE id = ?').run(id);
  res.json({ ok: true });
});

// Public Image Upload (thumbnails, logo, favicon, hero banner)
router.post('/upload/image', uploadImage.single('image'), (req: AuthRequest, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: 'Valid image file (JPG, PNG, WebP, SVG) is required.' });
    return;
  }
  res.status(201).json({ url: `/uploads/public/${req.file.filename}` });
});

// PAYMENT VERIFICATION MANAGEMENT
router.get('/payments', (req: AuthRequest, res: Response) => {
  const status = String(req.query.status || 'all').trim();
  const q = String(req.query.q || '').trim().toLowerCase();

  let sql = `
    SELECT pay.*, p.full_name as student_name, p.email as student_email, p.phone as student_phone,
           c.title as course_title, c.slug as course_slug
    FROM payments pay
    JOIN profiles p ON p.id = pay.user_id
    JOIN courses c ON c.id = pay.course_id
    WHERE 1=1
  `;
  const params: string[] = [];
  if (status !== 'all') {
    sql += ` AND pay.status = ?`;
    params.push(status);
  }
  if (q) {
    sql += ` AND (LOWER(pay.transaction_id) LIKE ? OR LOWER(p.full_name) LIKE ? OR LOWER(p.email) LIKE ? OR LOWER(pay.payer_phone) LIKE ?)`;
    const pat = `%${q}%`;
    params.push(pat, pat, pat, pat);
  }
  sql += ` ORDER BY pay.created_at DESC`;

  res.json({ payments: db.prepare(sql).all(...params) });
});

router.post('/payments/:id/approve', (req: AuthRequest, res: Response) => {
  const paymentId = String(req.params.id);

  db.exec('BEGIN IMMEDIATE');
  try {
    const payment = db
      .prepare(
        `SELECT pay.*, c.title as course_title, c.slug as course_slug
         FROM payments pay
         JOIN courses c ON c.id = pay.course_id
         WHERE pay.id = ?`
      )
      .get(paymentId) as
      | {
          id: string;
          user_id: string;
          course_id: string;
          amount: number;
          transaction_id: string;
          status: string;
          course_title: string;
          course_slug: string;
        }
      | undefined;

    if (!payment) {
      db.exec('ROLLBACK');
      res.status(404).json({ error: 'Payment record not found.' });
      return;
    }
    if (payment.status === 'approved') {
      db.exec('ROLLBACK');
      res.status(409).json({ error: 'Payment is already approved.' });
      return;
    }

    db.prepare(
      `UPDATE payments
       SET status = 'approved', rejection_reason = '', reviewed_by = ?, reviewed_at = datetime('now')
       WHERE id = ?`
    ).run(req.user!.id, payment.id);

    // Create or re-activate enrollment
    const existingEnroll = db
      .prepare('SELECT id FROM enrollments WHERE user_id = ? AND course_id = ?')
      .get(payment.user_id, payment.course_id) as { id: string } | undefined;

    if (existingEnroll) {
      db.prepare("UPDATE enrollments SET status = 'active', payment_id = ? WHERE id = ?").run(
        payment.id,
        existingEnroll.id
      );
    } else {
      db.prepare(
        `INSERT INTO enrollments (id, user_id, course_id, payment_id, status)
         VALUES (?, ?, ?, ?, 'active')`
      ).run(uuid(), payment.user_id, payment.course_id, payment.id);
    }

    // Ensure community membership tracking row exists
    const existingComm = db
      .prepare('SELECT id FROM community_memberships WHERE user_id = ? AND course_id = ?')
      .get(payment.user_id, payment.course_id);
    if (!existingComm) {
      db.prepare(
        `INSERT INTO community_memberships (id, user_id, course_id) VALUES (?, ?, ?)`
      ).run(uuid(), payment.user_id, payment.course_id);
    }

    createNotification({
      userId: payment.user_id,
      eventType: 'payment_approved',
      title: 'Payment Approved — Enrollment Active',
      message: `Your payment (${payment.transaction_id}) for "${payment.course_title}" is approved. Complete Telegram & WhatsApp verification to unlock lessons.`,
      link: '/student/community',
    });

    logAdminAction({
      adminId: req.user!.id,
      action: 'APPROVE_PAYMENT',
      targetType: 'payment',
      targetId: payment.id,
      details: { transaction_id: payment.transaction_id, amount: payment.amount, course: payment.course_title },
      ipAddress: req.ip,
    });

    db.exec('COMMIT');
    res.json({ ok: true, message: 'Payment approved and student enrolled.' });
  } catch {
    try {
      db.exec('ROLLBACK');
    } catch {
      // ignore
    }
    res.status(500).json({ error: 'Failed to approve payment.' });
  }
});

router.post('/payments/:id/reject', (req: AuthRequest, res: Response) => {
  const paymentId = String(req.params.id);
  const { rejection_reason } = req.body as { rejection_reason?: string };
  if (!rejection_reason?.trim()) {
    res.status(400).json({ error: 'Please provide a clear rejection reason.' });
    return;
  }

  const payment = db
    .prepare(
      `SELECT pay.*, c.title as course_title
       FROM payments pay JOIN courses c ON c.id = pay.course_id WHERE pay.id = ?`
    )
    .get(paymentId) as
    | { id: string; user_id: string; course_id: string; transaction_id: string; course_title: string }
    | undefined;

  if (!payment) {
    res.status(404).json({ error: 'Payment record not found.' });
    return;
  }

  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare(
      `UPDATE payments
       SET status = 'rejected', rejection_reason = ?, reviewed_by = ?, reviewed_at = datetime('now')
       WHERE id = ?`
    ).run(rejection_reason.trim(), req.user!.id, paymentId);

    // Revoke enrollment if any existed from this payment
    db.prepare("UPDATE enrollments SET status = 'revoked' WHERE payment_id = ?").run(paymentId);

    createNotification({
      userId: payment.user_id,
      eventType: 'payment_rejected',
      title: 'Payment Verification Issue',
      message: `Your payment (${payment.transaction_id}) for "${payment.course_title}" was rejected: ${rejection_reason.trim()}`,
      link: '/student/payments',
    });

    logAdminAction({
      adminId: req.user!.id,
      action: 'REJECT_PAYMENT',
      targetType: 'payment',
      targetId: paymentId,
      details: { transaction_id: payment.transaction_id, reason: rejection_reason.trim() },
      ipAddress: req.ip,
    });
    db.exec('COMMIT');
    res.json({ ok: true });
  } catch {
    try {
      db.exec('ROLLBACK');
    } catch {
      // ignore
    }
    res.status(500).json({ error: 'Failed to reject payment.' });
  }
});

// COMMUNITY MANAGEMENT
router.get('/community', (_req: AuthRequest, res: Response) => {
  const settings = db
    .prepare(
      `SELECT cs.*, c.title as course_title, c.slug as course_slug
       FROM community_settings cs
       JOIN courses c ON c.id = cs.course_id
       ORDER BY c.title ASC`
    )
    .all() as Record<string, unknown>[];

  const memberships = db
    .prepare(
      `SELECT cm.*, p.full_name as student_name, p.email as student_email, p.phone as student_phone,
              c.title as course_title, c.slug as course_slug
       FROM community_memberships cm
       JOIN profiles p ON p.id = cm.user_id
       JOIN courses c ON c.id = cm.course_id
       ORDER BY cm.updated_at DESC`
    )
    .all();

  res.json({
    settings: settings.map((s) => ({
      ...s,
      telegram_required: Boolean(s.telegram_required),
      whatsapp_required: Boolean(s.whatsapp_required),
    })),
    memberships,
  });
});

router.put('/community/settings/:courseId', (req: AuthRequest, res: Response) => {
  const courseId = String(req.params.courseId);
  const {
    telegram_link,
    telegram_chat_id,
    telegram_required,
    whatsapp_link,
    whatsapp_required,
    instructions,
    instructions_bn,
  } = req.body as Record<string, unknown>;

  const existing = db.prepare('SELECT id FROM community_settings WHERE course_id = ?').get(courseId);
  if (existing) {
    db.prepare(
      `UPDATE community_settings
       SET telegram_link = ?, telegram_chat_id = ?, telegram_required = ?,
           whatsapp_link = ?, whatsapp_required = ?, instructions = ?, instructions_bn = ?,
           updated_at = datetime('now')
       WHERE course_id = ?`
    ).run(
      sanitizeExternalUrl(String(telegram_link || '')),
      String(telegram_chat_id || '').trim(),
      telegram_required ? 1 : 0,
      sanitizeExternalUrl(String(whatsapp_link || '')),
      whatsapp_required ? 1 : 0,
      String(instructions || '').trim(),
      String(instructions_bn || '').trim(),
      courseId
    );
  } else {
    db.prepare(
      `INSERT INTO community_settings (id, course_id, telegram_link, telegram_chat_id, telegram_required, whatsapp_link, whatsapp_required, instructions, instructions_bn)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      uuid(),
      courseId,
      sanitizeExternalUrl(String(telegram_link || '')),
      String(telegram_chat_id || '').trim(),
      telegram_required ? 1 : 0,
      sanitizeExternalUrl(String(whatsapp_link || '')),
      whatsapp_required ? 1 : 0,
      String(instructions || '').trim(),
      String(instructions_bn || '').trim()
    );
  }

  logAdminAction({
    adminId: req.user!.id,
    action: 'UPDATE_COMMUNITY_SETTINGS',
    targetType: 'course',
    targetId: courseId,
    ipAddress: req.ip,
  });

  res.json({ ok: true });
});

router.post('/community/memberships/:id/verify', (req: AuthRequest, res: Response) => {
  const id = String(req.params.id);
  const { telegram_status, whatsapp_status } = req.body as {
    telegram_status?: 'not_joined' | 'pending_verification' | 'verified';
    whatsapp_status?: 'not_joined' | 'pending_verification' | 'verified';
  };

  const row = db
    .prepare(
      `SELECT cm.*, c.title as course_title, c.slug as course_slug
       FROM community_memberships cm
       JOIN courses c ON c.id = cm.course_id
       WHERE cm.id = ?`
    )
    .get(id) as
    | {
        id: string;
        user_id: string;
        course_id: string;
        telegram_status: string;
        whatsapp_status: string;
        course_title: string;
        course_slug: string;
      }
    | undefined;

  if (!row) {
    res.status(404).json({ error: 'Community membership record not found.' });
    return;
  }

  const nextTg = telegram_status || row.telegram_status;
  const nextWa = whatsapp_status || row.whatsapp_status;

  db.prepare(
    `UPDATE community_memberships
     SET telegram_status = ?, whatsapp_status = ?, verified_by = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(nextTg, nextWa, req.user!.id, id);

  if (nextTg === 'verified' && nextWa === 'verified') {
    createNotification({
      userId: row.user_id,
      eventType: 'course_access_granted',
      title: 'Classroom Unlocked',
      message: `Both Telegram and WhatsApp memberships are verified for "${row.course_title}". You can now enter the private classroom.`,
      link: `/student/classroom/${row.course_slug}`,
    });
  } else {
    createNotification({
      userId: row.user_id,
      eventType: 'community_update',
      title: 'Community Verification Updated',
      message: `Your community status for "${row.course_title}" is now Telegram: ${nextTg}, WhatsApp: ${nextWa}.`,
      link: '/student/community',
    });
  }

  logAdminAction({
    adminId: req.user!.id,
    action: 'UPDATE_COMMUNITY_VERIFICATION',
    targetType: 'community_membership',
    targetId: id,
    details: { telegram_status: nextTg, whatsapp_status: nextWa },
    ipAddress: req.ip,
  });

  res.json({ ok: true });
});

// NOTIFICATIONS BROADCAST
router.post('/notifications/broadcast', (req: AuthRequest, res: Response) => {
  const { target_scope, course_id, user_id, event_type, title, message, link } =
    req.body as Record<string, string>;

  if (!title?.trim() || !message?.trim()) {
    res.status(400).json({ error: 'Notification title and message are required.' });
    return;
  }

  let recipientIds: string[] = [];
  if (target_scope === 'all_students') {
    recipientIds = (
      db.prepare("SELECT user_id FROM user_roles WHERE role = 'student'").all() as { user_id: string }[]
    ).map((r) => r.user_id);
  } else if (target_scope === 'course' && course_id) {
    recipientIds = (
      db
        .prepare("SELECT user_id FROM enrollments WHERE course_id = ? AND status = 'active'")
        .all(course_id) as { user_id: string }[]
    ).map((r) => r.user_id);
  } else if (target_scope === 'user' && user_id) {
    recipientIds = [user_id];
  } else {
    res.status(400).json({ error: 'Invalid broadcast target.' });
    return;
  }

  for (const uid of recipientIds) {
    createNotification({
      userId: uid,
      eventType: event_type || 'announcement',
      title: title.trim(),
      message: message.trim(),
      link: link || '/student/notifications',
    });
  }

  logAdminAction({
    adminId: req.user!.id,
    action: 'BROADCAST_NOTIFICATION',
    targetType: target_scope || 'all',
    targetId: course_id || user_id || 'all',
    details: { recipients: recipientIds.length, title },
    ipAddress: req.ip,
  });

  res.json({ ok: true, count: recipientIds.length });
});

// WEBSITE & PAYMENT SETTINGS
router.get('/settings', (_req: AuthRequest, res: Response) => {
  res.json({ settings: getWebsiteSettings() });
});

router.put('/settings', (req: AuthRequest, res: Response) => {
  const b = req.body as Record<string, unknown>;
  db.prepare(
    `UPDATE website_settings SET
      site_name = ?, logo_url = ?, favicon_url = ?, primary_color = ?, accent_color = ?,
      hero_title = ?, hero_title_bn = ?, hero_subtitle = ?, hero_subtitle_bn = ?,
      hero_cta_text = ?, hero_cta_text_bn = ?, hero_banner_url = ?,
      about_title = ?, about_text = ?, about_text_bn = ?,
      stats_json = ?, why_choose_json = ?, testimonials_json = ?, faq_json = ?,
      contact_email = ?, contact_phone = ?, contact_address = ?, footer_text = ?,
      bkash_number = ?, bkash_enabled = ?, nagad_number = ?, nagad_enabled = ?,
      payment_instructions = ?, payment_instructions_bn = ?,
      whatsapp_support_link = ?, email_support_address = ?, facebook_page_link = ?, telegram_support_link = ?,
      updated_at = datetime('now')
     WHERE id = 1`
  ).run(
    String(b.site_name || 'SERA ACADEMY').trim(),
    sanitizeExternalUrl(String(b.logo_url || '')),
    sanitizeExternalUrl(String(b.favicon_url || '')),
    String(b.primary_color || '#0B1F3A').trim(),
    String(b.accent_color || '#C89B3C').trim(),
    String(b.hero_title || '').trim(),
    String(b.hero_title_bn || '').trim(),
    String(b.hero_subtitle || '').trim(),
    String(b.hero_subtitle_bn || '').trim(),
    String(b.hero_cta_text || '').trim(),
    String(b.hero_cta_text_bn || '').trim(),
    sanitizeExternalUrl(String(b.hero_banner_url || '')),
    String(b.about_title || '').trim(),
    String(b.about_text || '').trim(),
    String(b.about_text_bn || '').trim(),
    JSON.stringify(Array.isArray(b.stats_json) ? b.stats_json : []),
    JSON.stringify(Array.isArray(b.why_choose_json) ? b.why_choose_json : []),
    JSON.stringify(Array.isArray(b.testimonials_json) ? b.testimonials_json : []),
    JSON.stringify(Array.isArray(b.faq_json) ? b.faq_json : []),
    String(b.contact_email || '').trim(),
    String(b.contact_phone || '').trim(),
    String(b.contact_address || '').trim(),
    String(b.footer_text || '').trim(),
    String(b.bkash_number || '').trim(),
    b.bkash_enabled ? 1 : 0,
    String(b.nagad_number || '').trim(),
    b.nagad_enabled ? 1 : 0,
    String(b.payment_instructions || '').trim(),
    String(b.payment_instructions_bn || '').trim(),
    sanitizeExternalUrl(String(b.whatsapp_support_link || '')),
    String(b.email_support_address || '').trim(),
    sanitizeExternalUrl(String(b.facebook_page_link || '')),
    sanitizeExternalUrl(String(b.telegram_support_link || ''))
  );

  logAdminAction({
    adminId: req.user!.id,
    action: 'UPDATE_WEBSITE_SETTINGS',
    targetType: 'website_settings',
    targetId: '1',
    ipAddress: req.ip,
  });

  res.json({ settings: getWebsiteSettings() });
});

// SUPPORT MANAGEMENT
router.get('/support', (_req: AuthRequest, res: Response) => {
  const messages = db.prepare('SELECT * FROM support_messages ORDER BY created_at DESC').all();
  res.json({ messages });
});

router.post('/support/:id/reply', (req: AuthRequest, res: Response) => {
  const id = String(req.params.id);
  const { admin_reply, status } = req.body as { admin_reply?: string; status?: 'replied' | 'closed' };
  if (!admin_reply?.trim()) {
    res.status(400).json({ error: 'Reply message cannot be empty.' });
    return;
  }

  const ticket = db.prepare('SELECT id, user_id, subject FROM support_messages WHERE id = ?').get(id) as
    | { id: string; user_id: string | null; subject: string }
    | undefined;
  if (!ticket) {
    res.status(404).json({ error: 'Support ticket not found.' });
    return;
  }

  db.prepare(
    `UPDATE support_messages
     SET admin_reply = ?, status = ?, replied_by = ?, replied_at = datetime('now')
     WHERE id = ?`
  ).run(admin_reply.trim(), status || 'replied', req.user!.id, id);

  if (ticket.user_id) {
    createNotification({
      userId: ticket.user_id,
      eventType: 'support_reply',
      title: `Support Reply: ${ticket.subject}`,
      message: admin_reply.trim().slice(0, 160),
      link: '/student/support',
    });
  }

  logAdminAction({
    adminId: req.user!.id,
    action: 'REPLY_SUPPORT_TICKET',
    targetType: 'support_message',
    targetId: id,
    ipAddress: req.ip,
  });

  res.json({ ok: true });
});

// REPORTS
router.get('/reports', (_req: AuthRequest, res: Response) => {
  const revenueByMethod = db
    .prepare(
      `SELECT payment_method, COUNT(*) as count, COALESCE(SUM(amount), 0) as revenue
       FROM payments WHERE status = 'approved'
       GROUP BY payment_method`
    )
    .all();

  const coursePerformance = db
    .prepare(
      `SELECT c.id, c.title, c.price, c.discount_price, c.status,
              (SELECT COUNT(*) FROM enrollments e WHERE e.course_id = c.id AND e.status = 'active') as enrollments,
              (SELECT COALESCE(SUM(pay.amount), 0) FROM payments pay WHERE pay.course_id = c.id AND pay.status = 'approved') as revenue
       FROM courses c
       ORDER BY revenue DESC, enrollments DESC`
    )
    .all();

  const monthlyRevenue = db
    .prepare(
      `SELECT substr(created_at, 1, 7) as month, COUNT(*) as approved_count, COALESCE(SUM(amount), 0) as total
       FROM payments WHERE status = 'approved'
       GROUP BY substr(created_at, 1, 7)
       ORDER BY month DESC
       LIMIT 12`
    )
    .all();

  res.json({ revenueByMethod, coursePerformance, monthlyRevenue });
});

// SECURITY & AUDIT LOGS
router.get('/security', (req: AuthRequest, res: Response) => {
  const logs = db
    .prepare(
      `SELECT l.*, p.full_name as admin_name, p.email as admin_email
       FROM admin_activity_logs l
       JOIN profiles p ON p.id = l.admin_id
       ORDER BY l.created_at DESC
       LIMIT 80`
    )
    .all();

  const activeSessions = db
    .prepare(
      `SELECT s.id, s.user_agent, s.ip_address, s.created_at, s.expires_at,
              p.email, p.full_name, ur.role
       FROM sessions s
       JOIN profiles p ON p.id = s.user_id
       LEFT JOIN user_roles ur ON ur.user_id = p.id
       ORDER BY s.created_at DESC
       LIMIT 30`
    )
    .all();

  res.json({
    logs,
    activeSessions: activeSessions.map((s) => ({
      ...(s as Record<string, unknown>),
      isCurrent: (s as Record<string, unknown>).id === req.sessionId,
    })),
    integrations: {
      supabaseConfigured: isSupabaseConfigured(),
      telegramBotConfigured: Boolean(process.env.TELEGRAM_BOT_TOKEN?.trim()),
      sessionSecretConfigured: Boolean(process.env.SESSION_SECRET?.trim()),
    },
  });
});

router.post('/security/revoke-sessions', (req: AuthRequest, res: Response) => {
  db.prepare('DELETE FROM sessions WHERE id <> ?').run(req.sessionId || '');
  logAdminAction({
    adminId: req.user!.id,
    action: 'REVOKE_OTHER_SESSIONS',
    targetType: 'session',
    targetId: 'all_others',
    ipAddress: req.ip,
  });
  res.json({ ok: true, message: 'All other active sessions have been revoked.' });
});

export default router;
