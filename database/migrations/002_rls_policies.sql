-- ============================================================================
-- SERA ACADEMY — Row Level Security & Private Storage Policies (002)
-- ============================================================================

-- Helper function: verifies admin role via user_roles table
CREATE OR REPLACE FUNCTION public.is_admin(uid UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = uid AND role = 'admin'
  );
$$;

-- Helper function: verifies full course access (approved enrollment + verified community)
CREATE OR REPLACE FUNCTION public.has_course_access(uid UUID, cid UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.enrollments e
    JOIN public.profiles p ON p.id = e.user_id
    LEFT JOIN public.community_settings cs ON cs.course_id = e.course_id
    LEFT JOIN public.community_memberships cm ON cm.user_id = e.user_id AND cm.course_id = e.course_id
    WHERE e.user_id = uid
      AND e.course_id = cid
      AND e.status = 'active'
      AND p.is_blocked = FALSE
      AND (COALESCE(cs.telegram_required, TRUE) = FALSE OR cm.telegram_status = 'verified')
      AND (COALESCE(cs.whatsapp_required, TRUE) = FALSE OR cm.whatsapp_status = 'verified')
  );
$$;

-- Enable RLS on every table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.website_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_activity_logs ENABLE ROW LEVEL SECURITY;

-- PROFILES
CREATE POLICY "profiles_read_own_or_admin" ON public.profiles
  FOR SELECT USING (auth.uid() = id OR public.is_admin(auth.uid()));

CREATE POLICY "profiles_update_own_safe" ON public.profiles
  FOR UPDATE USING (auth.uid() = id OR public.is_admin(auth.uid()))
  WITH CHECK (
    public.is_admin(auth.uid())
    OR (auth.uid() = id AND is_blocked = FALSE)
  );

-- USER ROLES (Admin-only management; students cannot elevate themselves)
CREATE POLICY "roles_read_own_or_admin" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

CREATE POLICY "roles_admin_all" ON public.user_roles
  FOR ALL USING (public.is_admin(auth.uid()));

-- CATEGORIES & COURSES (Public read for published; Admin full write)
CREATE POLICY "categories_public_read" ON public.course_categories
  FOR SELECT USING (TRUE);

CREATE POLICY "categories_admin_write" ON public.course_categories
  FOR ALL USING (public.is_admin(auth.uid()));

CREATE POLICY "courses_public_read_published" ON public.courses
  FOR SELECT USING (status = 'published' OR public.is_admin(auth.uid()));

CREATE POLICY "courses_admin_write" ON public.courses
  FOR ALL USING (public.is_admin(auth.uid()));

-- CHAPTERS & LESSONS
CREATE POLICY "chapters_read_published_or_admin" ON public.chapters
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_id AND c.status = 'published')
    OR public.is_admin(auth.uid())
  );

CREATE POLICY "chapters_admin_write" ON public.chapters
  FOR ALL USING (public.is_admin(auth.uid()));

-- Note: Direct client queries should use a public view omitting video_storage_path;
-- only enrolled & community-verified students or admins read full lesson rows.
CREATE POLICY "lessons_read_authorized" ON public.lessons
  FOR SELECT USING (
    public.is_admin(auth.uid())
    OR is_free_preview = TRUE
    OR public.has_course_access(auth.uid(), course_id)
  );

CREATE POLICY "lessons_admin_write" ON public.lessons
  FOR ALL USING (public.is_admin(auth.uid()));

CREATE POLICY "resources_read_authorized" ON public.lesson_resources
  FOR SELECT USING (
    public.is_admin(auth.uid())
    OR public.has_course_access(auth.uid(), course_id)
  );

CREATE POLICY "resources_admin_write" ON public.lesson_resources
  FOR ALL USING (public.is_admin(auth.uid()));

-- PAYMENTS (Students insert own pending payments only; only Admins approve/reject)
CREATE POLICY "payments_read_own_or_admin" ON public.payments
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

CREATE POLICY "payments_student_insert_pending" ON public.payments
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND status = 'pending'
    AND reviewed_by IS NULL
  );

CREATE POLICY "payments_admin_update" ON public.payments
  FOR UPDATE USING (public.is_admin(auth.uid()));

-- ENROLLMENTS
CREATE POLICY "enrollments_read_own_or_admin" ON public.enrollments
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

CREATE POLICY "enrollments_admin_write" ON public.enrollments
  FOR ALL USING (public.is_admin(auth.uid()));

-- LESSON PROGRESS
CREATE POLICY "progress_own_or_admin" ON public.lesson_progress
  FOR ALL USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

-- NOTIFICATIONS
CREATE POLICY "notifications_read_update_own" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

CREATE POLICY "notifications_mark_read_own" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "notifications_admin_insert" ON public.notifications
  FOR INSERT WITH CHECK (public.is_admin(auth.uid()));

-- COMMUNITY SETTINGS & MEMBERSHIPS
CREATE POLICY "community_settings_enrolled_or_admin" ON public.community_settings
  FOR SELECT USING (
    public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.enrollments e
      WHERE e.user_id = auth.uid() AND e.course_id = community_settings.course_id AND e.status = 'active'
    )
  );

CREATE POLICY "community_settings_admin_write" ON public.community_settings
  FOR ALL USING (public.is_admin(auth.uid()));

CREATE POLICY "community_memberships_read_own_or_admin" ON public.community_memberships
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

-- Students can submit pending verification info, never set 'verified' directly
CREATE POLICY "community_memberships_student_pending" ON public.community_memberships
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND telegram_status <> 'verified'
    AND whatsapp_status <> 'verified'
  );

CREATE POLICY "community_memberships_admin_write" ON public.community_memberships
  FOR ALL USING (public.is_admin(auth.uid()));

-- SUPPORT MESSAGES
CREATE POLICY "support_read_own_or_admin" ON public.support_messages
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

CREATE POLICY "support_insert_any" ON public.support_messages
  FOR INSERT WITH CHECK (TRUE);

CREATE POLICY "support_admin_update" ON public.support_messages
  FOR UPDATE USING (public.is_admin(auth.uid()));

-- WEBSITE SETTINGS
CREATE POLICY "website_settings_public_read" ON public.website_settings
  FOR SELECT USING (TRUE);

CREATE POLICY "website_settings_admin_write" ON public.website_settings
  FOR ALL USING (public.is_admin(auth.uid()));

-- ADMIN ACTIVITY LOGS
CREATE POLICY "admin_logs_admin_only" ON public.admin_activity_logs
  FOR ALL USING (public.is_admin(auth.uid()));

-- SUPABASE PRIVATE STORAGE BUCKETS (course-videos, course-resources)
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('course-videos', 'course-videos', FALSE),
  ('course-resources', 'course-resources', FALSE)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "private_videos_admin_only" ON storage.objects
  FOR ALL USING (
    bucket_id IN ('course-videos', 'course-resources')
    AND public.is_admin(auth.uid())
  );
