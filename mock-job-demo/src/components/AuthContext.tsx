import {
  createContext,
  useState,
  ReactNode,
  useEffect,
} from 'react';
import { loginApi } from '../api/loginApi';
import type { LoginRequest } from '../types/login';
import { localStorageKey } from '../constants/localStorageKey';

type AuthContextType = {
  user: string | null;
  login: (loginRequest: LoginRequest) => Promise<void>;
  logout: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<string | null>(null);

  const login = async (LoginRequest: LoginRequest) => {
    const res = await loginApi.login(LoginRequest);
    if (res.user === res.others.user) {
      setUser(res.user);
      localStorage.setItem(localStorageKey.user, JSON.stringify(res.user));
    }
  };

  const logout = async () => {
    setUser(null);
    localStorage.removeItem(localStorageKey.user);
  };

  useEffect(() => {
    const storedUser = localStorage.getItem(localStorageKey.user);

    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user , login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
