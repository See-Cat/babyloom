import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Toast } from './Toast';
import { ToastProvider } from './ToastProvider';
import { useToast } from '@/lib/hooks/useToast';

describe('Toast', () => {
  it('renders message, variant, and action slot', () => {
    const html = renderToStaticMarkup(<Toast message="已删除" variant="error" action={<button type="button">撤销</button>} />);

    expect(html).toContain('已删除');
    expect(html).toContain('data-variant="error"');
    expect(html).toContain('撤销');
  });

  it('provides toast context to descendants', () => {
    function Probe() {
      const toast = useToast();
      return <span>{typeof toast.show}</span>;
    }

    const html = renderToStaticMarkup(
      <ToastProvider>
        <Probe />
      </ToastProvider>
    );

    expect(html).toContain('function');
  });

  it('throws when useToast is called outside provider', () => {
    function Probe() {
      useToast();
      return null;
    }

    expect(() => renderToStaticMarkup(<Probe />)).toThrow('useToast must be used within ToastProvider');
  });
});
