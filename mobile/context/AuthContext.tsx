import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { authApi, setToken, type User } from "@/lib/api";

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<User>;
  workerLogin: (email: string, password: string) => Promise<User>;
  verifyWorker: (data: {
    name: string;
    password: string;
    roleTitle: string;
    skills: string[];
    workLatitude?: number;
    workLongitude?: number;
    workAddress?: string;
  }) => Promise<User>;
  register: (name: string, email: string, password: string) => Promise<void>;
  registerAdmin: (orgName: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStoredAuth();
  }, []);

  const persistAuth = useCallback(async (nextToken: string, nextUser: User) => {
    setToken(nextToken);
    setTokenState(nextToken);
    setUser(nextUser);
    await AsyncStorage.setItem("auth_token", nextToken);
    await AsyncStorage.setItem("auth_user", JSON.stringify(nextUser));
  }, []);

  async function loadStoredAuth() {
    try {
      const storedToken = await AsyncStorage.getItem("auth_token");
      const storedUser = await AsyncStorage.getItem("auth_user");
      if (storedToken && storedUser) {
        setToken(storedToken);
        setTokenState(storedToken);
        setUser(JSON.parse(storedUser));
      }
    } catch {
    } finally {
      setIsLoading(false);
    }
  }

  const login = useCallback(async (email: string, password: string): Promise<User> => {
    const result = await authApi.login({ email, password });
    await persistAuth(result.token, result.user);
    return result.user;
  }, [persistAuth]);

  const register = useCallback(async (name: string, email: string, password: string) => {
    const result = await authApi.register({ name, email, password });
    await persistAuth(result.token, result.user);
  }, [persistAuth]);

  const registerAdmin = useCallback(async (orgName: string, email: string, password: string) => {
    const result = await authApi.registerAdmin({ name: orgName, email, password });
    await persistAuth(result.token, result.user);
  }, [persistAuth]);

  const workerLogin = useCallback(async (email: string, password: string): Promise<User> => {
    const result = await authApi.workerLogin({ email, password });
    await persistAuth(result.token, result.user);
    return result.user;
  }, [persistAuth]);

  const verifyWorker = useCallback(async (data: {
    name: string;
    password: string;
    roleTitle: string;
    skills: string[];
    workLatitude?: number;
    workLongitude?: number;
    workAddress?: string;
  }): Promise<User> => {
    const result = await authApi.verifyWorker(data);
    setUser(result.user);
    await AsyncStorage.setItem("auth_user", JSON.stringify(result.user));
    return result.user;
  }, []);

  const logout = useCallback(async () => {
    setToken(null);
    setTokenState(null);
    setUser(null);
    await AsyncStorage.removeItem("auth_token");
    await AsyncStorage.removeItem("auth_user");
    router.replace("/auth/login");
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const fresh = await authApi.me();
      setUser(fresh);
      await AsyncStorage.setItem("auth_user", JSON.stringify(fresh));
    } catch {}
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, workerLogin, verifyWorker, register, registerAdmin, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
