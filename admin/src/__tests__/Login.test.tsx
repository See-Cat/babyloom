import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Login from '../pages/Login';

vi.mock('../services/api', () => ({
  authApi: {
    login: vi.fn(),
  },
}));

describe('Admin Login Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('should render login form with all elements', () => {
    render(
      <BrowserRouter>
        <Login />
      </BrowserRouter>
    );

    expect(screen.getByText('小日子管理后台')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('账号')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('密码')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /登\s*录/ })).toBeInTheDocument();
  });

  it('should validate required fields', async () => {
    render(
      <BrowserRouter>
        <Login />
      </BrowserRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /登\s*录/ }));

    await waitFor(() => {
      expect(screen.getByText('请输入账号')).toBeInTheDocument();
    });
  });

  it('should handle successful login', async () => {
    const mockResponse = {
      data: {
        access_token: 'mock-token',
        user: {
          id: '1',
          username: 'admin',
          nickname: 'Admin',
          role: 'admin',
        },
      },
    };

    const { authApi } = await import('../services/api');
    vi.mocked(authApi.login).mockResolvedValue(mockResponse as any);

    render(
      <BrowserRouter>
        <Login />
      </BrowserRouter>
    );

    fireEvent.change(screen.getByPlaceholderText('账号'), {
      target: { value: 'admin' },
    });
    fireEvent.change(screen.getByPlaceholderText('密码'), {
      target: { value: 'admin123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /登\s*录/ }));

    await waitFor(() => {
      expect(authApi.login).toHaveBeenCalledWith('admin', 'admin123');
    });
  });
});
