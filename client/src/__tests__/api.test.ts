import { describe, it, expect, vi, beforeEach } from 'vitest';
import api from '../services/api';

describe('API Client', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.pushState(null, '', '/');
    vi.clearAllMocks();
  });

  it('should add auth token to request headers when available', () => {
    localStorage.setItem('token', 'test-token');
    
    const config = {
      headers: {},
    };
    
    const result = (api.interceptors.request as any).handlers[0].fulfilled(config);
    
    expect(result.headers.Authorization).toBe('Bearer test-token');
  });

  it('should not add auth token when not available', () => {
    const config = {
      headers: {},
    };
    
    const result = (api.interceptors.request as any).handlers[0].fulfilled(config);
    
    expect(result.headers.Authorization).toBeUndefined();
  });

  it('should redirect to login on 401 response', async () => {
    localStorage.setItem('token', 'test-token');

    const error = {
      response: {
        status: 401,
      },
    };
    
    await expect(
      (api.interceptors.response as any).handlers[0].rejected(error)
    ).rejects.toEqual(error);
    
    expect(localStorage.getItem('token')).toBeNull();
    expect(window.location.pathname).toBe('/login');
  });
});
