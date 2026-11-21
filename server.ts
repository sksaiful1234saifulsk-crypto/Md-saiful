import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import { initDatabase, db, checkCourseAccess } from './server/db.ts';
import { resolveConfinedPath, verifySignedMediaToken } from './server/security.ts';
import authRoutes from './server/routes/auth.ts';
import publicRoutes from './server/routes/public.ts';
import studentRoutes from './server/routes/student.ts';
import adminRoutes from './server/routes/admin.ts';

const PORT = Number(process.env.PORT || 3000);
const PRIVATE_VIDEOS_DIR = path.resolve(process.cwd(), 'storage', 'private_videos');
const PRIVATE_RESOURCES_DIR = path.resolve(process.cwd(), 'storage', 'private_resources');
const PUBLIC_UPLOADS_DIR = path.resolve(process.cwd(), 'storage', 'public_uploads');

async function startServer(): Promise<void> {
  initDatabase();

  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '4mb' }));

  // Serve uploaded public brand/thumbnail assets safely
  app.use('/uploads/public', express.static(PUBLIC_UPLOADS_DIR, { maxAge: '1d' }));

  // API Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/public', publicRoutes);
  app.use('/api/student', studentRoutes);
  app.use('/api/admin', adminRoutes);

  // Short-lived Signed Private Video Streaming (HTTP 206 Byte-Range Support)
  app.get('/api/media/video/:lessonId', (req: Request, res: Response) => {
    const lessonId = String(req.params.lessonId || '');
    const uid = String(req.query.uid || '');
    const exp = Number(req.query.exp || 0);
    const sig = String(req.query.sig || '');

    if (!verifySignedMediaToken({ userId: uid, resourceType: 'video', resourceId: lessonId, exp, sig })) {
      res.status(403).json({ error: 'Signed video URL expired or invalid.' });
      return;
    }

    const lesson = db
      .prepare('SELECT id, course_id, video_storage_path, is_free_preview FROM lessons WHERE id = ?')
      .get(lessonId) as
      | { id: string; course_id: string; video_storage_path: string; is_free_preview: number }
      | undefined;

    if (!lesson || !lesson.video_storage_path) {
      res.status(404).json({ error: 'Video not found.' });
      return;
    }

    const roleRow = db.prepare('SELECT role FROM user_roles WHERE user_id = ?').get(uid) as
      | { role: string }
      | undefined;
    const isAdmin = roleRow?.role === 'admin';
    const access = checkCourseAccess(uid, lesson.course_id);
    if (!isAdmin && lesson.is_free_preview !== 1 && !access.hasFullAccess) {
      res.status(403).json({ error: 'Course access revoked or community unverified.' });
      return;
    }

    const filePath = resolveConfinedPath(PRIVATE_VIDEOS_DIR, lesson.video_storage_path);
    if (!filePath || !fs.existsSync(filePath)) {
      res.status(404).json({ error: 'Video file missing in private storage.' });
      return;
    }

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const ext = path.extname(filePath).toLowerCase();
    const contentType = ext === '.webm' ? 'video/webm' : 'video/mp4';
    const range = req.headers.range;

    res.setHeader('Cache-Control', 'no-store, private');

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      if (Number.isNaN(start) || start >= fileSize || end >= fileSize) {
        res.status(416).setHeader('Content-Range', `bytes */${fileSize}`).end();
        return;
      }
      const chunkSize = end - start + 1;
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': contentType,
      });
      fs.createReadStream(filePath, { start, end }).pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Accept-Ranges': 'bytes',
        'Content-Type': contentType,
      });
      fs.createReadStream(filePath).pipe(res);
    }
  });

  // Short-lived Signed Private Resource Download
  app.get('/api/media/resource/:resourceId', (req: Request, res: Response) => {
    const resourceId = String(req.params.resourceId || '');
    const uid = String(req.query.uid || '');
    const exp = Number(req.query.exp || 0);
    const sig = String(req.query.sig || '');

    if (!verifySignedMediaToken({ userId: uid, resourceType: 'resource', resourceId, exp, sig })) {
      res.status(403).json({ error: 'Signed resource URL expired or invalid.' });
      return;
    }

    const resource = db
      .prepare('SELECT id, course_id, title, file_storage_path, mime_type FROM lesson_resources WHERE id = ?')
      .get(resourceId) as
      | { id: string; course_id: string; title: string; file_storage_path: string; mime_type: string }
      | undefined;

    if (!resource) {
      res.status(404).json({ error: 'Resource not found.' });
      return;
    }

    const roleRow = db.prepare('SELECT role FROM user_roles WHERE user_id = ?').get(uid) as
      | { role: string }
      | undefined;
    const isAdmin = roleRow?.role === 'admin';
    const access = checkCourseAccess(uid, resource.course_id);
    if (!isAdmin && !access.hasFullAccess) {
      res.status(403).json({ error: 'Unauthorized resource access.' });
      return;
    }

    const filePath = resolveConfinedPath(PRIVATE_RESOURCES_DIR, resource.file_storage_path);
    if (!filePath || !fs.existsSync(filePath)) {
      res.status(404).json({ error: 'Resource file missing.' });
      return;
    }

    const safeFilename = `${resource.title.replace(/[^a-zA-Z0-9._-]/g, '_')}${path.extname(filePath)}`;
    res.setHeader('Cache-Control', 'no-store, private');
    res.setHeader('Content-Type', resource.mime_type || 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
    fs.createReadStream(filePath).pipe(res);
  });

  // Healthcheck
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  // Frontend Vite Dev Middleware or Production Static Bundle
  const distDir = path.resolve(process.cwd(), 'dist');
  const isProd = process.env.NODE_ENV === 'production' && fs.existsSync(path.join(distDir, 'index.html'));

  if (isProd) {
    app.use(express.static(distDir));
    app.get('/{*splat}', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SERA ACADEMY server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start SERA ACADEMY server:', err);
  process.exit(1);
});
