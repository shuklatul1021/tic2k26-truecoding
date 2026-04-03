import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { authApi, setAuthToken, type User } from "@/lib/api";

interface AuthContextValue {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (name: string, email: string, password: string) => Promise<User>;
  registerAdmin: (name: string, email: string, password: string) => Promise<User>;
  workerLogin: (email: string, aadhaarNumber: string) => Promise<User>;
  workerRegister: (name: string, email: string, aadhaarNumber: string) => Promise<User>;
  refreshUser: () => Promise<User | null>;
  logout: () => Promise<void>;
}

interface StoredSession {
  token: string;
  user: User;
}

const AUTH_STORAGE_KEY = "civic-samadhan.auth";

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  async function persistSession(nextToken: string, nextUser: User) {
    const session: StoredSession = { token: nextToken, user: nextUser };
    setAuthToken(nextToken);
    setToken(nextToken);
    setUser(nextUser);
    await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
  }

  async function clearSession() {
    setAuthToken(null);
    setToken(null);
    setUser(null);
    await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
  }

  async function refreshUser() {
    if (!token) {
      return null;
    }

    const nextUser = await authApi.me();
    await persistSession(token, nextUser);
    return nextUser;
  }

  async function handleAuthResponse(authResponse: Awaited<ReturnType<typeof authApi.login>>) {
    await persistSession(authResponse.token, authResponse.user);
    return authResponse.user;
  }

  useEffect(() => {
    let isCancelled = false;

    async function hydrateSession() {
      try {
        const storedValue = await AsyncStorage.getItem(AUTH_STORAGE_KEY);

        if (!storedValue) {
          return;
        }

        const storedSession = JSON.parse(storedValue) as StoredSession;
        setAuthToken(storedSession.token);

        if (!isCancelled) {
          setToken(storedSession.token);
          setUser(storedSession.user);
        }

        const freshUser = await authApi.me();
        if (!isCancelled) {
          await persistSession(storedSession.token, freshUser);
        }
      } catch {
        if (!isCancelled) {
          await clearSession();
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    hydrateSession();

    return () => {
      isCancelled = true;
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      isLoading,
      login: async (email, password) => handleAuthResponse(await authApi.login(email, password)),
      register: async (name, email, password) =>
        handleAuthResponse(await authApi.register(name, email, password)),
      registerAdmin: async (name, email, password) =>
        handleAuthResponse(await authApi.registerAdmin(name, email, password)),
      workerLogin: async (email, aadhaarNumber) =>
        handleAuthResponse(await authApi.workerLogin(email, aadhaarNumber)),
      workerRegister: async (name, email, aadhaarNumber) =>
        handleAuthResponse(await authApi.workerRegister(name, email, aadhaarNumber)),
      refreshUser,
      logout: clearSession,
    }),
    [isLoading, token, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}
