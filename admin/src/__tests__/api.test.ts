import { describe, it, expect, vi, beforeEach } from 'vitest';
import api, { authApi, entryApi, userApi, milestoneApi, mediaApi } from '../services/api';

describe('Admin API Client', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.pushState(null, '', '/');
    vi.clearAllMocks();
  });

  it('should add auth token to request headers when available', () => {
    localStorage.setItem('token', 'admin-token');
    
    const config = {
      headers: {},
    };
    
    const result = (api.interceptors.request as any).handlers[0].fulfilled(config);
    
    expect(result.headers.Authorization).toBe('Bearer admin-token');
  });

  it('should redirect to login on 401 response', async () => {
    localStorage.setItem('token', 'admin-token');

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

describe('Auth API', () => {
  it('should call login endpoint with correct params', async () => {
    const mockPost = vi.spyOn(api, 'post').mockResolvedValue({ data: {} } as any);
    
    await authApi.login('admin', 'password');
    
    expect(mockPost).toHaveBeenCalledWith('/auth/login', {
      username: 'admin',
      password: 'password',
    });
  });
});

describe('Entry API', () => {
  it('should call getEntries with params', async () => {
    const mockGet = vi.spyOn(api, 'get').mockResolvedValue({ data: [] } as any);
    
    await entryApi.getEntries({ babyId: '1', page: 1 });
    
    expect(mockGet).toHaveBeenCalledWith('/entries', {
      params: { babyId: '1', page: 1 },
    });
  });

  it('should call deleteEntry with id', async () => {
    const mockDelete = vi.spyOn(api, 'delete').mockResolvedValue({ data: {} } as any);
    
    await entryApi.deleteEntry('entry-1');
    
    expect(mockDelete).toHaveBeenCalledWith('/entries/entry-1');
  });

  it('should call restoreEntry with id', async () => {
    const mockPost = vi.spyOn(api, 'post').mockResolvedValue({ data: {} } as any);
    
    await entryApi.restoreEntry('entry-1');
    
    expect(mockPost).toHaveBeenCalledWith('/entries/entry-1/restore');
  });
});

describe('User API', () => {
  it('should call getUsers with params', async () => {
    const mockGet = vi.spyOn(api, 'get').mockResolvedValue({ data: [] } as any);
    
    await userApi.getUsers({ includeDeleted: true });
    
    expect(mockGet).toHaveBeenCalledWith('/users', {
      params: { includeDeleted: true },
    });
  });

  it('should call createUser with data', async () => {
    const mockPost = vi.spyOn(api, 'post').mockResolvedValue({ data: {} } as any);
    const userData = { username: 'newuser', password: 'pass', nickname: 'New' };
    
    await userApi.createUser(userData);
    
    expect(mockPost).toHaveBeenCalledWith('/users', userData);
  });
});

describe('Milestone API', () => {
  it('should call getMilestones', async () => {
    const mockGet = vi.spyOn(api, 'get').mockResolvedValue({ data: [] } as any);
    
    await milestoneApi.getMilestones();
    
    expect(mockGet).toHaveBeenCalledWith('/milestones');
  });

  it('should call createMilestone with data', async () => {
    const mockPost = vi.spyOn(api, 'post').mockResolvedValue({ data: {} } as any);
    const milestoneData = { name: '翻身', icon: '👶' };
    
    await milestoneApi.createMilestone(milestoneData);
    
    expect(mockPost).toHaveBeenCalledWith('/milestones', milestoneData);
  });
});

describe('Media API', () => {
  it('should call getMedia with params', async () => {
    const mockGet = vi.spyOn(api, 'get').mockResolvedValue({ data: [] } as any);
    
    await mediaApi.getMedia({ babyId: '1' });
    
    expect(mockGet).toHaveBeenCalledWith('/media', {
      params: { babyId: '1' },
    });
  });

  it('should call deleteMedia with id', async () => {
    const mockDelete = vi.spyOn(api, 'delete').mockResolvedValue({ data: {} } as any);
    
    await mediaApi.deleteMedia('media-1');
    
    expect(mockDelete).toHaveBeenCalledWith('/media/media-1');
  });
});
