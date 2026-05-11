import { create } from 'zustand';

interface User {
  id: string;
  username: string;
  email: string;
  realName: string;
  phone: string;
  role: { id: string; name: string; code: string; permissions: any };
  site?: { id: string; name: string; siteNo: string } | null;
}

interface AppState {
  user: User | null;
  token: string | null;
  sidebarOpen: boolean;
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  toggleSidebar: () => void;
  logout: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  user: null,
  token: null,
  sidebarOpen: true,
  setUser: (user) => set({ user }),
  setToken: (token) => set({ token }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    set({ user: null, token: null });
  },
}));
