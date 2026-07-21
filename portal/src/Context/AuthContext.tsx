// AuthContext.tsx
//
// Глобальный контекст для данных текущего пользователя (me).
// Делает /auth/me один раз при старте приложения и раздаёт
// результат всем компонентам через хук useAuth().
//
// Аналогия: как Redux store, но только для одного куска данных
// (текущий пользователь) и без лишних зависимостей.

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import API from '../API/api';

interface User {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
  role: 'executor' | 'client';
  is_active: boolean;
  created_at: string;
}

interface AuthContextType {
  me: User | null;
  isLoading: boolean;
  // clearMe — вызывать при логауте, чтобы сбросить данные в контексте
  clearMe: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');

    // Если токена нет вообще — не делаем запрос, сразу isLoading=false.
    // Без этой проверки на странице логина был бы лишний 401-запрос.
    if (!token) {
      setIsLoading(false);
      return;
    }

    API.get('/auth/me')
      .then(res => setMe(res.data))
      .catch((err) => {
        console.error('AUTH/ME FAILED:', err.response?.status, err.response?.data); // ← добавить
        localStorage.removeItem('token');
      })
      .finally(() => setIsLoading(false));
  }, []);

  function clearMe() {
    setMe(null);
    localStorage.removeItem('token');
  }

  return (
    <AuthContext.Provider value={{ me, isLoading, clearMe }}>
      {children}
    </AuthContext.Provider>
  );
}

// Хук для использования в компонентах — вместо useContext(AuthContext)
// везде пишем просто useAuth(), и TypeScript сам подскажет, что внутри.
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth должен использоваться внутри AuthProvider');
  return ctx;
}