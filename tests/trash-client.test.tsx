import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import TrashClient from '@/app/profile/trash/TrashClient';

vi.mock('next/navigation', () => ({
  usePathname: () => '/profile/trash',
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams()
}));

const row = {
  id: 'entry-1',
  type: 'entries' as const,
  babyId: 'baby-1',
  babyName: '小乐',
  deletedAt: Date.now(),
  deletedByName: '妈妈',
  label: '今天第一次自己站起来。'
};

describe('TrashClient', () => {
  it('hides permanent-delete controls from editors', () => {
    const html = renderToStaticMarkup(
      <TrashClient
        role="editor"
        initialRows={[row]}
        initialCounts={{ entries: 1, media: 0, babies: 0 }}
      />
    );

    expect(html).toContain('还原');
    expect(html).not.toContain('选择');
    expect(html).not.toContain('永久删除');
  });

  it('shows owner-only selection and permanent-delete controls', () => {
    const html = renderToStaticMarkup(
      <TrashClient
        role="owner"
        initialRows={[row]}
        initialCounts={{ entries: 1, media: 0, babies: 0 }}
      />
    );

    expect(html).toContain('选择');
    expect(html).toContain('还原');
    expect(html).toContain('永久删除');
  });
});
