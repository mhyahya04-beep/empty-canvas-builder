import { useEffect, useState } from "react";

export interface UserProfile {
  name: string;
  email: string;
  picture: string;
}

const AUTH_KEY = "vault.auth_user";

export function useAuth() {
  const [user, setUser] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem(AUTH_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const login = (profile: UserProfile) => {
    setUser(profile);
    localStorage.setItem(AUTH_KEY, JSON.stringify(profile));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(AUTH_KEY);
  };

  return { user, login, logout };
}
