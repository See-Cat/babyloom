'use client';

import * as React from 'react';
import { installErrorReporter, reportClientError } from '@/lib/client/error-reporter';

interface State {
  hasError: boolean;
}

export class ClientErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { hasError: false };

  componentDidMount() {
    installErrorReporter();
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    this.setState({ hasError: true });
    reportClientError({
      message: error.message,
      stack: `${error.stack ?? ''}\n${info.componentStack}`,
      url: window.location.href,
      userAgent: navigator.userAgent
    });
  }

  render() {
    if (this.state.hasError) {
      return <main className="p-[var(--space-6)] text-center text-[color:var(--color-fg)]">页面暂时无法显示</main>;
    }
    return this.props.children;
  }
}
