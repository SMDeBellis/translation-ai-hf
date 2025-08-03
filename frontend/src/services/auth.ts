import axios from 'axios';
import type { User, LoginCredentials, RegisterCredentials } from '@/types';

// Create auth axios instance
const authApi = axios.create({
  baseURL: '/auth',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
authApi.interceptors.request.use(
  (config) => {
    console.log(`Auth API Request: ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    console.error('Auth API Request Error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor
authApi.interceptors.response.use(
  (response) => {
    console.log(`Auth API Response: ${response.status} ${response.config.url}`);
    return response;
  },
  (error) => {
    console.error('Auth API Response Error:', error.response?.status, error.message);
    return Promise.reject(error);
  }
);

export const authService = {
  // Register with email/password
  async register(credentials: RegisterCredentials): Promise<{ user: User; message: string }> {
    try {
      const response = await authApi.post('/register', credentials);
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Registration failed');
    }
  },

  // Login with email/password
  async login(credentials: LoginCredentials): Promise<{ user: User; message: string }> {
    try {
      const response = await authApi.post('/login', credentials);
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Login failed');
    }
  },

  // Google OAuth login
  async googleLogin(idToken: string): Promise<{ user: User; message: string }> {
    try {
      const response = await authApi.post('/google', { id_token: idToken });
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Google login failed');
    }
  },

  // Facebook OAuth login
  async facebookLogin(accessToken: string): Promise<{ user: User; message: string }> {
    try {
      const response = await authApi.post('/facebook', { access_token: accessToken });
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Facebook login failed');
    }
  },

  // Logout
  async logout(): Promise<void> {
    try {
      await authApi.post('/logout');
    } catch (error: any) {
      console.error('Logout error:', error);
      // Don't throw error for logout - always proceed with client-side logout
    }
  },

  // Get current auth status
  async getAuthStatus(): Promise<{ authenticated: boolean; user: User | null }> {
    try {
      const response = await authApi.get('/status');
      return response.data;
    } catch (error: any) {
      console.error('Auth status error:', error);
      return { authenticated: false, user: null };
    }
  },

  // Change password (for email users only)
  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    try {
      await authApi.post('/change-password', {
        current_password: currentPassword,
        new_password: newPassword,
      });
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Password change failed');
    }
  },
};

export default authService;