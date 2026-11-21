# SERA ACADEMY — Full-Stack Online Course & Private Classroom Platform

SERA ACADEMY is a complete, mobile-first online learning platform built with **React 19, TypeScript, Tailwind CSS v4, Express, Node.js, and PostgreSQL / Supabase** support. It includes a full public academy website (bilingual English & Bengali), student dashboard, private signed-URL video classroom, manual bKash & Nagad payment verification, mandatory Telegram & WhatsApp community gating, and a mobile-ready Admin Panel (`/admin`).

---

## 1. Architecture & Package Versions

| Layer | Technology | Version |
| :--- | :--- | :--- |
| Frontend | React, TypeScript, Tailwind CSS | `19.0.1` / `7.0.2` / `4.3.3` |
| Icons & Motion | `lucide-react`, `motion` | `0.546.0` / `12.23.24` |
| Backend Runtime | Node.js, Express, `tsx` | `v22` / `4.21.2` / `4.21.0` |
| Database & Storage | SQLite (zero-config local persistence) + `@supabase/supabase-js` | `^2.x` |
| File Uploads | `multer` (private storage confinement) | `^2.x` |

---

## 2. Project Structure

```text
├── server.ts                          # Express server + Vite middleware + signed video/PDF range streaming
├── server/
│   ├── db.ts                          # Database schema initialization & transactional helpers
│   ├── middleware.ts                  # Server-side Bearer session verification & RBAC guards
│   ├── security.ts                    # scrypt password hashing, HMAC signed URLs, rate limiting, path confinement
│   ├── supabase.ts                    # Supabase Private Storage signed URLs & Telegram Bot API verification
│   └── routes/
│       ├── auth.ts                    # Registration, login, one-time admin bootstrap, profile, password reset
│       ├── public.ts                  # Public courses, categories, instructors, settings, support tickets
│       ├── student.ts                 # Student dashboard, bKash/Nagad payments, classroom, community, progress
│       └── admin.ts                   # Complete Admin API (A–J modules + audit logs)
├── database/migrations/
│   ├── 001_initial_schema.sql         # All 16 PostgreSQL tables, constraints, and indexes
│   ├── 002_rls_policies.sql           # Row Level Security policies + Supabase Private Storage bucket rules
│   └── 003_seed_data.sql              # Default categories and website settings
├── src/
│   ├── App.tsx                        # Client-side SPA router for all public, auth, student, and admin routes
│   ├── context/AppContext.tsx         # Global auth state, dynamic branding tokens, bilingual toggle
│   ├── lib/api.ts                     # In-memory Bearer token API client
│   ├── types/academy.ts               # Shared TypeScript interfaces
│   ├── components/
│   │   ├── common/                    # BrandHeader, SiteFooter, SafeImage
│   │   ├── courses/                   # CourseCard
│   │   └── admin/                     # AdminCourseManager, AdminOperationsPanels, AdminSettingsAndSecurity
│   └── pages/
│       ├── HomePage.tsx               # Hero, search, featured/latest courses, stats, testimonials, FAQ, contact
│       ├── CoursesPage.tsx            # Catalog & category filtering
│       ├── CourseDetailPage.tsx       # Curriculum preview & manual bKash/Nagad checkout
│       ├── PublicInfoPages.tsx        # Instructor details, About, Contact, Support Center, Legal pages
│       ├── AuthPages.tsx              # Login, Register, Forgot/Reset Password, First-Admin Initialization
│       ├── student/                   # StudentDashboard & Private Video Classroom
│       └── admin/                     # Mobile-first AdminDashboard
└── .env.example                       # Environment variable configuration template
```

---

## 3. External Services & Credentials Checklist

Configure these environment variables in `.env` (local) or Vercel Project Settings -> Environment Variables:

1. **`SESSION_SECRET`**: Strong random 64-character hex string used to sign short-lived video/PDF URLs.
2. **`SUPABASE_URL`**, **`SUPABASE_ANON_KEY`**, **`SUPABASE_SERVICE_ROLE_KEY`**: Required when deploying with Supabase PostgreSQL & Supabase Private Storage (`course-videos`, `course-resources`). Keep `SUPABASE_SERVICE_ROLE_KEY` strictly on the server—never expose it to client code.
3. **`TELEGRAM_BOT_TOKEN`** *(Optional)*: Token from `@BotFather`. Add your bot as an Administrator in your course Telegram channels and enter the Channel Chat ID in **Admin -> Community** to enable automated Telegram membership checks via Bot API.
4. **`INITIAL_ADMIN_EMAIL`** & **`INITIAL_ADMIN_PASSWORD`** *(Optional)*: For automated headless deployments. If omitted, use the built-in one-time `/auth/admin-setup` screen.

---

## 4. Database Setup Guide (Supabase PostgreSQL)

1. Create a new project at [supabase.com](https://supabase.com).
2. Open **SQL Editor** in your Supabase Dashboard.
3. Run the three migration files in order:
   - `database/migrations/001_initial_schema.sql`
   - `database/migrations/002_rls_policies.sql`
   - `database/migrations/003_seed_data.sql`
4. Verify in **Table Editor** that all 16 tables (`profiles`, `user_roles`, `courses`, `course_categories`, `chapters`, `lessons`, `lesson_resources`, `payments`, `enrollments`, `lesson_progress`, `notifications`, `community_settings`, `community_memberships`, `support_messages`, `website_settings`, `admin_activity_logs`) are created with RLS enabled.

---

## 5. Supabase Private Storage Setup Guide

Migration `002_rls_policies.sql` creates two **private** (`public = false`) buckets:
- `course-videos` — stores uploaded MP4/WebM/MOV lesson videos
- `course-resources` — stores lesson PDF workbooks and ZIP attachments

Public unauthenticated reads are blocked. Only verified server routes issue short-lived (120-second) signed URLs after confirming active enrollment and verified Telegram & WhatsApp memberships.

---

## 6. Safe First-Admin Initialization Guide

1. Start the app (`npm run dev` or deployed URL).
2. Navigate to `/auth/admin-setup` (also linked on `/auth/login` when no admin exists).
3. Submit your Name, Email, Phone, and a strong Password (min. 8 characters).
4. Once the first Administrator account is created, the `/api/auth/bootstrap-admin` endpoint **permanently locks itself** (returning HTTP 403) so no subsequent user can claim Admin access.
5. Student registrations via `/auth/register` are strictly locked to the `student` role on the server.

---

## 7. GitHub & Vercel Deployment Guide

### GitHub Upload
```bash
git init
git add .
git commit -m "Initial SERA ACADEMY platform"
git branch -M main
git remote add origin https://github.com/<your-username>/sera-academy.git
git push -u origin main
```

### Vercel / Production Deployment
1. Import the GitHub repository in Vercel or your Node.js hosting provider.
2. Set Build Command: `npm run build`
3. Set Start Command: `npm run start`
4. Add environment variables from `.env.example` (`APP_URL`, `SESSION_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `TELEGRAM_BOT_TOKEN`).
5. Attach your custom domain under **Settings -> Domains** and update `APP_URL` to match `https://yourdomain.com`.

---

## 8. Production Testing Checklist

- [ ] Initialize first Admin at `/auth/admin-setup` and confirm `/auth/admin-setup` locks afterward.
- [ ] Register a new student at `/auth/register` and verify email code in **Student -> Settings**.
- [ ] Confirm a student receives HTTP 403 if attempting to visit `/admin` or `/api/admin/*`.
- [ ] Open a published course, click **Buy Now via bKash / Nagad**, submit a TrxID, and verify duplicate TrxIDs are rejected.
- [ ] Approve the payment inside **Admin -> C. Payments** and verify enrollment + notification are created.
- [ ] Confirm the student cannot enter `/student/classroom/:slug` until both Telegram and WhatsApp memberships are verified.
- [ ] Verify both memberships in **Admin -> D. Community** (or via Telegram Bot API) and confirm private video playback + PDF download work via signed URLs.
- [ ] Customize site name, colors, hero banner, and bKash/Nagad numbers in **Admin -> F. Website Design** & **G. Payment Settings** and confirm live updates on `/`.
