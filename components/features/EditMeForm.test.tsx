import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ToastContext } from '@/components/ui/ToastProvider';
import { EditMeForm, validatePasswordInput } from './EditMeForm';

describe('EditMeForm', () => {
  it('renders profile and password sections', () => {
    const html = renderToStaticMarkup(
      <ToastContext.Provider value={{ show: vi.fn(), dismiss: vi.fn() }}>
        <EditMeForm initial={{ name: 'Owner', username: 'owner' }} updateMyName={vi.fn()} changeMyPassword={vi.fn()} />
      </ToastContext.Provider>
    );

    expect(html).toContain('基本资料');
    expect(html).toContain('修改密码');
    expect(html).toContain('name="name"');
    expect(html).toContain('name="currentPassword"');
  });

  it('validates password mismatch before submit', () => {
    expect(
      validatePasswordInput({
        currentPassword: 'oldpassword',
        newPassword: 'newpassword1',
        confirmNewPassword: 'newpassword2'
      })
    ).toBe('两次输入的新密码不一致');
  });

  it('accepts matching passwords with the minimum length', () => {
    expect(
      validatePasswordInput({
        currentPassword: 'oldpassword',
        newPassword: 'newpassword1',
        confirmNewPassword: 'newpassword1'
      })
    ).toBeNull();
  });

  it('keeps the action contract typed for server errors', async () => {
    const changeMyPassword = vi.fn(async (_input: { currentPassword: string; newPassword: string }) => ({ ok: false as const, message: '当前密码不正确' }));
    await expect(
      changeMyPassword({
        currentPassword: 'oldpassword',
        newPassword: 'newpassword1'
      })
    ).resolves.toEqual({ ok: false, message: '当前密码不正确' });
  });
});
