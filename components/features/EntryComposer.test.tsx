import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ToastContext } from '@/components/ui/ToastProvider';
import { EntryComposer } from './EntryComposer';

const toast = {
  show: () => undefined,
  dismiss: () => undefined
};

function renderComposer() {
  return renderToStaticMarkup(
    <ToastContext.Provider value={toast}>
      <EntryComposer
        milestones={[
          { id: 'eat', name: '第一次自己吃饭', icon: '🍚' },
          { id: 'walk', name: '第一次走', icon: '👣' }
        ]}
        selectedMilestoneIds={new Set(['eat'])}
        onToggleMilestone={() => undefined}
      />
    </ToastContext.Provider>
  );
}

describe('EntryComposer', () => {
  it('keeps compose actions out of the form body because save lives in the app header', () => {
    const html = renderComposer();

    expect(html).toContain('记录内容');
    expect(html).toContain('里程碑(可多选)');
    expect(html).not.toContain('取消');
    expect(html).not.toContain('保存');
  });

  it('renders milestone chips without schema emoji icons', () => {
    const html = renderComposer();

    expect(html).toContain('第一次自己吃饭');
    expect(html).toContain('第一次走');
    expect(html).not.toContain('🍚');
    expect(html).not.toContain('👣');
    expect(html).toContain('aria-pressed="true"');
  });
});
