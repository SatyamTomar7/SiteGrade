import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      authChecked: false,
      hasHydrated: false,
      error: null,
      errorCode: null,
      
      setUser: (user) => set({ user, isAuthenticated: !!user }),
      setToken: (token) => set({ token }),
      setAuthChecked: (authChecked) => set({ authChecked }),
      setHasHydrated: (hasHydrated) => set({ hasHydrated }),
      
      login: (user, token) => {
        set({
          user,
          token,
          isAuthenticated: true,
          isLoading: false,
          authChecked: true,
          error: null,
          errorCode: null
        });
      },
      
      logout: () => {
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          isLoading: false,
          authChecked: true,
          error: null,
          errorCode: null
        });
      },
      
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error, errorCode = null) => set({ error, errorCode }),
      
      clearError: () => set({ error: null, errorCode: null }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ user: state.user, token: state.token, isAuthenticated: state.isAuthenticated }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      }
    }
  )
);
