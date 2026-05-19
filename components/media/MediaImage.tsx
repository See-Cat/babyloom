'use client';

import * as React from 'react';

export interface MediaImageProps {
  mediaId: string;
  size?: 'thumb' | 'large';
  alt: string;
  width?: number;
  height?: number;
  className?: string;
}

export function MediaImage({
  mediaId,
  size = 'thumb',
  alt,
  width,
  height,
  className
}: MediaImageProps) {
  return (
    <img
      src={`/api/media/${mediaId}?size=${size}`}
      alt={alt}
      width={width}
      height={height}
      className={className}
      loading="lazy"
      decoding="async"
    />
  );
}
