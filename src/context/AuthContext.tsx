import { createContext, useState, useContext, useEffect, ReactNode, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchWithToken } from '@/lib/api';

interface User {
  id: string;
  name: string;
  email: string;
  userType: 'user' | 'admin' | 'superadmin';
  categories: string[];
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (userData: User, token: string) => void;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('authToken'));
  const [user, setUser] = useState<User | null>(() => {
    const storedUser = localStorage.getItem('user');
    try {
      return storedUser ? JSON.parse(storedUser) : null;
    } catch (error) {
      console.error("Failed to parse user from localStorage", error);
      return null;
    }
  });
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const login = useCallback((userData: User, tokenData: string) => {
    localStorage.setItem('authToken', tokenData);
    localStorage.setItem('user', JSON.stringify(userData));
    setToken(tokenData);
    setUser(userData);
  }, []);

  const { data: syncedUser } = useQuery({
    queryKey: ['self-user-profile-sync'],
    queryFn: () => {
      const currentToken = localStorage.getItem('authToken');
      if (!currentToken) {
        return Promise.resolve(null);
      }
      return fetchWithToken('/users/me', currentToken);
    },
    enabled: !!token && !isLoading,
    refetchInterval: 20000,
    refetchOnWindowFocus: true,
    retry: false,
  });

  useEffect(() => {
    if (syncedUser && user && token) {
      const nameChanged = syncedUser.name !== user.name;
      
      const oldCategories = JSON.stringify([...(user.categories || [])].sort());
      const newCategories = JSON.stringify([...(syncedUser.categories || [])].sort());
      const categoriesChanged = oldCategories !== newCategories;

      if (nameChanged || categoriesChanged) {
        console.log("User profile change detected. Syncing...");
        login(syncedUser, token);
        queryClient.invalidateQueries({ queryKey: ['myCategoryStats'] });
        queryClient.invalidateQueries({ queryKey: ['mySubscribers'] });
        queryClient.invalidateQueries({ queryKey: ['newsArticles'] });
      }
    }
  }, [syncedUser, user, token, queryClient, login]);

  useEffect(() => {
    setIsLoading(false);
  }, []);

  const logout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
    queryClient.clear();
    navigate('/login');
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};