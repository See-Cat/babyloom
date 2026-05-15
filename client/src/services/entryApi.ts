import api from './api';

export interface Entry {
  id: string;
  content: string;
  tags: string[];
  babyId: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  media: Media[];
  milestones: Milestone[];
  creator: {
    id: string;
    nickname: string;
    avatar?: string;
  };
}

export interface Media {
  id: string;
  type: 'photo' | 'video';
  url: string;
  thumbnail?: string;
  duration?: number;
}

export interface Milestone {
  id: string;
  name: string;
  icon?: string;
  color?: string;
}

export interface CreateEntryData {
  content: string;
  babyId: string;
  milestoneIds?: string[];
  tags?: string[];
}

export const entryApi = {
  getEntries: (params?: {
    babyId?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }) => api.get('/entries', { params }),

  getEntry: (id: string) => api.get(`/entries/${id}`),

  createEntry: (data: CreateEntryData) => api.post('/entries', data),

  updateEntry: (id: string, data: Partial<CreateEntryData>) =>
    api.put(`/entries/${id}`, data),

  deleteEntry: (id: string) => api.delete(`/entries/${id}`),

  getCalendarData: (year: number, month: number) =>
    api.get(`/entries/calendar/${year}/${month}`),
};

export const milestoneApi = {
  getMilestones: () => api.get('/milestones'),
  getAvailableMilestones: (entryId?: string) =>
    api.get('/milestones/available', { params: { entryId } }),
};

export const mediaApi = {
  uploadMedia: ({
    babyId,
    entryId,
    file,
  }: {
    babyId: string;
    entryId: string;
    file: File;
  }) => {
    const formData = new FormData();
    formData.append('babyId', babyId);
    formData.append('entryId', entryId);
    formData.append('file', file);

    return api.post('/media/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
};

export const authApi = {
  login: (username: string, password: string) =>
    api.post('/auth/login', { username, password }),
};

export const babyApi = {
  getBabies: () => api.get('/baby'),
};
