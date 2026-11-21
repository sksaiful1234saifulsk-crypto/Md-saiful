import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  Download,
  Lock,
  Play,
  ShieldAlert,
} from 'lucide-react';
import type { Chapter, Course, LessonPublic } from '../../types/academy';
import { useApp } from '../../context/AppContext';
import { apiRequest, ApiError } from '../../lib/api';

interface ClassroomData {
  course: Course;
  chapters: Chapter[];
  progress: {
    completed: number;
    total: number;
    percent: number;
  };
}

export function StudentClassroom({ slug }: { slug: string }) {
  const { lang, navigate } = useApp();
  const [classroom, setClassroom] = useState<ClassroomData | null>(null);
  const [activeLesson, setActiveLesson] = useState<LessonPublic | null>(null);
  const [signedVideoUrl, setSignedVideoUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [videoLoading, setVideoLoading] = useState(false);
  const [gateError, setGateError] = useState<{ code?: string; message: string } | null>(null);

  const loadClassroom = async () => {
    setLoading(true);
    setGateError(null);
    try {
      const res = await apiRequest<ClassroomData>(
        `/api/student/classroom/${encodeURIComponent(slug)}`
      );
      setClassroom(res);

      // Select first lesson if none active
      const allLessons = res.chapters.flatMap((c) => c.lessons || []);
      if (allLessons.length > 0) {
        const target =
          (activeLesson && allLessons.find((l) => l.id === activeLesson.id)) ||
          allLessons.find((l) => !l.completed) ||
          allLessons[0];
        setActiveLesson(target);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setGateError({
          code: String(err.data?.code || ''),
          message: err.message,
        });
      } else {
        setGateError({ message: 'Unable to open classroom.' });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadClassroom();
  }, [slug]);

  useEffect(() => {
    if (!activeLesson || !activeLesson.has_video) {
      setSignedVideoUrl('');
      return;
    }
    void (async () => {
      setVideoLoading(true);
      try {
        const res = await apiRequest<{ signedUrl: string }>(
          `/api/student/lessons/${encodeURIComponent(activeLesson.id)}/signed-url`,
          { method: 'POST' }
        );
        setSignedVideoUrl(res.signedUrl);
      } catch {
        setSignedVideoUrl('');
      } finally {
        setVideoLoading(false);
      }
    })();
  }, [activeLesson?.id]);

  const toggleLessonComplete = async (lesson: LessonPublic) => {
    const nextState = !lesson.completed;
    await apiRequest(`/api/student/lessons/${encodeURIComponent(lesson.id)}/progress`, {
      method: 'POST',
      body: JSON.stringify({ completed: nextState }),
    });
    await loadClassroom();
  };

  const handleDownloadResource = async (resourceId: string) => {
    try {
      const res = await apiRequest<{ signedUrl: string }>(
        `/api/student/resources/${encodeURIComponent(resourceId)}/signed-url`
      );
      window.location.assign(res.signedUrl);
    } catch {
      // handled cleanly
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12">
        <div className="h-[420px] animate-pulse rounded-xl border border-slate-200 bg-white" />
      </div>
    );
  }

  if (gateError) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <div className="rounded-xl border border-amber-200 bg-white p-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700">
            {gateError.code === 'COMMUNITY_REQUIRED' ? (
              <ShieldAlert className="h-6 w-6" />
            ) : (
              <Lock className="h-6 w-6" />
            )}
          </div>
          <h1 className="mt-4 font-display text-2xl font-bold text-slate-900">
            {gateError.code === 'COMMUNITY_REQUIRED'
              ? lang === 'bn'
                ? 'কমিউনিটি ভেরিফিকেশন প্রয়োজন'
                : 'Community Verification Required'
              : lang === 'bn'
                ? 'অ্যাক্সেস অনুমোদিত নয়'
                : 'Classroom Access Locked'}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">{gateError.message}</p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            {gateError.code === 'COMMUNITY_REQUIRED' ? (
              <button
                type="button"
                onClick={() => navigate('/student/community')}
                className="h-11 rounded-lg bg-[var(--brand-primary)] px-6 text-sm font-semibold text-white"
              >
                {lang === 'bn' ? 'টেলিগ্রাম ও হোয়াটসঅ্যাপ ভেরিফাই করুন' : 'Complete Community Verification'}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => navigate(`/courses/${slug}`)}
                className="h-11 rounded-lg bg-[var(--brand-primary)] px-6 text-sm font-semibold text-white"
              >
                {lang === 'bn' ? 'কোর্স পেজে যান' : 'View Course Details'}
              </button>
            )}
            <button
              type="button"
              onClick={() => navigate('/student')}
              className="h-11 rounded-lg border border-slate-300 px-5 text-sm font-medium text-slate-700"
            >
              {lang === 'bn' ? 'ড্যাশবোর্ডে ফিরুন' : 'Back to Dashboard'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!classroom) return null;

  return (
    <div className="min-h-screen bg-slate-50 pb-14">
      {/* Classroom Top Bar */}
      <div className="border-b border-slate-200 bg-[#0B1F3A] text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => navigate('/student/courses')}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-slate-700 px-3 text-xs font-medium text-slate-200 hover:bg-slate-800"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>{lang === 'bn' ? 'ড্যাশবোর্ড' : 'My Courses'}</span>
            </button>
            <h1 className="truncate font-display text-base font-semibold sm:text-lg">
              {lang === 'bn' && classroom.course.title_bn
                ? classroom.course.title_bn
                : classroom.course.title}
            </h1>
          </div>

          <div className="flex items-center gap-3 text-xs tabular-nums">
            <span className="text-slate-300">
              {classroom.progress.completed}/{classroom.progress.total}{' '}
              {lang === 'bn' ? 'সম্পন্ন' : 'Completed'}
            </span>
            <div className="h-2 w-28 overflow-hidden rounded-full bg-slate-700">
              <div
                className="h-full bg-[var(--brand-accent)] transition-all"
                style={{ width: `${classroom.progress.percent}%` }}
              />
            </div>
            <span className="font-bold text-[var(--brand-accent)]">
              {classroom.progress.percent}%
            </span>
          </div>
        </div>
      </div>

      {/* Main Split Stage + Curriculum Deck */}
      <div className="mx-auto mt-6 max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Video Stage & Lesson Info */}
          <div className="space-y-5 lg:col-span-8">
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-950">
              {videoLoading ? (
                <div className="flex aspect-video items-center justify-center text-sm text-slate-300">
                  Authorizing signed video stream...
                </div>
              ) : signedVideoUrl ? (
                <video
                  key={signedVideoUrl}
                  controls
                  controlsList="nodownload"
                  playsInline
                  className="aspect-video w-full bg-black"
                  onEnded={() => {
                    if (activeLesson && !activeLesson.completed) {
                      void toggleLessonComplete(activeLesson);
                    }
                  }}
                >
                  <source src={signedVideoUrl} type="video/mp4" />
                  Your browser does not support HTML5 video playback.
                </video>
              ) : (
                <div className="flex aspect-video flex-col items-center justify-center p-6 text-center text-slate-300">
                  <Play className="h-10 w-10 text-slate-500 mb-2" />
                  <p className="text-sm">No video uploaded for this lesson yet.</p>
                </div>
              )}
            </div>

            {activeLesson && (
              <div className="rounded-xl border border-slate-200 bg-white p-6">
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                  <div>
                    <h2 className="font-display text-xl font-bold text-slate-900">
                      {lang === 'bn' && activeLesson.title_bn
                        ? activeLesson.title_bn
                        : activeLesson.title}
                    </h2>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">
                      {activeLesson.description || 'Structured video lesson module.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleLessonComplete(activeLesson)}
                    className={`inline-flex h-11 shrink-0 items-center gap-2 rounded-lg px-4 text-sm font-semibold transition-colors ${
                      activeLesson.completed
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-[var(--brand-primary)] text-white'
                    }`}
                  >
                    {activeLesson.completed ? (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        <span>{lang === 'bn' ? 'সম্পন্ন হয়েছে' : 'Completed'}</span>
                      </>
                    ) : (
                      <>
                        <Circle className="h-4 w-4" />
                        <span>{lang === 'bn' ? 'সম্পন্ন হিসেবে চিহ্নিত করুন' : 'Mark Complete'}</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Lesson PDF / Workbook Resources */}
                {activeLesson.resources && activeLesson.resources.length > 0 && (
                  <div className="mt-6 border-t border-slate-100 pt-5">
                    <h3 className="font-display text-sm font-semibold text-slate-900">
                      {lang === 'bn' ? 'লেসন রিসোর্স ও পিডিএফ' : 'Lesson Resources & Downloads'}
                    </h3>
                    <div className="mt-3 space-y-2">
                      {activeLesson.resources.map((res) => (
                        <button
                          key={res.id}
                          type="button"
                          onClick={() => handleDownloadResource(res.id)}
                          className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-left text-sm hover:border-[var(--brand-primary)] hover:bg-white transition-colors"
                        >
                          <span className="font-medium text-slate-800">{res.title}</span>
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--brand-primary)]">
                            <Download className="h-4 w-4" />
                            <span>Download</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Chapters & Lessons Sidebar */}
          <aside className="lg:col-span-4">
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <div className="border-b border-slate-200 px-5 py-4">
                <h2 className="font-display text-base font-bold text-slate-900">
                  {lang === 'bn' ? 'কোর্স লেসনসমূহ' : 'Course Content'}
                </h2>
              </div>
              <div className="max-h-[600px] overflow-y-auto divide-y divide-slate-200">
                {classroom.chapters.map((ch, idx) => (
                  <div key={ch.id}>
                    <div className="bg-slate-50 px-4 py-2.5 text-xs font-semibold text-slate-700">
                      {String(idx + 1).padStart(2, '0')}.{' '}
                      {lang === 'bn' && ch.title_bn ? ch.title_bn : ch.title}
                    </div>
                    <div className="divide-y divide-slate-100">
                      {(ch.lessons || []).map((lesson) => {
                        const isActive = activeLesson?.id === lesson.id;
                        return (
                          <button
                            key={lesson.id}
                            type="button"
                            onClick={() => setActiveLesson(lesson)}
                            className={`flex w-full items-start gap-3 px-4 py-3 text-left text-sm transition-colors ${
                              isActive ? 'bg-[#0B1F3A]/5 font-semibold text-[var(--brand-primary)]' : 'hover:bg-slate-50 text-slate-700'
                            }`}
                          >
                            {lesson.completed ? (
                              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                            ) : (
                              <Play className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="truncate">
                                {lang === 'bn' && lesson.title_bn ? lesson.title_bn : lesson.title}
                              </div>
                              <div className="mt-0.5 text-xs text-slate-400 tabular-nums">
                                {lesson.duration_seconds
                                  ? `${Math.ceil(lesson.duration_seconds / 60)} min`
                                  : 'Video'}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
