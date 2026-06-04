import { createContext, useContext, useEffect, useState } from "react";
import { useGetMe, User } from "@workspace/api-client-react";
import { useLocation } from "wouter";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(localStorage.getItem("sama_token"));
  const [location, setLocation] = useLocation();

  const { data: user, isLoading: isUserLoading, error } = useGetMe({
    query: {
      queryKey: ["/api/auth/me"],
      enabled: !!token,
      retry: false,
    }
  });

  const isLoading = isUserLoading && !!token;

  useEffect(() => {
    if (error) {
      localStorage.removeItem("sama_token");
      setToken(null);
      if (location !== "/login" && location !== "/register") {
        setLocation("/login");
      }
    }
  }, [error, location, setLocation]);

  useEffect(() => {
    if (!token && location !== "/login" && location !== "/register") {
      setLocation("/login");
    }
  }, [token, location, setLocation]);

  const login = (newToken: string) => {
    localStorage.setItem("sama_token", newToken);
    setToken(newToken);
  };

  const logout = () => {
    localStorage.removeItem("sama_token");
    setToken(null);
    setLocation("/login");
  };

  return (
    <AuthContext.Provider value={{ user: user || null, isLoading, login, logout }}>
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
