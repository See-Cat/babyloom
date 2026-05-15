import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore } from '../stores/authStore';

describe('Admin Auth Store', () => {
  beforeEach(() => {
    localStorage.clear();
    const store = useAuthStore.getState();
    store.logout();
  });

  it('should initialize with unauthenticated state', () => {
    const store = useAuthStore.getState();
    
    expect(store.isAuthenticated).toBe(false);
    expect(store.user).toBeNull();
    expect(store.token).toBeNull();
  });

  it('should set auth state on login', () => {
    const store = useAuthStore.getState();
    const mockUser = {
      id: '1',
      username: 'admin',
      nickname: '管理员',
      role: 'admin',
    };
    
    store.setAuth(mockUser, 'admin-token');
    const state = useAuthStore.getState();
    
    expect(state.isAuthenticated).toBe(true);
    expect(state.user).toEqual(mockUser);
    expect(state.token).toBe('admin-token');
    expect(localStorage.getItem('token')).toBe('admin-token');
  });

  it('should clear auth state on logout', () => {
    const store = useAuthStore.getState();
    const mockUser = {
      id: '1',
      username: 'admin',
      nickname: '管理员',
      role: 'admin',
    };
    
    store.setAuth(mockUser, 'admin-token');
    store.logout();
    
    expect(store.isAuthenticated).toBe(false);
    expect(store.user).toBeNull();
    expect(store.token).toBeNull();
    expect(localStorage.getItem('token')).toBeNull();
  });

  it('should persist auth state to localStorage', () => {
    const store = useAuthStore.getState();
    const mockUser = {
      id: '1',
      username: 'admin',
      nickname: '管理员',
      role: 'admin',
    };
    
    store.setAuth(mockUser, 'admin-token');
    
    const persistedData = localStorage.getItem('admin-auth-storage');
    expect(persistedData).toBeTruthy();
    
    const parsed = JSON.parse(persistedData!);
    expect(parsed.state.user).toEqual(mockUser);
    expect(parsed.state.token).toBe('admin-token');
  });
});
