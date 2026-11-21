import React, { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import type { Course, CourseCategory } from '../types/academy';
import { useApp } from '../context/AppContext';
import { apiRequest } from '../lib/api';
import { CourseCard } from '../components/courses/CourseCard';

export function CoursesPage({ mode = 'courses' }: { mode?: 'courses' | 'categories' }) {
  const { lang, currentPath, navigate } = useApp();
  const [courses, setCourses] = useState<Course[]>([]);
  const [categories, setCategories] = useState<CourseCategory[]>([]);
  const [loading, setLoading] = useState(true);

  const params = new URLSearchParams(currentPath.split('?')[1] || '');
  const [query, setQuery] = useState(params.get('q') || '');
  const [selectedCategory, setSelectedCategory] = useState(params.get('category') || 'all');
  const [selectedLevel, setSelectedLevel] = useState('all');

  useEffect(() => {
    const p = new URLSearchParams(currentPath.split('?')[1] || '');
    setQuery(p.get('q') || '');
    setSelectedCategory(p.get('category') || 'all');
  }, [currentPath]);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const qs = new URLSearchParams();
        if (query.trim()) qs.set('q', query.trim());
        if (selectedCategory !== 'all') qs.set('category', selectedCategory);
        if (selectedLevel !== 'all') qs.set('level', selectedLevel);

        const [cRes, catRes] = await Promise.all([
          apiRequest<{ courses: Course[] }>(`/api/public/courses?${qs.toString()}`),
          apiRequest<{ categories: CourseCategory[] }>('/api/public/categories'),
        ]);
        setCourses(cRes.courses);
        setCategories(catRes.categories);
      } finally {
        setLoading(false);
      }
    })();
  }, [query, selectedCategory, selectedLevel]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="border-b border-slate-200 pb-6">
        <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900">
          {mode === 'categories'
            ? lang === 'bn'
              ? 'কোর্স ক্যাটাগরি সমূহ'
              : 'Course Categories'
            : lang === 'bn'
              ? 'সকল প্রফেশনাল কোর্স'
              : 'All Courses'}
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          {lang === 'bn'
            ? 'আপনার ক্যারিয়ার লক্ষ্য অনুযায়ী বিষয়ভিত্তিক কোর্স নির্বাচন করুন।'
            : 'Explore structured programs with private classrooms, PDF resources, and mentor communities.'}
        </p>
      </div>

      {mode === 'categories' && (
        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => navigate(`/courses?category=${encodeURIComponent(cat.slug)}`)}
              className="flex flex-col items-start rounded-xl border border-slate-200 bg-white p-6 text-left transition-colors hover:border-[var(--brand-primary)]"
            >
              <span className="text-xs font-medium text-[var(--brand-accent)] tabular-nums">
                {cat.course_count ?? 0} {lang === 'bn' ? 'টি কোর্স' : 'Courses'}
              </span>
              <h2 className="mt-2 font-display text-lg font-semibold text-slate-900">
                {lang === 'bn' && cat.name_bn ? cat.name_bn : cat.name}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{cat.description}</p>
            </button>
          ))}
        </div>
      )}

      {/* Search & Filter Toolbar */}
      <div className="mt-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-1.5 rounded-lg bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
              selectedCategory === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {lang === 'bn' ? 'সব' : 'All'}
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.slug)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                selectedCategory === cat.slug
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {lang === 'bn' && cat.name_bn ? cat.name_bn : cat.name}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={lang === 'bn' ? 'কোর্স খুঁজুন...' : 'Search courses...'}
              className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm focus:border-[var(--brand-primary)] focus:outline-none sm:w-64"
            />
          </div>

          <select
            value={selectedLevel}
            onChange={(e) => setSelectedLevel(e.target.value)}
            aria-label="Filter by level"
            className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 focus:border-[var(--brand-primary)] focus:outline-none"
          >
            <option value="all">{lang === 'bn' ? 'সব লেভেল' : 'All Levels'}</option>
            <option value="Beginner">Beginner</option>
            <option value="Intermediate">Intermediate</option>
            <option value="Advanced">Advanced</option>
            <option value="All Levels">All Levels</option>
          </select>
        </div>
      </div>

      {/* Results Grid */}
      {loading ? (
        <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-80 animate-pulse rounded-xl border border-slate-200 bg-white" />
          ))}
        </div>
      ) : courses.length === 0 ? (
        <div className="mt-10 rounded-xl border border-slate-200 bg-white p-12 text-center">
          <p className="font-display text-lg font-semibold text-slate-900">
            {lang === 'bn' ? 'কোনো কোর্স পাওয়া যায়নি' : 'No courses match your filters'}
          </p>
          <p className="mt-1 text-sm text-slate-600">
            {lang === 'bn' ? 'অনুগ্রহ করে ফিল্টার পরিবর্তন করে আবার চেষ্টা করুন।' : 'Try clearing your search or switching categories.'}
          </p>
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setSelectedCategory('all');
              setSelectedLevel('all');
            }}
            className="mt-4 rounded-lg bg-[var(--brand-primary)] px-4 py-2 text-sm font-medium text-white"
          >
            {lang === 'bn' ? 'রিসেট করুন' : 'Reset Filters'}
          </button>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => (
            <CourseCard key={course.id} course={course} />
          ))}
        </div>
      )}
    </div>
  );
}
