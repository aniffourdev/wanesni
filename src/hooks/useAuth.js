// hooks/useAuth.js
'use client';

import { useState, useEffect, createContext, useContext } from 'react';
import { useRouter } from 'next/navigation';

const BACKEND_URL = 'https://wanesni.com';

// Create Auth Context
const AuthContext = createContext();

// Auth Provider Component
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isDemoMode, setIsDemoMode] = useState(false);

  useEffect(() => {
    // Check for stored tokens on app load
    const initAuth = async () => {
      const storedToken = localStorage.getItem('access_token');
      const storedUser = localStorage.getItem('user');
      const demoUser = localStorage.getItem('demo_user');
      
      if (demoUser) {
        // Demo mode
        setUser(JSON.parse(demoUser));
        setIsDemoMode(true);
        setLoading(false);
      } else if (storedToken && storedUser) {
        // Real authentication - verify token is still valid
        try {
          const response = await fetch(`${BACKEND_URL}/users/me`, {
            headers: {
              'Authorization': `Bearer ${storedToken}`
            }
          });
          
          if (response.ok) {
            const userData = await response.json();
            setToken(storedToken);
            setUser(userData.data);
            setIsDemoMode(false);
          } else {
            // Token invalid, clear storage
            clearAuth();
          }
        } catch (error) {
          console.error('Auth verification error:', error);
          clearAuth();
        }
      }
      
      setLoading(false);
    };

    initAuth();
  }, []);

  const login = async (email, password) => {
    try {
      setLoading(true);
      const response = await fetch(`${BACKEND_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();
      
      if (response.ok && data.data) {
        const { access_token, refresh_token } = data.data;
        
        // Get user info
        const userResponse = await fetch(`${BACKEND_URL}/users/me`, {
          headers: {
            'Authorization': `Bearer ${access_token}`
          }
        });
        
        const userData = await userResponse.json();
        
        if (userResponse.ok) {
          setToken(access_token);
          setUser(userData.data);
          setIsDemoMode(false);
          localStorage.setItem('access_token', access_token);
          localStorage.setItem('refresh_token', refresh_token);
          localStorage.setItem('user', JSON.stringify(userData.data));
          return { success: true };
        }
      }
      
      return { success: false, error: data.errors?.[0]?.message || 'Login failed' };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'Network error' };
    } finally {
      setLoading(false);
    }
  };

  const refreshToken = async () => {
    try {
      const refresh_token = localStorage.getItem('refresh_token');
      if (!refresh_token) return false;

      const response = await fetch(`${BACKEND_URL}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refresh_token }),
      });

      const data = await response.json();
      
      if (response.ok && data.data) {
        const { access_token, refresh_token: new_refresh_token } = data.data;
        setToken(access_token);
        localStorage.setItem('access_token', access_token);
        localStorage.setItem('refresh_token', new_refresh_token);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Token refresh error:', error);
      return false;
    }
  };

  const clearAuth = () => {
    setUser(null);
    setToken(null);
    setIsDemoMode(false);
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    localStorage.removeItem('demo_user');
  };

  const logout = () => {
    clearAuth();
  };

  // API helper with automatic token refresh
  const apiCall = async (url, options = {}) => {
    let authToken = token || localStorage.getItem('access_token');
    
    const makeRequest = async (token) => {
      return fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` }),
          ...options.headers,
        },
      });
    };

    let response = await makeRequest(authToken);
    
    // If unauthorized and we have a refresh token, try to refresh
    if (response.status === 401 && localStorage.getItem('refresh_token')) {
      const refreshed = await refreshToken();
      if (refreshed) {
        authToken = localStorage.getItem('access_token');
        response = await makeRequest(authToken);
      } else {
        // Refresh failed, logout user
        logout();
        throw new Error('Session expired. Please login again.');
      }
    }

    return response;
  };

  const value = {
    user,
    token,
    loading,
    login,
    logout,
    refreshToken,
    apiCall,
    isAuthenticated: !!user,
    isDemoMode
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// Custom hook to use auth context
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// HOC for protected routes
export function withAuth(Component) {
  return function AuthenticatedComponent(props) {
    const { isAuthenticated, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
      if (!loading && !isAuthenticated) {
        router.push('/login'); // 👈 redirect to /login, not /
      }
    }, [isAuthenticated, loading, router]);

    if (loading) {
      return (
        <div className="flex items-center justify-center h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      );
    }

    if (!isAuthenticated) {
      return null;
    }

    return <Component {...props} />;
  };
}
