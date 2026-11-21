import React, { useEffect, useState } from 'react';
import {
  Plus,
  Trash2,
  Edit3,
  Upload,
  ArrowUp,
  ArrowDown,
  Video,
  FileText,
  ChevronRight,
} from 'lucide-react';
import type { Chapter, Course, CourseCategory } from '../../types/academy';
import { apiRequest } from '../../lib/api';

export function AdminCourseManager() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [categories, setCategories] = useState<CourseCategory[]>([]);
  const [subTab, setSubTab] = useState<'courses' | 'categories'>('courses');
  const [editingCourse, setEditingCourse] = useState<Partial<Course> | null>(null);
  const [curriculumCourse, setCurriculumCourse] = useState<Course | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [newChapterTitle, setNewChapterTitle] = useState('');
  const [newLessonForm, setNewLessonForm] = useState<{
    chapter_id: string;
    title: string;
    description: string;
    duration_seconds: number;
    is_free_preview: boolean;
  }>({
    chapter_id: '',
    title: '',
    description: '',
    duration_seconds: 300,
    is_free_preview: false,
  });
  const [catForm, setCatForm] = useState({ id: '', name: '', name_bn: '', slug: '', description: '' });
  const [statusMsg, setStatusMsg] = useState('');

  const loadData = async () => {
    const [cRes, catRes] = await Promise.all([
      apiRequest<{ courses: Course[] }>('/api/admin/courses'),
      apiRequest<{ categories: CourseCategory[] }>('/api/admin/categories'),
    ]);
    setCourses(cRes.courses);
    setCategories(catRes.categories);
  };

  useEffect(() => {
    void loadData();
  }, []);

  const loadCurriculum = async (course: Course) => {
    setCurriculumCourse(course);
    const res = await apiRequest<{ chapters: Chapter[] }>(
      `/api/admin/courses/${encodeURIComponent(course.id)}/curriculum`
    );
    setChapters(res.chapters);
    if (res.chapters.length > 0 && !newLessonForm.chapter_id) {
      setNewLessonForm((f) => ({ ...f, chapter_id: res.chapters[0].id }));
    }
  };

  const handleUploadThumbnail = async (file: File) => {
    const fd = new FormData();
    fd.append('image', file);
    const res = await apiRequest<{ url: string }>('/api/admin/upload/image', {
      method: 'POST',
      body: fd,
    });
    setEditingCourse((prev) => (prev ? { ...prev, thumbnail_url: res.url } : prev));
  };

  const handleSaveCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCourse) return;
    setStatusMsg('');
    if (editingCourse.id) {
      await apiRequest(`/api/admin/courses/${encodeURIComponent(editingCourse.id)}`, {
        method: 'PUT',
        body: JSON.stringify(editingCourse),
      });
      setStatusMsg('Course updated.');
    } else {
      await apiRequest('/api/admin/courses', {
        method: 'POST',
        body: JSON.stringify(editingCourse),
      });
      setStatusMsg('Course created.');
    }
    setEditingCourse(null);
    await loadData();
  };

  const handleQuickToggle = async (course: Course, field: 'status' | 'is_featured') => {
    const payload = {
      ...course,
      status:
        field === 'status'
          ? course.status === 'published'
            ? 'draft'
            : 'published'
          : course.status,
      is_featured: field === 'is_featured' ? !course.is_featured : course.is_featured,
    };
    await apiRequest(`/api/admin/courses/${encodeURIComponent(course.id)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    await loadData();
  };

  const handleDeleteCourse = async (id: string) => {
    await apiRequest(`/api/admin/courses/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (curriculumCourse?.id === id) setCurriculumCourse(null);
    await loadData();
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (catForm.id) {
      await apiRequest(`/api/admin/categories/${encodeURIComponent(catForm.id)}`, {
        method: 'PUT',
        body: JSON.stringify(catForm),
      });
    } else {
      await apiRequest('/api/admin/categories', {
        method: 'POST',
        body: JSON.stringify(catForm),
      });
    }
    setCatForm({ id: '', name: '', name_bn: '', slug: '', description: '' });
    await loadData();
  };

  const handleAddChapter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!curriculumCourse || !newChapterTitle.trim()) return;
    await apiRequest('/api/admin/chapters', {
      method: 'POST',
      body: JSON.stringify({ course_id: curriculumCourse.id, title: newChapterTitle }),
    });
    setNewChapterTitle('');
    await loadCurriculum(curriculumCourse);
  };

  const handleMoveChapter = async (idx: number, dir: -1 | 1) => {
    if (!curriculumCourse) return;
    const target = idx + dir;
    if (target < 0 || target >= chapters.length) return;
    const copy = [...chapters];
    const [moved] = copy.splice(idx, 1);
    copy.splice(target, 0, moved);
    await apiRequest('/api/admin/chapters/reorder', {
      method: 'POST',
      body: JSON.stringify({ ordered_ids: copy.map((c) => c.id) }),
    });
    await loadCurriculum(curriculumCourse);
  };

  const handleAddLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!curriculumCourse || !newLessonForm.chapter_id || !newLessonForm.title.trim()) return;
    await apiRequest('/api/admin/lessons', {
      method: 'POST',
      body: JSON.stringify({
        course_id: curriculumCourse.id,
        ...newLessonForm,
      }),
    });
    setNewLessonForm({ ...newLessonForm, title: '', description: '' });
    await loadCurriculum(curriculumCourse);
  };

  const handleMoveLesson = async (chapter: Chapter, idx: number, dir: -1 | 1) => {
    if (!curriculumCourse || !chapter.lessons) return;
    const target = idx + dir;
    if (target < 0 || target >= chapter.lessons.length) return;
    const copy = [...chapter.lessons];
    const [moved] = copy.splice(idx, 1);
    copy.splice(target, 0, moved);
    await apiRequest('/api/admin/lessons/reorder', {
      method: 'POST',
      body: JSON.stringify({ ordered_ids: copy.map((l) => l.id) }),
    });
    await loadCurriculum(curriculumCourse);
  };

  const handleUploadLessonVideo = async (lessonId: string, file: File) => {
    if (!curriculumCourse) return;
    setStatusMsg('Uploading private lesson video...');
    const fd = new FormData();
    fd.append('video', file);
    await apiRequest(`/api/admin/lessons/${encodeURIComponent(lessonId)}/video`, {
      method: 'POST',
      body: fd,
    });
    setStatusMsg('Private lesson video uploaded.');
    await loadCurriculum(curriculumCourse);
  };

  const handleDeleteLessonVideo = async (lessonId: string) => {
    if (!curriculumCourse) return;
    await apiRequest(`/api/admin/lessons/${encodeURIComponent(lessonId)}/video`, {
      method: 'DELETE',
    });
    await loadCurriculum(curriculumCourse);
  };

  const handleUploadResource = async (lessonId: string, file: File) => {
    if (!curriculumCourse) return;
    const fd = new FormData();
    fd.append('resource', file);
    fd.append('title', file.name);
    await apiRequest(`/api/admin/lessons/${encodeURIComponent(lessonId)}/resources`, {
      method: 'POST',
      body: fd,
    });
    setStatusMsg('Lesson resource uploaded.');
    await loadCurriculum(curriculumCourse);
  };

  return (
    <div className="space-y-6">
      {/* Sub-navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setSubTab('courses')}
            className={`rounded-md px-3.5 py-2 text-xs font-semibold ${
              subTab === 'courses' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
            }`}
          >
            Courses ({courses.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab('categories')}
            className={`rounded-md px-3.5 py-2 text-xs font-semibold ${
              subTab === 'categories' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
            }`}
          >
            Categories ({categories.length})
          </button>
        </div>

        {subTab === 'courses' && (
          <button
            type="button"
            onClick={() =>
              setEditingCourse({
                title: '',
                title_bn: '',
                slug: '',
                thumbnail_url: '',
                short_description: '',
                short_description_bn: '',
                full_description: '',
                full_description_bn: '',
                category_id: categories[0]?.id || '',
                price: 3500,
                discount_price: null,
                instructor_name: '',
                instructor_title: 'Lead Instructor',
                instructor_bio: '',
                duration: '8 Weeks',
                level: 'Beginner',
                language: 'Bengali & English',
                status: 'draft',
                is_featured: false,
              })
            }
            className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-[var(--brand-primary)] px-4 text-xs font-semibold text-white"
          >
            <Plus className="h-4 w-4" />
            <span>Create Course</span>
          </button>
        )}
      </div>

      {statusMsg && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-medium text-emerald-800">
          {statusMsg}
        </div>
      )}

      {/* COURSE EDITOR MODAL / PANEL */}
      {editingCourse && (
        <form
          onSubmit={handleSaveCourse}
          className="rounded-xl border border-slate-200 bg-white p-6 space-y-4"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="font-display text-lg font-bold text-slate-900">
              {editingCourse.id ? 'Edit Course' : 'Create New Course'}
            </h2>
            <button
              type="button"
              onClick={() => setEditingCourse(null)}
              className="text-xs font-medium text-slate-500 hover:text-slate-900"
            >
              Cancel
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700">Course Title (EN)</label>
              <input
                type="text"
                required
                value={editingCourse.title || ''}
                onChange={(e) => setEditingCourse({ ...editingCourse, title: e.target.value })}
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Course Title (BN)</label>
              <input
                type="text"
                value={editingCourse.title_bn || ''}
                onChange={(e) => setEditingCourse({ ...editingCourse, title_bn: e.target.value })}
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Course Slug</label>
              <input
                type="text"
                placeholder="auto-generated-from-title"
                value={editingCourse.slug || ''}
                onChange={(e) => setEditingCourse({ ...editingCourse, slug: e.target.value })}
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 font-mono text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Category</label>
              <select
                value={editingCourse.category_id || ''}
                onChange={(e) => setEditingCourse({ ...editingCourse, category_id: e.target.value })}
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm"
              >
                <option value="">Uncategorized</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Price (৳)</label>
              <input
                type="number"
                required
                min={0}
                value={editingCourse.price ?? 0}
                onChange={(e) => setEditingCourse({ ...editingCourse, price: Number(e.target.value) })}
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Discount Price (৳, optional)</label>
              <input
                type="number"
                min={0}
                value={editingCourse.discount_price ?? ''}
                onChange={(e) =>
                  setEditingCourse({
                    ...editingCourse,
                    discount_price: e.target.value === '' ? null : Number(e.target.value),
                  })
                }
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Instructor Name</label>
              <input
                type="text"
                required
                value={editingCourse.instructor_name || ''}
                onChange={(e) =>
                  setEditingCourse({ ...editingCourse, instructor_name: e.target.value })
                }
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Duration</label>
              <input
                type="text"
                value={editingCourse.duration || ''}
                onChange={(e) => setEditingCourse({ ...editingCourse, duration: e.target.value })}
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Level</label>
              <select
                value={editingCourse.level || 'Beginner'}
                onChange={(e) =>
                  setEditingCourse({
                    ...editingCourse,
                    level: e.target.value as Course['level'],
                  })
                }
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm"
              >
                <option value="Beginner">Beginner</option>
                <option value="Intermediate">Intermediate</option>
                <option value="Advanced">Advanced</option>
                <option value="All Levels">All Levels</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Language</label>
              <input
                type="text"
                value={editingCourse.language || 'Bengali & English'}
                onChange={(e) => setEditingCourse({ ...editingCourse, language: e.target.value })}
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Status</label>
              <select
                value={editingCourse.status || 'draft'}
                onChange={(e) =>
                  setEditingCourse({
                    ...editingCourse,
                    status: e.target.value as Course['status'],
                  })
                }
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm"
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Course Thumbnail</label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  type="text"
                  value={editingCourse.thumbnail_url || ''}
                  onChange={(e) =>
                    setEditingCourse({ ...editingCourse, thumbnail_url: e.target.value })
                  }
                  placeholder="/uploads/..."
                  className="h-10 flex-1 rounded-lg border border-slate-300 px-3 text-xs"
                />
                <label className="inline-flex h-10 cursor-pointer items-center gap-1 rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                  <Upload className="h-3.5 w-3.5" />
                  <span>Upload</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void handleUploadThumbnail(f);
                    }}
                  />
                </label>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">Short Description</label>
            <textarea
              required
              rows={2}
              value={editingCourse.short_description || ''}
              onChange={(e) =>
                setEditingCourse({ ...editingCourse, short_description: e.target.value })
              }
              className="mt-1 w-full rounded-lg border border-slate-300 p-3 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700">Full Description</label>
            <textarea
              rows={4}
              value={editingCourse.full_description || ''}
              onChange={(e) =>
                setEditingCourse({ ...editingCourse, full_description: e.target.value })
              }
              className="mt-1 w-full rounded-lg border border-slate-300 p-3 text-sm"
            />
          </div>

          <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={Boolean(editingCourse.is_featured)}
              onChange={(e) =>
                setEditingCourse({ ...editingCourse, is_featured: e.target.checked })
              }
            />
            <span>Feature this course on Homepage</span>
          </label>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setEditingCourse(null)}
              className="h-10 rounded-lg border border-slate-300 px-4 text-xs font-semibold text-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="h-10 rounded-lg bg-[var(--brand-primary)] px-5 text-xs font-semibold text-white"
            >
              Save Course
            </button>
          </div>
        </form>
      )}

      {/* CURRICULUM / CHAPTERS / LESSONS / PRIVATE VIDEO UPLOAD */}
      {subTab === 'courses' && curriculumCourse && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <div className="text-xs font-semibold text-[var(--brand-accent)]">
                Curriculum & Private Videos
              </div>
              <h2 className="font-display text-lg font-bold text-slate-900">
                {curriculumCourse.title}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setCurriculumCourse(null)}
              className="h-9 rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-700"
            >
              Done Editing Curriculum
            </button>
          </div>

          {/* Add Chapter & Add Lesson Forms */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <form onSubmit={handleAddChapter} className="rounded-lg border border-slate-200 p-4 space-y-3">
              <div className="text-xs font-bold text-slate-800">Add Chapter</div>
              <div className="flex gap-2">
                <input
                  type="text"
                  required
                  placeholder="Chapter Title"
                  value={newChapterTitle}
                  onChange={(e) => setNewChapterTitle(e.target.value)}
                  className="h-10 flex-1 rounded-lg border border-slate-300 px-3 text-sm"
                />
                <button
                  type="submit"
                  className="h-10 rounded-lg bg-[var(--brand-primary)] px-4 text-xs font-semibold text-white"
                >
                  Add
                </button>
              </div>
            </form>

            <form onSubmit={handleAddLesson} className="rounded-lg border border-slate-200 p-4 space-y-3">
              <div className="text-xs font-bold text-slate-800">Add Lesson</div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <select
                  required
                  value={newLessonForm.chapter_id}
                  onChange={(e) => setNewLessonForm({ ...newLessonForm, chapter_id: e.target.value })}
                  className="h-10 rounded-lg border border-slate-300 px-3 text-xs"
                >
                  <option value="">Select Chapter</option>
                  {chapters.map((ch) => (
                    <option key={ch.id} value={ch.id}>
                      {ch.title}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  required
                  placeholder="Lesson Title"
                  value={newLessonForm.title}
                  onChange={(e) => setNewLessonForm({ ...newLessonForm, title: e.target.value })}
                  className="h-10 rounded-lg border border-slate-300 px-3 text-xs"
                />
              </div>
              <input
                type="text"
                placeholder="Lesson description"
                value={newLessonForm.description}
                onChange={(e) => setNewLessonForm({ ...newLessonForm, description: e.target.value })}
                className="h-10 w-full rounded-lg border border-slate-300 px-3 text-xs"
              />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="inline-flex items-center gap-2 text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={newLessonForm.is_free_preview}
                    onChange={(e) =>
                      setNewLessonForm({ ...newLessonForm, is_free_preview: e.target.checked })
                    }
                  />
                  Free Preview
                </label>
                <button
                  type="submit"
                  className="h-9 rounded-lg bg-[var(--brand-primary)] px-4 text-xs font-semibold text-white"
                >
                  Create Lesson
                </button>
              </div>
            </form>
          </div>

          {/* Chapters & Lessons List */}
          <div className="space-y-4">
            {chapters.map((ch, cIdx) => (
              <div key={ch.id} className="rounded-lg border border-slate-200 overflow-hidden">
                <div className="flex items-center justify-between bg-slate-50 px-4 py-3">
                  <span className="font-display text-sm font-bold text-slate-900">
                    {String(cIdx + 1).padStart(2, '0')}. {ch.title}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleMoveChapter(cIdx, -1)}
                      aria-label="Move chapter up"
                      className="rounded p-1.5 text-slate-500 hover:bg-slate-200"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveChapter(cIdx, 1)}
                      aria-label="Move chapter down"
                      className="rounded p-1.5 text-slate-500 hover:bg-slate-200"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await apiRequest(`/api/admin/chapters/${ch.id}`, { method: 'DELETE' });
                        await loadCurriculum(curriculumCourse);
                      }}
                      aria-label="Delete chapter"
                      className="rounded p-1.5 text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <div className="divide-y divide-slate-100">
                  {(ch.lessons || []).map((lesson, lIdx) => (
                    <div key={lesson.id} className="p-4 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="text-sm font-semibold text-slate-900">{lesson.title}</div>
                          <div className="text-xs text-slate-500">
                            {lesson.has_video ? 'Private video attached' : 'No video yet'} ·{' '}
                            {lesson.resources?.length || 0} resource(s)
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleMoveLesson(ch, lIdx, -1)}
                            aria-label="Move lesson up"
                            className="rounded border border-slate-200 p-1.5 text-slate-600"
                          >
                            <ArrowUp className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveLesson(ch, lIdx, 1)}
                            aria-label="Move lesson down"
                            className="rounded border border-slate-200 p-1.5 text-slate-600"
                          >
                            <ArrowDown className="h-3.5 w-3.5" />
                          </button>

                          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
                            <Video className="h-3.5 w-3.5" />
                            <span>{lesson.has_video ? 'Replace Video' : 'Upload Video'}</span>
                            <input
                              type="file"
                              accept="video/mp4,video/webm,video/quicktime"
                              className="hidden"
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) void handleUploadLessonVideo(lesson.id, f);
                              }}
                            />
                          </label>

                          {lesson.has_video && (
                            <button
                              type="button"
                              onClick={() => handleDeleteLessonVideo(lesson.id)}
                              className="rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
                            >
                              Delete Video
                            </button>
                          )}

                          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
                            <FileText className="h-3.5 w-3.5" />
                            <span>Add PDF</span>
                            <input
                              type="file"
                              accept="application/pdf,application/zip"
                              className="hidden"
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) void handleUploadResource(lesson.id, f);
                              }}
                            />
                          </label>

                          <button
                            type="button"
                            onClick={async () => {
                              await apiRequest(`/api/admin/lessons/${lesson.id}`, {
                                method: 'DELETE',
                              });
                              await loadCurriculum(curriculumCourse);
                            }}
                            aria-label="Delete lesson"
                            className="rounded p-1.5 text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      {lesson.resources && lesson.resources.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {lesson.resources.map((r) => (
                            <div
                              key={r.id}
                              className="inline-flex items-center gap-2 rounded border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-700"
                            >
                              <span>{r.title}</span>
                              <button
                                type="button"
                                onClick={async () => {
                                  await apiRequest(`/api/admin/resources/${r.id}`, {
                                    method: 'DELETE',
                                  });
                                  await loadCurriculum(curriculumCourse);
                                }}
                                className="text-red-600 hover:underline"
                              >
                                Remove
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* COURSE LIST TABLE */}
      {subTab === 'courses' && !editingCourse && !curriculumCourse && (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-600">
                <tr>
                  <th className="px-4 py-3">Course</th>
                  <th className="px-4 py-3">Price</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {courses.map((c) => (
                  <tr key={c.id}>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{c.title}</div>
                      <div className="text-xs text-slate-500">
                        {c.category_name || 'General'} · {c.chapter_count ?? 0} chapters ·{' '}
                        {c.lesson_count ?? 0} lessons · {c.enrollment_count ?? 0} enrolled
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs tabular-nums">
                      {c.discount_price !== null ? (
                        <div>
                          <span className="font-bold text-slate-900">৳{c.discount_price}</span>{' '}
                          <span className="line-through text-slate-400">৳{c.price}</span>
                        </div>
                      ) : (
                        <span className="font-bold text-slate-900">৳{c.price}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <button
                          type="button"
                          onClick={() => handleQuickToggle(c, 'status')}
                          className={`rounded px-2.5 py-1 font-semibold capitalize ${
                            c.status === 'published'
                              ? 'bg-emerald-50 text-emerald-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {c.status}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleQuickToggle(c, 'is_featured')}
                          className={`rounded px-2.5 py-1 font-medium ${
                            c.is_featured
                              ? 'bg-amber-50 text-amber-800'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {c.is_featured ? 'Featured' : 'Standard'}
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => loadCurriculum(c)}
                          className="inline-flex h-8 items-center gap-1 rounded border border-slate-300 px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          <span>Curriculum</span>
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingCourse(c)}
                          aria-label="Edit course"
                          className="rounded border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteCourse(c.id)}
                          aria-label="Delete course"
                          className="rounded border border-red-200 p-1.5 text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CATEGORIES MANAGEMENT */}
      {subTab === 'categories' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <form
            onSubmit={handleSaveCategory}
            className="lg:col-span-5 rounded-xl border border-slate-200 bg-white p-6 space-y-3"
          >
            <h2 className="font-display text-base font-bold text-slate-900">
              {catForm.id ? 'Edit Category' : 'Add Category'}
            </h2>
            <input
              type="text"
              required
              placeholder="Category Name (EN)"
              value={catForm.name}
              onChange={(e) => setCatForm({ ...catForm, name: e.target.value })}
              className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm"
            />
            <input
              type="text"
              placeholder="Category Name (BN)"
              value={catForm.name_bn}
              onChange={(e) => setCatForm({ ...catForm, name_bn: e.target.value })}
              className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm"
            />
            <input
              type="text"
              placeholder="Slug (optional)"
              value={catForm.slug}
              onChange={(e) => setCatForm({ ...catForm, slug: e.target.value })}
              className="h-10 w-full rounded-lg border border-slate-300 px-3 font-mono text-xs"
            />
            <textarea
              rows={2}
              placeholder="Description"
              value={catForm.description}
              onChange={(e) => setCatForm({ ...catForm, description: e.target.value })}
              className="w-full rounded-lg border border-slate-300 p-3 text-sm"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                className="h-10 rounded-lg bg-[var(--brand-primary)] px-4 text-xs font-semibold text-white"
              >
                {catForm.id ? 'Update Category' : 'Create Category'}
              </button>
              {catForm.id && (
                <button
                  type="button"
                  onClick={() => setCatForm({ id: '', name: '', name_bn: '', slug: '', description: '' })}
                  className="h-10 rounded-lg border border-slate-300 px-4 text-xs"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>

          <div className="lg:col-span-7 rounded-xl border border-slate-200 bg-white divide-y divide-slate-100">
            {categories.map((c) => (
              <div key={c.id} className="flex items-center justify-between p-4">
                <div>
                  <div className="font-semibold text-sm text-slate-900">
                    {c.name} {c.name_bn ? `(${c.name_bn})` : ''}
                  </div>
                  <div className="text-xs text-slate-500">
                    /{c.slug} · {c.course_count ?? 0} courses
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setCatForm({
                        id: c.id,
                        name: c.name,
                        name_bn: c.name_bn,
                        slug: c.slug,
                        description: c.description,
                      })
                    }
                    className="rounded border border-slate-200 px-2.5 py-1 text-xs font-medium"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await apiRequest(`/api/admin/categories/${c.id}`, { method: 'DELETE' });
                      await loadData();
                    }}
                    className="rounded border border-red-200 px-2.5 py-1 text-xs font-medium text-red-700"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
