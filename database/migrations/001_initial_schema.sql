-- ============================================================================
-- SERA ACADEMY — PostgreSQL / Supabase Initial Schema Migration (001)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. PROFILES
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  password_hash TEXT,
  avatar_url TEXT DEFAULT '',
  bio TEXT DEFAULT '',
  preferred_language TEXT NOT NULL DEFAULT 'en' CHECK (preferred_language IN ('en', 'bn')),
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  email_verification_code TEXT,
  password_reset_token TEXT,
  password_reset_expires TIMESTAMPTZ,
  is_blocked BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON public.profiles(phone);

-- 2. USER ROLES (Separated from profiles so students can never elevate themselves)
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'admin')),
  assigned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);

-- 3. COURSE CATEGORIES
CREATE TABLE IF NOT EXISTS public.course_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  name_bn TEXT NOT NULL DEFAULT '',
  slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. COURSES
CREATE TABLE IF NOT EXISTS public.courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  title_bn TEXT NOT NULL DEFAULT '',
  slug TEXT NOT NULL UNIQUE,
  thumbnail_url TEXT NOT NULL DEFAULT '',
  short_description TEXT NOT NULL,
  short_description_bn TEXT NOT NULL DEFAULT '',
  full_description TEXT NOT NULL,
  full_description_bn TEXT NOT NULL DEFAULT '',
  category_id UUID REFERENCES public.course_categories(id) ON DELETE SET NULL,
  price INTEGER NOT NULL CHECK (price >= 0),
  discount_price INTEGER CHECK (discount_price IS NULL OR discount_price >= 0),
  instructor_name TEXT NOT NULL,
  instructor_slug TEXT NOT NULL,
  instructor_title TEXT NOT NULL DEFAULT '',
  instructor_bio TEXT NOT NULL DEFAULT '',
  duration TEXT NOT NULL DEFAULT '',
  level TEXT NOT NULL DEFAULT 'Beginner' CHECK (level IN ('Beginner', 'Intermediate', 'Advanced', 'All Levels')),
  language TEXT NOT NULL DEFAULT 'Bengali & English',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_courses_slug ON public.courses(slug);
CREATE INDEX IF NOT EXISTS idx_courses_status ON public.courses(status);
CREATE INDEX IF NOT EXISTS idx_courses_category ON public.courses(category_id);

-- 5. CHAPTERS
CREATE TABLE IF NOT EXISTS public.chapters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  title_bn TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chapters_course ON public.chapters(course_id, sort_order);

-- 6. LESSONS (video_storage_path is NEVER exposed in public endpoints)
CREATE TABLE IF NOT EXISTS public.lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  chapter_id UUID NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  title_bn TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  video_storage_path TEXT NOT NULL DEFAULT '',
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  is_free_preview BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lessons_chapter ON public.lessons(chapter_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_lessons_course ON public.lessons(course_id);

-- 7. LESSON RESOURCES
CREATE TABLE IF NOT EXISTS public.lesson_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  file_storage_path TEXT NOT NULL,
  file_size_bytes INTEGER NOT NULL DEFAULT 0,
  mime_type TEXT NOT NULL DEFAULT 'application/pdf',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lesson_resources_lesson ON public.lesson_resources(lesson_id);

-- 8. PAYMENTS (Manual bKash & Nagad verification with unique Transaction ID)
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('bkash', 'nagad')),
  amount INTEGER NOT NULL CHECK (amount >= 0),
  transaction_id TEXT NOT NULL UNIQUE,
  payer_phone TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason TEXT DEFAULT '',
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_user ON public.payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_trx ON public.payments(transaction_id);

-- 9. ENROLLMENTS (Only created when Admin approves payment)
CREATE TABLE IF NOT EXISTS public.enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, course_id)
);

CREATE INDEX IF NOT EXISTS idx_enrollments_user ON public.enrollments(user_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_course ON public.enrollments(course_id);

-- 10. LESSON PROGRESS
CREATE TABLE IF NOT EXISTS public.lesson_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  watched_seconds INTEGER NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, lesson_id)
);

CREATE INDEX IF NOT EXISTS idx_progress_user_course ON public.lesson_progress(user_id, course_id);

-- 11. NOTIFICATIONS
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT DEFAULT '',
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id, is_read, created_at DESC);

-- 12. COMMUNITY SETTINGS (Per-course Telegram & WhatsApp requirements)
CREATE TABLE IF NOT EXISTS public.community_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL UNIQUE REFERENCES public.courses(id) ON DELETE CASCADE,
  telegram_link TEXT NOT NULL DEFAULT '',
  telegram_chat_id TEXT NOT NULL DEFAULT '',
  telegram_required BOOLEAN NOT NULL DEFAULT TRUE,
  whatsapp_link TEXT NOT NULL DEFAULT '',
  whatsapp_required BOOLEAN NOT NULL DEFAULT TRUE,
  instructions TEXT NOT NULL DEFAULT '',
  instructions_bn TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 13. COMMUNITY MEMBERSHIPS (Mandatory Verification Gate)
CREATE TABLE IF NOT EXISTS public.community_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  telegram_status TEXT NOT NULL DEFAULT 'not_joined' CHECK (telegram_status IN ('not_joined', 'pending_verification', 'verified')),
  telegram_username TEXT DEFAULT '',
  telegram_user_id TEXT DEFAULT '',
  whatsapp_status TEXT NOT NULL DEFAULT 'not_joined' CHECK (whatsapp_status IN ('not_joined', 'pending_verification', 'verified')),
  whatsapp_phone TEXT DEFAULT '',
  verified_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, course_id)
);

CREATE INDEX IF NOT EXISTS idx_comm_memberships_user_course ON public.community_memberships(user_id, course_id);

-- 14. SUPPORT MESSAGES
CREATE TABLE IF NOT EXISTS public.support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  sender_name TEXT NOT NULL,
  sender_email TEXT NOT NULL,
  sender_phone TEXT DEFAULT '',
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  admin_reply TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'replied', 'closed')),
  replied_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  replied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_status ON public.support_messages(status, created_at DESC);

-- 15. WEBSITE SETTINGS (Single row configuration editable from Admin Panel)
CREATE TABLE IF NOT EXISTS public.website_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  site_name TEXT NOT NULL DEFAULT 'SERA ACADEMY',
  logo_url TEXT NOT NULL DEFAULT '',
  favicon_url TEXT NOT NULL DEFAULT '',
  primary_color TEXT NOT NULL DEFAULT '#0B1F3A',
  accent_color TEXT NOT NULL DEFAULT '#C89B3C',
  hero_title TEXT NOT NULL,
  hero_title_bn TEXT NOT NULL,
  hero_subtitle TEXT NOT NULL,
  hero_subtitle_bn TEXT NOT NULL,
  hero_cta_text TEXT NOT NULL,
  hero_cta_text_bn TEXT NOT NULL,
  hero_banner_url TEXT NOT NULL DEFAULT '',
  about_title TEXT NOT NULL,
  about_text TEXT NOT NULL,
  about_text_bn TEXT NOT NULL,
  stats_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  why_choose_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  testimonials_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  faq_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  contact_email TEXT NOT NULL DEFAULT '',
  contact_phone TEXT NOT NULL DEFAULT '',
  contact_address TEXT NOT NULL DEFAULT '',
  footer_text TEXT NOT NULL DEFAULT '',
  bkash_number TEXT NOT NULL DEFAULT '',
  bkash_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  nagad_number TEXT NOT NULL DEFAULT '',
  nagad_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  payment_instructions TEXT NOT NULL DEFAULT '',
  payment_instructions_bn TEXT NOT NULL DEFAULT '',
  whatsapp_support_link TEXT NOT NULL DEFAULT '',
  email_support_address TEXT NOT NULL DEFAULT '',
  facebook_page_link TEXT NOT NULL DEFAULT '',
  telegram_support_link TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 16. ADMIN ACTIVITY LOGS (Audit trail)
CREATE TABLE IF NOT EXISTS public.admin_activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_logs_created ON public.admin_activity_logs(created_at DESC);
