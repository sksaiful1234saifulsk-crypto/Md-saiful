import { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { WebsiteSettings } from '../src/types/academy.ts';
import { hashPassword } from './security.ts';

const DATA_DIR = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export const db = new DatabaseSync(path.join(DATA_DIR, 'sera_academy.db'));
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

export function uuid(): string {
  return crypto.randomUUID();
}

export function initDatabase(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      full_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      avatar_url TEXT NOT NULL DEFAULT '',
      bio TEXT NOT NULL DEFAULT '',
      preferred_language TEXT NOT NULL DEFAULT 'en',
      email_verified INTEGER NOT NULL DEFAULT 0,
      email_verification_code TEXT NOT NULL DEFAULT '',
      password_reset_token TEXT NOT NULL DEFAULT '',
      password_reset_expires TEXT NOT NULL DEFAULT '',
      is_blocked INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS user_roles (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
      role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'admin')),
      assigned_by TEXT REFERENCES profiles(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      user_agent TEXT NOT NULL DEFAULT '',
      ip_address TEXT NOT NULL DEFAULT '',
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS course_categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      name_bn TEXT NOT NULL DEFAULT '',
      slug TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS courses (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      title_bn TEXT NOT NULL DEFAULT '',
      slug TEXT NOT NULL UNIQUE,
      thumbnail_url TEXT NOT NULL DEFAULT '',
      short_description TEXT NOT NULL,
      short_description_bn TEXT NOT NULL DEFAULT '',
      full_description TEXT NOT NULL,
      full_description_bn TEXT NOT NULL DEFAULT '',
      category_id TEXT REFERENCES course_categories(id) ON DELETE SET NULL,
      price INTEGER NOT NULL DEFAULT 0,
      discount_price INTEGER,
      instructor_name TEXT NOT NULL,
      instructor_slug TEXT NOT NULL,
      instructor_title TEXT NOT NULL DEFAULT '',
      instructor_bio TEXT NOT NULL DEFAULT '',
      duration TEXT NOT NULL DEFAULT '',
      level TEXT NOT NULL DEFAULT 'Beginner',
      language TEXT NOT NULL DEFAULT 'Bengali & English',
      status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
      is_featured INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS chapters (
      id TEXT PRIMARY KEY,
      course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      title_bn TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS lessons (
      id TEXT PRIMARY KEY,
      course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      chapter_id TEXT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      title_bn TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      video_storage_path TEXT NOT NULL DEFAULT '',
      duration_seconds INTEGER NOT NULL DEFAULT 0,
      is_free_preview INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS lesson_resources (
      id TEXT PRIMARY KEY,
      lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
      course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      file_storage_path TEXT NOT NULL,
      file_size_bytes INTEGER NOT NULL DEFAULT 0,
      mime_type TEXT NOT NULL DEFAULT 'application/pdf',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      payment_method TEXT NOT NULL CHECK (payment_method IN ('bkash', 'nagad')),
      amount INTEGER NOT NULL,
      transaction_id TEXT NOT NULL UNIQUE,
      payer_phone TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
      rejection_reason TEXT NOT NULL DEFAULT '',
      reviewed_by TEXT REFERENCES profiles(id) ON DELETE SET NULL,
      reviewed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS enrollments (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      payment_id TEXT REFERENCES payments(id) ON DELETE SET NULL,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
      enrolled_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, course_id)
    );

    CREATE TABLE IF NOT EXISTS lesson_progress (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
      completed INTEGER NOT NULL DEFAULT 0,
      watched_seconds INTEGER NOT NULL DEFAULT 0,
      completed_at TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, lesson_id)
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      event_type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      link TEXT NOT NULL DEFAULT '',
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS community_settings (
      id TEXT PRIMARY KEY,
      course_id TEXT NOT NULL UNIQUE REFERENCES courses(id) ON DELETE CASCADE,
      telegram_link TEXT NOT NULL DEFAULT '',
      telegram_chat_id TEXT NOT NULL DEFAULT '',
      telegram_required INTEGER NOT NULL DEFAULT 1,
      whatsapp_link TEXT NOT NULL DEFAULT '',
      whatsapp_required INTEGER NOT NULL DEFAULT 1,
      instructions TEXT NOT NULL DEFAULT '',
      instructions_bn TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS community_memberships (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      telegram_status TEXT NOT NULL DEFAULT 'not_joined' CHECK (telegram_status IN ('not_joined', 'pending_verification', 'verified')),
      telegram_username TEXT NOT NULL DEFAULT '',
      telegram_user_id TEXT NOT NULL DEFAULT '',
      whatsapp_status TEXT NOT NULL DEFAULT 'not_joined' CHECK (whatsapp_status IN ('not_joined', 'pending_verification', 'verified')),
      whatsapp_phone TEXT NOT NULL DEFAULT '',
      verified_by TEXT REFERENCES profiles(id) ON DELETE SET NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, course_id)
    );

    CREATE TABLE IF NOT EXISTS support_messages (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
      sender_name TEXT NOT NULL,
      sender_email TEXT NOT NULL,
      sender_phone TEXT NOT NULL DEFAULT '',
      subject TEXT NOT NULL,
      message TEXT NOT NULL,
      admin_reply TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'replied', 'closed')),
      replied_by TEXT REFERENCES profiles(id) ON DELETE SET NULL,
      replied_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS website_settings (
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
      stats_json TEXT NOT NULL DEFAULT '[]',
      why_choose_json TEXT NOT NULL DEFAULT '[]',
      testimonials_json TEXT NOT NULL DEFAULT '[]',
      faq_json TEXT NOT NULL DEFAULT '[]',
      contact_email TEXT NOT NULL DEFAULT '',
      contact_phone TEXT NOT NULL DEFAULT '',
      contact_address TEXT NOT NULL DEFAULT '',
      footer_text TEXT NOT NULL DEFAULT '',
      bkash_number TEXT NOT NULL DEFAULT '',
      bkash_enabled INTEGER NOT NULL DEFAULT 1,
      nagad_number TEXT NOT NULL DEFAULT '',
      nagad_enabled INTEGER NOT NULL DEFAULT 1,
      payment_instructions TEXT NOT NULL DEFAULT '',
      payment_instructions_bn TEXT NOT NULL DEFAULT '',
      whatsapp_support_link TEXT NOT NULL DEFAULT '',
      email_support_address TEXT NOT NULL DEFAULT '',
      facebook_page_link TEXT NOT NULL DEFAULT '',
      telegram_support_link TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS admin_activity_logs (
      id TEXT PRIMARY KEY,
      admin_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      action TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      details TEXT NOT NULL DEFAULT '{}',
      ip_address TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_courses_slug ON courses(slug);
    CREATE INDEX IF NOT EXISTS idx_payments_trx ON payments(transaction_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);
  `);

  seedInitialData();
  seedInitialAdminFromEnv();
}

function seedInitialAdminFromEnv(): void {
  const adminCountRow = db
    .prepare("SELECT COUNT(*) as cnt FROM user_roles WHERE role = 'admin'")
    .get() as { cnt: number };
  if (adminCountRow.cnt > 0) return;

  const envEmail = process.env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase();
  const envPass = process.env.INITIAL_ADMIN_PASSWORD?.trim();
  const envName = process.env.INITIAL_ADMIN_NAME?.trim() || 'SERA Academy Director';

  if (envEmail && envPass && envPass.length >= 8) {
    const userId = uuid();
    db.prepare(
      `INSERT INTO profiles (id, email, full_name, phone, password_hash, email_verified)
       VALUES (?, ?, ?, ?, ?, 1)`
    ).run(userId, envEmail, envName, '01700000000', hashPassword(envPass));

    db.prepare(
      `INSERT INTO user_roles (id, user_id, role, assigned_by)
       VALUES (?, ?, 'admin', ?)`
    ).run(uuid(), userId, userId);
  }
}

function seedInitialData(): void {
  const settingsExists = db
    .prepare('SELECT id FROM website_settings WHERE id = 1')
    .get();

  if (!settingsExists) {
    const statsJson = JSON.stringify([
      { value: '4,200+', label: 'Active Learners', label_bn: 'সক্রিয় শিক্ষার্থী' },
      { value: '94%', label: 'Completion Rate', label_bn: 'কোর্স সমাপ্তির হার' },
      { value: '18', label: 'Industry Mentors', label_bn: 'ইন্ডাস্ট্রি মেন্টর' },
      { value: '24h', label: 'Payment Verification SLA', label_bn: 'পেমেন্ট ভেরিফিকেশন সময়' },
    ]);

    const whyChooseJson = JSON.stringify([
      {
        title: 'Private Structured Classrooms',
        title_bn: 'প্রাইভেট সুসংগঠিত ক্লাসরুম',
        description:
          'Every course delivers sequenced HD video modules, downloadable workbooks, and progress tracking inside a distraction-free workspace.',
        description_bn:
          'প্রতিটি কোর্সে রয়েছে ধাপে ধাপে সাজানো এইচডি ভিডিও মডিউল, ডাউনলোডযোগ্য ওয়ার্কবুক এবং প্রগ্রেস ট্র্যাকিং।',
      },
      {
        title: 'Verified bKash & Nagad Enrollment',
        title_bn: 'যাচাইকৃত বিকাশ ও নগদ পেমেন্ট',
        description:
          'Pay smoothly with local bKash or Nagad numbers. Each Transaction ID is manually audited by our team to protect learners.',
        description_bn:
          'সহজ বিকাশ বা নগদ পেমেন্টের মাধ্যমে ভর্তি হন। প্রতিটি ট্রানজেকশন আইডি আমাদের টিম দ্বারা যাচাই করা হয়।',
      },
      {
        title: 'Mandatory Mentor Communities',
        title_bn: 'বাধ্যতামূলক মেন্টর কমিউনিটি',
        description:
          'Verified membership in both Telegram and WhatsApp cohorts ensures every enrolled student stays connected to peers and instructors.',
        description_bn:
          'টেলিগ্রাম ও হোয়াটসঅ্যাপ উভয় কমিউনিটিতে ভেরিফায়েড যুক্ততা প্রতিটি শিক্ষার্থীর সক্রিয় শেখা নিশ্চিত করে।',
      },
      {
        title: 'Mobile-First Learning & Management',
        title_bn: 'মোবাইল-ফার্স্ট লার্নিং অভিজ্ঞতা',
        description:
          'Engineered from the ground up for Android phones, tablets, and desktops so you can study or manage cohorts anywhere.',
        description_bn:
          'অ্যান্ড্রয়েড ফোন, ট্যাবলেট এবং ডেস্কটপের জন্য সম্পূর্ণ উপযোগী ইন্টারফেস।',
      },
    ]);

    const testimonialsJson = JSON.stringify([
      {
        name: 'Tanvir Ahmed Chowdhury',
        role: 'Software Engineer',
        organization: 'Pathao Digital Systems',
        course: 'Full-Stack Web Engineering Cohort',
        quote:
          'Before joining SERA ACADEMY, I struggled to connect frontend state with secure backend databases. Within 10 weeks of guided lessons and Telegram code reviews, I shipped two production apps and passed my technical interview.',
        quote_bn:
          'সেরা একাডেমির গাইডেড লেসন ও টেলিগ্রাম কোড রিভিউয়ের মাধ্যমে ১০ সপ্তাহেই আমি প্রোডাকশন অ্যাপ তৈরি করতে শিখেছি।',
      },
      {
        name: 'Nusrat Jahan Mim',
        role: 'Product Designer',
        organization: 'Shikho Studio',
        course: 'Product UI/UX Systems & Figma',
        quote:
          'The downloadable component grids and weekly WhatsApp critique sessions transformed how I present case studies. My design system portfolio landed three senior callbacks in one month.',
        quote_bn:
          'ডাউনলোডযোগ্য ডিজাইন টেমপ্লেট ও সাপ্তাহিক হোয়াটসঅ্যাপ ফিডব্যাক সেশন আমার পোর্টফোলিওকে সম্পূর্ণ বদলে দিয়েছে।',
      },
      {
        name: 'Mahmudul Hasan Rafi',
        role: 'Security Analyst',
        organization: 'Dhaka FinTech Labs',
        course: 'Application Security & Cloud Defense',
        quote:
          'Unlike scattered video playlists, every module here builds on concrete threat modeling and lab checklists. The verification discipline kept our cohort focused from day one.',
        quote_bn:
          'এলোমেলো ভিডিওর বদলে এখানে প্রতিটি মডিউল বাস্তব ল্যাব ও সিকিউরিটি চেকলিস্ট দিয়ে সাজানো।',
      },
    ]);

    const faqJson = JSON.stringify([
      {
        question: 'How does manual bKash and Nagad payment verification work?',
        question_bn: 'বিকাশ ও নগদ ম্যানুয়াল পেমেন্ট যাচাই কীভাবে কাজ করে?',
        answer:
          'Select your course, send the listed fee to the official bKash or Nagad number, and submit your Transaction ID (TrxID) and sender phone number. Our admin team verifies every transaction and activates your enrollment.',
        answer_bn:
          'কোর্স নির্বাচন করে নির্ধারিত বিকাশ বা নগদ নম্বরে টাকা পাঠান এবং আপনার Transaction ID ও ফোন নম্বর জমা দিন। অ্যাডমিন যাচাইয়ের পর এনরোলমেন্ট সক্রিয় হবে।',
      },
      {
        question: 'Why are both Telegram and WhatsApp memberships mandatory?',
        question_bn: 'টেলিগ্রাম এবং হোয়াটসঅ্যাপ উভয় কমিউনিটিতে যুক্ত হওয়া বাধ্যতামূলক কেন?',
        answer:
          'Course announcements, resource drops, and live Q&A run across our Telegram channel and WhatsApp cohort group. Verifying both memberships guarantees you never miss critical updates or peer support before entering the classroom.',
        answer_bn:
          'কোর্সের আপডেট, রিসোর্স ও মেন্টর সাপোর্ট টেলিগ্রাম ও হোয়াটসঅ্যাপে পরিচালিত হয়। তাই ক্লাসরুম আনলকের আগে উভয় ভেরিফিকেশন সম্পন্ন করা বাধ্যতামূলক।',
      },
      {
        question: 'Can I watch lessons on my Android smartphone?',
        question_bn: 'আমি কি আমার অ্যান্ড্রয়েড স্মার্টফোন থেকে ক্লাস করতে পারব?',
        answer:
          'Yes. SERA ACADEMY is built mobile-first, allowing smooth video playback, progress tracking, PDF downloads, and payment submission directly from any Android or iOS browser.',
        answer_bn:
          'হ্যাঁ, SERA ACADEMY সম্পূর্ণ মোবাইল-বান্ধব, তাই যেকোনো অ্যান্ড্রয়েড বা আইওএস ব্রাউজার থেকেই ক্লাস, পেমেন্ট ও রিসোর্স ব্যবহার করা যাবে।',
      },
      {
        question: 'How long are video links valid inside the private classroom?',
        question_bn: 'প্রাইভেট ক্লাসরুমে ভিডিও লিংক কতক্ষণ সক্রিয় থাকে?',
        answer:
          'Every lesson uses short-lived signed URLs generated exclusively for verified, enrolled students. If a session pauses for an extended period, simply click play or refresh the lesson to issue a fresh signed stream.',
        answer_bn:
          'প্রতিটি লেসন এনরোলকৃত ও ভেরিফায়েড শিক্ষার্থীদের জন্য স্বল্পমেয়াদী সাইনড ইউআরএল দিয়ে চলে, যা নিরাপত্তা নিশ্চিত করে।',
      },
    ]);

    db.prepare(
      `INSERT INTO website_settings (
        id, site_name, logo_url, favicon_url, primary_color, accent_color,
        hero_title, hero_title_bn, hero_subtitle, hero_subtitle_bn,
        hero_cta_text, hero_cta_text_bn, hero_banner_url,
        about_title, about_text, about_text_bn,
        stats_json, why_choose_json, testimonials_json, faq_json,
        contact_email, contact_phone, contact_address, footer_text,
        bkash_number, bkash_enabled, nagad_number, nagad_enabled,
        payment_instructions, payment_instructions_bn,
        whatsapp_support_link, email_support_address, facebook_page_link, telegram_support_link
      ) VALUES (1, ?, '', '', '#0B1F3A', '#C89B3C', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, 1, ?, ?, ?, ?, ?, ?)`
    ).run(
      'SERA ACADEMY',
      'Master Career-Ready Skills with Structured Mentorship',
      'সুসংগঠিত মেন্টরশিপের সাথে অর্জন করুন ক্যারিয়ার-রেডি দক্ষতা',
      'Cohort-grade courses in Software Engineering, Product Design, Cybersecurity, and Growth Strategy—complete with private video classrooms, verified bKash & Nagad enrollment, and dedicated mentor communities.',
      'সফটওয়্যার ইঞ্জিনিয়ারিং, প্রোডাক্ট ডিজাইন, সাইবার সিকিউরিটি এবং গ্রোথ স্ট্র্যাটেজির প্রফেশনাল কোর্স—প্রাইভেট ভিডিও ক্লাসরুম, বিকাশ/নগদ এনরোলমেন্ট ও মেন্টর কমিউনিটিসহ।',
      'Browse All Courses',
      'সব কোর্স দেখুন',
      '/src/assets/images/hero_academy_campus_1795281746754.jpg',
      'Engineered for Serious Learners Across Bangladesh & Beyond',
      'SERA ACADEMY bridges the gap between theoretical tutorials and real industry execution. Every enrolled learner receives structured HD modules, downloadable workbooks, and mandatory peer accountability inside verified Telegram and WhatsApp cohorts.',
      'SERA ACADEMY তাত্ত্বিক টিউটোরিয়াল ও বাস্তব ইন্ডাস্ট্রির কাজের মধ্যে সেতুবন্ধন তৈরি করে। প্রতিটি কোর্সে রয়েছে এইচডি ভিডিও মডিউল, ওয়ার্কবুক এবং যাচাইকৃত টেলিগ্রাম ও হোয়াটসঅ্যাপ সাপোর্ট।',
      statsJson,
      whyChooseJson,
      testimonialsJson,
      faqJson,
      'support@seraacademy.com',
      '+880 1700-000000',
      'House 24, Road 11, Banani, Dhaka 1213',
      'SERA ACADEMY. Empowering disciplined digital mastery.',
      '01711-223344',
      '01811-223344',
      '1. Open your bKash or Nagad app and choose Send Money.\n2. Transfer the exact course fee to the official number above.\n3. Copy your Transaction ID (TrxID) and enter it with your sender phone number below.\n4. Our team manually verifies every payment and unlocks enrollment.',
      '১. আপনার বিকাশ বা নগদ অ্যাপ থেকে Send Money অপশনে যান।\n২. উপরে প্রদর্শিত অফিশিয়াল নম্বরে নির্ধারিত কোর্স ফি পাঠান।\n৩. আপনার Transaction ID (TrxID) এবং প্রেরকের মোবাইল নম্বর নিচে জমা দিন।\n৪. অ্যাডমিন যাচাই করার পর আপনার কোর্স এনরোলমেন্ট চালু হবে।',
      'https://wa.me/8801711223344',
      'support@seraacademy.com',
      'https://facebook.com/seraacademy',
      'https://t.me/seraacademy_support'
    );
  }

  const catCount = (db.prepare('SELECT COUNT(*) as cnt FROM course_categories').get() as { cnt: number }).cnt;
  if (catCount === 0) {
    const categories = [
      {
        id: uuid(),
        name: 'Software Engineering',
        name_bn: 'সফটওয়্যার ইঞ্জিনিয়ারিং',
        slug: 'software-engineering',
        description: 'Full-stack TypeScript, PostgreSQL, system architecture, and production deployment.',
        sort_order: 1,
      },
      {
        id: uuid(),
        name: 'Product & UI/UX Design',
        name_bn: 'প্রোডাক্ট ও ইউআই/ইউএক্স ডিজাইন',
        slug: 'product-design',
        description: 'Design systems, user research workflows, and interactive interface architecture.',
        sort_order: 2,
      },
      {
        id: uuid(),
        name: 'Cybersecurity & Cloud',
        name_bn: 'সাইবার সিকিউরিটি ও ক্লাউড',
        slug: 'cybersecurity-cloud',
        description: 'Application defense, RBAC security, threat modeling, and cloud hardening.',
        sort_order: 3,
      },
      {
        id: uuid(),
        name: 'Growth & Digital Strategy',
        name_bn: 'গ্রোথ ও ডিজিটাল স্ট্র্যাটেজি',
        slug: 'growth-strategy',
        description: 'Analytics-driven acquisition, conversion funnels, and brand positioning.',
        sort_order: 4,
      },
    ];

    const insertCat = db.prepare(
      `INSERT INTO course_categories (id, name, name_bn, slug, description, sort_order)
       VALUES (?, ?, ?, ?, ?, ?)`
    );
    for (const c of categories) {
      insertCat.run(c.id, c.name, c.name_bn, c.slug, c.description, c.sort_order);
    }

    const courses = [
      {
        id: uuid(),
        title: 'Full-Stack Web Engineering & PostgreSQL Architecture',
        title_bn: 'ফুল-স্ট্যাক ওয়েব ইঞ্জিনিয়ারিং ও পোস্টগ্রেএসকিউএল আর্কিটেকচার',
        slug: 'fullstack-web-engineering',
        thumbnail_url: '/src/assets/images/course_fullstack_eng_1795281745446.jpg',
        short_description:
          'Build production-grade TypeScript applications with Next.js, Node.js, PostgreSQL, authentication, and cloud deployment.',
        short_description_bn:
          'TypeScript, Next.js, Node.js ও PostgreSQL দিয়ে প্রোডাকশন-গ্রেড ওয়েব অ্যাপ্লিকেশন তৈরি করা শিখুন।',
        full_description:
          'This comprehensive 12-week engineering program guides you from clean TypeScript fundamentals through relational database modeling, role-based access control, payment workflow design, and automated Vercel deployment. Every module includes downloadable architecture blueprints and mentor code reviews.',
        full_description_bn:
          '১২ সপ্তাহের এই প্রোগ্রামে TypeScript, রিলেশনাল ডাটাবেস ডিজাইন, রোল-বেজড অ্যাক্সেস কন্ট্রোল এবং ক্লাউড ডিপ্লয়মেন্ট হাতে-কলমে শেখানো হয়।',
        category_id: categories[0].id,
        price: 6500,
        discount_price: 4500,
        instructor_name: 'Arifuzzaman Khan',
        instructor_slug: 'arifuzzaman-khan',
        instructor_title: 'Principal Systems Architect',
        instructor_bio:
          'Former lead platform engineer with 11+ years building high-throughput fintech and e-learning architectures across South Asia.',
        duration: '12 Weeks · 36 Lessons',
        level: 'Intermediate',
        language: 'Bengali & English',
        status: 'published',
        is_featured: 1,
        telegram_link: 'https://t.me/+sera_fullstack_cohort',
        whatsapp_link: 'https://chat.whatsapp.com/SeraFullStackCohort',
      },
      {
        id: uuid(),
        title: 'Executive Product UI/UX & Design Systems Mastery',
        title_bn: 'এক্সিকিউটিভ প্রোডাক্ট ইউআই/ইউএক্স ও ডিজাইন সিস্টেম মাস্টারি',
        slug: 'product-uiux-design-systems',
        thumbnail_url: '/src/assets/images/course_uiux_product_1795281745351.jpg',
        short_description:
          'Craft high-contrast interfaces, responsive mobile-first layouts, and scalable component tokens from research to handoff.',
        short_description_bn:
          'রিসার্চ থেকে শুরু করে স্কেলেবল ডিজাইন সিস্টেম ও মোবাইল-ফার্স্ট ইন্টারফেস ডিজাইন শিখুন।',
        full_description:
          'Learn how top product teams structure typographic hierarchies, accessibility contrast ratios, responsive grid systems, and developer-ready design tokens. Includes real SaaS dashboard critiques and mobile commerce case studies.',
        full_description_bn:
          'টাইপোগ্রাফি, কালার সিস্টেম, রেসপন্সিভ গ্রিড এবং রিয়েল প্রোডাক্ট কেস স্টাডির মাধ্যমে পূর্ণাঙ্গ UI/UX দক্ষতা অর্জন করুন।',
        category_id: categories[1].id,
        price: 5000,
        discount_price: 3500,
        instructor_name: 'Farhana Yasmin',
        instructor_slug: 'farhana-yasmin',
        instructor_title: 'Head of Product Design',
        instructor_bio:
          'Design director specializing in fintech mobile experiences, bilingual Bengali-English typography, and enterprise design systems.',
        duration: '8 Weeks · 24 Lessons',
        level: 'Beginner',
        language: 'Bengali & English',
        status: 'published',
        is_featured: 1,
        telegram_link: 'https://t.me/+sera_design_cohort',
        whatsapp_link: 'https://chat.whatsapp.com/SeraDesignCohort',
      },
      {
        id: uuid(),
        title: 'Application Cybersecurity & Cloud Infrastructure Defense',
        title_bn: 'অ্যাপ্লিকেশন সাইবার সিকিউরিটি ও ক্লাউড ডিফেন্স',
        slug: 'application-cybersecurity-defense',
        thumbnail_url: '/src/assets/images/course_cybersecurity_1795281745150.jpg',
        short_description:
          'Master threat modeling, OWASP Top 10 mitigation, PostgreSQL RLS hardening, and secure session architectures.',
        short_description_bn:
          'থ্রেট মডেলিং, OWASP Top 10 সুরক্ষা, এবং ডাটাবেস নিরাপত্তা ও সেশন আর্কিটেকচার শিখুন।',
        full_description:
          'Designed for developers and security analysts who want to audit and harden modern web applications. Covers password hashing with scrypt, HMAC signed URLs, SQL injection elimination, and incident response playbooks.',
        full_description_bn:
          'আধুনিক ওয়েব অ্যাপ্লিকেশনের নিরাপত্তা অডিট ও হার্ডেনিং শেখার জন্য বাস্তবভিত্তিক সাইবার সিকিউরিটি প্রোগ্রাম।',
        category_id: categories[2].id,
        price: 7000,
        discount_price: 5200,
        instructor_name: 'Tariqul Islam',
        instructor_slug: 'tariqul-islam',
        instructor_title: 'Lead Application Security Engineer',
        instructor_bio:
          'Certified security researcher and cloud defender advising banking and SaaS engineering teams on zero-trust architecture.',
        duration: '10 Weeks · 28 Lessons',
        level: 'Advanced',
        language: 'English & Bengali',
        status: 'published',
        is_featured: 1,
        telegram_link: 'https://t.me/+sera_security_cohort',
        whatsapp_link: 'https://chat.whatsapp.com/SeraSecurityCohort',
      },
      {
        id: uuid(),
        title: 'Data-Driven Growth Strategy & Conversion Analytics',
        title_bn: 'ডাটা-ড্রিভেন গ্রোথ স্ট্র্যাটেজি ও কনভার্শন অ্যানালিটিক্স',
        slug: 'data-driven-growth-strategy',
        thumbnail_url: '/src/assets/images/course_digital_marketing_1795281746036.jpg',
        short_description:
          'Build measurable acquisition engines, funnel attribution models, and retention playbooks for digital businesses.',
        short_description_bn:
          'ডিজিটাল ব্যবসার জন্য পরিমাপযোগ্য মার্কেটিং ফানেল, অ্যানালিটিক্স এবং গ্রোথ স্ট্র্যাটেজি তৈরি করুন।',
        full_description:
          'Move beyond guesswork marketing. Learn cohort retention analysis, landing page conversion testing, unit economics modeling, and ethical customer acquisition tailored to Bangladesh and global digital markets.',
        full_description_bn:
          'আন্দাজের পরিবর্তে ডাটা ও ফানেল অ্যানালিটিক্স ব্যবহার করে ব্যবসার গ্রোথ নিশ্চিত করার পূর্ণাঙ্গ গাইডলাইন।',
        category_id: categories[3].id,
        price: 4500,
        discount_price: 2900,
        instructor_name: 'Sadia Afrin',
        instructor_slug: 'sadia-afrin',
        instructor_title: 'VP of Growth & Revenue',
        instructor_bio:
          'Growth strategist who has scaled three subscription education platforms from launch to 50,000+ active paying members.',
        duration: '6 Weeks · 20 Lessons',
        level: 'All Levels',
        language: 'Bengali',
        status: 'published',
        is_featured: 0,
        telegram_link: 'https://t.me/+sera_growth_cohort',
        whatsapp_link: 'https://chat.whatsapp.com/SeraGrowthCohort',
      },
    ];

    const insertCourse = db.prepare(
      `INSERT INTO courses (
        id, title, title_bn, slug, thumbnail_url, short_description, short_description_bn,
        full_description, full_description_bn, category_id, price, discount_price,
        instructor_name, instructor_slug, instructor_title, instructor_bio,
        duration, level, language, status, is_featured
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    const insertComm = db.prepare(
      `INSERT INTO community_settings (
        id, course_id, telegram_link, telegram_chat_id, telegram_required,
        whatsapp_link, whatsapp_required, instructions, instructions_bn
      ) VALUES (?, ?, ?, '', 1, ?, 1, ?, ?)`
    );

    const insertChapter = db.prepare(
      `INSERT INTO chapters (id, course_id, title, title_bn, sort_order)
       VALUES (?, ?, ?, ?, ?)`
    );

    const insertLesson = db.prepare(
      `INSERT INTO lessons (
        id, course_id, chapter_id, title, title_bn, description,
        video_storage_path, duration_seconds, is_free_preview, sort_order
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    const insertResource = db.prepare(
      `INSERT INTO lesson_resources (id, lesson_id, course_id, title, file_storage_path, file_size_bytes, mime_type)
       VALUES (?, ?, ?, ?, ?, ?, 'application/pdf')`
    );

    for (const c of courses) {
      insertCourse.run(
        c.id,
        c.title,
        c.title_bn,
        c.slug,
        c.thumbnail_url,
        c.short_description,
        c.short_description_bn,
        c.full_description,
        c.full_description_bn,
        c.category_id,
        c.price,
        c.discount_price,
        c.instructor_name,
        c.instructor_slug,
        c.instructor_title,
        c.instructor_bio,
        c.duration,
        c.level,
        c.language,
        c.status,
        c.is_featured
      );

      insertComm.run(
        uuid(),
        c.id,
        c.telegram_link,
        c.whatsapp_link,
        'Join both the official Telegram channel and WhatsApp cohort group below. Submit your Telegram username/ID and WhatsApp phone number to unlock the private classroom.',
        'নিচের অফিশিয়াল টেলিগ্রাম চ্যানেল ও হোয়াটসঅ্যাপ গ্রুপ উভয়টিতে যুক্ত হয়ে আপনার তথ্য ভেরিফিকেশনের জন্য জমা দিন।'
      );

      const ch1Id = uuid();
      const ch2Id = uuid();
      insertChapter.run(ch1Id, c.id, 'Module 01: Foundations & Setup', 'মডিউল ০১: ভিত্তি ও সেটআপ', 1);
      insertChapter.run(ch2Id, c.id, 'Module 02: Core Architecture & Practice', 'মডিউল ০২: মূল আর্কিটেকচার ও প্র্যাকটিস', 2);

      const l1Id = uuid();
      const l2Id = uuid();
      const l3Id = uuid();
      insertLesson.run(
        l1Id,
        c.id,
        ch1Id,
        '01. Course Roadmap & Professional Environment',
        '০১. কোর্স রোডম্যাপ ও এনভায়রনমেন্ট সেটআপ',
        'Orientation walkthrough covering milestones, mentor feedback rules, and project setup.',
        'lesson_intro.mp4',
        480,
        1,
        1
      );
      insertLesson.run(
        l2Id,
        c.id,
        ch1Id,
        '02. Core Principles & Production Standards',
        '০২. মূল নীতিমালা ও প্রোডাকশন স্ট্যান্ডার্ড',
        'Deep dive into real-world patterns, edge cases, and architectural trade-offs.',
        'lesson_deep_dive.mp4',
        740,
        0,
        2
      );
      insertLesson.run(
        l3Id,
        c.id,
        ch2Id,
        '03. Guided Implementation Lab & Review',
        '০৩. গাইডেড ইমপ্লিমেন্টেশন ল্যাব ও রিভিউ',
        'Hands-on walkthrough implementing and testing the core system end to end.',
        'lesson_deep_dive.mp4',
        920,
        0,
        1
      );

      insertResource.run(
        uuid(),
        l1Id,
        c.id,
        `${c.title.split(' ')[0]} Cohort Workbook & Checklist (PDF)`,
        'course_workbook.pdf',
        689
      );
    }
  }
}

export function hasAdminAccount(): boolean {
  const row = db
    .prepare("SELECT COUNT(*) as cnt FROM user_roles WHERE role = 'admin'")
    .get() as { cnt: number };
  return row.cnt > 0;
}

export function getWebsiteSettings(): WebsiteSettings {
  const row = db.prepare('SELECT * FROM website_settings WHERE id = 1').get() as Record<string, unknown>;
  return {
    id: Number(row.id),
    site_name: String(row.site_name || 'SERA ACADEMY'),
    logo_url: String(row.logo_url || ''),
    favicon_url: String(row.favicon_url || ''),
    primary_color: String(row.primary_color || '#0B1F3A'),
    accent_color: String(row.accent_color || '#C89B3C'),
    hero_title: String(row.hero_title || ''),
    hero_title_bn: String(row.hero_title_bn || ''),
    hero_subtitle: String(row.hero_subtitle || ''),
    hero_subtitle_bn: String(row.hero_subtitle_bn || ''),
    hero_cta_text: String(row.hero_cta_text || ''),
    hero_cta_text_bn: String(row.hero_cta_text_bn || ''),
    hero_banner_url: String(row.hero_banner_url || ''),
    about_title: String(row.about_title || ''),
    about_text: String(row.about_text || ''),
    about_text_bn: String(row.about_text_bn || ''),
    stats_json: safeJsonParse(String(row.stats_json || '[]'), []),
    why_choose_json: safeJsonParse(String(row.why_choose_json || '[]'), []),
    testimonials_json: safeJsonParse(String(row.testimonials_json || '[]'), []),
    faq_json: safeJsonParse(String(row.faq_json || '[]'), []),
    contact_email: String(row.contact_email || ''),
    contact_phone: String(row.contact_phone || ''),
    contact_address: String(row.contact_address || ''),
    footer_text: String(row.footer_text || ''),
    bkash_number: String(row.bkash_number || ''),
    bkash_enabled: Boolean(row.bkash_enabled),
    nagad_number: String(row.nagad_number || ''),
    nagad_enabled: Boolean(row.nagad_enabled),
    payment_instructions: String(row.payment_instructions || ''),
    payment_instructions_bn: String(row.payment_instructions_bn || ''),
    whatsapp_support_link: String(row.whatsapp_support_link || ''),
    email_support_address: String(row.email_support_address || ''),
    facebook_page_link: String(row.facebook_page_link || ''),
    telegram_support_link: String(row.telegram_support_link || ''),
    updated_at: String(row.updated_at || ''),
  };
}

function safeJsonParse<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function createNotification(params: {
  userId: string;
  eventType: string;
  title: string;
  message: string;
  link?: string;
}): void {
  db.prepare(
    `INSERT INTO notifications (id, user_id, event_type, title, message, link)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(uuid(), params.userId, params.eventType, params.title, params.message, params.link || '');
}

export function logAdminAction(params: {
  adminId: string;
  action: string;
  targetType: string;
  targetId: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
}): void {
  db.prepare(
    `INSERT INTO admin_activity_logs (id, admin_id, action, target_type, target_id, details, ip_address)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    uuid(),
    params.adminId,
    params.action,
    params.targetType,
    params.targetId,
    JSON.stringify(params.details || {}),
    params.ipAddress || ''
  );
}

export function checkCourseAccess(userId: string, courseId: string): {
  enrolled: boolean;
  telegramOk: boolean;
  whatsappOk: boolean;
  hasFullAccess: boolean;
} {
  const enrollment = db
    .prepare(
      `SELECT e.status, p.is_blocked
       FROM enrollments e
       JOIN profiles p ON p.id = e.user_id
       WHERE e.user_id = ? AND e.course_id = ?`
    )
    .get(userId, courseId) as { status: string; is_blocked: number } | undefined;

  if (!enrollment || enrollment.status !== 'active' || enrollment.is_blocked === 1) {
    return { enrolled: false, telegramOk: false, whatsappOk: false, hasFullAccess: false };
  }

  const cs = db
    .prepare('SELECT telegram_required, whatsapp_required FROM community_settings WHERE course_id = ?')
    .get(courseId) as { telegram_required: number; whatsapp_required: number } | undefined;

  const cm = db
    .prepare(
      'SELECT telegram_status, whatsapp_status FROM community_memberships WHERE user_id = ? AND course_id = ?'
    )
    .get(userId, courseId) as { telegram_status: string; whatsapp_status: string } | undefined;

  const tgReq = cs ? cs.telegram_required === 1 : true;
  const waReq = cs ? cs.whatsapp_required === 1 : true;
  const telegramOk = !tgReq || cm?.telegram_status === 'verified';
  const whatsappOk = !waReq || cm?.whatsapp_status === 'verified';

  return {
    enrolled: true,
    telegramOk,
    whatsappOk,
    hasFullAccess: telegramOk && whatsappOk,
  };
}
