import { Router, type Response } from 'express';
import { db, uuid, checkCourseAccess, createNotification, getWebsiteSettings } from '../db.ts';
import { requireAuth, type AuthRequest } from '../middleware.ts';
import { createSignedMediaToken, rateLimit, validateBdPhone } from '../security.ts';
import { createSupabaseSignedUrl, isSupabaseConfigured, verifyTelegramBotMembership } from '../supabase.ts';

const router = Router();

router.use(requireAuth);

// Student Dashboard Overview (enrollments, payments, notifications, community summary)
router.get('/dashboard', (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;

  const enrollmentRows = db
    .prepare(
      `SELECT e.id as enrollment_id, e.status as enrollment_status, e.enrolled_at,
              c.*, cc.name as category_name, cc.name_bn as category_name_bn
       FROM enrollments e
       JOIN courses c ON c.id = e.course_id
       LEFT JOIN course_categories cc ON cc.id = c.category_id
       WHERE e.user_id = ? AND e.status = 'active'
       ORDER BY e.enrolled_at DESC`
    )
    .all(userId) as Record<string, unknown>[];

  const enrollments = enrollmentRows.map((row) => {
    const courseId = String(row.id);
    const totalLessons = (
      db.prepare('SELECT COUNT(*) as cnt FROM lessons WHERE course_id = ?').get(courseId) as { cnt: number }
    ).cnt;
    const completedLessons = (
      db
        .prepare(
          'SELECT COUNT(*) as cnt FROM lesson_progress WHERE user_id = ? AND course_id = ? AND completed = 1'
        )
        .get(userId, courseId) as { cnt: number }
    ).cnt;
    const access = checkCourseAccess(userId, courseId);

    const community = db
      .prepare(
        `SELECT cm.*, cs.telegram_link, cs.whatsapp_link, cs.telegram_required, cs.whatsapp_required,
                cs.instructions, cs.instructions_bn
         FROM community_memberships cm
         LEFT JOIN community_settings cs ON cs.course_id = cm.course_id
         WHERE cm.user_id = ? AND cm.course_id = ?`
      )
      .get(userId, courseId) as Record<string, unknown> | undefined;

    return {
      id: String(row.enrollment_id),
      user_id: userId,
      course_id: courseId,
      status: String(row.enrollment_status),
      enrolled_at: String(row.enrolled_at),
      course: {
        ...row,
        is_featured: Boolean(row.is_featured),
      },
      completed_lessons: completedLessons,
      total_lessons: totalLessons,
      progress_percent: totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0,
      community: community
        ? {
            ...community,
            telegram_required: Boolean(community.telegram_required),
            whatsapp_required: Boolean(community.whatsapp_required),
          }
        : null,
      has_full_access: access.hasFullAccess,
    };
  });

  const payments = db
    .prepare(
      `SELECT p.*, c.title as course_title, c.slug as course_slug
       FROM payments p
       JOIN courses c ON c.id = p.course_id
       WHERE p.user_id = ?
       ORDER BY p.created_at DESC`
    )
    .all(userId);

  const notifications = db
    .prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 30')
    .all(userId) as Record<string, unknown>[];

  res.json({
    enrollments,
    payments,
    notifications: notifications.map((n) => ({ ...n, is_read: Boolean(n.is_read) })),
  });
});

// Submit Manual bKash or Nagad Payment (NEVER auto-approved!)
router.post(
  '/payments',
  rateLimit({ windowMs: 15 * 60 * 1000, max: 12, keyPrefix: 'student_pay' }),
  (req: AuthRequest, res: Response) => {
    const userId = req.user!.id;
    const { course_id, payment_method, transaction_id, payer_phone } = req.body as Record<string, string>;

    if (!course_id || !payment_method || !transaction_id?.trim() || !payer_phone?.trim()) {
      res.status(400).json({ error: 'Course, payment method, Transaction ID, and payer phone are required.' });
      return;
    }

    if (payment_method !== 'bkash' && payment_method !== 'nagad') {
      res.status(400).json({ error: 'Invalid payment method. Choose bKash or Nagad.' });
      return;
    }

    const settings = getWebsiteSettings();
    if (payment_method === 'bkash' && !settings.bkash_enabled) {
      res.status(400).json({ error: 'bKash payment is currently disabled.' });
      return;
    }
    if (payment_method === 'nagad' && !settings.nagad_enabled) {
      res.status(400).json({ error: 'Nagad payment is currently disabled.' });
      return;
    }

    const cleanTrx = transaction_id.trim().toUpperCase();
    if (!/^[A-Z0-9_-]{6,32}$/.test(cleanTrx)) {
      res.status(400).json({ error: 'Transaction ID must be 6-32 alphanumeric characters.' });
      return;
    }
    if (!validateBdPhone(payer_phone)) {
      res.status(400).json({ error: 'Please enter a valid sender mobile number.' });
      return;
    }

    const course = db
      .prepare("SELECT id, title, price, discount_price, status FROM courses WHERE id = ? AND status = 'published'")
      .get(course_id) as
      | { id: string; title: string; price: number; discount_price: number | null; status: string }
      | undefined;

    if (!course) {
      res.status(404).json({ error: 'Course is not available for enrollment.' });
      return;
    }

    const alreadyEnrolled = db
      .prepare("SELECT id FROM enrollments WHERE user_id = ? AND course_id = ? AND status = 'active'")
      .get(userId, course.id);
    if (alreadyEnrolled) {
      res.status(409).json({ error: 'You are already enrolled in this course.' });
      return;
    }

    const existingPending = db
      .prepare("SELECT id FROM payments WHERE user_id = ? AND course_id = ? AND status = 'pending'")
      .get(userId, course.id);
    if (existingPending) {
      res.status(409).json({
        error: 'You already have a pending payment under verification for this course.',
      });
      return;
    }

    // Prevent duplicate Transaction ID globally
    const duplicateTrx = db
      .prepare('SELECT id FROM payments WHERE transaction_id = ?')
      .get(cleanTrx);
    if (duplicateTrx) {
      res.status(409).json({
        error: 'This Transaction ID has already been submitted. Duplicate Transaction IDs are not permitted.',
      });
      return;
    }

    // Server-side price calculation (ignore any client-sent amount)
    const serverAmount =
      course.discount_price !== null && course.discount_price >= 0 && course.discount_price < course.price
        ? course.discount_price
        : course.price;

    const paymentId = uuid();
    db.prepare(
      `INSERT INTO payments (id, user_id, course_id, payment_method, amount, transaction_id, payer_phone, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`
    ).run(paymentId, userId, course.id, payment_method, serverAmount, cleanTrx, payer_phone.trim());

    createNotification({
      userId,
      eventType: 'payment_submitted',
      title: 'Payment Submitted for Verification',
      message: `Your ${payment_method.toUpperCase()} payment (${cleanTrx}) of ৳${serverAmount} for "${course.title}" is pending admin review.`,
      link: '/student/payments',
    });

    res.status(201).json({
      payment: {
        id: paymentId,
        course_id: course.id,
        payment_method,
        amount: serverAmount,
        transaction_id: cleanTrx,
        payer_phone: payer_phone.trim(),
        status: 'pending',
      },
      message: 'Payment submitted successfully. Access will unlock after admin verification.',
    });
  }
);

// Private Classroom Data (strictly gates on enrollment + Telegram + WhatsApp)
router.get('/classroom/:slug', (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const slug = String(req.params.slug || '').trim();

  const course = db
    .prepare('SELECT * FROM courses WHERE slug = ?')
    .get(slug) as Record<string, unknown> | undefined;

  if (!course) {
    res.status(404).json({ error: 'Course not found.' });
    return;
  }

  const courseId = String(course.id);
  const access = checkCourseAccess(userId, courseId);
  const isAdmin = req.user!.role === 'admin';

  if (!isAdmin && !access.enrolled) {
    res.status(403).json({
      code: 'NOT_ENROLLED',
      error: 'You do not have an approved enrollment for this course.',
    });
    return;
  }

  if (!isAdmin && !access.hasFullAccess) {
    const community = db
      .prepare(
        `SELECT cm.*, cs.telegram_link, cs.whatsapp_link, cs.telegram_required, cs.whatsapp_required,
                cs.instructions, cs.instructions_bn
         FROM community_memberships cm
         LEFT JOIN community_settings cs ON cs.course_id = cm.course_id
         WHERE cm.user_id = ? AND cm.course_id = ?`
      )
      .get(userId, courseId);

    res.status(403).json({
      code: 'COMMUNITY_REQUIRED',
      error: 'Mandatory Telegram and WhatsApp community verification is required before entering this classroom.',
      access,
      community,
      courseTitle: String(course.title),
    });
    return;
  }

  const chapters = db
    .prepare('SELECT * FROM chapters WHERE course_id = ? ORDER BY sort_order ASC, created_at ASC')
    .all(courseId) as Record<string, unknown>[];

  const lessons = db
    .prepare(
      `SELECT l.id, l.course_id, l.chapter_id, l.title, l.title_bn, l.description,
              l.duration_seconds, l.is_free_preview, l.sort_order,
              CASE WHEN l.video_storage_path <> '' THEN 1 ELSE 0 END as has_video,
              COALESCE(lp.completed, 0) as completed,
              COALESCE(lp.watched_seconds, 0) as watched_seconds
       FROM lessons l
       LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id AND lp.user_id = ?
       WHERE l.course_id = ?
       ORDER BY l.sort_order ASC, l.created_at ASC`
    )
    .all(userId, courseId) as Record<string, unknown>[];

  const resources = db
    .prepare('SELECT id, lesson_id, course_id, title, file_size_bytes, mime_type FROM lesson_resources WHERE course_id = ?')
    .all(courseId) as Record<string, unknown>[];

  const chaptersWithLessons = chapters.map((ch) => ({
    ...ch,
    lessons: lessons
      .filter((l) => l.chapter_id === ch.id)
      .map((l) => ({
        ...l,
        is_free_preview: Boolean(l.is_free_preview),
        has_video: Boolean(l.has_video),
        completed: Boolean(l.completed),
        resources: resources.filter((r) => r.lesson_id === l.id),
      })),
  }));

  const totalLessons = lessons.length;
  const completedLessons = lessons.filter((l) => Boolean(l.completed)).length;

  res.json({
    course: { ...course, is_featured: Boolean(course.is_featured) },
    chapters: chaptersWithLessons,
    progress: {
      completed: completedLessons,
      total: totalLessons,
      percent: totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0,
    },
  });
});

// Issue Short-Lived Signed Video URL (after verifying server-side access)
router.post('/lessons/:lessonId/signed-url', async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const lessonId = String(req.params.lessonId || '').trim();

  const lesson = db
    .prepare('SELECT id, course_id, video_storage_path, is_free_preview FROM lessons WHERE id = ?')
    .get(lessonId) as
    | { id: string; course_id: string; video_storage_path: string; is_free_preview: number }
    | undefined;

  if (!lesson || !lesson.video_storage_path) {
    res.status(404).json({ error: 'Lesson video not found.' });
    return;
  }

  const isAdmin = req.user!.role === 'admin';
  const access = checkCourseAccess(userId, lesson.course_id);
  const authorized = isAdmin || lesson.is_free_preview === 1 || access.hasFullAccess;

  if (!authorized) {
    res.status(403).json({
      error: 'Unauthorized: Approved enrollment and verified Telegram & WhatsApp memberships are required.',
    });
    return;
  }

  // If Supabase Private Storage is configured and path starts with supabase:, issue real Supabase signed URL
  if (isSupabaseConfigured() && lesson.video_storage_path.startsWith('supabase:')) {
    const objectPath = lesson.video_storage_path.slice('supabase:'.length);
    const bucket = process.env.SUPABASE_VIDEO_BUCKET?.trim() || 'course-videos';
    const sbSigned = await createSupabaseSignedUrl(bucket, objectPath, 120);
    if (sbSigned) {
      res.json({ signedUrl: sbSigned, expiresInSeconds: 120 });
      return;
    }
  }

  const { exp, sig } = createSignedMediaToken({
    userId,
    resourceType: 'video',
    resourceId: lesson.id,
    ttlSeconds: 120,
  });

  const signedUrl = `/api/media/video/${encodeURIComponent(lesson.id)}?uid=${encodeURIComponent(userId)}&exp=${exp}&sig=${encodeURIComponent(sig)}`;
  res.json({ signedUrl, expiresInSeconds: 120 });
});

// Issue Short-Lived Signed Resource PDF URL
router.get('/resources/:resourceId/signed-url', async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const resourceId = String(req.params.resourceId || '').trim();

  const resource = db
    .prepare('SELECT id, course_id, file_storage_path FROM lesson_resources WHERE id = ?')
    .get(resourceId) as { id: string; course_id: string; file_storage_path: string } | undefined;

  if (!resource) {
    res.status(404).json({ error: 'Resource not found.' });
    return;
  }

  const isAdmin = req.user!.role === 'admin';
  const access = checkCourseAccess(userId, resource.course_id);
  if (!isAdmin && !access.hasFullAccess) {
    res.status(403).json({ error: 'Unauthorized resource access.' });
    return;
  }

  if (isSupabaseConfigured() && resource.file_storage_path.startsWith('supabase:')) {
    const objectPath = resource.file_storage_path.slice('supabase:'.length);
    const bucket = process.env.SUPABASE_RESOURCE_BUCKET?.trim() || 'course-resources';
    const sbSigned = await createSupabaseSignedUrl(bucket, objectPath, 120);
    if (sbSigned) {
      res.json({ signedUrl: sbSigned });
      return;
    }
  }

  const { exp, sig } = createSignedMediaToken({
    userId,
    resourceType: 'resource',
    resourceId: resource.id,
    ttlSeconds: 120,
  });

  const signedUrl = `/api/media/resource/${encodeURIComponent(resource.id)}?uid=${encodeURIComponent(userId)}&exp=${exp}&sig=${encodeURIComponent(sig)}`;
  res.json({ signedUrl });
});

// Save Lesson Progress
router.post('/lessons/:lessonId/progress', (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const lessonId = String(req.params.lessonId || '').trim();
  const { completed, watched_seconds } = req.body as { completed?: boolean; watched_seconds?: number };

  const lesson = db.prepare('SELECT id, course_id FROM lessons WHERE id = ?').get(lessonId) as
    | { id: string; course_id: string }
    | undefined;
  if (!lesson) {
    res.status(404).json({ error: 'Lesson not found.' });
    return;
  }

  const isAdmin = req.user!.role === 'admin';
  const access = checkCourseAccess(userId, lesson.course_id);
  if (!isAdmin && !access.hasFullAccess) {
    res.status(403).json({ error: 'Unauthorized progress update.' });
    return;
  }

  const existing = db
    .prepare('SELECT id, completed, watched_seconds FROM lesson_progress WHERE user_id = ? AND lesson_id = ?')
    .get(userId, lesson.id) as { id: string; completed: number; watched_seconds: number } | undefined;

  const nextCompleted = typeof completed === 'boolean' ? (completed ? 1 : 0) : existing?.completed || 0;
  const nextSeconds =
    typeof watched_seconds === 'number' && Number.isFinite(watched_seconds)
      ? Math.max(0, Math.floor(watched_seconds))
      : existing?.watched_seconds || 0;

  if (existing) {
    db.prepare(
      `UPDATE lesson_progress
       SET completed = ?, watched_seconds = ?,
           completed_at = CASE WHEN ? = 1 AND completed_at IS NULL THEN datetime('now') ELSE completed_at END,
           updated_at = datetime('now')
       WHERE id = ?`
    ).run(nextCompleted, nextSeconds, nextCompleted, existing.id);
  } else {
    db.prepare(
      `INSERT INTO lesson_progress (id, user_id, course_id, lesson_id, completed, watched_seconds, completed_at)
       VALUES (?, ?, ?, ?, ?, ?, CASE WHEN ? = 1 THEN datetime('now') ELSE NULL END)`
    ).run(uuid(), userId, lesson.course_id, lesson.id, nextCompleted, nextSeconds, nextCompleted);
  }

  res.json({ ok: true, completed: Boolean(nextCompleted), watched_seconds: nextSeconds });
});

// Community Membership Statuses for Student's Enrolled Courses
router.get('/community', (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const rows = db
    .prepare(
      `SELECT e.course_id, c.title as course_title, c.slug as course_slug,
              cs.telegram_link, cs.whatsapp_link, cs.telegram_required, cs.whatsapp_required,
              cs.instructions, cs.instructions_bn,
              cm.id as membership_id,
              COALESCE(cm.telegram_status, 'not_joined') as telegram_status,
              COALESCE(cm.telegram_username, '') as telegram_username,
              COALESCE(cm.telegram_user_id, '') as telegram_user_id,
              COALESCE(cm.whatsapp_status, 'not_joined') as whatsapp_status,
              COALESCE(cm.whatsapp_phone, '') as whatsapp_phone,
              COALESCE(cm.updated_at, e.enrolled_at) as updated_at
       FROM enrollments e
       JOIN courses c ON c.id = e.course_id
       LEFT JOIN community_settings cs ON cs.course_id = e.course_id
       LEFT JOIN community_memberships cm ON cm.user_id = e.user_id AND cm.course_id = e.course_id
       WHERE e.user_id = ? AND e.status = 'active'
       ORDER BY e.enrolled_at DESC`
    )
    .all(userId) as Record<string, unknown>[];

  res.json({
    memberships: rows.map((r) => ({
      ...r,
      telegram_required: r.telegram_required === null ? true : Boolean(r.telegram_required),
      whatsapp_required: r.whatsapp_required === null ? true : Boolean(r.whatsapp_required),
    })),
  });
});

// Submit Telegram Verification (uses Bot API when configured, otherwise queues Pending Admin Verification)
router.post('/community/verify-telegram', async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const { course_id, telegram_username, telegram_user_id } = req.body as Record<string, string>;

  if (!course_id || (!telegram_username?.trim() && !telegram_user_id?.trim())) {
    res.status(400).json({ error: 'Course ID and Telegram username or User ID are required.' });
    return;
  }

  const enrolled = db
    .prepare("SELECT id FROM enrollments WHERE user_id = ? AND course_id = ? AND status = 'active'")
    .get(userId, course_id);
  if (!enrolled) {
    res.status(403).json({ error: 'You must have an active enrollment in this course first.' });
    return;
  }

  const cs = db
    .prepare('SELECT telegram_chat_id FROM community_settings WHERE course_id = ?')
    .get(course_id) as { telegram_chat_id: string } | undefined;

  let nextStatus: 'pending_verification' | 'verified' = 'pending_verification';
  let detailMessage = 'Telegram membership details submitted for admin verification.';

  if (cs?.telegram_chat_id && telegram_user_id?.trim()) {
    const botCheck = await verifyTelegramBotMembership({
      chatId: cs.telegram_chat_id,
      telegramUserId: telegram_user_id.trim(),
    });
    if (botCheck.supported && botCheck.isMember) {
      nextStatus = 'verified';
      detailMessage = botCheck.statusText;
    } else if (botCheck.supported) {
      detailMessage = `${botCheck.statusText}. Your request has been queued for admin review.`;
    }
  }

  const existing = db
    .prepare('SELECT id FROM community_memberships WHERE user_id = ? AND course_id = ?')
    .get(userId, course_id) as { id: string } | undefined;

  if (existing) {
    db.prepare(
      `UPDATE community_memberships
       SET telegram_status = ?, telegram_username = ?, telegram_user_id = ?, updated_at = datetime('now')
       WHERE id = ?`
    ).run(
      nextStatus,
      (telegram_username || '').trim().slice(0, 80),
      (telegram_user_id || '').trim().slice(0, 40),
      existing.id
    );
  } else {
    db.prepare(
      `INSERT INTO community_memberships (id, user_id, course_id, telegram_status, telegram_username, telegram_user_id)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      uuid(),
      userId,
      course_id,
      nextStatus,
      (telegram_username || '').trim().slice(0, 80),
      (telegram_user_id || '').trim().slice(0, 40)
    );
  }

  res.json({ status: nextStatus, message: detailMessage });
});

// Submit WhatsApp Verification (NEVER auto-approves on link click; queued for Admin verification)
router.post('/community/submit-whatsapp', (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const { course_id, whatsapp_phone } = req.body as Record<string, string>;

  if (!course_id || !whatsapp_phone?.trim()) {
    res.status(400).json({ error: 'Course ID and your WhatsApp phone number are required.' });
    return;
  }
  if (!validateBdPhone(whatsapp_phone)) {
    res.status(400).json({ error: 'Please provide a valid WhatsApp phone number.' });
    return;
  }

  const enrolled = db
    .prepare("SELECT id FROM enrollments WHERE user_id = ? AND course_id = ? AND status = 'active'")
    .get(userId, course_id);
  if (!enrolled) {
    res.status(403).json({ error: 'You must have an active enrollment in this course first.' });
    return;
  }

  const existing = db
    .prepare('SELECT id FROM community_memberships WHERE user_id = ? AND course_id = ?')
    .get(userId, course_id) as { id: string } | undefined;

  if (existing) {
    db.prepare(
      `UPDATE community_memberships
       SET whatsapp_status = 'pending_verification', whatsapp_phone = ?, updated_at = datetime('now')
       WHERE id = ?`
    ).run(whatsapp_phone.trim(), existing.id);
  } else {
    db.prepare(
      `INSERT INTO community_memberships (id, user_id, course_id, whatsapp_status, whatsapp_phone)
       VALUES (?, ?, ?, 'pending_verification', ?)`
    ).run(uuid(), userId, course_id, whatsapp_phone.trim());
  }

  res.json({
    status: 'pending_verification',
    message: 'WhatsApp number submitted. Admin will verify your group membership shortly.',
  });
});

// Notifications
router.get('/notifications', (req: AuthRequest, res: Response) => {
  const rows = db
    .prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 60')
    .all(req.user!.id) as Record<string, unknown>[];
  res.json({
    notifications: rows.map((n) => ({ ...n, is_read: Boolean(n.is_read) })),
  });
});

router.post('/notifications/read', (req: AuthRequest, res: Response) => {
  const { notification_id } = req.body as { notification_id?: string };
  if (notification_id) {
    db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').run(
      notification_id,
      req.user!.id
    );
  } else {
    db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(req.user!.id);
  }
  res.json({ ok: true });
});

// Student Support Messages
router.get('/support', (req: AuthRequest, res: Response) => {
  const rows = db
    .prepare(
      'SELECT * FROM support_messages WHERE user_id = ? OR sender_email = ? ORDER BY created_at DESC'
    )
    .all(req.user!.id, req.user!.email);
  res.json({ messages: rows });
});

router.post('/support', (req: AuthRequest, res: Response) => {
  const { subject, message } = req.body as { subject?: string; message?: string };
  if (!subject?.trim() || !message?.trim()) {
    res.status(400).json({ error: 'Subject and message are required.' });
    return;
  }

  const id = uuid();
  db.prepare(
    `INSERT INTO support_messages (id, user_id, sender_name, sender_email, sender_phone, subject, message)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    req.user!.id,
    req.user!.full_name,
    req.user!.email,
    req.user!.phone,
    subject.trim().slice(0, 180),
    message.trim().slice(0, 3000)
  );

  res.status(201).json({ id, message: 'Support ticket submitted.' });
});

export default router;
