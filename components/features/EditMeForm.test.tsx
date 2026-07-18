import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ToastContext } from '@/components/ui/ToastProvider';
import { EditMeForm } from './EditMeForm';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), back: vi.fn() })
}));

describe('EditMeForm', () => {
  it('renders avatar header and nickname field', () => {
    const html = renderToStaticMarkup(
      <ToastContext.Provider value={{ show: vi.fn(), dismiss: vi.fn() }}>
        <EditMeForm
          initial={{ name: 'Owner', image: null, avatarColor: 'blue' }}
          username="owner"
          target="me"
          updateMyName={vi.fn()}
        />
      </ToastContext.Provider>
    );

    expect(html).toContain('name="name"');
    expect(html).toContain('name="username"');
    expect(html).toContain('aria-label="选择头像"');
    expect(html).toContain('data-color="blue"');
    expect(html).not.toContain('修改密码');
  });
});
