import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Login from '../pages/Login';


vi.mock('../services/entryApi', () => ({
  authApi: {
    login: vi.fn(),
  },
  babyApi: {
    getBabies: vi.fn(),
  },
}));

import { authApi, babyApi } from '../services/entryApi';
import { useBabyStore } from '../stores/authStore';

describe('Login Page', () => {
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

    expect(screen.getByText('小日子')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('请输入账号')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('请输入密码')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '登录' })).toBeInTheDocument();
  });

  it('should handle successful login', async () => {
    const mockResponse = {
      data: {
        access_token: 'mock-token',
        user: {
          id: '1',
          username: 'test',
          nickname: 'Test User',
          role: 'member',
        },
      },
    };

    (authApi.login as any).mockResolvedValue(mockResponse);
    (babyApi.getBabies as any).mockResolvedValue({
      data: [
        {
          id: 'baby-1',
          name: '小橘子',
          birthDate: '2025-09-15',
        },
      ],
    });

    render(
      <BrowserRouter>
        <Login />
      </BrowserRouter>
    );

    fireEvent.change(screen.getByPlaceholderText('请输入账号'), {
      target: { value: 'test' },
    });
    fireEvent.change(screen.getByPlaceholderText('请输入密码'), {
      target: { value: 'password' },
    });
    fireEvent.click(screen.getByRole('button', { name: '登录' }));

    await waitFor(() => {
      expect(authApi.login).toHaveBeenCalledWith('test', 'password');
    });
    expect(babyApi.getBabies).toHaveBeenCalled();
    expect(useBabyStore.getState().babies).toHaveLength(1);
    expect(useBabyStore.getState().currentBaby?.name).toBe('小橘子');
  });

  it('should display error message on login failure', async () => {
    (authApi.login as any).mockRejectedValue({
      response: {
        data: {
          message: '账号或密码错误',
        },
      },
    });

    render(
      <BrowserRouter>
        <Login />
      </BrowserRouter>
    );

    fireEvent.change(screen.getByPlaceholderText('请输入账号'), {
      target: { value: 'wrong' },
    });
    fireEvent.change(screen.getByPlaceholderText('请输入密码'), {
      target: { value: 'wrong' },
    });
    fireEvent.click(screen.getByRole('button', { name: '登录' }));

    await waitFor(() => {
      expect(screen.getByText('账号或密码错误')).toBeInTheDocument();
    });
  });

  it('should show loading state during login', async () => {
    (authApi.login as any).mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 100))
    );

    render(
      <BrowserRouter>
        <Login />
      </BrowserRouter>
    );

    fireEvent.change(screen.getByPlaceholderText('请输入账号'), {
      target: { value: 'test' },
    });
    fireEvent.change(screen.getByPlaceholderText('请输入密码'), {
      target: { value: 'password' },
    });
    fireEvent.click(screen.getByRole('button', { name: '登录' }));

    expect(screen.getByRole('button', { name: '登录中...' })).toBeDisabled();
  });
});
