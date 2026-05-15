import { describe, expect, it, beforeEach, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from '../App';
import { useAuthStore, useBabyStore } from '../stores/authStore';

vi.mock('../pages/Login', () => ({
  default: () => <div>登录页</div>,
}));

vi.mock('../pages/Timeline', () => ({
  default: () => <div>时光页</div>,
}));

vi.mock('../pages/Gallery', () => ({
  default: () => <div>画廊页</div>,
}));

vi.mock('../pages/CalendarPage', () => ({
  default: () => <div>日历页</div>,
}));

vi.mock('../pages/Profile', () => ({
  default: () => <div>我的页</div>,
}));

vi.mock('../pages/Detail', () => ({
  default: () => <div>详情页</div>,
}));

vi.mock('../pages/AddEntry', () => ({
  default: () => <div>添加页</div>,
}));

vi.mock('../pages/Milestones', () => ({
  default: () => <div>里程碑页</div>,
}));

describe('App routing', () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.getState().logout();
    useBabyStore.setState({ currentBaby: null, babies: [] });
  });

  function renderApp(initialPath = '/') {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[initialPath]}>
          <App />
        </MemoryRouter>
      </QueryClientProvider>
    );
  }

  it('redirects unauthenticated users to login', async () => {
    renderApp('/');

    await waitFor(() => {
      expect(screen.getByText('登录页')).toBeInTheDocument();
    });
    expect(screen.queryByText('时光页')).not.toBeInTheDocument();
  });

  it('shows the requested page for authenticated users', async () => {
    useAuthStore.getState().setAuth(
      {
        id: 'user-1',
        username: 'mom',
        nickname: '妈妈',
        role: 'member',
      },
      'token'
    );

    renderApp('/');

    await waitFor(() => {
      expect(screen.getByText('时光页')).toBeInTheDocument();
    });
  });

  it('opens the entry composer from the bottom action', async () => {
    useAuthStore.getState().setAuth(
      {
        id: 'user-1',
        username: 'mom',
        nickname: '妈妈',
        role: 'member',
      },
      'token'
    );
    useBabyStore.setState({
      currentBaby: {
        id: 'baby-1',
        name: '小橘子',
        birthDate: '2025-09-15',
      },
      babies: [],
    });

    renderApp('/');

    fireEvent.click(screen.getByRole('button', { name: /记录/ }));

    await waitFor(() => {
      expect(screen.getByPlaceholderText('写点什么记录这一刻...')).toBeInTheDocument();
    });
  });
});
