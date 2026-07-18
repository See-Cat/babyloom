import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ToastContext } from '@/components/ui/ToastProvider';
import { EntryDetailView } from './EntryDetailView';

vi.mock('next/navigation', () => ({
  usePathname: () => '/entry/entry-1',
  useRouter: () => ({ push: () => undefined, refresh: () => undefined, back: () => undefined })
}));

const toast = { show: () => undefined, dismiss: () => undefined };

describe('EntryDetailView', () => {
  it('renders entry detail as a reading surface with floating actions and author meta', () => {
    const html = renderToStaticMarkup(
      <ToastContext.Provider value={toast}>
        <EntryDetailView
          entry={{
            id: 'entry-1',
            babyId: 'baby-1',
            content: '今天第一次自己扶着沙发站起来。',
            occurredAt: Date.UTC(2026, 4, 19, 14, 32),
            createdAt: Date.UTC(2026, 4, 19, 15, 1)
          }}
          babyName="小乐"
          babyBirthday="2025-02-01"
          authorName="妈妈"
          authorImage={null}
          authorAvatarColor="blue"
          milestoneNames={['第一次站立']}
          mediaItems={[{ id: 'media-1', type: 'photo' }]}
          canEdit
        />
      </ToastContext.Provider>
    );

    expect(html).toContain('aria-label="返回"');
    expect(html).toContain('aria-label="更多操作"');
    expect(html).toContain('今天第一次自己扶着沙发站起来。');
    expect(html).toContain('第一次站立');
    expect(html).toContain('妈妈');
    expect(html).toContain('data-color="blue"');
    expect(html).not.toContain('<h1');
  });
});
