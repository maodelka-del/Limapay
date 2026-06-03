import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetMeQueryKey, getMe, User } from "@workspace/api-client-react";
import { useLocation } from "wouter";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (token: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("sama_token"));
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(!!localStorage.getItem("sama_token"));
  const [location, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const fetchingRef = useRef(false);

  // Fetch the current user profile with the stored token
  const fetchUser = useCallback(async (t: string) => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setIsLoading(true);
    try {
      const data = await queryClient.fetchQuery({
        queryKey: getGetMeQueryKey(),
        queryFn: () => getMe(),
        staleTime: 0,
      });
      setUser(data);
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status;
      // Only clear session on explicit 401 (bad/expired token)
      // Keep session for network errors (5xx, offline, etc.)
      if (status === 401 || status === 403) {
        localStorage.removeItem("sama_token");
        setToken(null);
        setUser(null);
      }
    } finally {
      setIsLoading(false);
      fetchingRef.current = false;
    }
  }, [queryClient]);

  // On mount: if token exists, verify it
  useEffect(() => {
    const stored = localStorage.getItem("sama_token");
    if (stored) {
      fetchUser(stored);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Redirect unauthenticated users away from protected routes
  useEffect(() => {
    if (!isLoading && !token && location !== "/login" && location !== "/register") {
      setLocation("/login");
    }
  }, [isLoading, token, location, setLocation]);

  const login = useCallback(async (newToken: string) => {
    localStorage.setItem("sama_token", newToken);
    setToken(newToken);
    // Invalidate any stale auth cache
    await queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
    await fetchUser(newToken);
  }, [queryClient, fetchUser]);

  const logout = useCallback(() => {
    localStorage.removeItem("sama_token");
    setToken(null);
    setUser(null);
    queryClient.clear();
    setLocation("/login");
  }, [queryClient, setLocation]);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
