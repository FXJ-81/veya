import { create } from "zustand";

interface AuthState {
  isHydrated: boolean;
  setHydrated: (v: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  isHydrated: false,
  setHydrated: (v) => set({ isHydrated: v }),
}));
