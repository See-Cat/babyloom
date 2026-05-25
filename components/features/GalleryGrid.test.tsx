import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { GalleryGrid } from './GalleryGrid';

describe('GalleryGrid', () => {
  it('renders sticky month headings with per-month media counts', () => {
    const html = renderToStaticMarkup(
      <GalleryGrid
        babyId="baby-1"
        groups={[
          {
            ym: '2026-05',
            label: '2026 年 5 月',
            items: [
              media('media-1', 'entry-1'),
              media('media-2', 'entry-2')
            ]
          }
        ]}
      />
    );

    expect(html).toContain('2026 年 5 月');
    expect(html).toContain('2 张');
    expect(html).toContain('sticky top-0');
    expect(html).toContain('/entry/entry-1');
  });

  it('renders the V2 empty state with a baby-scoped primary entry CTA', () => {
    const html = renderToStaticMarkup(<GalleryGrid babyId="baby-1" groups={[]} />);

    expect(html).toContain('还没有照片');
    expect(html).toContain('在记录里上传图片或视频,这里就会出现');
    expect(html).toContain('新建一条记录');
    expect(html).toContain('/entry/new?babyId=baby-1');
    expect(html).not.toContain('bl-card');
    expect(html).not.toContain('📸');
    expect(html).not.toContain('＋');
  });
});

function media(id: string, entryId: string | null) {
  return {
    id,
    type: 'image',
    mimeType: 'image/jpeg',
    width: 240,
    height: 240,
    durationSec: null,
    filename: `${id}.jpg`,
    takenAt: Date.UTC(2026, 4, 19),
    createdAt: Date.UTC(2026, 4, 19),
    entryId
  };
}
