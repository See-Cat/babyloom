import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  username: string;
  nickname: string;
  role: string;
  avatar?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  setAuth: (user: User, token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      setAuth: (user, token) => {
        localStorage.setItem('token', token);
        set({ user, token, isAuthenticated: true });
      },
      logout: () => {
        localStorage.removeItem('token');
        set({ user: null, token: null, isAuthenticated: false });
      },
    }),
    {
      name: 'auth-storage',
    }
  )
);

interface Baby {
  id: string;
  name: string;
  avatar?: string;
  birthDate: string;
  gender?: string;
}

interface BabyState {
  currentBaby: Baby | null;
  babies: Baby[];
  setCurrentBaby: (baby: Baby) => void;
  setBabies: (babies: Baby[]) => void;
}

export const useBabyStore = create<BabyState>()(
  persist(
    (set) => ({
      currentBaby: null,
      babies: [],
      setCurrentBaby: (baby) => set({ currentBaby: baby }),
      setBabies: (babies) => set({ babies }),
    }),
    {
      name: 'baby-storage',
    }
  )
);
