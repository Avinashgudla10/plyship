import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';
import axios from 'axios';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface User {
  user_id: string;
  email: string;
  name: string;
  picture?: string;
  active_role: 'seeker' | 'company';
}

interface AuthContextType {
  user: User | null;
  sessionToken: string | null;
  isLoading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  toggleRole: (role: 'seeker' | 'company') => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    initAuth();
  }, []);

  const initAuth = async () => {
    // Check for session_id in URL (web OAuth callback)
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const sessionId = urlParams.get('session_id') || hashParams.get('session_id');
      
      if (sessionId) {
        await handleAuthCallback(`${window.location.origin}?session_id=${sessionId}`);
        // Clean URL
        window.history.replaceState({}, document.title, window.location.pathname);
        return;
      }
    }
    
    // Check for existing session
    await checkExistingSession();
  };

  const checkExistingSession = async () => {
    try {
      const token = await AsyncStorage.getItem('session_token');
      if (token) {
        setSessionToken(token);
        await fetchUserData(token);
      }
    } catch (error) {
      console.error('Check session error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUserData = async (token: string) => {
    try {
      const response = await axios.get(`${API_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUser(response.data);
    } catch (error) {
      console.error('Fetch user error:', error);
      await AsyncStorage.removeItem('session_token');
      setSessionToken(null);
      setUser(null);
    }
  };

  const login = async () => {
    try {
      const redirectUrl = Platform.OS === 'web'
        ? `${API_URL}/`
        : Linking.createURL('/');

      const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;

      if (Platform.OS === 'web') {
        window.location.href = authUrl;
      } else {
        const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
        
        if (result.type === 'success' && result.url) {
          await handleAuthCallback(result.url);
        }
      }
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  const handleAuthCallback = async (url: string) => {
    try {
      console.log('Auth callback URL:', url);
      const parsed = Linking.parse(url);
      let sessionId = parsed.queryParams?.session_id as string;
      
      if (!sessionId && url.includes('#session_id=')) {
        sessionId = url.split('#session_id=')[1].split('&')[0];
      }
      
      if (!sessionId && url.includes('?session_id=')) {
        sessionId = url.split('?session_id=')[1].split('&')[0];
      }

      console.log('Extracted session_id:', sessionId);

      if (sessionId) {
        console.log('Calling session endpoint...');
        const response = await axios.post(
          `${API_URL}/api/auth/session`,
          {},
          { headers: { 'X-Session-ID': sessionId } }
        );

        console.log('Session response:', response.data);
        const { session_token, ...userData } = response.data;
        
        await AsyncStorage.setItem('session_token', session_token);
        setSessionToken(session_token);
        setUser(userData);
        console.log('Login successful!');
      } else {
        console.log('No session_id found in URL');
      }
    } catch (error: any) {
      console.error('Auth callback error:', error);
      console.error('Error response:', error?.response?.data);
    }
  };

  const logout = async () => {
    try {
      if (sessionToken) {
        await axios.post(
          `${API_URL}/api/auth/logout`,
          {},
          { headers: { Authorization: `Bearer ${sessionToken}` } }
        );
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      await AsyncStorage.removeItem('session_token');
      setSessionToken(null);
      setUser(null);
    }
  };

  const refreshUser = async () => {
    if (sessionToken) {
      await fetchUserData(sessionToken);
    }
  };

  const toggleRole = async (role: 'seeker' | 'company') => {
    try {
      await axios.put(
        `${API_URL}/api/users/role`,
        { role },
        { headers: { Authorization: `Bearer ${sessionToken}` } }
      );
      if (user) {
        setUser({ ...user, active_role: role });
      }
    } catch (error) {
      console.error('Toggle role error:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        sessionToken,
        isLoading,
        login,
        logout,
        refreshUser,
        toggleRole
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};