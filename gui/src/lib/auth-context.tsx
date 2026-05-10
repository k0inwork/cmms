"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import type { User, AuthResponse } from "@/types";
import { apiPost, storeTokens, clearTokens, getStoredTokens } from "@/lib/api-client";

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
  });

  // Restore session on mount
  useEffect(() => {
    const { access } = getStoredTokens();
    if (!access) {
      setState({ user: null, isLoading: false, isAuthenticated: false });
      return;
    }

    fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"}/auth/me`, {
      headers: { Authorization: `Bearer ${access}` },
    })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((user: User) => {
        setState({ user, isLoading: false, isAuthenticated: true });
      })
      .catch(() => {
        clearTokens();
        setState({ user: null, isLoading: false, isAuthenticated: false });
      });
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data: AuthResponse = await apiPost("/auth/login", { email, password });
    storeTokens(data.accessToken, data.refreshToken);
    setState({ user: data.user, isLoading: false, isAuthenticated: true });
  }, []);

  const logout = useCallback(async () => {
    try {
      const { refresh } = getStoredTokens();
      await apiPost("/auth/logout", { refreshToken: refresh });
    } finally {
      clearTokens();
      setState({ user: null, isLoading: false, isAuthenticated: false });
    }
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
