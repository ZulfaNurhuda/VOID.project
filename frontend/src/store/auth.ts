import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User } from "@/lib/types";

interface AuthState {
  user: User | null;
  privateKeyEncrypted: string | null;
  setAuth: (user: User) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      privateKeyEncrypted: null,
      setAuth: (user) => {
        set({
          user,
          privateKeyEncrypted: user.private_key_encrypted ?? null,
        });
      },
      clearAuth: () => {
        set({ user: null, privateKeyEncrypted: null });
      },
    }),
    {
      name: "void-auth",
      partialize: (s) => ({
        user: s.user,
        privateKeyEncrypted: s.privateKeyEncrypted,
      }),
    }
  )
);
