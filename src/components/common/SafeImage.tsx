import React, { useState } from 'react';
import { BookOpen } from 'lucide-react';

interface SafeImageProps {
  src?: string;
  alt: string;
  className?: string;
  fallbackTitle?: string;
}

export function SafeImage({ src, alt, className = '', fallbackTitle }: SafeImageProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-[#0B1F3A] via-[#132F54] to-[#0B1F3A] p-6 text-center text-white ${className}`}
        role="img"
        aria-label={alt}
      >
        <BookOpen className="h-8 w-8 text-[var(--brand-accent)] mb-2 opacity-90" />
        {fallbackTitle && (
          <span className="font-display text-sm font-medium text-slate-200 line-clamp-2">
            {fallbackTitle}
          </span>
        )}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
