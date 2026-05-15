import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore, useBabyStore } from '../stores/authStore';

describe('Auth Store', () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.getState().logout();
  });

  it('should initialize with unauthenticated state', () => {
    const state = useAuthStore.getState();
    
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
    expect(state.token).toBeNull();
  });

  it('should set auth state on login', () => {
    const mockUser = {
      id: '1',
      username: 'test',
      nickname: 'Test User',
      role: 'member',
    };
    
    useAuthStore.getState().setAuth(mockUser, 'mock-token');
    const state = useAuthStore.getState();
    
    expect(state.isAuthenticated).toBe(true);
    expect(state.user).toEqual(mockUser);
    expect(state.token).toBe('mock-token');
    expect(localStorage.getItem('token')).toBe('mock-token');
  });

  it('should clear auth state on logout', () => {
    const mockUser = {
      id: '1',
      username: 'test',
      nickname: 'Test User',
      role: 'member',
    };
    
    useAuthStore.getState().setAuth(mockUser, 'mock-token');
    useAuthStore.getState().logout();
    const state = useAuthStore.getState();
    
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
    expect(state.token).toBeNull();
    expect(localStorage.getItem('token')).toBeNull();
  });
});

describe('Baby Store', () => {
  beforeEach(() => {
    useBabyStore.setState({
      currentBaby: null,
      babies: [],
    });
  });

  it('should initialize with empty state', () => {
    const state = useBabyStore.getState();
    
    expect(state.currentBaby).toBeNull();
    expect(state.babies).toEqual([]);
  });

  it('should set current baby', () => {
    const mockBaby = {
      id: '1',
      name: '宝宝1',
      birthDate: '2024-01-01',
      gender: 'boy',
    };
    
    useBabyStore.getState().setCurrentBaby(mockBaby);
    
    expect(useBabyStore.getState().currentBaby).toEqual(mockBaby);
  });

  it('should set babies list', () => {
    const mockBabies = [
      { id: '1', name: '宝宝1', birthDate: '2024-01-01' },
      { id: '2', name: '宝宝2', birthDate: '2024-06-01' },
    ];
    
    useBabyStore.getState().setBabies(mockBabies as any);
    const state = useBabyStore.getState();
    
    expect(state.babies).toHaveLength(2);
    expect(state.babies[0].name).toBe('宝宝1');
  });
});
