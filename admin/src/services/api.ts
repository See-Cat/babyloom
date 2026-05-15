import axios from 'axios';

const api = axios.create({
  baseURL: (import.meta as any).env?.VITE_API_URL || '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.history.pushState(null, '', '/login');
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
    return Promise.reject(error);
  }
);

export default api;

export const authApi = {
  login: (username: string, password: string) =>
    api.post('/auth/login', { username, password }),
};

export const entryApi = {
  getEntries: (params?: any) => api.get('/entries', { params }),
  getEntry: (id: string) => api.get(`/entries/${id}`),
  deleteEntry: (id: string) => api.delete(`/entries/${id}`),
  restoreEntry: (id: string) => api.post(`/entries/${id}/restore`),
};

export const userApi = {
  getUsers: (params?: any) => api.get('/users', { params }),
  createUser: (data: any) => api.post('/users', data),
  updateUser: (id: string, data: any) => api.put(`/users/${id}`, data),
  deleteUser: (id: string) => api.delete(`/users/${id}`),
  restoreUser: (id: string) => api.post(`/users/${id}/restore`),
};

export const milestoneApi = {
  getMilestones: () => api.get('/milestones'),
  createMilestone: (data: any) => api.post('/milestones', data),
  updateMilestone: (id: string, data: any) => api.put(`/milestones/${id}`, data),
  deleteMilestone: (id: string) => api.delete(`/milestones/${id}`),
};

export const mediaApi = {
  getMedia: (params?: any) => api.get('/media', { params }),
  deleteMedia: (id: string) => api.delete(`/media/${id}`),
  restoreMedia: (id: string) => api.post(`/media/${id}/restore`),
};
