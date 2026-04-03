import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { authApi, setToken, type User } from "@/lib/api";

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<User>;
  workerLogin: (email: string, aadhaarNumber: string) => Promise<User>;
  workerRegister: (name: string, email: string, aadhaarNumber: string) => Promise<User>;
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
    setToken(result.token);
    setTokenState(result.token);
    setUser(result.user);
    await AsyncStorage.setItem("auth_token", result.token);
    await AsyncStorage.setItem("auth_user", JSON.stringify(result.user));
    return result.user;
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    const result = await authApi.register({ name, email, password });
    setToken(result.token);
    setTokenState(result.token);
    setUser(result.user);
    await AsyncStorage.setItem("auth_token", result.token);
    await AsyncStorage.setItem("auth_user", JSON.stringify(result.user));
  }, []);

  const registerAdmin = useCallback(async (orgName: string, email: string, password: string) => {
    const result = await authApi.registerAdmin({ name: orgName, email, password });
    setToken(result.token);
    setTokenState(result.token);
    setUser(result.user);
    await AsyncStorage.setItem("auth_token", result.token);
    await AsyncStorage.setItem("auth_user", JSON.stringify(result.user));
  }, []);

  const workerLogin = useCallback(async (email: string, aadhaarNumber: string): Promise<User> => {
    const result = await authApi.workerLogin({ email, aadhaarNumber });
    setToken(result.token);
    setTokenState(result.token);
    setUser(result.user);
    await AsyncStorage.setItem("auth_token", result.token);
    await AsyncStorage.setItem("auth_user", JSON.stringify(result.user));
    return result.user;
  }, []);

  const workerRegister = useCallback(async (name: string, email: string, aadhaarNumber: string): Promise<User> => {
    const result = await authApi.workerRegister({ name, email, aadhaarNumber });
    setToken(result.token);
    setTokenState(result.token);
    setUser(result.user);
    await AsyncStorage.setItem("auth_token", result.token);
    await AsyncStorage.setItem("auth_user", JSON.stringify(result.user));
    return result.user;
  }, []);

  const logout = useCallback(async () => {
    setToken(null);
    setTokenState(null);
    setUser(null);
    await AsyncStorage.removeItem("auth_token");
    await AsyncStorage.removeItem("auth_user");
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const fresh = await authApi.me();
      setUser(fresh);
      await AsyncStorage.setItem("auth_user", JSON.stringify(fresh));
    } catch {}
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, workerLogin, workerRegister, register, registerAdmin, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
