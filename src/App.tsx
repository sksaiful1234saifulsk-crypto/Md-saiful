import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { BrandHeader } from './components/common/BrandHeader';
import { SiteFooter } from './components/common/SiteFooter';
import { HomePage } from './pages/HomePage';
import { CoursesPage } from './pages/CoursesPage';
import { CourseDetailPage } from './pages/CourseDetailPage';
import {
  AboutPage,
  ContactSupportPage,
  InstructorDetailPage,
  LegalPage,
} from './pages/PublicInfoPages';
import { AuthPages } from './pages/AuthPages';
import { StudentDashboard } from './pages/student/StudentDashboard';
import { StudentClassroom } from './pages/student/StudentClassroom';
import { AdminDashboard } from './pages/admin/AdminDashboard';

function RouterView() {
  const { currentPath } = useApp();
  const cleanPath = currentPath.split('?')[0].replace(/\/+$/, '') || '/';

  if (cleanPath === '/') {
    return <HomePage />;
  }
  if (cleanPath === '/courses') {
    return <CoursesPage mode="courses" />;
  }
  if (cleanPath === '/categories') {
    return <CoursesPage mode="categories" />;
  }
  if (cleanPath.startsWith('/courses/')) {
    const slug = cleanPath.slice('/courses/'.length);
    return <CourseDetailPage slug={slug} />;
  }
  if (cleanPath.startsWith('/instructors/')) {
    const slug = cleanPath.slice('/instructors/'.length);
    return <InstructorDetailPage slug={slug} />;
  }
  if (cleanPath === '/about') {
    return <AboutPage />;
  }
  if (cleanPath === '/contact') {
    return <ContactSupportPage mode="contact" />;
  }
  if (cleanPath === '/support') {
    return <ContactSupportPage mode="support" />;
  }
  if (cleanPath === '/privacy-policy') {
    return <LegalPage type="privacy" />;
  }
  if (cleanPath === '/terms') {
    return <LegalPage type="terms" />;
  }
  if (cleanPath === '/refund-policy') {
    return <LegalPage type="refund" />;
  }
  if (cleanPath === '/auth/login') {
    return <AuthPages mode="login" />;
  }
  if (cleanPath === '/auth/register') {
    return <AuthPages mode="register" />;
  }
  if (cleanPath === '/auth/forgot-password') {
    return <AuthPages mode="forgot" />;
  }
  if (cleanPath === '/auth/reset-password') {
    return <AuthPages mode="reset" />;
  }
  if (cleanPath === '/auth/admin-setup') {
    return <AuthPages mode="admin-setup" />;
  }
  if (cleanPath.startsWith('/student/classroom/')) {
    const slug = cleanPath.slice('/student/classroom/'.length);
    return <StudentClassroom slug={slug} />;
  }
  if (cleanPath === '/student') {
    return <StudentDashboard initialTab="overview" />;
  }
  if (cleanPath === '/student/courses') {
    return <StudentDashboard initialTab="courses" />;
  }
  if (cleanPath === '/student/payments') {
    return <StudentDashboard initialTab="payments" />;
  }
  if (cleanPath === '/student/community') {
    return <StudentDashboard initialTab="community" />;
  }
  if (cleanPath === '/student/notifications') {
    return <StudentDashboard initialTab="notifications" />;
  }
  if (cleanPath === '/student/support') {
    return <StudentDashboard initialTab="support" />;
  }
  if (cleanPath === '/student/settings') {
    return <StudentDashboard initialTab="settings" />;
  }
  if (cleanPath === '/admin') {
    return <AdminDashboard />;
  }

  return <HomePage />;
}

export default function App() {
  return (
    <AppProvider>
      <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
        <BrandHeader />
        <div className="flex-1">
          <RouterView />
        </div>
        <SiteFooter />
      </div>
    </AppProvider>
  );
}
