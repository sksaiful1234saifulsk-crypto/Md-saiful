export type UserRole = 'student' | 'admin';
export type LanguageCode = 'en' | 'bn';
export type PaymentMethod = 'bkash' | 'nagad';
export type PaymentStatus = 'pending' | 'approved' | 'rejected';
export type CommunityStatus = 'not_joined' | 'pending_verification' | 'verified';
export type CourseStatus = 'draft' | 'published' | 'archived';

export interface StatItem {
  value: string;
  label: string;
  label_bn: string;
}

export interface WhyChooseItem {
  title: string;
  title_bn: string;
  description: string;
  description_bn: string;
}

export interface TestimonialItem {
  name: string;
  role: string;
  organization: string;
  course: string;
  quote: string;
  quote_bn: string;
}

export interface FaqItem {
  question: string;
  question_bn: string;
  answer: string;
  answer_bn: string;
}

export interface WebsiteSettings {
  id: number;
  site_name: string;
  logo_url: string;
  favicon_url: string;
  primary_color: string;
  accent_color: string;
  hero_title: string;
  hero_title_bn: string;
  hero_subtitle: string;
  hero_subtitle_bn: string;
  hero_cta_text: string;
  hero_cta_text_bn: string;
  hero_banner_url: string;
  about_title: string;
  about_text: string;
  about_text_bn: string;
  stats_json: StatItem[];
  why_choose_json: WhyChooseItem[];
  testimonials_json: TestimonialItem[];
  faq_json: FaqItem[];
  contact_email: string;
  contact_phone: string;
  contact_address: string;
  footer_text: string;
  bkash_number: string;
  bkash_enabled: boolean;
  nagad_number: string;
  nagad_enabled: boolean;
  payment_instructions: string;
  payment_instructions_bn: string;
  whatsapp_support_link: string;
  email_support_address: string;
  facebook_page_link: string;
  telegram_support_link: string;
  updated_at?: string;
}

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  phone: string;
  avatar_url: string;
  bio: string;
  preferred_language: LanguageCode;
  email_verified: boolean;
  is_blocked: boolean;
  role: UserRole;
  created_at: string;
}

export interface CourseCategory {
  id: string;
  name: string;
  name_bn: string;
  slug: string;
  description: string;
  sort_order: number;
  course_count?: number;
}

export interface Course {
  id: string;
  title: string;
  title_bn: string;
  slug: string;
  thumbnail_url: string;
  short_description: string;
  short_description_bn: string;
  full_description: string;
  full_description_bn: string;
  category_id: string | null;
  category_name?: string;
  category_name_bn?: string;
  category_slug?: string;
  price: number;
  discount_price: number | null;
  instructor_name: string;
  instructor_slug: string;
  instructor_title: string;
  instructor_bio: string;
  duration: string;
  level: 'Beginner' | 'Intermediate' | 'Advanced' | 'All Levels';
  language: string;
  status: CourseStatus;
  is_featured: boolean;
  lesson_count?: number;
  chapter_count?: number;
  enrollment_count?: number;
  created_at: string;
  updated_at: string;
}

export interface Chapter {
  id: string;
  course_id: string;
  title: string;
  title_bn: string;
  sort_order: number;
  lessons?: LessonPublic[];
}

export interface LessonPublic {
  id: string;
  course_id: string;
  chapter_id: string;
  title: string;
  title_bn: string;
  description: string;
  duration_seconds: number;
  is_free_preview: boolean;
  sort_order: number;
  has_video?: boolean;
  video_storage_path?: string;
  completed?: boolean;
  watched_seconds?: number;
  resources?: LessonResource[];
}

export interface LessonResource {
  id: string;
  lesson_id: string;
  course_id: string;
  title: string;
  file_size_bytes: number;
  mime_type: string;
}

export interface PaymentRecord {
  id: string;
  user_id: string;
  course_id: string;
  course_title?: string;
  course_slug?: string;
  student_name?: string;
  student_email?: string;
  student_phone?: string;
  payment_method: PaymentMethod;
  amount: number;
  transaction_id: string;
  payer_phone: string;
  status: PaymentStatus;
  rejection_reason: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface CommunitySetting {
  id: string;
  course_id: string;
  course_title?: string;
  telegram_link: string;
  telegram_chat_id: string;
  telegram_required: boolean;
  whatsapp_link: string;
  whatsapp_required: boolean;
  instructions: string;
  instructions_bn: string;
}

export interface CommunityMembership {
  id: string;
  user_id: string;
  course_id: string;
  course_title?: string;
  course_slug?: string;
  student_name?: string;
  student_email?: string;
  student_phone?: string;
  telegram_status: CommunityStatus;
  telegram_username: string;
  telegram_user_id: string;
  whatsapp_status: CommunityStatus;
  whatsapp_phone: string;
  telegram_link?: string;
  whatsapp_link?: string;
  telegram_required?: boolean;
  whatsapp_required?: boolean;
  instructions?: string;
  instructions_bn?: string;
  updated_at: string;
}

export interface EnrollmentWithAccess {
  id: string;
  user_id: string;
  course_id: string;
  status: 'active' | 'revoked';
  enrolled_at: string;
  course: Course;
  completed_lessons: number;
  total_lessons: number;
  progress_percent: number;
  community: CommunityMembership | null;
  has_full_access: boolean;
}

export interface NotificationItem {
  id: string;
  user_id: string;
  event_type: string;
  title: string;
  message: string;
  link: string;
  is_read: boolean;
  created_at: string;
}

export interface SupportMessage {
  id: string;
  user_id: string | null;
  sender_name: string;
  sender_email: string;
  sender_phone: string;
  subject: string;
  message: string;
  admin_reply: string;
  status: 'open' | 'replied' | 'closed';
  replied_at: string | null;
  created_at: string;
}

export interface AdminActivityLog {
  id: string;
  admin_id: string;
  admin_name?: string;
  admin_email?: string;
  action: string;
  target_type: string;
  target_id: string;
  details: string;
  ip_address: string;
  created_at: string;
}
