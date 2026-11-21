import React from 'react';
import { ArrowRight } from 'lucide-react';
import type { Course } from '../../types/academy';
import { useApp } from '../../context/AppContext';
import { SafeImage } from '../common/SafeImage';

export function CourseCard({ course }: { course: Course }) {
  const { lang, navigate } = useApp();
  const title = lang === 'bn' && course.title_bn ? course.title_bn : course.title;
  const desc =
    lang === 'bn' && course.short_description_bn
      ? course.short_description_bn
      : course.short_description;
  const catName =
    lang === 'bn' && course.category_name_bn
      ? course.category_name_bn
      : course.category_name || 'Academy Course';

  const hasDiscount =
    course.discount_price !== null &&
    course.discount_price >= 0 &&
    course.discount_price < course.price;
  const activePrice = hasDiscount ? course.discount_price! : course.price;

  return (
    <article className="group flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white transition-colors hover:border-slate-300">
      <a
        href={`/courses/${course.slug}`}
        onClick={(e) => {
          e.preventDefault();
          navigate(`/courses/${course.slug}`);
        }}
        className="block aspect-[4/3] w-full overflow-hidden bg-slate-100"
      >
        <SafeImage
          src={course.thumbnail_url}
          alt={title}
          fallbackTitle={title}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
        />
      </a>

      <div className="flex flex-1 flex-col p-5">
        {/* Zero-pill clean unboxed metadata */}
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span className="font-medium text-[var(--brand-primary)]">{catName}</span>
          <span aria-hidden="true">·</span>
          <span>{course.level}</span>
          {course.duration ? (
            <>
              <span aria-hidden="true">·</span>
              <span>{course.duration}</span>
            </>
          ) : null}
        </div>

        <h3 className="mt-2 font-display text-lg font-semibold leading-snug text-slate-900">
          <a
            href={`/courses/${course.slug}`}
            onClick={(e) => {
              e.preventDefault();
              navigate(`/courses/${course.slug}`);
            }}
            className="hover:text-[var(--brand-primary)] transition-colors"
          >
            {title}
          </a>
        </h3>

        <p className="mt-2 line-clamp-2 flex-1 text-sm leading-relaxed text-slate-600">{desc}</p>

        <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
          <div className="flex items-baseline gap-2 tabular-nums">
            <span className="font-display text-lg font-bold text-[var(--brand-primary)]">
              ৳{activePrice.toLocaleString()}
            </span>
            {hasDiscount && (
              <span className="text-xs text-slate-400 line-through">
                ৳{course.price.toLocaleString()}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() => navigate(`/courses/${course.slug}`)}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--brand-primary)] hover:text-[var(--brand-accent)] transition-colors whitespace-nowrap shrink-0"
          >
            <span>{lang === 'bn' ? 'বিস্তারিত' : 'View Course'}</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </article>
  );
}
