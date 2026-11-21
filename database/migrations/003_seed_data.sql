-- ============================================================================
-- SERA ACADEMY — Initial Seed Data (003)
-- ============================================================================

INSERT INTO public.course_categories (name, name_bn, slug, description, sort_order)
VALUES
  ('Software Engineering', 'সফটওয়্যার ইঞ্জিনিয়ারিং', 'software-engineering', 'Full-stack web systems, APIs, and scalable architecture.', 1),
  ('Product & UI/UX Design', 'প্রোডাক্ট ও ইউআই/ইউএক্স ডিজাইন', 'product-design', 'Design systems, user research, and interactive prototyping.', 2),
  ('Cybersecurity & Cloud', 'সাইবার সিকিউরিটি ও ক্লাউড', 'cybersecurity-cloud', 'Application security, penetration testing, and cloud defense.', 3),
  ('Growth & Digital Strategy', 'গ্রোথ ও ডিজিটাল স্ট্র্যাটেজি', 'growth-strategy', 'Data-driven marketing, funnel analytics, and brand scaling.', 4)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.website_settings (
  id, site_name, primary_color, accent_color,
  hero_title, hero_title_bn,
  hero_subtitle, hero_subtitle_bn,
  hero_cta_text, hero_cta_text_bn,
  about_title, about_text, about_text_bn,
  contact_email, contact_phone, contact_address, footer_text,
  bkash_number, bkash_enabled, nagad_number, nagad_enabled,
  payment_instructions, payment_instructions_bn,
  whatsapp_support_link, email_support_address, facebook_page_link, telegram_support_link
)
VALUES (
  1, 'SERA ACADEMY', '#0B1F3A', '#C89B3C',
  'Master Practical Skills with Verified Mentorship',
  'দক্ষ প্রশিক্ষকদের সাথে বাস্তবভিত্তিক স্কিল অর্জন করুন',
  'Structured cohort-grade courses in Engineering, Design, Cybersecurity, and Growth Strategy—complete with private video classrooms and dedicated mentor communities.',
  'ইঞ্জিনিয়ারিং, ডিজাইন, সাইবার সিকিউরিটি এবং গ্রোথ স্ট্র্যাটেজির প্রফেশনাল কোর্স—প্রাইভেট ভিডিও ক্লাসরুম ও মেন্টর কমিউনিটিসহ।',
  'Explore Courses',
  'কোর্সগুলো দেখুন',
  'Built for Career-Ready Mastery',
  'SERA ACADEMY pairs practical, industry-aligned curricula with direct community accountability. Every enrollment includes private HD lessons, downloadable templates, and verified Telegram & WhatsApp mentor channels.',
  'SERA ACADEMY-তে প্রতিটি কোর্স বাস্তব প্রজেক্ট, ডাউনলোডযোগ্য রিসোর্স এবং সরাসরি মেন্টর সাপোর্টের মাধ্যমে সাজানো হয়েছে।',
  'support@seraacademy.com', '+880 1700-000000', 'Banani, Dhaka 1213, Bangladesh',
  'SERA ACADEMY. All rights reserved.',
  '01711-000000', TRUE, '01811-000000', TRUE,
  'Send Money via bKash or Nagad Personal/Merchant to the number shown above. Enter your exact Transaction ID (TrxID) and sender phone number below. Access is granted after admin verification.',
  'উপরে দেওয়া বিকাশ বা নগদ নম্বরে সেন্ড মানি বা পেমেন্ট করুন। এরপর নিচে আপনার সঠিক Transaction ID (TrxID) এবং প্রেরকের মোবাইল নম্বর জমা দিন। অ্যাডমিন যাচাইয়ের পর কোর্স অ্যাক্সেস চালু হবে।',
  'https://wa.me/8801700000000', 'support@seraacademy.com', 'https://facebook.com/seraacademy', 'https://t.me/seraacademy_support'
)
ON CONFLICT (id) DO NOTHING;
